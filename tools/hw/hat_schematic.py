#!/usr/bin/env python3
"""Draws the CoSTOS HAT circuit diagrams (rev A) as four SVG sheets:

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

    def pmos(self, x, y, ref, val, lab="r", sub=None):
        """P-MOSFET, vertical. Gate end (x-30, y), source end (x, y-30), drain end (x, y+30)."""
        self.add(
            f'<g transform="translate({x} {y})">'
            '<path class="w" d="M-30 0 H-14 M-14 -14 V14"/>'
            '<path class="w" d="M-8 -17 V-7 M-8 -5 V5 M-8 7 V17" style="stroke-width:2.5"/>'
            '<path class="w" d="M-8 -12 H0 V-30 M-8 12 H0 V30 M-8 0 H0 V-12"/>'
            f'<path d="M-1 0 L-8 -4 L-8 4 Z" fill="{INK}"/>'
            "</g>"
        )
        if lab == "r":
            self.text(x + 10, y - 2, ref, "r"); self.text(x + 10, y + 12, val)
            if sub: self.text(x + 10, y + 25, sub, "n")
        return (x - 30, y), (x, y - 30), (x, y + 30)

    def bjt(self, x, y, ref, val, pnp=False, lab="r", sub=None):
        """Bipolar transistor, vertical. Base end (x-30, y). NPN: collector
        (x, y-30), emitter (x, y+30). PNP: emitter (x, y-30), collector (x, y+30)."""
        g = [f'<g transform="translate({x} {y})">',
             '<circle cx="-4" cy="0" r="17" style="fill:white;stroke:#222;stroke-width:1.5"/>',
             '<path class="w" d="M-30 0 H-10 M-10 -11 V11" style="stroke-width:2.5"/>',
             '<path class="w" d="M-10 -5 L0 -13 V-30 M-10 5 L0 13 V30"/>']
        if pnp:   # emitter on top, arrow pointing into the base
            g.append(f'<path d="M-9 -6 L-2 -7 L-6 -12 Z" fill="{INK}"/>')
        else:     # emitter at the bottom, arrow pointing out
            g.append(f'<path d="M0 13 L-7 12 L-3 7 Z" fill="{INK}"/>')
        g.append("</g>")
        self.add("".join(g))
        if lab == "r":
            self.text(x + 18, y - 2, ref, "r"); self.text(x + 18, y + 12, val)
            if sub: self.text(x + 18, y + 25, sub, "n")
        elif lab == "l":
            self.text(x - 26, y - 10, ref, "r", "end"); self.text(x - 26, y - 22, val, "v", "end")
        top, bot = (x, y - 30), (x, y + 30)
        return {"B": (x - 30, y), "C": bot if pnp else top, "E": top if pnp else bot}

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
    s = Sheet(1180, 650, "CoSTOS HAT rev A: 5 V from the Pi and 12 V supply",
              "The HAT takes 5 V from header pins 2 and 4 (the Pi runs from its own USB-C supply, no power input "
              "on the HAT); bulk capacitor and power LED; isolated 5 to 12 V DC/DC for the pump drivers; table of the 40-pin header connections.")
    s.heading(20, 30, "1 · 5 V from the Pi (header pins 2/4, no power input, D18)")
    s.flag(200, 130, "+5V from Pi pins 2, 4", side="L")
    s.wire((200, 130), (620, 130))
    s.dot(490, 130); s.part("CP", 490, 130, "d", "C2", "100 µF", lab="r"); s.gnd(490, 170)
    s.dot(560, 130); s.part("R", 560, 130, "d", "R1", "1 kΩ", lab="r")
    s.part("LED", 560, 190, "d", "D2", "PWR green", lab="r"); s.gnd(560, 230)
    s.rail(620, 130, "+5V")
    s.text(632, 150, "→ U2, Q12, LEDs", "n")
    s.note(20, 300, [
        "The Pi runs from its own USB-C supply (D15); the HAT draws",
        "< 200 mA from header pins 2/4, behind the Pi's own input",
        "protection, so it needs no fuse, TVS or ideal diode (D18).",
        "Earlier drafts had J1, F1, D1, Q1, U1 and C1 here (power input",
        "with ideal diode); those reference designators stay unused.",
    ])
    # ---- 12 V DC/DC ----
    s.heading(20, 490, "2 · Pump driver supply: 12 V (normal) or 5 V (1-Wire Lite)")
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
    s.part("R", 700, 610, "r", "R26", "0 Ω (1-Wire Lite)", lab="b")
    s.end_nf()
    s.rail(760, 610, "+5V")
    s.note(800, 545, [
        "U2: 1 W, isolated, unregulated; 0V tied to GND.",
        "R2: minimum load (≈ 8 mA), keeps the output",
        "below the TVS standoff (13 V) at light load.",
        "+V_DRV feeds the pump driver U6: R25 fitted = 12 V",
        "(normal build); 1-Wire Lite: U2, C3, C4, R2, R25 not",
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
        ("RB1", "31", "6", "pump 1 PWM readback"),
        ("RB2", "37", "26", "pump 2 PWM readback (n.f.)"),
        ("HEARTBEAT", "18", "24", "watchdog"),
        ("REL1", "22", "25", "relay output 1"),
        ("REL2", "29", "5", "relay output 2 (n.f.)"),
        ("MOSI", "19", "10", "SPI0"),
        ("MISO", "21", "9", "SPI0"),
        ("SCLK", "23", "11", "SPI0"),
        ("CS_PT1", "24", "8", "CE0, MAX31865"),
        ("SDA, SCL", "3, 5", "2, 3", "DS2482 only (n.f.)"),
        ("ID_SD, ID_SC", "27, 28", "0, 1", "ID EEPROM (n.f.)"),
    ]
    s.add(f'<rect x="{hx}" y="{hy}" width="440" height="{30 + 20*len(rows)}" rx="4" style="fill:#fafafa;stroke:{INK};stroke-width:2"/>')
    cols = (10, 120, 210, 260)
    for c, h in zip(cols, ("Net", "Pin", "GPIO", "Use")):
        s.text(hx + c, hy + 19, h, "r")
    s.add(f'<path d="M{hx} {hy+27} H{hx+440}" style="stroke:#bbb"/>')
    for i, (net, pin, gpio, use) in enumerate(rows):
        y = hy + 45 + 20 * i
        col = "#9e9e9e" if "n.f." in use else None
        s.text(hx + cols[0], y, net, "r", color=col or RAIL_COL.get(net, GNDC if net == "GND" else SIG))
        s.text(hx + cols[1], y, pin, "pn", color=col)
        s.text(hx + cols[2], y, gpio, "pn", color=col)
        s.text(hx + cols[3], y, use, "n")
    s.save(path)


# ======================================================================
def sheet_pwm(path):
    s = Sheet(1500, 800, "CoSTOS HAT rev A: watchdog, PWM pump output, feedback and readback",
              "Capacitor watchdog: a heartbeat charge pump keeps WD_OK charged; the PWM pump output as a transistor chain: two NPN "
              "switches in series (PWM and watchdog) drive a PNP to the supply, an NPN pulls the terminal low; series "
              "resistor and TVS; pump feedback inputs with pull-up and RC filter; output readback divider.")
    s.heading(20, 30, "4 · Hardware watchdog (capacitor watchdog, D24)")
    s.flag(130, 150, "HEARTBEAT", "L"); s.text(51, 176, "GPIO24 (pin 18)", "n")
    s.wire((130, 150), (140, 150))
    s.part("R", 140, 150, "r", "R48", "4.7 kΩ", lab="a")
    s.wire((200, 150), (230, 150)); s.dot(210, 150)
    s.part("C", 210, 150, "d", "C16", "100 nF", lab="r"); s.gnd(210, 190)
    s.part("C", 230, 150, "r", "C17", "470 nF", lab="a")
    s.wire((270, 150), (290, 150))
    s.part("C", 290, 150, "r", "C19", "470 nF", lab="b")
    s.wire((330, 150), (370, 150)); s.dot(350, 150)
    s.part("D", 350, 200, "u", "D20", "1N4148W", lab="r"); s.gnd(350, 200)
    s.wire((350, 160), (350, 150))
    s.part("D", 370, 150, "r", "D19", "1N4148W", lab="a")
    s.wire((410, 150), (620, 150))
    s.rail(440, 50, "+3V3")
    s.part("JP", 440, 50, "d", "JP1", "open", lab="r")
    s.part("R", 440, 90, "d", "R52", "10 kΩ", lab="r"); s.dot(440, 150)
    s.dot(480, 150); s.part("C", 480, 150, "d", "C18", "10 µF", lab="r"); s.gnd(480, 190)
    for x, ref in ((560, "R49"), (590, "R50")):
        s.dot(x, 150); s.part("R", x, 150, "d", ref, "", lab="-"); s.gnd(x, 210)
    s.text(606, 176, "R49 ∥ R50", "r"); s.text(606, 190, "2.2 MΩ each")
    s.flag(620, 150, "WD_OK", "R")
    # LED driver and readback
    s.rail(320, 230, "+3V3"); s.part("R", 320, 230, "d", "R5", "1 kΩ", lab="l")
    s.part("LED", 320, 290, "d", "D3", "WD green", lab="l")
    s.wire((320, 330), (320, 340)); s.dot(320, 340)
    g, d, src = s.nmos(320, 370, "Q14", "AO3400A")
    s.text(330, 397, "LED and readback", "n")
    s.wire(src, (320, 410)); s.gnd(320, 410)
    s.flag(250, 370, "WD_OK", "L"); s.wire((250, 370), g)
    s.rail(420, 230, "+3V3"); s.part("R", 420, 230, "d", "R51", "10 kΩ", lab="r")
    s.wire((420, 290), (420, 340), (320, 340)); s.dot(420, 340)
    s.wire((420, 340), (480, 340)); s.flag(480, 340, "WD_RB", "R")
    s.text(480, 366, "GPIO20 (pin 38), low = on", "n")
    # rev A comparison: 74LVC1G123
    s.begin_nf()
    s.add(f'<rect x="440" y="392" width="230" height="44" rx="3" style="fill:white;stroke:{INK};stroke-width:2;stroke-dasharray:5 4"/>')
    s.text(555, 411, "U3 74LVC1G123 (rev A only)", "v", "middle")
    s.text(555, 427, "B = HEARTBEAT, Q → R53 0 Ω → WD_OK", "n", "middle")
    s.end_nf()
    s.note(20, 462, [
        "Each heartbeat edge pumps charge through C17/C19 and D19 into C18; R49 ∥ R50 drain it",
        "(τ ≈ 11 s). Heartbeat stopped, stuck, slower than about 0.5 Hz or faster than about",
        "1 kHz (R48/C16) → WD_OK below the MOSFET threshold within about 5–14 s → pump and relays off.",
        "No single failed part keeps WD_OK up (two R in parallel, two C in series).",
        "WD_RB: never read C18 directly, a GPIO's boot pull-up or pull-down would move it.",
        "JP1 forces WD_OK for bench tests (open by default).",
        "Rev A: fit U3 and R53, remove R48 to compare with the 74LVC1G123.",
    ])
    # ---- PWM channel (H3, default; D22) ----
    s.heading(640, 30, "5 · PWM pump output PUMP1 (transistor chain H3, D22)")
    s.wire((860, 70), (1020, 70)); s.rail(940, 70, "+V_DRV"); s.dot(940, 70)
    s.part("R", 860, 70, "d", "R36", "2.2 kΩ", lab="l")
    s.wire((860, 130), (860, 170)); s.dot(860, 150)
    s.wire((800, 150), (990, 150)); s.flag(800, 150, "PWM_OFF", "L")
    q6 = s.bjt(1020, 150, "Q6", "MMBT3906", pnp=True, sub="to the supply")
    s.wire(q6["E"], (1020, 70))
    s.part("R", 860, 170, "d", "R35", "2.7 kΩ", lab="l")
    q4 = s.bjt(860, 260, "Q4", "MMBT3904", sub="PWM switch")
    s.dot(860, 230); s.wire((860, 230), (930, 230)); s.flag(930, 230, "Q4_C", "R")
    g5, d5, s5 = s.nmos(860, 350, "Q5", "AO3400A")
    s.text(870, 375, "watchdog switch", "n")
    s.wire(q4["E"], d5)
    s.wire(s5, (860, 385)); s.gnd(860, 385)
    s.flag(700, 260, "PWM1", "L"); s.text(700, 284, "GPIO18 (pin 12)", "n", "end")
    s.wire((700, 260), (770, 260)); s.dot(740, 260)
    s.part("R", 740, 260, "d", "R7", "100 kΩ", lab="l"); s.gnd(740, 320)
    s.part("R", 770, 260, "r", "R33", "10 kΩ", lab="a")
    s.flag(700, 350, "WD_OK", "L")
    s.wire((700, 350), (830, 350))
    s.wire(q6["C"], (1020, 440), (1060, 440)); s.dot(1040, 440)
    s.part("R", 1040, 440, "d", "R22", "2.2 kΩ", lab="l")
    s.part("LED", 1040, 500, "d", "D12", "PUMP1", lab="l"); s.gnd(1040, 540)
    s.part("R", 1060, 440, "r", "R9", "470 Ω ½ W", lab="a")
    s.wire((1120, 440), (1420, 440))
    s.dot(1170, 440); s.wire((1170, 440), (1170, 470))
    q7 = s.bjt(1170, 500, "Q7", "MMBT3904", sub="pull-down")
    s.wire(q7["E"], (1170, 535)); s.gnd(1170, 535)
    s.wire(q7["B"], (1140, 540)); s.part("R", 1140, 600, "u", "R37", "47 kΩ", lab="l")
    s.flag(1140, 600, "Q4_C", "R")
    s.dot(1260, 440); s.part("R", 1260, 440, "d", "R38", "10 kΩ", lab="r"); s.gnd(1260, 500)
    s.dot(1330, 440); s.wire((1330, 440), (1330, 450))
    s.part("TVS", 1330, 490, "u", "D4", "SMBJ13A", lab="r"); s.gnd(1330, 490)
    s.dot(1390, 440); s.wire((1390, 440), (1390, 400)); s.flag(1390, 400, "P1_OUT", "L")
    tp = s.term(1420, 440, "J2", "PUMP1", [(0, "PWM"), (45, "GND"), (90, "FB")])
    s.wire(tp["GND"], (1410, 485), (1410, 490)); s.gnd(1410, 490)
    s.wire(tp["FB"], (1405, 530)); s.flag(1405, 530, "P1_FB", "L")
    s.note(1180, 120, [
        "Q4 and Q5 in a row are the watchdog AND: Q6 switches the",
        "output to +V_DRV only while PWM1 and WD_OK are both high.",
        "Either switch off: R36 pulls PWM_OFF high, Q6 turns off",
        "and Q7 pulls the terminal actively to 0 V = stop.",
        "R7 holds PWM1 low while the Pi boots. R9 limits a shorted",
        "cable and the brief Q6/Q7 overlap when switching.",
        "1-Wire Lite: R9 100 Ω, D4 SMBJ6.0A, R31 6.8 kΩ (4.1).",
        "D12 shows what leaves the board: off = stop, brighter = faster.",
        "Terminal order = cable colours brown, blue, black.",
        "PUMP2 (n.f.): the same chain, Q8–Q11, R39–R44, R10, R24,",
        "D5, D14, J3, from PWM2 = GPIO19 (pin 35).",
        "Prototype rev A only: the AND gate + TC4427 chain (U4, U6,",
        "C7, C8) as a jumper-selected fallback (4.1); not on the",
        "released board.",
    ])
    # ---- feedback ----
    s.heading(20, 610, "6 · Pump feedback inputs (open collector, 75 Hz)")
    for n, x0 in ((1, 120), (2, 640)):
        nf = n == 2
        y = 710
        if nf: s.begin_nf()
        s.flag(x0 - 50, y, f"P{n}_FB", "L")
        s.wire((x0 - 50, y), (x0 + 40, y)); s.dot(x0 + 40, y)
        # ESD diode first, right at the terminal's FB pin
        s.dot(x0 - 10, y); s.part("TVS2", x0 - 10, y, "d", "D17" if n == 1 else "D18", "PESD5V0", lab="l"); s.gnd(x0 - 10, y + 40)
        s.part("R", x0 + 40, y, "u", "R11" if n == 1 else "R13", "4.7 kΩ", lab="l")
        s.rail(x0 + 40, y - 60, "+3V3")
        s.part("R", x0 + 40, y, "r", "R12" if n == 1 else "R14", "10 kΩ", lab="b")
        s.wire((x0 + 100, y), (x0 + 200, y)); s.dot(x0 + 140, y)
        s.part("C", x0 + 140, y, "d", "C9" if n == 1 else "C10", "1 nF", lab="r"); s.gnd(x0 + 140, y + 40)
        s.flag(x0 + 200, y, f"FB{n}", "R")
        s.text(x0 + 200, y + 28, f"GPIO{23 if n == 1 else 16} (pin {16 if n == 1 else 36})", "n")
        if nf: s.end_nf()
    s.heading(960, 655, "7 · PWM output readback")
    s.flag(1040, 710, "P1_OUT", "L")
    s.wire((1040, 710), (1060, 710))
    s.part("R", 1060, 710, "r", "R31", "27 kΩ (1-Wire Lite 6.8 kΩ)", lab="a")
    s.wire((1120, 710), (1200, 710)); s.dot(1150, 710)
    s.part("R", 1150, 710, "d", "R32", "8.2 kΩ", lab="r"); s.gnd(1150, 770)
    s.flag(1200, 710, "RB1", "R"); s.text(1200, 738, "GPIO6 (pin 31)", "n")
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
    s = Sheet(1180, 600, "CoSTOS HAT rev A: relay supply and relay outputs",
              "P-MOSFET high-side switch, turned on by an N-MOSFET from WD_OK, creating the switched 5 V relay "
              "supply; two low-side MOSFET relay outputs with flyback diode, LED and gate pull-down.")
    s.heading(20, 30, "7 · Relay supply (switched by the watchdog)")
    s.rail(80, 110, "+5V"); s.wire((80, 110), (300, 110))
    s.dot(110, 110); s.part("C", 110, 110, "d", "C11", "1 µF", lab="r"); s.gnd(110, 150)
    s.dot(240, 110); s.part("R", 240, 110, "d", "R45", "100 kΩ", lab="l")
    g, src, drn = s.pmos(300, 190, "Q12", "AO3401A", sub="relay supply switch")
    s.wire((300, 110), src)
    s.wire((240, 170), (240, 220)); s.wire(g, (240, 190)); s.dot(240, 190)
    g13, d13, s13 = s.nmos(240, 250, "Q13", "AO3400A")
    s.text(250, 275, "on while WD_OK", "n")
    s.wire(s13, (240, 290)); s.gnd(240, 290)
    s.wire(g13, (130, 250)); s.flag(130, 250, "WD_OK", "L")
    s.wire(drn, (300, 230), (460, 230))
    s.dot(400, 230); s.part("C", 400, 230, "d", "C12", "1 µF", lab="r"); s.gnd(400, 270)
    s.rail(460, 230, "+5V_REL")
    s.note(20, 380, [
        "WD_OK high → Q13 pulls the gate of Q12 to 0 V → +5V_REL on.",
        "WD_OK low (capacitor empty) → R45 holds the gate at 5 V → every",
        "relay output is off, whatever the GPIOs do (D23).",
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
    s = Sheet(1180, 690, "CoSTOS HAT rev A: Pt1000 and 1-Wire inputs",
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
        "DRDY is not used: CoSTOS polls once per second.",
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
        s.wire((890, y), (945, y)); s.dot(920, y)
        s.part("R", 920, y, "u", f"R{27 + i}", "4.7 kΩ", lab="l"); s.rail(920, y - 60, "+3V3")
        # series resistor between the GPIO side (pull-up) and the terminal side (ESD)
        s.part("R", 945, y, "r", f"R{29 + i}", "100 Ω", lab="b")
        s.wire((1005, y), (1110, y)); s.dot(1035, y)
        s.part("TVS2", 1035, y, "d", f"D{15 + i}", "PESD5V0", lab="r"); s.gnd(1035, y + 40)
        t = s.term(1110, y, f"J{8 + i}", f"1W-{bus}", [(-40, "3V3"), (0, "DQ"), (40, "GND")])
        s.wire(t["3V3"], (1100, y - 40)); s.flag(1100, y - 40, "+3V3_SENS", "L")
        s.wire(t["GND"], (1095, y + 40), (1095, y + 45)); s.gnd(1095, y + 45)
    s.note(840, 560, [
        "F2 feeds both buses' sensors: a shorted sensor",
        "cable cannot pull down the Pi's 3.3 V rail.",
        "R29/R30 (100 Ω) limit the current into the GPIO",
        "if DQ touches a wrong voltage; the pull-up sits",
        "on the Pi side, so 1-Wire timing is unchanged.",
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
