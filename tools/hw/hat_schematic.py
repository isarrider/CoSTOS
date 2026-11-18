#!/usr/bin/env python3
"""Draws the OSCoST HAT circuit diagrams (rev A) as four SVG sheets:

  docs/img/hat-sch-power.svg    power input, ideal diode, 12 V DC/DC, header
  docs/img/hat-sch-pwm.svg      watchdog, PWM pump outputs, feedback inputs
  docs/img/hat-sch-relay.svg    watchdog-switched relay supply, relay outputs
  docs/img/hat-sch-sensors.svg  Pt1000 (MAX31865) and 1-Wire inputs

Usage: python3 tools/hw/hat_schematic.py docs/img
Parts drawn faded are footprints that are not fitted in rev A (n.f.).
These drawings document the circuit; the KiCad project will be the
reference for the board itself.
"""
import math
import os
import sys

INK = "#222"
C12 = "#c62828"
C5 = "#ef6c00"
C33 = "#b8860b"
SIG = "#1565c0"
GNDC = "#2e7d32"
RAIL_COL = {"+12V": C12, "+5V": C5, "+5V_IN": C5, "+5V_REL": C5, "+3V3": C33, "+3V3_SENS": C33}


class Sheet:
    def __init__(self, w, h, title, desc):
        self.w, self.h = w, h
        self.o = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'font-family="Helvetica, Arial, sans-serif">',
            f"<title>{title}</title>",
            f"<desc>{desc}</desc>",
            "<style>"
            f".w{{stroke:{INK};stroke-width:2;fill:none}}"
            f".b{{stroke:{INK};stroke-width:2;fill:white}}"
            f".r{{font-size:12px;font-weight:bold;fill:{INK}}}"
            f".v{{font-size:11px;fill:#444}}"
            f".pn{{font-size:11px;fill:{INK}}}"
            f".num{{font-size:10px;fill:{C12}}}"
            f".n{{font-size:11px;fill:#555;font-style:italic}}"
            f".h{{font-size:16px;font-weight:bold;fill:{INK}}}"
            "</style>",
            f'<rect width="{w}" height="{h}" fill="white"/>',
        ]
        self.nf = False

    # ---- low level ----
    def add(self, s):
        self.o.append(s)

    def begin_nf(self):
        self.add('<g opacity="0.42">')
        self.nf = True

    def end_nf(self):
        self.add("</g>")
        self.nf = False

    def text(self, x, y, s, cls="v", anchor="start", color=None):
        st = f' style="fill:{color}"' if color else ""
        self.add(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}"{st}>{s}</text>')

    def wire(self, *pts, color=None):
        d = "M" + " L".join(f"{x} {y}" for x, y in pts)
        st = f' style="stroke:{color}"' if color else ""
        self.add(f'<path class="w" d="{d}"{st}/>')

    def dot(self, x, y):
        self.add(f'<circle cx="{x}" cy="{y}" r="3.5" fill="{INK}"/>')

    def nc(self, x, y):
        self.add(f'<path class="w" d="M{x-5} {y-5} L{x+5} {y+5} M{x-5} {y+5} L{x+5} {y-5}"/>')

    def gnd(self, x, y):
        self.add(
            f'<path d="M{x} {y} V{y+10} M{x-12} {y+10} H{x+12} M{x-8} {y+15} H{x+8} M{x-4} {y+20} H{x+4}" '
            f'style="stroke:{GNDC};stroke-width:2;fill:none"/>'
        )

    def rail(self, x, y, name, up=True):
        """Power symbol: connection point (x, y), bar above (or below)."""
        c = RAIL_COL.get(name, INK)
        d = -1 if up else 1
        self.add(
            f'<path d="M{x} {y} V{y+12*d} M{x-12} {y+12*d} H{x+12}" style="stroke:{c};stroke-width:2.5;fill:none"/>'
        )
        ty = y + 26 * d + (4 if up else 8)
        self.text(x, ty, name, "r", "middle", c)

    def flag(self, x, y, name, side="R", sub=None):
        """Net label. side R: body to the right of the connection point."""
        w = int(len(name) * 7 + 16)
        s = 1 if side == "R" else -1
        x1, x2 = x + s * 8, x + s * w
        pts = f"{x},{y} {x1},{y-9} {x2},{y-9} {x2},{y+9} {x1},{y+9}"
        self.add(f'<polygon points="{pts}" style="fill:#e3f2fd;stroke:{SIG};stroke-width:1.5"/>')
        cx = (x1 + x2) / 2
        self.add(f'<text x="{cx}" y="{y+4}" class="pn" text-anchor="middle" style="font-weight:bold;fill:{SIG}">{name}</text>')
        if sub:
            self.text(x2 + s * 6, y + 4, sub, "n", "start" if s > 0 else "end")

    # ---- two-terminal parts ----
    LEN = {"R": 60, "C": 40, "CP": 40, "D": 40, "TVS": 40, "TVS2": 40, "LED": 40, "F": 60, "PTC": 60, "JP": 40}

    def part(self, kind, x, y, direction, ref, val="", lab=None, nf=False):
        """Two-terminal part from (x, y) in direction 'r','l','u','d'.
        Diodes: anode at the start, cathode at the end. Returns the end point."""
        L = self.LEN[kind]
        ang = {"r": 0, "d": 90, "l": 180, "u": 270}[direction]
        if nf and not self.nf:
            self.add('<g opacity="0.42">')
        g = [f'<g transform="translate({x} {y}) rotate({ang})">']
        lead = lambda a, b: g.append(f'<path class="w" d="M{a} 0 H{b}"/>')
        if kind in ("R", "F", "PTC"):
            lead(0, 12); lead(48, 60)
            g.append('<rect class="b" x="12" y="-7" width="36" height="14"/>')
            if kind == "F":
                g.append('<path class="w" d="M12 0 H48" style="stroke-width:1.5"/>')
            if kind == "PTC":
                g.append('<path class="w" d="M8 10 L16 10 L44 -12" style="stroke-width:1.5"/>')
        elif kind in ("C", "CP"):
            lead(0, 17); lead(23, 40)
            g.append('<path class="w" d="M17 -12 V12" style="stroke-width:2.5"/>')
            if kind == "C":
                g.append('<path class="w" d="M23 -12 V12" style="stroke-width:2.5"/>')
            else:
                g.append('<path class="w" d="M26 -12 Q20 0 26 12" style="stroke-width:2.5"/>')
                g.append(f'<text x="8" y="-8" style="font-size:12px;font-weight:bold;fill:{C12}" '
                         f'transform="rotate({-ang} 8 -8)">+</text>')
        elif kind == "JP":
            lead(0, 12); lead(28, 40)
            g.append('<path d="M12 -7 A7 7 0 0 0 12 7 Z M28 -7 A7 7 0 0 1 28 7 Z" style="fill:#888;stroke:#222;stroke-width:1.5"/>')
        else:  # diodes
            lead(0, 12); lead(28, 40)
            if kind == "TVS2":
                g.append('<path d="M12 -9 L20 0 L12 9 Z M28 -9 L20 0 L28 9 Z" style="fill:white;stroke:#222;stroke-width:2"/>')
                g.append('<path class="w" d="M17 -12 L20 -9 V9 L23 12"/>')
            else:
                g.append('<path d="M12 -9 L28 0 L12 9 Z" style="fill:white;stroke:#222;stroke-width:2"/>')
                if kind == "TVS":
                    g.append('<path class="w" d="M24 -12 L28 -9 V9 L32 12"/>')
                else:
                    g.append('<path class="w" d="M28 -9 V9"/>')
                if kind == "LED":
                    for dx in (14, 22):
                        g.append(f'<path class="w" d="M{dx} -12 L{dx+7} -20" style="stroke-width:1.5"/>'
                                 f'<path d="M{dx+7} -20 L{dx+2} -18 L{dx+6} -15 Z" fill="{INK}"/>')
        g.append("</g>")
        self.add("".join(g))
        dx, dy = {"r": (L, 0), "l": (-L, 0), "d": (0, L), "u": (0, -L)}[direction]
        cx, cy = x + dx / 2, y + dy / 2
        nft = " (n.f.)" if nf else ""
        if lab is None:
            lab = "r" if direction in "ud" else "a"
        o = 30 if kind == "LED" else 16
        if lab == "r":
            self.text(cx + o, cy - 2, ref, "r"); self.text(cx + o, cy + 12, val + nft)
        elif lab == "l":
            self.text(cx - o, cy - 2, ref, "r", "end"); self.text(cx - o, cy + 12, val + nft, "v", "end")
        elif lab == "a":
            self.text(cx, cy - 26 if kind == "LED" else cy - 14, f'<tspan class="r">{ref}</tspan> {val}{nft}', "v", "middle")
        elif lab == "b":
            self.text(cx, cy + 26, f'<tspan class="r">{ref}</tspan> {val}{nft}', "v", "middle")
        if nf and not self.nf:
            self.add("</g>")
        return x + dx, y + dy

    # ---- multi-pin symbols ----
    def ic(self, x, y, w, h, ref, name, pins, nf=False, sub=None):
        """pins: (side 'l','r','t','b', offset, name, number or None). Returns {name: endpoint}."""
        if nf and not self.nf:
            self.add('<g opacity="0.42">')
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" style="fill:#fafafa;stroke:{INK};stroke-width:2"/>')
        self.text(x + w / 2, y + h / 2 - 2, ref + (" (n.f.)" if nf else ""), "r", "middle")
        self.text(x + w / 2, y + h / 2 + 13, name, "v", "middle")
        if sub:
            self.text(x + w / 2, y + h / 2 + 27, sub, "n", "middle")
        res = {}
        for side, off, pname, num in pins:
            if side == "l":
                px, py, ex, ey = x, y + off, x - 20, y + off
                self.text(px + 5, py + 4, pname, "pn")
                if num: self.text(px - 4, py - 4, num, "num", "end")
            elif side == "r":
                px, py, ex, ey = x + w, y + off, x + w + 20, y + off
                self.text(px - 5, py + 4, pname, "pn", "end")
                if num: self.text(px + 4, py - 4, num, "num")
            elif side == "t":
                px, py, ex, ey = x + off, y, x + off, y - 20
                self.text(px, py + 14, pname, "pn", "middle")
                if num: self.text(px + 4, py - 6, num, "num")
            else:
                px, py, ex, ey = x + off, y + h, x + off, y + h + 20
                self.text(px, py - 6, pname, "pn", "middle")
                if num: self.text(px + 4, py + 14, num, "num")
            self.wire((px, py), (ex, ey))
            res[pname] = (ex, ey)
        if nf and not self.nf:
            self.add("</g>")
        return res

    def andgate(self, x, y, ref, val, nf=False):
        """2-input AND, input ends at (x, y-10) and (x, y+10), output end (x+80, y)."""
        if nf and not self.nf:
            self.add('<g opacity="0.42">')
        self.wire((x, y - 10), (x + 20, y - 10)); self.wire((x, y + 10), (x + 20, y + 10))
        self.add(f'<path d="M{x+20} {y-20} H{x+40} A20 20 0 0 1 {x+40} {y+20} H{x+20} Z" '
                 f'style="fill:#fafafa;stroke:{INK};stroke-width:2"/>')
        self.wire((x + 60, y), (x + 80, y))
        self.text(x + 40, y - 28, f'<tspan class="r">{ref}</tspan> {val}' + (" (n.f.)" if nf else ""), "v", "middle")
        if nf and not self.nf:
            self.add("</g>")
        return (x, y - 10), (x, y + 10), (x + 80, y)

    def nmos(self, x, y, ref, val, nf=False, lab="r"):
        """N-MOSFET, vertical. Gate end (x-30, y), drain end (x, y-30), source end (x, y+30)."""
        if nf and not self.nf:
            self.add('<g opacity="0.42">')
        self.add(
            f'<g transform="translate({x} {y})">'
            '<path class="w" d="M-30 0 H-14 M-14 -14 V14"/>'
            '<path class="w" d="M-8 -17 V-7 M-8 -5 V5 M-8 7 V17" style="stroke-width:2.5"/>'
            '<path class="w" d="M-8 -12 H0 V-30 M-8 12 H0 V30 M-8 0 H0 V12"/>'
            f'<path d="M-8 0 L-1 -4 L-1 4 Z" fill="{INK}"/>'
            "</g>"
        )
        if lab == "r":
            self.text(x + 10, y - 2, ref, "r"); self.text(x + 10, y + 12, val + (" (n.f.)" if nf else ""))
        if nf and not self.nf:
            self.add("</g>")
        return (x - 30, y), (x, y - 30), (x, y + 30)

    def term(self, x, y, ref, name, pins, nf=False, conn="l"):
        """Field terminal; pins: list of (dy, label). Connection points on the
        left edge (conn='l', labels right) or the right edge (conn='r', labels left)."""
        if nf and not self.nf:
            self.add('<g opacity="0.42">')
        dys = [p[0] for p in pins]
        top, bot = min(dys) - 18, max(dys) + 18
        self.add(f'<rect x="{x}" y="{y+top}" width="34" height="{bot-top}" rx="3" style="fill:#E9E2CC;stroke:#8A7F5F;stroke-width:1.5"/>')
        for dy, lbl in pins:
            self.add(f'<circle cx="{x+17}" cy="{y+dy}" r="6" style="fill:#B0B6BA;stroke:#5F6468"/>'
                     f'<path d="M{x+13} {y+dy+4} L{x+21} {y+dy-4}" style="stroke:#5F6468;stroke-width:1.5"/>')
            if conn == "l":
                self.text(x + 42, y + dy + 4, lbl, "pn")
            else:
                self.text(x - 8, y + dy + 4, lbl, "pn", "end")
        self.text(x + 17, y + top - 22, ref + (" (n.f.)" if nf else ""), "r", "middle")
        self.text(x + 17, y + top - 8, name, "v", "middle")
        if nf and not self.nf:
            self.add("</g>")
        cx = x if conn == "l" else x + 34
        return {lbl: (cx, y + dy) for dy, lbl in pins}

    def heading(self, x, y, s):
        self.text(x, y, s, "h")

    def note(self, x, y, lines):
        for i, l in enumerate(lines):
            self.text(x, y + 15 * i, l.replace("< ", "&lt; "), "n")

    def legend(self):
        y = self.h - 16
        self.add(f'<g opacity="0.42"><rect x="{self.w-252}" y="{y-12}" width="26" height="14" '
                 f'style="fill:white;stroke:{INK};stroke-width:2"/></g>')
        self.text(self.w - 218, y, "faded = not fitted in rev A (n.f.)", "n")

    def save(self, path):
        self.legend()
        self.add("</svg>")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(self.o) + "\n")


