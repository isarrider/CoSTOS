#!/usr/bin/env python3
"""Draws the to-scale top view of the OSCoST HAT (1 mm = 8 px).

  python3 tools/hw/hat_mockup.py file    > docs/img/hat-mockup.svg      (1-Wire edition)
  python3 tools/hw/hat_mockup.py file pt > docs/img/hat-pt-mockup.svg   (PT edition)

("widget" instead of "file" gives a variant for inline display in chat.)"""
import sys
widget = sys.argv[1] == "widget"
pt = len(sys.argv) > 2 and sys.argv[2] == "pt"
out = []
def t(x, y, s, size=12, color=None, weight=400, anchor="start", on_board=True):
    cls = "th" if weight == 500 else "ts"
    style = f"font-size:{size}px;font-weight:{weight}"
    if on_board or not widget:
        style += f";fill:{color or ('#ffffff' if on_board else '#555555')}"
    out.append(f'<text class="{cls}" x="{x}" y="{y}" text-anchor="{anchor}" style="{style}">{s}</text>')
def chip(x, y, w, h, title, sub):
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="#151515" stroke="#3a3a3a" stroke-width="1"/>')
    t(x + w/2, y + h/2 - 3, title, 12, "#ffffff", 500, "middle")
    t(x + w/2, y + h/2 + 12, sub, 11, "#bdbdbd", 400, "middle")

H = 550
head = (f'<svg width="100%" viewBox="0 0 680 {H}" role="img">' if widget else
        f'<svg xmlns="http://www.w3.org/2000/svg" width="680" height="{H}" viewBox="0 0 680 {H}" font-family="Helvetica, Arial, sans-serif">')
out.append(head)
if pt:
    out.append('<title>OSCoST HAT PT edition mockup, top view</title>')
    out.append('<desc>Raspberry Pi HAT, 65 by 56.5 millimetres, PT edition with one LTC2983: a two-level terminal block with eight Pt1000 inputs and a 1-Wire terminal on the left edge, the LTC2983 with its shared sense resistor and input protection, and the same power, relay, pump and watchdog section as the 1-Wire edition.</desc>')
else:
    out.append('<title>OSCoST HAT mockup, top view</title>')
    out.append('<desc>Raspberry Pi HAT, 65 by 56.5 millimetres, with the 40-pin header along the top, Pt1000 and 1-Wire terminals on the left edge, power, relay and pump terminals on the bottom edge, and the chips placed next to their connectors.</desc>')
if not widget:
    out.append(f'<rect width="680" height="{H}" fill="white"/>')
# board
out.append('<rect x="80" y="30" width="520" height="452" rx="24" fill="#1E5631" stroke="#0F3A20" stroke-width="2"/>')
for (cx, cy) in [(108, 58), (572, 58), (108, 450), (572, 450)]:
    out.append(f'<circle cx="{cx}" cy="{cy}" r="11" fill="#C9A227"/><circle cx="{cx}" cy="{cy}" r="6" fill="#F4F1E8"/>')
# header
out.append('<rect x="137" y="38" width="406" height="40" rx="2" fill="#111111"/>')
for i in range(20):
    x = 137 + 10 + i * 20.32
    for y in (48, 68):
        out.append(f'<rect x="{x-3:.1f}" y="{y-3}" width="6" height="6" fill="#C9A227"/>')
