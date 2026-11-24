"""First-pass yield simulation for the CoSTOS reference installation
(ARCHITECTURE 8.2, open work S7).

Run:
    pip install numba numpy
    LAT=48.14 LON=11.58 TILT=30 AZ=80; curl -s "https://re.jrc.ec.europa.eu/api/v5_3/seriescalc?lat=$LAT&lon=$LON&angle=$TILT&aspect=$AZ&startyear=2020&endyear=2023&outputformat=csv" -o pvgis.csv
    python3 tools/sim/yield_sim.py pvgis.csv          # all sensitivity cases
    python3 tools/sim/yield_sim.py pvgis.csv base     # base case only
    python3 tools/sim/yield_sim.py pvgis.csv onoff    # ΔTon/ΔToff sweep at ΔTset 8 K

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
- Pipes: 2 × 15 m 22 mm copper, 0.25 W/(m·K), half outside (assumed).
- Lower coil: UA 650 W/K (2.6 m², assumed 250 W/m²K).
- Store: two nodes of 400 l; every morning at 05:00 UTC both are reset to
  the month's typical morning temperature (from the recorded data for
  Jul-Nov, guessed for the other months), so each day starts like a real
  one in that month and the result is "heat into the store that day".
- Flow: linear in PWM, FMAX l/min at 100 % (assumed 8), the pump stops
  below 15 %.
- Control like the BX Plus: on at S1-S2 >= 5 K; off when S1-S2 <= 2 K and
  flow-return <= 2 K; start at 30 %, then ±1 % every 30 s to hold S1-S2 at
  ΔTset ± 1 K, 30–100 %.
"""
import numpy as np, numba, sys, csv

RHO_C = 3650.0  # J/(l K), solar fluid
DT = 5.0

def load_pvgis(path):
    g, ta, ts = [], [], []
    with open(path) as f:
        for line in f:
            if line[:2] == "20" and ":" in line[:14]:
                p = line.strip().split(",")
                ts.append(p[0]); g.append(float(p[1])); ta.append(float(p[3]))
    months = np.array([int(s[4:6]) for s in ts]); hours = np.array([int(s[9:11]) for s in ts])
    return np.array(g), np.array(ta), months, hours

# Typical store-bottom temperature at 06:00 local per month (index = month).
# Jul-Nov: medians of the recorded data 2026; the other months are guesses.
MORNING = np.array([0, 21, 22, 30, 40, 50, 60, 68, 57, 58, 40, 21, 21], float)  # index = month

@numba.njit(cache=False)
def run(g, ta, months, hours, dtset, fmax, ua_coil, c_col, pipe_len, out_month, don=5.0, doff=2.0):
    # per-collector fit P = P0*G/1000 - k1*dT - k2*dT^2, k1=4.68 W/K, k2=0.0483 W/K²
    scale = 2.0 * 58.0 / 60.0
    p0, k1, k2 = 2037.0 * scale, 4.68 * scale, 0.0483 * scale
    c_pipe = (pipe_len * 0.31 * RHO_C) + pipe_len * 0.37 * 385.0
    ua_pipe = pipe_len * 0.25
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
            tenv = 0.5 * Ta + 0.5 * 18.0
            d = tc - Ta
            q = p0 * G / 1000.0 - k1 * d - k2 * d * d
            # heat pipes are thermal diodes: once the absorber can't deliver,
            # only the manifold loses heat (1 W/K)
            if q < -1.0 * d:
                q = -1.0 * d
            # control (sensors: S1 = tc, S2 = tlo, S4 = tf, S5 = coil outlet)
            if on:
                w = fmax * pwm / 100.0 / 60.0 * RHO_C
                tout = tlo + (tf - tlo) * np.exp(-ua_coil / w)
            else:
                w = 0.0
                tout = tr
            d12 = tc - tlo
            if not on:
                if d12 >= don:
                    on = True; pwm = 30.0; tick = 0.0
            else:
                if d12 <= doff and (tf - tout) <= doff:
                    on = False; pwm = 0.0
                else:
                    tick += DT
                    if tick >= 30.0:
                        tick = 0.0
                        if d12 > dtset + 1.0 and pwm < 100.0:
                            pwm += 1.0
                        elif d12 < dtset - 1.0 and pwm > 30.0:
                            pwm -= 1.0
            if on:
                w = fmax * pwm / 100.0 / 60.0 * RHO_C
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
    g, ta, months, hours = load_pvgis(sys.argv[1])
    years = 4.0
    cases = [("base", 8.0, 650.0, 15000.0, 15.0), ("low flow 5 l/min", 5.0, 650.0, 15000.0, 15.0),
             ("high flow 12 l/min", 12.0, 650.0, 15000.0, 15.0), ("coil UA 400", 8.0, 400.0, 15000.0, 15.0),
             ("coil UA 1000", 8.0, 1000.0, 15000.0, 15.0), ("pipes 30 m", 8.0, 650.0, 15000.0, 30.0)]
    if len(sys.argv) > 2 and sys.argv[2] == "onoff":
        for don, doff in [(3, 1), (4, 1.5), (5, 2), (6, 3), (8, 4)]:
            out = np.zeros((13, 4))
            run(g, ta, months, hours, 8.0, 8.0, 650.0, 15000.0, 15.0, out, float(don), float(doff))
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
