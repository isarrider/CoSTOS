#!/usr/bin/env python3
"""Draws the PWM signal path of the HAT's Lite build, from the Pi pin to the
pump terminal, with the parts hanging off it.

  python3 tools/hw/pwm_chain_svg.py > docs/img/hat-lite-pwm-chain.svg
"""
W, H = 680, 330
SIG = ("#EEEDFE", "#534AB7", "#3C3489", "#534AB7")      # fill, stroke, title, subtitle
SAFE = ("#E1F5EE", "#0F6E56", "#085041", "#0F6E56")
NEUT = ("#F1EFE8", "#5F5E5A", "#444441", "#5F5E5A")
out = []


def box(x, y, w, h, col, title, sub=None):
    f, s, tc, sc = col
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{f}" stroke="{s}" stroke-width="1"/>')
    if sub:
        out.append(f'<text x="{x + w / 2}" y="{y + 22}" text-anchor="middle" style="font-size:14px;font-weight:600;fill:{tc}">{title}</text>')
        out.append(f'<text x="{x + w / 2}" y="{y + 41}" text-anchor="middle" style="font-size:12px;fill:{sc}">{sub}</text>')
    else:
        out.append(f'<text x="{x + w / 2}" y="{y + h / 2 + 5}" text-anchor="middle" style="font-size:14px;font-weight:600;fill:{tc}">{title}</text>')


def arrow(x1, y1, x2, y2):
    out.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#555" stroke-width="1.5" marker-end="url(#a)"/>')


def dash(x, y1, y2):
    out.append(f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="#888" stroke-width="1" stroke-dasharray="3 3"/>')


out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           'font-family="Helvetica, Arial, sans-serif">')
out.append('<title>CoSTOS HAT, Lite build: PWM signal path</title>')
out.append('<desc>Pi GPIO 18 (3.3 V PWM) into two transistor switches in series, Q4 for the PWM and Q5 '
           'for the watchdog, which drive Q6, the switch to the 5 V supply via R26, then R9 (100 ohm) to the '
           'PWM pin of J2. Below: R7 pull-down at the input, the PUMP1 LED D12 with R22 at the driver '
           'output, Q7 pulling the terminal to ground, and the TVS diode D4.</desc>')
out.append('<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" '
           'orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#555" stroke-width="1.5"/></marker></defs>')
out.append(f'<rect width="{W}" height="{H}" fill="white"/>')

box(165, 30, 100, 44, SAFE, "Watchdog OK")
box(290, 30, 100, 44, NEUT, "+5 V via R26")
arrow(215, 74, 215, 118)
arrow(340, 74, 340, 118)
main = [(40, "Pi GPIO 18", "3.3 V PWM"), (165, "Q4 + Q5", "two switches"), (290, "Q6", "to the supply"),
        (415, "R9", "100 Ω, ½ W"), (540, "J2 PWM pin", "brown wire")]
for x, t, s_ in main:
    box(x, 120, 100, 56, SIG, t, s_)
for x in (140, 265, 390, 515):
    arrow(x, 148, x + 23, 148)
for x in (152, 402, 527):
    dash(x, 148, 228)
dash(600, 176, 228)
box(100, 230, 104, 56, SAFE, "R7 100 kΩ", "boot = stop")
box(350, 230, 104, 56, NEUT, "LED D12", "R22 2.2 kΩ")
box(463, 230, 104, 56, SAFE, "Q7", "to ground")
box(576, 230, 94, 56, SAFE, "D4 TVS", "SMBJ6.0A")
out.append('<text x="40" y="314" style="font-size:12px;fill:#555">Purple: the signal path. '
           'Green: safety and protection. Voltages and roles: HAT.md 12.3.</text>')
out.append('</svg>')
print("\n".join(out))