t(340, 98, "40-pin header to the Pi (stacking header for the Pi 5 cooler)", 11, "#E8F5E9", 400, "middle")
# EEPROM footprint
ex = 420 if pt else 320
out.append(f'<rect x="{ex}" y="108" width="56" height="24" rx="2" fill="none" stroke="#E8F5E9" stroke-width="1" stroke-dasharray="3 3"/>')
t(ex + 64, 124, "ID EEPROM, not fitted", 11, "#C8E6C9")
# left terminals
def term_v(y0, n, name, sub, fitted=True):
    h = 28 * n
    if not fitted:
        out.append(f'<rect x="58" y="{y0}" width="54" height="{h}" rx="3" fill="none" stroke="#E8F5E9" stroke-width="1" stroke-dasharray="3 3"/>')
        for k in range(n):
            out.append(f'<circle cx="96" cy="{y0 + 14 + 28 * k}" r="4" fill="#C9A227"/>')
        t(118, y0 + h/2 - 2, name, 12, "#E8F5E9", 500)
        t(118, y0 + h/2 + 13, sub, 11, "#C8E6C9")
        return
    out.append(f'<rect x="58" y="{y0}" width="54" height="{h}" rx="3" fill="#E9E2CC" stroke="#8A7F5F" stroke-width="1"/>')
    for k in range(n):
        cy = y0 + 14 + 28 * k
        out.append(f'<circle cx="72" cy="{cy}" r="7" fill="#B0B6BA" stroke="#5F6468"/><line x1="67" y1="{cy}" x2="77" y2="{cy}" stroke="#5F6468" stroke-width="1.5"/>')
    t(118, y0 + h/2 - 2, name, 12, "#ffffff", 500)
    t(118, y0 + h/2 + 13, sub, 11, "#C8E6C9")
def term_pt8(y0):
    """Two-level terminal block: 8 positions, upper and lower level per sensor."""
    h = 28 * 8
    out.append(f'<rect x="58" y="{y0}" width="60" height="{h}" rx="3" fill="#E9E2CC" stroke="#8A7F5F" stroke-width="1"/>')
    out.append(f'<line x1="87" y1="{y0}" x2="87" y2="{y0+h}" stroke="#8A7F5F" stroke-width="1"/>')
    for k in range(8):
        cy = y0 + 14 + 28 * k
        for cx in (72, 103):
            out.append(f'<circle cx="{cx}" cy="{cy}" r="7" fill="#B0B6BA" stroke="#5F6468"/><line x1="{cx-5}" y1="{cy}" x2="{cx+5}" y2="{cy}" stroke="#5F6468" stroke-width="1.5"/>')
        t(126, cy + 4, f"S{k+1}", 12, "#ffffff", 500)
if pt:
    term_pt8(110)
    term_v(346, 3, "PUMP1", "solar pump")
else:
    term_v(104, 2, "PT1", "collector")
    term_v(166, 3, "1W-A", "DS18x20")
    term_v(256, 3, "1W-B", "DS18x20")
    term_v(346, 3, "PUMP1", "solar pump")
# bottom terminals
def term_h(x0, n, name, pins, fitted=True):
    w = 28 * n
    if fitted:
        out.append(f'<rect x="{x0}" y="450" width="{w}" height="46" rx="3" fill="#E9E2CC" stroke="#8A7F5F" stroke-width="1"/>')
    else:
        out.append(f'<rect x="{x0}" y="450" width="{w}" height="32" rx="3" fill="none" stroke="#E8F5E9" stroke-width="1" stroke-dasharray="3 3"/>')
    for k in range(n):
        cx = x0 + 14 + 28 * k
        if fitted:
            out.append(f'<circle cx="{cx}" cy="466" r="7" fill="#B0B6BA" stroke="#5F6468"/><line x1="{cx}" y1="461" x2="{cx}" y2="471" stroke="#5F6468" stroke-width="1.5"/>')
        else:
            out.append(f'<circle cx="{cx}" cy="466" r="4" fill="#C9A227"/>')
        t(cx, 512, pins[k], 11, None, 400, "middle", on_board=False)
    t(x0 + w/2, 440, name + ("" if fitted else " (n.f.)"), 12, "#ffffff" if fitted else "#E8F5E9", 500, "middle")
term_h(216, 2, "REL1", ["+5V", "OUT"])
term_h(284, 2, "REL2", ["+5V", "OUT"], fitted=False)
if pt:
    term_h(352, 3, "1W-A", ["3V3", "DQ", "GND"])
