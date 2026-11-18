#!/usr/bin/env python3
"""Draw the assembly mockup:
  docs/img/pi-hat-assembly.svg  Pi 5 + OSCoST HAT (1-Wire edition): top and side view
Usage: python3 tools/hw/assembly_svg.py docs/img
Dimensions of the Pi 5 follow the Raspberry Pi mechanical drawing (board 85 x 56 mm,
holes 3.5/61.5 x 3.5/52.5 mm); heights are approximate and get fixed in KiCad."""
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
GREEN, GREEN_D, GOLD = "#1E5631", "#0F3A20", "#C9A227"
PI_G, PI_GD = "#2f7d3a", "#1b4d23"
STYLE = ('<style>.t{font-size:12px;fill:#222}.tb{font-size:12px;font-weight:bold;fill:#222}'
         '.w{font-size:12px;fill:#fff}.wb{font-size:12px;font-weight:bold;fill:#fff}'
         '.g{font-size:11px;fill:#C8E6C9}.n{font-size:11px;fill:#555}.h{font-size:16px;font-weight:bold;fill:#222}'
         '.o{font-size:11px;font-style:italic;fill:#777}</style>')


def txt(o, x, y, s, cls="t", anchor="start"):
    o.append(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{s}</text>')


def rect(o, x, y, w, h, fill, stroke="none", rx=0, sw=1, dash=False, op=1):
    d = ' stroke-dasharray="4 3"' if dash else ""
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" '
             f'stroke-width="{sw}" fill-opacity="{op}"{d}/>')


