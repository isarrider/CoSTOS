import { jsPDF } from 'jspdf';
import {
  GEMINI_WD_THRESHOLDS,
  WATCHDOG_TOPOLOGY_ORDER,
  WATCHDOG_TOPOLOGY_SPECS,
  WatchdogSimParams,
  WatchdogTopologyId,
  computeWatchdogFrequencySweep,
  evaluateWatchdog,
  watchdogPerBoardCostEur,
} from '../physics/model';
import { WATCHDOG_PINOUT, WATCHDOG_REV_B_BOM } from '../components/KicadBomPinout';
import { WATCHDOG_AUDIT_LOG } from '../components/AuditHistory';

// Keeps native WinAnsi glyphs ° (0xB0), ± (0xB1), ² (0xB2), µ (0xB5), × (0xD7)
function pdfSafe(input: string): string {
  return input
    .replace(/Ω/g, 'Ohm')
    .replace(/μ/g, 'µ')
    .replace(/\bdeg\s*C\b/g, '°C')
    .replace(/\+\/-/g, '±')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/−/g, '-')
    .replace(/∥/g, '||')
    .replace(/·/g, '|')
    .replace(/€|EUR/g, 'EUR ')
    .replace(/EUR\s+/g, 'EUR ')
    .replace(/τ/g, 'tau')
    .replace(/’|‘/g, "'")
    .replace(/“|”/g, '"')
    .replace(/[^\x20-\x7E\xB0\xB1\xB2\xB5\xD7]/g, '');
}

// Pure-jsPDF clean table renderer (no external plugin needed, guarantees exact height & wrapping)
function drawPdfTable(
  doc: jsPDF,
  opts: {
    startY: number;
    margin: number;
    colWidths: number[];
    headers: string[];
    rows: string[][];
    fontSize?: number;
    lineH?: number;
    padY?: number;
    headFill?: [number, number, number];
  }
): number {
  const {
    startY,
    margin,
    colWidths,
    headers,
    rows,
    fontSize = 6.9,
    lineH = 3.1,
    padY = 1.6,
    headFill = [15, 23, 42],
  } = opts;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let y = startY;

  // Header row
  const headH = lineH + padY * 2 + 0.6;
  doc.setFillColor(headFill[0], headFill[1], headFill[2]);
  doc.rect(margin, y, totalW, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  headers.forEach((h, i) => {
    doc.text(pdfSafe(h), cx + 1.8, y + padY + lineH * 0.78);
    cx += colWidths[i];
  });
  y += headH;

  // Body rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  rows.forEach((row, rIdx) => {
    const wrappedCols = row.map((cell, cIdx) =>
      doc.splitTextToSize(pdfSafe(cell), Math.max(8, colWidths[cIdx] - 3.2)) as string[]
    );
    const maxLines = Math.max(1, ...wrappedCols.map((w) => w.length));
    const rowH = maxLines * lineH + padY * 2;

    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, totalW, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + totalW, y + rowH);

    doc.setTextColor(15, 23, 42);
    let rx = margin;
    wrappedCols.forEach((lines, cIdx) => {
      doc.setFont('helvetica', cIdx === 0 ? 'bold' : 'normal');
      doc.text(lines, rx + 1.8, y + padY + lineH * 0.78);
      rx += colWidths[cIdx];
    });
    y += rowH;
  });

  // Outer border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(margin, startY, totalW, y - startY, 'S');
  return y;
}