else:
    term_h(352, 2, "PT2", ["A", "B"], fitted=False)
term_h(448 if pt else 420, 3, "PUMP2", ["PWM", "GND", "FB"], fitted=False)
# chips, left column
if pt:
    chip(170, 118, 120, 96, "LTC2983", "8 × Pt1000, 20 inputs")
    chip(170, 226, 120, 34, "R sense 2 kΩ", "0.1 %, shared")
    out.append('<rect x="300" y="118" width="40" height="142" rx="3" fill="#2b2b2b" stroke="#3a3a3a"/>')
    for k in range(8):
        out.append(f'<rect x="306" y="{124 + k*17}" width="12" height="6" fill="#C9A227"/><rect x="322" y="{124 + k*17}" width="12" height="6" fill="#C9A227"/>')
    t(320, 276, "input protection", 11, "#C8E6C9", 400, "middle")
    chip(170, 272, 96, 30, "1-Wire", "pull-up, ESD, fuse")
else:
    chip(205, 110, 100, 46, "MAX31865", "Pt1000 #1")
    out.append('<rect x="205" y="178" width="100" height="46" rx="3" fill="none" stroke="#E8F5E9" stroke-width="1" stroke-dasharray="3 3"/>')
    t(255, 198, "MAX31865 #2", 12, "#E8F5E9", 500, "middle")
    t(255, 213, "not fitted", 11, "#C8E6C9", 400, "middle")
    out.append('<rect x="205" y="246" width="100" height="46" rx="3" fill="none" stroke="#E8F5E9" stroke-width="1" stroke-dasharray="3 3"/>')
    t(255, 266, "DS2482", 12, "#E8F5E9", 500, "middle")
    t(255, 281, "not fitted", 11, "#C8E6C9", 400, "middle")
# bottom rows
chip(196, 368, 78, 46, "TC4427", "pump driver")
chip(282, 368, 78, 46, "Bulk C", "5 V from the Pi")
chip(368, 368, 78, 46, "Relay", "MOSFET")
chip(454, 368, 78, 46, "DC/DC", "5 V → 12 V")
chip(282, 304, 78, 46, "Feedback", "input 1")
chip(368, 304, 78, 46, "Watchdog", "heartbeat")
chip(454, 304, 78, 46, "AND gate", "PWM gating")
# LEDs (row under the logo)
for k, (col, lab, nf) in enumerate([("#4CAF50", "PWR", False), ("#4CAF50", "WD", False), ("#4CAF50", "PUMP", False),
                                     ("#E53935", "ALM", False), ("#FFB300", "R1", False), ("#FFB300", "R2", True)]):
    x = 440 + k * 28
    if nf:
        out.append(f'<circle cx="{x}" cy="262" r="6" fill="none" stroke="#E8F5E9" stroke-dasharray="2 2"/>')
    else:
        out.append(f'<circle cx="{x}" cy="262" r="6" fill="{col}" stroke="#0F3A20"/>')
    t(x, 284, lab, 10, "#E8F5E9", 400, "middle")
# logo
if pt:
    t(480, 200, "OSCoST HAT PT", 14, "#ffffff", 500, "middle")
    t(480, 220, "rev A · 8 × Pt1000 + 1-Wire", 11, "#C8E6C9", 400, "middle")
else:
    t(470, 190, "OSCoST HAT", 14, "#ffffff", 500, "middle")
    t(470, 210, "rev A · 65 × 56.5 mm", 11, "#C8E6C9", 400, "middle")
t(40, 538, "Top view to scale (1 mm = 8 px). Field connectors: fixed 3.5 mm screw terminals"
  + ("; S1–S8 and PUMP1 on the left, 1W-A at the front." if pt else "; sensors and PUMP1 on the left (D17)."), 11, None, 400, "start", on_board=False)
out.append('</svg>')
print("\n".join(out))