# ======================================================================
def sheet_power(path):
    s = Sheet(1180, 650, "OSCoST HAT rev A: 5 V from the Pi and 12 V supply",
              "The HAT takes 5 V from header pins 2 and 4 (the Pi runs from its own USB-C supply, no power input "
              "on the HAT); bulk capacitor and power LED; isolated 5 to 12 V DC/DC for the pump drivers; table of the 40-pin header connections.")
    s.heading(20, 30, "1 · 5 V from the Pi (header pins 2/4, no power input, D18)")
    s.flag(200, 130, "+5V from Pi pins 2, 4", side="L")
    s.wire((200, 130), (620, 130))
    s.dot(490, 130); s.part("CP", 490, 130, "d", "C2", "100 µF", lab="r"); s.gnd(490, 170)
    s.dot(560, 130); s.part("R", 560, 130, "d", "R1", "1 kΩ", lab="r")
    s.part("LED", 560, 190, "d", "D2", "PWR green", lab="r"); s.gnd(560, 230)
    s.rail(620, 130, "+5V")
    s.text(632, 150, "→ U2, U7, LEDs", "n")
    s.note(20, 300, [
        "The Pi runs from its own USB-C supply (D15); the HAT draws",
        "< 200 mA from header pins 2/4, behind the Pi's own input",
        "protection, so it needs no fuse, TVS or ideal diode (D18).",
        "Earlier drafts had J1, F1, D1, Q1, U1 and C1 here (power input",
        "with ideal diode); those reference designators stay unused.",
    ])
    # ---- 12 V DC/DC ----
    s.heading(20, 490, "2 · Pump driver supply: 12 V (normal) or 5 V (Lite build)")
    s.rail(40, 550, "+5V")
    s.wire((40, 550), (150, 550))
    s.dot(90, 550); s.part("C", 90, 550, "d", "C3", "4.7 µF", lab="r"); s.gnd(90, 590)
    u2 = s.ic(170, 530, 160, 70, "U2", "B0512S-1WR3", [
        ("l", 20, "Vin", "2"), ("l", 50, "GND", "1"), ("r", 20, "+Vo", "4"), ("r", 50, "0V", "3")])
    s.wire(u2["GND"], (150, 595)); s.gnd(150, 595)
    s.wire(u2["0V"], (360, 580), (360, 595)); s.gnd(360, 595)
    s.wire(u2["+Vo"], (560, 550))
    s.dot(400, 550); s.part("C", 400, 550, "d", "C4", "10 µF 25 V", lab="r"); s.gnd(400, 590)
    s.dot(490, 550); s.part("R", 490, 550, "d", "R2", "1.5 kΩ ¼ W", lab="r"); s.gnd(490, 610)
    s.rail(560, 550, "+12V")
    s.wire((560, 550), (600, 550))
    s.part("R", 600, 550, "r", "R25", "0 Ω")
    s.wire((660, 550), (700, 550)); s.dot(700, 550)
    s.rail(700, 550, "+V_DRV")
    s.wire((700, 550), (700, 610))
    s.begin_nf()
    s.part("R", 700, 610, "r", "R26", "0 Ω (Lite)", lab="b")
    s.end_nf()
    s.rail(760, 610, "+5V")
    s.note(800, 545, [
        "U2: 1 W, isolated, unregulated; 0V tied to GND.",
        "R2: minimum load (≈ 8 mA), keeps the output",
        "below the TVS standoff (13 V) at light load.",
        "+V_DRV feeds the pump driver U6: R25 fitted = 12 V",
        "(normal build); Lite build: U2, R2, C4, R25 not",
        "fitted, R26 fitted = 5 V. Never both.",
    ])
    # ---- header table ----
    hx, hy = 720, 50
    s.heading(hx, 30, "3 · 40-pin header (Pi 4 / Pi 5)")
    rows = [
        ("+3V3", "1, 17", "", "from the Pi"),
        ("+5V", "2, 4", "", "from the Pi"),
        ("GND", "6, 9, 14, 20, 25, 30, 34, 39", "", ""),
        ("1W_A", "7", "4", "1-Wire bus A"),
        ("1W_B", "11", "17", "1-Wire bus B"),
        ("PWM1", "12", "18", "pump 1 PWM"),
        ("PWM2", "35", "19", "pump 2 PWM (n.f.)"),
        ("FB1", "16", "23", "pump 1 feedback"),
        ("FB2", "36", "16", "pump 2 feedback (n.f.)"),
        ("HEARTBEAT", "18", "24", "watchdog"),
        ("REL1", "22", "25", "relay output 1"),
        ("REL2", "29", "5", "relay output 2 (n.f.)"),
        ("MOSI", "19", "10", "SPI0"),
        ("MISO", "21", "9", "SPI0"),
        ("SCLK", "23", "11", "SPI0"),
        ("CS_PT1", "24", "8", "CE0, MAX31865 #1"),
        ("CS_PT2", "26", "7", "CE1, MAX31865 #2 (n.f.)"),
        ("SDA, SCL", "3, 5", "2, 3", "DS2482 only (n.f.)"),
        ("ID_SD, ID_SC", "27, 28", "0, 1", "ID EEPROM (n.f.)"),
    ]
    s.add(f'<rect x="{hx}" y="{hy}" width="440" height="{30 + 22*len(rows)}" rx="4" style="fill:#fafafa;stroke:{INK};stroke-width:2"/>')
    cols = (10, 120, 210, 260)
    for c, h in zip(cols, ("Net", "Pin", "GPIO", "Use")):
        s.text(hx + c, hy + 19, h, "r")
    s.add(f'<path d="M{hx} {hy+27} H{hx+440}" style="stroke:#bbb"/>')
    for i, (net, pin, gpio, use) in enumerate(rows):
        y = hy + 45 + 22 * i
        col = "#9e9e9e" if "n.f." in use else None
        s.text(hx + cols[0], y, net, "r", color=col or RAIL_COL.get(net, GNDC if net == "GND" else SIG))
        s.text(hx + cols[1], y, pin, "pn", color=col)
        s.text(hx + cols[2], y, gpio, "pn", color=col)
        s.text(hx + cols[3], y, use, "n")
    s.save(path)


