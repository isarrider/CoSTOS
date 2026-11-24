"""Charts for ARCHITECTURE 8.2 (yield simulation), written to docs/img/sim-*.svg.

    python3 tools/sim/plots.py pvgis.csv

Runs the cases it needs from yield_sim.py (about a minute) and draws six
static SVG charts. Colours: the categorical order of the CoSTOS docs
(blue, orange, aqua), one hue per series, thin marks, recessive grid, one
y-axis per chart (two measures of different scale get two panels, never a
second axis).
"""
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
import yield_sim as ys  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "img")
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, GRID = "#2b2b29", "#6b6a64", "#e4e3de"
COP = 3.5
SETS = [4, 6, 8, 10, 12, 14, 16]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "text.color": INK,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.8, "xtick.color": INK2,
    "ytick.color": INK2, "axes.spines.top": False, "axes.spines.right": False,
    "svg.fonttype": "none", "figure.facecolor": "white", "axes.facecolor": "white",
})


def case(g, ta, mo, hr, dtset, fmax=5.9, ua=650.0, pipe=25.0, don=5.0, doff=2.0, pmin=30.0):
    out = np.zeros((13, 4))
    ys.run(g, ta, mo, hr, float(dtset), fmax, ua, 15000.0, pipe, out, don, doff, pmin)
    return out / 4.0


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), bbox_inches="tight")
    plt.close(fig)
    print("wrote", name)


