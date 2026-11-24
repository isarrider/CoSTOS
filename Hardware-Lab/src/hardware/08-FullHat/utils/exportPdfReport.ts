import { jsPDF } from 'jspdf';
import {
  CostCalcOptions,
  HatEdition,
  computeFullHatCosts,
  getDnpList,
  getInterBlockNets,
  getMasterBom,
  getMasterBomStats,
} from '../data/masterBom';

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

export function buildFullHatCostsPdfDoc(
  opts: CostCalcOptions,
  edition: HatEdition = 'onewire'
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toISOString().slice(0, 10);
  const totalPages = 6;
  const isAllPt = edition === 'all_pt1000';

  const masterBom = getMasterBom(edition);
  const dnpList = getDnpList(edition);
  const interNets = getInterBlockNets(edition);
  const stats = getMasterBomStats(edition);
  const totalParts = stats.smdPartCount + stats.thtPartCount;
  const netCount = isAllPt ? 77 : 67;
  const activeCosts = computeFullHatCosts(opts, edition);
  const batch2 = computeFullHatCosts({ ...opts, batchSize: 2 }, edition);
  const batch5 = computeFullHatCosts({ ...opts, batchSize: 5 }, edition);
  const batch10 = computeFullHatCosts({ ...opts, batchSize: 10 }, edition);
  const batch25 = computeFullHatCosts({ ...opts, batchSize: 25 }, edition);

  const hatLabel = isAllPt ? 'CoSTOS All-Pt1000 HAT (8x Mux, 2x8P)' : 'CoSTOS 1-Wire HAT';

  const addHeaderFooter = (pageNum: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(255, 255, 255);
    doc.text(`${hatLabel} | 08. Full-HAT Costs, Master BOM & KiCad/SPICE`, margin, 8.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafe(subtitle), pageW - margin, 8.3, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafe(
        `Rev B/D/E (${isAllPt ? 'All-Pt1000 8x' : '1-Wire'}) | ${stats.smdPartCount} SMD (${stats.uniqueSmdReels} Reels) + ${stats.thtPartCount} THT | DNP: J4 REL1, J3 PUMP2, J5 REL2, ID-EEPROM${isAllPt ? '' : ', DS2482'} | ${dateStr}`
      ),
      margin,
      pageH - 6.5
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.5, { align: 'right' });
  };

  // =========================================================================
  // PAGE 1: EXPECTED COSTS BREAKDOWN & MULTI-BATCH COMPARISON
  // =========================================================================
  addHeaderFooter(1, `Expected Landed Costs | ${opts.batchSize}× Batch`);
  let y = 21.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`Expected Build & JLCPCB PCBA Costs - ${hatLabel}`), margin, y);
  y += 5.4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Batch: ${opts.batchSize}× Boards | Shipping: ${opts.includeShipping ? 'EUR 14.50 EU' : 'Excl.'} | THT Hardware: ${opts.includeThtHardware ? 'Incl.' : 'Excl.'} | VAT 19%: ${opts.includeVat19 ? 'Incl.' : 'Excl.'} | 0.1% Fee: ${opts.conservative01PctFee ? 'Conservative (+EUR 8.40)' : 'Preferred (EUR 0)'}`
    ),
    margin,
    y
  );
  y += 7.0;

  // KPI Highlight Cards (3 columns)
  const kpiW = (contentW - 6) / 3;
  const kpis = [
    {
      title: `${isAllPt ? 'ALL-PT1000 8× MUX' : 'GEMINI REV B/D/E'} (${opts.batchSize}×)`,
      big: `EUR ${activeCosts.revBGemini.perBoardEur.toFixed(2)} / bd`,
      sub: `Order Total: EUR ${activeCosts.revBGemini.grandTotalOrderEur.toFixed(2)} | Ext Fees: EUR ${activeCosts.revBGemini.extendedFeesOrderEur.toFixed(2)}`,
      fill: [236, 253, 245] as [number, number, number],
      stroke: [16, 185, 129] as [number, number, number],
      text: [6, 95, 70] as [number, number, number],
    },
    {
      title: `${isAllPt ? '1× MAX31865 + 8-CH MUX' : 'REPO REV A D22-D25'} (${opts.batchSize}×)`,
      big: `EUR ${activeCosts.revAD25Repo.perBoardEur.toFixed(2)} / bd`,
      sub: `Order Total: EUR ${activeCosts.revAD25Repo.grandTotalOrderEur.toFixed(2)} | Ext Fees: EUR ${activeCosts.revAD25Repo.extendedFeesOrderEur.toFixed(2)}`,
      fill: [255, 251, 235] as [number, number, number],
      stroke: [217, 119, 6] as [number, number, number],
      text: [146, 64, 14] as [number, number, number],
    },
    {
      title: `SAVINGS VS BASELINE (${opts.batchSize}×)`,
      big: `-EUR ${(activeCosts.revAD25Repo.perBoardEur - activeCosts.revBGemini.perBoardEur).toFixed(2)} / bd`,
      sub: `Saves EUR ${(activeCosts.revAD25Repo.grandTotalOrderEur - activeCosts.revBGemini.grandTotalOrderEur).toFixed(2)} vs ${isAllPt ? '1×MAX' : 'D25'} (-EUR ${(activeCosts.revAPreD25.grandTotalOrderEur - activeCosts.revBGemini.grandTotalOrderEur).toFixed(2)} vs ${isAllPt ? '8×MAX' : 'Pre-D25'})`,
      fill: [239, 246, 255] as [number, number, number],
      stroke: [37, 99, 235] as [number, number, number],
      text: [30, 64, 175] as [number, number, number],
    },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiW + 3);
    doc.setFillColor(...k.fill);
    doc.setDrawColor(...k.stroke);
    doc.setLineWidth(0.35);
    doc.roundedRect(kx, y, kpiW, 22, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(...k.text);
    doc.text(pdfSafe(k.title), kx + 3, y + 5.2);
    doc.setFont('courier', 'bold');
    doc.setFontSize(11.5);
    doc.text(pdfSafe(k.big), kx + 3, y + 12.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(pdfSafe(k.sub), kpiW - 5).slice(0, 2), kx + 3, y + 17.0);
  });
  y += 28.0;

  // Section 1: Detailed Line-by-Line Cost Table for Selected Batch
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. Line-by-Line Order Cost Breakdown (${opts.batchSize}× Populated Boards)`, margin, y);
  y += 3.2;

  const cCols = [62, 40, 40, 40];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  (isAllPt
    ? ['Cost Line Item (Order Total)', '8x MAX31865 HAT', '1x MAX + 8Ch Mux', 'All-Pt1000 8x Mux']
    : ['Cost Line Item (Order Total)', 'Pre-D25 Rev A', 'Repo Rev A (D25)', 'Rev B/D/E (Gemini)']
  ).forEach((h, i) => {
    doc.text(h, cx + 1.8, y + 4.1);
    cx += cCols[i];
  });
  y += 6.0;

  const costRows: [string, string, string, string, boolean?][] = [
    [
      '2-Layer 65×56 mm HAT PCB Fab (5 pcs min)',
      `EUR ${activeCosts.revAPreD25.pcbFabOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.pcbFabOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.pcbFabOrderEur.toFixed(2)}`,
    ],
    [
      'JLCPCB Economic PCBA Setup + Stencil',
      `EUR ${activeCosts.revAPreD25.smtSetupAndStencilEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.smtSetupAndStencilEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.smtSetupAndStencilEur.toFixed(2)}`,
    ],
    [
      `SMT Solder Joints (${stats.smdJointsPerBoard} joints/bd @ 0.0016)`,
      `EUR ${activeCosts.revAPreD25.solderJointsOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.solderJointsOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.solderJointsOrderEur.toFixed(2)}`,
    ],
    [
      'JLCPCB Extended Feeder Loading Fees',
      `EUR ${activeCosts.revAPreD25.extendedFeesOrderEur.toFixed(2)} (${activeCosts.revAPreD25.extendedReelCount}x)`,
      `EUR ${activeCosts.revAD25Repo.extendedFeesOrderEur.toFixed(2)} (${activeCosts.revAD25Repo.extendedReelCount}x)`,
      `EUR ${activeCosts.revBGemini.extendedFeesOrderEur.toFixed(2)} (${activeCosts.revBGemini.extendedReelCount}x)`,
    ],
    [
      `Populated SMD Parts (${opts.batchSize}× boards)`,
      `EUR ${activeCosts.revAPreD25.smdPartsOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.smdPartsOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.smdPartsOrderEur.toFixed(2)}`,
    ],
    [
      'THT Connectors, 40-Pin Header & M2.5 Kit',
      `EUR ${activeCosts.revAPreD25.thtHardwareOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.thtHardwareOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.thtHardwareOrderEur.toFixed(2)}`,
    ],
    [
      'EU Shipping (Global Standard Direct)',
      `EUR ${activeCosts.revAPreD25.shippingOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.shippingOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.shippingOrderEur.toFixed(2)}`,
    ],
    [
      'Subtotal (Excl. VAT)',
      `EUR ${activeCosts.revAPreD25.subtotalExVatEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.subtotalExVatEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.subtotalExVatEur.toFixed(2)}`,
    ],
    [
      `EU / German VAT (19% MwSt)`,
      `EUR ${activeCosts.revAPreD25.vatEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.vatEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.vatEur.toFixed(2)}`,
    ],
    [
      `GRAND TOTAL ORDER (${opts.batchSize}× BOARDS)`,
      `EUR ${activeCosts.revAPreD25.grandTotalOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revAD25Repo.grandTotalOrderEur.toFixed(2)}`,
      `EUR ${activeCosts.revBGemini.grandTotalOrderEur.toFixed(2)}`,
      true,
    ],
    [
      'LANDED COST PER BOARD',
      `EUR ${activeCosts.revAPreD25.perBoardEur.toFixed(2)} / bd`,
      `EUR ${activeCosts.revAD25Repo.perBoardEur.toFixed(2)} / bd`,
      `EUR ${activeCosts.revBGemini.perBoardEur.toFixed(2)} / bd`,
      true,
    ],
  ];

  for (const row of costRows) {
    const isBold = Boolean(row[4]);
    doc.setFillColor(isBold ? 236 : 255, isBold ? 253 : 255, isBold ? 245 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, isBold ? 6.2 : 5.4, 'FD');
    cx = margin;
    [row[0], row[1], row[2], row[3]].forEach((val, i) => {
      doc.setFont(i === 0 ? 'helvetica' : 'courier', isBold || i === 3 ? 'bold' : 'normal');
      doc.setFontSize(isBold ? 6.9 : 6.4);
      doc.setTextColor(i === 3 ? 6 : 15, i === 3 ? 95 : 23, i === 3 ? 70 : 42);
      doc.text(pdfSafe(val), cx + 1.8, y + (isBold ? 4.3 : 3.7));
      cx += cCols[i];
    });
    y += isBold ? 6.2 : 5.4;
  }
  y += 7.0;

  // Section 2: Multi-Batch Scaling Table (2x, 5x, 10x, 25x)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Batch Volume Scaling: Per-Board & Order Totals (2× / 5× / 10× / 25×)', margin, y);
  y += 3.2;

  const bCols = [24, 38, 38, 42, 40];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  let bx = margin;
  ['Batch', 'Pre-D25 / bd', 'Repo D25 / bd', 'Gemini Rev B / bd', 'Gemini Order Total'].forEach((h, i) => {
    doc.text(h, bx + 1.8, y + 4.0);
    bx += bCols[i];
  });
  y += 5.8;

  for (const [label, res] of [
    ['2× Proto', batch2],
    ['5× Sweet Spot', batch5],
    ['10× Small Run', batch10],
    ['25× Club Run', batch25],
  ] as const) {
    doc.setFillColor(label.startsWith(`${opts.batchSize}×`) ? 236 : 255, label.startsWith(`${opts.batchSize}×`) ? 253 : 255, label.startsWith(`${opts.batchSize}×`) ? 245 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.6, 'FD');
    bx = margin;
    [
      label,
      `EUR ${res.revAPreD25.perBoardEur.toFixed(2)}`,
      `EUR ${res.revAD25Repo.perBoardEur.toFixed(2)}`,
      `EUR ${res.revBGemini.perBoardEur.toFixed(2)}`,
      `EUR ${res.revBGemini.grandTotalOrderEur.toFixed(2)}`,
    ].forEach((val, i) => {
      doc.setFont(i === 0 ? 'helvetica' : 'courier', i === 0 || i >= 3 ? 'bold' : 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(i >= 3 ? 6 : 15, i >= 3 ? 95 : 23, i >= 3 ? 70 : 42);
      doc.text(pdfSafe(val), bx + 1.8, y + 3.8);
      bx += bCols[i];
    });
    y += 5.6;
  }

  y += 6.5;
  // Visual Comparison Bar Chart for Selected Batch
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Per-Board Landed Cost Comparison (${opts.batchSize}× Batch)`, margin, y);
  y += 3.5;

  const maxBarVal = Math.max(activeCosts.revAPreD25.perBoardEur, 1);
  const barItems = [
    { name: 'Pre-D25 Rev A', val: activeCosts.revAPreD25.perBoardEur, col: [225, 29, 72] as [number, number, number] },
    { name: 'Repo Rev A (D25)', val: activeCosts.revAD25Repo.perBoardEur, col: [217, 119, 6] as [number, number, number] },
    { name: 'Gemini Rev B/D/E', val: activeCosts.revBGemini.perBoardEur, col: [5, 150, 105] as [number, number, number] },
  ];
  for (const bi of barItems) {
    const barMaxW = contentW - 62;
    const bw = Math.max(4, (bi.val / maxBarVal) * barMaxW);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    doc.text(bi.name, margin, y + 4.3);
    doc.setFillColor(...bi.col);
    doc.roundedRect(margin + 36, y + 0.6, bw, 5.2, 0.8, 0.8, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`EUR ${bi.val.toFixed(2)}/bd`, margin + 38 + bw, y + 4.4);
    y += 7.5;
  }

  // =========================================================================
  // PAGE 2: SUBSYSTEM ROLL-UP & UNPOPULATED (DNP) SAVINGS
  // =========================================================================
  doc.addPage();
  addHeaderFooter(2, 'Subsystem Roll-Up & Unpopulated (DNP) Footprint List');
  let y2 = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Full-HAT Architecture Roll-Up & Unpopulated (DNP) Policy', margin, y2);
  y2 += 6.5;

  const subSummary = [
    ['01. Pt1000 Core (+Ch1)', 'Rev D', 'LM393DR 72 Hz ratiometric + 0.1% BIST + 24V ESD', '0.8mA +5V | 1.6mA +3V3', 'EUR 0.00 (Pref 0.1%)'],
    ['02. Pump PWM Supply', 'Rev E', 'LM393DR 60 kHz + AO3401A/3400A CMOS + SS14 -> +8.8V', '13mA +5V | 0mA +3V3', 'EUR 0.00 (Basic)'],
    ['03. Hardware Watchdog', 'Rev B', 'LM393DR dual Schmitt (15.4s REL / 17.7s PWM)', '1.2mA +5V | 2.8mA +3V3', 'EUR 0.00 (Basic)'],
    isAllPt
      ? ['04. Pt1000 Mux (Ch2-8)', 'Rev D', '7× AO3400A + 47R 1206 + PESD24V reusing U1/0.1%', '0mA +5V | 0mA extra', 'EUR 0.00 (0 new reels)']
      : ['04. 1-Wire Buses A/B', 'Rev B', '2× 2N7002 5V level-shifters + SS14 + 100R lim', '15mA +5V | 0.8mA +3V3', 'EUR 0.00 (Basic)'],
    ['05. Pump Out (J4 REL1 DNP)', 'Rev B', 'Class-B push-pull inside R9 + FB1/RB1 (J4 REL1 / J5 REL2 DNP)', '8mA +5V | 1.4mA +3V3', 'EUR 0.00 (Basic)'],
    ['06. Pi Power & Budget', 'Rev B', 'Foldback eFuse (360->119mA) + +3V3_ANA + 3.6V', '1.5mA +5V | 0.7mA +3V3', 'EUR 0.00 (Basic)'],
  ];

  const sCols = [35, 13, 66, 38, 30];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y2, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(255, 255, 255);
  let sx2 = margin;
  ['Subsystem', 'Rev', 'Core Hardware Topology', 'Nominal Rail Load', 'JLCPCB Ext Fee'].forEach((h, i) => {
    doc.text(h, sx2 + 1.5, y2 + 4.0);
    sx2 += sCols[i];
  });
  y2 += 6.0;

  for (const r of subSummary) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y2, contentW, 6.8, 'FD');
    sx2 = margin;
    r.forEach((v, i) => {
      doc.setFont(i >= 3 ? 'courier' : 'helvetica', i === 0 || i === 4 ? 'bold' : 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(i === 4 ? 6 : 15, i === 4 ? 95 : 23, i === 4 ? 70 : 42);
      doc.text(pdfSafe(v), sx2 + 1.5, y2 + 4.4);
      sx2 += sCols[i];
    });
    y2 += 6.8;
  }

  y2 += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe('Unpopulated (DNP / n.f.) PCB Footprints - Zero Assembly Cost Until Needed'), margin, y2);
  y2 += 3.5;

  const dCols = [34, 34, 38, 58, 18];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y2, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(255, 255, 255);
  let dx = margin;
  ['DNP RefDes', 'Optional Feature', 'PCB Footprint', 'Rationale', 'Later +EUR'].forEach((h, i) => {
    doc.text(h, dx + 1.5, y2 + 3.9);
    dx += dCols[i];
  });
  y2 += 5.8;

  for (const d of dnpList) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    const rLines = doc.splitTextToSize(pdfSafe(d.reason), dCols[3] - 3).slice(0, 2);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    const fpLines = doc.splitTextToSize(pdfSafe(d.footprint), dCols[2] - 2.6).slice(0, 2);
    const maxLines = Math.max(rLines.length, fpLines.length);
    const rh = Math.max(7.4, maxLines * 3.0 + 2.8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y2, contentW, rh, 'FD');

    dx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(d.refDes), dx + 1.4, y2 + 4.0);
    dx += dCols[0];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(d.block), dx + 1.4, y2 + 4.0);
    dx += dCols[1];
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text(fpLines, dx + 1.4, y2 + 3.8);
    dx += dCols[2];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.text(rLines, dx + 1.4, y2 + 3.8);
    dx += dCols[3];
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(5, 150, 105);
    doc.text(`+${d.upgradeCostEur.toFixed(2)}`, dx + 1.4, y2 + 4.0);
    y2 += rh;
  }

  y2 += 9;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y2, contentW, 28, 1.4, 1.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(6, 95, 70);
  doc.text(`REEL CONSOLIDATION RESULT: ${stats.uniqueSmdReels} UNIQUE REELS -> ZERO EXTENDED IC FEES!`, margin + 4, y2 + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(20, 83, 45);
  doc.text(
    doc.splitTextToSize(
      pdfSafe(
        `By sharing ONE LM393DR SOIC-8 reel across U1 (Pt1000), U3 (Pump Supply), and U4 (Watchdog), depopulating J4 REL1 (dropping 2 reels: 4.7 Ohm & Yellow LED), and consolidating 12× 1N4148W, 4× SS14, 5× AO3400A, 2× AO3401A, 2× MMBT3904, 4× MMBT3906, and 11× 100 nF MLCCs, the entire populated HAT uses ${stats.smdPartCount} SMD parts across only ${stats.uniqueSmdReels} unique reels (EUR ${stats.smdPartsPerBoardEur.toFixed(2)}/board SMD silicon + EUR ${stats.thtHardwarePerBoardEur.toFixed(2)}/board THT hardware).`
      ),
      contentW - 8
    ),
    margin + 4,
    y2 + 12.5
  );

  // =========================================================================
  // PAGES 3 & 4: COMPLETE DEDUPLICATED MASTER BOM (ALL POPULATED PARTS)
  // =========================================================================
  const bomCols = [34, 8, 24, 16, 17, 15, 14, 54];
  const drawBomHeader = (py: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, py, contentW, 5.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(255, 255, 255);
    let bx3 = margin;
    ['Unique RefDes', 'Qty', 'Value', 'Pkg', 'LCSC', 'Class', 'Ext EUR', 'Board-Wide Purpose'].forEach((h, i) => {
      doc.text(h, bx3 + 1.2, py + 3.7);
      bx3 += bomCols[i];
    });
    return py + 5.4;
  };

  const splitIdx = Math.ceil(masterBom.length / 2);
  const bomPages = [
    { pageNum: 3, title: 'Master Consolidated JLCPCB BOM (Part 1 of 2: Active ICs, Transistors, Diodes & Power Resistors)', rows: masterBom.slice(0, splitIdx) },
    { pageNum: 4, title: 'Master Consolidated JLCPCB BOM (Part 2 of 2: 0805 Resistors, MLCC Capacitors & THT Connectors)', rows: masterBom.slice(splitIdx) },
  ];

  for (const bp of bomPages) {
    doc.addPage();
    addHeaderFooter(bp.pageNum, `Master Consolidated BOM (${bp.pageNum - 2} of 2)`);
    let by = 21.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(bp.title, margin, by);
    by += 4.5;
    by = drawBomHeader(by);

    for (const item of bp.rows) {
      const qty = item.designators.length;
      const extEur = qty * item.unitCostEur;
      const refStr = item.designators.join(',');
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.6);
      const refLines = doc.splitTextToSize(pdfSafe(refStr), bomCols[0] - 2.2).slice(0, 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.7);
      const pLines = doc.splitTextToSize(pdfSafe(item.purpose), bomCols[7] - 2.2).slice(0, 2);
      const rh = Math.max(5.3, Math.max(refLines.length, pLines.length) * 2.75 + 2.1);

      doc.setFillColor(item.bomClass === 'THT' ? 248 : item.bomClass === 'Preferred' ? 239 : 255, item.bomClass === 'THT' ? 250 : item.bomClass === 'Preferred' ? 246 : 255, item.bomClass === 'THT' ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, by, contentW, rh, 'FD');

      let rx = margin;
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(15, 23, 42);
      doc.text(refLines, rx + 1.1, by + 3.2);
      rx += bomCols[0];

      doc.setFont('courier', 'normal');
      doc.text(String(qty), rx + 2.0, by + 3.2);
      rx += bomCols[1];

      doc.text(pdfSafe(item.value), rx + 1.1, by + 3.2);
      rx += bomCols[2];

      doc.text(pdfSafe(item.shortPkg), rx + 1.1, by + 3.2);
      rx += bomCols[3];

      doc.setTextColor(5, 150, 105);
      doc.text(item.lcsc, rx + 1.1, by + 3.2);
      rx += bomCols[4];

      doc.setTextColor(item.bomClass === 'Basic' ? 6 : item.bomClass === 'Preferred' ? 30 : 71, item.bomClass === 'Basic' ? 95 : item.bomClass === 'Preferred' ? 64 : 85, item.bomClass === 'Basic' ? 70 : item.bomClass === 'Preferred' ? 175 : 105);
      doc.text(item.bomClass, rx + 1.1, by + 3.2);
      rx += bomCols[5];

      doc.setTextColor(15, 23, 42);
      doc.text(extEur.toFixed(2), rx + 1.1, by + 3.2);
      rx += bomCols[6];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.7);
      doc.setTextColor(51, 65, 85);
      doc.text(pLines, rx + 1.1, by + 3.2);

      by += rh;
    }
  }

  // =========================================================================
  // PAGE 5: INTER-BLOCK NETLIST & SCREW TERMINAL WIRING STRIP
  // =========================================================================
  doc.addPage();
  addHeaderFooter(5, 'Inter-Block Power/Safety Netlist & Terminal Strip');
  let y5 = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Inter-Block Shared Rails & Field Screw-Terminal Reference', margin, y5);
  y5 += 6.5;

  const nCols = [30, 38, 46, 30, 38];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y5, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let nx = margin;
  ['Shared Net', 'Source Block', 'Destination Blocks', 'Nominal State', 'Hardware Protection'].forEach((h, i) => {
    doc.text(h, nx + 1.3, y5 + 3.9);
    nx += nCols[i];
  });
  y5 += 5.8;

  for (const net of interNets) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    const dstL = doc.splitTextToSize(pdfSafe(net.destinations), nCols[2] - 2.4).slice(0, 3);
    const prtL = doc.splitTextToSize(pdfSafe(net.faultProtection), nCols[4] - 2.4).slice(0, 3);
    const rh = Math.max(9.0, Math.max(dstL.length, prtL.length) * 2.9 + 2.6);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y5, contentW, rh, 'FD');

    nx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(3, 105, 161);
    doc.text(doc.splitTextToSize(pdfSafe(net.netName), nCols[0] - 2).slice(0, 2), nx + 1.2, y5 + 3.8);
    nx += nCols[0];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(net.source), nCols[1] - 2.2).slice(0, 3), nx + 1.2, y5 + 3.8);
    nx += nCols[1];

    doc.setTextColor(51, 65, 85);
    doc.text(dstL, nx + 1.2, y5 + 3.8);
    nx += nCols[2];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(net.nominalState), nCols[3] - 2).slice(0, 3), nx + 1.2, y5 + 3.8);
    nx += nCols[3];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(6, 95, 70);
    doc.text(prtL, nx + 1.2, y5 + 3.8);

    y5 += rh;
  }

  y5 += 8.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Populated Field Terminals (Left & Front Edges per D17)', margin, y5);
  y5 += 3.5;

  const termRows = isAllPt
    ? [
        ['J6 Upper (DG350D 1–8)', 'Left Edge', 'Pins 1/2..7/8: PT1± .. PT4± (0 mm ovh)', '01/04. Pt1000 Ch 1–4 Collector & Tank (GPIO 27/17/16/26)'],
        ['J6 Lower (DG350D 9–16)', 'Left Edge', 'Pins 9/10..15/16: PT5± .. PT8± (29.4mm)', '04. Pt1000 Ch 5–8 Flow/Ret/DHW/Out (GPIO 19/21/10/9)'],
        ['J2 (DG350-3.5-03P)', 'Front Edge', 'Pin 1: PWM1 | Pin 2: GND | Pin 3: FB1', '05. Grundfos/Wilo Solar Pump 1 (7.21V PWM + 75 Hz FB)'],
        ['JP1 (2-Pad Test Pt)', 'Internal', 'Pad 1: WD_VCAP | Pad 2: +3V3', '03. Watchdog Bench Override Pads (DNP; tweezer-short only)'],
      ]
    : [
        ['J6:1–2 (DG350-08P)', 'Left Edge', 'Pin 1: PT1_A | Pin 2: PT1_B (28.5 mm)', '01. Pt1000 Collector (2-wire roof probe, ±24V safe)'],
        ['J6:3–5 (DG350-08P)', 'Left Edge', 'Pin 3: +5V_1WA | Pin 4: DQ_A | Pin 5: G', '04. 1-Wire Bus A (GPIO 4, up to 65 m / 12× DS18B20)'],
        ['J6:6–8 (DG350-08P)', 'Left Edge', 'Pin 6: +5V_1WB | Pin 7: DQ_B | Pin 8: G', '04. 1-Wire Bus B (GPIO 17, independent fault domain)'],
        ['J2 (DG350-3.5-03P)', 'Front Edge', 'Pin 1: PWM1 | Pin 2: GND | Pin 3: FB1', '05. Grundfos/Wilo Solar Pump 1 (7.21V PWM + 75 Hz FB)'],
        ['JP1 (2-Pad Test Pt)', 'Internal', 'Pad 1: WD_VCAP | Pad 2: +3V3', '03. Watchdog Bench Override Pads (DNP; tweezer-short only)'],
      ];

  const tCols = [30, 22, 56, 74];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y5, contentW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let tx = margin;
  ['Connector', 'Edge', 'Pinout', 'Function & Rating'].forEach((h, i) => {
    doc.text(h, tx + 1.4, y5 + 3.7);
    tx += tCols[i];
  });
  y5 += 5.5;

  for (const tr of termRows) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y5, contentW, 6.2, 'FD');
    tx = margin;
    tr.forEach((v, i) => {
      doc.setFont(i <= 2 ? 'courier' : 'helvetica', i === 0 ? 'bold' : 'normal');
      doc.setFontSize(6.1);
      doc.setTextColor(15, 23, 42);
      doc.text(pdfSafe(v), tx + 1.4, y5 + 4.1);
      tx += tCols[i];
    });
    y5 += 6.2;
  }

  // =========================================================================
  // PAGE 6: KICAD 10, NGSPICE & PRE-ORDER BRING-UP CHECKLIST
  // =========================================================================
  doc.addPage();
  addHeaderFooter(6, 'KiCad 10, ngspice Suite & JLCPCB Order Checklist');
  let y6 = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.0);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad 10, ngspice Simulation & First-Board Bring-Up Guide', margin, y6);
  y6 += 7.0;

  const projFileStem = isAllPt ? 'CoSTOS_HAT_AllPt1000' : 'CoSTOS_HAT_RevB';
  const sections = [
    {
      h: `1. Included Downloadable Engineering Files (Tab 08 Complete ZIP — ${isAllPt ? '20' : '21'} Files)`,
      items: [
        `kicad/${projFileStem}.kicad_pro + Root + 6 Wired Sub-Sheets - Full KiCad 10 hierarchical project with embedded symbols, LCSC/footprint fields, ${totalParts} parts, and ${netCount} verified nets (press F8 to sync directly to PCB).`,
        `kicad/${projFileStem}.kicad_pcb + .net - Fully placed & 2-layer routed 65×56 mm HAT PCB (${totalParts} parts, ${netCount} nets, NT1 star bridge, FID1-3 fiducials, mirrored B.SilkS cheat-sheet, and split B.Cu GND/AGND zones).`,
        `jlcpcb/ BOM CSVs & spice/ SPICE deck - ${stats.uniqueSmdReels}-reel JLCPCB Economic PCBA CSV + full ${totalParts}-part Master CSV + ngspice-39 verified SPICE deck (exit code 0).`,
        `docs/ PDF Reports - All ${isAllPt ? '5' : '6'} subsystem engineering reports plus this 6-page Full-HAT Expected Costs & BOM report.`,
      ],
    },
    {
      h: '2. Pre-Fab Sign-Off & Pre-Order JLCPCB Economic PCBA Checklist',
      items: [
        'Pre-Fab Sign-Off Note: Geometric copper clearances and pour continuity are verified automatically, but before uploading Gerbers to JLCPCB, open the exported .kicad_pcb in KiCad 10 PCB Editor, press B to pour the Priority-2 AGND and Priority-1 GND B.Cu copper zones, and run Inspect -> Design Rules Checker (DRC) once to confirm final zone-filled clearances.',
        'Verify single-sided SMD placement (all SMD parts on TOP side -> keeps JLCPCB setup at EUR 7.40 + EUR 1.40 stencil).',
        'Double-check LCSC stock of the 3× 0.1% Preferred Extended resistors (3.90k, 1.00k, 1.80k); if any temporarily leaves the Preferred list, swap to any in-stock 0805 0.1% 25ppm Preferred value.',
        isAllPt
          ? 'Hand-solder only 3 THT parts: J1 (40-pin normal 11 mm header for passively cooled Pi), J6 (1x DG350D-3.5-08P Dual-Tier 2x8P fixed screw, 0 mm overhang), and J2 PUMP1 (DG350-3.5-03P). Leave JP1 as bare 2-pad tweezer test point (DNP) and mount with 4x M2.5 11 mm nylon standoffs.'
          : 'Hand-solder only 3 THT parts: J1 (40-pin normal 11 mm header for passively cooled Pi), J6 (1x DG350-3.5-08P combined 8-pin fixed screw for PT1 + 1W-A + 1W-B), and J2 PUMP1 (DG350-3.5-03P). Leave JP1 as bare 2-pad tweezer test point (DNP) and mount with 4x M2.5 11 mm nylon standoffs.',
      ],
    },
    {
      h: '3. First-Power Bench Bring-Up Sequence (Before Connecting Boiler/Pump)',
      items: [
        'Power via Pi USB-C: verify green PWR LED D2 lights cleanly, +5V_HAT = 4.78-5.00 V, +3V3_ANA = 3.25-3.30 V, and +V_DRV = 8.6-8.9 V (62 kHz CMOS on C22).',
        'Test 06 Foldback eFuse: briefly short +5V_HAT to GND via ammeter -> confirm current folds to ~120-137 mA with ZERO Raspberry Pi 5 reboot and instant recovery.',
        'Test 03 Watchdog: toggle GPIO 24 at 20 Hz -> D3 turns ON & Q5 enables PUMP1; stop heartbeat -> verify U4A WD_REL_N rises at ~14-15 s and GPIO 20 WD_RB / D3 drops ~2.6 s later.',
        'Test 01 Pt1000 BIST: run Setup Wizard 2-point calibration (Q2 1.00k & Q3 1.80k) and verify 0.00 °C reading with a 1.000 kOhm test resistor across J6.',
      ],
    },
  ];

  for (const sec of sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(sec.h), margin, y6);
    y6 += 4.2;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    let innerH = 3.5;
    const wrapped = sec.items.map((it) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      const lines = doc.splitTextToSize(pdfSafe(`* ${it}`), contentW - 8);
      innerH += lines.length * 3.3 + 2.0;
      return lines;
    });
    doc.roundedRect(margin, y6, contentW, innerH, 1.2, 1.2, 'FD');

    let iy = y6 + 5.0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(30, 41, 59);
    for (const lines of wrapped) {
      doc.text(lines, margin + 4, iy);
      iy += lines.length * 3.3 + 2.0;
    }
    y6 += innerH + 6.5;
  }

  return doc;
}

export function exportFullHatCostsPdfReport(
  opts: CostCalcOptions,
  edition: HatEdition = 'onewire'
): void {
  const doc = buildFullHatCostsPdfDoc(opts, edition);
  const dateStr = new Date().toISOString().slice(0, 10);
  const tag = edition === 'all_pt1000' ? 'AllPt1000_8x' : '1Wire_RevB';
  doc.save(`CoSTOS_07_Full_HAT_Costs_BOM_${tag}_${opts.batchSize}x_${dateStr}.pdf`);
}