# ======================================================================
def sheet_pwm(path):
    s = Sheet(1180, 800, "OSCoST HAT rev A: watchdog, PWM pump outputs and feedback inputs",
              "Retriggerable monostable watchdog producing WD_OK; two PWM channels gated by WD_OK through AND gates "
              "into a TC4427 driver at 12 V with series resistor and TVS; pump feedback inputs with pull-up and RC filter.")
    s.heading(20, 30, "4 · Hardware watchdog")
    u3 = s.ic(170, 150, 160, 140, "U3", "74LVC1G123", [
        ("l", 30, "A", None), ("l", 70, "B", None), ("t", 30, "VCC", None), ("t", 80, "REXT/CEXT", None),
        ("t", 135, "CEXT", None), ("r", 70, "Q", None), ("r", 110, "Q̄", None), ("b", 40, "CLR", None),
        ("b", 110, "GND", None)], sub="retriggerable monostable")
    s.wire(u3["B"], (130, 220)); s.flag(130, 220, "HEARTBEAT", "L")
    s.text(51, 246, "GPIO24 (pin 18)", "n")
    s.wire(u3["A"], (135, 180), (135, 185)); s.gnd(135, 185)
    s.nc(*u3["Q̄"])
    s.wire(u3["VCC"], (200, 110)); s.rail(200, 110, "+3V3")
    s.rail(250, 50, "+3V3")
    s.part("R", 250, 50, "d", "R3", "300 kΩ", lab="r")
    s.wire((250, 110), u3["REXT/CEXT"]); s.dot(250, 120)
    s.wire((250, 120), (262, 120))
    s.part("C", 262, 120, "r", "C5", "10 µF")
    s.wire((302, 120), (305, 120), u3["CEXT"])
    s.wire(u3["GND"], (280, 320)); s.gnd(280, 320)
    s.wire(u3["CLR"], (210, 340)); s.dot(210, 340)
    s.wire((210, 340), (190, 340))
    s.part("R", 190, 340, "l", "R4", "100 kΩ", lab="b")
    s.rail(130, 340, "+3V3")
    s.part("C", 210, 340, "d", "C6", "1 µF", lab="r"); s.gnd(210, 380)
    s.wire(u3["Q"], (400, 220)); s.dot(400, 220)
    s.part("R", 400, 220, "d", "R5", "1 kΩ", lab="r")
    s.part("LED", 400, 280, "d", "D3", "WD OK green", lab="r"); s.gnd(400, 320)
    s.wire((400, 220), (420, 220))
    s.part("R", 420, 220, "r", "R6", "1 kΩ")
    s.wire((480, 220), (590, 220)); s.dot(500, 220)
    s.part("JP", 500, 220, "u", "JP1", "open", lab="r")
    s.rail(500, 180, "+3V3")
    s.wire((500, 220), (500, 234))
    s.add(f'<circle cx="500" cy="239" r="5" style="fill:white;stroke:{INK};stroke-width:2"/>')
    s.text(510, 252, "TP1", "r")
    s.flag(590, 220, "WD_OK", "R")
    s.note(20, 430, [
        "Timeout ≈ R3 · C5 ≈ 3 s (tuned at bring-up). Only rising",
        "edges on B retrigger U3: OSCoST toggles HEARTBEAT once per",
        "control cycle (1 s), so an edge arrives every 2 s. A line",
        "stuck high or low lets WD_OK drop.",
        "Power-up: R4/C6 hold CLR low; Q then stays low until the",
        "first heartbeat, so nothing runs while the Pi boots.",
        "JP1 forces WD_OK high for bench tests (open by default).",
        "D3 shows U3's state, not the JP1 override.",
    ])
    # ---- PWM channels ----
    s.heading(640, 30, "5 · PWM pump outputs (12 V)")
    u6 = s.ic(860, 70, 100, 300, "U6", "TC4427", [
        ("l", 50, "IN A", "2"), ("l", 260, "IN B", "4"), ("r", 50, "OUT A", "7"), ("r", 260, "OUT B", "5"),
        ("t", 50, "VDD", "6"), ("b", 50, "GND", "3")], sub="dual driver")
    s.wire(u6["VDD"], (910, 45)); s.rail(910, 45, "+V_DRV")
    s.text(925, 62, "C7 1 µF, C8 100 nF", "n")
    s.wire(u6["GND"], (910, 395)); s.gnd(910, 395)
    for n, y in ((1, 120), (2, 330)):
        nf = n == 2
        gpio, pin = (18, 12) if n == 1 else (19, 35)
        if nf: s.begin_nf()
        a, b, out = s.andgate(700, y, "U4" if n == 1 else "U5", "74LVC1G08 (n.f.)" if nf else "74LVC1G08")
        s.wire((690, y - 10), a); s.flag(690, y - 10, f"PWM{n}", "L")
        s.text(640, y - 6, f"GPIO{gpio} (pin {pin})", "n", "end")
        s.wire((690, y + 10), b); s.flag(690, y + 10, "WD_OK", "L")
        s.wire(out, (800, y))
        if nf: s.end_nf()
        s.wire((800, y), (840, y)); s.dot(810, y)
        s.part("R", 810, y, "d", "R7" if n == 1 else "R8", "100 kΩ", lab="l"); s.gnd(810, y + 60)
        if nf: s.begin_nf()
        s.wire(u6["OUT A" if n == 1 else "OUT B"], (990, y))
        s.dot(975, y); s.wire((975, y), (975, y + 60))
        s.part("R", 975, y + 60, "d", "R22" if n == 1 else "R24", "4.7 kΩ", lab="r")
        s.part("LED", 975, y + 120, "d", "D12" if n == 1 else "D14", f"PUMP{n}", lab="r")
        s.gnd(975, y + 160)
        s.part("R", 990, y, "r", "R9" if n == 1 else "R10", "470 Ω")
        s.wire((1050, y), (1110, y)); s.dot(1070, y)
        s.wire((1070, y), (1070, y + 10))
        s.part("TVS", 1070, y + 50, "u", "D4" if n == 1 else "D5", "SMBJ13A", lab="l")
        s.gnd(1070, y + 50)
        tp = s.term(1110, y, "J2" if n == 1 else "J3", f"PUMP{n}", [(0, "PWM"), (45, "GND"), (90, "FB")])
        s.wire(tp["GND"], (1100, y + 45), (1100, y + 50)); s.gnd(1100, y + 50)
        s.wire(tp["FB"], (1095, y + 90)); s.flag(1095, y + 90, f"P{n}_FB", "L")
        if nf: s.end_nf()
    s.note(640, 470, [
        "U4/U5: the PWM reaches the driver only while WD_OK is high;",
        "otherwise the output is 0 % = stop (PWM2 solar profile).",
        "R7/R8 hold the driver inputs low; R8 is fitted although",
        "channel 2 is not, so IN B never floats.",
        "R9 limits the current into a shorted cable; D4 clamps",
        "spikes from the pump cable. Terminal order = cable colours",
        "brown (PWM), blue (GND), black (FB).",
        "D12 shows what really reaches the pump: off = stop,",
        "brighter = faster (≈ 2 mA at 12 V).",
    ])
    # ---- feedback ----
    s.heading(20, 610, "6 · Pump feedback inputs (open collector, 75 Hz)")
    for n, x0 in ((1, 120), (2, 640)):
        nf = n == 2
        y = 710
        if nf: s.begin_nf()
        s.flag(x0, y, f"P{n}_FB", "L")
        s.wire((x0, y), (x0 + 40, y)); s.dot(x0 + 40, y)
        s.part("R", x0 + 40, y, "u", "R11" if n == 1 else "R13", "4.7 kΩ", lab="l")
        s.rail(x0 + 40, y - 60, "+3V3")
        s.part("R", x0 + 40, y, "r", "R12" if n == 1 else "R14", "10 kΩ", lab="b")
        s.wire((x0 + 100, y), (x0 + 200, y)); s.dot(x0 + 140, y)
        s.part("C", x0 + 140, y, "d", "C9" if n == 1 else "C10", "1 nF", lab="r"); s.gnd(x0 + 140, y + 40)
        s.flag(x0 + 200, y, f"FB{n}", "R")
        s.text(x0 + 200, y + 28, f"GPIO{23 if n == 1 else 16} (pin {16 if n == 1 else 36})", "n")
        if nf: s.end_nf()
    s.save(path)


