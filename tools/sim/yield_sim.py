"""First-pass yield simulation for the CoSTOS reference installation
(ARCHITECTURE 8.2, open work S7).

Run:
    pip install numba numpy
    LAT=48.14 LON=11.58 TILT=30 AZ=80; curl -s "https://re.jrc.ec.europa.eu/api/v5_3/seriescalc?lat=$LAT&lon=$LON&angle=$TILT&aspect=$AZ&startyear=2020&endyear=2023&components=1&outputformat=csv" -o pvgis.csv
    python3 tools/sim/yield_sim.py pvgis.csv          # all sensitivity cases
    python3 tools/sim/yield_sim.py pvgis.csv base     # base case only
    python3 tools/sim/yield_sim.py pvgis.csv onoff    # ΔTon/ΔToff sweep at ΔTset 8 K
    python3 tools/sim/yield_sim.py pvgis.csv iam      # with incidence angle modifiers
    python3 tools/sim/yield_sim.py pvgis.csv minspeed # minimum pump speed sweep
    python3 tools/sim/yield_sim.py pvgis.csv trees    # fit the tree shading
    python3 tools/sim/yield_sim.py pvgis.csv dynamic  # dynamic ΔTset rules

The PVGIS file is not in the repository: it is the EU's data (PVGIS ©
European Union) and one command fetches it.

Which ΔTset (target collector minus store-bottom difference of the speed
control) gives the most solar heat? Lumped model, 5 s steps, PVGIS hourly
irradiance on the collector plane (Munich, 30° tilt, azimuth 80°), 2020-2023.

Model (all assumptions marked; to be calibrated once the flow table exists):
- Collector: data-sheet output 2037/1853/1682 W per collector at 1000 W/m²
  and ΔT 0/30/50 K, scaled to 58 of 60 tubes. Heat pipes are thermal
  diodes, so without sun the manifold only loses a little (1 W/K).
- Collector manifold + fluid: 15 kJ/K (assumed).
- Pipes: DN 16 twin stainless corrugated solar pipe, 2 × 25 m, of which
  about 3 m outdoors (owner); 0.22 W/(m·K) per pipe with the standard
  insulation, 0.23 l/m, indoor part at 15 °C (assumed).
- Incidence angle (optional, IAM): beam light on the tubes is weighted with
  a transversal and a longitudinal incidence angle modifier for evacuated
  tubes (tubes along the slope); BEAM_SHARE sets how much of G(i) is
  treated as beam, because the PVGIS file has no beam/diffuse split.
- Lower coil: UA 650 W/K (2.6 m², assumed 250 W/m²K).
- Store: two nodes of 400 l; every morning at 05:00 UTC both are reset to
  the month's typical morning temperature (from the recorded data for
  Jul-Nov, guessed for the other months), so each day starts like a real
  one in that month and the result is "heat into the store that day".
- Flow: from the pump curve (Yonos PARA ST 15/7: 7.3 m, 3.3 m³/h) and a
  system curve whose lumped resistance is calibrated so that 30 % PWM gives
  2.5 l/min, the flow implied by the measured transport delay at pump
  starts (about 200 s for ~6.6 l of DN 16 flow pipe and station). Table
  FLOW_TABLE below, scaled by FMAX/5.9 for the sensitivity cases.
- Control like the BX Plus: on at S1-S2 >= 5 K; off when S1-S2 <= 2 K and
  flow-return <= 2 K; start at 30 %, then ±1 % every 30 s to hold S1-S2 at
  ΔTset ± 1 K, 30–100 %.
"""
import numpy as np, numba, sys, csv

RHO_C = 3650.0  # J/(l K), solar fluid

# Flow in l/min at PWM 0, 10, ..., 100 % (ARCHITECTURE 8.2). 10 % stands for
# the PWM2 minimum band (7-15 %): minimum speed, 1.5 l/min.
FLOW_TABLE = np.array([0.0, 1.5, 1.8, 2.5, 3.2, 3.7, 4.0, 4.5, 5.1, 5.6, 5.9])
DT = 5.0

# Incidence angle modifiers for evacuated tubes (generic curves, as in
# Quaschning, Regenerative Energiesysteme, Bild 3.25): angle in degrees.
IAM_ANG = np.array([0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 90], float)
IAM_T = np.array([1.0, 1.0, 1.02, 1.07, 1.12, 1.16, 1.19, 1.2, 1.17, 0.6, 0.0])
IAM_L = np.array([1.0, 1.0, 0.99, 0.98, 0.96, 0.92, 0.85, 0.7, 0.42, 0.2, 0.0])