// Authentic IEEE/IEC Vector Schematic Engine for Watchdog PDF Pages 2-6
function drawPdfWatchdogSchematic(
  doc: jsPDF,
  id: WatchdogTopologyId,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

  const sx = (u: number) => boxX + (u / 820) * boxW;
  const sy = (v: number) => boxY + (v / 265) * boxH;
  const sw = (u: number) => (u / 820) * boxW;
  const sh = (v: number) => (v / 265) * boxH;

  const SLATE: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [71, 85, 105];
  const BLUE: [number, number, number] = [29, 78, 216];
  const GREEN: [number, number, number] = [4, 120, 87];
  const AMBER: [number, number, number] = [180, 83, 9];
  const RED: [number, number, number] = [185, 28, 28];

  const wire = (x1: number, y1: number, x2: number, y2: number, col = SLATE, lw = 0.35) => {
    doc.setDrawColor(col[0], col[1], col[2]);
    doc.setLineWidth(lw);
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };
  const dot = (x: number, y: number, col = SLATE) => {
    doc.setFillColor(col[0], col[1], col[2]);
    doc.circle(sx(x), sy(y), 0.6, 'F');
  };
  const txt = (
    str: string,
    x: number,
    y: number,
    size = 5.4,
    col = SLATE,
    align: 'left' | 'center' | 'right' = 'left',
    bold = false
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(pdfSafe(str), sx(x), sy(y), { align });
  };
  const gnd = (x: number, y: number) => {
    wire(x, y, x, y + 8);
    wire(x - 9, y + 8, x + 9, y + 8, SLATE, 0.4);
    wire(x - 6, y + 12, x + 6, y + 12, SLATE, 0.35);
    wire(x - 2.5, y + 16, x + 2.5, y + 16, SLATE, 0.3);
  };
  const vcc = (x: number, y: number, label: string, col = RED) => {
    wire(x, y, x, y - 10, col, 0.38);
    wire(x - 8, y - 10, x + 8, y - 10, col, 0.5);
    txt(label, x, y - 14, 5.2, col, 'center', true);
  };
  const resH = (x1: number, x2: number, y: number, label?: string, sub?: string, col = SLATE) => {
    const mid = (x1 + x2) / 2;
    const bodyW = Math.min(34, Math.max(20, (x2 - x1) * 0.62));
    const bx1 = mid - bodyW / 2;
    const bx2 = mid + bodyW / 2;
    const step = bodyW / 6;
    const amp = 4.6;
    const pts: Array<[number, number]> = [
      [x1, y],
      [bx1, y],
      [bx1 + step * 0.5, y - amp],
      [bx1 + step * 1.5, y + amp],
      [bx1 + step * 2.5, y - amp],
      [bx1 + step * 3.5, y + amp],
      [bx1 + step * 4.5, y - amp],
      [bx1 + step * 5.5, y + amp],
      [bx2, y],
      [x2, y],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      wire(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, 0.34);
    }
    if (label) txt(label, mid, y - 8, 5.0, col, 'center', true);
    if (sub) txt(sub, mid, y + 15, 4.5, MUTED, 'center');
  };
  const resV = (
    x: number,
    y1: number,
    y2: number,
    label?: string,
    sub?: string,
    side: 'left' | 'right' = 'right',
    col = SLATE
  ) => {
    const mid = (y1 + y2) / 2;
    const bodyH = Math.min(32, Math.max(18, (y2 - y1) * 0.62));
    const by1 = mid - bodyH / 2;
    const by2 = mid + bodyH / 2;
    const step = bodyH / 6;
    const amp = 4.4;
    const pts: Array<[number, number]> = [
      [x, y1],
      [x, by1],
      [x + amp, by1 + step * 0.5],
      [x - amp, by1 + step * 1.5],
      [x + amp, by1 + step * 2.5],
      [x - amp, by1 + step * 3.5],
      [x + amp, by1 + step * 4.5],
      [x - amp, by1 + step * 5.5],
      [x, by2],
      [x, y2],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      wire(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, 0.34);
    }
    const tx = side === 'right' ? x + 9 : x - 9;
    const al = side === 'right' ? 'left' : 'right';
    if (label) txt(label, tx, mid - (sub ? 2 : -2), 5.0, col, al, true);
    if (sub) txt(sub, tx, mid + 9, 4.5, MUTED, al);
  };
  const capH = (x1: number, x2: number, y: number, label?: string, sub?: string, col = SLATE) => {
    const mid = (x1 + x2) / 2;
    wire(x1, y, mid - 3.5, y, col, 0.34);
    wire(mid - 3.5, y - 9, mid - 3.5, y + 9, col, 0.48);
    wire(mid + 3.5, y - 9, mid + 3.5, y + 9, col, 0.48);
    wire(mid + 3.5, y, x2, y, col, 0.34);
    if (label) txt(label, mid, y - 13, 5.0, col, 'center', true);
    if (sub) txt(sub, mid, y + 18, 4.5, MUTED, 'center');
  };
  const capV = (
    x: number,
    y1: number,
    y2: number,
    label?: string,
    sub?: string,
    side: 'left' | 'right' = 'right',
    col = SLATE
  ) => {
    const mid = (y1 + y2) / 2;
    wire(x, y1, x, mid - 3.5, col, 0.34);
    wire(x - 8.5, mid - 3.5, x + 8.5, mid - 3.5, col, 0.48);
    wire(x - 8.5, mid + 3.5, x + 8.5, mid + 3.5, col, 0.48);
    wire(x, mid + 3.5, x, y2, col, 0.34);
    const tx = side === 'right' ? x + 11 : x - 11;
    const al = side === 'right' ? 'left' : 'right';
    if (label) txt(label, tx, mid - (sub ? 2 : -2), 5.0, col, al, true);
    if (sub) txt(sub, tx, mid + 9, 4.5, MUTED, al);
  };
  const diodeH = (x1: number, x2: number, y: number, label?: string, sub?: string, col = SLATE) => {
    const mid = (x1 + x2) / 2;
    wire(x1, y, mid - 6, y, col, 0.34);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.triangle(sx(mid - 6), sy(y - 6), sx(mid - 6), sy(y + 6), sx(mid + 6), sy(y), 'F');
    wire(mid + 6, y - 6.5, mid + 6, y + 6.5, col, 0.48);
    wire(mid + 6, y, x2, y, col, 0.34);
    if (label) txt(label, mid, y - 10, 5.0, col, 'center', true);
    if (sub) txt(sub, mid, y + 16, 4.4, MUTED, 'center');
  };
  const diodeUp = (
    x: number,
    yTop: number,
    yBot: number,
    label?: string,
    sub?: string,
    side: 'left' | 'right' = 'right',
    col = SLATE
  ) => {
    const mid = (yTop + yBot) / 2;
    wire(x, yBot, x, mid + 6, col, 0.34);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.triangle(sx(x - 6), sy(mid + 6), sx(x + 6), sy(mid + 6), sx(x), sy(mid - 6), 'F');
    wire(x - 6.5, mid - 6, x + 6.5, mid - 6, col, 0.48);
    wire(x, mid - 6, x, yTop, col, 0.34);
    const tx = side === 'right' ? x + 10 : x - 10;
    const al = side === 'right' ? 'left' : 'right';
    if (label) txt(label, tx, mid - (sub ? 1 : -2), 5.0, col, al, true);
    if (sub) txt(sub, tx, mid + 9, 4.4, MUTED, al);
  };
  const nMosfet = (gx: number, cy: number, label: string, sub?: string, col = SLATE) => {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.25);
    doc.circle(sx(gx + 14), sy(cy), sw(13.5), 'FD');
    wire(gx, cy + 6, gx + 7, cy + 6, col, 0.35);
    wire(gx + 7, cy - 9, gx + 7, cy + 9, col, 0.45);
    wire(gx + 11.5, cy - 9, gx + 11.5, cy - 4, col, 0.42);
    wire(gx + 11.5, cy - 2, gx + 11.5, cy + 2.5, col, 0.42);
    wire(gx + 11.5, cy + 4.5, gx + 11.5, cy + 9, col, 0.42);
    wire(gx + 11.5, cy - 6.5, gx + 22, cy - 6.5, col, 0.35);
    wire(gx + 22, cy - 6.5, gx + 22, cy - 18, col, 0.35);
    wire(gx + 11.5, cy, gx + 22, cy, col, 0.32);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.triangle(sx(gx + 12), sy(cy), sx(gx + 17), sy(cy - 2.6), sx(gx + 17), sy(cy + 2.6), 'F');
    wire(gx + 11.5, cy + 6.5, gx + 22, cy + 6.5, col, 0.35);
    wire(gx + 22, cy, gx + 22, cy + 18, col, 0.35);
    txt(label, gx + 30, cy - 2, 5.0, col, 'left', true);
    if (sub) txt(sub, gx + 30, cy + 9, 4.4, MUTED, 'left');
  };
  const pMosfetH = (cx: number, sy0: number, label: string, sub?: string, col = SLATE) => {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.25);
    doc.circle(sx(cx), sy(sy0 + 8), sw(13.5), 'FD');
    wire(cx - 18, sy0, cx - 7, sy0, col, 0.35);
    wire(cx - 7, sy0, cx - 7, sy0 + 8, col, 0.35);
    wire(cx + 7, sy0, cx + 18, sy0, col, 0.35);
    wire(cx + 7, sy0, cx + 7, sy0 + 8, col, 0.35);
    wire(cx - 10, sy0 + 8, cx - 4.5, sy0 + 8, col, 0.42);
    wire(cx - 2.5, sy0 + 8, cx + 2.5, sy0 + 8, col, 0.42);
    wire(cx + 4.5, sy0 + 8, cx + 10, sy0 + 8, col, 0.42);
    wire(cx, sy0, cx, sy0 + 8, col, 0.32);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.triangle(sx(cx), sy(sy0 + 1), sx(cx - 2.8), sy(sy0 + 5.5), sx(cx + 2.8), sy(sy0 + 5.5), 'F');
    wire(cx - 10, sy0 + 12.5, cx + 10, sy0 + 12.5, col, 0.45);
    wire(cx - 6, sy0 + 12.5, cx - 6, sy0 + 22, col, 0.35);
    txt(label, cx, sy0 - 11, 5.0, col, 'center', true);
    if (sub) txt(sub, cx, sy0 - 1, 4.4, MUTED, 'center');
  };
  const pnpBjt = (bx: number, cy: number, label: string, sub?: string, col = SLATE) => {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.25);
    doc.circle(sx(bx + 12), sy(cy), sw(12.5), 'FD');
    wire(bx, cy, bx + 8, cy, col, 0.35);
    wire(bx + 8, cy - 8, bx + 8, cy + 8, col, 0.48);
    wire(bx + 8, cy - 4, bx + 18, cy - 10, col, 0.35);
    wire(bx + 18, cy - 10, bx + 18, cy - 18, col, 0.35);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.triangle(sx(bx + 9), sy(cy - 4.5), sx(bx + 14.5), sy(cy - 5), sx(bx + 12.5), sy(cy - 9.2), 'F');
    wire(bx + 8, cy + 4, bx + 18, cy + 10, col, 0.35);
    wire(bx + 18, cy + 10, bx + 18, cy + 18, col, 0.35);
    txt(label, bx + 27, cy - 2, 5.0, col, 'left', true);
    if (sub) txt(sub, bx + 27, cy + 9, 4.4, MUTED, 'left');
  };
  const block = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    sub: string,
    fill: [number, number, number],
    stroke: [number, number, number]
  ) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(sx(x), sy(y), sw(w), sh(h), 0.9, 0.9, 'FD');
    txt(title, x + w / 2, y + h * 0.44, 5.3, stroke, 'center', true);
    if (sub) txt(sub, x + w / 2, y + h * 0.78, 4.4, MUTED, 'center');
  };

  if (id === 'u3b_schmitt_wd') {
    txt('RECOMMENDED | REV B (GEMINI): DEDICATED U4 (LM393DR) DUAL-SCHMITT - U4A RELAY (+5V) & U4B PUMP/RB (+3.3V)', 14, 18, 5.5, GREEN, 'left', true);
    block(14, 84, 72, 32, 'GPIO 24', '20 Hz HB', [239, 246, 255], BLUE);
    resH(86, 146, 100, 'R48 4.7k', '340 Hz LPF');
    dot(146, 100);
    capV(146, 100, 166, 'C16', '100nF', 'left');
    gnd(146, 166);
    capH(146, 198, 100, 'C17', '1uF');
    capH(198, 250, 100, 'C19', '1uF');
    dot(250, 100);
    diodeUp(250, 100, 166, 'D20', '1N4148W', 'left');
    gnd(250, 166);
    diodeH(250, 308, 100, 'D19', '1N4148W');
    dot(308, 100, BLUE);

    wire(308, 100, 394, 100, BLUE, 0.4);
    txt('V_CAP (tau=17.4s)', 352, 91, 4.8, BLUE, 'center', true);
    capV(308, 100, 166, 'C18A/B', '2x22uF', 'right', BLUE);
    gnd(308, 166);
    dot(364, 100, BLUE);
    resV(364, 100, 166, 'R49||R50', '2x1.0M', 'right');
    gnd(364, 166);

    // Split V_CAP to U4A (-) top and U4B (-) bottom
    dot(394, 100, BLUE);
    wire(394, 56, 394, 178, BLUE, 0.38);
    wire(394, 56, 442, 56, BLUE, 0.38);
    wire(394, 178, 442, 178, BLUE, 0.38);

    // ===== TOP CHANNEL: U4A (+5V Relay Q12) =====
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.setLineWidth(0.42);
    doc.triangle(sx(442), sy(40), sx(442), sy(96), sx(498), sy(68), 'FD');
    txt('-', 449, 60, 5.8, GREEN, 'left', true);
    txt('+', 449, 82, 5.8, GREEN, 'left', true);
    txt('U4A', 468, 70, 5.2, GREEN, 'center', true);
    txt('1.54/0.93V', 470, 36, 4.3, MUTED, 'center');

    wire(418, 78, 442, 78, GREEN, 0.32);
    wire(418, 78, 418, 114, GREEN, 0.32);
    resH(418, 514, 114, 'R57A 220k', 'R55A 100k / R56A 47k', GREEN);
    wire(514, 68, 514, 114, GREEN, 0.32);
    dot(514, 68, GREEN);

    wire(498, 68, 608, 68, GREEN, 0.42);
    txt('~WD_REL', 550, 81, 4.6, GREEN, 'center', true);
    dot(548, 68, GREEN);
    resV(548, 34, 68, 'R45', '10k', 'left');
    vcc(548, 34, '+5V');
    wire(548, 34, 596, 34, RED, 0.4);
    dot(548, 34, RED);
    pMosfetH(614, 34, 'Q12 AO3401A', 'Relay (15.4s)', GREEN);
    wire(608, 68, 608, 56, GREEN, 0.38);
    wire(632, 34, 704, 34, RED, 0.44);
    block(704, 22, 104, 26, '+5V_REL', 'REL1 / REL2', [254, 242, 242], RED);

    // ===== BOTTOM CHANNEL: U4B (+3.3V GPIO20 + D3 + Q15 -> Q5 Pump) =====
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.42);
    doc.triangle(sx(442), sy(162), sx(442), sy(218), sx(498), sy(190), 'FD');
    txt('-', 449, 182, 5.8, BLUE, 'left', true);
    txt('+', 449, 204, 5.8, BLUE, 'left', true);
    txt('U4B', 468, 192, 5.2, BLUE, 'center', true);
    txt('1.56/0.81V', 470, 158, 4.3, MUTED, 'center');

    wire(418, 200, 442, 200, BLUE, 0.32);
    wire(418, 200, 418, 234, BLUE, 0.32);
    resH(418, 514, 234, 'R57B 100k', 'R55B 100k / R56B 47k', BLUE);
    wire(514, 190, 514, 234, BLUE, 0.32);
    dot(514, 190, BLUE);

    wire(498, 190, 610, 190, BLUE, 0.42);
    dot(548, 190, BLUE);
    resV(548, 142, 190, 'R51', '10k', 'left');
    vcc(548, 142, '+3V3', AMBER);
    wire(548, 190, 548, 224, BLUE, 0.36);
    wire(548, 224, 582, 224, BLUE, 0.36);
    block(582, 210, 108, 26, 'GPIO 20 + D3 LED', 'Direct 3.3V (no Q14!)', [248, 250, 252], BLUE);

    resH(610, 656, 190, 'R53', '10k');
    pnpBjt(656, 190, 'Q15', '3906');
    vcc(674, 172, '+3V3', AMBER);
    wire(674, 208, 710, 208, BLUE, 0.38);
    wire(710, 208, 710, 152, BLUE, 0.38);
    block(704, 120, 104, 32, 'Q5 AO3400A', 'H3 Pump (17.7s)', [239, 246, 255], BLUE);

    txt('Rev B: Dedicated U4 (zero 60 kHz cross-talk) | Dual output isolation | 10 s Linux stall safe | Deletes Q13 & Q14', 14, 258, 4.6, MUTED);
    return;
  }

  if (id === 'd24_cap_pump') {
    txt('CLAUDE D24 PROPOSAL: PASSIVE CHARGE-PUMP (1.1 MOhm) DIRECTLY DRIVING 3x AO3400A GATES', 14, 18, 5.8, AMBER, 'left', true);
    block(14, 84, 78, 32, 'GPIO 24', '20 Hz HB', [239, 246, 255], BLUE);
    resH(92, 160, 100, 'R48 4.7k', '340 Hz LPF');
    dot(160, 100);
    capV(160, 100, 170, 'C16', '100nF', 'left');
    gnd(160, 170);
    capH(160, 220, 100, 'C17', '470nF');
    capH(220, 280, 100, 'C19', '470nF');
    dot(280, 100);
    diodeUp(280, 100, 170, 'D20', '1N4148W', 'left');
    gnd(280, 170);
    diodeH(280, 346, 100, 'D19', '1N4148W');

    wire(346, 100, 520, 100, AMBER, 0.44);
    txt('WD_OK (2.32 V | 1.1 MOhm High-Z)', 448, 89, 5.0, AMBER, 'center', true);
    dot(346, 100, AMBER);
    capV(346, 100, 170, 'C18', '10uF', 'right', AMBER);
    gnd(346, 170);
    dot(410, 100, AMBER);
    resV(410, 100, 170, 'R49', '2.2M', 'right');
    gnd(410, 170);
    dot(464, 100, AMBER);
    resV(464, 100, 170, 'R50', '2.2M', 'right');
    gnd(464, 170);

    dot(520, 100, AMBER);
    wire(520, 100, 520, 206, AMBER, 0.38);
    wire(520, 100, 556, 100, AMBER, 0.38);
    nMosfet(556, 94, 'Q13', 'AO3400A');
    gnd(578, 112);
    wire(578, 76, 578, 48);
    resV(622, 48, 76, 'R45', '100k', 'right');
    wire(578, 76, 654, 76);
    dot(578, 76);
    vcc(622, 48, '+5V');
    wire(622, 48, 642, 48, RED, 0.4);
    pMosfetH(660, 48, 'Q12 AO3401A', 'Slow ramp!', AMBER);
    wire(678, 48, 716, 48, RED, 0.42);
    block(716, 35, 92, 26, '+5V_REL', 'REL1 / REL2', [254, 242, 242], RED);

    wire(520, 154, 556, 154, AMBER, 0.38);
    dot(520, 154, AMBER);
    nMosfet(556, 148, 'Q5', 'Pump H3');
    gnd(578, 166);
    wire(520, 206, 556, 206, AMBER, 0.38);
    nMosfet(556, 200, 'Q14', 'GPIO20');
    gnd(578, 218);
    wire(578, 182, 676, 182, BLUE, 0.35);
    resV(644, 144, 182, 'R51', '10k', 'right');
    vcc(644, 144, '+3V3', AMBER);
    dot(644, 182, BLUE);
    block(676, 168, 132, 28, 'GPIO 20 Readback', 'V_th differs from Q13!', [255, 251, 235], AMBER);
    txt('Warning: 3 independent AO3400A thresholds (0.65-1.45 V) -> 5-14 s spread, 2 s linear relay ramp, 30 mV stall margin', 14, 254, 4.7, AMBER);
    return;
  }

  if (id === '74lvc1g123') {
    txt('ORIGINAL BASELINE: 74LVC1G123 MONOSTABLE + TPS22918 LOAD SWITCH (2x EXTENDED FEE = EUR 5.60)', 14, 18, 5.8, SLATE, 'left', true);
    block(22, 92, 86, 34, 'GPIO 24', 'Edge Trig', [239, 246, 255], BLUE);
    wire(108, 109, 196, 109, SLATE, 0.4);
    txt('No LPF (accepts 2 kHz!)', 152, 101, 4.6, RED, 'center');
    block(196, 66, 156, 96, 'U3: 74LVC1G123', 'Retriggerable Mono (+EUR 2.80)', [248, 250, 252], SLATE);
    vcc(274, 66, '+3V3', AMBER);
    wire(234, 162, 234, 208);
    resH(164, 234, 208, 'R_ext 300k', 'tau = 3.0 s');
    vcc(164, 208, '+3V3', AMBER);
    capV(306, 162, 220, 'C_ext', '10uF', 'right');
    gnd(306, 220);
    wire(352, 109, 466, 109, BLUE, 0.42);
    dot(430, 109, BLUE);
    txt('WD_OK (3.3V)', 408, 100, 4.8, BLUE, 'center', true);
    block(466, 60, 156, 74, 'U7: TPS22918', '5 V Load Switch (+EUR 2.80)', [254, 242, 242], RED);
    vcc(544, 60, '+5V IN');
    wire(622, 96, 694, 96, RED, 0.44);
    block(694, 82, 106, 28, '+5V_REL', 'REL1 / REL2', [254, 242, 242], RED);
    wire(430, 109, 430, 192, BLUE, 0.38);
    wire(430, 192, 504, 192, BLUE, 0.38);
    nMosfet(504, 186, 'Q5 AO3400A', 'Pump H3 Gate');
    gnd(526, 204);
    txt('Drawbacks: EUR 5.60 extended fees | 3.0 s trips on Linux stalls | accepts 2 kHz runaway loop | no GPIO20 readback', 14, 254, 4.7, RED);
    return;
  }

  if (id === 'ne555_missing_pulse') {
    txt('NE555 MISSING-PULSE DETECTOR: CRISP 5 V DRIVE, BUT ACCEPTS RUNAWAY LOOPS & DRAWS ~5 mA', 14, 18, 5.8, SLATE, 'left', true);
    block(14, 90, 76, 32, 'GPIO 24', 'Heartbeat', [239, 246, 255], BLUE);
    capH(90, 152, 106, 'C_ac', '100nF');
    resH(152, 204, 106, '10k');
    pnpBjt(204, 106, 'Q_rst', '3906');
    gnd(222, 124);
    wire(222, 88, 290, 88);
    dot(290, 88);
    resV(290, 42, 88, 'R_t', '470k', 'left');
    vcc(290, 42, '+5V');
    capV(290, 88, 168, 'C_t', '10uF', 'left');
    gnd(290, 168);
    wire(290, 88, 360, 88);
    wire(328, 88, 328, 122);
    dot(328, 88);
    wire(328, 122, 360, 122);
    block(360, 64, 144, 96, 'NE555DR', 'Missing-Pulse (5.5 s | ~5 mA)', [248, 250, 252], SLATE);
    vcc(432, 64, '+5V');
    wire(504, 107, 590, 107, BLUE, 0.42);
    dot(590, 107, BLUE);
    wire(590, 66, 590, 188, BLUE, 0.38);
    wire(590, 66, 624, 66, BLUE, 0.38);
    block(624, 50, 178, 32, 'Q13 -> Q12 (+5V_REL)', 'Crisp 5 V snap shutoff', [254, 242, 242], RED);
    wire(590, 126, 624, 126, BLUE, 0.38);
    block(624, 110, 178, 32, 'Q5 AO3400A (Pump H3)', 'Full 4.8 V gate overdrive', [239, 246, 255], BLUE);
    wire(590, 188, 624, 188, BLUE, 0.38);
    block(624, 172, 178, 32, 'Q14 -> GPIO 20 + LED', 'Matches 5.5 s timeout', [248, 250, 252], MUTED);
    txt('Drawbacks: Accepts runaway 2 kHz-100 kHz toggle loops | extra SOIC-8 IC despite free U3B | 5 mA quiescent', 14, 254, 4.7, RED);
    return;
  }

  txt('TPS3823-33 DEDICATED SUPERVISOR: COMPACT 6-PART IC, BUT 1.6 s FAILS LINUX STALLS & EUR 5.60 FEE', 14, 18, 5.8, SLATE, 'left', true);
  block(22, 92, 86, 34, 'GPIO 24', 'WDI Input', [239, 246, 255], BLUE);
  wire(108, 109, 204, 109, SLATE, 0.4);
  txt('No upper f limit (>1 MHz)', 156, 101, 4.6, RED, 'center');
  block(204, 66, 166, 92, 'TPS3823-33', 'Fixed 1.6 s (0.9 s min | +EUR 2.80)', [254, 242, 242], RED);
  vcc(287, 66, '+3V3', AMBER);
  gnd(287, 158);
  wire(370, 109, 474, 109, BLUE, 0.42);
  dot(436, 109, BLUE);
  block(474, 62, 156, 74, 'TPS22918', '5 V Load Switch (+EUR 2.80)', [254, 242, 242], RED);
  vcc(552, 62, '+5V IN');
  wire(630, 98, 698, 98, RED, 0.44);
  block(698, 84, 104, 28, '+5V_REL', 'REL1 / REL2', [254, 242, 242], RED);
  wire(436, 109, 436, 192, BLUE, 0.38);
  wire(436, 192, 504, 192, BLUE, 0.38);
  nMosfet(504, 186, 'Q5 AO3400A', 'Pump H3 Gate');
  gnd(526, 204);
  txt('Drawbacks: Fixed 1.6 s (0.9 s min) false-trips during normal 2-5 s Raspberry Pi Linux stalls | EUR 5.60 extended fees', 14, 254, 4.7, RED);
}

