import { jsPDF } from 'jspdf';
import {
  POWER_TOPOLOGY_ORDER,
  POWER_TOPOLOGY_SPECS,
  PowerSimParams,
  PowerTopologyId,
  PowerTopologySpec,
  computeFoldbackCurve,
  evaluatePowerEntry,
  powerPerBoardCostEur,
} from '../physics/model';
import { MASTER_40PIN_HEADER, POWER_REV_B_BOM } from '../components/KicadBomPinout';
import { POWER_SCORECARD_ROWS } from '../components/ConclusionScorecard';
import { POWER_AUDIT_DEFECTS, POWER_REVISION_STEPS } from '../components/AuditHistory';

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
function drawPdfPowerSchematic(
  doc: jsPDF,
  spec: PowerTopologySpec,
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
  const RED: [number, number, number] = [185, 28, 28];
  const BLUE: [number, number, number] = [3, 105, 161];
  const GREEN: [number, number, number] = [5, 150, 105];
  const AMBER: [number, number, number] = [180, 83, 9];

  const wire = (x1: number, y1: number, x2: number, y2: number, col = SLATE, lw = 0.28) => {
    doc.setDrawColor(...col);
    doc.setLineWidth(lw);
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };

  const dot = (x: number, y: number, col = SLATE) => {
    doc.setFillColor(...col);
    doc.circle(sx(x), sy(y), 0.55, 'F');
  };

  const lbl = (
    str: string,
    x: number,
    y: number,
    size = 5.4,
    col = SLATE,
    align: 'left' | 'center' | 'right' = 'left',
    bold = false
  ) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...col);
    doc.text(pdfSafe(str), sx(x), sy(y), { align });
  };

  const drawResH = (x1: number, y: number, len = 46, col = SLATE) => {
    const pad = 7;
    const body = len - 2 * pad;
    const step = body / 6;
    wire(x1, y, x1 + pad, y, col, 0.26);
    let px = x1 + pad;
    let py = y;
    for (let i = 0; i < 6; i++) {
      const nx = px + step;
      const ny = y + (i % 2 === 0 ? -4.5 : 4.5);
      wire(px, py, nx, i === 5 ? y : ny, col, 0.26);
      px = nx;
      py = i === 5 ? y : ny;
    }
    wire(x1 + len - pad, y, x1 + len, y, col, 0.26);
  };

  const drawCapV = (x: number, y1: number, h = 28, col = SLATE) => {
    const mid = y1 + h / 2;
    wire(x, y1, x, mid - 3, col, 0.26);
    wire(x - 8, mid - 3, x + 8, mid - 3, col, 0.38);
    wire(x - 8, mid + 3, x + 8, mid + 3, col, 0.38);
    wire(x, mid + 3, x, y1 + h, col, 0.26);
  };

  const drawGnd = (x: number, y: number) => {
    wire(x, y, x, y + 7, SLATE, 0.26);
    wire(x - 8, y + 7, x + 8, y + 7, SLATE, 0.34);
    wire(x - 5, y + 11, x + 5, y + 11, SLATE, 0.26);
    wire(x - 2, y + 15, x + 2, y + 15, SLATE, 0.22);
  };

  // Divider between Top (+5V) and Bottom (+3V3)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(sx(14), sy(148), sx(806), sy(148));
  lbl('A. +5V PI HEADER ENTRY (PINS 2, 4 -> +5V_HAT)', 16, 14, 5.2, RED, 'left', true);
  lbl('B. +3V3 BACK-FEED CLAMP & +3V3_ANA FILTER (PINS 1, 17)', 16, 162, 5.2, BLUE, 'left', true);

  // ================= TOP: +5V PATH =================
  // Pi Header box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.roundedRect(sx(16), sy(26), sw(106), sh(68), 0.9, 0.9, 'FD');
  lbl('PI 40-PIN HDR', 69, 44, 5.4, SLATE, 'center', true);
  lbl('Pins 2, 4: +5V', 69, 60, 5.1, RED, 'center', true);
  lbl('USB-C (D18)', 69, 76, 4.8, MUTED, 'center');

  wire(122, 56, 168, 56, RED, 0.38);

  if (spec.id === 'gemini_rev_b_efuse') {
    drawResH(168, 56, 48, SLATE);
    lbl('R_EF 1.8 Ohm', 192, 44, 4.9, SLATE, 'center', true);
    lbl('1206 0.5W', 192, 74, 4.5, MUTED, 'center');
    wire(216, 56, 276, 56, RED, 0.38);

    // Q_EF1 AO3401A Pass FET
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(...GREEN);
    doc.roundedRect(sx(276), sy(38), sw(94), sh(36), 0.9, 0.9, 'FD');
    lbl('Q_EF1 AO3401A', 323, 52, 5.1, GREEN, 'center', true);
    lbl('High-Side eFuse', 323, 66, 4.6, SLATE, 'center');

    // Q_EF2 Foldback PNP below
    dot(150, 56, RED);
    wire(150, 56, 150, 108, RED, 0.24);
    wire(150, 108, 204, 108, RED, 0.24);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(...GREEN);
    doc.roundedRect(sx(204), sy(94), sw(106), sh(28), 0.8, 0.8, 'FD');
    lbl('Q_EF2 MMBT3906', 257, 106, 4.8, GREEN, 'center', true);
    lbl('360mA -> 119mA', 257, 117, 4.5, SLATE, 'center');

    // Sense & Gate links
    dot(246, 56, SLATE);
    wire(246, 56, 246, 94, SLATE, 0.22);
    lbl('R_S 1k', 242, 82, 4.4, MUTED, 'right');

    wire(310, 108, 323, 108, GREEN, 0.24);
    wire(323, 74, 323, 120, GREEN, 0.24);
    dot(323, 108, GREEN);
    lbl('R_G 10k', 330, 113, 4.4, MUTED, 'left');
    drawGnd(323, 120);

    // Foldback R_FB line
    wire(370, 56, 434, 56, RED, 0.38);
    dot(402, 56, SLATE);
    wire(402, 56, 402, 134, MUTED, 0.2);
    wire(402, 134, 257, 134, MUTED, 0.2);
    wire(257, 134, 257, 122, MUTED, 0.2);
    lbl('R_FB 10k Foldback Loop', 336, 143, 4.5, MUTED, 'center');
  } else if (spec.id === 'rev_a_d18_bare') {
    wire(168, 56, 434, 56, RED, 0.38);
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(...RED);
    doc.roundedRect(sx(206), sy(36), sw(190), sh(40), 0.8, 0.8, 'FD');
    lbl('DIRECT COPPER (NO EFUSE)', 301, 52, 5.1, RED, 'center', true);
    lbl('Dead Short -> >5A Pi 5 Crash!', 301, 67, 4.6, SLATE, 'center');
  } else if (spec.id === 'pre_d18_j1_ideal_diode') {
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(...AMBER);
    doc.roundedRect(sx(168), sy(36), sw(124), sh(40), 0.8, 0.8, 'FD');
    lbl('J1 + Ideal Diode', 230, 52, 5.0, AMBER, 'center', true);
    lbl('LM66100 / Q1 (D5)', 230, 67, 4.5, MUTED, 'center');
    wire(292, 56, 326, 56, RED, 0.35);
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(...AMBER);
    doc.roundedRect(sx(326), sy(40), sw(82), sh(32), 0.8, 0.8, 'FD');
    lbl('F1 1A PTC', 367, 59, 5.0, AMBER, 'center', true);
    wire(408, 56, 434, 56, RED, 0.38);
  } else if (spec.id === 'ptc_ferrite_filter') {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(...AMBER);
    doc.roundedRect(sx(168), sy(38), sw(106), sh(36), 0.8, 0.8, 'FD');
    lbl('F1 500mA PTC', 221, 53, 5.0, AMBER, 'center', true);
    lbl('120ms lag (Ext)', 221, 66, 4.5, MUTED, 'center');
    wire(274, 56, 312, 56, RED, 0.35);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(71, 85, 105);
    doc.roundedRect(sx(312), sy(40), sw(94), sh(32), 0.8, 0.8, 'FD');
    lbl('FB1 600 Ohm', 359, 59, 5.0, SLATE, 'center', true);
    wire(406, 56, 434, 56, RED, 0.38);
  } else {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...BLUE);
    doc.roundedRect(sx(182), sy(36), sw(220), sh(40), 0.9, 0.9, 'FD');
    lbl('U_EF TPS25921A (SOIC-8 Ext)', 292, 52, 5.2, BLUE, 'center', true);
    lbl('90mOhm | 450mA Hiccup | 6.1V OVP', 292, 67, 4.6, SLATE, 'center');
    wire(402, 56, 434, 56, RED, 0.38);
  }

  // Bulk Cap Bank + PWR LED + +5V_HAT Block
  wire(434, 56, 650, 56, RED, 0.38);
  dot(472, 56, RED);
  drawCapV(472, 56, 36, SLATE);
  drawGnd(472, 92);
  lbl(spec.bulkCapType === 'solid_mlcc' ? 'C2a,b 2×22µF' : 'C2 100µF Elec', 485, 72, 4.9, SLATE, 'left', true);
  lbl(spec.bulkCapType === 'solid_mlcc' ? '1206 X5R (>25yr)' : '60 °C dry-out', 485, 86, 4.4, MUTED, 'left');

  dot(590, 56, RED);
  wire(590, 56, 590, 92, SLATE, 0.24);
  drawGnd(590, 92);
  lbl(spec.id === 'gemini_rev_b_efuse' ? 'R1 2.2k' : 'R1 1.0k', 598, 72, 4.7, SLATE, 'left', true);
  lbl('D2 PWR', 598, 85, 4.4, GREEN, 'left');

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(sx(650), sy(26), sw(154), sh(68), 0.9, 0.9, 'FD');
  lbl('+5V_HAT RAIL', 727, 44, 5.4, RED, 'center', true);
  lbl('-> 02 Doubler · 04 1W', 727, 60, 4.6, SLATE, 'center');
  lbl('-> 05 REL1/REL2', 727, 76, 4.6, SLATE, 'center');

  // ================= BOTTOM: +3V3 PATH =================
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(sx(16), sy(174), sw(106), sh(68), 0.9, 0.9, 'FD');
  lbl('PI 40-PIN HDR', 69, 192, 5.4, SLATE, 'center', true);
  lbl('Pins 1, 17: +3V3', 69, 208, 5.0, BLUE, 'center', true);
  lbl('45-60 mVpp Buck', 69, 224, 4.6, MUTED, 'center');

  wire(122, 202, 354, 202, BLUE, 0.36);

  // Digital bypass cap
  dot(172, 202, BLUE);
  drawCapV(172, 202, 30, SLATE);
  drawGnd(172, 232);
  lbl('C33d', 184, 216, 4.6, SLATE, 'left', true);
  lbl('100nF', 184, 228, 4.3, MUTED, 'left');

  // Back-feed Zener
  if (spec.has3v3BackfeedZener) {
    dot(266, 202, GREEN);
    wire(266, 202, 266, 232, GREEN, 0.28);
    drawGnd(266, 232);
    lbl('D_Z33 3.6V', 276, 216, 4.8, GREEN, 'left', true);
    lbl('BZT52C3V6', 276, 229, 4.4, MUTED, 'left');
  } else {
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(...RED);
    doc.roundedRect(sx(234), sy(216), sw(108), sh(30), 0.7, 0.7, 'FD');
    lbl('NO 3.6V ZENER', 288, 229, 4.6, RED, 'center', true);
    lbl('Pi-OFF lifts 5.1V', 288, 241, 4.3, SLATE, 'center');
  }

  // +3V3_ANA Filter
  if (spec.has3v3AnaFilter) {
    drawResH(354, 202, 46, SLATE);
    lbl('R_F33 10 Ohm', 377, 190, 4.8, SLATE, 'center', true);
    lbl('f_c=1.6 kHz', 377, 220, 4.4, MUTED, 'center');
    wire(400, 202, 650, 202, BLUE, 0.36);

    dot(472, 202, BLUE);
    drawCapV(472, 202, 30, SLATE);
    drawGnd(472, 232);
    lbl('C33a 10µF', 485, 217, 4.7, SLATE, 'left', true);
    lbl('-36 dB', 485, 229, 4.4, GREEN, 'left');

    dot(572, 202, BLUE);
    drawCapV(572, 202, 30, SLATE);
    drawGnd(572, 232);
    lbl('C33b', 584, 217, 4.7, SLATE, 'left', true);
    lbl('100nF', 584, 229, 4.3, MUTED, 'left');
  } else {
    wire(354, 202, 650, 202, BLUE, 0.36);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(...AMBER);
    doc.roundedRect(sx(418), sy(184), sw(182), sh(34), 0.8, 0.8, 'FD');
    lbl('NO +3V3_ANA FILTER', 509, 199, 5.0, AMBER, 'center', true);
    lbl('Raw Buck Ripple -> Pt1000', 509, 212, 4.5, SLATE, 'center');
  }

  // +3V3_ANA Output Block
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(...BLUE);
  doc.roundedRect(sx(650), sy(174), sw(154), sh(68), 0.9, 0.9, 'FD');
  lbl('+3V3_ANA RAIL', 727, 192, 5.4, BLUE, 'center', true);
  lbl('-> 01 Pt1000 LM393DR', 727, 208, 4.6, SLATE, 'center');
  lbl('-> 03 LM393 Watchdog', 727, 224, 4.6, SLATE, 'center');
}