def iam_factor(ts, lat=48.14, lon=11.58, tilt=30.0, aspect=80.0, beam_share=0.5):
    """Per-hour factor on G(i): 1 - beam_share + beam_share * K_t * K_l.

    beam_share is a number (assumed for every hour) or an array with the
    real share per hour from a PVGIS file with components.

    Sun position from a simple solar-geometry formula (good to ~1°);
    PVGIS stamps are UTC at hh:10. aspect 0 = south, 90 = west.
    """
    import datetime as _dt
    f = np.ones(len(ts))
    tr, ar, lr = np.radians(tilt), np.radians(aspect), np.radians(lat)
    # collector frame in (east, north, up)
    az_n = np.radians(180.0 + aspect)
    n = np.array([np.sin(tr) * np.sin(az_n), np.sin(tr) * np.cos(az_n), np.cos(tr)])
    a = np.array([-np.cos(tr) * np.sin(az_n), -np.cos(tr) * np.cos(az_n), np.sin(tr)])  # up the slope
    tv = np.cross(n, a)
    shares = np.broadcast_to(np.asarray(beam_share, float), (len(ts),))
    for i, s in enumerate(ts):
        bs = shares[i]
        t = _dt.datetime(int(s[0:4]), int(s[4:6]), int(s[6:8]), int(s[9:11]), int(s[11:13]))
        doy = t.timetuple().tm_yday
        g = 2 * np.pi / 365 * (doy - 1 + (t.hour + t.minute / 60 - 12) / 24)
        decl = 0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g) + 0.000907 * np.sin(2 * g)
        eqt = 229.18 * (0.000075 + 0.001868 * np.cos(g) - 0.032077 * np.sin(g) - 0.014615 * np.cos(2 * g) - 0.040849 * np.sin(2 * g))
        solar_min = t.hour * 60 + t.minute + eqt + 4 * lon
        ha = np.radians(solar_min / 4 - 180)
        cz = np.sin(lr) * np.sin(decl) + np.cos(lr) * np.cos(decl) * np.cos(ha)
        if cz <= 0:
            continue
        # sun vector (east, north, up)
        sv = np.array([-np.cos(decl) * np.sin(ha),
                       np.sin(decl) * np.cos(lr) - np.cos(decl) * np.cos(ha) * np.sin(lr),
                       cz])
        sn = sv @ n
        if sn <= 0:
            f[i] = 1 - bs
            continue
        th_t = np.degrees(np.arctan2(abs(sv @ tv), sn))
        th_l = np.degrees(np.arctan2(abs(sv @ a), sn))
        k = np.interp(th_t, IAM_ANG, IAM_T) * np.interp(th_l, IAM_ANG, IAM_L)
        f[i] = 1 - bs + bs * k
    return f


def sun_az_el(ts, lat=48.14, lon=11.58):
    """Sun azimuth (degrees from north, clockwise) and elevation per PVGIS
    time stamp (UTC, hh:10), simple solar geometry good to about 1°."""
    import datetime as _dt
    lr = np.radians(lat)
    az = np.zeros(len(ts)); el = np.zeros(len(ts))
    for i, s in enumerate(ts):
        t = _dt.datetime(int(s[0:4]), int(s[4:6]), int(s[6:8]), int(s[9:11]), int(s[11:13]))
        doy = t.timetuple().tm_yday
        g = 2 * np.pi / 365 * (doy - 1 + (t.hour + t.minute / 60 - 12) / 24)
        decl = 0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g) + 0.000907 * np.sin(2 * g)
        eqt = 229.18 * (0.000075 + 0.001868 * np.cos(g) - 0.032077 * np.sin(g) - 0.014615 * np.cos(2 * g) - 0.040849 * np.sin(2 * g))
        ha = np.radians((t.hour * 60 + t.minute + eqt + 4 * lon) / 4 - 180)
        cz = np.sin(lr) * np.sin(decl) + np.cos(lr) * np.cos(decl) * np.cos(ha)
        el[i] = np.degrees(np.arcsin(np.clip(cz, -1, 1)))
        e = -np.cos(decl) * np.sin(ha)
        n = np.sin(decl) * np.cos(lr) - np.cos(decl) * np.cos(ha) * np.sin(lr)
        az[i] = (np.degrees(np.arctan2(e, n)) + 360) % 360
    return az, el


# Trees directly south of the house (owner), height fitted to the recorded
# pump hours of July-October 2026 (ARCHITECTURE 8.2): 30° above the horizon
# from south-east to south-west.
TREES = (30.0, 135.0, 225.0)


