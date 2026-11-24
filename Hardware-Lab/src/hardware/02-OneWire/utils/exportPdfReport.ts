import { jsPDF } from 'jspdf';
import {
  CABLE_CAP_PF_PER_M,
  ONEWIRE_TOPOLOGY_ORDER,
  ONEWIRE_TOPOLOGY_SPECS,
  OneWireSimParams,
  OneWireTopologyId,
  OneWireTopologySpec,
  computeCableLengthSweep,
  evaluateOneWireBus,
  oneWirePerBoardCostEur,
} from '../physics/model';
import { ONEWIRE_REV_B_BOM, ONEWIRE_REV_B_PINOUT } from '../components/KicadBomPinout';
import { ONEWIRE_SCORECARD_ROWS } from '../components/ConclusionScorecard';
import { ONEWIRE_AUDIT_DEFECTS, ONEWIRE_REVISION_STEPS } from '../components/AuditHistory';

// Keeps native WinAnsi glyphs ° (0xB0), ± (0xB1), ² (0xB2), µ (0xB5), × (0xD7)
function pdfSafe(text: string): string {
  return text
    .replace(/Ω/g, 'Ohm')
    .replace(/μ/g, 'µ')
    .replace(/\bdeg\s*C\b/g, '°C')
    .replace(/\+\/-/g, '±')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≈/g, '~')
    .replace(/→/g, '->')
    .replace(/↔/g, '<->')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/·/g, '|')
    .replace(/§/g, 'Sec. ')
    .replace(/€ /g, 'EUR ')
    .replace(/€/g, 'EUR ')
    .replace(/τ/g, 'tau')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xB0\xB1\xB2\xB5\xD7]/g, '');
}