# ---------------------------------------------------------------- assembly
def assembly():
    o = []
    S = 6.0                       # px per mm
    W, H = 1390, 560
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
    o.append(STYLE)
    rect(o, 0, 0, W, H, "white")
    txt(o, 20, 30, "Raspberry Pi 5 with the OSCoST HAT (1-Wire edition) — top and side view, to scale (1 mm = 6 px)", "h")

    # ---------- top view
    ox, oy = 160, 80
    def P(x, y):  # mm -> px, y measured from the board's top edge (header side)
        return ox + x * S, oy + y * S
    # Pi board
    x0, y0 = P(0, 0)
    rect(o, x0, y0, 85 * S, 56 * S, PI_G, PI_GD, rx=3 * S, sw=2)
    # Pi ports: Ethernet + 2x2 USB on the right short edge
    for (yy, hh, lab) in [(2, 16, "Ethernet"), (21, 15, "USB 3"), (39, 15, "USB 2")]:
        x, y = P(68, yy)
        rect(o, x, y, 20 * S, hh * S, "#b8bcc0", "#6b7075", rx=2)
        txt(o, x + 10 * S, y + hh * S / 2 + 4, lab, "t", "middle")
    # USB-C and 2x micro HDMI on the bottom long edge
    for (xx, ww, lab) in [(11.2, 9, "USB-C power"), (26, 7, "µHDMI"), (39.5, 7, "µHDMI")]:
        x, y = P(xx - ww / 2, 56)
        rect(o, x, y - 6 * S, ww * S, 7.5 * S, "#b8bcc0", "#6b7075", rx=2)
        txt(o, x + ww * S / 2, y + 5.5 * S, lab, "n", "middle")
    # HAT on top
    hx, hy = P(0, -0.25)
    rect(o, hx, hy, 65 * S, 56.5 * S, GREEN, GREEN_D, rx=3 * S, sw=2, op=0.95)
    for (mx, my) in [(3.5, 3.5), (61.5, 3.5), (3.5, 52.5), (61.5, 52.5)]:
        cx, cy = P(mx, my)
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{1.4*S}" fill="{GOLD}"/><circle cx="{cx}" cy="{cy}" r="{0.8*S}" fill="#F4F1E8"/>')
    x, y = P(7.1, 1)
    rect(o, x, y, 50.8 * S, 5 * S, "#111")
    txt(o, P(32.5, 0)[0], P(0, 10)[1], "40-pin header", "g", "middle")
    # left terminals (overhanging the edge)
    for (yy, n, lab) in [(9, 2, "PT1"), (17.5, 3, "1W-A"), (29, 3, "1W-B"), (40.5, 3, "PUMP1")]:
        x, y = P(-2.5, yy)
        rect(o, x, y, 7 * S, n * 3.5 * S, "#E9E2CC", "#8A7F5F", rx=2)
        txt(o, P(5.5, 0)[0], y + n * 3.5 * S / 2 + 4, lab, "w")
    # bottom terminals
    for (xx, n, lab) in [(24, 2, "REL1")]:
        x, y = P(xx, 51)
        rect(o, x, y, n * 3.5 * S, 7 * S, "#E9E2CC", "#8A7F5F", rx=2)
        txt(o, x + n * 3.5 * S / 2, y - 6, lab, "w", "middle")
    for (xx, yy, w_, h_, lab) in [(16, 11, 12, 6, "MAX31865"), (30, 30, 30, 9, "watchdog · driver · DC/DC")]:
        x, y = P(xx, yy)
        rect(o, x, y, w_ * S, h_ * S, "#151515", "#3a3a3a", rx=2)
        txt(o, x + w_ * S / 2, y + h_ * S / 2 + 4, lab, "w", "middle")
    # cable exits
    def arrow(x1, y1, x2, y2, lab, anchor="middle", dx=0, dy=0):
        o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#c0392b" stroke-width="2" marker-end="url(#a)"/>')
        txt(o, x2 + dx, y2 + dy, lab, "t", anchor)
    o.append('<defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">'
             '<path d="M0,0 L6,3 L0,6 z" fill="#c0392b"/></marker></defs>')
    arrow(P(-2.5, 30)[0], P(0, 30)[1], P(-9, 30)[0], P(0, 30)[1], "sensors + pump", "end", -4, 4)
    arrow(P(88, 10)[0], P(0, 10)[1], P(95, 10)[0], P(0, 10)[1], "network", "start", 4, 4)
    # notes under the top view
    ny = P(0, 74)[1]
    txt(o, ox, ny, "• The HAT covers the left 65 mm; Ethernet and USB stay free on the right.", "n")
    txt(o, ox, ny + 16, "• Sensor and pump terminals face left (D17); the front edge keeps only REL1, above the", "n")
    txt(o, ox, ny + 32, "  Pi's USB-C and µHDMI sockets; the USB-C plug fits below the HAT (check in KiCad).", "n")

    # ---------- side view (looking at the front edge)
    sx, sy = 870, 140            # left end of the Pi board, top of the Pi PCB
    def Q(x, z):                  # x along the board, z height above the Pi PCB top
        return sx + x * S, sy + 230 - z * S
    # Pi PCB
    x, y = Q(0, 0)
    rect(o, x, y, 85 * S, 1.6 * S, PI_G, PI_GD)
    txt(o, x + 4, y + 26, "Pi 5 PCB", "n")
    # Ethernet jack
    x, y = Q(65, 13.5)
    rect(o, x, y, 21.5 * S, 13.5 * S, "#b8bcc0", "#6b7075", rx=2)
    txt(o, x + 10.75 * S, y + 6.75 * S + 4, "RJ45", "n", "middle")
    # active cooler
    x, y = Q(15, 10)
    rect(o, x, y, 40 * S, 10 * S, "#9aa3ab", "#5f6468", rx=2)
    txt(o, x + 20 * S, y + 5 * S + 4, "Pi 5 active cooler (≈ 10 mm)", "w", "middle")
    # header + stacking header
    x, y = Q(7, 8.5)
    rect(o, x, y, 51 * S, 8.5 * S, "none", "#C9A227", sw=1.5, dash=True)
    txt(o, x + 4, y - 36, "behind: GPIO pins + stacking header (dashed)", "n")
    # spacers
    HZ = 17.0
    for mx in (3.5, 61.5):
        x, y = Q(mx - 1.2, HZ)
        rect(o, x, y, 2.4 * S, HZ * S, "#d4af37", "#8a6d1f")
    # HAT PCB
    x, y = Q(0, HZ + 1.6)
    rect(o, x, y, 65 * S, 1.6 * S, GREEN, GREEN_D)
    txt(o, x + 65 * S + 8, y + 9, "OSCoST HAT", "tb")
    # terminals on the HAT, seen from the front
    for (xx, w_) in [(24, 7)]:
        x, y = Q(xx, HZ + 1.6 + 8.5)
        rect(o, x, y, w_ * S, 8.5 * S, "#E9E2CC", "#8A7F5F", rx=2)
    txt(o, Q(27.5, 0)[0], Q(0, HZ + 12)[1], "REL1", "n", "middle")
    # height dimension
    xd = Q(-6, 0)[0]
    y1, y2 = Q(0, 0)[1], Q(0, HZ)[1]
    o.append(f'<line x1="{xd}" y1="{y1}" x2="{xd}" y2="{y2}" stroke="#333" marker-end="url(#a)" marker-start="url(#a)"/>')
    txt(o, xd - 6, (y1 + y2) / 2 + 4, "≈ 17 mm", "t", "end")
    txt(o, xd - 6, (y1 + y2) / 2 + 20, "spacers", "n", "end")
    ny = Q(0, -10)[1]
    txt(o, sx, ny, "• One tall height for every board (D16): ≈ 16–17 mm spacers and a stacking", "n")
    txt(o, sx, ny + 16, "  header clear the Pi 5 active cooler or a passive heatsink (≤ ≈ 14 mm), and a Pi 4.", "n")
    txt(o, sx, ny + 32, "• The exact height is fixed in KiCad.", "n")
    txt(o, sx, ny + 48, "• The stacking header also lets the VBus adapter plug on top during shadow mode.", "n")
    o.append('</svg>')
    open(f"{OUT}/pi-hat-assembly.svg", "w").write("\n".join(o))


assembly()