def shade_factor(ts, beam, trees=TREES):
    """Per-hour factor on G(i) for a horizon obstacle: while the sun is in the
    azimuth sector and below the obstacle's elevation, the beam part of the
    light is blocked and only the diffuse part reaches the tubes. The small
    loss of diffuse light from the sky the trees hide is ignored."""
    h, a1, a2 = trees
    az, el = sun_az_el(ts)
    blocked = (az >= a1) & (az <= a2) & (el > 0) & (el < h)
    f = np.ones(len(ts))
    f[blocked] = 1.0 - beam[blocked]
    return f, blocked


def load_pvgis(path):
    """Reads a PVGIS seriescalc CSV, with or without &components=1.

    Returns G(i), T2m, month, hour (UTC), the time stamps, and the beam
    share of G(i) per hour (None if the file has no components). With
    components, G(i) is the sum Gb(i) + Gd(i) + Gr(i).
    """
    g, ta, ts, beam = [], [], [], []
    cols = None
    with open(path) as f:
        for line in f:
            if line.startswith("time,"):
                cols = line.strip().split(",")
                continue
            if cols and line[:2] == "20" and ":" in line[:14]:
                p = dict(zip(cols, line.strip().split(",")))
                ts.append(p["time"])
                ta.append(float(p["T2m"]))
                if "Gb(i)" in p:
                    gb, gd, gr = float(p["Gb(i)"]), float(p["Gd(i)"]), float(p["Gr(i)"])
                    g.append(gb + gd + gr)
                    beam.append(gb / (gb + gd + gr) if gb + gd + gr > 0 else 0.0)
                else:
                    g.append(float(p["G(i)"]))
    months = np.array([int(s[4:6]) for s in ts]); hours = np.array([int(s[9:11]) for s in ts])
    return np.array(g), np.array(ta), months, hours, ts, (np.array(beam) if beam else None)


# Typical store-bottom temperature at 06:00 local per month (index = month).
# Jul-Nov: medians of the recorded data 2026; the other months are guesses.
MORNING = np.array([0, 21, 22, 30, 40, 50, 60, 68, 57, 58, 40, 21, 21], float)  # index = month