/** Authentic IEEE/IEC Normalized Vector Schematic Engine (820 x 265 grid -> ~1:1 aspect ratio) */
function drawPdfOneWireSchematic(
  doc: jsPDF,
  spec: OneWireTopologySpec,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.4, 1.4, 'FD');

  const sx = (u: number) => boxX + (u / 820) * boxW;
  const sy = (v: number) => boxY + (v / 265) * boxH;
  const sw = (u: number) => (u / 820) * boxW;
  const sh = (v: number) => (v / 265) * boxH;

  const SLATE: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [100, 116, 139];
  const DARK_MUTED: [number, number, number] = [51, 65, 85];
  const RED: [number, number, number] = [185, 28, 28];
  const ORANGE: [number, number, number] = [194, 65, 12];
  const TEAL: [number, number, number] = [14, 116, 144];
  const GREEN: [number, number, number] = [4, 120, 87];
  const CRIMSON: [number, number, number] = [190, 18, 60];

  const wire = (x1: number, y1: number, x2: number, y2: number, col = SLATE, lw = 0.34) => {
    doc.setDrawColor(col[0], col[1], col[2]);
    doc.setLineWidth(lw);
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };

  const dot = (x: number, y: number, col = SLATE) => {
    doc.setFillColor(col[0], col[1], col[2]);
    doc.circle(sx(x), sy(y), 0.58, 'F');
  };

  const txt = (
    str: string,
    x: number,
    y: number,
    size = 5.3,
    col = SLATE,
    align: 'left' | 'center' | 'right' = 'left',
    bold = false,
    mono = true
  ) => {
    doc.setFont(mono ? 'courier' : 'helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(pdfSafe(str), sx(x), sy(y), { align });
  };

  const gnd = (x: number, y: number) => {
    wire(x, y, x, y + 7, SLATE, 0.34);
    wire(x - 8, y + 7, x + 8, y + 7, SLATE, 0.42);
    wire(x - 5, y + 11, x + 5, y + 11, SLATE, 0.34);
    wire(x - 2.2, y + 15, x + 2.2, y + 15, SLATE, 0.28);
  };

  const rail = (x: number, y: number, label: string, col = RED) => {
    wire(x - 9, y, x + 9, y, col, 0.5);
    txt(label, x, y - 4, 5.0, col, 'center', true);
  };

  const resH = (
    x1: number,
    x2: number,
    y: number,
    label: string,
    val: string,
    col = SLATE,
    valCol = DARK_MUTED
  ) => {
    const mid = (x1 + x2) / 2;
    const rw = 36;
    const rx = mid - rw / 2;
    wire(x1, y, rx, y, col, 0.34);
    wire(rx + rw, y, x2, y, col, 0.34);
    const seg = rw / 6;
    const amp = 5.5;
    wire(rx, y, rx + seg * 0.5, y - amp, SLATE, 0.34);
    wire(rx + seg * 0.5, y - amp, rx + seg * 1.5, y + amp, SLATE, 0.34);
    wire(rx + seg * 1.5, y + amp, rx + seg * 2.5, y - amp, SLATE, 0.34);
    wire(rx + seg * 2.5, y - amp, rx + seg * 3.5, y + amp, SLATE, 0.34);
    wire(rx + seg * 3.5, y + amp, rx + seg * 4.5, y - amp, SLATE, 0.34);
    wire(rx + seg * 4.5, y - amp, rx + seg * 5.5, y + amp, SLATE, 0.34);
    wire(rx + seg * 5.5, y + amp, rx + rw, y, SLATE, 0.34);
    txt(label, mid, y - 10, 5.4, SLATE, 'center', true);
    txt(val, mid, y + 14.5, 4.9, valCol, 'center', false);
  };

  const resV = (
    x: number,
    y1: number,
    y2: number,
    label: string,
    val: string,
    side: 'l' | 'r' = 'r'
  ) => {
    const mid = (y1 + y2) / 2;
    const rh = Math.min(30, Math.max(20, (y2 - y1) * 0.62));
    const ry = mid - rh / 2;
    wire(x, y1, x, ry, SLATE, 0.34);
    wire(x, ry + rh, x, y2, SLATE, 0.34);
    const seg = rh / 6;
    const amp = 5.0;
    wire(x, ry, x + amp, ry + seg * 0.5, SLATE, 0.34);
    wire(x + amp, ry + seg * 0.5, x - amp, ry + seg * 1.5, SLATE, 0.34);
    wire(x - amp, ry + seg * 1.5, x + amp, ry + seg * 2.5, SLATE, 0.34);
    wire(x + amp, ry + seg * 2.5, x - amp, ry + seg * 3.5, SLATE, 0.34);
    wire(x - amp, ry + seg * 3.5, x + amp, ry + seg * 4.5, SLATE, 0.34);
    wire(x + amp, ry + seg * 4.5, x - amp, ry + seg * 5.5, SLATE, 0.34);
    wire(x - amp, ry + seg * 5.5, x, ry + rh, SLATE, 0.34);
    const tx = side === 'r' ? x + 10 : x - 10;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, mid - 2, 5.3, SLATE, align, true);
    txt(val, tx, mid + 8, 4.8, DARK_MUTED, align, false);
  };

  const capV = (x: number, y1: number, y2: number, label: string, val: string, side: 'l' | 'r' = 'r') => {
    const mid = (y1 + y2) / 2;
    wire(x, y1, x, mid - 3.2, SLATE, 0.34);
    wire(x - 8, mid - 3.2, x + 8, mid - 3.2, SLATE, 0.48);
    wire(x - 8, mid + 3.2, x + 8, mid + 3.2, SLATE, 0.48);
    wire(x, mid + 3.2, x, y2, SLATE, 0.34);
    const tx = side === 'r' ? x + 11 : x - 11;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, mid - 2, 5.2, SLATE, align, true);
    txt(val, tx, mid + 8, 4.7, DARK_MUTED, align, false);
  };

  const diodeH = (
    x1: number,
    x2: number,
    y: number,
    schottky: boolean,
    label: string,
    val: string,
    col = SLATE
  ) => {
    const cx = (x1 + x2) / 2;
    wire(x1, y, cx - 7, y, col, 0.34);
    wire(cx + 6, y, x2, y, col, 0.34);
    doc.setDrawColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.34);
    doc.triangle(sx(cx - 7), sy(y - 7), sx(cx - 7), sy(y + 7), sx(cx + 6), sy(y), 'FD');
    wire(cx + 6, y - 7, cx + 6, y + 7, SLATE, 0.42);
    if (schottky) {
      wire(cx + 2.5, y - 7, cx + 6, y - 7, SLATE, 0.36);
      wire(cx + 2.5, y - 7, cx + 2.5, y - 4.5, SLATE, 0.36);
      wire(cx + 6, y + 7, cx + 9.5, y + 7, SLATE, 0.36);
      wire(cx + 9.5, y + 7, cx + 9.5, y + 4.5, SLATE, 0.36);
    }
    txt(label, cx, y - 11, 5.4, SLATE, 'center', true);
    txt(val, cx, y + 16, 4.8, DARK_MUTED, 'center', false);
  };

  const diodeV = (
    x: number,
    y1: number,
    y2: number,
    dir: 'up' | 'down' | 'tvs',
    schottky: boolean,
    label: string,
    val: string,
    side: 'l' | 'r' = 'r'
  ) => {
    const cy = (y1 + y2) / 2;
    wire(x, y1, x, cy - 6, SLATE, 0.34);
    wire(x, cy + 6, x, y2, SLATE, 0.34);
    doc.setDrawColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.32);
    if (dir === 'tvs') {
      doc.triangle(sx(x - 6), sy(cy - 6), sx(x + 6), sy(cy - 6), sx(x), sy(cy), 'FD');
      doc.triangle(sx(x - 6), sy(cy + 6), sx(x + 6), sy(cy + 6), sx(x), sy(cy), 'FD');
      wire(x - 7, cy - 2, x - 5, cy, SLATE, 0.34);
      wire(x - 5, cy, x + 5, cy, SLATE, 0.34);
      wire(x + 5, cy, x + 7, cy + 2, SLATE, 0.34);
    } else if (dir === 'up') {
      doc.triangle(sx(x - 6), sy(cy + 6), sx(x + 6), sy(cy + 6), sx(x), sy(cy - 6), 'FD');
      wire(x - 6, cy - 6, x + 6, cy - 6, SLATE, 0.4);
      if (schottky) {
        wire(x - 6, cy - 6, x - 6, cy - 3.2, SLATE, 0.34);
        wire(x + 6, cy - 6, x + 6, cy - 8.8, SLATE, 0.34);
      }
    } else {
      doc.triangle(sx(x - 6), sy(cy - 6), sx(x + 6), sy(cy - 6), sx(x), sy(cy + 6), 'FD');
      wire(x - 6, cy + 6, x + 6, cy + 6, SLATE, 0.4);
      if (schottky) {
        wire(x - 6, cy + 6, x - 6, cy + 8.8, SLATE, 0.34);
        wire(x + 6, cy + 6, x + 6, cy + 3.2, SLATE, 0.34);
      }
    }
    const tx = side === 'r' ? x + 10 : x - 10;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, cy - 1.5, 5.2, SLATE, align, true);
    txt(val, tx, cy + 8.5, 4.7, DARK_MUTED, align, false);
  };

  /** Authentic IEEE Horizontal Enhancement N-MOSFET (Source Left, Drain Right, Gate Top, Body Diode Below) */
  const nmosH = (cx: number, cy: number, label: string, val: string) => {
    // Gate insulated bar & stem
    wire(cx - 15, cy - 19, cx + 15, cy - 19, SLATE, 0.44);
    wire(cx, cy - 19, cx, cy - 30, SLATE, 0.34);
    // Broken enhancement channel (3 segments)
    wire(cx - 15, cy - 13, cx - 7, cy - 13, SLATE, 0.44);
    wire(cx - 4, cy - 13, cx + 4, cy - 13, SLATE, 0.44);
    wire(cx + 7, cy - 13, cx + 15, cy - 13, SLATE, 0.44);
    // Source (left), Substrate arrow (center), Drain (right)
    wire(cx - 26, cy, cx - 11, cy, SLATE, 0.36);
    wire(cx - 11, cy, cx - 11, cy - 13, SLATE, 0.36);
    wire(cx - 11, cy, cx, cy, SLATE, 0.32);
    wire(cx, cy, cx, cy - 13, SLATE, 0.32);
    doc.setFillColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.setDrawColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.triangle(sx(cx - 3.2), sy(cy - 6.5), sx(cx + 3.2), sy(cy - 6.5), sx(cx), sy(cy - 12.5), 'FD');
    wire(cx + 11, cy - 13, cx + 11, cy, SLATE, 0.36);
    wire(cx + 11, cy, cx + 26, cy, SLATE, 0.36);
    // Internal body diode (S -> D) cleanly drawn below in subtle slate
    wire(cx - 13, cy, cx - 13, cy + 10, MUTED, 0.24);
    wire(cx - 13, cy + 10, cx - 4, cy + 10, MUTED, 0.24);
    doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.24);
    doc.triangle(sx(cx - 4), sy(cy + 6.5), sx(cx - 4), sy(cy + 13.5), sx(cx + 3.5), sy(cy + 10), 'FD');
    wire(cx + 3.5, cy + 6.5, cx + 3.5, cy + 13.5, MUTED, 0.28);
    wire(cx + 3.5, cy + 10, cx + 13, cy + 10, MUTED, 0.24);
    wire(cx + 13, cy + 10, cx + 13, cy, MUTED, 0.24);
    // Pin markers
    txt('S', cx - 18, cy - 4, 4.4, MUTED, 'right', false);
    txt('D', cx + 18, cy - 4, 4.4, MUTED, 'left', false);
    txt('G', cx + 5, cy - 23, 4.4, MUTED, 'left', false);
    // RefDes & Part
    txt(label, cx, cy + 25, 5.4, SLATE, 'center', true);
    txt(val, cx, cy + 35, 4.8, TEAL, 'center', false);
  };

  // Layout geometry constants on the 820 x 265 grid
  const is5V = spec.busVoltageV === 5;
  const isBridge = spec.id === 'ds2482_i2c_bridge';
  const Y_5V = 54;
  const Y_3V3 = is5V ? 138 : 96;
  const Y_DQ = 186;
  const Y_GND = 238;
  const Y_J8_P1 = is5V ? Y_5V : Y_3V3;

  // -------------------------------------------------------------------------
  // LEFT BLOCK: RASPBERRY PI (x = 14..122)
  // -------------------------------------------------------------------------
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(sx(14), sy(18), sw(108), sh(232), 1.0, 1.0, 'FD');
  doc.setFillColor(15, 23, 42);
  doc.rect(sx(14), sy(18), sw(108), sh(20), 'F');
  txt('RASPBERRY PI', 68, 31, 5.8, [255, 255, 255], 'center', true, false);

  // Pin labels aligned to exact wire exit Y coordinates
  txt('+5V (Pin 2)', 116, Y_5V + 2.5, 5.0, is5V ? RED : MUTED, 'right', is5V);
  txt('+3V3 (Pin 1)', 116, Y_3V3 + 2.5, 5.0, isBridge ? MUTED : ORANGE, 'right', !isBridge);
  if (isBridge) {
    txt('SDA1 (Pin 3)', 116, 166 + 2.5, 4.9, SLATE, 'right', true);
    txt('SCL1 (Pin 5)', 116, 194 + 2.5, 4.9, SLATE, 'right', true);
  } else {
    txt('GPIO4 (Pin 7)', 116, Y_DQ + 2.5, 5.0, SLATE, 'right', true);
    txt('1W-A (3.3V)', 116, Y_DQ + 13, 4.4, MUTED, 'right', false);
  }
  txt('GND (Pin 9)', 116, Y_GND + 2.5, 5.0, DARK_MUTED, 'right', true);

  // -------------------------------------------------------------------------
  // RIGHT BLOCK: J8 SCREW TERMINAL (x = 708..806)
  // -------------------------------------------------------------------------
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.roundedRect(sx(708), sy(18), sw(98), sh(232), 1.0, 1.0, 'FD');
  const isRevA = spec.id === 'rev_a_baseline';
  doc.setFillColor(isRevA ? 15 : 21, isRevA ? 23 : 128, isRevA ? 42 : 61);
  doc.rect(sx(708), sy(18), sw(98), sh(20), 'F');
  txt(isRevA ? 'J8 (1W-A)' : 'J6 (1W-A)', 757, 31, 5.8, [255, 255, 255], 'center', true);

  const j8Pins: { py: number; label: string; col: [number, number, number] }[] = [
    { py: Y_J8_P1, label: isRevA ? '1: +3V3' : is5V ? '3: +5V' : '3: +3V3', col: is5V ? RED : ORANGE },
    { py: Y_DQ, label: isRevA ? '2: DQ' : '4: DQ', col: TEAL },
    { py: Y_GND, label: isRevA ? '3: GND' : '5: GND', col: DARK_MUTED },
  ];
  for (const p of j8Pins) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.circle(sx(722), sy(p.py), 1.25, 'FD');
    wire(718.5, p.py - 3.5, 725.5, p.py + 3.5, MUTED, 0.22);
    txt(p.label, 733, p.py + 2.5, 5.2, p.col, 'left', true);
  }

  // Common GND return wire (dead-straight from Pi Pin 9 to J8 Pin 3)
  wire(122, Y_GND, 708, Y_GND, DARK_MUTED, 0.34);

  // =========================================================================
  // TOPOLOGY 1: REV A BASELINE (3.3V Shared F2 PTC + 4.7k + PESD5V0)
  // =========================================================================
  if (spec.id === 'rev_a_baseline') {
    // Power bus (+3V3 -> F2 Shared PTC -> J8 Pin 1)
    wire(122, Y_3V3, 275, Y_3V3, ORANGE, 0.38);
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.setLineWidth(0.35);
    doc.rect(sx(275), sy(Y_3V3 - 9), sw(66), sh(18), 'FD');
    wire(281, Y_3V3 + 7, 335, Y_3V3 - 7, ORANGE, 0.32);
    txt('F2 (Shared A+B!)', 308, Y_3V3 - 15, 5.3, CRIMSON, 'center', true);
    txt('100mA PTC (Ext)', 308, Y_3V3 + 18, 4.8, CRIMSON, 'center', false);
    wire(341, Y_3V3, 708, Y_3V3, ORANGE, 0.38);
    txt('+3V3_SENS (Feeds BOTH Buses - No Rev Block!)', 524, Y_3V3 - 10, 4.9, CRIMSON, 'center', true);

    // DQ line + R27 4.7k pull-up + R29 100R + D15 PESD5V0
    wire(122, Y_DQ, 385, Y_DQ, SLATE, 0.36);
    dot(204, Y_3V3, ORANGE);
    dot(204, Y_DQ, SLATE);
    resV(204, Y_3V3, Y_DQ, 'R27', '4.7k', 'l');
    resH(385, 470, Y_DQ, 'R29', '100 Ohm 0805');
    wire(470, Y_DQ, 708, Y_DQ, SLATE, 0.36);

    dot(564, Y_DQ, SLATE);
    dot(564, Y_GND, DARK_MUTED);
    diodeV(564, Y_DQ, Y_GND, 'tvs', false, 'D15', 'PESD5V0 (Ext)', 'r');
  }

  // =========================================================================
  // TOPOLOGY 2: HARDENED 3.3V BASIC (Per-Bus 22R + Dual B5819W + C25)
  // =========================================================================
  else if (spec.id === 'hardened_3v3_basic') {
    // Clean Pi +3V3 rail up to R64 (R61 and D24 tap BEFORE R64!)
    wire(122, Y_3V3, 415, Y_3V3, ORANGE, 0.38);
    resH(415, 505, Y_3V3, 'R64 (Per-Bus)', '22 Ohm 0.5W', ORANGE, DARK_MUTED);
    wire(505, Y_3V3, 708, Y_3V3, ORANGE, 0.38);
    txt('+3V3_1WA (150mA Short)', 606, Y_3V3 - 10, 4.8, ORANGE, 'center', true);

    // Local C25 decoupling on +3V3_1WA
    dot(634, Y_3V3, ORANGE);
    capV(634, Y_3V3, 142, 'C25', '100nF', 'r');
    gnd(634, 142);

    // DQ line: R61 2.2k pull-up + D24/D25 B5819W clamp + R63 100R 0.5W
    wire(122, Y_DQ, 460, Y_DQ, SLATE, 0.36);
    dot(200, Y_3V3, ORANGE);
    dot(200, Y_DQ, SLATE);
    resV(200, Y_3V3, Y_DQ, 'R61', '2.2k', 'l');

    dot(320, Y_3V3, ORANGE);
    dot(320, Y_DQ, SLATE);
    dot(320, Y_GND, DARK_MUTED);
    diodeV(320, Y_3V3, Y_DQ, 'up', true, 'D24', 'B5819W', 'r');
    diodeV(320, Y_DQ, Y_GND, 'up', true, 'D25', 'B5819W', 'r');

    resH(460, 550, Y_DQ, 'R63', '100 Ohm 0.5W');
    wire(550, Y_DQ, 708, Y_DQ, SLATE, 0.36);
  }

  // =========================================================================
  // TOPOLOGY 3 & 4: 5V MOSFET LEVEL SHIFTERS (BSS138 / GEMINI REV B 2N7002)
  // =========================================================================
  else if (spec.id === 'bss138_5v_shifter' || spec.id === 'gemini_rev_b_2n7002') {
    const isRevB = spec.id === 'gemini_rev_b_2n7002';

    // Top +5V Power Path: +5V -> D26 (SS14) -> (+5V_1W_PROT tap for R62!) -> R64 (100R 0.5W) -> C25 -> J8 Pin 1
    wire(122, Y_5V, 345, Y_5V, RED, 0.38);
    diodeH(345, 412, Y_5V, true, 'D26', 'SS14 40V', RED);
    wire(412, Y_5V, 492, Y_5V, RED, 0.38);
    resH(492, 578, Y_5V, 'R64', '100 Ohm 0.5W', RED, DARK_MUTED);
    wire(578, Y_5V, 708, Y_5V, RED, 0.38);
    txt('+5V_1WA', 652, Y_5V - 10, 4.9, RED, 'center', true);

    // Local C25 decoupling on +5V_1WA
    dot(646, Y_5V, RED);
    capV(646, Y_5V, 100, 'C25', '100nF', 'r');
    gnd(646, 100);

    // Pi-side +3V3 rail & R61 pull-up (going UPWARD to +3V3!)
    wire(122, Y_3V3, isRevB ? 226 : 326, Y_3V3, ORANGE, 0.36);
    dot(164, Y_3V3, ORANGE);
    dot(164, Y_DQ, SLATE);
    resV(164, Y_3V3, Y_DQ, 'R61', isRevB ? '10k' : '4.7k', 'l');

    // Gate Bias Network (Real IEEE symbols!)
    if (isRevB) {
      // +5V -> R60 (1.5k) -> V_G_1W (3.92V) -> D23 (1N4148W) -> +3V3, plus C24 (100nF) to GND
      dot(226, Y_5V, RED);
      resV(226, Y_5V, 96, 'R60', '1.5k', 'l');
      dot(226, 96, TEAL);
      diodeV(226, 96, Y_3V3, 'down', false, 'D23', '1N4148W', 'l');
      dot(226, Y_3V3, ORANGE);

      // Shared V_G_1W bus to Q19 Gate + C24 decoupling cap
      wire(226, 96, 326, 96, TEAL, 0.36);
      wire(326, 96, 326, Y_DQ - 30, TEAL, 0.36);
      txt('V_G_1W = 3.92V', 280, 88, 5.0, TEAL, 'center', true);
      dot(266, 96, TEAL);
      capV(266, 96, 130, 'C24', '100nF', 'r');
      gnd(266, 130);
    } else {
      // BSS138: +3V3 directly to Q19 Gate
      wire(326, Y_3V3, 326, Y_DQ - 30, ORANGE, 0.36);
      txt('+3V3 Gate', 246, Y_3V3 - 8, 5.0, ORANGE, 'center', true);
    }

    // Signal bus: GPIO4 -> Q19 -> R62 (2.2k tapped ahead of R64!) -> D24/D25 (1N4148W) -> R63 (100R 0.5W) -> J8 DQ
    wire(122, Y_DQ, 300, Y_DQ, SLATE, 0.36);
    nmosH(326, Y_DQ, 'Q19', isRevB ? '2N7002 (Basic)' : 'BSS138 (Ext)');
    wire(352, Y_DQ, 594, Y_DQ, SLATE, 0.36);

    // R62 2.2k pull-up tapped at +5V_1W_PROT (D26 cathode, ahead of R64!)
    dot(444, Y_5V, RED);
    dot(444, Y_DQ, SLATE);
    resV(444, Y_5V, Y_DQ, 'R62', '2.2k', 'l');

    // Dual 4 pF 1N4148W ESD steering clamps (D24 up to +5V bulk rail, D25 up from GND bus)
    dot(514, Y_DQ, SLATE);
    dot(514, Y_GND, DARK_MUTED);
    rail(514, 126, '+5V', RED);
    diodeV(514, 126, Y_DQ, 'up', false, 'D24', '1N4148W', 'r');
    diodeV(514, Y_DQ, Y_GND, 'up', false, 'D25', '1N4148W', 'r');

    // Field DQ series surge/fault limiter R63 (100 Ohm 0.5W)
    resH(594, 678, Y_DQ, 'R63', '100 Ohm 0.5W');
    wire(678, Y_DQ, 708, Y_DQ, SLATE, 0.36);
  }

  // =========================================================================
  // TOPOLOGY 5: DS2482S-100 I2C HARDWARE BRIDGE
  // =========================================================================
  else {
    // Per-bus +5V -> D26 SS14 -> R64 100R 0.5W -> C25 -> J8 Pin 1
    wire(122, Y_5V, 345, Y_5V, RED, 0.38);
    diodeH(345, 412, Y_5V, true, 'D26', 'SS14 40V', RED);
    wire(412, Y_5V, 492, Y_5V, RED, 0.38);
    resH(492, 578, Y_5V, 'R64', '100 Ohm 0.5W', RED, DARK_MUTED);
    wire(578, Y_5V, 708, Y_5V, RED, 0.38);
    txt('+5V_1WA', 652, Y_5V - 10, 4.9, RED, 'center', true);

    dot(646, Y_5V, RED);
    capV(646, Y_5V, 100, 'C25', '100nF', 'r');
    gnd(646, 100);

    // U10 VCC tap from +5V & GND drop to GND bus
    dot(295, Y_5V, RED);
    wire(295, Y_5V, 295, 130, RED, 0.34);
    wire(295, 218, 295, Y_GND, DARK_MUTED, 0.34);
    dot(295, Y_GND, DARK_MUTED);

    // I2C bus lines into U10
    wire(122, 166, 212, 166, SLATE, 0.34);
    wire(122, 194, 212, 194, SLATE, 0.34);
    txt('SDA1', 167, 160, 4.8, DARK_MUTED, 'center', false);
    txt('SCL1', 167, 188, 4.8, DARK_MUTED, 'center', false);

    // U10 IC Block
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.35);
    doc.roundedRect(sx(212), sy(130), sw(182), sh(88), 1.0, 1.0, 'FD');
    doc.setFillColor(51, 65, 85);
    doc.rect(sx(212), sy(130), sw(182), sh(19), 'F');
    txt('U10: DS2482S-100', 303, 142.5, 5.4, [255, 255, 255], 'center', true);
    txt('SDA', 218, 168.5, 4.5, DARK_MUTED, 'left', true);
    txt('SCL', 218, 196.5, 4.5, DARK_MUTED, 'left', true);
    txt('1W', 388, 188.5, 4.6, TEAL, 'right', true);
    txt('I2C -> 1-Wire Master', 303, 166, 4.9, SLATE, 'center', true);
    txt('Active Pull-Up (APU)', 303, 182, 4.8, GREEN, 'center', true);
    txt('Not at JLCPCB SMT', 303, 200, 4.8, CRIMSON, 'center', true);

    // Output 1W -> D24/D25 1N4148W -> R63 100R 0.5W -> J8 DQ
    wire(394, Y_DQ, 594, Y_DQ, SLATE, 0.36);
    dot(498, Y_DQ, SLATE);
    dot(498, Y_GND, DARK_MUTED);
    rail(498, 126, '+5V', RED);
    diodeV(498, 126, Y_DQ, 'up', false, 'D24', '1N4148W', 'r');
    diodeV(498, Y_DQ, Y_GND, 'up', false, 'D25', '1N4148W', 'r');

    resH(594, 678, Y_DQ, 'R63', '100 Ohm 0.5W');
    wire(678, Y_DQ, 708, Y_DQ, SLATE, 0.36);
  }
}

