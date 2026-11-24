import { jsPDF } from 'jspdf';
import {
  OUTPUT_TOPOLOGY_ORDER,
  OUTPUT_TOPOLOGY_SPECS,
  OutputSimParams,
  OutputTopologyId,
  OutputTopologySpec,
  RELAY_LOAD_PRESETS,
  computeOutputFreqSweep,
  evaluateOutputStage,
  outputPerBoardCostEur,
} from '../physics/model';
import { OUTPUT_REV_B_BOM, OUTPUT_REV_B_PINOUT } from '../components/KicadBomPinout';
import { OUTPUT_SCORECARD_ROWS } from '../components/ConclusionScorecard';
import { OUTPUT_AUDIT_DEFECTS, OUTPUT_REVISION_STEPS } from '../components/AuditHistory';

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
    .replace(/←/g, '<-')
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

/** Authentic IEEE Normalized Vector Schematic Engine (820 x 265 grid) for Pages 2-6 */
function drawPdfOutputSchematic(
  doc: jsPDF,
  spec: OutputTopologySpec,
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
  const DARK: [number, number, number] = [51, 65, 85];
  const RED: [number, number, number] = [185, 28, 28];
  const TEAL: [number, number, number] = [14, 116, 144];
  const GREEN: [number, number, number] = [4, 120, 87];
  const CRIMSON: [number, number, number] = [190, 18, 60];
  const BLUE: [number, number, number] = [29, 78, 216];

  const wire = (x1: number, y1: number, x2: number, y2: number, col = SLATE, lw = 0.32) => {
    doc.setDrawColor(col[0], col[1], col[2]);
    doc.setLineWidth(lw);
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };
  const dot = (x: number, y: number, col = SLATE) => {
    doc.setFillColor(col[0], col[1], col[2]);
    doc.circle(sx(x), sy(y), 0.54, 'F');
  };
  const txt = (
    str: string,
    x: number,
    y: number,
    size = 5.0,
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
    wire(x, y, x, y + 6, SLATE, 0.32);
    wire(x - 7, y + 6, x + 7, y + 6, SLATE, 0.38);
    wire(x - 4.5, y + 9.5, x + 4.5, y + 9.5, SLATE, 0.32);
    wire(x - 2, y + 13, x + 2, y + 13, SLATE, 0.26);
  };
  const rail = (x: number, y: number, label: string, col = RED) => {
    wire(x - 8, y, x + 8, y, col, 0.45);
    txt(label, x, y - 3.5, 4.7, col, 'center', true);
  };
  const resH = (x1: number, x2: number, y: number, label: string, val: string, col = SLATE) => {
    const mid = (x1 + x2) / 2;
    const rw = Math.min(34, (x2 - x1) * 0.65);
    const rx = mid - rw / 2;
    wire(x1, y, rx, y, col, 0.32);
    wire(rx + rw, y, x2, y, col, 0.32);
    const seg = rw / 6;
    const amp = 4.6;
    wire(rx, y, rx + seg * 0.5, y - amp);
    wire(rx + seg * 0.5, y - amp, rx + seg * 1.5, y + amp);
    wire(rx + seg * 1.5, y + amp, rx + seg * 2.5, y - amp);
    wire(rx + seg * 2.5, y - amp, rx + seg * 3.5, y + amp);
    wire(rx + seg * 3.5, y + amp, rx + seg * 4.5, y - amp);
    wire(rx + seg * 4.5, y - amp, rx + seg * 5.5, y + amp);
    wire(rx + seg * 5.5, y + amp, rx + rw, y);
    txt(label, mid, y - 8.5, 4.9, SLATE, 'center', true);
    txt(val, mid, y + 12.5, 4.5, DARK, 'center', false);
  };
  const resV = (x: number, y1: number, y2: number, label: string, val: string, side: 'l' | 'r' = 'r') => {
    const mid = (y1 + y2) / 2;
    const rh = Math.min(24, Math.max(15, (y2 - y1) * 0.58));
    const ry = mid - rh / 2;
    wire(x, y1, x, ry);
    wire(x, ry + rh, x, y2);
    const seg = rh / 6;
    const amp = 4.2;
    wire(x, ry, x + amp, ry + seg * 0.5);
    wire(x + amp, ry + seg * 0.5, x - amp, ry + seg * 1.5);
    wire(x - amp, ry + seg * 1.5, x + amp, ry + seg * 2.5);
    wire(x + amp, ry + seg * 2.5, x - amp, ry + seg * 3.5);
    wire(x - amp, ry + seg * 3.5, x + amp, ry + seg * 4.5);
    wire(x + amp, ry + seg * 4.5, x - amp, ry + seg * 5.5);
    wire(x - amp, ry + seg * 5.5, x, ry + rh);
    const tx = side === 'r' ? x + 8 : x - 8;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, mid - 1.5, 4.8, SLATE, align, true);
    txt(val, tx, mid + 7, 4.4, DARK, align, false);
  };
  const diodeV = (
    x: number,
    y1: number,
    y2: number,
    schottky: boolean,
    tvs: boolean,
    label: string,
    val: string,
    side: 'l' | 'r' = 'r'
  ) => {
    const cy = (y1 + y2) / 2;
    wire(x, y1, x, cy - 5);
    wire(x, cy + 5, x, y2);
    doc.setDrawColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.3);
    if (tvs) {
      doc.triangle(sx(x - 5), sy(cy - 5), sx(x + 5), sy(cy - 5), sx(x), sy(cy), 'FD');
      doc.triangle(sx(x - 5), sy(cy + 5), sx(x + 5), sy(cy + 5), sx(x), sy(cy), 'FD');
      wire(x - 6, cy, x + 6, cy);
    } else {
      doc.triangle(sx(x - 5), sy(cy + 5), sx(x + 5), sy(cy + 5), sx(x), sy(cy - 5), 'FD');
      wire(x - 5, cy - 5, x + 5, cy - 5, SLATE, 0.38);
      if (schottky) {
        wire(x - 5, cy - 5, x - 5, cy - 2.5);
        wire(x + 5, cy - 5, x + 5, cy - 7.5);
      }
    }
    const tx = side === 'r' ? x + 8.5 : x - 8.5;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, cy - 1.5, 4.8, SLATE, align, true);
    txt(val, tx, cy + 7.2, 4.3, DARK, align, false);
  };
  const bjtV = (x: number, y: number, pnp: boolean, label: string, val: string, side: 'l' | 'r' = 'r') => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.26);
    doc.circle(sx(x - 1), sy(y), sw(11), 'FD');
    wire(x - 15, y, x - 4.5, y);
    wire(x - 4.5, y - 6.5, x - 4.5, y + 6.5, SLATE, 0.44);
    wire(x - 4.5, y - 3.5, x + 4.5, y - 9);
    wire(x + 4.5, y - 9, x + 4.5, y - 14);
    wire(x - 4.5, y + 3.5, x + 4.5, y + 9);
    wire(x + 4.5, y + 9, x + 4.5, y + 14);
    doc.setFillColor(SLATE[0], SLATE[1], SLATE[2]);
    if (pnp) {
      doc.triangle(sx(x - 3.5), sy(y - 4), sx(x + 1.5), sy(y - 8.5), sx(x + 2.2), sy(y - 4), 'FD');
    } else {
      doc.triangle(sx(x + 4), sy(y + 8.5), sx(x - 1), sy(y + 8), sx(x + 1.5), sy(y + 4), 'FD');
    }
    const tx = side === 'r' ? x + 13 : x - 16;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, y - 1.5, 4.8, SLATE, align, true);
    txt(val, tx, y + 7, 4.3, TEAL, align, false);
  };
  const nmosV = (x: number, y: number, label: string, val: string, side: 'l' | 'r' = 'r') => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.26);
    doc.circle(sx(x - 1), sy(y), sw(11), 'FD');
    wire(x - 15, y + 3, x - 6, y + 3);
    wire(x - 6, y - 6, x - 6, y + 6, SLATE, 0.4);
    wire(x - 3, y - 7, x - 3, y - 3, SLATE, 0.4);
    wire(x - 3, y - 1.5, x - 3, y + 1.5, SLATE, 0.4);
    wire(x - 3, y + 3, x - 3, y + 7, SLATE, 0.4);
    wire(x - 3, y - 5, x + 4.5, y - 5);
    wire(x + 4.5, y - 5, x + 4.5, y - 14);
    wire(x - 3, y, x + 4.5, y);
    wire(x + 4.5, y, x + 4.5, y + 14);
    wire(x - 3, y + 5, x + 4.5, y + 5);
    const tx = side === 'r' ? x + 13 : x - 16;
    const align = side === 'r' ? 'left' : 'right';
    txt(label, tx, y - 1.5, 4.8, SLATE, align, true);
    txt(val, tx, y + 7, 4.3, TEAL, align, false);
  };

  const isRevB = spec.id === 'gemini_rev_b_pushpull';
  const isH3 = spec.id === 'rev_a_h3_baseline';
  const isTc = spec.id === 'rev_a_tc4427_fallback';
  const isUcc = spec.id === 'ucc27524_integrated';
  const isOpto = spec.id === 'opto_pc817_isolated';

  // Horizontal divider between Top (Pump PWM) and Bottom (Relay Driver)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.24);
  doc.line(sx(12), sy(172), sx(808), sy(172));
  txt('A. PUMP1 PWM (GPIO18 + WD_OK -> J2) & RB1/FB1', 16, 13, 4.9, SLATE, 'left', true);
  txt('B. REL1 LOW-SIDE DRIVER (GPIO25 + +5V_REL -> J4)', 16, 184, 4.9, SLATE, 'left', true);

  // LEFT TOP: PI + WD BLOCK
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.roundedRect(sx(14), sy(22), sw(94), sh(136), 0.9, 0.9, 'FD');
  doc.setFillColor(15, 23, 42);
  doc.rect(sx(14), sy(22), sw(94), sh(17), 'F');
  txt('PI + WATCHDOG', 61, 33, 4.9, [255, 255, 255], 'center', true, false);
  txt('PWM1 G18', 103, 66, 4.8, SLATE, 'right', true);
  txt('WD_OK', 103, 114, 4.8, TEAL, 'right', true);
  txt('RB1 G6', 103, 146, 4.5, DARK, 'right', false);

  // RIGHT TOP: J2 PUMP1 BLOCK
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(sx(712), sy(22), sw(94), sh(136), 0.9, 0.9, 'FD');
  doc.setFillColor(15, 23, 42);
  doc.rect(sx(712), sy(22), sw(94), sh(17), 'F');
  txt('J2 (PUMP1)', 759, 33, 5.0, [255, 255, 255], 'center', true);
  [
    { py: 70, lbl: '1: PWM', col: RED },
    { py: 108, lbl: '2: GND', col: DARK },
    { py: 142, lbl: '3: FB1', col: TEAL },
  ].forEach((p) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42);
    doc.circle(sx(724), sy(p.py), 1.05, 'FD');
    txt(p.lbl, 734, p.py + 2, 4.8, p.col, 'left', true);
  });
  wire(692, 108, 712, 108, DARK);
  gnd(692, 108);

  // FB1 protection note box right bottom of top half
  wire(668, 142, 712, 142, TEAL);
  doc.setFillColor(isRevB || isUcc || isOpto ? 236 : 255, isRevB || isUcc || isOpto ? 253 : 241, isRevB || isUcc || isOpto ? 245 : 242);
  doc.setDrawColor(isRevB || isUcc || isOpto ? 110 : 253, isRevB || isUcc || isOpto ? 231 : 164, isRevB || isUcc || isOpto ? 183 : 175);
  doc.rect(sx(520), sy(128), sw(152), sh(26), 'FD');
  txt(
    isRevB || isUcc || isOpto ? 'FB1: 2.2k + 2x4148W + 22k' : 'FB1: PESD5V0(Ext) + 4.7k',
    596,
    139,
    4.5,
    isRevB || isUcc || isOpto ? GREEN : CRIMSON,
    'center',
    true
  );
  txt(
    isRevB || isUcc || isOpto ? '-> C9 10nF -> G23 (+24V OK)' : '-> 10k/1nF -> G23 (6.8V)',
    596,
    149,
    4.2,
    DARK,
    'center',
    false
  );

  // ---- TOP HALF CORE BY TOPOLOGY ----
  if (isRevB) {
    wire(108, 64, 150, 64);
    dot(130, 64);
    resV(130, 64, 96, 'R7', '100k', 'l');
    gnd(130, 96);
    resH(150, 194, 64, 'R33', '10k');
    bjtV(210, 64, false, 'Q4', '3904', 'r');
    wire(108, 112, 195, 112, TEAL);
    nmosV(210, 109, 'Q5', '2N7002', 'r');
    wire(214.5, 78, 214.5, 95);
    gnd(214.5, 123);

    wire(214.5, 50, 214.5, 44);
    resH(214.5, 274, 44, 'R35', '4.7k');
    wire(274, 44, 316, 44);
    dot(294, 44);
    resV(294, 18, 44, 'R36', '4.7k', 'l');
    rail(294, 18, '+V_DRV', RED);
    bjtV(332, 44, true, 'Q8', '3906', 'r');
    wire(336.5, 18, 336.5, 30, RED);
    rail(336.5, 18, '+V_DRV', RED);

    wire(336.5, 58, 336.5, 70);
    dot(336.5, 70);
    resV(336.5, 70, 108, 'R37', '2.2k', 'l');
    gnd(336.5, 108);
    wire(336.5, 70, 404, 70);
    wire(404, 48, 404, 96);
    dot(404, 70);

    bjtV(420, 48, false, 'Q6', '3904', 'r');
    wire(424.5, 18, 424.5, 34, RED);
    rail(424.5, 18, '+V_DRV', RED);
    bjtV(420, 96, true, 'Q7', '3906', 'r');
    gnd(424.5, 110);
    wire(424.5, 62, 424.5, 82);
    dot(424.5, 70);

    wire(424.5, 70, 560, 70);
    dot(498, 70);
    rail(498, 34, '+V_DRV', RED);
    diodeV(498, 34, 70, false, false, 'D4a', '4148W', 'r');
    diodeV(498, 70, 104, false, false, 'D4b', '4148W', 'r');
    gnd(498, 104);

    resH(560, 622, 70, 'R9 (OUTSIDE)', '220R 0.5W', RED);
    wire(622, 70, 712, 70, RED, 0.36);
    dot(654, 70, RED);
    resV(654, 70, 104, 'R38', '4.7k', 'l');
    gnd(654, 104);

    txt('RB1 (G6): R31 22k / R32 10k + D18 4148W -> +3V3', 310, 152, 4.5, GREEN, 'center', true);
  } else if (isH3) {
    wire(108, 64, 150, 64);
    resH(150, 194, 64, 'R33', '10k');
    bjtV(210, 64, false, 'Q4', '3904', 'r');
    wire(108, 112, 195, 112, TEAL);
    nmosV(210, 109, 'Q5', 'AO3400', 'r');
    wire(214.5, 78, 214.5, 95);
    gnd(214.5, 123);

    wire(214.5, 50, 214.5, 44);
    resH(214.5, 274, 44, 'R35', '2.7k');
    wire(274, 44, 324, 44);
    resV(296, 18, 44, 'R36', '2.2k', 'l');
    rail(296, 18, '+V_DRV', RED);
    bjtV(340, 44, true, 'Q6', '3906', 'r');
    wire(344.5, 18, 344.5, 30, RED);
    rail(344.5, 18, '+V_DRV', RED);

    wire(344.5, 58, 344.5, 70);
    wire(344.5, 70, 404, 70);
    resH(404, 462, 70, 'R9', '100R 0.5W');
    wire(462, 70, 712, 70, RED, 0.36);

    dot(522, 70, CRIMSON);
    wire(522, 70, 522, 82, CRIMSON);
    bjtV(517.5, 96, false, 'Q7 (!)', 'OUTSIDE R9', 'r');
    gnd(522, 110);

    dot(634, 70);
    diodeV(634, 70, 106, false, true, 'D4', 'SMBJ13A', 'r');
    gnd(634, 106);

    txt('DEFECT: Q7 outside R9 blows on +12/+24V | RB1 12k/8.2k >3.3V!', 306, 152, 4.5, CRIMSON, 'center', true);
  } else {
    wire(108, 64, 210, 64);
    wire(108, 112, 210, 112, TEAL);
    if (isTc) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(sx(210), sy(52), sw(94), sh(72), 0.9, 0.9, 'FD');
      txt('U4: 74LVC1G08', 257, 84, 4.6, SLATE, 'center', true);
      txt('AND (Ext)', 257, 98, 4.3, CRIMSON, 'center', false);
      wire(304, 86, 352, 86);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.roundedRect(sx(352), sy(44), sw(126), sh(84), 0.9, 0.9, 'FD');
      txt('U6: TC4427A', 415, 74, 4.9, BLUE, 'center', true);
      txt('1.5A Push-Pull', 415, 88, 4.4, DARK, 'center', false);
      txt('Ext | 22V Max', 415, 102, 4.3, CRIMSON, 'center', false);
      wire(478, 70, 530, 70);
    } else if (isUcc) {
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(CRIMSON[0], CRIMSON[1], CRIMSON[2]);
      doc.roundedRect(sx(210), sy(44), sw(252), sh(82), 0.9, 0.9, 'FD');
      txt('U6: TI UCC27524DR (Extended)', 336, 72, 5.0, CRIMSON, 'center', true);
      txt('ENA/ENB Internal Pull-UP = UNSAFE!', 336, 88, 4.5, CRIMSON, 'center', true);
      txt('Open WD_OK leaves pump RUNNING', 336, 103, 4.3, DARK, 'center', false);
      wire(462, 70, 530, 70);
    } else {
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(180, 83, 9);
      doc.roundedRect(sx(210), sy(44), sw(252), sh(82), 0.9, 0.9, 'FD');
      txt('U11: PC817C / EL817C Opto (Ext)', 336, 72, 5.0, [146, 64, 14], 'center', true);
      txt('t_fall ~13-18 us (FAILS <=4 us Rule)', 336, 88, 4.5, CRIMSON, 'center', true);
      txt('Pump already has internal optocoupler', 336, 103, 4.3, DARK, 'center', false);
      wire(462, 70, 530, 70);
    }
    resH(530, 592, 70, 'R9', '100R 0.5W');
    wire(592, 70, 712, 70, RED, 0.36);
    dot(634, 70);
    diodeV(634, 70, 106, false, !isOpto, 'D4', isOpto ? '4148W' : 'SMBJ13A', 'r');
    gnd(634, 106);
    txt(
      isTc ? 'RB1 (G6): 12k / 8.2k (UNCLAMPED! >3.3V on Pi 5)' : 'RB1 (G6): 22k / 10k + D18 4148W -> +3V3',
      310,
      152,
      4.5,
      isTc ? CRIMSON : GREEN,
      'center',
      true
    );
  }

  // ================= BOTTOM HALF: RELAY / SSR DRIVER (y = 190..258) =================
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(sx(14), sy(192), sw(94), sh(62), 0.9, 0.9, 'FD');
  txt('GPIO 25', 61, 212, 4.9, SLATE, 'center', true);
  txt('REL1 (Pin 22)', 61, 226, 4.4, DARK, 'center', false);
  txt('+5V_REL (Q12)', 61, 244, 4.3, GREEN, 'center', true);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(sx(712), sy(192), sw(94), sh(62), 0.9, 0.9, 'FD');
  doc.setFillColor(15, 23, 42);
  doc.rect(sx(712), sy(192), sw(94), sh(16), 'F');
  txt('J4 (REL1)', 759, 203, 4.8, [255, 255, 255], 'center', true);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.circle(sx(724), sy(220), 1.0, 'FD');
  txt('1: +5V_REL', 734, 222, 4.5, RED, 'left', true);
  doc.circle(sx(724), sy(242), 1.0, 'FD');
  txt('2: OUT', 734, 244, 4.5, SLATE, 'left', true);

  // +5V_REL bus
  rail(486, 200, '+5V_REL', RED);
  wire(486, 200, 676, 200, RED, 0.36);
  wire(676, 200, 676, 220, RED, 0.36);
  wire(676, 220, 712, 220, RED, 0.36);

  // Gate path
  wire(108, 224, 174, 224);
  dot(140, 224);
  resV(140, 224, 248, 'R16', '100k', 'l');
  gnd(140, 248);
  resH(174, 224, 224, 'R15', isRevB || isOpto ? '10k' : '100R');
  wire(224, 224, 354, 224);

  if (isRevB || isOpto) {
    dot(288, 224, GREEN);
    bjtV(283.5, 238, false, 'Q2L', '3904', 'l');
    gnd(288, 252);
    wire(268, 238, 258, 238, GREEN);
    wire(258, 238, 258, 250, GREEN);
    wire(258, 250, 373.5, 250, GREEN);

    nmosV(369, 221, 'Q2', 'AO3400A', 'r');
    wire(373.5, 235, 373.5, 250);
    dot(373.5, 250, GREEN);
    resH(373.5, 434, 250, 'R2S', '4.7R 0.5W', GREEN);
    gnd(434, 250);
  } else {
    nmosV(369, 221, 'Q2', 'AO3400A', 'r');
    gnd(373.5, 235);
    txt(isUcc ? 'PTC 200mA (~1.5A surge)' : 'NO CURRENT LIMIT (>15A!)', 286, 248, 4.4, CRIMSON, 'center', true);
  }

  // Drain -> D6 Flyback -> R17/D7 -> J4 Pin 2 OUT
  wire(373.5, 207, 456, 207);
  wire(456, 207, 456, 242);
  wire(456, 242, 712, 242);
  dot(536, 200, RED);
  dot(536, 242);
  diodeV(536, 200, 242, isRevB || isUcc || isOpto, false, 'D6', isRevB || isUcc || isOpto ? 'SS14 1A' : '4148W', 'r');
  dot(624, 200, RED);
  dot(624, 242);
  resV(624, 200, 222, 'R17', '1k', 'r');
  diodeV(624, 222, 242, false, false, 'D7', 'LED', 'r');
}