# ======================================================================
def relay_block(s, x, y, n, gpio, pin):
    """Relay output n. x = MOSFET column, y = top (+5V_REL) line."""
    tx = x + 260
    s.rail(x, y, "+5V_REL")
    s.wire((x, y), (tx - 40, y), (tx - 40, y + 20), (tx, y + 20))
    s.dot(x + 80, y); s.dot(x + 150, y)
    g, d, src = s.nmos(x, y + 170, "Q2", "AO3400A")
    s.wire(src, (x, y + 205)); s.gnd(x, y + 205)
    s.wire(d, (x, y + 120), (tx - 20, y + 120), (tx - 20, y + 60), (tx, y + 60))
    s.dot(x + 80, y + 120); s.dot(x + 150, y + 120)
    s.part("D", x + 80, y + 100, "u", "D6", "1N4148W", lab="l")
    s.wire((x + 80, y + 100), (x + 80, y + 120)); s.wire((x + 80, y + 60), (x + 80, y))
    s.part("R", x + 150, y, "d", "R17", "1 kΩ", lab="r")
    s.part("LED", x + 150, y + 60, "d", "D7", "yellow", lab="r")
    s.wire((x + 150, y + 100), (x + 150, y + 120))
    s.term(tx, y, "J4", "REL1", [(20, "+5V sw"), (60, "OUT")])
    s.wire(g, (x - 50, y + 170))
    s.part("R", x - 50, y + 170, "l", "R15", "100 Ω")
    s.wire((x - 110, y + 170), (x - 130, y + 170))
    s.flag(x - 130, y + 170, "REL1", "L")
    s.text(x - 130, y + 196, f"GPIO{gpio} (pin {pin})", "n", "end")
    s.dot(x - 40, y + 170)
    s.wire((x - 40, y + 170), (x - 40, y + 180))
    s.part("R", x - 40, y + 180, "d", "R16", "100 kΩ", lab="l")
    s.gnd(x - 40, y + 240)