// 5-curve Frequency Bandpass Window Vector Chart on Page 1
function drawPdfFrequencyChart(
  doc: jsPDF,
  params: WatchdogSimParams,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const data = computeWatchdogFrequencySweep(params);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

  const padL = 13;
  const padR = 6;
  const padT = 8;
  const padB = 9;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const px = (logF: number) => x + padL + ((logF - -1) / 4.7) * pw;
  const py = (v: number) => y + padT + ph - (Math.max(0, Math.min(3.5, v)) / 3.5) * ph;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Bandpass Frequency Window Sweep (0.1 Hz -> 5 kHz, log scale)', x + 4, y + 5.2);

  doc.setFillColor(254, 243, 199);
  doc.rect(x + padL, py(1.45), pw, py(0.65) - py(1.45), 'F');

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  for (const v of [0, 1, 2, 3]) {
    doc.line(x + padL, py(v), x + padL + pw, py(v));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${v}V`, x + padL - 2, py(v) + 1.5, { align: 'right' });
  }
  for (const [lf, lbl] of [
    [-1, '0.1'],
    [0, '1'],
    [0.7, '5'],
    [1.3, '20'],
    [2.3, '200'],
    [3, '1k'],
    [3.3, '2k'],
  ] as Array<[number, string]>) {
    doc.line(px(lf), y + padT, px(lf), y + padT + ph);
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${lbl}Hz`, px(lf), y + h - 2.5, { align: 'center' });
  }

  doc.setDrawColor(4, 120, 87);
  doc.setLineWidth(0.25);
  doc.line(x + padL, py(GEMINI_WD_THRESHOLDS.vThHi), x + padL + pw, py(GEMINI_WD_THRESHOLDS.vThHi));
  doc.line(x + padL, py(GEMINI_WD_THRESHOLDS.vThLo), x + padL + pw, py(GEMINI_WD_THRESHOLDS.vThLo));

  const series: Array<{ key: 'u3bV' | 'd24V' | 'mono74V' | 'ne555V' | 'tps3823V'; col: [number, number, number]; lw: number }> = [
    { key: 'u3bV', col: [4, 120, 87], lw: 0.65 },
    { key: 'd24V', col: [217, 119, 6], lw: 0.55 },
    { key: 'mono74V', col: [100, 116, 139], lw: 0.35 },
    { key: 'ne555V', col: [124, 58, 237], lw: 0.35 },
    { key: 'tps3823V', col: [225, 29, 72], lw: 0.35 },
  ];
  for (const s of series) {
    doc.setDrawColor(s.col[0], s.col[1], s.col[2]);
    doc.setLineWidth(s.lw);
    for (let i = 0; i < data.length - 1; i++) {
      doc.line(px(data[i].logF), py(data[i][s.key]), px(data[i + 1].logF), py(data[i + 1][s.key]));
    }
  }

  doc.setFontSize(5.5);
  doc.setTextColor(4, 120, 87);
  doc.text('Green: U4 Rev B', x + w - 78, y + 5.2);
  doc.setTextColor(180, 83, 9);
  doc.text('Amber: Claude D24', x + w - 49, y + 5.2);
  doc.setTextColor(225, 29, 72);
  doc.text('Flat: IC (no upper limit)', x + w - 3, y + 5.2, { align: 'right' });
}