export function buildOutputStagePdfDoc(
  selectedTopology: OutputTopologyId,
  params: OutputSimParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toISOString().slice(0, 10);

  const activeSpec = OUTPUT_TOPOLOGY_SPECS[selectedTopology];
  const activeRes = evaluateOutputStage(selectedTopology, params);
  const revAH3Cost = outputPerBoardCostEur(OUTPUT_TOPOLOGY_SPECS.rev_a_h3_baseline, batchSize);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 05. Pump PWM Output & Relay Driver Stage Report', margin, 8.3);
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
      pdfSafe(`Rev B (Gemini Version) | Class-B Push-Pull Inside R9 + Active-Limited REL1 | Generated ${dateStr}`),
      margin,
      pageH - 6.8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.8, { align: 'right' });
  };

  const evalRows = OUTPUT_TOPOLOGY_ORDER.map((id) => {
    const spec = OUTPUT_TOPOLOGY_SPECS[id];
    const nom = evaluateOutputStage(id, { ...params, activeFault: 'none' });
    const gndShort = evaluateOutputStage(id, { ...params, activeFault: 'pwm_gnd_short' });
    const pwm24 = evaluateOutputStage(id, { ...params, activeFault: 'pwm_24v_miswire' });
    const relShort = evaluateOutputStage(id, { ...params, activeFault: 'rel_dead_short' });
    const unitCost = outputPerBoardCostEur(spec, batchSize);
    const savings = revAH3Cost - unitCost;
    return { spec, nom, gndShort, pwm24, relShort, unitCost, savings };
  });

  // =========================================================================
  // PAGE 1: Executive Summary, Matrix, Edge-Time Sweep Chart & Active BOM
  // =========================================================================
  addHeaderFooter(1, 9, 'Executive Summary & PWM Edge Compliance');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Pump PWM Output Stage & Relay Driver (Rev A -> Rev B Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Active: ${activeSpec.shortName} | Batch: ${batchSize}x JLCPCB | +V_DRV: ${params.vDrvV.toFixed(1)} V | PWM: ${params.pwmFreqHz} Hz | ${RELAY_LOAD_PRESETS[params.relayLoad].label}`
    ),
    margin,
    26.8
  );

  let y = 33.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Configured Boiler-Room Bench Conditions', margin, y);
  y += 3.2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 18, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfSafe(`PWM Drive:   ${params.pwmFreqHz} Hz (T/500 = ${activeRes.edgeLimitUs.toFixed(2)} us) | +V_DRV = ${params.vDrvV.toFixed(1)} V | Load = ${params.pumpLoadMa.toFixed(1)} mA (${params.cableLengthM} m)`),
    margin + 3,
    y + 5.5
  );
  doc.text(
    pdfSafe(`Relay & Env: ${RELAY_LOAD_PRESETS[params.relayLoad].label} | Ambient = ${params.ambientTempC} °C | Fault = ${params.activeFault.toUpperCase()}`),
    margin + 3,
    y + 10.5
  );
  doc.text(
    pdfSafe(`Live Result: V_PWM = ${activeRes.vHighAtPumpV.toFixed(2)} V | t_edge = ${Math.max(activeRes.tRiseUs, activeRes.tFallUs).toFixed(2)} us | RB1 = ${activeRes.readbackPiV.toFixed(2)} V | REL Short = ${activeRes.relayShortCurrentMa >= 1000 ? '>15A' : `${activeRes.relayShortCurrentMa}mA`} | ${activeRes.faultVerdict}`),
    margin + 3,
    y + 15.5
  );
  y += 23.5;

  // Section 2: Master 5-Option Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. All 5 Output Stage Architectures Compared (${batchSize}x JLCPCB Batch)`, margin, y);
  y += 3.2;

  const colW = [41, 15, 16, 17, 17, 19, 18, 17, 22];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  ['Architecture', 'V_PWM', 't_edge', 'Shoot', 'RB1 G6', '+24V PWM', 'J4 Short', 'Fees', `Cost ${batchSize}x`].forEach((h, i) => {
    doc.text(h, cx + 1.4, y + 4.4);
    cx += colW[i];
  });
  y += 6.4;

  doc.setFontSize(6.9);
  for (const r of evalRows) {
    const isSel = r.spec.id === selectedTopology;
    doc.setFillColor(isSel ? 236 : 255, isSel ? 253 : 255, isSel ? 245 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.8, 'FD');
    const vals = [
      pdfSafe(r.spec.shortName),
      `${r.nom.vHighAtPumpV.toFixed(2)}V`,
      `${Math.max(r.nom.tRiseUs, r.nom.tFallUs).toFixed(2)}us`,
      `${r.nom.shootThroughMa}mA`,
      `${r.nom.readbackPiV.toFixed(2)}V`,
      r.pwm24.faultVerdict,
      r.relShort.faultVerdict,
      `EUR ${r.spec.jlcpcbFeederFeeEur.toFixed(0)}`,
      `EUR ${r.unitCost.toFixed(2)}`,
    ];
    cx = margin;
    vals.forEach((v, idx) => {
      doc.setFont(idx === 0 ? 'helvetica' : 'courier', idx === 0 || idx === 8 ? 'bold' : 'normal');
      if (v === 'FAIL' || (idx === 4 && !r.nom.readbackSafe)) doc.setTextColor(190, 18, 60);
      else if (v === 'PASS') doc.setTextColor(4, 120, 87);
      else if (v === 'MARGINAL') doc.setTextColor(180, 83, 9);
      else doc.setTextColor(15, 23, 42);
      doc.text(v, cx + 1.4, y + 4.6);
      cx += colW[idx];
    });
    y += 6.8;
  }
  y += 7;

  // Section 3: Vector Edge-Time Compliance Chart (100 - 1200 Hz)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. PWM Edge Time (us) vs. Frequency (100 - 1200 Hz) & Grundfos/Wilo T/500 Limit', margin, y);
  y += 3.2;

  const sweep = computeOutputFreqSweep(params);
  const chartX = margin + 12;
  const chartY = y + 1.5;
  const chartW = contentW - 16;
  const chartH = 42;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const xPos = (f: number) => chartX + ((f - 100) / 1100) * chartW;
  const yPos = (us: number) => chartY + ((16 - Math.min(16, Math.max(0, us))) / 16) * chartH;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.3);
  for (const ut of [0, 4, 8, 12, 16]) {
    const ty = yPos(ut);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(chartX, ty, chartX + chartW, ty);
    doc.setTextColor(100, 116, 139);
    doc.text(`${ut}us`, margin + 1, ty + 1.5);
  }
  for (const xf of [100, 300, 500, 750, 1000, 1200]) {
    const tx = xPos(xf);
    doc.setDrawColor(241, 245, 249);
    doc.line(tx, chartY, tx, chartY + chartH);
    doc.setTextColor(100, 116, 139);
    doc.text(`${xf}Hz`, tx - 4, chartY + chartH + 3.6);
  }

  const series: { key: keyof typeof sweep[number]; rgb: [number, number, number]; width: number; label: string }[] = [
    { key: 'limitUs', rgb: [225, 29, 72], width: 0.55, label: 'T/500 Limit' },
    { key: 'revBEdgeUs', rgb: [5, 150, 105], width: 0.78, label: 'Rev B Push-Pull' },
    { key: 'revAH3EdgeUs', rgb: [217, 119, 6], width: 0.5, label: 'Rev A H3' },
    { key: 'pc817EdgeUs', rgb: [100, 116, 139], width: 0.45, label: 'PC817C Opto' },
  ];
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(s.width);
    for (let i = 1; i < sweep.length; i++) {
      doc.line(
        xPos(sweep[i - 1].freqHz),
        yPos(Number(sweep[i - 1][s.key])),
        xPos(sweep[i].freqHz),
        yPos(Number(sweep[i][s.key]))
      );
    }
  }
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.32);
  doc.line(xPos(params.pwmFreqHz), chartY, xPos(params.pwmFreqHz), chartY + chartH);

  let legX = chartX;
  const legY = chartY + chartH + 7.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(0.8);
    doc.line(legX, legY - 1, legX + 4.5, legY - 1);
    doc.setTextColor(...s.rgb);
    doc.text(s.label, legX + 6, legY);
    legX += 40;
  }

  y = legY + 6;

  // Section 4: Active BOM Summary on Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`4. Active Topology BOM Summary: ${activeSpec.shortName}`), margin, y);
  y += 3.0;

  const bomCol = [34, 74, 24, 26, 24];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 5.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  let bx = margin;
  ['Ref', 'Component', 'Package', 'LCSC Class', 'Est. Cost'].forEach((h, i) => {
    doc.text(h, bx + 2, y + 3.9);
    bx += bomCol[i];
  });
  y += 5.6;

  for (const item of activeSpec.bom.slice(0, 8)) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.3, 'FD');
    bx = margin;
    [pdfSafe(item.designator), pdfSafe(item.part), pdfSafe(item.packageType), item.jlcpcbClass, `EUR ${item.unitCostEur.toFixed(2)}`].forEach(
      (v, i) => {
        doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
        doc.setFontSize(6.6);
        doc.setTextColor(15, 23, 42);
        doc.text(v, bx + 2, y + 3.7);
        bx += bomCol[i];
      }
    );
    y += 5.3;
  }

  // =========================================================================
  // PAGES 2-6: ONE DEDICATED OPTION PER PAGE
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

  evalRows.forEach(({ spec, nom, gndShort, pwm24, relShort, unitCost, savings }, idx) => {
    doc.addPage();
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    const c2 = outputPerBoardCostEur(spec, 2);
    const c5 = outputPerBoardCostEur(spec, 5);

    const optTitle = pdfSafe(`Option 0${idx + 1}: ${spec.name}`);
    doc.setFont('helvetica', 'bold');
    let titleSize = 11.2;
    doc.setFontSize(titleSize);
    while (doc.getTextWidth(optTitle) > contentW && titleSize > 8.5) {
      titleSize -= 0.3;
      doc.setFontSize(titleSize);
    }
    doc.setTextColor(15, 23, 42);
    doc.text(optTitle, margin, 21.0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(
      pdfSafe(
        `Cost (${batchSize}x): EUR ${unitCost.toFixed(2)}/bd (2x EUR ${c2.toFixed(2)} | 5x EUR ${c5.toFixed(2)})  |  ${savings > 0 ? `Saves EUR ${savings.toFixed(2)}/bd vs H3` : savings < 0 ? `+EUR ${Math.abs(savings).toFixed(2)}/bd vs H3` : 'Rev A H3 Baseline'}  |  t_edge: ${Math.max(nom.tRiseUs, nom.tFallUs).toFixed(2)} us`
      ),
      margin,
      26.4
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.verdict), contentW).slice(0, 2), margin, Y_VERDICT);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Authentic IEEE Schematic (Top: Pump PWM J2 | Bottom: Relay Driver J4)', margin, Y_CIRCUIT_TITLE);
    drawPdfOutputSchematic(doc, spec, margin, Y_CIRCUIT_BOX, contentW, CIRCUIT_H);

    // 2. BOM Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. Bill of Materials (${spec.partCount} SMD Parts | Feeder Fee EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})`, margin, Y_BOM_TITLE);

    let by = Y_BOM_TABLE;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, by, contentW, 4.9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    let bxp = margin;
    ['Ref', 'Component', 'Pkg', 'Class', 'Cost'].forEach((h, i) => {
      doc.text(h, bxp + 1.5, by + 3.4);
      bxp += bomCol[i];
    });
    by += 4.9;

    for (const item of spec.bom.slice(0, 8)) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, by, contentW, 4.6, 'FD');
      bxp = margin;
      [pdfSafe(item.designator), pdfSafe(item.part), pdfSafe(item.packageType), item.jlcpcbClass, `EUR ${item.unitCostEur.toFixed(2)}`].forEach(
        (v, i) => {
          doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(15, 23, 42);
          doc.text(v, bxp + 1.5, by + 3.2);
          bxp += bomCol[i];
        }
      );
      by += 4.6;
    }

    // 3. Stress Corner Metrics
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Simulated Timing, Shoot-Through & Wiring Fault Corners', margin, Y_CORNER_TITLE);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_CORNER_BOX, contentW, CORNER_BOX_H, 'FD');
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(30, 41, 59);
    doc.text(
      pdfSafe(`Nominal (${params.pwmFreqHz}Hz, ${params.vDrvV.toFixed(1)}V): V_PWM=${nom.vHighAtPumpV.toFixed(2)}V | t_r=${nom.tRiseUs.toFixed(2)}us t_f=${nom.tFallUs.toFixed(2)}us | Shoot=${nom.shootThroughMa}mA | RB1=${nom.readbackPiV.toFixed(2)}V`),
      margin + 3,
      Y_CORNER_BOX + 5.3
    );
    doc.text(
      pdfSafe(`J2 PWM Faults:     GND Short -> ${gndShort.faultVerdict} | +24V Miswire -> ${pwm24.faultVerdict} (Pi G6 Peak = ${pwm24.faultPiGpioPeakV.toFixed(1)} V)`),
      margin + 3,
      Y_CORNER_BOX + 11.0
    );
    doc.text(
      pdfSafe(`J4 REL1 Driver:    V_out(${RELAY_LOAD_PRESETS[params.relayLoad].currentMa}mA)=${nom.relayVoutV.toFixed(2)}V | Dead Short -> ${relShort.faultVerdict} (${relShort.relayShortCurrentMa >= 1000 ? '>15 A Pi Brownout!' : `${relShort.relayShortCurrentMa} mA, P_Q2=${relShort.q2ShortPowerW.toFixed(2)}W`})`),
      margin + 3,
      Y_CORNER_BOX + 16.7
    );

    // 4. Pros & Cons
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
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
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    let py = Y_PROCON_BODY + 8.5;
    for (const p of spec.pros.slice(0, 6)) {
      const lines = doc.splitTextToSize(pdfSafe(`+ ${p}`), halfW - 6).slice(0, 2);
      doc.text(lines, margin + 3, py);
      py += lines.length * 3.2 + 1.0;
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
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    let cy2 = Y_PROCON_BODY + 8.5;
    for (const c of spec.cons.slice(0, 6)) {
      const lines = doc.splitTextToSize(pdfSafe(`- ${c}`), halfW - 6).slice(0, 2);
      doc.text(lines, margin + halfW + 7, cy2);
      cy2 += lines.length * 3.2 + 1.0;
      if (cy2 > Y_PROCON_BODY + 47) break;
    }

    // 5. Fail-Safe & Software
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5. Fail-Safe Behaviour & Software Contract', margin, Y_SEC_TITLE);
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
    doc.text('Software & Pinout Integration:', margin + 3, Y_SEC_BOX + 19.5);
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
  doc.text('3-Way Scorecard: Rev A TC4427 vs. Rev A H3 vs. Rev B (Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Objective comparison across PWM edges, shoot-through, +24 V fault survival, Pi 5 safety, and JLCPCB BOM cost.', margin, 26.8);

  let cy7 = 34;
  const sCols = [56, 40, 42, 44];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, cy7, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  let sx7 = margin;
  ['Criterion', 'Rev A TC4427', 'Rev A H3', 'Rev B (Gemini)'].forEach((h, i) => {
    doc.text(h, sx7 + 2, cy7 + 4.6);
    sx7 += sCols[i];
  });
  cy7 += 6.8;

  for (const row of OUTPUT_SCORECARD_ROWS) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cy7, contentW, 11.2, 'FD');
    doc.setFillColor(236, 253, 245);
    doc.rect(margin + sCols[0] + sCols[1] + sCols[2], cy7, sCols[3], 11.2, 'FD');
    sx7 = margin;
    [row.criterion, row.tc4427, row.revAH3, row.revBGemini].forEach((v, i) => {
      doc.setFont(i === 0 ? 'helvetica' : 'courier', i === 0 || i === 3 ? 'bold' : 'normal');
      doc.setFontSize(6.4);
      if ((i === 1 || i === 2) && v.startsWith('FAIL')) doc.setTextColor(190, 18, 60);
      else if (i === 3) doc.setTextColor(4, 120, 87);
      else doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(pdfSafe(v), sCols[i] - 3).slice(0, 2), sx7 + 1.8, cy7 + 4.3);
      sx7 += sCols[i];
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
  doc.text('Final Recommendation: Adopt Pump PWM & Relay Stage Rev B (Gemini Version)', margin + 4, cy7 + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.text(
    doc.splitTextToSize(
      pdfSafe(
        'Class-B complementary push-pull (Q6 MMBT3904 + Q7 MMBT3906) behind R9 (220 Ohm 1206 0.5 W) eliminates shoot-through and Q7 blowouts, hits 0.24 us edges (16x T/500 margin), clamps RB1/FB1 safely for Pi 5 RP1, upgrades D6 to SS14 1 A, adds 138 mA active foldback on REL1/REL2, and cuts JLCPCB feeder fees to EUR 0.00 (100% Basic parts).'
      ),
      contentW - 8
    ),
    margin + 4,
    cy7 + 12
  );

  // =========================================================================
  // PAGE 8: KICAD READY BOM & PINOUT MAP
  // =========================================================================
  doc.addPage();
  addHeaderFooter(8, 9, 'KiCad Production BOM & GPIO 18/23/6/25/5 Pinout');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.0);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad Manufacturing Package: Output Stage Rev B (Gemini Version)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  const totalQty = OUTPUT_REV_B_BOM.reduce((s, r) => s + r.qty, 0);
  doc.text(
    pdfSafe(`${totalQty} SMD Parts (${OUTPUT_REV_B_BOM.length} Basic Lines) | EUR 0.56/board | EUR 0.00 Feeder Fee | GPIO 18, 23, 6, 25, 5`),
    margin,
    26.8
  );

  let ky = 32.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Production KiCad Component Table (100% JLCPCB Basic)', margin, ky);
  ky += 2.8;

  const kCols = [34, 9, 22, 16, 15, 86];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ky, contentW, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(255, 255, 255);
  let kx = margin;
  ['RefDes', 'Qty', 'Value', 'Pkg', 'LCSC', 'Engineering Function'].forEach((h, i) => {
    doc.text(h, kx + 1.4, ky + 3.7);
    kx += kCols[i];
  });
  ky += 5.4;

  for (const r of OUTPUT_REV_B_BOM) {
    const pLines = doc.splitTextToSize(pdfSafe(r.purpose), kCols[5] - 3).slice(0, 2);
    const rowH = Math.max(6.2, pLines.length * 3.0 + 2.0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');
    kx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(r.refDes), kCols[0] - 2).slice(0, 2), kx + 1.3, ky + 3.2);
    kx += kCols[0];
    doc.setFont('courier', 'normal');
    doc.text(String(r.qty), kx + 1.8, ky + 3.2);
    kx += kCols[1];
    doc.setFont('courier', 'bold');
    doc.setTextColor(8, 145, 178);
    doc.text(pdfSafe(r.value), kx + 1.3, ky + 3.2);
    kx += kCols[2];
    doc.setFont('courier', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(r.footprint), kx + 1.3, ky + 3.2);
    kx += kCols[3];
    doc.setTextColor(4, 120, 87);
    doc.text(r.lcsc, kx + 1.3, ky + 3.2);
    kx += kCols[4];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(pLines, kx + 1.3, ky + 3.1);
    ky += rowH;
  }

  ky += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Raspberry Pi GPIO, Watchdog & J2/J4 Screw Terminal Pinout', margin, ky);
  ky += 2.8;

  const pCols = [30, 32, 28, 92];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, ky, contentW, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(255, 255, 255);
  let px = margin;
  ['Block', 'Pin / Signal', 'Net Name', 'Connection & Protection Note'].forEach((h, i) => {
    doc.text(h, px + 1.4, ky + 3.7);
    px += pCols[i];
  });
  ky += 5.4;

  for (const p of OUTPUT_REV_B_PINOUT) {
    const nLines = doc.splitTextToSize(pdfSafe(p.connectionNote), pCols[3] - 3).slice(0, 2);
    const rowH = Math.max(6.2, nLines.length * 3.0 + 2.0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');
    px = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(p.device), px + 1.3, ky + 3.2);
    px += pCols[0];
    doc.setFont('courier', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafe(p.pin), px + 1.3, ky + 3.2);
    px += pCols[1];
    doc.setFont('courier', 'bold');
    doc.setTextColor(8, 145, 178);
    doc.text(pdfSafe(p.netName), px + 1.3, ky + 3.2);
    px += pCols[2];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(nLines, px + 1.3, ky + 3.1);
    ky += rowH;
  }

  // =========================================================================
  // PAGE 9: HARDWARE AUDIT HISTORY & DEFECT RESOLUTION LOG
  // =========================================================================
  doc.addPage();
  addHeaderFooter(9, 9, 'Hardware Audit & Revision History (Rev A -> Rev B)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Output Stage Hardware Audit History (Rev A -> Rev B Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  doc.text('Complete log of all 6 electrical, thermal, and protection defects found in Rev A and resolved in Rev B.', margin, 26.8);

  let ay = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Design Iteration Progression', margin, ay);
  ay += 3.0;

  for (const step of OUTPUT_REVISION_STEPS) {
    const isFinal = step.status === 'Finalized';
    doc.setFillColor(isFinal ? 236 : 248, isFinal ? 253 : 250, isFinal ? 245 : 252);
    doc.setDrawColor(isFinal ? 110 : 203, isFinal ? 231 : 213, isFinal ? 183 : 225);
    doc.rect(margin, ay, contentW, 12.0, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(isFinal ? 4 : 15, isFinal ? 120 : 23, isFinal ? 87 : 42);
    doc.text(pdfSafe(`${step.rev} (${step.status}) - ${step.title}`), margin + 3, ay + 4.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(step.summary), contentW - 6).slice(0, 2), margin + 3, ay + 8.1);
    ay += 13.5;
  }

  ay += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Detailed Defect & Resolution Audit Table (OUT-01 through OUT-06)', margin, ay);
  ay += 3.0;

  const aCols = [15, 33, 48, 48, 38];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ay, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(255, 255, 255);
  let rx = margin;
  ['ID', 'Area', 'Rev A Defect Found', 'Rev B Hardware Fix', 'Verified Impact'].forEach((h, i) => {
    doc.text(h, rx + 1.4, ay + 4.0);
    rx += aCols[i];
  });
  ay += 5.8;

  for (const row of OUTPUT_AUDIT_DEFECTS) {
    const fLines = doc.splitTextToSize(pdfSafe(row.finding), aCols[2] - 2.5).slice(0, 4);
    const fixLines = doc.splitTextToSize(pdfSafe(row.fixInRevB), aCols[3] - 2.5).slice(0, 4);
    const impLines = doc.splitTextToSize(pdfSafe(row.measuredImpact), aCols[4] - 2.5).slice(0, 4);
    const maxL = Math.max(fLines.length, fixLines.length, impLines.length, 2);
    const rowH = maxL * 3.1 + 3.2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ay, contentW, rowH, 'FD');

    rx = margin + 1.4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(8, 145, 178);
    doc.text(row.id, rx, ay + 3.8);
    rx += aCols[0];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
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

export function exportOutputStagePdfReport(
  selectedTopology: OutputTopologyId,
  params: OutputSimParams,
  batchSize: 2 | 5
): void {
  const doc = buildOutputStagePdfDoc(selectedTopology, params, batchSize);
  doc.save(`CoSTOS-Output-Stage-RevB-Gemini-${selectedTopology}.pdf`);
}