def sheet_relay(path):
    s = Sheet(1180, 520, "OSCoST HAT rev A: relay supply and relay outputs",
              "High-side load switch enabled by WD_OK creating the switched 5 V relay supply; two low-side MOSFET "
              "relay outputs with flyback diode, LED and gate pull-down.")
    s.heading(20, 30, "7 · Relay supply (switched by the watchdog)")
    u7 = s.ic(150, 110, 130, 130, "U7", "TPS22918", [
        ("l", 20, "VIN", "1"), ("l", 100, "ON", "3"), ("r", 20, "VOUT", "6"), ("r", 60, "QOD", "5"),
        ("r", 100, "CT", "4"), ("b", 65, "GND", "2")], sub="load switch 2 A")
    s.wire(u7["VIN"], (60, 130)); s.rail(60, 130, "+5V")
    s.dot(90, 130); s.part("C", 90, 130, "d", "C11", "1 µF", lab="r"); s.gnd(90, 170)
    s.wire(u7["ON"], (120, 210)); s.flag(120, 210, "WD_OK", "L")
    s.wire(u7["VOUT"], (400, 130)); s.wire(u7["QOD"], (320, 170), (320, 130)); s.dot(320, 130)
    s.nc(*u7["CT"])
    s.dot(350, 130); s.part("C", 350, 130, "d", "C12", "1 µF", lab="r"); s.gnd(350, 170)
    s.rail(400, 130, "+5V_REL")
    s.wire(u7["GND"], (215, 270)); s.gnd(215, 270)
    s.note(20, 330, [
        "WD_OK low → VOUT off (QOD discharges it): every relay",
        "output is off, whatever the GPIOs do.",
        "CT open: fastest turn-on.",
        "",
        "Load per output: DIN-rail SSR with 3–32 V DC input",
        "(typ. < 20 mA) or a 5 V relay coil up to about 100 mA.",
        "D6 catches a coil's turn-off spike; with an SSR it",
        "does nothing.",
    ])
    s.heading(520, 30, "8 · Relay / SSR outputs (low-side)")
    relay_block(s, 700, 70, 1, 25, 22)
    s.note(520, 360, ["REL2: same circuit (R18, Q3, D8, R20, D9, J5), not fitted.",
                      "Only its gate pull-down R19 is fitted, so GPIO5 is defined."])
    s.begin_nf()
    s.flag(640, 430, "REL2", "L"); s.text(640, 456, "GPIO5 (pin 29)", "n", "end")
    s.wire((640, 430), (700, 430))
    s.add(f'<rect x="700" y="410" width="260" height="40" rx="3" style="fill:white;stroke:{INK};stroke-width:2;stroke-dasharray:5 4"/>')
    s.text(830, 435, "R18, Q3, D8, R20, D9, J5 as for REL1", "v", "middle")
    s.end_nf()
    s.dot(670, 430); s.part("R", 670, 430, "d", "R19", "100 kΩ", lab="r"); s.gnd(670, 490)
    s.save(path)


