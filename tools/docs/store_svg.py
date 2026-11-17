#!/usr/bin/env python3
"""Draws the store (Speicher) of the reference installation as an SVG.

The drawing is generated from the data below, the same shape of data the
web interface will keep in its configuration (store dimensions, coils,
connections, sensor positions) so the overview page can draw any store.
Heights in mm above the floor, from the manufacturer's dimension drawing.

Usage: python3 tools/docs/store_svg.py > docs/img/store-reference.svg
"""

STORE = {
    "name": "TWL Hygiene-Kombispeicher KER-2 800 (800 l)",
    "height": 1845,          # floor to top of the flange
    "body_top": 1785,        # top of the dome
    "stand": 125,            # height of the stand ring
    "diameter": 790,         # vessel, without insulation
    "stand_diameter": 600,
    "coils": [
        # name, bottom, top (mm), connections (top, bottom) on the right side
        {"name": "Upper coil, 1.8 m²", "bottom": 1060, "top": 1380, "use": "heat pump", "in": 1060, "out": 1380},
        {"name": "Lower coil, 2.6 m²", "bottom": 300, "top": 810, "use": "solar", "in": 810, "out": 300},
    ],
    "dhw": {"name": "Fresh-water coil (DHW)", "bottom": 330, "top": 1700},
    # side, height, size, kind: coil | water | sleeve
    "ports": [
        ("r", 1560, '1½"', "water"),
        ("r", 1380, '1"', "coil"),
        ("r", 1280, '½"', "sleeve"),
        ("r", 1060, '1"', "coil"),
        ("r", 970, '1½"', "water"),
        ("r", 810, '1"', "coil"),
        ("r", 660, '1½"', "water"),
        ("r", 455, '½"', "sleeve"),
        ("r", 300, '1"', "coil"),
        ("r", 170, '1½"', "water"),
        ("l", 1270, '½"', "sleeve"),
        ("l", 905, '1½"', "water"),
        ("l", 560, '½"', "sleeve"),
    ],
    # sensor positions get filled in once known: (name, side, height)
    "sensors": [("S3 store top", "l", 1270), ("S2 store bottom", "l", 560)],
}

S = 0.25                      # px per mm
W, H = 680, 590
CX = 360                      # vessel centre x
FLOOR = 545                   # y of the floor
COL = {"coil": "#c62828", "water": "#1565c0", "sleeve": "#2e7d32"}
NAME = {"coil": "coil", "water": "store water", "sleeve": "sleeve"}


def y(mm):
    return FLOOR - mm * S