def main():
    g, ta, mo, hr, ts, beam = ys.load_pvgis(sys.argv[1])
    base = {s: case(g, ta, mo, hr, s) for s in SETS}
    heat = np.array([base[s][:, 0].sum() for s in SETS])
    el = np.array([base[s][:, 2].sum() for s in SETS])
    i10 = SETS.index(10)
    net = (heat - heat[i10]) / COP - (el - el[i10])

    # 1. ΔTset: three panels sharing x, one measure each.
    fig, ax = plt.subplots(1, 3, figsize=(13, 3.8))
    fig.subplots_adjust(wspace=0.3)
    ax[0].plot(SETS, heat, color=BLUE, lw=2, marker="o", ms=6)
    ax[0].set_title("Heat into store [kWh/year]", loc="left", fontsize=10)
    ax[1].plot(SETS, el, color=ORANGE, lw=2, marker="o", ms=6)
    ax[1].set_title("Pump electricity [kWh/year]", loc="left", fontsize=10)
    ax[2].bar(SETS, net, width=1.4, color=[AQUA if v >= -0.5 else "#b9b8b0" for v in net])
    ax[2].axhline(0, color=INK2, lw=0.8)
    ax[2].set_ylim(min(net) * 1.2, 3)
    ax[2].set_title("Net vs 10 K [kWh el/year]", loc="left", fontsize=10)
    for a in ax:
        a.set_xlabel("ΔTset [K]")
        a.set_xticks(SETS)
    for x, v in zip(SETS, net):
        ax[2].annotate(f"{v:+.1f}", (x, v), textcoords="offset points",
                       xytext=(0, 4 if v >= -0.5 else -12), ha="center", fontsize=8, color=INK2)
    fig.suptitle("ΔTset: slightly more heat when lower, but the pump eats it "
                 "(base case; net = extra heat / COP 3.5 − extra pump electricity)",
                 x=0.01, y=1.04, ha="left", fontsize=11)
    save(fig, "sim-dtset.svg")

    # 2. Monthly heat at 10 K.
    m10 = base[10][1:13, 0]
    fig, ax = plt.subplots(figsize=(8, 3.2))
    ax.bar(MONTHS, m10, color=BLUE, width=0.7)
    for i, v in enumerate(m10):
        if i in (0, 5, 10):
            ax.annotate(f"{v:.0f}", (i, v), textcoords="offset points", xytext=(0, 3),
                        ha="center", fontsize=8, color=INK2)
    ax.set_title("Heat into store per month at ΔTset 10 K [kWh], mean 2020–2023",
                 loc="left", fontsize=11)
    save(fig, "sim-monthly.svg")

    # 3. Sensitivity of the net result to the flow estimate.
    fig, ax = plt.subplots(figsize=(8, 3.6))
    for name, fmax, col in [("flow −40 %", 3.5, ORANGE), ("base flow", 5.9, BLUE),
                            ("flow +50 %", 8.9, AQUA)]:
        r = {s: case(g, ta, mo, hr, s, fmax=fmax) for s in SETS}
        h = np.array([r[s][:, 0].sum() for s in SETS])
        e = np.array([r[s][:, 2].sum() for s in SETS])
        n = (h - h[i10]) / COP - (e - e[i10])
        ax.plot(SETS, n, color=col, lw=2, marker="o", ms=5, label=name)
        ax.annotate(name, (SETS[-1], n[-1]), textcoords="offset points", xytext=(6, 0),
                    va="center", fontsize=8, color=INK2)
    ax.axhline(0, color=INK2, lw=0.8)
    ax.set_xticks(SETS)
    ax.set_xlabel("ΔTset [K]")
    ax.set_title("Net vs 10 K [kWh el/year] for three flow estimates: best at 8–10 K in all",
                 loc="left", fontsize=11)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    save(fig, "sim-flow-sensitivity.svg")

    # 4. Variants at ΔTset 10 K.
    variants = [("base (25 m pipe)", base[10][:, 0].sum())]
    variants.append(("pipes 15 m", case(g, ta, mo, hr, 10, pipe=15.0)[:, 0].sum()))
    variants.append(("coil UA 400 W/K", case(g, ta, mo, hr, 10, ua=400.0)[:, 0].sum()))
    variants.append(("coil UA 1000 W/K", case(g, ta, mo, hr, 10, ua=1000.0)[:, 0].sum()))
    variants.append(("flow −40 %", case(g, ta, mo, hr, 10, fmax=3.5)[:, 0].sum()))
    variants.append(("flow +50 %", case(g, ta, mo, hr, 10, fmax=8.9)[:, 0].sum()))
    for share in (0.5, 0.8):
        gi = g * ys.iam_factor(ts, beam_share=share)
        variants.append((f"incidence angle, beam {share:.0%}", case(gi, ta, mo, hr, 10)[:, 0].sum()))
    on = case(g, ta, mo, hr, 10, don=3.0, doff=1.0)[:, 0].sum()
    variants.append(("ΔTon/ΔToff 3/1 K", on))
    variants.sort(key=lambda v: v[1])
    fig, ax = plt.subplots(figsize=(8, 3.8))
    names = [v[0] for v in variants]
    vals = [v[1] for v in variants]
    b0 = base[10][:, 0].sum()
    ax.barh(names, vals, color=[BLUE if n.startswith("base") else "#9ec5f4" for n in names], height=0.6)
    for i, v in enumerate(vals):
        ax.annotate(f"{v:.0f} ({(v / b0 - 1) * 100:+.1f} %)", (v, i), textcoords="offset points",
                    xytext=(4, 0), va="center", fontsize=8, color=INK2)
    ax.set_xlim(1800, max(vals) * 1.08)
    ax.set_title("Heat into store at ΔTset 10 K [kWh/year] by variant: the pipe matters most",
                 loc="left", fontsize=11)
    ax.grid(axis="y", visible=False)
    save(fig, "sim-variants.svg")

    # 4b. Minimum pump speed at ΔTset 10 K: heat and net in two panels.
    mins = [15, 20, 30, 40, 50, 60]
    rm = {m: case(g, ta, mo, hr, 10, pmin=float(m)) for m in mins}
    hm = np.array([rm[m][:, 0].sum() for m in mins])
    em = np.array([rm[m][:, 2].sum() for m in mins])
    i30 = mins.index(30)
    nm = (hm - hm[i30]) / COP - (em - em[i30])
    fig, ax = plt.subplots(1, 2, figsize=(10, 3.4))
    fig.subplots_adjust(wspace=0.3)
    ax[0].plot(mins, hm, color=BLUE, lw=2, marker="o", ms=6)
    ax[0].set_title("Heat into store [kWh/year]", loc="left", fontsize=10)
    ax[1].bar(mins, nm, width=4, color=[AQUA if v >= -0.5 else "#b9b8b0" for v in nm])
    ax[1].axhline(0, color=INK2, lw=0.8)
    ax[1].set_ylim(min(nm) * 1.3, max(nm) * 1.6 + 1)
    ax[1].set_title("Net vs 30 % [kWh el/year]", loc="left", fontsize=10)
    for x, v in zip(mins, nm):
        ax[1].annotate(f"{v:+.1f}", (x, v), textcoords="offset points",
                       xytext=(0, 4 if v >= -0.5 else -12), ha="center", fontsize=8, color=INK2)
    for a in ax:
        a.set_xlabel("Minimum pump speed [% PWM]")
        a.set_xticks(mins)
    fig.suptitle("Minimum pump speed at ΔTset 10 K: 30–50 % are equal, below 30 % loses heat",
                 x=0.01, y=1.04, ha="left", fontsize=11)
    save(fig, "sim-minspeed.svg")

    # 5. Flow estimate.
    pw = np.arange(0, 101, 10)
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.plot(pw[1:], ys.FLOW_TABLE[1:], color=BLUE, lw=2, marker="o", ms=6)
    ax.annotate("2.5 l/min at 30 %:\nfrom the 198 s transport delay", (30, 2.5),
                textcoords="offset points", xytext=(12, -28), fontsize=8, color=INK2,
                arrowprops={"arrowstyle": "-", "color": INK2, "lw": 0.8})
    ax.set_xlabel("PWM [%]")
    ax.set_title("Estimated solar flow [l/min] (±30 %)", loc="left", fontsize=11)
    ax.set_ylim(0, 7)
    save(fig, "sim-flow.svg")

    # 6. Incidence angle modifiers used.
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.plot(ys.IAM_ANG, ys.IAM_T, color=BLUE, lw=2, label="transversal (across the tubes)")
    ax.plot(ys.IAM_ANG, ys.IAM_L, color=ORANGE, lw=2, label="longitudinal (along the tubes)")
    ax.axhline(1, color=INK2, lw=0.8)
    ax.set_xlabel("Incidence angle [°]")
    ax.set_title("Incidence angle modifier for evacuated tubes", loc="left", fontsize=11)
    ax.legend(frameon=False, fontsize=8, loc="lower left")
    save(fig, "sim-iam.svg")


if __name__ == "__main__":
    main()
