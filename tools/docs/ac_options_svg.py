#!/usr/bin/env python3
"""Draw docs/img/ac-options.svg: three slim variants of the 230 V side
(A no mains work, B minimal DIN, C B + cut-off relay), side by side.
Usage: python3 tools/docs/ac_options_svg.py docs/img"""
import sys

PW, PH, GAP = 480, 570, 20          # panel width/height, gap
W, H = 3 * PW + 4 * GAP, PH + 70
L_C, N_C, PE_C = "#8B4513", "#1f5fbf", "#3a9d23"
LV_C, SIG_C = "#c0392b", "#555"
out = []


def a(s):
    out.append(s)


def txt(x, y, s, cls="s", anchor="middle"):
    a(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{s}</text>')


def box(x, y, w, h, title, lines=(), fill="#f7f7f7"):
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="#333" stroke-width="1.5"/>')
    txt(x + w / 2, y + 18, title, "t")
    for i, ln in enumerate(lines):
        txt(x + w / 2, y + 34 + i * 14, ln)


def wire(pts, c, wdt=2.2, dash=False):
    d = ' stroke-dasharray="5 4"' if dash else ""
    a(f'<polyline points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="none" stroke="{c}" stroke-width="{wdt}"{d}/>')


def dot(x, y, c):
    a(f'<circle cx="{x}" cy="{y}" r="3.5" fill="{c}"/>')


def panel(ox, oy, key, title, cost, variant):
    a(f'<g transform="translate({ox},{oy})">')
    a(f'<rect x="0" y="0" width="{PW}" height="{PH}" rx="10" fill="#fcfcfc" stroke="#bbb"/>')
    txt(14, 26, f"{key} — {title}", "h", "start")
    txt(PW - 14, 26, cost, "c", "end")

    yL, yN, yPE = 85, 105, 125
    if variant == "A":
        box(10, 50, 110, 100, "Wall sockets", ["existing circuit", "breaker + RCD", "(2 × Schuko)"])
    else:
        box(10, 50, 110, 100, "House circuit", ["existing breaker", "+ RCD 30 mA", "(fixed wiring)"])
        a('<rect x="140" y="42" width="205" height="215" rx="8" fill="none" stroke="#777" stroke-dasharray="7 4"/>')
        txt(340, 252, "small DIN box, 4–6 TE", "o", "end")

    # L, N, PE to the pump
    relay = variant == "C"
    if relay:
        wire([(120, yL), (255, yL)], L_C)
        box(255, 52, 80, 42, "Relay", ["16 A, 12 V coil"])
        wire([(335, yL), (350, yL)], L_C)
    else:
        wire([(120, yL), (350, yL)], L_C)
    wire([(120, yN), (350, yN)], N_C)
    wire([(120, yPE), (350, yPE)], PE_C)
    if variant == "A":
        txt(235, yL - 6, "pump on a plug cord, permanently powered", "n")
    elif variant == "B":
        txt(255, yL - 6, "pump permanently on 230 V", "n")
    else:
        txt(200, yL - 6, "L via relay", "n")

    box(350, 45, 120, 100, "Solar pump", ["Wilo Yonos PARA", "iPWM2 (solar)", "stops &lt; 7 % duty"], fill="#fff7e6")

    # 5 V supply
    if variant == "A":
        box(150, 175, 140, 70, "Pi USB-C supply", ["27 W, in a socket"])
        wire([(40, 150), (40, 210), (150, 210)], "#999", 1.6, dash=True)
        txt(45, 230, "plug", "o", "start")
    else:
        box(150, 165, 140, 70, "Mean Well HDR-60-5", ["5 V, 6.5 A", "class II"])
        wire([(180, yL), (180, 165)], L_C); dot(180, yL, L_C)
        wire([(220, yN), (220, 165)], N_C); dot(220, yN, N_C)

    # Pi + HAT
    box(150, 330, 175, 120, "Raspberry Pi + HAT", ["own case", "watchdog gates PWM", "PWM1 · FB1" + (" · REL1" if relay else ""),
                                                   "sensors · Ethernet"], fill="#eef5ff")
    if variant == "A":
        wire([(220, 245), (220, 330)], LV_C)
        txt(228, 290, "USB-C 5 V", "n", "start")
    else:
        wire([(205, 235), (205, 330)], LV_C)
        wire([(235, 235), (235, 330)], "#000")
        txt(198, 284, "5 V / GND", "n", "end"); txt(198, 298, "→ HAT PWR", "n", "end")

    # PWM / GND / FB to the pump
    wire([(325, 400), (410, 400), (410, 145)], SIG_C, 1.6)
    txt(415, 300, "PWM", "n", "start"); txt(415, 314, "GND", "n", "start"); txt(415, 328, "FB", "n", "start")
    if relay:
        wire([(300, 330), (300, 94)], SIG_C, 1.6)
        txt(306, 300, "REL1", "n", "start")

    # Notes
    y = 480
    stops = {
        "A": ["Ways to stop the pump: 1 (PWM low)",
              "No mains wiring at all, if the pump",
              "  gets a plug cord",
              "Stuck-high PWM driver: alarm only"],
        "B": ["Ways to stop the pump: 1 (PWM low)",
              "Electrician wires the box briefly",
              "Tidy: one supply for Pi + HAT",
              "Stuck-high PWM driver: alarm only"],
        "C": ["Ways to stop the pump: 2 (PWM low +",
              "  relay opens); keeps decision D8",
              "Relay switches rarely (stops via PWM)",
              "Stuck-high PWM driver: relay stops it"],
    }[variant]
    for i, s in enumerate(stops):
        txt(18, y + i * 18, ("   " + s.strip()) if s.startswith("  ") else "• " + s, "n", "start")
    a('</g>')


a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
a('<style>.t{font-size:12px;font-weight:bold}.s{font-size:10.5px;fill:#333}.o{font-size:10px;font-style:italic;fill:#888}'
  '.h{font-size:15px;font-weight:bold}.c{font-size:15px;font-weight:bold;fill:#2b6e2b}.n{font-size:11px;fill:#333}'
  '.big{font-size:17px;font-weight:bold}</style>')
a(f'<rect width="{W}" height="{H}" fill="white"/>')
txt(GAP, 34, "CoSTOS — three slim options for the 230 V side (pump: Wilo iPWM2, solar profile)", "big", "start")
panel(GAP, 55, "A", "no mains work", "≈ €20–25", "A")
panel(2 * GAP + PW, 55, "B", "minimal DIN", "≈ €35–45", "B")
panel(3 * GAP + 2 * PW, 55, "C", "B + cut-off relay", "≈ €50–60", "C")
a('</svg>')
open(f"{sys.argv[1] if len(sys.argv) > 1 else '.'}/ac-options.svg", "w").write("\n".join(out))