export function buildWatchdogPdfDoc(
  selectedTopology: WatchdogTopologyId,
  params: WatchdogSimParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const activeSpec = WATCHDOG_TOPOLOGY_SPECS[selectedTopology];
  const dateStr = new Date().toISOString().slice(0, 10);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 03. Hardware Watchdog & Relay Safety Report', margin, 8.3);
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
      pdfSafe(`Rev B (Gemini Version) | Dedicated U4 (LM393DR) Dual-Schmitt | Generated ${dateStr}`),
      margin,
      pageH - 6.8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.8, { align: 'right' });
  };

  // ================= PAGE 1: Executive Overview, Matrix & 5-Curve Sweep Chart =================
  addHeaderFooter(1, 9, 'Executive Summary & Bandpass Window Sweep');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Hardware Watchdog & Relay Supply Evaluation (D24 -> Rev B Gemini)', margin, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Evaluates 5 watchdog architectures for Raspberry Pi 3/4/5 solar boiler safety. Batch: ${batchSize}× | Active: ${activeSpec.shortName} | Temp: ${params.ambientTempC} °C | Corner: ${params.mosfetCorner.toUpperCase()}.`
    ),
    margin,
    27.5
  );

  const origCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], batchSize);
  const d24Cost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.d24_cap_pump, batchSize);
  const gemCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.u3b_schmitt_wd, batchSize);
  const kpis = [
    { t: 'Original (74LVC1G123)', v: `EUR ${origCost.toFixed(2)}/bd`, s: 'EUR 5.60 fee | trips @ 3s' },
    { t: 'Claude D24 Passive', v: `EUR ${d24Cost.toFixed(2)}/bd`, s: 'EUR 0 fee | 2s relay ramp' },
    { t: 'Gemini Rev B (Ded. U4)', v: `EUR ${gemCost.toFixed(2)}/bd`, s: '15.4-17.7s | 10s stall OK' },
    { t: 'Saves vs Original', v: `EUR ${(origCost - gemCost).toFixed(2)}/bd`, s: 'Dual U4A/U4B | no Q13/Q14' },
  ];
  const kw = (contentW - 9) / 4;
  kpis.forEach((k, i) => {
    const kx = margin + i * (kw + 3);
    doc.setFillColor(i === 2 ? 236 : 248, i === 2 ? 253 : 250, i === 2 ? 245 : 252);
    doc.setDrawColor(i === 2 ? 16 : 203, i === 2 ? 185 : 213, i === 2 ? 129 : 225);
    doc.roundedRect(kx, 31, kw, 17, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(k.t), kx + 2.5, 35.5);
    doc.setFontSize(10.2);
    doc.setTextColor(i === 2 ? 4 : 15, i === 2 ? 120 : 23, i === 2 ? 87 : 42);
    doc.text(pdfSafe(k.v), kx + 2.5, 41.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafe(k.s), kx + 2.5, 45.8);
  });

  const matrixRows = WATCHDOG_TOPOLOGY_ORDER.map((tid) => {
    const s = WATCHDOG_TOPOLOGY_SPECS[tid];
    const eRun = evaluateWatchdog(tid, { ...params, heartbeatHz: 2000, linuxStallS: 0, activeFault: 'runaway_2khz' });
    const eStall = evaluateWatchdog(tid, { ...params, heartbeatHz: 20, linuxStallS: 5, mosfetCorner: 'max', activeFault: 'none' });
    const cost = watchdogPerBoardCostEur(s, batchSize);
    return [
      s.shortName,
      `EUR ${cost.toFixed(2)}`,
      !eRun.relayEnergized ? 'PASS (OFF)' : 'FAIL (ON)',
      eStall.relayEnergized ? `+${eStall.stallMarginMv.toFixed(0)} mV` : 'TRIPPED',
      s.edgeTransition,
      s.timeoutSpec,
    ];
  });

  const afterMatrixY = drawPdfTable(doc, {
    startY: 51,
    margin,
    colWidths: [44, 20, 24, 26, 34, 34],
    headers: ['Architecture', `Cost (${batchSize}x)`, '2 kHz Window', '5s Stall (Max)', 'Relay Edge', 'Timeout'],
    rows: matrixRows,
    fontSize: 6.8,
    lineH: 3.1,
    padY: 1.7,
  });

  const chartY = Math.max(105, afterMatrixY + 5);
  drawPdfFrequencyChart(doc, params, margin, chartY, contentW, 56);

  const bomHeadY = chartY + 62;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`Selected Bench Topology BOM: ${activeSpec.name}`), margin, bomHeadY);

  drawPdfTable(doc, {
    startY: bomHeadY + 2.5,
    margin,
    colWidths: [34, 78, 28, 22, 20],
    headers: ['RefDes', 'Component', 'Package', 'Class', 'Cost'],
    rows: activeSpec.bom.map((b) => [
      b.designator,
      b.part,
      b.packageType,
      b.jlcpcbClass,
      `EUR ${b.unitCostEur.toFixed(2)}`,
    ]),
    fontSize: 6.4,
    lineH: 2.8,
    padY: 1.2,
    headFill: [30, 41, 59],
  });

  // ================= PAGES 2-6: Dedicated Option Dossiers =================
  WATCHDOG_TOPOLOGY_ORDER.forEach((tid, idx) => {
    doc.addPage();
    const spec = WATCHDOG_TOPOLOGY_SPECS[tid];
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.8);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(`Option ${idx + 1}: ${spec.name}`), margin, 21.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    const sumLines = doc.splitTextToSize(pdfSafe(spec.summary), contentW) as string[];
    doc.text(sumLines.slice(0, 2), margin, 26.8);

    // 4-Corner Telemetry Strip (y=34..45)
    const eNom = evaluateWatchdog(tid, { ...params, heartbeatHz: 20, linuxStallS: 0, mosfetCorner: 'typ', fluxLeakage: 'clean', activeFault: 'none' });
    const eStall = evaluateWatchdog(tid, { ...params, heartbeatHz: 20, linuxStallS: 5, mosfetCorner: 'max', fluxLeakage: 'clean', activeFault: 'none' });
    const eRun = evaluateWatchdog(tid, { ...params, heartbeatHz: 2000, linuxStallS: 0, mosfetCorner: 'min', fluxLeakage: 'clean', activeFault: 'runaway_2khz' });
    const costBd = watchdogPerBoardCostEur(spec, batchSize);
    const cells = [
      { l: `Cost/bd (${batchSize}x)`, v: `EUR ${costBd.toFixed(2)} (fee EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})` },
      { l: 'Nominal Cutoff / Edge', v: `${eNom.cutoffTimeoutS.toFixed(1)} s | ${spec.edgeTransition}` },
      { l: '5s Stall (Max V_th)', v: eStall.relayEnergized ? `PASS (+${eStall.stallMarginMv.toFixed(0)} mV)` : 'TRIPPED OFF' },
      { l: '2 kHz Runaway Loop', v: !eRun.relayEnergized ? 'REJECTED (OFF)' : 'ACCEPTED (UNSAFE)' },
    ];
    const cw = (contentW - 6) / 4;
    cells.forEach((c, ci) => {
      const cx = margin + ci * (cw + 2);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(cx, 34, cw, 11, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.7);
      doc.setTextColor(100, 116, 139);
      doc.text(pdfSafe(c.l), cx + 2, 37.8);
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      doc.text(pdfSafe(c.v), cx + 2, 42.6);
    });

    // Authentic IEEE Schematic Box (y=48..108, 182x60mm)
    drawPdfWatchdogSchematic(doc, tid, margin, 48, contentW, 60);

    // Pros & Cons Two-Column Block (y=112..166)
    const halfW = (contentW - 4) / 2;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, 112, halfW, 54, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(4, 120, 87);
    doc.text('ADVANTAGES', margin + 3, 117.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(15, 23, 42);
    let ay = 122;
    spec.advantages.slice(0, 5).forEach((adv) => {
      const wrapped = doc.splitTextToSize(pdfSafe(`- ${adv}`), halfW - 6) as string[];
      if (ay + wrapped.length * 2.9 < 164.5) {
        doc.text(wrapped, margin + 3, ay);
        ay += wrapped.length * 2.9 + 1.0;
      }
    });

    const rx = margin + halfW + 4;
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(rx, 112, halfW, 54, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(185, 28, 28);
    doc.text('DISADVANTAGES & TRADE-OFFS', rx + 3, 117.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(15, 23, 42);
    let ty = 122;
    spec.tradeoffs.slice(0, 5).forEach((tr) => {
      const wrapped = doc.splitTextToSize(pdfSafe(`- ${tr}`), halfW - 6) as string[];
      if (ty + wrapped.length * 2.9 < 164.5) {
        doc.text(wrapped, rx + 3, ty);
        ty += wrapped.length * 2.9 + 1.0;
      }
    });

    // Fail-Safe Analysis Box (y=170..194)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, 170, contentW, 24, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(15, 23, 42);
    doc.text('FAILURE-MODE & SELF-TEST COVERAGE', margin + 3, 175);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafe(`Stuck/Stopped: ${spec.failSafeNotes.stuckOrStopped}`), margin + 3, 179.4);
    doc.text(pdfSafe(`Runaway 2 kHz: ${spec.failSafeNotes.runawayLoop}`), margin + 3, 183.6);
    doc.text(pdfSafe(`Single Fault: ${spec.failSafeNotes.singlePartFault}`), margin + 3, 187.8);
    doc.text(pdfSafe(`Readback: ${spec.failSafeNotes.readbackCoverage}`), margin + 3, 192.0);

    // Per-Option BOM Table (y=198..276)
    drawPdfTable(doc, {
      startY: 198,
      margin,
      colWidths: [34, 78, 28, 22, 20],
      headers: ['RefDes', 'Component', 'Package', 'Class', 'Cost'],
      rows: spec.bom.map((b) => [
        b.designator,
        b.part,
        b.packageType,
        b.jlcpcbClass,
        `EUR ${b.unitCostEur.toFixed(2)}`,
      ]),
      fontSize: 6.4,
      lineH: 2.8,
      padY: 1.2,
      headFill: [30, 41, 59],
    });
  });

  // ================= PAGE 7: 3-Way Executive Scorecard =================
  doc.addPage();
  addHeaderFooter(7, 9, '3-Way Engineering Verdict & Dual-Channel Fault Isolation');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('3-Way Verdict: Original 74LVC1G123 vs. Claude D24 vs. Gemini Rev B', margin, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      'Head-to-head audit showing why a dedicated EUR 0.04 U4 (LM393DR) + 2x22 uF hold bank solves relay arcing, V_th scatter, 60 kHz cross-talk, and 10 s Linux stalls.'
    ),
    margin,
    27.5
  );

  const afterScoreY = drawPdfTable(doc, {
    startY: 33,
    margin,
    colWidths: [42, 44, 46, 50],
    headers: ['Criterion', 'Original (74LVC1G123)', 'Claude D24 Passive', 'Gemini Rev B (Dedicated U4)'],
    rows: [
      [
        'Cost / Board (2x)',
        `EUR ${watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], 2).toFixed(2)} (EUR 5.60 fee)`,
        `EUR ${watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.d24_cap_pump, 2).toFixed(2)} (EUR 0 fee)`,
        `EUR ${watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.u3b_schmitt_wd, 2).toFixed(2)} (EUR 0 fee)`,
      ],
      ['2 kHz Runaway Loop', 'FAIL - retriggers forever', 'PASS - R48/C16 LPF cuts off', 'PASS - cuts off >= 1 kHz'],
      ['Relay Cutoff Edge', 'PASS - < 20 ns digital', 'POOR - 1.8 s linear brown-out', 'PASS - < 5 us snap (0.61/0.75V hyst)'],
      ['Timeout & Ordering', '3.0 s fixed (no GPIO20)', '5.0-14.0 s (2.8x V_th spread)', '15.4 s Relay / 17.7 s Pump+RB'],
      ['GPIO20 Self-Test Match', 'None (blind)', 'Up to 8 s Q14 vs Q13 blind spot', 'Relay cuts 2.3 s BEFORE GPIO20 HIGH'],
      ['Linux Stall (5s / 10s)', 'FAIL - trips at 3.0 s', '+30 mV @ 5 s (trips @ 10 s)', 'PASS (+753 mV @ 5s | +334 mV @ 10s)'],
      ['60 °C + 3 MOhm Humid', 'Low sensitivity', '-34% tau shift (1.1 MOhm node)', 'Low shift (500 kOhm | 11.8-13.6 s)'],
      ['Single-Fault Isolation', 'IC Q stuck high -> both ON', 'GOOD - no shared IC', 'PASS - Separate U4A & U4B outputs'],
    ],
    fontSize: 7.0,
    lineH: 3.15,
    padY: 1.9,
  });

  const scY = afterScoreY + 8;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(margin, scY, contentW, 46, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(4, 120, 87);
  doc.text('RECOMMENDATION: ADOPT GEMINI REV B (DEDICATED U4 DUAL-SCHMITT WINDOW WATCHDOG)', margin + 4, scY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(15, 23, 42);
  const recLines = doc.splitTextToSize(
    pdfSafe(
      '1. Dedicated U4 (LM393DR, EUR 0.04 shared Basic reel with Pt1000 U1 & Pump U3) eliminates 60 kHz switcher cross-talk from Pump U3A and leaves Pump U3B cleanly tied off.\n' +
        '2. Splits Mains Relay (U4A, +5V -> Q12) and Pump/Readback (U4B, +3.3V -> GPIO20 + D3 + Q15 -> Q5) onto independent comparator output stages, deleting both Q13 and Q14.\n' +
        '3. 2x22 uF 16V X5R (38 uF eff) || 500 kOhm keeps node impedance low against LM393 I_bias and humidity while extending timeout to 15.4-17.7 s — surviving 10 s Linux stalls with +334 mV margin.\n' +
        '4. Conservative fail-safe ordering: U4A opens the 230 VAC relay ~2.3 s BEFORE U4B raises GPIO20 HIGH during startup self-test (< 25 s ceiling).'
    ),
    contentW - 8
  ) as string[];
  doc.text(recLines, margin + 4, scY + 13);

  // ================= PAGE 8: KiCad Production BOM & Dedicated U4 Pinout =================
  doc.addPage();
  addHeaderFooter(8, 9, 'KiCad Production BOM & Dedicated U4 (U4A / U4B) Net Map');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad Production BOM - Hardware Watchdog Rev B (Gemini Version)', margin, 21.5);

  const afterBomY = drawPdfTable(doc, {
    startY: 25,
    margin,
    colWidths: [28, 10, 26, 48, 70],
    headers: ['RefDes', 'Qty', 'Value', 'JLCPCB Reel / Synergy', 'Engineering Purpose'],
    rows: WATCHDOG_REV_B_BOM.map((r) => [
      r.refDes,
      String(r.qty),
      r.value,
      r.partNumber,
      r.purpose,
    ]),
    fontSize: 6.2,
    lineH: 2.7,
    padY: 1.15,
  });

  const pinY = afterBomY + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('Raspberry Pi Header & Dedicated U4 (U4A / U4B) Pinout Map (Pi 3 / 4 / 5)', margin, pinY);

  drawPdfTable(doc, {
    startY: pinY + 3,
    margin,
    colWidths: [34, 26, 20, 102],
    headers: ['Pin', 'Net Name', 'Dir', 'Connection & Layout Rule'],
    rows: WATCHDOG_PINOUT.map((p) => [p.pin, p.net, p.dir, p.note]),
    fontSize: 6.4,
    lineH: 2.75,
    padY: 1.25,
    headFill: [30, 41, 59],
  });

  // ================= PAGE 9: Engineering Audit History =================
  doc.addPage();
  addHeaderFooter(9, 9, 'Engineering Audit History (WAUD-01 -> WAUD-07)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Hardware Audit Trail (74LVC1G123 -> Claude D24 -> Rev A -> Gemini Rev B)', margin, 22);

  drawPdfTable(doc, {
    startY: 27,
    margin,
    colWidths: [18, 22, 18, 124],
    headers: ['ID', 'Stage', 'Severity', 'Audit Finding & Verified Resolution'],
    rows: WATCHDOG_AUDIT_LOG.map((a) => [
      a.id,
      a.revision,
      a.severity,
      `${a.title}\nFinding: ${a.finding}\nFix: ${a.fix}`,
    ]),
    fontSize: 6.6,
    lineH: 2.95,
    padY: 1.45,
  });

  return doc;
}

export function exportWatchdogPdfReport(
  selectedTopology: WatchdogTopologyId,
  params: WatchdogSimParams,
  batchSize: 2 | 5
): void {
  const doc = buildWatchdogPdfDoc(selectedTopology, params, batchSize);
  doc.save(`CoSTOS-Watchdog-RevB-Gemini-${selectedTopology}.pdf`);
}
