#!/usr/bin/env python3
"""Draws the bottom side of the CoSTOS HAT (1-Wire edition) with its silkscreen
wiring cheat sheet, to the same scale as hat_mockup.py (1 mm = 8 px).

  python3 tools/hw/hat_bottom_svg.py > docs/img/hat-bottom.svg

Seen from below, so the view is mirrored against the top view: the left-edge
terminals appear on the right. Needs `segno` for the QR code
(pip install segno)."""
import segno

URL = "https://github.com/isarrider/CoSTOS"
W, H = 680, 560
SILK = "#ffffff"
out = []


def mx(x):
    """Mirror an x coordinate of the top view."""
    return W - x


def t(x, y, s, size=11, weight=400, anchor="start", color=SILK):
    out.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" '
               f'style="font-size:{size}px;font-weight:{weight};fill:{color}">{s}</text>')


def hole(x, y, r=4):
    out.append(f'<circle cx="{x:.1f}" cy="{y}" r="{r}" fill="#C9A227"/>'
               f'<circle cx="{x:.1f}" cy="{y}" r="{r - 2}" fill="#0F3A20"/>')


out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           'font-family="Helvetica, Arial, sans-serif">')
out.append('<title>CoSTOS HAT, bottom side with the silkscreen wiring cheat sheet</title>')
out.append('<desc>Bottom side of the 1-Wire edition seen from below: pin names at every terminal, '
           'a table of all terminals, the safety notes, the R25/R26 rule, the LED meanings, a box to '
           'tick the build, and a QR code to the repository.</desc>')
out.append(f'<rect width="{W}" height="{H}" fill="white"/>')
out.append('<rect x="80" y="30" width="520" height="452" rx="24" fill="#1E5631" stroke="#0F3A20" stroke-width="2"/>')
for (cx, cy) in [(108, 58), (572, 58), (108, 450), (572, 450)]:
    out.append(f'<circle cx="{cx}" cy="{cy}" r="11" fill="#C9A227"/><circle cx="{cx}" cy="{cy}" r="6" fill="#F4F1E8"/>')

# 40-pin header, through-holes (mirrored)
for i in range(20):
    x = mx(137 + 10 + i * 20.32)
    for y in (48, 68):
        hole(x, y, 3.5)
t(340, 90, "GPIO header · pin 1 ▸", 9, anchor="middle")

# left-edge terminals of the top view -> right edge here; pin names next to each hole
TERMS = [("PT1", 104, ["A", "B"]), ("1W-A", 166, ["3V3", "DQ", "GND"]),
         ("1W-B", 256, ["3V3", "DQ", "GND"]), ("PUMP1", 346, ["PWM", "GND", "FB"])]
for name, y0, pins in TERMS:
    for k, p in enumerate(pins):
        cy = y0 + 14 + 28 * k
        hole(mx(96), cy, 5)
        t(mx(96) - 10, cy + 4, p, 10, anchor="end")
    out.append(f'<line x1="{mx(96) - 46}" y1="{y0 + 3}" x2="{mx(96) - 46}" y2="{y0 + 28 * len(pins) - 3}" '
               f'stroke="{SILK}" stroke-width="1.2"/>')
    t(mx(96) - 52, y0 + 14 * len(pins) + 4, name, 11, 600, "end")

# front-edge terminals (mirrored)
FRONT = [("PUMP2", 216, ["PWM", "GND", "FB"]),
         ("REL2", 390, ["+5V", "OUT"]), ("REL1", 500, ["+5V", "OUT"])]
for name, x0, pins in FRONT:
    xs = [mx(x0 + 14 + 28 * k) for k in range(len(pins))]
    for x, p in zip(xs, pins):
        hole(x, 466, 4)
        t(x, 452, p, 8, anchor="middle")
    t(sum(xs) / len(xs), 440, name, 10, 600, "middle")

# cheat sheet
X0, XP, XD = 112, 160, 248
t(X0, 116, "CoSTOS HAT · 1-Wire edition · rev A", 14, 700)
t(X0, 131, "Controller for Solar Thermal – Open Source · MIT licence", 9.5)
out.append(f'<line x1="{X0}" y1="139" x2="{X0 + 330}" y2="139" stroke="{SILK}" stroke-width="1"/>')
ROWS = [("PT1", "A  B", "Pt1000, collector, any order"),
        ("1W-A", "3V3 DQ GND", "DS18x20, daisy chain, powered"),
        ("1W-B", "3V3 DQ GND", "DS18x20, second bus"),
        ("PUMP1", "PWM GND FB", "pump cable: brown · blue · black"),
        ("REL1", "+5V OUT", "relay / SSR coil (optional)")]
for k, (n, p, d) in enumerate(ROWS):
    y = 156 + 17 * k
    t(X0, y, n, 10.5, 600)
    t(XP, y, p, 10.5)
    t(XD, y, d, 10.5)

y = 252
out.append(f'<rect x="{X0 - 4}" y="{y - 13}" width="338" height="58" rx="3" fill="none" stroke="{SILK}" stroke-width="1.2"/>')
t(X0 + 2, y + 2, "! Solar-profile PWM pump only: no signal = stop", 10.5, 700)
t(X0 + 2, y + 19, "! No 230 V on this board. Power: from the Pi only", 10.5, 700)
t(X0 + 2, y + 36, "! 1-Wire Lite: R26, R9 100 Ω, D4 6.0A · not R25 + R26", 10.5, 700)
t(X0, 330, "LEDs: PWR on · WD heartbeat · PUMP running · R1 relay on", 10)

# build tick boxes
for k, lab in enumerate(["normal build", "1-Wire Lite"]):
    bx = X0 + 112 * k
    out.append(f'<rect x="{bx}" y="343" width="10" height="10" fill="none" stroke="{SILK}" stroke-width="1.2"/>')
    t(bx + 15, 352, lab, 10)

# QR code to the repository
qr = segno.make(URL, error="m")
mat = list(qr.matrix)
QS = 80  # 10 mm
m = QS / len(mat)
QX, QY = 392, 346
out.append(f'<rect x="{QX - 6}" y="{QY - 6}" width="{QS + 12}" height="{QS + 12}" fill="{SILK}"/>')
for r, row in enumerate(mat):
    for c, v in enumerate(row):
        if v:
            out.append(f'<rect x="{QX + c * m:.2f}" y="{QY + r * m:.2f}" width="{m:.2f}" height="{m:.2f}" fill="#1E5631"/>')
t(X0, 384, "github.com/isarrider/CoSTOS", 11, 600)
t(X0, 400, "docs/installation.md · docs/HAT.md", 10)
t(X0, 416, "scan for docs and wiring ▸", 10)

t(40, 512, "Bottom view, seen from below (mirrored against the top view), to scale (1 mm = 8 px).", 11, color="#555555")
t(40, 528, "White = silkscreen. Text at least 1 mm high; most of it is 1.2–1.4 mm. The bottom side holds no parts.", 11, color="#555555")
t(40, 544, "Pin names repeat on the top side next to every terminal, where they can be read while wiring.", 11, color="#555555")
out.append('</svg>')
print("\n".join(out))