# ======================================================================
def sheet_sensors(path):
    s = Sheet(1180, 690, "OSCoST HAT rev A: Pt1000 and 1-Wire inputs",
              "MAX31865 RTD-to-digital converter on SPI0 for the Pt1000 collector sensor in 2-wire connection with "
              "4.3 kilo-ohm reference; two 1-Wire buses on GPIO 4 and 17 with pull-ups, ESD protection and a fused "
              "3.3 V sensor supply.")
    s.heading(20, 30, "9 · Pt1000 input (collector)")
    u = s.ic(420, 90, 170, 330, "U8", "MAX31865", [
        ("l", 20, "BIAS", "4"), ("l", 50, "REFIN+", "5"), ("l", 80, "REFIN−", "6"), ("l", 110, "ISENSOR", "7"),
        ("l", 150, "FORCE+", "8"), ("l", 200, "RTDIN+", "10"), ("l", 240, "RTDIN−", "11"), ("l", 290, "FORCE−", "12"),
        ("r", 40, "SDI", "14"), ("r", 80, "SCLK", "15"), ("r", 120, "CS", "16"), ("r", 160, "SDO", "17"),
        ("r", 200, "DRDY", "1"),
        ("t", 50, "VDD", "3"), ("t", 120, "DVDD", "2"),
        ("b", 30, "FORCE2", "9"), ("b", 80, "GND1", "19"), ("b", 115, "GND2", "13"), ("b", 150, "DGND", "18")],
        sub="SSOP-20")
    s.wire(u["BIAS"], (380, 110), (380, 140)); s.wire(u["REFIN+"], (340, 140)); s.dot(380, 140)
    s.part("R", 340, 140, "d", "R21", "4.3 kΩ 0.1 %", lab="l")
    s.wire(u["REFIN−"], (380, 170), (380, 200)); s.wire(u["ISENSOR"], (340, 200)); s.dot(380, 200)
    tp = s.term(60, 240, "J6", "PT1", [(0, "A"), (140, "B")], conn="r")
    s.wire(tp["A"], u["FORCE+"]); s.wire(tp["B"], u["FORCE−"])
    s.dot(300, 240); s.wire((300, 240), (300, 250))
    s.part("JP", 300, 250, "d", "JP2", "closed", lab="l")
    s.wire((300, 290), u["RTDIN+"]); s.dot(300, 290)
    s.dot(300, 380); s.part("JP", 300, 380, "u", "JP3", "closed", lab="l")
    s.wire((300, 340), (300, 330), u["RTDIN−"])
    s.dot(360, 290); s.dot(360, 330)
    s.add('<rect x="380" y="300" width="0" height="0"/>')
    s.part("C", 360, 290, "d", "C13", "10 nF", lab="r")
    s.dot(320, 290)
    s.wire((320, 290), (320, 310), (282, 310))
    s.add(f'<circle cx="277" cy="310" r="5" style="fill:white;stroke:{INK};stroke-width:2"/>')
    s.text(268, 314, "TP2", "r", "end")
    s.dot(150, 240); s.part("TVS2", 150, 240, "d", "D10", "PESD5V0", lab="r"); s.gnd(150, 280)
    s.dot(200, 380); s.part("TVS2", 200, 380, "d", "D11", "PESD5V0", lab="r"); s.gnd(200, 420)
    s.wire(u["VDD"], (470, 50), (540, 50), u["DVDD"])
    s.rail(505, 50, "+3V3")
    s.text(560, 58, "C14, C15: 100 nF at VDD, DVDD", "n")
    for k in ("GND1", "GND2", "DGND"):
        s.wire(u[k], (u[k][0], 460))
    s.wire((500, 460), (570, 460)); s.gnd(535, 460)
    s.wire(u["FORCE2"], (450, 445))
    s.part("JP", 450, 445, "d", "JP4", "to GND", lab="l"); s.gnd(450, 485)
    for k, net, sub in (("SDI", "MOSI", "GPIO10 (pin 19)"), ("SCLK", "SCLK", "GPIO11 (pin 23)"),
                        ("CS", "CS_PT1", "GPIO8 / CE0 (pin 24)"), ("SDO", "MISO", "GPIO9 (pin 21)")):
        s.flag(*u[k], net, "R", sub=sub)
    s.nc(*u["DRDY"])
    s.note(20, 545, [
        "2-wire (default): JP2 and JP3 closed (FORCE+ = RTDIN+, RTDIN− = FORCE−), JP4 ties FORCE2 to GND.",
        "3-wire: open JP2, third wire to TP2, move JP4 to FORCE+. Not needed with the 2-wire roof cable.",
        "R21 (0.1 %) sets the Pt1000 range; C13 across the RTD as the datasheet gives for 1 kΩ RTDs.",
        "U9 with J7 (PT2): identical, CS = CE1 = GPIO7 (pin 26); not fitted.",
        "DRDY is not used: OSCoST polls once per second.",
    ])
    # ---- 1-Wire ----
    s.heading(840, 30, "10 · 1-Wire buses (DS18x20, powered)")
    s.rail(860, 90, "+3V3")
    s.wire((860, 90), (880, 90))
    s.part("PTC", 880, 90, "r", "F2", "polyfuse 100 mA", lab="b")
    s.wire((940, 90), (980, 90)); s.flag(980, 90, "+3V3_SENS", "R")
    for i, (bus, gpio, pin) in enumerate((("A", 4, 7), ("B", 17, 11))):
        y = 250 + 180 * i
        s.flag(890, y, f"1W_{bus}", "L"); s.text(890, y + 26, f"GPIO{gpio} (pin {pin})", "n", "end")
        s.wire((890, y), (1110, y)); s.dot(930, y); s.dot(1000, y)
        s.part("R", 930, y, "u", f"R{22 + i}", "4.7 kΩ", lab="l"); s.rail(930, y - 60, "+3V3")
        s.part("TVS2", 1000, y, "d", f"D{12 + i}", "PESD5V0", lab="r"); s.gnd(1000, y + 40)
        t = s.term(1110, y, f"J{8 + i}", f"1W-{bus}", [(-40, "3V3"), (0, "DQ"), (40, "GND")])
        s.wire(t["3V3"], (1100, y - 40)); s.flag(1100, y - 40, "+3V3_SENS", "L")
        s.wire(t["GND"], (1095, y + 40), (1095, y + 45)); s.gnd(1095, y + 45)
    s.note(840, 560, [
        "F2 feeds both buses' sensors: a shorted sensor",
        "cable cannot pull down the Pi's 3.3 V rail.",
        "DS2482-100 footprint (U10, n.f.) on SDA/SCL",
        "(pins 3/5) can take over the buses later.",
    ])
    s.save(path)


if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else "docs/img"
    sheet_power(os.path.join(d, "hat-sch-power.svg"))
    sheet_pwm(os.path.join(d, "hat-sch-pwm.svg"))
    sheet_relay(os.path.join(d, "hat-sch-relay.svg"))
    sheet_sensors(os.path.join(d, "hat-sch-sensors.svg"))
