#!/usr/bin/env python3
"""Stripboard layout of the OSCoST PWM pump driver (TC4427 gate driver).

Single source of truth for the layout drawings in docs/img/. The script
  1. computes which holes are connected (copper strips, cuts, components,
     wire links),
  2. checks that against the intended circuit (netlist) and fails loudly
     on any difference,
  3. writes the component-side and copper-side SVG drawings.

Run from the repository root:  python3 tools/hw/pwm_driver_layout.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# --- board -----------------------------------------------------------------
# Stripboard, copper strips run horizontally (along x). Holes are numbered
# x = 1..W (columns, left to right) and y = 1..H (rows = strips, top to
# bottom), as seen from the component side.
W, H = 20, 11

# Holes where the strip is cut (drilled through).
CUTS = [(9, 5), (9, 6), (9, 7)]

# Components: name -> (label, value, {pin: (x, y)}, kind)
COMPONENTS = {
    "J1": ("J1", "to Pi: 5V / GND / PWM", {"5V": (1, 3), "GND": (1, 4), "PWM": (1, 5)}, "header3"),
    "U2": ("U2", "B0512S-1WR3", {"4": (4, 1), "3": (4, 2), "2": (4, 3), "1": (4, 4)}, "sip4"),
    "C3": ("C3", "4.7 µF", {"+": (6, 3), "-": (6, 2)}, "elko"),
    "C2": ("C2", "2.2 µF", {"+": (7, 1), "-": (7, 2)}, "elko"),
    "R3": ("R3", "1.5 kΩ", {"a": (9, 1), "b": (9, 2)}, "res_up"),
    "R1": ("R1", "100 kΩ", {"a": (7, 5), "b": (7, 4)}, "res_up"),
    "U1": ("U1", "TC4427", {
        "1": (8, 4), "2": (8, 5), "3": (8, 6), "4": (8, 7),
        "8": (11, 4), "7": (11, 5), "6": (11, 6), "5": (11, 7)}, "dip8"),
    "C1": ("C1", "100 nF", {"a": (12, 6), "b": (12, 4)}, "cer"),
    "R2": ("R2", "470 Ω 0.5 W", {"a": (15, 5), "b": (15, 9)}, "res"),
    "D1": ("D1", "P6KE15A", {"K": (17, 9), "A": (17, 11)}, "tvs_up"),
    "J2": ("J2", "to pump", {"PWM": (19, 9), "GND": (19, 11)}, "screw2"),
}

# Wire links on the component side: name -> ((x1, y1), (x2, y2))
LINKS = {
    "L1": ((13, 2), (13, 4)),   # DC/DC 0V -> GND
    "L2": ((6, 6), (6, 4)),     # U1 GND (pin 3) -> GND
    "L3": ((7, 7), (7, 6)),     # U1 IN B (pin 4) -> GND
    "L4": ((14, 6), (14, 1)),   # U1 VDD (pin 6) -> +12 V
    "L5": ((18, 11), (18, 4)),  # pump GND -> GND
}

# Intended circuit: net -> set of component pins
NETLIST = {
    "GND": {"J1.GND", "U2.1", "U2.3", "C3.-", "C2.-", "R3.b", "R1.b", "U1.1",
            "U1.8", "U1.3", "U1.4", "C1.b", "D1.A", "J2.GND"},
    "+12V": {"U2.4", "C2.+", "R3.a", "U1.6", "C1.a"},
    "+5V": {"J1.5V", "U2.2", "C3.+"},
    "PWM_IN": {"J1.PWM", "R1.a", "U1.2"},
    "OUT_A": {"U1.7", "R2.a"},
    "PUMP_PWM": {"R2.b", "D1.K", "J2.PWM"},
    "NC_OUT_B": {"U1.5"},
}


# --- connectivity check ----------------------------------------------------
class DSU:
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def check() -> list[str]:
    errors = []
    used: dict[tuple[int, int], str] = {}

    def occupy(hole, who):
        x, y = hole
        if not (1 <= x <= W and 1 <= y <= H):
            errors.append(f"{who} at {hole} is outside the board")
        if hole in CUTS:
            errors.append(f"{who} at {hole} sits on a strip cut")
        if hole in used:
            errors.append(f"hole {hole} used twice: {used[hole]} and {who}")
        used[hole] = who

    for name, (_, _, pins, _) in COMPONENTS.items():
        for pin, hole in pins.items():
            occupy(hole, f"{name}.{pin}")
    for name, (a, b) in LINKS.items():
        occupy(a, name)
        occupy(b, name)

    d = DSU()
    # copper strips, interrupted by cuts
    for y in range(1, H + 1):
        for x in range(1, W):
            if (x, y) in CUTS or (x + 1, y) in CUTS:
                continue
            d.union(("h", x, y), ("h", x + 1, y))
    for name, (a, b) in LINKS.items():
        d.union(("h",) + a, ("h",) + b)

    pin_root = {}
    for name, (_, _, pins, _) in COMPONENTS.items():
        for pin, hole in pins.items():
            pin_root[f"{name}.{pin}"] = d.find(("h",) + hole)

    # every net must be one group, and different nets different groups
    roots = {}
    for net, members in NETLIST.items():
        rs = {pin_root[m] for m in members}
        if len(rs) != 1:
            errors.append(f"net {net} is split: " + ", ".join(
                sorted(m for m in members)))
        roots[net] = next(iter(rs))
    nets = list(roots)
    for i, a in enumerate(nets):
        for b in nets[i + 1:]:
            if roots[a] == roots[b]:
                errors.append(f"nets {a} and {b} are shorted")
    listed = set().union(*NETLIST.values())
    for p in pin_root:
        if p not in listed:
            # unlisted pins must not touch any net
            for net, r in roots.items():
                if pin_root[p] == r:
                    errors.append(f"{p} is connected to {net} but not in the netlist")
    return errors


# --- drawing ---------------------------------------------------------------
P = 30          # hole pitch in px
M = 50          # margin
COPPER = "#d9a066"
FONT = "font-family='Helvetica, Arial, sans-serif'"


def hx(x, mirror=False):
    if mirror:
        x = W + 1 - x
    return M + (x - 1) * P


def hy(y):
    return M + (y - 1) * P


def svg_header(w, h, title):
    return [f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' "
            f"viewBox='0 0 {w} {h}'>",
            f"<title>{title}</title>",
            f"<rect width='{w}' height='{h}' fill='white'/>"]


def board(mirror: bool, strips_opacity: float):
    out = []
    bw = (W - 1) * P + 2 * 22
    bh = (H - 1) * P + 2 * 22
    out.append(f"<rect x='{M-22}' y='{M-22}' width='{bw}' height='{bh}' rx='6' "
               f"fill='#f3e3c3' stroke='#8a6d3b' stroke-width='2'/>")
    for y in range(1, H + 1):
        out.append(f"<rect x='{M-14}' y='{hy(y)-10}' width='{(W-1)*P+28}' height='20' "
                   f"rx='3' fill='{COPPER}' opacity='{strips_opacity}'/>")
    for y in range(1, H + 1):
        for x in range(1, W + 1):
            out.append(f"<circle cx='{hx(x, mirror)}' cy='{hy(y)}' r='3.2' fill='#5b4a2f'/>")
    # coordinates
    for x in range(1, W + 1):
        out.append(f"<text x='{hx(x, mirror)}' y='{M-28}' font-size='11' text-anchor='middle' "
                   f"fill='#555' {FONT}>{x}</text>")
    for y in range(1, H + 1):
        lx = M - 34 if not mirror else hx(1, True) + 34
        out.append(f"<text x='{lx}' y='{hy(y)+4}' font-size='11' text-anchor='middle' "
                   f"fill='#555' {FONT}>{chr(ord('A') + y - 1)}</text>")
    return out


def cut_marks(mirror):
    out = []
    for (x, y) in CUTS:
        cx, cy = hx(x, mirror), hy(y)
        out.append(f"<circle cx='{cx}' cy='{cy}' r='9' fill='white' fill-opacity='0.75' stroke='#c0392b' stroke-width='2.5'/>")
        out.append(f"<line x1='{cx-6}' y1='{cy-6}' x2='{cx+6}' y2='{cy+6}' stroke='#c0392b' stroke-width='2.5'/>")
        out.append(f"<line x1='{cx-6}' y1='{cy+6}' x2='{cx+6}' y2='{cy-6}' stroke='#c0392b' stroke-width='2.5'/>")
    return out


def text(x, y, s, size=12, anchor="middle", color="#222", weight="normal"):
    return (f"<text x='{x}' y='{y}' font-size='{size}' text-anchor='{anchor}' "
            f"fill='{color}' font-weight='{weight}' {FONT}>{s}</text>")


def draw_components():
    out = []
    for name, (label, value, pins, kind) in COMPONENTS.items():
        pts = [(hx(x), hy(y)) for (x, y) in pins.values()]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if kind == "dip8":
            x0, x1 = min(xs) - 8, max(xs) + 8
            y0, y1 = min(ys) - 14, max(ys) + 14
            out.append(f"<rect x='{x0}' y='{y0}' width='{x1-x0}' height='{y1-y0}' rx='4' fill='#2d2d2d'/>")
            out.append(f"<path d='M {(x0+x1)/2-8} {y0} a 8 8 0 0 0 16 0' fill='#888'/>")
            out.append(f"<circle cx='{x0+9}' cy='{y0+9}' r='3' fill='#ccc'/>")
            out.append(text((x0 + x1) / 2, (y0 + y1) / 2 - 2, label, 13, color="white", weight="bold"))
            out.append(text((x0 + x1) / 2, (y0 + y1) / 2 + 14, value, 10, color="white"))
            for pin, (x, y) in pins.items():
                px = hx(x)
                lx = px - 14 if x == min(p[0] for p in pins.values()) else px + 14
                out.append(f"<circle cx='{px}' cy='{hy(y)}' r='5' fill='#bbb'/>")
                out.append(text(lx, hy(y) + 4, pin, 10, color="#c0392b", weight="bold"))
        elif kind == "sip4":
            x0, x1 = min(xs) - 22, max(xs) + 10
            y0, y1 = min(ys) - 13, max(ys) + 13
            out.append(f"<rect x='{x0}' y='{y0}' width='{x1-x0}' height='{y1-y0}' rx='3' fill='#1f3a5f'/>")
            for pin, (x, y) in pins.items():
                out.append(f"<circle cx='{hx(x)}' cy='{hy(y)}' r='5' fill='#bbb'/>")
                out.append(text(hx(x) - 13, hy(y) + 4, pin, 10, color="white", weight="bold"))
            out.append(text((x0 + x1) / 2, y1 + 16, label, 11, color="#1f3a5f", weight="bold"))
            out.append(text((x0 + x1) / 2, y1 + 29, "DC/DC", 9, color="#1f3a5f"))
        elif kind in ("header3",):
            for pin, (x, y) in pins.items():
                out.append(f"<rect x='{hx(x)-11}' y='{hy(y)-11}' width='22' height='22' fill='#222'/>")
                out.append(f"<rect x='{hx(x)-4}' y='{hy(y)-4}' width='8' height='8' fill='#e6c200'/>")
                out.append(text(hx(x) + 18, hy(y) + 4, pin, 10, anchor="start", color="#222", weight="bold"))
            out.append(text(min(xs), min(ys) - 18, label, 12, weight="bold"))
        elif kind == "screw2":
            x0, y0 = min(xs) - 14, min(ys) - 22
            out.append(f"<rect x='{x0}' y='{y0}' width='30' height='{max(ys)-min(ys)+44}' rx='3' fill='#2f7d32'/>")
            for pin, (x, y) in pins.items():
                out.append(f"<circle cx='{hx(x)}' cy='{hy(y)}' r='8' fill='#cfd8dc' stroke='#555'/>")
                out.append(f"<line x1='{hx(x)-6}' y1='{hy(y)}' x2='{hx(x)+6}' y2='{hy(y)}' stroke='#555' stroke-width='2'/>")
                out.append(text(hx(x) + 22, hy(y) + 4, pin, 10, anchor="start", weight="bold"))
            out.append(text((x0 + 15), max(ys) + 52, f"{label} {value}", 11, weight="bold"))
        elif kind == "elko":
            (px, py) = (hx(pins["+"][0]), hy(pins["+"][1]))
            (mx, my) = (hx(pins["-"][0]), hy(pins["-"][1]))
            cx, cy = (px + mx) / 2, (py + my) / 2
            out.append(f"<circle cx='{cx}' cy='{cy}' r='16' fill='#2b4f81' stroke='#17304f' stroke-width='1.5'/>")
            # minus stripe on the '-' side
            side = -1 if my < py else 1
            out.append(f"<path d='M {cx-16} {cy} A 16 16 0 0 {1 if side<0 else 0} {cx+16} {cy}' "
                       f"fill='none' stroke='#cfd8dc' stroke-width='5' opacity='0.8'/>")
            out.append(text(cx, cy + 4, label, 10, color="white", weight="bold"))
            out.append(text(px + 0, py + (12 if py > my else -6) + 0, "+", 13, color="#c0392b", weight="bold"))
            if name == "C3":
                out.append(text(cx + 20, cy + 18, value, 10, anchor="start"))
            else:
                out.append(text(cx - 20, cy - 10, value, 10, anchor="end"))
        elif kind in ("res", "res_up", "cer", "tvs_up"):
            (ax, ay), (bx, by) = [(hx(x), hy(y)) for (x, y) in pins.values()]
            out.append(f"<line x1='{ax}' y1='{ay}' x2='{bx}' y2='{by}' stroke='#9e9e9e' stroke-width='3'/>")
            cx, cy = (ax + bx) / 2, (ay + by) / 2
            if kind == "res":
                out.append(f"<rect x='{cx-9}' y='{cy-26}' width='18' height='52' rx='7' fill='#e8c9a0' stroke='#8a6d3b'/>")
                out.append(text(cx + 16, cy - 4, label, 11, anchor="start", weight="bold"))
                out.append(text(cx + 16, cy + 10, value, 10, anchor="start"))
            elif kind == "res_up":
                out.append(f"<circle cx='{ax}' cy='{ay}' r='9' fill='#e8c9a0' stroke='#8a6d3b'/>")
                out.append(f"<path d='M {ax} {ay} Q {ax+16} {(ay+by)/2} {bx} {by}' fill='none' stroke='#9e9e9e' stroke-width='2.5'/>")
                if name == "R1":
                    out.append(text(ax - 14, ay + 26, f"{label} {value}", 10, anchor="end", weight="bold"))
                else:
                    out.append(text(ax + 14, ay + 4, f"{label} {value}", 10, anchor="start", weight="bold"))
            elif kind == "cer":
                out.append(f"<ellipse cx='{cx}' cy='{cy}' rx='9' ry='13' fill='#f0c419' stroke='#a07d00'/>")
                out.append(text(cx + 14, cy + 4, f"{label} {value}", 10, anchor="start", weight="bold"))
            elif kind == "tvs_up":
                out.append(f"<rect x='{ax-9}' y='{ay-9}' width='18' height='{by-ay+18}' rx='5' fill='#333'/>")
                out.append(f"<rect x='{ax-9}' y='{ay-9}' width='18' height='7' fill='#ddd'/>")
                out.append(text(ax - 16, ay + 6, f"{label}", 11, anchor="end", weight="bold"))
                out.append(text(ax - 16, ay + 20, value, 9, anchor="end"))
                out.append(text(ax - 16, ay + 33, "band ↑", 9, anchor="end", color="#c0392b"))
            for (x, y) in pins.values():
                out.append(f"<circle cx='{hx(x)}' cy='{hy(y)}' r='4' fill='#bbb'/>")
    return out


def draw_links():
    out = []
    colors = {"L1": "#2e7d32", "L2": "#2e7d32", "L3": "#2e7d32", "L4": "#c62828", "L5": "#2e7d32"}
    for name, ((x1, y1), (x2, y2)) in LINKS.items():
        c = colors.get(name, "#1565c0")
        X1, Y1, X2, Y2 = hx(x1), hy(y1), hx(x2), hy(y2)
        out.append(f"<line x1='{X1}' y1='{Y1}' x2='{X2}' y2='{Y2}' stroke='{c}' stroke-width='5' stroke-linecap='round'/>")
        for (X, Y) in ((X1, Y1), (X2, Y2)):
            out.append(f"<circle cx='{X}' cy='{Y}' r='4.5' fill='#bbb' stroke='{c}' stroke-width='2'/>")
        if name == "L5":
            out.append(text(X1 - 10, hy(10) + 4, name, 10, anchor="end", color=c, weight="bold"))
        else:
            out.append(text(X1 - 10, (Y1 + Y2) / 2 + 4, name, 10, anchor="end", color=c, weight="bold"))
    return out


def legend(y0, items):
    out = []
    x = M - 20
    for sw, label in items:
        out.append(sw(x, y0))
        out.append(text(x + 28, y0 + 4, label, 11, anchor="start"))
        x += 28 + 7.2 * len(label) + 26
    return out


def component_side_svg():
    w = 2 * M + (W - 1) * P + 60
    h = 2 * M + (H - 1) * P + 130
    out = svg_header(w, h, "OSCoST PWM pump driver, stripboard, component side")
    out += board(mirror=False, strips_opacity=0.35)
    out += draw_links()
    out += draw_components()
    out += cut_marks(False)
    out.append(text(hx(9) + 15, hy(7) + 32, "3 cuts under U1 (column 9)", 10, color="#c0392b", weight="bold"))
    ly = hy(H) + 72
    out += legend(ly, [
        (lambda x, y: f"<rect x='{x}' y='{y-6}' width='22' height='12' fill='{COPPER}' opacity='0.5'/>",
         "copper strip (underneath)"),
        (lambda x, y: f"<circle cx='{x+11}' cy='{y}' r='8' fill='white' stroke='#c0392b' stroke-width='2.5'/>",
         "cut the strip here"),
        (lambda x, y: f"<line x1='{x}' y1='{y}' x2='{x+22}' y2='{y}' stroke='#2e7d32' stroke-width='5'/>",
         "wire link (insulated)"),
    ])
    out.append(text(M - 20, ly + 28, "View: component side, strips run left to right. "
                    "Rows A–K, columns 1–20.", 11, anchor="start", color="#555"))
    out.append("</svg>")
    return "\n".join(out)


def copper_side_svg():
    w = 2 * M + (W - 1) * P + 60
    h = 2 * M + (H - 1) * P + 110
    out = svg_header(w, h, "OSCoST PWM pump driver, stripboard, copper side")
    out += board(mirror=True, strips_opacity=1.0)
    out += cut_marks(True)
    solder = set()
    for _, (_, _, pins, _) in COMPONENTS.items():
        solder |= set(pins.values())
    for a, b in LINKS.values():
        solder |= {a, b}
    for (x, y) in sorted(solder):
        out.append(f"<circle cx='{hx(x, True)}' cy='{hy(y)}' r='7' fill='#b0bec5' stroke='#455a64' stroke-width='1.5'/>")
    # label a few landmarks to help orientation
    for name, pin, txt in (("J1", "PWM", "J1"), ("J2", "PWM", "J2"), ("U1", "1", "U1 pin 1")):
        x, y = COMPONENTS[name][2][pin]
        out.append(text(hx(x, True), hy(y) - 12, txt, 10, weight="bold", color="#1a237e"))
    ly = hy(H) + 52
    out += legend(ly, [
        (lambda x, y: f"<circle cx='{x+11}' cy='{y}' r='7' fill='#b0bec5' stroke='#455a64'/>", "solder joint"),
        (lambda x, y: f"<circle cx='{x+11}' cy='{y}' r='8' fill='white' stroke='#c0392b' stroke-width='2.5'/>",
         "cut the strip here"),
    ])
    out.append(text(M - 20, ly + 28, "View: copper side (board flipped left-to-right). "
                    "Use this view to make the cuts and check solder joints.", 11, anchor="start", color="#555"))
    out.append("</svg>")
    return "\n".join(out)


def main():
    errors = check()
    if errors:
        print("LAYOUT ERRORS:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    root = Path(__file__).resolve().parents[2]
    img = root / "docs" / "img"
    img.mkdir(parents=True, exist_ok=True)
    (img / "pwm-driver-stripboard-top.svg").write_text(component_side_svg(), encoding="utf-8")
    (img / "pwm-driver-stripboard-copper.svg").write_text(copper_side_svg(), encoding="utf-8")
    print("layout OK, nets:", ", ".join(NETLIST))


if __name__ == "__main__":
    main()