export function buildOneWirePdfDoc(
  selectedTopology: OneWireTopologyId,
  params: OneWireSimParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toISOString().slice(0, 10);

  const activeSpec = ONEWIRE_TOPOLOGY_SPECS[selectedTopology];
  const activeRes = evaluateOneWireBus(selectedTopology, params);
  const revACost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.rev_a_baseline, batchSize);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 04. 1-Wire Bus & Protection Evaluation Report', margin, 8.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafe(subtitle), pageW - margin, 8.3, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafe(`Rev B (Gemini Version) | 5 V Diode-Biased 2N7002 + SS14/100 Ohm | Generated ${dateStr}`),
      margin,
      pageH - 6.8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.8, { align: 'right' });
  };

  const evalRows = ONEWIRE_TOPOLOGY_ORDER.map((id) => {
    const spec = ONEWIRE_TOPOLOGY_SPECS[id];
    const norm30 = evaluateOneWireBus(id, { ...params, cableLengthM: 30, activeFault: 'none' });
    const shortA = evaluateOneWireBus(id, { ...params, activeFault: 'vdd_short_a' });
    const dq12v = evaluateOneWireBus(id, { ...params, activeFault: 'dq_to_12v' });
    const vdd12v = evaluateOneWireBus(id, { ...params, activeFault: 'vdd_to_12v' });
    const unitCost = oneWirePerBoardCostEur(spec, batchSize);
    const savings = revACost - unitCost;
    return { spec, norm30, shortA, dq12v, vdd12v, unitCost, savings };
  });

  // =========================================================================
  // PAGE 1: Executive Overview, Bench Parameters, Matrix, Cable Sweep & BOM
  // =========================================================================
  addHeaderFooter(1, 9, 'Executive Summary & Cable Reach Sweep');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.2);
  doc.setTextColor(15, 23, 42);
  doc.text('1-Wire Bus Interface & ESD/Surge Protection (Rev A -> Rev B Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Active: ${activeSpec.shortName} | Batch: ${batchSize}x JLCPCB | Cable: ${params.cableLengthM} m (${CABLE_CAP_PF_PER_M[params.cableType].pfPerM} pF/m) | ${params.sensorCount}x DS18B20 | Pi 5V: ${params.piSupplyV.toFixed(2)} V`
    ),
    margin,
    26.8
  );

  let y = 33.5;

  // Section 1: Bench Parameters
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Configured Boiler-Room Bench Conditions', margin, y);
  y += 3.2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 18, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(30, 41, 59);
  doc.text(pdfSafe(`Cable Run / Type: ${params.cableLengthM} m | ${CABLE_CAP_PF_PER_M[params.cableType].label}`), margin + 3, y + 5.5);
  doc.text(pdfSafe(`Sensors & Rail:   ${params.sensorCount}× DS18B20 powered (1.5 mA/ea) | Pi 5V = ${params.piSupplyV.toFixed(2)} V | Ambient = ${params.ambientTempC} °C`), margin + 3, y + 10.5);
  doc.text(pdfSafe(`Live Result:      V_Pi(15us) = ${activeRes.vPiAtSampleV.toFixed(2)} V | VDD = ${activeRes.sensorVddV.toFixed(2)} V | Reach = ${activeRes.maxReachM.toFixed(0)} m | ${activeRes.faultVerdict}`), margin + 3, y + 15.5);
  y += 23.5;

  // Section 2: Master 5-Architecture Comparison Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. All 5 1-Wire Architectures Comparison (${batchSize}x JLCPCB Batch, Both Buses)`, margin, y);
  y += 3.2;

  const colW = [42, 14, 17, 19, 24, 24, 20, 22];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  ['Architecture', 'Bus V', 'Reach', 'V_Pi 30m', 'VDD Short A', '+12V DQ', '+12V VDD', `Cost ${batchSize}x`].forEach((h, i) => {
    doc.text(h, cx + 1.5, y + 4.4);
    cx += colW[i];
  });
  y += 6.4;

  doc.setFontSize(7.1);
  for (const r of evalRows) {
    const isSel = r.spec.id === selectedTopology;
    doc.setFillColor(isSel ? 236 : 255, isSel ? 253 : 255, isSel ? 245 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.8, 'FD');
    const vals = [
      pdfSafe(r.spec.shortName),
      `${r.spec.busVoltageV.toFixed(1)}V`,
      `${r.norm30.maxReachM.toFixed(0)} m`,
      `${r.norm30.vPiAtSampleV.toFixed(2)} V`,
      `${r.shortA.faultVerdict} (${r.shortA.faultSupplyDrawMa}mA)`,
      `${r.dq12v.faultVerdict} (${r.dq12v.piGpioPeakV.toFixed(1)}V)`,
      r.vdd12v.faultVerdict,
      `EUR ${r.unitCost.toFixed(2)}`,
    ];
    cx = margin;
    vals.forEach((v, idx) => {
      doc.setFont(idx === 0 ? 'helvetica' : 'courier', idx === 0 || idx === 7 ? 'bold' : 'normal');
      if (v.startsWith('FAIL')) doc.setTextColor(190, 18, 60);
      else if (v.startsWith('PASS')) doc.setTextColor(4, 120, 87);
      else doc.setTextColor(15, 23, 42);
      doc.text(v, cx + 1.5, y + 4.6);
      cx += colW[idx];
    });
    y += 6.8;
  }
  y += 7;

  // Section 3: Vector Cable Reach Sweep Chart (2 m -> 80 m)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Sampled Pi GPIO Voltage (15 us Read-1 Slot) vs. Cable Length (2 m - 80 m)', margin, y);
  y += 3.2;

  const sweep = computeCableLengthSweep(params);
  const chartX = margin + 12;
  const chartY = y + 1.5;
  const chartW = contentW - 16;
  const chartH = 44;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const xPos = (m: number) => chartX + ((m - 2) / 78) * chartW;
  const yPos = (v: number) => chartY + ((5.0 - Math.max(0, Math.min(5.0, v))) / 5.0) * chartH;

  // Below 2.0 V fail zone
  const y2v = yPos(2.0);
  doc.setFillColor(254, 242, 242);
  doc.rect(chartX, y2v, chartW, chartY + chartH - y2v, 'F');
  doc.setDrawColor(225, 29, 72);
  doc.setLineWidth(0.32);
  doc.line(chartX, y2v, chartX + chartW, y2v);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  for (const vt of [0, 1, 2, 3, 4, 5]) {
    const ty = yPos(vt);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    if (vt !== 2) doc.line(chartX, ty, chartX + chartW, ty);
    doc.setTextColor(vt === 2 ? 190 : 100, vt === 2 ? 18 : 116, vt === 2 ? 60 : 139);
    doc.text(`${vt}V`, margin + 1, ty + 1.6);
  }
  for (const xm of [10, 20, 30, 40, 50, 60, 70, 80]) {
    const tx = xPos(xm);
    doc.setDrawColor(241, 245, 249);
    doc.line(tx, chartY, tx, chartY + chartH);
    doc.setTextColor(100, 116, 139);
    doc.text(`${xm}m`, tx - 3, chartY + chartH + 3.8);
  }

  const series: { key: keyof typeof sweep[number]; rgb: [number, number, number]; width: number; label: string }[] = [
    { key: 'ds2482DqV', rgb: [100, 116, 139], width: 0.45, label: 'DS2482 APU' },
    { key: 'revBPiV', rgb: [5, 150, 105], width: 0.75, label: 'Rev B Gemini' },
    { key: 'hardened3v3PiV', rgb: [217, 119, 6], width: 0.45, label: 'Hardened 3.3V' },
    { key: 'revAPiV', rgb: [225, 29, 72], width: 0.55, label: 'Rev A Baseline' },
  ];
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(s.width);
    for (let i = 1; i < sweep.length; i++) {
      doc.line(
        xPos(sweep[i - 1].lengthM),
        yPos(Number(sweep[i - 1][s.key])),
        xPos(sweep[i].lengthM),
        yPos(Number(sweep[i][s.key]))
      );
    }
  }
  // Active cable length line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.32);
  doc.line(xPos(params.cableLengthM), chartY, xPos(params.cableLengthM), chartY + chartH);

  let legX = chartX;
  const legY = chartY + chartH + 7.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(0.8);
    doc.line(legX, legY - 1, legX + 4.5, legY - 1);
    doc.setTextColor(...s.rgb);
    doc.text(s.label, legX + 6, legY);
    legX += 38;
  }

  y = legY + 6;

  // Section 4: Active BOM Summary on Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`4. Active Topology Dual-Bus BOM: ${activeSpec.shortName}`), margin, y);
  y += 3.0;

  const bomCol = [34, 74, 24, 26, 24];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(255, 255, 255);
  let bx = margin;
  ['Ref', 'Component', 'Package', 'LCSC Class', 'Est. Cost'].forEach((h, i) => {
    doc.text(h, bx + 2, y + 4.0);
    bx += bomCol[i];
  });
  y += 5.8;

  for (const item of activeSpec.bom) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.6, 'FD');
    bx = margin;
    const vals = [
      pdfSafe(item.designator),
      pdfSafe(item.part),
      pdfSafe(item.packageType),
      item.jlcpcbClass,
      `EUR ${item.unitCostEur.toFixed(2)}`,
    ];
    vals.forEach((v, i) => {
      doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(v, bx + 2, y + 3.9);
      bx += bomCol[i];
    });
    y += 5.6;
  }

  // =========================================================================
  // PAGES 2-6: ONE DEDICATED 1-WIRE OPTION PER PAGE — FIXED EXACT Y COORDINATES
  // =========================================================================
  const Y_VERDICT = 32.0;
  const Y_CIRCUIT_TITLE = 42.5;
  const Y_CIRCUIT_BOX = 44.5;
  const CIRCUIT_H = 60.0;
  const Y_BOM_TITLE = 109.5;
  const Y_BOM_TABLE = 111.5;
  const Y_CORNER_TITLE = 158.5;
  const Y_CORNER_BOX = 160.5;
  const CORNER_BOX_H = 21.5;
  const Y_PROCON_TITLE = 187.5;
  const Y_PROCON_BODY = 190.5;
  const Y_SEC_TITLE = 246.5;
  const Y_SEC_BOX = 249.0;
  const SEC_BOX_H = 33.5;

  evalRows.forEach(({ spec, norm30, shortA, dq12v, vdd12v, unitCost, savings }, idx) => {
    doc.addPage();
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    const c2 = oneWirePerBoardCostEur(spec, 2);
    const c5 = oneWirePerBoardCostEur(spec, 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.4);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(`Option 0${idx + 1}: ${spec.name}`), margin, 21.0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      pdfSafe(
        `Cost (${batchSize}x): EUR ${unitCost.toFixed(2)}/bd (2x EUR ${c2.toFixed(2)} | 5x EUR ${c5.toFixed(2)})  |  ${savings > 0 ? `Saves EUR ${savings.toFixed(2)}/bd` : savings < 0 ? `+EUR ${Math.abs(savings).toFixed(2)}/bd` : 'Baseline'}  |  Max Reach: ${norm30.maxReachM.toFixed(0)} m`
      ),
      margin,
      26.4
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.9);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.verdict), contentW).slice(0, 2), margin, Y_VERDICT);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text(
      spec.id === 'rev_a_baseline'
        ? '1. Authentic IEEE Circuit Schematic (Channel A | GPIO 4 / Rev A J8 Shown)'
        : '1. Authentic IEEE Circuit Schematic (Channel A | GPIO 4 / J6 Pins 3-5 Shown)',
      margin,
      Y_CIRCUIT_TITLE
    );
    drawPdfOneWireSchematic(doc, spec, margin, Y_CIRCUIT_BOX, contentW, CIRCUIT_H);

    // 2. Dual-Bus BOM Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. Dual-Bus Bill of Materials (${spec.partCountBothBuses} SMD Parts | Fee EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})`, margin, Y_BOM_TITLE);

    let by = Y_BOM_TABLE;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, by, contentW, 5.0, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(255, 255, 255);
    let bxp = margin;
    ['Ref', 'Component', 'Pkg', 'Class', 'Cost'].forEach((h, i) => {
      doc.text(h, bxp + 1.5, by + 3.5);
      bxp += bomCol[i];
    });
    by += 5.0;

    for (const item of spec.bom.slice(0, 8)) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, by, contentW, 4.7, 'FD');
      bxp = margin;
      [pdfSafe(item.designator), pdfSafe(item.part), pdfSafe(item.packageType), item.jlcpcbClass, `EUR ${item.unitCostEur.toFixed(2)}`].forEach(
        (v, i) => {
          doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
          doc.setFontSize(6.3);
          doc.setTextColor(15, 23, 42);
          doc.text(v, bxp + 1.5, by + 3.3);
          bxp += bomCol[i];
        }
      );
      by += 4.7;
    }

    // 3. Verified Stress Corner Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Simulated Timing & Fault Corner Metrics', margin, Y_CORNER_TITLE);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_CORNER_BOX, contentW, CORNER_BOX_H, 'FD');
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(30, 41, 59);
    doc.text(
      pdfSafe(`30 m LiYCY (5x DS18B20): V_Pi(15us) = ${norm30.vPiAtSampleV.toFixed(2)} V | VDD = ${norm30.sensorVddV.toFixed(2)} V | V_OL = ${norm30.vOlAtPiV.toFixed(2)} V | Noise Margin = ${norm30.noiseMarginV.toFixed(2)} V`),
      margin + 3,
      Y_CORNER_BOX + 5.5
    );
    doc.text(
      pdfSafe(`1W-A VDD Dead Short:     ${shortA.faultVerdict} | Surge/Draw = ${shortA.faultSupplyDrawMa} mA | Bus B Online = ${shortA.busBAliveDuringFault ? 'YES' : 'NO (KILLED!)'}`),
      margin + 3,
      Y_CORNER_BOX + 11.2
    );
    doc.text(
      pdfSafe(`+12 V Miswire Corners:   On DQ -> ${dq12v.faultVerdict} (Pi GPIO ${dq12v.piGpioPeakV.toFixed(2)} V, ${dq12v.piGpioInjectMa.toFixed(1)} mA) | On VDD -> ${vdd12v.faultVerdict}`),
      margin + 3,
      Y_CORNER_BOX + 16.9
    );

    // 4. Pros & Cons 2-column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('4. Engineering Pros & Cons', margin, Y_PROCON_TITLE);
    const halfW = (contentW - 4) / 2;

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.rect(margin, Y_PROCON_BODY, halfW, 50, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(6, 95, 70);
    doc.text('Strengths', margin + 3, Y_PROCON_BODY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(30, 41, 59);
    let py = Y_PROCON_BODY + 8.5;
    for (const p of spec.pros.slice(0, 5)) {
      const lines = doc.splitTextToSize(pdfSafe(`+ ${p}`), halfW - 6).slice(0, 2);
      doc.text(lines, margin + 3, py);
      py += lines.length * 3.3 + 1.1;
      if (py > Y_PROCON_BODY + 47) break;
    }

    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(253, 164, 175);
    doc.rect(margin + halfW + 4, Y_PROCON_BODY, halfW, 50, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(159, 18, 57);
    doc.text('Limitations & Risks', margin + halfW + 7, Y_PROCON_BODY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(30, 41, 59);
    let cy2 = Y_PROCON_BODY + 8.5;
    for (const c of spec.cons.slice(0, 5)) {
      const lines = doc.splitTextToSize(pdfSafe(`- ${c}`), halfW - 6).slice(0, 2);
      doc.text(lines, margin + halfW + 7, cy2);
      cy2 += lines.length * 3.3 + 1.1;
      if (cy2 > Y_PROCON_BODY + 47) break;
    }

    // 5. Fail-Safe & Software Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('5. Fail-Safe Behaviour & Linux Driver Integration', margin, Y_SEC_TITLE);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_SEC_BOX, contentW, SEC_BOX_H, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.9);
    doc.setTextColor(15, 23, 42);
    doc.text('Fail-Safe Profile:', margin + 3, Y_SEC_BOX + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.failSafeProfile), contentW - 6).slice(0, 2), margin + 3, Y_SEC_BOX + 9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Software & Pi 5 Compatibility:', margin + 3, Y_SEC_BOX + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.softwareNote), contentW - 6).slice(0, 2), margin + 3, Y_SEC_BOX + 23.5);
  });

  // =========================================================================
  // PAGE 7: 3-WAY ENGINEERING SCORECARD & CONCLUSION
  // =========================================================================
  doc.addPage();
  addHeaderFooter(7, 9, '3-Way Engineering Scorecard & Recommendation');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('3-Way Scorecard: Rev A Baseline vs. Rev B (Gemini) vs. DS2482 Bridge', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Objective decision matrix across reach, EMI margin, fault isolation, Pi 5 readiness, and JLCPCB BOM cost.', margin, 26.8);

  let cy7 = 34;
  const sCols = [56, 42, 44, 40];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, cy7, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(255, 255, 255);
  let sx = margin;
  ['Criterion', 'Rev A Baseline', 'Rev B (Gemini)', 'DS2482 Bridge'].forEach((h, i) => {
    doc.text(h, sx + 2, cy7 + 4.6);
    sx += sCols[i];
  });
  cy7 += 6.8;

  for (const row of ONEWIRE_SCORECARD_ROWS) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cy7, contentW, 11.2, 'FD');
    doc.setFillColor(236, 253, 245);
    doc.rect(margin + sCols[0] + sCols[1], cy7, sCols[2], 11.2, 'FD');

    sx = margin;
    const vals = [row.criterion, row.revA, row.revB, row.ds2482];
    vals.forEach((v, i) => {
      doc.setFont(i === 0 ? 'helvetica' : 'courier', i === 0 || i === 2 ? 'bold' : 'normal');
      doc.setFontSize(6.6);
      if (i === 1 && v.startsWith('FAIL')) doc.setTextColor(190, 18, 60);
      else if (i === 2) doc.setTextColor(4, 120, 87);
      else doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(pdfSafe(v), sCols[i] - 3).slice(0, 2), sx + 1.8, cy7 + 4.3);
      sx += sCols[i];
    });
    cy7 += 11.2;
  }

  cy7 += 8;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.rect(margin, cy7, contentW, 28, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(6, 78, 59);
  doc.text('Final Recommendation: Adopt 1-Wire Rev B (Gemini Version)', margin + 4, cy7 + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const recText = pdfSafe(
    'Operating both field buses natively at 5 V via Basic 2N7002 (Q19/Q20) + shared temperature-tracked gate bias (R60/D23/C24 = 3.90 V) + per-bus SS14 and 100 Ohm 0.5 W resistors fixes all 6 Rev A defects, extends boiler-room cable reach from 22 m to 60 m, blocks +12 V / +24 V miswiring from Pi GPIOs and rails, isolates Bus A/B shorts at 47 mA (0.22 W), and cuts JLCPCB feeder fees from EUR 5.60 to EUR 0.00.'
  );
  doc.text(doc.splitTextToSize(recText, contentW - 8), margin + 4, cy7 + 12);

  // =========================================================================
  // PAGE 8: KICAD READY BOM & PINOUT MAP (1-Wire Rev B - Gemini Version)
  // =========================================================================
  doc.addPage();
  addHeaderFooter(8, 9, 'KiCad Production BOM & GPIO 4/17 / J6 (DG350-08P) Pinout');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad Manufacturing Package: 1-Wire Bus Rev B (Gemini Version)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  const totalQty = ONEWIRE_REV_B_BOM.reduce((s, r) => s + r.qty, 0);
  doc.text(
    pdfSafe(`${totalQty} SMD Parts (${ONEWIRE_REV_B_BOM.length} Basic Lines) | EUR 0.18/board | EUR 0.00 Feeder Fee | GPIO 4 & GPIO 17`),
    margin,
    26.8
  );

  let ky = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Dual-Bus KiCad Component Table (100% JLCPCB Basic)', margin, ky);
  ky += 3.2;

  const kCols = [30, 10, 22, 18, 16, 86];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ky, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let kx = margin;
  ['RefDes', 'Qty', 'Value', 'Pkg', 'LCSC', 'Engineering Function'].forEach((h, i) => {
    doc.text(h, kx + 1.5, ky + 4.1);
    kx += kCols[i];
  });
  ky += 6.0;

  for (const r of ONEWIRE_REV_B_BOM) {
    const pLines = doc.splitTextToSize(pdfSafe(r.purpose), kCols[5] - 3).slice(0, 2);
    const rowH = Math.max(7.2, pLines.length * 3.4 + 2.5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');
    kx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(r.refDes), kCols[0] - 2).slice(0, 2), kx + 1.5, ky + 3.8);
    kx += kCols[0];
    doc.setFont('courier', 'normal');
    doc.text(String(r.qty), kx + 2, ky + 3.8);
    kx += kCols[1];
    doc.setFont('courier', 'bold');
    doc.setTextColor(8, 145, 178);
    doc.text(pdfSafe(r.value), kx + 1.5, ky + 3.8);
    kx += kCols[2];
    doc.setFont('courier', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(r.footprint), kx + 1.5, ky + 3.8);
    kx += kCols[3];
    doc.setTextColor(4, 120, 87);
    doc.text(r.lcsc, kx + 1.5, ky + 3.8);
    kx += kCols[4];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(pLines, kx + 1.5, ky + 3.6);
    ky += rowH;
  }

  ky += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Raspberry Pi GPIO, Shared V_G Bias & J6 (DG350-3.5-08P) Screw Terminal Pinout', margin, ky);
  ky += 3.2;

  const pCols = [34, 34, 30, 84];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, ky, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let px = margin;
  ['Block', 'Pin / Signal', 'Net Name', 'Connection & Protection Note'].forEach((h, i) => {
    doc.text(h, px + 1.5, ky + 4.0);
    px += pCols[i];
  });
  ky += 5.8;

  for (const p of ONEWIRE_REV_B_PINOUT) {
    const nLines = doc.splitTextToSize(pdfSafe(p.connectionNote), pCols[3] - 3).slice(0, 2);
    const rowH = Math.max(7.2, nLines.length * 3.4 + 2.5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');
    px = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(p.device), px + 1.5, ky + 3.8);
    px += pCols[0];
    doc.setFont('courier', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafe(p.pin), px + 1.5, ky + 3.8);
    px += pCols[1];
    doc.setFont('courier', 'bold');
    doc.setTextColor(8, 145, 178);
    doc.text(pdfSafe(p.netName), px + 1.5, ky + 3.8);
    px += pCols[2];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(nLines, px + 1.5, ky + 3.6);
    ky += rowH;
  }

  // =========================================================================
  // PAGE 9: HARDWARE AUDIT HISTORY & DEFECT RESOLUTION LOG
  // =========================================================================
  doc.addPage();
  addHeaderFooter(9, 9, 'Hardware Audit & Revision History (Rev A -> Rev B)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('1-Wire Bus Hardware Audit History (Rev A -> Rev B Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Complete log of all 7 electrical, timing, and manufacturing defects found in Rev A / Drafts and resolved in Rev B.', margin, 26.8);

  let ay = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Design Iteration Progression', margin, ay);
  ay += 3.2;

  for (const step of ONEWIRE_REVISION_STEPS) {
    const isFinal = step.status === 'Finalized';
    doc.setFillColor(isFinal ? 236 : 248, isFinal ? 253 : 250, isFinal ? 245 : 252);
    doc.setDrawColor(isFinal ? 110 : 203, isFinal ? 231 : 213, isFinal ? 183 : 225);
    doc.rect(margin, ay, contentW, 11.5, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(isFinal ? 4 : 15, isFinal ? 120 : 23, isFinal ? 87 : 42);
    doc.text(pdfSafe(`${step.rev} (${step.status}) - ${step.title}`), margin + 3, ay + 4.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(step.summary), contentW - 6).slice(0, 2), margin + 3, ay + 8.1);
    ay += 13.0;
  }

  ay += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Detailed Defect & Resolution Audit Table (1W-01 through 1W-07)', margin, ay);
  ay += 3.2;

  const aCols = [14, 34, 48, 48, 38];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ay, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(255, 255, 255);
  let rx = margin;
  ['ID', 'Area', 'Defect Found', 'Rev B Hardware Fix', 'Verified Impact'].forEach((h, i) => {
    doc.text(h, rx + 1.5, ay + 4.1);
    rx += aCols[i];
  });
  ay += 6.0;

  for (const row of ONEWIRE_AUDIT_DEFECTS) {
    const fLines = doc.splitTextToSize(pdfSafe(row.finding), aCols[2] - 2.5).slice(0, 4);
    const fixLines = doc.splitTextToSize(pdfSafe(row.fixInRevB), aCols[3] - 2.5).slice(0, 4);
    const impLines = doc.splitTextToSize(pdfSafe(row.measuredImpact), aCols[4] - 2.5).slice(0, 4);
    const maxL = Math.max(fLines.length, fixLines.length, impLines.length, 2);
    const rowH = maxL * 3.1 + 3.2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ay, contentW, rowH, 'FD');

    rx = margin + 1.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(8, 145, 178);
    doc.text(row.id, rx, ay + 3.8);
    rx += aCols[0];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(row.area), aCols[1] - 2.5).slice(0, 3), rx, ay + 3.6);
    rx += aCols[1];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.7);
    doc.setTextColor(159, 18, 57);
    doc.text(fLines, rx, ay + 3.4);
    rx += aCols[2];

    doc.setTextColor(30, 41, 59);
    doc.text(fixLines, rx, ay + 3.4);
    rx += aCols[3];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(4, 120, 87);
    doc.text(impLines, rx, ay + 3.4);

    ay += rowH;
  }

  return doc;
}

export function exportOneWirePdfReport(
  selectedTopology: OneWireTopologyId,
  params: OneWireSimParams,
  batchSize: 2 | 5
): void {
  const doc = buildOneWirePdfDoc(selectedTopology, params, batchSize);
  doc.save(`CoSTOS-1Wire-Bus-RevB-Gemini-${selectedTopology}.pdf`);
}
