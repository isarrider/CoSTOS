#!/usr/bin/env python3
"""Draw docs/img/wiring-1wire-edition.svg: a complete installation with the
Pi + OSCoST HAT (1-Wire edition): 1 Pt1000 on the collector, 7 DS18B20 on two
daisy-chained buses, and the PWM pump. Sensor names follow the reference
installation (docs/installation.md). Usage: python3 tools/docs/wiring_svg.py docs/img"""
import os, subprocess, sys

W, H = 1320, 900
HOT, COLD, HEAT = "#d84315", "#1e88e5", "#8e24aa"
PT_C, W1A, W1B, PUMP_C, MAINS, USB, NET = "#6d4c41", "#2e7d32", "#00897b", "#f57c00", "#8B4513", "#212121", "#607d8b"
o = []


def a(s):
    o.append(s)


def t(x, y, s, cls="n", anchor="start"):
    a(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{s}</text>')


def line(pts, c, w=3, dash=False):
    d = ' stroke-dasharray="8 5"' if dash else ""
    a(f'<polyline points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="none" stroke="{c}" '
      f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{d}/>')


def rect(x, y, w, h, fill, stroke="#333", rx=6, sw=1.5):
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')


SENS = []


def sensor(x, y, name, kind, anchor="start", dx=13, dy=4):
    SENS.append((x, y, name, kind, anchor, dx, dy))


def draw_sensors():
    for x, y, name, kind, anchor, dx, dy in SENS:
        col = {"pt": PT_C, "a": W1A, "b": W1B}[kind]
        a(f'<circle cx="{x}" cy="{y}" r="8" fill="#fff" stroke="{col}" stroke-width="3"/><circle cx="{x}" cy="{y}" r="3" fill="{col}"/>')
        t(x + (dx if anchor == "start" else -dx), y + dy, name, "s", anchor)


a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
a('<style>text{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}'
  '.n{font-size:12px;fill:#333}.s{font-size:12.5px;font-weight:bold;fill:#222}.h{font-size:18px;font-weight:bold;fill:#222}'
  '.b{font-size:13px;font-weight:bold;fill:#222}.w{font-size:12px;fill:#fff;stroke:none}.wb{font-size:13px;font-weight:bold;fill:#fff;stroke:none}'
  '.o{font-size:11.5px;font-style:italic;fill:#555}.th,.ts{stroke:none}</style>')
a(f'<rect width="{W}" height="{H}" fill="white"/>')
t(20, 30, "OSCoST 1-Wire edition: 1 × Pt1000 + 7 × DS18B20 + PWM pump (reference installation, alternative wiring)", "h")

# ---------------- collector
a('<polygon points="70,160 280,82 300,120 90,198" fill="#cfd8dc" stroke="#455a64" stroke-width="1.5"/>')
for k in range(9):
    x1 = 92 + k * 22
    a(f'<line x1="{x1}" y1="{188 - k*8.2}" x2="{x1 + 6}" y2="{196 - k*8.2 - 6}" stroke="#90a4ae" stroke-width="2"/>')
a('<rect x="272" y="68" width="40" height="18" rx="3" fill="#78909c" transform="rotate(-20 292 77)"/>')
t(40, 236, "Collector on the roof (2 × 30R tubes)", "b")

# ---------------- solar loop
line([(308, 74), (360, 74), (360, 560), (440, 560)], HOT, 6)
line([(440, 650), (330, 650), (330, 104), (304, 104)], COLD, 6)
t(366, 150, "solar flow", "o")
t(336, 196, "return", "o")

# pump on the return pipe
a('<circle cx="330" cy="300" r="22" fill="#fff3e0" stroke="#e65100" stroke-width="2.5"/>')
a('<polygon points="321,312 339,312 330,290" fill="#e65100"/>')
t(304, 256, "Solar pump", "b", "end")
t(304, 272, "Wilo Yonos PARA ST …/iPWM2", "n", "end")
t(304, 288, "solar profile, feedback output", "n", "end")

# ---------------- store
rect(440, 250, 190, 480, "#eceff1", "#37474f", rx=40, sw=2)
a('<path d="M440,560 C520,570 560,585 600,595 C560,605 520,615 440,625 C520,630 560,640 440,650" fill="none" stroke="#e57373" stroke-width="3"/>')
a('<path d="M630,330 C560,340 520,350 480,360 C520,370 560,380 630,390 C560,395 520,405 630,420" fill="none" stroke="#ba68c8" stroke-width="3"/>')
t(535, 470, "Store 800 l", "b", "middle")
t(535, 486, "(KER-2 800)", "n", "middle")
t(535, 445, "upper coil: heat pump", "o", "middle")
t(560, 675, "lower coil: solar", "o", "middle")

# ---------------- heating side
rect(860, 120, 170, 70, "#fff8e1", "#8d6e63")
t(945, 150, "House", "b", "middle")
t(945, 168, "(heating / hot water)", "n", "middle")
rect(860, 560, 170, 70, "#f3e5f5", "#6a1b9a")
t(945, 590, "Heat pump", "b", "middle")
t(945, 608, "(only measured)", "n", "middle")
line([(860, 595), (760, 595), (760, 420), (630, 420)], HEAT, 5)   # heat pump -> upper coil, in at its lower end
line([(630, 330), (945, 330), (945, 190)], HEAT, 5)               # upper coil out at its top -> house
line([(1030, 155), (1100, 155), (1100, 595), (1030, 595)], HEAT, 5)  # house -> back to the heat pump

# ---------------- wall sockets
rect(100, 470, 140, 70, "#fafafa", "#999")
t(170, 494, "Wall sockets", "b", "middle")
t(170, 510, "house circuit,", "n", "middle")
t(170, 524, "breaker + RCD", "n", "middle")

# ---------------- the HAT on the Pi: real top view from tools/hw/hat_mockup.py,
# scaled so its left-edge terminals (PT1, 1W-A, 1W-B, PUMP1) sit at y = 640/670/700/730
SC = 0.36
HX, HY = 44 - 58 * SC, 640 - 132 * SC
mock = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hw", "hat_mockup.py"), "file"],
                      capture_output=True, text=True, check=True).stdout
inner = mock[mock.index(">") + 1:mock.rindex("</svg>")]
inner = "\n".join(l for l in inner.split("\n")
                  if not l.startswith('<rect width="680"') and "Top view to scale" not in l
                  and not l.startswith("<title") and not l.startswith("<desc"))
a(f'<g transform="translate({HX:.1f},{HY:.1f}) scale({SC})">{inner}</g>')
t(HX + 340 * SC, HY + 535 * SC, "OSCoST HAT on the Raspberry Pi", "b", "middle")

# ---------------- cables
# PT1: 2-wire up to the roof
line([(44, 640), (30, 640), (30, 58), (276, 58), (283, 66)], PT_C, 3)
sensor(285, 68, "S1 Pt1000", "pt", "start", 16, -10)
t(36, 400, "2-wire roof cable", "o")
t(36, 414, "(existing)", "o")
# pump: signal and mains
line([(44, 730), (22, 730), (22, 815), (290, 815), (290, 296), (308, 296)], PUMP_C, 4)
line([(312, 314), (270, 314), (270, 505), (240, 505)], MAINS, 3)
t(296, 760, "PWM · GND · FB", "o")
t(296, 774, "brown · blue · black", "o")
t(276, 400, "230 V,", "o", "end")
t(276, 414, "permanent", "o", "end")
# Pi supply
line([(150, 603), (150, 540)], USB, 3)
t(158, 580, "USB-C supply", "o")
# 1W-A: S2 -> S3 -> S4 -> S5
s2, s3, s4, s5 = (440, 700), (440, 300), (360, 380), (330, 480)
line([(44, 670), (14, 670), (14, 828), (405, 828), (405, 700), (432, 700)], W1A, 4, dash=True)
line([(432, 700), (420, 700), (420, 300), (432, 300)], W1A, 4, dash=True)
line([(432, 300), (395, 300), (395, 380), (368, 380)], W1A, 4, dash=True)
line([(352, 380), (345, 380), (345, 480), (338, 480)], W1A, 4, dash=True)
sensor(*s2, "S2 store bottom", "a", "start", 14, 4)
sensor(*s3, "S3 store top", "a", "start", 14, 4)
sensor(*s4, "S4 flow", "a", "start", 12, -10)
sensor(*s5, "S5 return", "a", "end", 14, 18)
# 1W-B: S6 -> S7 -> S8
s6, s7, s8 = (760, 480), (800, 330), (1100, 380)
line([(44, 700), (8, 700), (8, 841), (700, 841), (700, 480), (752, 480)], W1B, 4, dash=True)
line([(768, 480), (800, 480), (800, 338)], W1B, 4, dash=True)
line([(800, 322), (800, 300), (1070, 300), (1070, 380), (1092, 380)], W1B, 4, dash=True)
sensor(*s6, "S6 after heat pump", "b", "start", 14, 20)
sensor(*s7, "S7 after store", "b", "end", 14, -12)
sensor(*s8, "S8 back from house", "b", "start", 14, 4)
# network
line([(200, 805), (200, 856), (1220, 856), (1220, 630)], NET, 2.5, dash=True)
rect(1150, 560, 140, 70, "#e3f2fd", "#1565c0")
t(1220, 588, "Network", "b", "middle")
t(1220, 606, "VictoriaMetrics, web UI", "n", "middle")
t(1000, 850, "Ethernet", "o", "middle")
t(500, 822, "1-Wire bus A: one 3-wire cable, daisy chain", "o")
t(500, 835, "", "o")
t(720, 836, "1-Wire bus B: one 3-wire cable, daisy chain", "o")
draw_sensors()

# ---------------- legend and requirement
lx, ly = 1110, 66
t(lx, ly, "Cables", "b")
for i, (c, lab, d, w) in enumerate([(PT_C, "Pt1000, 2-wire", False, 3), (W1A, "1-Wire bus A, 3-wire", True, 4),
                                    (W1B, "1-Wire bus B, 3-wire", True, 4), (PUMP_C, "pump signal, 3-wire", False, 4),
                                    (MAINS, "230 V", False, 3), (USB, "USB-C power", False, 3), (NET, "Ethernet", True, 2.5)]):
    y = ly + 22 + i * 20
    line([(lx, y), (lx + 34, y)], c, w, dash=d)
    t(lx + 42, y + 4, lab, "n")
rect(560, 740, 560, 66, "#fff3e0", "#e65100", rx=6)
t(575, 762, "Required: a high-efficiency pump with a PWM input in the SOLAR profile", "b")
t(575, 780, "(Wilo PWM2 / iPWM2, Grundfos profile C): no signal or a broken cable = pump stops.", "n")
t(575, 796, "A heating-profile pump (no signal = full speed) is not safe without a cut-off relay.", "n")
a('</svg>')
open(f"{sys.argv[1] if len(sys.argv) > 1 else '.'}/wiring-1wire-edition.svg", "w").write("\n".join(o))