def main():
    st = STORE
    r = st["diameter"] / 2 * S
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         'font-family="Helvetica, Arial, sans-serif">',
         "<title>Store of the reference installation</title>",
         "<desc>Combination store TWL KER-2 800, 800 litres, 790 mm diameter, 1845 mm high, with a fresh-water coil in the centre, "
         "two heat-exchanger coils on the right and store-water connections and sensor sleeves on both sides. "
         "Heights in mm above the floor.</desc>",
         "<style>.t{font-size:12px;fill:#222}.s{font-size:11px;fill:#555}.h{font-size:15px;font-weight:bold;fill:#222}</style>",
         f'<rect width="{W}" height="{H}" fill="white"/>']
    t = lambda x, yy, s, c="t", a="start", col=None: o.append(
        f'<text x="{x:.1f}" y="{yy:.1f}" class="{c}" text-anchor="{a}"'
        + (f' style="fill:{col}"' if col else "") + f">{s}</text>")
    t(20, 28, st["name"], "h")
    t(20, 46, "Heights in mm above the floor · vessel Ø 790 mm · 1845 mm high", "s")
    # floor, stand, vessel
    o.append(f'<path d="M{CX-200} {FLOOR} H{CX+200}" stroke="#999" stroke-width="1.5"/>')
    sr = st["stand_diameter"] / 2 * S
    o.append(f'<rect x="{CX-sr:.1f}" y="{y(st["stand"]):.1f}" width="{2*sr:.1f}" height="{st["stand"]*S:.1f}" '
             'fill="#eee" stroke="#777"/>')
    top, bot = y(st["body_top"]), y(st["stand"])
    o.append(f'<rect x="{CX-r:.1f}" y="{top:.1f}" width="{2*r:.1f}" height="{bot-top:.1f}" rx="{r*0.45:.1f}" '
             'fill="#fafafa" stroke="#333" stroke-width="2"/>')
    # flange and DHW connections on top
    o.append(f'<rect x="{CX-24}" y="{y(st["height"]):.1f}" width="48" height="{(st["height"]-st["body_top"])*S+4:.1f}" '
             'fill="#ddd" stroke="#555"/>')
    for dx, lbl in ((-14, "KW"), (14, "WW")):
        o.append(f'<path d="M{CX+dx} {y(st["height"]):.1f} V{y(st["height"])-14:.1f}" stroke="#6a1b9a" stroke-width="4"/>')
        t(CX + dx, y(st["height"]) - 18, lbl, "s", "middle", "#6a1b9a")
    # DHW coil: zigzag in the centre
    d = st["dhw"]
    pts, n = [], 26
    for i in range(n + 1):
        yy = y(d["top"]) + (y(d["bottom"]) - y(d["top"])) * i / n
        pts.append(f"{CX + (18 if i % 2 else -18)} {yy:.1f}")
    o.append(f'<path d="M{" L".join(pts)}" fill="none" stroke="#6a1b9a" stroke-width="1.5" opacity="0.7"/>')
    # side coils: zigzag across the vessel width
    for c in st["coils"]:
        pts, n = [], 12
        for i in range(n + 1):
            yy = y(c["top"]) + (y(c["bottom"]) - y(c["top"])) * i / n
            pts.append(f"{CX + (r - 10 if i % 2 == 0 else -r + 12):.1f} {yy:.1f}")
        o.append(f'<path d="M{" L".join(pts)}" fill="none" stroke="{COL["coil"]}" stroke-width="1.5" opacity="0.55"/>')
        my = (y(c["top"]) + y(c["bottom"])) / 2
        o.append(f'<path d="M24 {y(c["top"]):.1f} H18 V{y(c["bottom"]):.1f} H24" fill="none" stroke="{COL["coil"]}" stroke-width="1.5"/>')
        t(30, my - 2, c["name"], "s", col=COL["coil"])
        t(30, my + 12, f'{c["bottom"]}–{c["top"]} mm', "s", col=COL["coil"])
        if c.get("use"):
            t(30, my + 30, c["use"], "t", col=COL["coil"])
            t(30, my + 44, f'in {c["in"]} → out {c["out"]}', "s", col=COL["coil"])
    # ports
    for side, h, size, kind in st["ports"]:
        yy = y(h)
        if side == "r":
            x0, x1 = CX + r, CX + r + 22
            o.append(f'<path d="M{x0:.1f} {yy:.1f} H{x1:.1f}" stroke="{COL[kind]}" stroke-width="{5 if kind != "sleeve" else 3}"/>')
            t(x1 + 8, yy + 4, f"{h}", "t")
            t(x1 + 46, yy + 4, f"{size} {NAME[kind]}", "s", col=COL[kind])
        else:
            x0, x1 = CX - r, CX - r - 22
            o.append(f'<path d="M{x0:.1f} {yy:.1f} H{x1:.1f}" stroke="{COL[kind]}" stroke-width="{5 if kind != "sleeve" else 3}"/>')
            t(x1 - 8, yy + 4, f"{size} {NAME[kind]} {h}", "s", "end", COL[kind])
    t(CX, y(d["bottom"]) + 16, "fresh-water", "s", "middle", "#6a1b9a")
    t(CX, y(d["bottom"]) + 29, "coil (DHW)", "s", "middle", "#6a1b9a")
    # sensors
    for name, side, h in st["sensors"]:
        xx = CX + r - 8 if side == "r" else CX - r + 8
        o.append(f'<circle cx="{xx:.1f}" cy="{y(h):.1f}" r="6" fill="#ffb300" stroke="#222"/>')
        w = len(name) * 6.6 + 8
        lx = xx + 10 if side == "l" else xx - 10 - w
        o.append(f'<rect x="{lx:.1f}" y="{y(h)-9:.1f}" width="{w:.1f}" height="18" rx="3" fill="#fff8e1" stroke="#ffb300"/>')
        t(lx + 4, y(h) + 4, name, "s", col="#222")
    # legend
    ly = H - 22
    for i, (k, lbl) in enumerate((("coil", "heat-exchanger coil connection"), ("water", "store-water connection"),
                                  ("sleeve", "½\" sleeve (sensor?)"))):
        x = 20 + i * 220
        o.append(f'<path d="M{x} {ly-4} H{x+20}" stroke="{COL[k]}" stroke-width="4"/>')
        t(x + 26, ly, lbl, "s")
    o.append("</svg>")
    print("\n".join(o))


if __name__ == "__main__":
    main()