export function buildPowerEntryPdfDoc(
  selectedTopology: PowerTopologyId,
  params: PowerSimParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toISOString().slice(0, 10);

  const activeSpec = POWER_TOPOLOGY_SPECS[selectedTopology];
  const activeRes = evaluatePowerEntry(selectedTopology, params);
  const revACost = powerPerBoardCostEur(POWER_TOPOLOGY_SPECS.rev_a_d18_bare, batchSize);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 06. Pi Power & Rail Budget', margin, 8.3);
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
      pdfSafe(`Rev B (Gemini Version) | 100% Basic Foldback eFuse + +3V3_ANA Filter + 3.6V Clamp | Generated ${dateStr}`),
      margin,
      pageH - 6.5
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.5, { align: 'right' });
  };

  const evalRows = POWER_TOPOLOGY_ORDER.map((id) => {
    const spec = POWER_TOPOLOGY_SPECS[id];
    const nom = evaluatePowerEntry(id, { ...params, activeFault: 'none' });
    const shortRes = evaluatePowerEntry(id, { ...params, activeFault: 'hat_5v_short' });
    const bfRes = evaluatePowerEntry(id, { ...params, activeFault: 'pi_off_24v_backfeed' });
    const unitCost = powerPerBoardCostEur(spec, batchSize);
    return { spec, nom, shortRes, bfRes, unitCost, savings: revACost - unitCost };
  });

  // =========================================================================
  // PAGE 1: EXECUTIVE SUMMARY, MASTER COMPARISON & FOLDBACK CURVE
  // =========================================================================
  addHeaderFooter(1, 9, `Executive Summary & Full-HAT Power Budget | ${batchSize}× Batch`);
  let y = 21.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Block 1 Pi Power Entry & Full-HAT Rail Budget Evaluation', margin, y);
  y += 5.4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Active: ${activeSpec.shortName} | ${batchSize}× JLCPCB | Pi +5V: ${params.pi5vRailV.toFixed(2)} V | Load: ${activeRes.total5vMa.toFixed(0)} mA (+5V) / ${activeRes.total3v3Ma.toFixed(1)} mA (+3V3)`
    ),
    margin,
    y
  );
  y += 7.0;

  // Section 1: Configured Bench Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Full-HAT Power Tree Snapshot (Subsystems 01-06 Combined)', margin, y);
  y += 3.0;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 18.0, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text(
    pdfSafe(`+5V Load:  02 Pump=${activeRes.breakdown[1].rail5vMa.toFixed(0)}mA | 04 1-Wire (${params.oneWireSensorCount}×)=${activeRes.breakdown[3].rail5vMa.toFixed(0)}mA | 05 REL1=${params.relayLoadMa}mA | Total=${activeRes.total5vMa.toFixed(0)} mA`),
    margin + 3,
    y + 5.5
  );
  doc.text(
    pdfSafe(`+3V3 Load: 01 Pt1000=1.6mA | 03 WD=2.8mA | 04/05/06=2.9mA | Total=${activeRes.total3v3Ma.toFixed(1)} mA | Ambient=${params.ambientTempC} °C`),
    margin + 3,
    y + 10.5
  );
  doc.text(
    pdfSafe(`Live Result: +5V_HAT=${activeRes.v5HatV.toFixed(2)} V | +3V3_ANA Ripple=${activeRes.v3v3AnaRippleMv.toFixed(1)} mVpp | Short=${activeRes.shortCurrentMa >= 2000 ? '>5A Crash' : `${activeRes.shortCurrentMa}mA`} | ${activeRes.faultVerdict}`),
    margin + 3,
    y + 15.5
  );
  y += 23.0;

  // Section 2: Master 5-Option Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. All 5 Block-1 Power Architectures Comparison (${batchSize}× JLCPCB Batch)`, margin, y);
  y += 3.0;

  const colW = [42, 18, 17, 23, 22, 23, 37];
  const headers = ['Architecture', 'Cost/bd', 'Fee', '+5V_HAT', 'Short I', '3V3 Rip', 'Pi-OFF 3V3 / Cap'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  headers.forEach((h, i) => {
    doc.text(h, cx + 1.6, y + 4.2);
    cx += colW[i];
  });
  y += 6.2;

  for (const r of evalRows) {
    const isRec = Boolean(r.spec.recommended);
    doc.setFillColor(isRec ? 236 : 255, isRec ? 253 : 255, isRec ? 245 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.1, 'FD');

    const cells = [
      pdfSafe(r.spec.shortName),
      `EUR ${r.unitCost.toFixed(2)}`,
      `EUR ${r.spec.jlcpcbFeederFeeEur.toFixed(0)}`,
      `${r.nom.v5HatV.toFixed(2)} V`,
      r.shortRes.shortCurrentMa >= 2000 ? '>5 A!' : `${r.shortRes.shortCurrentMa} mA`,
      `${r.nom.v3v3AnaRippleMv.toFixed(1)} mV`,
      `${r.bfRes.piOff3v3PeakV.toFixed(2)}V | ${r.spec.bulkCapType === 'solid_mlcc' ? 'MLCC' : 'Elec'}`,
    ];
    cx = margin;
    cells.forEach((val, i) => {
      doc.setFont(i === 0 ? 'helvetica' : 'courier', i === 0 && isRec ? 'bold' : 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(isRec && i === 0 ? 6 : 15, isRec && i === 0 ? 95 : 23, isRec && i === 0 ? 70 : 42);
      doc.text(val, cx + 1.6, y + 4.1);
      cx += colW[i];
    });
    y += 6.1;
  }
  y += 6.5;

  // Section 3: Foldback V-I Chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Foldback eFuse Characteristic: Pi +5V Current Drawn vs. HAT Short Collapse', margin, y);
  y += 3.2;

  const curve = computeFoldbackCurve(params.pi5vRailV);
  const chartX = margin + 12;
  const chartY = y;
  const chartW = contentW - 15;
  const chartH = 44;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const xPos = (v: number) => chartX + ((params.pi5vRailV - Math.max(0, Math.min(params.pi5vRailV, v))) / params.pi5vRailV) * chartW;
  const yPos = (ma: number) => chartY + ((1600 - Math.min(1600, Math.max(0, ma))) / 1600) * chartH;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.2);
  for (const ma of [0, 400, 800, 1200, 1600]) {
    const ty = yPos(ma);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(chartX, ty, chartX + chartW, ty);
    doc.setTextColor(100, 116, 139);
    doc.text(`${ma}mA`, margin, ty + 1.4);
  }
  for (const xv of [5, 4, 3, 2, 1, 0]) {
    const tx = xPos(Math.min(params.pi5vRailV, xv));
    doc.setDrawColor(241, 245, 249);
    doc.line(tx, chartY, tx, chartY + chartH);
    doc.setTextColor(100, 116, 139);
    doc.text(xv === 0 ? '0V Short' : `${xv}V`, tx, chartY + chartH + 3.6, { align: xv === 0 ? 'right' : 'center' });
  }

  const series: { key: keyof typeof curve[number]; rgb: [number, number, number]; width: number; label: string }[] = [
    { key: 'revACurrentMa', rgb: [225, 29, 72], width: 0.5, label: 'Rev A Bare (>5A Crash)' },
    { key: 'ptcCurrentMa', rgb: [217, 119, 6], width: 0.52, label: 'Option C PTC (1.45A)' },
    { key: 'revBCurrentMa', rgb: [5, 150, 105], width: 0.8, label: 'Rev B Foldback (360->119mA)' },
  ];
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(s.width);
    for (let i = 1; i < curve.length; i++) {
      doc.line(
        xPos(curve[i - 1].vOutV),
        yPos(Number(curve[i - 1][s.key])),
        xPos(curve[i].vOutV),
        yPos(Number(curve[i][s.key]))
      );
    }
  }

  let legX = chartX;
  const legY = chartY + chartH + 7.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(0.75);
    doc.line(legX, legY - 1, legX + 4.5, legY - 1);
    doc.setTextColor(51, 65, 85);
    doc.text(s.label, legX + 6, legY);
    legX += 54;
  }
  y = legY + 6.5;

  // Section 4: Active Topology BOM Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
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

  for (const item of activeSpec.bom.slice(0, 7)) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.3, 'FD');
    bx = margin;
    [pdfSafe(item.designator), pdfSafe(item.part), pdfSafe(item.packageType), item.jlcpcbClass, `EUR ${item.unitCostEur.toFixed(2)}`].forEach(
      (v, i) => {
        doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
        doc.setFontSize(6.5);
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

  evalRows.forEach(({ spec, nom, shortRes, bfRes, unitCost, savings }, idx) => {
    doc.addPage();
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    const c2 = powerPerBoardCostEur(spec, 2);
    const c5 = powerPerBoardCostEur(spec, 5);

    const optTitle = pdfSafe(`Option 0${idx + 1}: ${spec.name}`);
    doc.setFont('helvetica', 'bold');
    let titleSize = 11.2;
    doc.setFontSize(titleSize);
    while (doc.getTextWidth(optTitle) > contentW && titleSize > 8.4) {
      titleSize -= 0.3;
      doc.setFontSize(titleSize);
    }
    doc.setTextColor(15, 23, 42);
    doc.text(optTitle, margin, 21.0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(71, 85, 105);
    doc.text(
      pdfSafe(
        `Cost (${batchSize}×): EUR ${unitCost.toFixed(2)}/bd (2× EUR ${c2.toFixed(2)} | 5× EUR ${c5.toFixed(2)})  |  ${savings > 0 ? `Saves EUR ${savings.toFixed(2)}/bd vs Rev A` : savings < 0 ? `+EUR ${Math.abs(savings).toFixed(2)}/bd vs Rev A` : 'Rev A D18 Baseline'}  |  +5V_HAT: ${nom.v5HatV.toFixed(2)} V`
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
    doc.text('1. Authentic IEEE Schematic (Top: +5V Pi Header Entry | Bottom: +3V3 Clamp & Filter)', margin, Y_CIRCUIT_TITLE);
    drawPdfPowerSchematic(doc, spec, margin, Y_CIRCUIT_BOX, contentW, CIRCUIT_H);

    // 2. BOM Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. Bill of Materials (${spec.partCount} SMD Parts | Feeder Fee EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})`, margin, Y_BOM_TITLE);

    let ty = Y_BOM_TABLE;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, ty, contentW, 5.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(255, 255, 255);
    let ox = margin;
    ['Ref', 'Component', 'Package', 'LCSC Class', 'Est. Cost'].forEach((h, i) => {
      doc.text(h, ox + 1.5, ty + 3.6);
      ox += bomCol[i];
    });
    ty += 5.2;

    for (const item of spec.bom.slice(0, 7)) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, ty, contentW, 5.0, 'FD');
      ox = margin;
      [pdfSafe(item.designator), pdfSafe(item.part), pdfSafe(item.packageType), item.jlcpcbClass, `EUR ${item.unitCostEur.toFixed(2)}`].forEach(
        (v, i) => {
          doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
          doc.setFontSize(6.1);
          doc.setTextColor(15, 23, 42);
          doc.text(v, ox + 1.5, ty + 3.4);
          ox += bomCol[i];
        }
      );
      ty += 5.0;
    }

    // 3. Corner & Fault Stress Matrix
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Coupled Electrical & Fault Stress Results', margin, Y_CORNER_TITLE);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_CORNER_BOX, contentW, CORNER_BOX_H, 'FD');
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(30, 41, 59);
    doc.text(
      pdfSafe(`Nominal (${nom.total5vMa.toFixed(0)} mA +5V): +5V_HAT=${nom.v5HatV.toFixed(2)} V (drop ${(nom.v5DropV * 1000).toFixed(0)} mV) | +3V3_ANA=${nom.v3v3AnaV.toFixed(2)} V | Ripple=${nom.v3v3AnaRippleMv.toFixed(1)} mVpp`),
      margin + 3,
      Y_CORNER_BOX + 5.8
    );
    doc.text(
      pdfSafe(`HAT +5V Dead Short:  ${shortRes.faultVerdict} | I_short=${shortRes.shortCurrentMa >= 2000 ? '>5 A Pi 5 Crash!' : `${shortRes.shortCurrentMa} mA`} | P_FET=${shortRes.passFetShortPowerW.toFixed(2)} W (T_J=${shortRes.passFetShortTjC.toFixed(0)} °C) | Inrush=${nom.hotPlugInrushA.toFixed(2)} A`),
      margin + 3,
      Y_CORNER_BOX + 11.8
    );
    doc.text(
      pdfSafe(`Pi-OFF +24V Back-Feed: ${bfRes.faultVerdict} (+3V3 Peak = ${bfRes.piOff3v3PeakV.toFixed(2)} V) | 60 °C Cap Life = ${nom.capLifetimeYearsAt60C.toFixed(1)} yr (${spec.bulkCapType === 'solid_mlcc' ? 'Solid MLCC' : 'Electrolytic'})`),
      margin + 3,
      Y_CORNER_BOX + 17.8
    );

    // 4. Pros & Cons
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4. Engineering Strengths & Trade-Offs', margin, Y_PROCON_TITLE);

    const halfW = (contentW - 4) / 2;
    const pcH = 51.0;

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin, Y_PROCON_BODY, halfW, pcH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(22, 101, 52);
    doc.text('PROS / STRENGTHS', margin + 3, Y_PROCON_BODY + 5.0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(20, 83, 45);
    let proY = Y_PROCON_BODY + 9.5;
    for (const p of spec.pros.slice(0, 6)) {
      const lines = doc.splitTextToSize(pdfSafe(`+ ${p}`), halfW - 6).slice(0, 2);
      if (proY + lines.length * 3.1 <= Y_PROCON_BODY + pcH - 2) {
        doc.text(lines, margin + 3, proY);
        proY += lines.length * 3.1 + 1.2;
      }
    }

    const conX = margin + halfW + 4;
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.rect(conX, Y_PROCON_BODY, halfW, pcH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(159, 18, 57);
    doc.text('CONS / RISKS', conX + 3, Y_PROCON_BODY + 5.0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(136, 19, 55);
    let conY = Y_PROCON_BODY + 9.5;
    for (const c of spec.cons.slice(0, 5)) {
      const lines = doc.splitTextToSize(pdfSafe(`- ${c}`), halfW - 6).slice(0, 2);
      if (conY + lines.length * 3.1 <= Y_PROCON_BODY + pcH - 2) {
        doc.text(lines, conX + 3, conY);
        conY += lines.length * 3.1 + 1.4;
      }
    }

    // 5. Fail-Safe Profile & Pi Compatibility
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5. Fail-Safe Behavior & Raspberry Pi 4 / 5 Compatibility', margin, Y_SEC_TITLE);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_SEC_BOX, contentW, SEC_BOX_H, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(15, 23, 42);
    doc.text('FAIL-SAFE & PROTECTION PROFILE:', margin + 3, Y_SEC_BOX + 5.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.failSafeProfile), contentW - 6).slice(0, 3), margin + 3, Y_SEC_BOX + 9.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(15, 23, 42);
    doc.text('RASPBERRY PI / SOFTWARE NOTE:', margin + 3, Y_SEC_BOX + 21.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(spec.softwareNote), contentW - 6).slice(0, 2), margin + 3, Y_SEC_BOX + 26.0);
  });

  // =========================================================================
  // PAGE 7: 3-WAY ENGINEERING SCORECARD & FINAL VERDICT
  // =========================================================================
  doc.addPage();
  addHeaderFooter(7, 9, 'Engineering Conclusion | Rev A D18 vs. Option C PTC vs. Rev B Gemini');
  let cy7 = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Engineering Conclusion: Rev B Foldback eFuse + +3V3_ANA Filter', margin, cy7);
  cy7 += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Direct comparison proving why Rev B protects Pi 5 and analog accuracy at LOWER cost than Rev A D18.',
    margin,
    cy7
  );
  cy7 += 7.5;

  const sCols = [42, 44, 46, 50];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, cy7, contentW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(255, 255, 255);
  let sx7 = margin;
  ['Criterion', 'Rev A D18 Bare', 'Option C (PTC)', 'Rev B (Gemini)'].forEach((h, i) => {
    doc.text(h, sx7 + 1.8, cy7 + 4.4);
    sx7 += sCols[i];
  });
  cy7 += 6.5;

  for (const r of POWER_SCORECARD_ROWS) {
    const rowH = 10.2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cy7, contentW, rowH, 'FD');
    doc.setFillColor(236, 253, 245);
    doc.rect(margin + sCols[0] + sCols[1] + sCols[2], cy7, sCols[3], rowH, 'F');
    sx7 = margin;
    [r.criterion, r.revAD18, r.optionCPtc, r.revBGemini].forEach((v, i) => {
      doc.setFont('helvetica', i === 0 || i === 3 ? 'bold' : 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(i === 3 ? 6 : 15, i === 3 ? 95 : 23, i === 3 ? 70 : 42);
      doc.text(doc.splitTextToSize(pdfSafe(v), sCols[i] - 3).slice(0, 2), sx7 + 1.8, cy7 + 4.3);
      sx7 += sCols[i];
    });
    cy7 += rowH;
  }

  cy7 += 9;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, cy7, contentW, 38, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text('RECOMMENDED RELEASE ARCHITECTURE: BLOCK 1 REV B (GEMINI FOLDBACK EFUSE)', margin + 4, cy7 + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(20, 83, 45);
  doc.text(
    doc.splitTextToSize(
      pdfSafe(
        'Rev B preserves D15/D18 (Pi runs from its own USB-C supply, zero external J1 barrel/ideal diode bloat) while eliminating all 6 Block-1 vulnerabilities using 100% JLCPCB Basic parts (EUR 0.00 fee, EUR 0.34/board — cheaper than Rev A!). A 5-part AO3401A + MMBT3906 foldback eFuse (360 mA knee -> 119 mA dead short in 1.8 µs, 0.57 W continuous) prevents Pi 5 reboots and soft-starts the 2× 22 µF solid MLCC bank; a 10 Ohm + 10 µF filter quiets +3V3_ANA by -36 dB for Pt1000/LM393; and BZT52C3V6 clamps Pi-OFF +24V back-feed <= 3.62 V.'
      ),
      contentW - 8
    ),
    margin + 4,
    cy7 + 14
  );

  // =========================================================================
  // PAGE 8: BLOCK 1 KICAD BOM & BLOCK 3 MASTER 40-PIN PI HEADER MAP
  // =========================================================================
  doc.addPage();
  addHeaderFooter(8, 9, 'Block 1 Rev B KiCad BOM & Block 3 Master 40-Pin Pi Header');
  let ky = 21.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Block 1 KiCad BOM & Block 3 Master 40-Pin Pi Header Map', margin, ky);
  ky += 4.8;
  const totalQty = POWER_REV_B_BOM.reduce((s, r) => s + r.qty, 0);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(`${totalQty} SMD Parts (${POWER_REV_B_BOM.length} Basic Lines) | EUR 0.34/board | EUR 0.00 Feeder Fee | Zero GPIO Conflicts`),
    margin,
    ky
  );
  ky += 6.2;

  const kCols = [26, 9, 34, 17, 20, 76];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ky, contentW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let kx = margin;
  ['RefDes', 'Qty', 'Value / Part', 'Pkg', 'LCSC', 'Engineering Purpose'].forEach((h, i) => {
    doc.text(h, kx + 1.3, ky + 3.7);
    kx += kCols[i];
  });
  ky += 5.5;

  for (const r of POWER_REV_B_BOM) {
    const pLines = doc.splitTextToSize(pdfSafe(r.purpose), kCols[5] - 3).slice(0, 2);
    const rh = Math.max(5.5, pLines.length * 2.9 + 2.1);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rh, 'FD');

    kx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(r.refDes), kx + 1.3, ky + 3.4);
    kx += kCols[0];
    doc.setFont('courier', 'normal');
    doc.text(String(r.qty), kx + 2.2, ky + 3.4);
    kx += kCols[1];
    doc.text(pdfSafe(r.value), kx + 1.3, ky + 3.4);
    kx += kCols[2];
    doc.text(pdfSafe(r.footprint), kx + 1.3, ky + 3.4);
    kx += kCols[3];
    doc.setTextColor(5, 150, 105);
    doc.text(r.lcscPart, kx + 1.3, ky + 3.4);
    kx += kCols[4];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(pLines, kx + 1.3, ky + 3.4);
    ky += rh;
  }

  ky += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Block 3: Master 40-Pin Raspberry Pi 4 / Pi 5 Header Map (All 6 Subsystems)', margin, ky);
  ky += 3.0;

  const pCols = [34, 24, 34, 34, 56];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, ky, contentW, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let px = margin;
  ['Header Pin(s)', 'BCM GPIO', 'HAT Net', 'Subsystem', 'Rev B / D / E Status'].forEach((h, i) => {
    doc.text(h, px + 1.3, ky + 3.6);
    px += pCols[i];
  });
  ky += 5.4;

  for (const p of MASTER_40PIN_HEADER) {
    const nLines = doc.splitTextToSize(pdfSafe(p.revStatus), pCols[4] - 2.5).slice(0, 2);
    const rh = Math.max(5.4, nLines.length * 2.85 + 2.0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rh, 'FD');

    px = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(p.headerPin), px + 1.2, ky + 3.4);
    px += pCols[0];
    doc.setFont('courier', 'normal');
    doc.text(pdfSafe(p.gpio), px + 1.2, ky + 3.4);
    px += pCols[1];
    doc.setTextColor(3, 105, 161);
    doc.text(pdfSafe(p.netName), px + 1.2, ky + 3.4);
    px += pCols[2];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafe(p.subsystem), px + 1.2, ky + 3.4);
    px += pCols[3];
    doc.text(nLines, px + 1.2, ky + 3.4);
    ky += rh;
  }

  // =========================================================================
  // PAGE 9: REVISION HISTORY & PWR-01..06 AUDIT LOG
  // =========================================================================
  doc.addPage();
  addHeaderFooter(9, 9, 'Design Evolution & PWR-01..06 Engineering Audit Log');
  let ay = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Block 1 Power Entry Evolution & Defect Resolution Audit Log', margin, ay);
  ay += 6.5;

  for (const step of POWER_REVISION_STEPS) {
    const isRec = step.status === 'RECOMMENDED';
    doc.setFillColor(isRec ? 236 : 248, isRec ? 253 : 250, isRec ? 245 : 252);
    doc.setDrawColor(isRec ? 16 : 203, isRec ? 185 : 213, isRec ? 129 : 225);
    doc.rect(margin, ay, contentW, 14.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(isRec ? 6 : 15, isRec ? 95 : 23, isRec ? 70 : 42);
    doc.text(pdfSafe(`${step.rev} (${step.status}) - ${step.title}`), margin + 3, ay + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(step.summary), contentW - 6).slice(0, 2), margin + 3, ay + 8.6);
    ay += 16.5;
  }

  ay += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('Audit Defect Resolution Table (PWR-01 through PWR-06)', margin, ay);
  ay += 3.2;

  const aCols = [16, 26, 48, 52, 40];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ay, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let ax = margin;
  ['ID', 'Area', 'Rev A Defect', 'Rev B (Gemini) Fix', 'Measured Impact'].forEach((h, i) => {
    doc.text(h, ax + 1.5, ay + 4.0);
    ax += aCols[i];
  });
  ay += 6.0;

  for (const row of POWER_AUDIT_DEFECTS) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    const fLines = doc.splitTextToSize(pdfSafe(row.finding), aCols[2] - 2.5).slice(0, 4);
    const fixLines = doc.splitTextToSize(pdfSafe(row.fixInRevB), aCols[3] - 2.5).slice(0, 4);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.9);
    const impLines = doc.splitTextToSize(pdfSafe(row.measuredImpact), aCols[4] - 3.0).slice(0, 4);
    const maxL = Math.max(fLines.length, fixLines.length, impLines.length, 2);
    const rh = maxL * 3.0 + 3.0;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ay, contentW, rh, 'FD');

    let rx = margin + 1.4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(15, 23, 42);
    doc.text(row.id, rx, ay + 3.8);
    rx += aCols[0];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.text(doc.splitTextToSize(pdfSafe(row.area), aCols[1] - 2.5).slice(0, 3), rx, ay + 3.8);
    rx += aCols[1];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(fLines, rx, ay + 3.8);
    rx += aCols[2];

    doc.setTextColor(6, 95, 70);
    doc.text(fixLines, rx, ay + 3.8);
    rx += aCols[3];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.9);
    doc.setTextColor(15, 23, 42);
    doc.text(impLines, rx, ay + 3.8);

    ay += rh;
  }

  return doc;
}

export function exportPowerEntryPdfReport(
  selectedTopology: PowerTopologyId,
  params: PowerSimParams,
  batchSize: 2 | 5
): void {
  const doc = buildPowerEntryPdfDoc(selectedTopology, params, batchSize);
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`CoSTOS_06_Pi_Power_Entry_RevB_${batchSize}x_${dateStr}.pdf`);
}
