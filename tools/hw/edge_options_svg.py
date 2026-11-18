#!/usr/bin/env python3
"""Draw docs/img/hat-edge-options.svg: three terminal arrangements for the
1-Wire edition HAT on a Pi 5, top view to scale (1 mm = 5 px).
Usage: python3 tools/hw/edge_options_svg.py docs/img"""
import sys

S = 5.0
PW, PH, GAP = 500, 520, 18
W, H = 3 * PW + 4 * GAP, PH + 60
GREEN, GREEN_D, GOLD = "#1E5631", "#0F3A20", "#C9A227"
PI_G, PI_GD = "#7fbf86", "#4d8a55"
out = []


def a(s):
    out.append(s)


def txt(x, y, s, cls="t", anchor="start"):
    a(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{s}</text>')


def rect(x, y, w, h, fill, stroke="none", rx=0, sw=1, dash=False):
    d = ' stroke-dasharray="4 3"' if dash else ""
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')


def arrow(x1, y1, x2, y2, c="#c0392b"):
    a(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2.5" marker-end="url(#a{c[1:]})"/>')


def panel(px, py, key, title, cost, mode, notes):
    a(f'<g transform="translate({px},{py})">')
    rect(0, 0, PW, PH, "#fcfcfc", "#bbb", rx=10)
    txt(14, 26, f"{key} — {title}", "h")
    txt(PW - 14, 26, cost, "c", "end")
    ox, oy = 45, 60

    def P(x, y):
        return ox + x * S, oy + y * S

    # Pi 5 underneath
    x, y = P(0, 0)
    rect(x, y, 85 * S, 56 * S, PI_G, PI_GD, rx=3 * S)
    for (yy, hh) in [(2, 16), (21, 15), (39, 15)]:
        x, y = P(68, yy)
        rect(x, y, 20 * S, hh * S, "#c4c8cc", "#7a7f84", rx=2)
    x, y = P(82, 8)
    txt(x - 30, y + 6, "RJ45", "n", "middle")
    for (xx, ww) in [(11.2, 9), (26, 7), (39.5, 7)]:
        x, y = P(xx - ww / 2, 50)
        rect(x, y, ww * S, 7.5 * S, "#c4c8cc", "#7a7f84", rx=2)
    # USB-C cable, always plugged in (option A)
    x, y = P(11.2, 57.5)
    rect(x - 2.5 * S, y, 5 * S, 10 * S, "#444", rx=2)
    txt(x, y + 13 * S, "USB-C supply", "n", "middle")
    # HAT
    x, y = P(0, -0.25)
    rect(x, y, 65 * S, 56.5 * S, GREEN, GREEN_D, rx=3 * S, sw=2)
    for (mx, my) in [(3.5, 3.5), (61.5, 3.5), (3.5, 52.5), (61.5, 52.5)]:
        cx, cy = P(mx, my)
        a(f'<circle cx="{cx}" cy="{cy}" r="{1.4*S}" fill="{GOLD}"/><circle cx="{cx}" cy="{cy}" r="{0.8*S}" fill="#F4F1E8"/>')
    x, y = P(7.1, 1)
    rect(x, y, 50.8 * S, 5 * S, "#111")

    def term_left(yy, n, lab, two=False):
        x, y = P(-2.5, yy)
        w = (10 if two else 7) * S
        rect(x, y, w, n * 3.5 * S, "#E9E2CC", "#8A7F5F", rx=2)
        if two:
            a(f'<line x1="{x + w/2}" y1="{y}" x2="{x + w/2}" y2="{y + n*3.5*S}" stroke="#8A7F5F"/>')
        for k in range(n):
            cy = y + (k + 0.5) * 3.5 * S
            for cx in ([x + 1.7 * S, x + 6.7 * S] if two else [x + 2.2 * S]):
                a(f'<circle cx="{cx}" cy="{cy}" r="{1.2*S}" fill="#B0B6BA" stroke="#5F6468"/>')
        if lab:
            txt(x + w + 6, y + n * 3.5 * S / 2 + 4, lab, "w")

    def term_front(xx, n, lab, used=True):
        x, y = P(xx, 51)
        rect(x, y, n * 3.5 * S, 7 * S, "#E9E2CC" if used else "none", "#8A7F5F" if used else "#E8F5E9",
             rx=2, dash=not used)
        txt(x + n * 3.5 * S / 2, y - 5, lab, "w" if used else "g", "middle")

    if mode == "A":
        term_left(10, 2, "PT1"); term_left(21, 3, "1W-A"); term_left(35, 3, "1W-B")
        term_front(8, 2, "PWR"); term_front(19, 2, "REL1"); term_front(36, 3, "PUMP1")
        arrow(*P(-2.5, 25), *P(-8, 25)); arrow(*P(41, 58), *P(41, 66))
        txt(*P(41, 70), "pump", "t")
    elif mode == "B":
        term_left(9, 2, "PT1"); term_left(17.5, 3, "1W-A"); term_left(29, 3, "1W-B"); term_left(40.5, 3, "PUMP1")
        term_front(14, 2, "PWR"); term_front(24, 2, "REL1")
        arrow(*P(-2.5, 30), *P(-8, 30))
        txt(*P(26, 66), "PWR / REL1: only if used", "n")
    else:
        term_left(10, 8, None, two=True)
        labels = ["PT1", "1W-A", "1W-A · 1W-B", "1W-B", "PUMP1", "PUMP1 · REL1", "REL1 · PWR", "PWR"]
        for k, lab in enumerate(labels):
            x, y = P(10, 10 + (k + 0.5) * 3.5)
            txt(x, y + 4, lab, "g")
        arrow(*P(-2.5, 24), *P(-8, 24))
    txt(*P(-8.5, 22), "all" if mode == "C" else "", "t", "end")
    # network arrow
    arrow(*P(88, 10), *P(95, 10), "#555")
    # notes
    for i, (good, s) in enumerate(notes):
        col = "#2b6e2b" if good else "#a33"
        txt(18, 430 + i * 18, s, "n")
        a(f'<circle cx="10" cy="{426 + i*18}" r="3" fill="{col}"/>')
    a('</g>')


a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
a('<style>.t{font-size:12px;fill:#222}.w{font-size:11px;fill:#fff;font-weight:bold}.g{font-size:10px;fill:#C8E6C9}'
  '.n{font-size:11.5px;fill:#333}.h{font-size:15px;font-weight:bold;fill:#222}.c{font-size:13px;font-weight:bold;fill:#2b6e2b}'
  '.big{font-size:17px;font-weight:bold;fill:#222}</style>')
for c in ("c0392b", "555"):
    a(f'<defs><marker id="a{c}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">'
      f'<path d="M0,0 L6,3 L0,6 z" fill="#{c}"/></marker></defs>')
a(f'<rect width="{W}" height="{H}" fill="white"/>')
txt(GAP, 34, "OSCoST HAT (1-Wire edition) on a Pi 5 — where the field terminals go (top view, 1 mm = 5 px)", "big")
panel(GAP, 50, "A", "current: power and pump at the front", "±0", "A",
      [(True, "short traces: PUMP1 next to driver and 12 V"),
       (False, "field wiring leaves on two sides"),
       (False, "pump cable next to the USB-C plug"),
       (False, "PWR/REL1 occupy the front, unused with option A")])
panel(2 * GAP + PW, 50, "B", "pump moves to the left edge", "≈ ±0", "B",
      [(True, "sensors and pump leave on one side"),
       (True, "front only has PWR/REL1, used rarely"),
       (True, "USB-C side stays clear in option A"),
       (False, "left edge is full: no room for more terminals")])
panel(3 * GAP + 2 * PW, 50, "C", "everything on one two-level block", "≈ +€1–2", "C",
      [(True, "all field wiring on one side, front clear"),
       (False, "two-level block: lower row harder to reach"),
       (False, "≈ €1–2 more than separate terminals"),
       (False, "sensor, pump and power wires share one block")])
a('</svg>')
open(f"{sys.argv[1] if len(sys.argv) > 1 else '.'}/hat-edge-options.svg", "w").write("\n".join(out))