@numba.njit(cache=False)
def flow(pwm):
    i = int(pwm // 10.0)
    if i >= 10:
        return FLOW_TABLE[10]
    f = (pwm - 10.0 * i) / 10.0
    return FLOW_TABLE[i] * (1.0 - f) + FLOW_TABLE[i + 1] * f


@numba.njit(cache=False)
def run(g, ta, months, hours, dtset, fmax, ua_coil, c_col, pipe_len, out_month, don=5.0, doff=2.0, pmin=30.0):
    # per-collector fit P = P0*G/1000 - k1*dT - k2*dT^2, k1=4.68 W/K, k2=0.0483 W/K²
    scale = 2.0 * 58.0 / 60.0
    p0, k1, k2 = 2037.0 * scale, 4.68 * scale, 0.0483 * scale
    c_pipe = (pipe_len * 0.23 * RHO_C) + pipe_len * 0.15 * 500.0
    ua_pipe = pipe_len * 0.22
    c_node = 400.0 * 4180.0
    tc = 10.0; tf = 20.0; tr = 20.0; tlo = 40.0; thi = 42.0
    on = False; pwm = 0.0; tick = 0.0
    run_s = 0.0
    n = g.shape[0]
    steps = int(3600 / DT)
    for h in range(n - 1):
        m = months[h]
        if hours[h] == 5:
            tlo = MORNING[m]; thi = tlo + 2.0
        for s in range(steps):
            f = s / steps
            G = g[h] * (1 - f) + g[h + 1] * f
            Ta = ta[h] * (1 - f) + ta[h + 1] * f
            tenv = 0.12 * Ta + 0.88 * 15.0
            d = tc - Ta
            q = p0 * G / 1000.0 - k1 * d - k2 * d * d
            # heat pipes are thermal diodes: once the absorber can't deliver,
            # only the manifold loses heat (1 W/K)
            if q < -1.0 * d:
                q = -1.0 * d
            # control (sensors: S1 = tc, S2 = tlo, S4 = tf, S5 = coil outlet)
            if on:
                w = flow(pwm) * fmax / 5.9 / 60.0 * RHO_C
                tout = tlo + (tf - tlo) * np.exp(-ua_coil / w)
            else:
                w = 0.0
                tout = tr
            d12 = tc - tlo
            if not on:
                if d12 >= don:
                    on = True; pwm = pmin; tick = 0.0
            else:
                if d12 <= doff and (tf - tout) <= doff:
                    on = False; pwm = 0.0
                else:
                    tick += DT
                    if tick >= 30.0:
                        tick = 0.0
                        # Dynamic ΔTset rules (ARCHITECTURE 8.2), selected by
                        # negative codes; a positive dtset is a fixed value.
                        ds = dtset
                        if dtset == -1.0:    # hot store (> 50 °C): 6 K, else 12 K
                            ds = 6.0 if tlo > 50.0 else 12.0
                        elif dtset == -2.0:  # hot store: 12 K, else 6 K
                            ds = 12.0 if tlo > 50.0 else 6.0
                        elif dtset == -3.0:  # strong sun (> 600 W/m²): 6 K, else 12 K
                            ds = 6.0 if G > 600.0 else 12.0
                        elif dtset == -4.0:  # strong sun: 12 K, else 6 K
                            ds = 12.0 if G > 600.0 else 6.0
                        if d12 > ds + 1.0 and pwm < 100.0:
                            pwm += 1.0
                        elif d12 < ds - 1.0 and pwm > pmin:
                            pwm -= 1.0
            if on:
                w = flow(pwm) * fmax / 5.9 / 60.0 * RHO_C
                tout = tlo + (tf - tlo) * np.exp(-ua_coil / w)
                qcoil = w * (tf - tout)
                run_s += DT
            else:
                w = 0.0; qcoil = 0.0; tout = tr
            # nodes
            tc += DT * (q + w * (tr - tc)) / c_col
            tf += DT * (w * (tc - tf) - ua_pipe * (tf - tenv)) / c_pipe
            tr += DT * (w * (tout - tr) - ua_pipe * (tr - tenv)) / c_pipe
            tlo += DT * (qcoil - 2.5 * (tlo - 20.0) - 30.0 * (tlo - thi)) / c_node
            thi += DT * (-2.5 * (thi - 20.0) + 30.0 * (tlo - thi)) / c_node
            if tlo > thi:
                tm = 0.5 * (tlo + thi); tlo = tm; thi = tm
            if qcoil > 0:
                out_month[m, 0] += qcoil * DT / 3.6e6
            out_month[m, 1] += (DT / 3600.0) if on else 0.0
            # pump electricity, Yonos PARA iPWM roughly 3 W + 42 W*(pwm)^2
            if on:
                out_month[m, 3] += pwm * DT / 3600.0
                out_month[m, 2] += (3.0 + 42.0 * (pwm / 100.0) ** 2) * DT / 3.6e6
    return run_s


def main():
    g, ta, months, hours, ts, beam = load_pvgis(sys.argv[1])
    if len(sys.argv) > 2 and sys.argv[2] == "trees":
        # Fit of the tree height to the recorded pump hours (needs components).
        if beam is None:
            sys.exit("the trees mode needs a PVGIS file with &components=1")
        rec = {7: 242, 8: 201, 9: 186, 10: 112}
        gi = g * iam_factor(ts, beam_share=beam)
        for h in (0.0, 15.0, 20.0, 25.0, 30.0, 35.0):
            f, _ = shade_factor(ts, beam, (h, 135.0, 225.0))
            out = np.zeros((13, 4))
            run(gi * f, ta, months, hours, 10.0, 5.9, 650.0, 15000.0, 25.0, out)
            out /= 4.0
            err = np.mean([abs(out[m, 1] - r) / r for m, r in rec.items()])
            print(f"trees {h:4.0f}°: {out[:,0].sum():6.0f} kWh/yr  pump hours Jul-Nov "
                  + " ".join(f"{out[m,1]:4.0f}" for m in range(7, 12))
                  + f"  mean |error| Jul-Oct {err*100:4.1f} %  (recorded 242 201 186 112)")
        return
    if len(sys.argv) > 2 and sys.argv[2] == "dynamic":
        # Dynamic ΔTset against a fixed 10 K, with incidence angle and trees.
        if beam is None:
            sys.exit("the dynamic mode needs a PVGIS file with &components=1")
        gi = g * iam_factor(ts, beam_share=beam) * shade_factor(ts, beam)[0]
        res = {}
        for code, name in [(10.0, "fixed 10 K"), (-1.0, "hot store > 50 °C: 6 K, else 12 K"),
                           (-2.0, "hot store: 12 K, else 6 K"), (-3.0, "strong sun > 600 W/m²: 6 K, else 12 K"),
                           (-4.0, "strong sun: 12 K, else 6 K")]:
            out = np.zeros((13, 4))
            run(gi, ta, months, hours, code, 5.9, 650.0, 15000.0, 25.0, out)
            res[name] = out / 4.0
        ref = res["fixed 10 K"]
        for name, o in res.items():
            net = (o[:, 0].sum() - ref[:, 0].sum()) / 3.5 - (o[:, 2].sum() - ref[:, 2].sum())
            print(f"{name:40s} {o[:,0].sum():6.0f} kWh/yr  {o[:,2].sum():5.1f} kWh_el  net vs 10 K {net:+5.1f} kWh el")
        # Upper bound of a month-by-month ΔTset.
        fixed = {}
        for d in (4, 6, 8, 10, 12, 14, 16):
            out = np.zeros((13, 4))
            run(gi, ta, months, hours, float(d), 5.9, 650.0, 15000.0, 25.0, out)
            fixed[d] = out / 4.0
        best = 0.0
        for m in range(1, 13):
            best += max((fixed[d][m, 0] - fixed[10][m, 0]) / 3.5 - (fixed[d][m, 2] - fixed[10][m, 2]) for d in fixed)
        print(f"best possible ΔTset per month: net vs 10 K {best:+.1f} kWh el/year")
        return
    if len(sys.argv) > 2 and sys.argv[2] == "minspeed":
        # Minimum pump speed (start value and lower limit of the speed control).
        for pmin in (15.0, 20.0, 30.0, 40.0, 50.0, 60.0):
            for dts in (8.0, 10.0, 12.0):
                out = np.zeros((13, 4))
                run(g, ta, months, hours, dts, 5.9, 650.0, 15000.0, 25.0, out, 5.0, 2.0, pmin)
                out /= 4.0
                print(f"min {pmin:4.0f} % dTset {dts:4.1f}: {out[:,0].sum():6.0f} kWh/yr  pump {out[:,1].sum():5.0f} h"
                      f"  {out[:,2].sum():5.1f} kWh_el  mean pwm {out[:,3].sum()/out[:,1].sum():4.1f}")
        return
    if len(sys.argv) > 2 and sys.argv[2] == "iam":
        shares = [("none", 0.0), ("assumed 50 %", 0.5), ("assumed 80 %", 0.8)]
        if beam is not None:
            shares.append(("from PVGIS components", beam))
        for name, share in shares:
            gi = g * iam_factor(ts, beam_share=share)
            for dts in (6.0, 8.0, 10.0):
                out = np.zeros((13, 4))
                run(gi, ta, months, hours, dts, 5.9, 650.0, 15000.0, 25.0, out)
                out /= 4.0
                print(f"beam share {name:22s} dTset {dts:4.1f}: {out[:,0].sum():6.0f} kWh/yr  {out[:,2].sum():5.1f} kWh_el")
        return
    years = 4.0
    cases = [("base", 5.9, 650.0, 15000.0, 25.0), ("flow -40 %", 3.5, 650.0, 15000.0, 25.0),
             ("flow +50 %", 8.9, 650.0, 15000.0, 25.0), ("coil UA 400", 5.9, 400.0, 15000.0, 25.0),
             ("coil UA 1000", 5.9, 1000.0, 15000.0, 25.0), ("pipes 15 m", 5.9, 650.0, 15000.0, 15.0)]
    if len(sys.argv) > 2 and sys.argv[2] == "onoff":
        for don, doff in [(3, 1), (4, 1.5), (5, 2), (6, 3), (8, 4)]:
            out = np.zeros((13, 4))
            run(g, ta, months, hours, 8.0, 5.9, 650.0, 15000.0, 25.0, out, float(don), float(doff))
            out /= years
            print(f"on {don} off {doff}: {out[:,0].sum():6.0f} kWh/yr  pump {out[:,1].sum():5.0f} h  {out[:,2].sum():5.1f} kWh_el")
        return
    if len(sys.argv) > 2:
        cases = cases[:1]
    sets = [4, 6, 8, 10, 12, 14, 16]
    rows = []
    for name, fmax, ua, cc, pl in cases:
        for s in sets:
            out = np.zeros((13, 4))
            run(g, ta, months, hours, float(s), fmax, ua, cc, pl, out)
            out /= years
            rows.append((name, s, out.copy()))
            print(f"{name:20s} dTset {s:2d}: {out[:,0].sum():7.0f} kWh/yr  pump {out[:,1].sum():6.0f} h  {out[:,2].sum():5.1f} kWh_el  "
                  + " ".join(f"{out[mm,0]:5.0f}" for mm in range(1, 13)) + f"  mean pwm {out[:,3].sum()/out[:,1].sum():4.1f}  h Jul-Nov " + " ".join(f"{out[mm,1]:4.0f}" for mm in range(7,12)), flush=True)

if __name__ == "__main__":
    main()
