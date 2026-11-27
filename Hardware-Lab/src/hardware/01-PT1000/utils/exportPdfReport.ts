import { jsPDF } from 'jspdf';
import {
  SimulationParams,
  TOPOLOGY_ORDER,
  TOPOLOGY_SPECS,
  TopologyId,
  TopologySpec,
  buildBaselineConclusion,
  computeErrorSweep,
  estimateResourceFootprint,
  evaluateTopology,
  perBoardCostEur,
} from '../physics/model';
import { pt1000Resistance } from '../physics/pt1000';
import { REV_D_KICAD_BOM, REV_D_PINOUT } from '../components/KicadBomPinout';
import { REVISION_HISTORY, REV_C_TO_D_AUDIT_FIXES } from '../components/AuditHistory';

// Sanitize strings for jsPDF built-in Helvetica/Courier (WinAnsiEncoding)
// Keeps native WinAnsi glyphs ° (0xB0), ± (0xB1), ² (0xB2), µ (0xB5), × (0xD7)
function pdfSafe(text: string): string {
  return text
    .replace(/€/g, 'EUR ')
    .replace(/Ω/g, 'Ohm')
    .replace(/Δ/g, 'd')
    .replace(/\bdeg\s*C\b/g, '°C')
    .replace(/\+\/-/g, '±')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≈/g, '~')
    .replace(/·/g, '|')
    .replace(/§/g, 'Sec. ')
    .replace(/τ/g, 'tau')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/μ/g, 'µ')
    .replace(/…/g, '...')
    .replace(/●/g, '*')
    .replace(/▲/g, '!')
    .replace(/✖/g, 'X')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xB0\xB1\xB2\xB5\xD7]/g, '');
}

function drawPdfCircuitSchematic(
  doc: jsPDF,
  spec: TopologySpec,
  x0: number,
  y0: number,
  w: number,
  h: number,
  pollIntervalS: number
): void {
  // Normalized 900x300 schematic canvas matching CircuitDiagramSvg 1-to-1
  const scX = w / 900;
  const scY = h / 300;
  const sx = (px: number) => x0 + px * scX;
  const sy = (py: number) => y0 + py * scY;
  const sw = (pw: number) => pw * scX;
  const sh = (ph: number) => ph * scY;

  const setStroke = (r: number, g: number, b: number, lw = 0.28) => {
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(lw);
  };

  const wire = (x1: number, y1: number, x2: number, y2: number, rgb: [number, number, number] = [51, 65, 85], lw = 0.28) => {
    setStroke(rgb[0], rgb[1], rgb[2], lw);
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };

  const dot = (x: number, y: number, rgb: [number, number, number] = [51, 65, 85]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.circle(sx(x), sy(y), sw(2.4), 'F');
  };

  const vcc = (x: number, y: number, label: string, rgb: [number, number, number] = [29, 78, 216]) => {
    setStroke(rgb[0], rgb[1], rgb[2], 0.34);
    doc.line(sx(x - 8), sy(y), sx(x + 8), sy(y));
    doc.line(sx(x), sy(y), sx(x), sy(y + 8));
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(label, sx(x), sy(y - 3.5), { align: 'center' });
  };

  const gnd = (x: number, y: number, rgb: [number, number, number] = [71, 85, 105]) => {
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x), sy(y), sx(x), sy(y + 6));
    doc.line(sx(x - 9), sy(y + 6), sx(x + 9), sy(y + 6));
    doc.line(sx(x - 6), sy(y + 10), sx(x + 6), sy(y + 10));
    doc.line(sx(x - 3), sy(y + 14), sx(x + 3), sy(y + 14));
  };

  const resH = (x1: number, x2: number, y: number, rgb: [number, number, number] = [51, 65, 85], bodyW = 34, amp = 5.5) => {
    const mid = (x1 + x2) / 2;
    const bw = Math.min(bodyW, (x2 - x1) * 0.72);
    const b1 = mid - bw / 2;
    const b2 = mid + bw / 2;
    const st = bw / 6;
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x1), sy(y), sx(b1), sy(y));
    const pts: [number, number][] = [
      [b1, y],
      [b1 + st * 0.5, y - amp],
      [b1 + st * 1.5, y + amp],
      [b1 + st * 2.5, y - amp],
      [b1 + st * 3.5, y + amp],
      [b1 + st * 4.5, y - amp],
      [b1 + st * 5.5, y + amp],
      [b2, y],
    ];
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1][0]), sy(pts[i - 1][1]), sx(pts[i][0]), sy(pts[i][1]));
    }
    doc.line(sx(b2), sy(y), sx(x2), sy(y));
  };

  const resV = (x: number, y1: number, y2: number, rgb: [number, number, number] = [51, 65, 85], bodyH = 30, amp = 5.2) => {
    const mid = (y1 + y2) / 2;
    const bh = Math.min(bodyH, (y2 - y1) * 0.72);
    const b1 = mid - bh / 2;
    const b2 = mid + bh / 2;
    const st = bh / 6;
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x), sy(y1), sx(x), sy(b1));
    const pts: [number, number][] = [
      [x, b1],
      [x - amp, b1 + st * 0.5],
      [x + amp, b1 + st * 1.5],
      [x - amp, b1 + st * 2.5],
      [x + amp, b1 + st * 3.5],
      [x - amp, b1 + st * 4.5],
      [x + amp, b1 + st * 5.5],
      [x, b2],
    ];
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1][0]), sy(pts[i - 1][1]), sx(pts[i][0]), sy(pts[i][1]));
    }
    doc.line(sx(x), sy(b2), sx(x), sy(y2));
  };

  const resDiag = (x1: number, y1: number, x2: number, y2: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const body = Math.min(34, len * 0.58);
    const start = (len - body) / 2;
    const st = body / 6;
    const amp = 4.6;
    const pt = (t: number, o: number): [number, number] => [x1 + ux * t + nx * o, y1 + uy * t + ny * o];
    const pts = [
      pt(0, 0),
      pt(start, 0),
      pt(start + st * 0.5, -amp),
      pt(start + st * 1.5, amp),
      pt(start + st * 2.5, -amp),
      pt(start + st * 3.5, amp),
      pt(start + st * 4.5, -amp),
      pt(start + st * 5.5, amp),
      pt(start + body, 0),
      pt(len, 0),
    ];
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1][0]), sy(pts[i - 1][1]), sx(pts[i][0]), sy(pts[i][1]));
    }
  };

  const capV = (x: number, y1: number, y2: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const mid = (y1 + y2) / 2;
    setStroke(rgb[0], rgb[1], rgb[2], 0.3);
    doc.line(sx(x), sy(y1), sx(x), sy(mid - 3.5));
    doc.line(sx(x - 9), sy(mid - 3.5), sx(x + 9), sy(mid - 3.5));
    doc.line(sx(x - 9), sy(mid + 3.5), sx(x + 9), sy(mid + 3.5));
    doc.line(sx(x), sy(mid + 3.5), sx(x), sy(y2));
  };

  const zenerV = (
    x: number,
    y1: number,
    y2: number,
    rgb: [number, number, number] = [71, 85, 105],
    fill: [number, number, number] = [255, 255, 255]
  ) => {
    const mid = (y1 + y2) / 2;
    const kY = mid - 7;
    const aY = mid + 8;
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x), sy(y1), sx(x), sy(kY));
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.triangle(sx(x - 7.5), sy(aY), sx(x + 7.5), sy(aY), sx(x), sy(kY), 'FD');
    doc.line(sx(x - 7.5), sy(kY), sx(x + 7.5), sy(kY));
    doc.line(sx(x - 7.5), sy(kY), sx(x - 10), sy(kY - 3));
    doc.line(sx(x + 7.5), sy(kY), sx(x + 10), sy(kY + 3));
    doc.line(sx(x), sy(aY), sx(x), sy(y2));
  };

  // Authentic IEEE N-Channel Enhancement MOSFET (Drain top, Source bottom, Gate left)
  const nMosfet = (cx: number, cy: number, rgb: [number, number, number] = [51, 65, 85]) => {
    doc.setFillColor(255, 255, 255);
    setStroke(rgb[0], rgb[1], rgb[2], 0.26);
    doc.circle(sx(cx), sy(cy), sw(13.5), 'FD');
    // Gate lead + vertical insulated gate bar
    doc.line(sx(cx - 17), sy(cy + 5), sx(cx - 6), sy(cy + 5));
    setStroke(rgb[0], rgb[1], rgb[2], 0.34);
    doc.line(sx(cx - 6), sy(cy - 8), sx(cx - 6), sy(cy + 8));
    // 3-segment broken enhancement channel
    doc.line(sx(cx - 2), sy(cy - 9), sx(cx - 2), sy(cy - 4));
    doc.line(sx(cx - 2), sy(cy - 2.2), sx(cx - 2), sy(cy + 2.2));
    doc.line(sx(cx - 2), sy(cy + 4), sx(cx - 2), sy(cy + 9));
    // Drain (top) + Body/Source (bottom)
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(cx - 2), sy(cy - 6.5), sx(cx + 7), sy(cy - 6.5));
    doc.line(sx(cx + 7), sy(cy - 6.5), sx(cx + 7), sy(cy - 17));
    doc.line(sx(cx - 2), sy(cy), sx(cx + 7), sy(cy));
    doc.line(sx(cx + 7), sy(cy), sx(cx + 7), sy(cy + 17));
    doc.line(sx(cx - 2), sy(cy + 6.5), sx(cx + 7), sy(cy + 6.5));
    // Inward N-channel body arrow
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.triangle(sx(cx - 1.5), sy(cy), sx(cx + 3.8), sy(cy - 3), sx(cx + 3.8), sy(cy + 3), 'F');
  };

  // Frame + faint blueprint grid
  doc.setFillColor(248, 250, 252);
  setStroke(203, 213, 225, 0.25);
  doc.rect(x0, y0, w, h, 'FD');

  setStroke(226, 232, 240, 0.1);
  for (let gx = 45; gx < 900; gx += 45) {
    doc.line(sx(gx), y0, sx(gx), y0 + h);
  }
  for (let gy = 50; gy < 300; gy += 50) {
    doc.line(x0, sy(gy), x0 + w, sy(gy));
  }

  // ZONE 1 (14..128): Authentic IEEE PT1000 RTD Sensor & Screw Terminals
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(100, 116, 139);
  doc.text('ROOF PROBE', sx(14), sy(24));

  wire(48, 66, 48, 104);
  resV(48, 104, 176, [51, 65, 85], 58, 8);
  wire(48, 176, 48, 216);
  // Diagonal RTD linear-temp bar +t
  setStroke(37, 99, 235, 0.32);
  doc.line(sx(28), sy(162), sx(28), sy(154));
  doc.line(sx(28), sy(154), sx(68), sy(120));
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.0);
  doc.setTextColor(29, 78, 216);
  doc.text('+t', sx(20), sy(148));
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('PT1000', sx(48), sy(88), { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(29, 78, 216);
  doc.text('1-1.94k Ohm', sx(48), sy(200), { align: 'center' });

  wire(48, 66, 114, 66);
  wire(48, 216, 114, 216);

  doc.setFillColor(255, 255, 255);
  setStroke(51, 65, 85, 0.32);
  doc.circle(sx(114), sy(66), sw(4.5), 'FD');
  doc.circle(sx(114), sy(216), sw(4.5), 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(71, 85, 105);
  doc.text('PT1_A', sx(114), sy(52), { align: 'center' });
  doc.text('PT1_B', sx(114), sy(235), { align: 'center' });

  // ZONE 2 (118..252): Authentic Input Protection (Zig-Zag Resistors + TVS Diode)
  if (spec.id === 'switched_rc') {
    wire(118, 66, 216, 66);
  } else {
    resH(118, 216, 66, [51, 65, 85], 42);
    const topR =
      spec.id === 'max31865'
        ? '100 Ohm'
        : spec.id === 'bridge_lmv358_ads1115' || spec.id === 'pwm_dac_lm393'
        ? '1.0 kOhm'
        : '470 Ohm';
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.4);
    doc.setTextColor(15, 23, 42);
    doc.text(topR, sx(167), sy(54), { align: 'center' });
  }

  if (spec.id === 'pwm_dac_lm393') {
    wire(118, 216, 170, 216);
    gnd(170, 216);
  } else {
    resH(118, 216, 216, [51, 65, 85], 42);
    const botR =
      spec.id === 'max31865'
        ? '100 Ohm'
        : spec.id === 'switched_rc'
        ? 'R5A||B 50R 1206'
        : spec.id === 'bridge_lmv358_ads1115'
        ? '1.0 kOhm'
        : '470 Ohm';
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.3);
    doc.setTextColor(15, 23, 42);
    doc.text(botR, sx(167), sy(236), { align: 'center' });
  }

  // Authentic TVS / Zener ESD Clamp to GND
  dot(222, 66);
  zenerV(222, 66, 176);
  gnd(222, 176);
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.0);
  doc.setTextColor(51, 65, 85);
  doc.text(spec.id === 'switched_rc' ? 'C106/C105' : 'PESD5V0', sx(200), sy(114), { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(4.8);
  doc.text(
    spec.id === 'switched_rc' ? '100nF 50V' : spec.id === 'max31865' ? '±45V IC' : '+ BAV99',
    sx(200),
    sy(128),
    { align: 'right' }
  );

  // ZONE 3 (216..722): Topology-Specific Authentic IEEE Core
  if (spec.id === 'max31865') {
    wire(216, 66, 386, 66);
    wire(216, 216, 386, 216);

    // 100 nF diff cap
    dot(272, 66);
    dot(272, 216);
    capV(272, 66, 216);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(51, 65, 85);
    doc.text('100 nF', sx(272), sy(162), { align: 'center' });

    // Authentic Zig-Zag 4.3k 0.1% R_ref
    wire(386, 108, 334, 108, [37, 99, 235]);
    resV(334, 108, 166, [37, 99, 235], 36);
    wire(334, 166, 386, 166, [37, 99, 235]);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(30, 64, 175);
    doc.text('R_ref', sx(322), sy(134), { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.text('4.3k 0.1%', sx(322), sy(147), { align: 'right' });

    // MAX31865 Package
    doc.setFillColor(255, 255, 255);
    setStroke(37, 99, 235, 0.36);
    doc.rect(sx(386), sy(34), sw(214), sh(214), 'FD');
    doc.setFillColor(239, 246, 255);
    doc.rect(sx(386), sy(34), sw(214), sh(26), 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(30, 64, 175);
    doc.text('U1: MAX31865AAP+ (SSOP-20)', sx(493), sy(50.5), { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.4);
    doc.setTextColor(30, 41, 59);
    doc.text('RTDIN+', sx(393), sy(70));
    doc.setFont('courier', 'normal');
    doc.text('REFIN+', sx(393), sy(112));
    doc.text('REFIN-', sx(393), sy(170));
    doc.setFont('courier', 'bold');
    doc.text('RTDIN-', sx(393), sy(220));

    doc.setFillColor(248, 250, 252);
    setStroke(203, 213, 225, 0.25);
    doc.rect(sx(462), sy(76), sw(124), sh(52), 'FD');
    doc.rect(sx(462), sy(142), sw(124), sh(52), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(15, 23, 42);
    doc.text('15-bit dS ADC', sx(524), sy(99), { align: 'center' });
    doc.text('±45V Guard FSM', sx(524), sy(165), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.3);
    doc.setTextColor(100, 116, 139);
    doc.text('50/60 Hz Notch', sx(524), sy(116), { align: 'center' });
    doc.text('Reg 0x07 Faults', sx(524), sy(182), { align: 'center' });

    [78, 118, 158, 198].forEach((py, idx) => {
      wire(600, py, 722, py);
      const labels = ['SCLK (GPIO 11)', 'MISO (GPIO 9)', 'MOSI (GPIO 10)', 'CE0 (GPIO 8)'];
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(30, 41, 59);
      doc.text(labels[idx], sx(661), sy(py - 6), { align: 'center' });
    });
  } else if (spec.id === 'switched_rc') {
    wire(216, 66, 392, 66);

    // R1A-D 4.00k (4x 1.00k 0.1%) Top Divider Zig-Zag from +3.3V
    vcc(274, 14, '+3.3V');
    resV(274, 22, 66, [37, 99, 235], 28);
    dot(274, 66);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(30, 64, 175);
    doc.text('R1A-D 4.00k 0.1%', sx(284), sy(42));

    // Branch 1: R2 1.00k 0.1% + Authentic Q2 N-MOSFET
    dot(316, 66);
    resV(316, 66, 116, [37, 99, 235], 28);
    doc.setFontSize(4.7);
    doc.text('1.00k', sx(306), sy(94), { align: 'right' });
    nMosfet(309, 133, [71, 85, 105]);
    gnd(316, 150);
    doc.setTextColor(51, 65, 85);
    doc.text('Q2 G12', sx(292), sy(137), { align: 'right' });

    // Branch 2: R3A-B 2.00k (2x 1.00k 0.1%) + Authentic Q3 N-MOSFET
    dot(372, 66);
    resV(372, 66, 116, [37, 99, 235], 28);
    doc.setTextColor(30, 64, 175);
    doc.text('2.00k', sx(362), sy(94), { align: 'right' });
    nMosfet(365, 133, [71, 85, 105]);
    gnd(372, 150);
    doc.setTextColor(51, 65, 85);
    doc.text('Q3 G13', sx(383), sy(137));

    // Branch 3: Authentic Q1 AO3400A N-MOSFET on PT1_B
    wire(216, 216, 296, 216);
    wire(296, 216, 296, 205, [5, 150, 105]);
    nMosfet(289, 222, [5, 150, 105]);
    gnd(296, 239);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(4, 120, 87);
    doc.text('Q1 G27', sx(268), sy(226), { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(71, 85, 105);
    doc.text('AO3400A', sx(310), sy(226));

    // Sense-side Protection: R4 10k Zig-Zag + D3 5.1V Zener + C3 100nF
    resH(392, 446, 66, [5, 150, 105], 32);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(4, 120, 87);
    doc.text('R4 10k', sx(419), sy(54), { align: 'center' });
    wire(446, 66, 504, 66, [5, 150, 105]);

    dot(458, 66, [5, 150, 105]);
    zenerV(458, 66, 122, [5, 150, 105], [236, 253, 245]);
    gnd(458, 122);
    doc.setFontSize(4.6);
    doc.text('D8 1N4148', sx(448), sy(100), { align: 'right' });

    dot(486, 66, [5, 150, 105]);
    capV(486, 66, 122, [5, 150, 105]);
    gnd(486, 122);
    doc.setFont('courier', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('C3 100nF', sx(486), sy(54), { align: 'center' });

    // Authentic LM393 U1A Slicer Comparator
    doc.setFillColor(239, 246, 255);
    setStroke(37, 99, 235, 0.34);
    doc.triangle(sx(504), sy(44), sx(504), sy(116), sx(568), sy(80), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(30, 64, 175);
    doc.text('+', sx(510), sy(70));
    doc.text('-', sx(510), sy(101));
    doc.text('U1A', sx(533), sy(84), { align: 'center' });
    vcc(532, 24, '+5V U1', [37, 99, 235]);
    wire(532, 32, 532, 60, [37, 99, 235], 0.24);

    // Authentic U1B 72 Hz Schmitt RC Ramp Oscillator
    doc.setFillColor(236, 253, 245);
    setStroke(5, 150, 105, 0.32);
    doc.triangle(sx(510), sy(162), sx(510), sy(224), sx(566), sy(193), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.4);
    doc.setTextColor(4, 120, 87);
    doc.text('+', sx(516), sy(182));
    doc.text('-', sx(516), sy(210));
    doc.text('U1B', sx(536), sy(196), { align: 'center' });

    wire(566, 193, 584, 193, [5, 150, 105]);
    wire(584, 193, 584, 244, [5, 150, 105]);
    resH(482, 584, 244, [5, 150, 105], 34);
    doc.setFontSize(4.8);
    doc.text('R9 390k (72 Hz)', sx(534), sy(258), { align: 'center' });
    wire(482, 244, 482, 206, [5, 150, 105]);
    wire(482, 206, 510, 206, [5, 150, 105]);
    dot(482, 206, [5, 150, 105]);
    wire(450, 206, 482, 206, [5, 150, 105]);
    capV(450, 206, 252, [5, 150, 105]);
    gnd(450, 252);
    doc.text('2x10nF', sx(438), sy(232), { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('C0G', sx(438), sy(244), { align: 'right' });

    // V_ramp wire up to U1A (-)
    wire(482, 206, 482, 150, [5, 150, 105], 0.25);
    wire(482, 150, 496, 150, [5, 150, 105], 0.25);
    wire(496, 150, 496, 97, [5, 150, 105], 0.25);
    wire(496, 97, 504, 97, [5, 150, 105], 0.25);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.7);
    doc.setTextColor(4, 120, 87);
    doc.text('V_ramp', sx(488), sy(144), { align: 'center' });

    // R10 4.7k Pull-up Zig-Zag to +3.3V & DUTY_IN Output
    vcc(604, 24, '+3.3V');
    resV(604, 32, 80, [51, 65, 85], 26);
    dot(604, 80);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(30, 41, 59);
    doc.text('4.7k', sx(615), sy(58));
    wire(568, 80, 722, 80);
    doc.setFontSize(5.2);
    doc.setTextColor(15, 23, 42);
    doc.text('DUTY_IN (G22 | 72 Hz)', sx(668), sy(70), { align: 'center' });

    wire(296, 268, 722, 268, [100, 116, 139], 0.22);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.1);
    doc.setTextColor(4, 120, 87);
    doc.text('Locked Rev D: GPIOs 22/27/12/13 | U1 LM393DR2G (C7955) | 0.476-1.533 V | Exact ln() Math', sx(525), sy(287), { align: 'center' });
  } else if (spec.id === 'bridge_cs1237') {
    // Authentic 4-Leg Diamond Wheatstone Bridge
    vcc(356, 32, '+3.3V V_EXC');
    wire(356, 40, 356, 54, [29, 78, 216]);
    dot(356, 54, [29, 78, 216]);
    resDiag(356, 54, 288, 136, [71, 85, 105]);
    resDiag(356, 54, 424, 136, [71, 85, 105]);
    resDiag(288, 136, 356, 218, [37, 99, 235]);
    resDiag(424, 136, 356, 218, [5, 150, 105]);
    dot(356, 218);
    gnd(356, 218);

    wire(216, 66, 254, 66);
    wire(254, 66, 254, 136);
    wire(254, 136, 288, 136);
    wire(216, 216, 356, 216);

    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(51, 65, 85);
    doc.text('4.7k', sx(304), sy(88), { align: 'right' });
    doc.text('4.7k', sx(408), sy(88));
    doc.setTextColor(30, 64, 175);
    doc.text('1.0k', sx(304), sy(192), { align: 'right' });
    doc.setTextColor(4, 120, 87);
    doc.text('PT1000', sx(408), sy(192));

    dot(288, 136, [37, 99, 235]);
    dot(424, 136, [37, 99, 235]);
    wire(288, 136, 288, 112, [37, 99, 235], 0.25);
    wire(288, 112, 478, 112, [37, 99, 235], 0.25);
    wire(424, 136, 452, 136, [37, 99, 235]);
    wire(452, 136, 452, 164, [37, 99, 235]);
    wire(452, 164, 478, 164, [37, 99, 235]);
    doc.setTextColor(30, 64, 175);
    doc.text('AIN+', sx(458), sy(105), { align: 'center' });
    doc.text('AIN-', sx(458), sy(178), { align: 'center' });

    // CS1237 IC
    doc.setFillColor(255, 255, 255);
    setStroke(37, 99, 235, 0.34);
    doc.rect(sx(478), sy(56), sw(144), sh(166), 'FD');
    doc.setFillColor(239, 246, 255);
    doc.rect(sx(478), sy(56), sw(144), sh(26), 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(30, 64, 175);
    doc.text('U1: CS1237 / HX711', sx(550), sy(73), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(30, 41, 59);
    doc.text('24-bit PGA dS ADC', sx(550), sy(114), { align: 'center' });
    doc.text('Gain = 2 | 10 SPS', sx(550), sy(136), { align: 'center' });
    doc.text('50/60 Hz Notch', sx(550), sy(156), { align: 'center' });

    wire(622, 112, 722, 112);
    resH(622, 722, 166, [51, 65, 85], 34);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.3);
    doc.text('SCLK (G8)', sx(672), sy(104), { align: 'center' });
    doc.text('1k | DOUT (G9)', sx(672), sy(154), { align: 'center' });
  } else if (spec.id === 'bridge_lmv358_ads1115') {
    // Authentic Diamond Wheatstone Bridge
    vcc(316, 36, '+3.3V');
    wire(316, 44, 316, 58, [29, 78, 216]);
    resDiag(316, 58, 264, 136, [71, 85, 105]);
    resDiag(316, 58, 368, 136, [71, 85, 105]);
    resDiag(264, 136, 316, 214, [37, 99, 235]);
    resDiag(368, 136, 316, 214, [5, 150, 105]);
    gnd(316, 214);
    wire(216, 66, 244, 66);
    wire(244, 66, 244, 136);
    wire(244, 136, 264, 136);
    wire(216, 216, 316, 216);

    doc.setFont('courier', 'bold');
    doc.setFontSize(4.7);
    doc.setTextColor(51, 65, 85);
    doc.text('3.3k', sx(276), sy(92), { align: 'right' });
    doc.text('3.3k', sx(356), sy(92));
    doc.setTextColor(30, 64, 175);
    doc.text('800R', sx(276), sy(186), { align: 'right' });
    doc.setTextColor(4, 120, 87);
    doc.text('PT', sx(356), sy(186));

    // LMV358 Diff Amp with feedback resistor
    resH(368, 412, 156, [51, 65, 85], 24, 4);
    wire(264, 136, 264, 116);
    wire(264, 116, 412, 116);
    doc.setFillColor(248, 250, 252);
    setStroke(71, 85, 105, 0.34);
    doc.triangle(sx(412), sy(86), sx(412), sy(186), sx(484), sy(136), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);
    doc.text('-', sx(419), sy(120));
    doc.text('+', sx(419), sy(160));
    doc.text('LMV358', sx(444), sy(139), { align: 'center' });
    // Feedback R_f
    wire(402, 116, 402, 66, [71, 85, 105], 0.24);
    resH(402, 496, 66, [71, 85, 105], 32, 4.5);
    wire(496, 66, 496, 136, [71, 85, 105], 0.24);
    dot(496, 136);
    doc.setFontSize(5.1);
    doc.text('G=3.5× (Vos ±1.7mV)', sx(449), sy(55), { align: 'center' });

    // ADS1115
    wire(484, 136, 518, 136);
    doc.setFillColor(255, 255, 255);
    setStroke(37, 99, 235, 0.34);
    doc.rect(sx(518), sy(56), sw(116), sh(166), 'FD');
    doc.setFillColor(239, 246, 255);
    doc.rect(sx(518), sy(56), sw(116), sh(26), 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(30, 64, 175);
    doc.text('U1: ADS1115', sx(576), sy(73), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(30, 41, 59);
    doc.text('16-bit I2C ADC', sx(576), sy(114), { align: 'center' });
    doc.text('AIN0 / AIN2 Ref', sx(576), sy(136), { align: 'center' });

    wire(634, 112, 722, 112);
    wire(634, 158, 722, 158);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.3);
    doc.text('SDA (G2)', sx(678), sy(104), { align: 'center' });
    doc.text('SCL (G3)', sx(678), sy(150), { align: 'center' });
  } else if (spec.id === 'pwm_dac_lm393') {
    wire(216, 66, 478, 66);
    vcc(306, 14, '+3.3V');
    resV(306, 22, 66, [37, 99, 235], 28);
    dot(306, 66);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(30, 64, 175);
    doc.text('3.3k 0.1%', sx(316), sy(44));

    // Authentic 2-Stage RC Ladder PWM DAC
    resH(276, 346, 196, [71, 85, 105], 34);
    dot(346, 196);
    capV(346, 196, 248, [71, 85, 105]);
    gnd(346, 248);

    resH(346, 420, 196, [71, 85, 105], 34);
    dot(420, 196);
    capV(420, 196, 248, [71, 85, 105]);
    gnd(420, 248);

    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(51, 65, 85);
    doc.text('47k', sx(311), sy(184), { align: 'center' });
    doc.text('47k', sx(383), sy(184), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.text('100nF', sx(346), sy(274), { align: 'center' });
    doc.text('100nF', sx(420), sy(274), { align: 'center' });

    wire(420, 196, 456, 196);
    wire(456, 196, 456, 118);
    wire(456, 118, 478, 118);

    // LM393 Comparator Triangle
    doc.setFillColor(239, 246, 255);
    setStroke(37, 99, 235, 0.34);
    doc.triangle(sx(478), sy(44), sx(478), sy(144), sx(558), sy(94), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(30, 64, 175);
    doc.text('+', sx(486), sy(72));
    doc.text('-', sx(486), sy(124));
    doc.text('LM393', sx(514), sy(98), { align: 'center' });

    // Authentic 4.7k Pull-up Zig-Zag
    vcc(588, 28, '+3.3V');
    resV(588, 36, 94, [51, 65, 85], 28);
    dot(588, 94);
    doc.setFontSize(5.0);
    doc.setTextColor(30, 41, 59);
    doc.text('4.7k', sx(598), sy(66));

    wire(558, 94, 722, 94);
    doc.setFontSize(5.3);
    doc.text('COMP_IN (GPIO)', sx(656), sy(84), { align: 'center' });

    wire(722, 226, 264, 226, [225, 29, 72], 0.26);
    wire(264, 226, 264, 196, [225, 29, 72], 0.26);
    wire(264, 196, 276, 196, [225, 29, 72], 0.26);
    doc.setTextColor(190, 18, 60);
    doc.text('PWM (PUMP2 Conflict)', sx(580), sy(218), { align: 'center' });
  } else {
    // Generic clean IEEE block diagram for Direct Diff ADS1115, TM7705, STM32F103, ADS124S08, MCP3424, LTC2983
    wire(216, 66, 420, 66);
    wire(216, 216, 420, 216);
    vcc(290, 14, '+3.3V');
    resV(290, 22, 66, [37, 99, 235], 28);
    dot(290, 66);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(30, 64, 175);
    doc.text(
      spec.id === 'ads124s08_idac' || spec.id === 'ltc2983_turnkey' ? 'R_ref 2.0k 0.1%' : 'R_ref 4.0k 0.1%',
      sx(300),
      sy(42)
    );

    doc.setFillColor(255, 255, 255);
    setStroke(37, 99, 235, 0.36);
    doc.rect(sx(420), sy(36), sw(204), sh(196), 'FD');
    doc.setFillColor(239, 246, 255);
    doc.rect(sx(420), sy(36), sw(204), sh(26), 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(30, 64, 175);
    doc.text(pdfSafe(spec.shortName), sx(522), sy(52), { align: 'center' });

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(`Res: +/-${spec.resolutionK} K | Bound: +/-${spec.maxRecommendedErrorK} K`), sx(522), sy(104), {
      align: 'center',
    });
    doc.text(pdfSafe(spec.interfacePins), sx(522), sy(132), { align: 'center' });
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(`BOM EUR ${spec.partCostEur.toFixed(2)} | Ext EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)}`), sx(522), sy(172), {
      align: 'center',
    });

    wire(624, 108, 722, 108);
    wire(624, 158, 722, 158);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(30, 41, 59);
    doc.text(pdfSafe(spec.interfacePins.split(' (')[0]), sx(673), sy(100), { align: 'center' });
  }

  // ZONE 4 (724..888): Raspberry Pi Header Block
  doc.setFillColor(255, 255, 255);
  setStroke(203, 213, 225, 0.32);
  doc.rect(sx(724), sy(30), sw(162), sh(226), 'FD');
  doc.setFillColor(241, 245, 249);
  doc.rect(sx(724), sy(30), sw(162), sh(28), 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('RASPBERRY PI 3/4/5', sx(805), sy(48), { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(spec.interfacePins.split(' (')[0]), sx(805), sy(82), { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${pollIntervalS}s Async Poll`, sx(805), sy(102), { align: 'center' });

  doc.setFillColor(248, 250, 252);
  setStroke(226, 232, 240, 0.25);
  doc.rect(sx(736), sy(120), sw(138), sh(60), 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Res: ±${spec.resolutionK} K`, sx(805), sy(144), { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.4);
  doc.text(pdfSafe(spec.handSolderability), sx(805), sy(164), { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(`BOM EUR ${spec.partCostEur.toFixed(2)} | Fee EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)}`),
    sx(805),
    sy(212),
    { align: 'center' }
  );
}

export function buildCostosPdfDoc(
  selectedTopology: TopologyId,
  params: SimulationParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 16;

  const baselineCost = perBoardCostEur(TOPOLOGY_SPECS.max31865, batchSize);
  const activeSpec = TOPOLOGY_SPECS[selectedTopology];
  const activeRes = evaluateTopology(selectedTopology, params);
  const trueR = pt1000Resistance(params.collectorTempC);
  const dateStr = new Date().toISOString().slice(0, 10);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 01. Pt1000 Front-End Evaluation Report', margin, 8.3);
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
      pdfSafe(`Rev D (Gemini Version) | Switched-Mux DC Divider + 72 Hz RC Ramp | Generated ${dateStr}`),
      margin,
      pageH - 6.8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.8, { align: 'right' });
  };

  // =========================================================================
  // PAGE 1: Executive Overview, Bench Parameters, Matrix, Sweep Chart & Active BOM
  // =========================================================================
  addHeaderFooter(1, 9, 'Executive Summary & Full-Range Error Sweep');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Pt1000 Front-End Evaluation (MAX31865 -> Rev D Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(`Active Circuit: ${activeSpec.shortName} | Batch Size: ${batchSize}× JLCPCB | Collector: ${params.collectorTempC} °C | Tol: ±${params.resistorTolerancePct}%`),
    margin,
    26.8
  );
  y = 33.5;

  // Section 1: User Bench Parameters
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.text('1. Configured Bench Parameters', margin, y);
  y += 2.8;

  const paramRows: [string, string, string, string][] = [
    ['Selected Topology', pdfSafe(activeSpec.shortName), 'Collector Temp', pdfSafe(`${params.collectorTempC} °C (${trueR.toFixed(1)} Ohm)`)],
    ['Collector Poll Period', `${params.pollIntervalS} s`, 'Resistor Tolerance', pdfSafe(`±${params.resistorTolerancePct}%`)],
    ['2-Wire Roof Cable', pdfSafe(`${params.cableResistanceOhm.toFixed(2)} Ohm (~${Math.round(params.cableResistanceOhm / 0.0475)} m)`), 'Software Calibration', params.calibrateCableAndZero ? 'Enabled (Zero + Cable)' : 'Disabled (Raw)'],
    ['Pi 5 V Supply Rail', `${params.supplyVoltageV.toFixed(2)} V`, 'Board Ambient Temp', pdfSafe(`${params.ambientTempC} °C`)],
    ['Linux GPIO Jitter', pdfSafe(`±${params.gpioJitterUs} us`), 'Injected Fault Mode', params.activeFault === 'none' ? 'Nominal (No Fault)' : params.activeFault.toUpperCase()],
  ];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentW, paramRows.length * 5.8 + 2.8, 'FD');
  let py = y + 4.8;
  doc.setFontSize(8.0);
  for (const [k1, v1, k2, v2] of paramRows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k1 + ':', margin + 3, py);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v1, margin + 40, py);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k2 + ':', margin + 94, py);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v2, margin + 132, py);
    py += 5.8;
  }
  y += paramRows.length * 5.8 + 7.5;

  // Section 2: Summary Comparison Table (All 5 Topologies)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`2. All Topologies Compared (${batchSize}x JLCPCB Batch, @ ${params.collectorTempC} °C)`), margin, y);
  y += 2.8;

  const colW = [42, 16, 16, 17, 17, 19, 20, 35];
  const headers = ['Topology', 'Parts', 'Fee', 'Cost/Bd', 'Saved', 'dT @ T', 'Max Bound', 'Status / Interface'];

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);

  let cx = margin;
  headers.forEach((h, i) => {
    doc.text(h, cx + 2, y + 4.6);
    cx += colW[i];
  });
  y += 6.8;

  const evalRows = TOPOLOGY_ORDER.map((id) => {
    const spec = TOPOLOGY_SPECS[id];
    const live = evaluateTopology(id, params);
    const sweep = computeErrorSweep(id, params);
    const peakWorstK = sweep.reduce(
      (acc, p) => Math.max(acc, Math.abs(p.errorK) + (p.upperBoundK - p.errorK)),
      0
    );
    const unitCost = perBoardCostEur(spec, batchSize);
    const savings = baselineCost - unitCost;
    return { spec, live, peakWorstK, unitCost, savings };
  });

  doc.setFontSize(7.5);
  for (const { spec, live, peakWorstK, unitCost, savings } of evalRows) {
    const isSel = spec.id === selectedTopology;
    doc.setFillColor(isSel ? 239 : 255, isSel ? 246 : 255, isSel ? 255 : 255);
    doc.rect(margin, y, contentW, 7.2, 'FD');

    const rowVals = [
      pdfSafe(spec.shortName),
      `EUR ${spec.partCostEur.toFixed(2)}`,
      `EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)}`,
      `EUR ${unitCost.toFixed(2)}`,
      savings > 0 ? `-EUR ${savings.toFixed(2)}` : '-',
      live.errorK === null ? 'FAULT' : `${live.errorK >= 0 ? '+' : ''}${live.errorK.toFixed(2)} K`,
      `±${peakWorstK.toFixed(2)} K`,
      pdfSafe(`${live.safetyStatus} (${spec.interfacePins.split(' (')[0]})`),
    ];

    cx = margin;
    rowVals.forEach((val, idx) => {
      doc.setFont(idx === 0 ? 'helvetica' : 'courier', idx === 0 || idx === 3 ? 'bold' : 'normal');
      doc.setTextColor(idx === 4 && savings > 0 ? 4 : 15, idx === 4 && savings > 0 ? 120 : 23, idx === 4 && savings > 0 ? 87 : 42);
      doc.text(val, cx + 2, y + 4.9);
      cx += colW[idx];
    });
    y += 7.2;
  }
  y += 8;

  // Section 3: Vector Error Sweep Chart for Active Topology
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`3. Full-Range Error Sweep (-50 °C to +250 °C): ${activeSpec.shortName}`), margin, y);
  y += 3.5;

  const sweep = computeErrorSweep(selectedTopology, params);
  const baseSweep = selectedTopology === 'max31865' ? [] : computeErrorSweep('max31865', params);
  let maxAbs = 2.5;
  for (const p of sweep) {
    maxAbs = Math.max(maxAbs, Math.abs(p.upperBoundK), Math.abs(p.lowerBoundK));
  }
  maxAbs = Math.min(12, Math.ceil(maxAbs * 1.15 * 2) / 2);

  const chartX = margin + 12;
  const chartY = y + 2;
  const chartW = contentW - 16;
  const chartH = 44;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const xPos = (t: number) => chartX + ((t + 50) / 300) * chartW;
  const yPos = (e: number) => {
    const clamped = Math.max(-maxAbs, Math.min(maxAbs, e));
    return chartY + ((maxAbs - clamped) / (2 * maxAbs)) * chartH;
  };

  const yPlus1 = yPos(1.0);
  const yMinus1 = yPos(-1.0);
  doc.setFillColor(236, 253, 245);
  doc.rect(chartX, yPlus1, chartW, Math.max(0.5, yMinus1 - yPlus1), 'F');

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  for (const tick of [-maxAbs, 0, maxAbs]) {
    const ty = yPos(tick);
    doc.setDrawColor(tick === 0 ? 148 : 226, tick === 0 ? 163 : 232, tick === 0 ? 184 : 240);
    doc.line(chartX, ty, chartX + chartW, ty);
    doc.text(`${tick > 0 ? '+' : ''}${tick.toFixed(1)}K`, margin, ty + 1.8);
  }

  for (const xt of [-50, 0, 50, 100, 130, 150, 200, 250]) {
    const tx = xPos(xt);
    doc.setDrawColor(xt === 130 ? 217 : 241, xt === 130 ? 119 : 245, xt === 130 ? 6 : 249);
    doc.line(tx, chartY, tx, chartY + chartH);
    doc.setTextColor(xt === 130 ? 180 : 100, xt === 130 ? 83 : 116, xt === 130 ? 9 : 139);
    doc.text(`${xt}`, tx - 2.5, chartY + chartH + 4);
  }

  doc.setDrawColor(147, 197, 253);
  doc.setLineWidth(0.3);
  for (let i = 1; i < sweep.length; i++) {
    doc.line(xPos(sweep[i - 1].tempC), yPos(sweep[i - 1].upperBoundK), xPos(sweep[i].tempC), yPos(sweep[i].upperBoundK));
    doc.line(xPos(sweep[i - 1].tempC), yPos(sweep[i - 1].lowerBoundK), xPos(sweep[i].tempC), yPos(sweep[i].lowerBoundK));
  }

  if (baseSweep.length > 1) {
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);
    for (let i = 1; i < baseSweep.length; i++) {
      doc.line(xPos(baseSweep[i - 1].tempC), yPos(baseSweep[i - 1].errorK), xPos(baseSweep[i].tempC), yPos(baseSweep[i].errorK));
    }
  }

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.65);
  for (let i = 1; i < sweep.length; i++) {
    doc.line(xPos(sweep[i - 1].tempC), yPos(sweep[i - 1].errorK), xPos(sweep[i].tempC), yPos(sweep[i].errorK));
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.line(xPos(params.collectorTempC), chartY, xPos(params.collectorTempC), chartY + chartH);

  y = chartY + chartH + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const liveSummary =
    activeRes.measuredTempC === null
      ? `Active Fault Caught: ${activeRes.detectedFault} - ${activeRes.safetyDetail}`
      : pdfSafe(`At ${params.collectorTempC} °C: Measured ${activeRes.measuredTempC.toFixed(2)} °C (dT = ${activeRes.errorK! >= 0 ? '+' : ''}${activeRes.errorK!.toFixed(2)} K), Worst-Case ±${activeRes.worstCaseBoundK.toFixed(2)} K, Self-Heat +${activeRes.selfHeatingK.toFixed(3)} K.`);
  doc.text(pdfSafe(liveSummary), margin, y);
  y += 8;

  // Section 4: Active BOM Summary on Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`4. Active Topology BOM: ${activeSpec.shortName}`), margin, y);
  y += 3.5;

  const bomCol = [26, 76, 30, 26, 24];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 6.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  let bx = margin;
  ['Ref', 'Component', 'Package', 'LCSC Class', 'Est. Cost'].forEach((h, i) => {
    doc.text(h, bx + 2, y + 4.3);
    bx += bomCol[i];
  });
  y += 6.2;

  for (const item of activeSpec.bom) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentW, 6, 'FD');
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
      doc.text(v, bx + 2, y + 4.2);
      bx += bomCol[i];
    });
    y += 6;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('See pages 2-6 for dedicated schematics, BOMs, SW/CPU/security, page 7 for conclusion, and page 8 for KiCad BOM & pinout.', margin, y + 6);

  // =========================================================================
  // PAGES 2-6: ONE DEDICATED OPTION PER PAGE — FIXED EXACT Y COORDINATES!
  // Every paragraph/section title sits at the identical Y height across Pages 2-6.
  // =========================================================================
  const Y_VERDICT = 32.5;
  const Y_CIRCUIT_TITLE = 43.5;
  const Y_CIRCUIT_BOX = 46;
  const CIRCUIT_H = 60; // 46 .. 106
  const Y_BOM_TITLE = 111.5;
  const Y_BOM_TABLE = 114; // 5 + 5*4.6 = 28mm -> ends by 142
  const Y_SW_TITLE = 146.5;
  const Y_SW_BOX = 149;
  const SW_BOX_H = 26; // 149 .. 175
  const Y_PROCON_TITLE = 180.5;
  const Y_PROCON_BODY = 184.5; // 184.5 .. 244
  const Y_SEC_TITLE = 247.5;
  const Y_SEC_BOX = 250;
  const SEC_BOX_H = 33; // 250 .. 283

  evalRows.forEach(({ spec, peakWorstK, unitCost, savings }, idx) => {
    doc.addPage();
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    const c2 = perBoardCostEur(spec, 2);
    const c5 = perBoardCostEur(spec, 5);
    const resFootprint = estimateResourceFootprint(spec.id, params.pollIntervalS);

    // 1. Page Title & Cost Summary directly under full-bleed dark top bar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.6);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(`Option 0${idx + 1}: ${spec.name}`), margin, 21.0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      pdfSafe(
        `Cost (${batchSize}×): EUR ${unitCost.toFixed(2)}/bd (2× EUR ${c2.toFixed(2)} | 5× EUR ${c5.toFixed(2)})  |  ${savings > 0 ? `Saves EUR ${savings.toFixed(2)}/bd` : 'Baseline'}  |  Bound: ±${peakWorstK.toFixed(2)} K`
      ),
      margin,
      26.4
    );

    // 2. Verdict (Fixed Y = 32.5)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.1);
    doc.setTextColor(51, 65, 85);
    const verdictLines = doc.splitTextToSize(pdfSafe(spec.verdict), contentW).slice(0, 2);
    doc.text(verdictLines, margin, Y_VERDICT);

    // 3. Circuit Schematic (Fixed Title Y = 43.5, Box Y = 46..106)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Circuit Schematic & Pi Interface', margin, Y_CIRCUIT_TITLE);
    drawPdfCircuitSchematic(doc, spec, margin, Y_CIRCUIT_BOX, contentW, CIRCUIT_H, params.pollIntervalS);

    // 4. Bill of Materials (Fixed Title Y = 111.5, Table Y = 114)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text(
      pdfSafe(`2. Bill of Materials (Parts: EUR ${spec.partCostEur.toFixed(2)} | Feeder Fee: EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})`),
      margin,
      Y_BOM_TITLE
    );

    let bomY = Y_BOM_TABLE;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, bomY, contentW, 4.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let bxp = margin;
    ['Ref', 'Component', 'Pkg', 'LCSC', 'EUR'].forEach((h, i) => {
      doc.text(h, bxp + 2, bomY + 3.4);
      bxp += [22, 82, 26, 26, 26][i];
    });
    bomY += 4.8;

    for (const item of spec.bom) {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, bomY, contentW, 4.5, 'FD');
      bxp = margin;
      [
        pdfSafe(item.designator),
        pdfSafe(item.part),
        pdfSafe(item.packageType),
        item.jlcpcbClass,
        `EUR ${item.unitCostEur.toFixed(2)}`,
      ].forEach((val, i) => {
        doc.setFont(i === 1 ? 'helvetica' : 'courier', i === 0 ? 'bold' : 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(val, bxp + 2, bomY + 3.2);
        bxp += [22, 82, 26, 26, 26][i];
      });
      bomY += 4.5;
    }

    // 5. Pi Overlays, Software & CPU/RAM (Fixed Title Y = 146.5, Box Y = 149..175)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Pi Overlays, Software Changes & CPU / RAM Footprint', margin, Y_SW_TITLE);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_SW_BOX, contentW, SW_BOX_H, 'FD');

    const cfgLines = doc.splitTextToSize(pdfSafe(`config.txt: ${spec.configTxtDiff}`), contentW - 6);
    const swLines = doc.splitTextToSize(pdfSafe(`costos-hw-linux: ${spec.softwareChanges}`), contentW - 6);
    const cpuRamLines = doc.splitTextToSize(
      pdfSafe(`Pi CPU (${params.pollIntervalS}s poll): ${resFootprint.cpuDelta}  |  RAM: ${resFootprint.ramDelta}`),
      contentW - 6
    );

    let sy2 = Y_SW_BOX + 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(15, 23, 42);
    doc.text(cfgLines, margin + 3, sy2);
    sy2 += cfgLines.length * 3.2 + 0.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(swLines, margin + 3, sy2);
    sy2 += swLines.length * 3.2 + 0.8;

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(cpuRamLines, margin + 3, sy2);

    // 6. Hardware & Software Pros/Cons (Fixed Title Y = 180.5, Body Y = 184.5)
    const colHalf = (contentW - 6) / 2;
    const rightColX = margin + colHalf + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(4, 120, 87);
    doc.text('4. Hardware & Software Pros', margin, Y_PROCON_TITLE);
    doc.setTextColor(190, 18, 60);
    doc.text('Hardware & Software Cons', rightColX, Y_PROCON_TITLE);

    let leftY = Y_PROCON_BODY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(30, 41, 59);
    for (const item of [...spec.advantages, ...spec.softwarePros]) {
      const lines = doc.splitTextToSize(pdfSafe(`+ ${item}`), colHalf - 2);
      doc.text(lines, margin + 1, leftY);
      leftY += lines.length * 3.15 + 0.45;
    }

    let rightY = Y_PROCON_BODY;
    for (const item of [...spec.tradeoffs, ...spec.softwareCons]) {
      const lines = doc.splitTextToSize(pdfSafe(`- ${item}`), colHalf - 2);
      doc.text(lines, rightColX + 1, rightY);
      rightY += lines.length * 3.15 + 0.45;
    }

    // 7. Security & Functional Safety (Fixed Title Y = 247.5, Box Y = 250..283)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(30, 64, 175);
    doc.text('5. Security & Functional Safety Profile', margin, Y_SEC_TITLE);

    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.rect(margin, Y_SEC_BOX, contentW, SEC_BOX_H, 'FD');

    const secOs = doc.splitTextToSize(pdfSafe(`Linux Security: ${spec.securityNotes.linuxOsSecurity}`), contentW - 6);
    const secHw = doc.splitTextToSize(pdfSafe(`Electrical Safety: ${spec.securityNotes.electricalSafety}`), contentW - 6);
    const secMit = doc.splitTextToSize(pdfSafe(`Mitigation: ${spec.securityNotes.mitigation}`), contentW - 6);

    let secY = Y_SEC_BOX + 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(30, 41, 59);
    for (const blk of [secOs, secHw, secMit]) {
      doc.text(blk, margin + 3, secY);
      secY += blk.length * 3.15 + 0.7;
    }
  });

  // =========================================================================
  // PAGE 7: FINAL ENGINEERING CONCLUSION (Initial MAX31865 vs. Switched Ramp Rev D)
  // =========================================================================
  const conclusion = buildBaselineConclusion(params, batchSize);
  doc.addPage();
  addHeaderFooter(7, 9, 'Engineering Conclusion & Baseline Scorecard');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Engineering Conclusion: MAX31865AAP+ vs. Gemini Version (Rev D)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(`Scorecard across all ${conclusion.rows.length} aspects @ ${batchSize}× JLCPCB batch, ${params.pollIntervalS}s poll, ±${params.resistorTolerancePct}% tol`),
    margin,
    26.8
  );

  // 3 Summary Verdict Boxes
  const cardW = (contentW - 8) / 3;
  const scoreCards: { label: string; count: number; fill: [number, number, number]; border: [number, number, number]; text: [number, number, number] }[] = [
    { label: 'BETTER (Gemini Rev D)', count: conclusion.betterCount, fill: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
    { label: 'EQUAL (Parity w/ MAX31865)', count: conclusion.equalCount, fill: [241, 245, 249], border: [203, 213, 225], text: [51, 65, 85] },
    { label: 'WORSE (Known Trade-Offs)', count: conclusion.worseCount, fill: [255, 241, 242], border: [254, 205, 211], text: [190, 18, 60] },
  ];
  scoreCards.forEach((sc, idx) => {
    const cx0 = margin + idx * (cardW + 4);
    doc.setFillColor(sc.fill[0], sc.fill[1], sc.fill[2]);
    doc.setDrawColor(sc.border[0], sc.border[1], sc.border[2]);
    doc.setLineWidth(0.3);
    doc.rect(cx0, 32, cardW, 12, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(sc.text[0], sc.text[1], sc.text[2]);
    doc.text(String(sc.count), cx0 + 5, 39.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(sc.label, cx0 + 14, 39.2);
  });

  // 16-Aspect Comparison Table
  const cCols = [34, 34, 36, 16, 62];
  const cHeaders = ['Aspect', 'Initial (MAX31865)', 'Gemini (Rev D)', 'Verdict', 'Engineering Rationale'];
  let cy = 48;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, cy, contentW, 6.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  let xPosCol = margin;
  cHeaders.forEach((h, i) => {
    doc.text(h, xPosCol + (i === 3 ? cCols[i] / 2 : 2), cy + 4.2, i === 3 ? { align: 'center' } : undefined);
    xPosCol += cCols[i];
  });
  cy += 6.2;

  for (const row of conclusion.rows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const aspLines = doc.splitTextToSize(pdfSafe(row.aspect), cCols[0] - 3);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.1);
    const initLines = doc.splitTextToSize(pdfSafe(row.initialValue), cCols[1] - 3);

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.1);
    const nowLines = doc.splitTextToSize(pdfSafe(row.nowUsedValue), cCols[2] - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    const ratLines = doc.splitTextToSize(pdfSafe(row.rationale), cCols[4] - 3);

    const maxLines = Math.max(aspLines.length, initLines.length, nowLines.length, ratLines.length);
    const rowH = Math.max(8.0, maxLines * 3.0 + 3.0);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cy, contentW, rowH, 'FD');

    let rx = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(aspLines, rx + 1.5, cy + 4.0);
    rx += cCols[0];

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(71, 85, 105);
    doc.text(initLines, rx + 1.5, cy + 4.0);
    rx += cCols[1];

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(15, 23, 42);
    doc.text(nowLines, rx + 1.5, cy + 4.0);
    rx += cCols[2];

    // Verdict Box
    const vFill: [number, number, number] =
      row.verdict === 'BETTER' ? [236, 253, 245] : row.verdict === 'WORSE' ? [255, 241, 242] : [241, 245, 249];
    const vText: [number, number, number] =
      row.verdict === 'BETTER' ? [4, 120, 87] : row.verdict === 'WORSE' ? [190, 18, 60] : [51, 65, 85];
    doc.setFillColor(vFill[0], vFill[1], vFill[2]);
    doc.rect(rx + 1.2, cy + 1.8, cCols[3] - 2.4, 4.6, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(vText[0], vText[1], vText[2]);
    doc.text(row.verdict, rx + cCols[3] / 2, cy + 5.0, { align: 'center' });
    rx += cCols[3];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(51, 65, 85);
    doc.text(ratLines, rx + 1.5, cy + 4.0);

    cy += rowH;
  }

  // Final Executive Takeaway Box
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const takeLines = doc.splitTextToSize(pdfSafe(`Bottom Line: ${conclusion.takeaway}`), contentW - 8);
  const takeH = takeLines.length * 3.6 + 5.5;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(margin, cy + 4.5, contentW, takeH, 'FD');
  doc.setTextColor(30, 41, 59);
  doc.text(takeLines, margin + 4, cy + 9.2);

  // =========================================================================
  // PAGE 8: KICAD READY BOM & RASPBERRY PI PINOUT (Switched Ramp Rev D Audited)
  // =========================================================================
  doc.addPage();
  addHeaderFooter(8, 9, 'KiCad Production BOM & Pi / U1 Pinout');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad Manufacturing Package: Switched Ramp Rev D (Gemini Version)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'BOM: EUR 0.36/bd (31 parts)  |  100% Basic SMD: 11 Basic + 1 Pref (C17656) + 0 Ext (EUR 0.00 loading fees!)  |  +/-0.5 K cal (+/-2-4 K raw)',
    margin,
    26.8
  );

  // Table 1: Raspberry Pi Header & IC Pinout
  let ky = 33.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Raspberry Pi 40-Pin Header, U1 (LM393DR) & Screw Terminal Pinout', margin, ky);
  ky += 2.5;

  const pCols = [33, 33, 28, 88];
  const pHeaders = ['Device / Header', 'Pin / GPIO', 'KiCad Net', 'Connection & Engineering Note'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ky, contentW, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  let pxCol = margin;
  pHeaders.forEach((h, i) => {
    doc.text(h, pxCol + 2, ky + 3.8);
    pxCol += pCols[i];
  });
  ky += 5.4;

  for (const pinRow of REV_D_PINOUT) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    const devLines = doc.splitTextToSize(pdfSafe(pinRow.device), pCols[0] - 3);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.0);
    const pinLines = doc.splitTextToSize(pdfSafe(pinRow.pin), pCols[1] - 3);

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    const netLines = doc.splitTextToSize(pdfSafe(pinRow.netName), pCols[2] - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    const noteLines = doc.splitTextToSize(pdfSafe(pinRow.connectionNote), pCols[3] - 3);

    const maxLines = Math.max(devLines.length, pinLines.length, netLines.length, noteLines.length);
    const rowH = Math.max(5.4, maxLines * 2.75 + 2.2);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');

    let rx = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(15, 23, 42);
    doc.text(devLines, rx + 1.5, ky + 3.4);
    rx += pCols[0];

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(51, 65, 85);
    doc.text(pinLines, rx + 1.5, ky + 3.4);
    rx += pCols[1];

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(29, 78, 216);
    doc.text(netLines, rx + 1.5, ky + 3.4);
    rx += pCols[2];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(51, 65, 85);
    doc.text(noteLines, rx + 1.5, ky + 3.4);

    ky += rowH;
  }

  ky += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Live-Audited 100% Basic KiCad / JLCPCB BOM (12 Lines / 31 Parts: 11 Basic + 1 Pref + 0 Ext)', margin, ky);
  ky += 2.5;

  const bCols = [22, 8, 25, 45, 15, 67];
  const bHeaders = ['RefDes', 'Qty', 'Value', 'KiCad Footprint', 'Class', 'Role / Specification'];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, ky, contentW, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  pxCol = margin;
  bHeaders.forEach((h, i) => {
    doc.text(h, pxCol + (i === 1 ? bCols[i] / 2 : 1.5), ky + 3.8, i === 1 ? { align: 'center' } : undefined);
    pxCol += bCols[i];
  });
  ky += 5.4;

  for (const bomRow of REV_D_KICAD_BOM) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    const refLines = doc.splitTextToSize(pdfSafe(bomRow.refDes), bCols[0] - 2.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    const valLines = doc.splitTextToSize(pdfSafe(bomRow.value), bCols[2] - 2.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.2);
    const fpLines = doc.splitTextToSize(pdfSafe(bomRow.footprint), bCols[3] - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.9);
    const descLines = doc.splitTextToSize(pdfSafe(`${bomRow.lcsc} (${bomRow.mpn}, ${bomRow.tolerance}) - ${bomRow.purpose}`), bCols[5] - 2.5);

    const maxLines = Math.max(refLines.length, valLines.length, fpLines.length, descLines.length);
    const rowH = Math.max(5.2, maxLines * 2.65 + 2.0);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');

    let rx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    doc.setTextColor(15, 23, 42);
    doc.text(refLines, rx + 1.5, ky + 3.2);
    rx += bCols[0];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(51, 65, 85);
    doc.text(String(bomRow.qty), rx + bCols[1] / 2, ky + 3.2, { align: 'center' });
    rx += bCols[1];

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    doc.setTextColor(30, 64, 175);
    doc.text(valLines, rx + 1.5, ky + 3.2);
    rx += bCols[2];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(71, 85, 105);
    doc.text(fpLines, rx + 1.5, ky + 3.2);
    rx += bCols[3];

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.7);
    doc.setTextColor(
      bomRow.jlcpcbClass === 'Basic' ? 4 : bomRow.jlcpcbClass === 'Preferred' ? 3 : 146,
      bomRow.jlcpcbClass === 'Basic' ? 120 : bomRow.jlcpcbClass === 'Preferred' ? 105 : 64,
      bomRow.jlcpcbClass === 'Basic' ? 87 : bomRow.jlcpcbClass === 'Preferred' ? 161 : 14
    );
    doc.text(pdfSafe(bomRow.jlcpcbClass), rx + 1.5, ky + 3.2);
    rx += bCols[4];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.9);
    doc.setTextColor(51, 65, 85);
    doc.text(descLines, rx + 1.5, ky + 3.2);

    ky += rowH;
  }

  // Final KiCad Layout & Honest Pt1000 Accuracy Budget Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const kicadNote = doc.splitTextToSize(
    pdfSafe(
      'Honest Pt1000 Error Budget & Layout Note: With single-reel 1% +/-100ppm Basic resistors (7x C17513 = 4.00k/1.00k/2.00k), 2x 10nF X7R Basic (C1710, BIST-cancelled), dual-wire 100nF 50V ESD caps (C106+C105, C49678), symmetric 1N4148W (D8+D8B, C81598), and C7955 LM393DR2G, the entire HAT has 0 Extended SMD reels (EUR 0.00 loading fees!). Raw accuracy is ~+/-2-4 K, tightening to ~+/-0.4-0.6 K after a 5 s Setup Wizard calibration (drop-in 0.1% C110774 optional for +EUR 2.80). Place C106/C105, R4/C3/D8/D8B, and R5A||B right at J6.'
    ),
    contentW - 8
  );
  const noteH = kicadNote.length * 3.05 + 4.0;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(217, 119, 6);
  doc.rect(margin, ky + 3.0, contentW, noteH, 'FD');
  doc.setTextColor(120, 53, 15);
  doc.text(kicadNote, margin + 4, ky + 6.8);

  // ============================================================================
  // PAGE 9: HARDWARE AUDIT & REVISION HISTORY (Rev A -> Rev D)
  // ============================================================================
  doc.addPage();
  addHeaderFooter(9, 9, 'Hardware Audit & Revision History (Rev A -> Rev D)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Hardware Audit & Revision History (Rev A -> Rev D | Gemini Version)', margin, 21.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe('Complete engineering progression of Option 02 from initial RC oscillator concept to the Gemini Version (Rev D) production circuit.'),
    margin,
    26.8
  );

  // Section 1: 4 Revision Cards (stacked cleanly)
  let ay = 33.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Revision Iteration Timeline (Rev A -> Rev B -> Rev C -> Rev D Gemini)', margin, ay);
  ay += 3.5;

  for (const rev of REVISION_HISTORY) {
    const isCurrent = rev.status === 'Production Baseline';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    const archLines = doc.splitTextToSize(pdfSafe(rev.architecture), contentW - 8);
    const findingLines: string[][] = rev.findings.map((f) =>
      doc.splitTextToSize(pdfSafe(`${isCurrent ? '+' : '-'} ${f}`), contentW - 10)
    );
    const totalFindingLines = findingLines.reduce((acc, arr) => acc + arr.length, 0);
    const cardH = 8.5 + archLines.length * 2.85 + totalFindingLines * 2.75 + 4.5;

    doc.setFillColor(isCurrent ? 236 : 248, isCurrent ? 253 : 250, isCurrent ? 245 : 252);
    doc.setDrawColor(isCurrent ? 110 : 226, isCurrent ? 231 : 232, isCurrent ? 183 : 240);
    doc.rect(margin, ay, contentW, cardH, 'FD');

    // Badge + Title + Cost snapshot
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(isCurrent ? 6 : 30, isCurrent ? 95 : 64, isCurrent ? 70 : 175);
    doc.text(pdfSafe(`[${rev.rev}]`), margin + 3.5, ay + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(rev.title), margin + 17.5, ay + 4.8);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(rev.costSnapshot), margin + contentW - 3.5, ay + 4.8, { align: 'right' });

    let cy = ay + 8.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(51, 65, 85);
    doc.text(archLines, margin + 3.5, cy);
    cy += archLines.length * 2.85 + 1.2;

    doc.setTextColor(isCurrent ? 6 : 127, isCurrent ? 78 : 29, isCurrent ? 59 : 29);
    for (const fl of findingLines) {
      doc.text(fl, margin + 5, cy);
      cy += fl.length * 2.75;
    }

    ay += cardH + 2.6;
  }

  // Section 2: 5-Point Rev C -> Rev D Audit Resolution Table
  ay += 1.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Rev C -> Rev D (Gemini Version) Hardware Audit Resolution Matrix', margin, ay);
  ay += 3.2;

  const aCols = [14, 28, 52, 52, 36]; // sum = 182
  const aHeaders = ['ID', 'Audit Area', 'Rev C Defect', 'Rev D (Gemini) Fix', 'Verified Result'];

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ay, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  let ax = margin;
  for (let i = 0; i < aHeaders.length; i++) {
    doc.text(aHeaders[i], ax + 1.5, ay + 3.9);
    ax += aCols[i];
  }
  ay += 5.8;

  for (let idx = 0; idx < REV_C_TO_D_AUDIT_FIXES.length; idx++) {
    const row = REV_C_TO_D_AUDIT_FIXES[idx];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.9);
    const flawLines = doc.splitTextToSize(pdfSafe(row.revCFlaw), aCols[2] - 3);
    const fixLines = doc.splitTextToSize(pdfSafe(row.revDFix), aCols[3] - 3);
    const impLines = doc.splitTextToSize(pdfSafe(row.verifiedImpact), aCols[4] - 3);
    const areaLines = doc.splitTextToSize(pdfSafe(row.area), aCols[1] - 3);
    const maxL = Math.max(flawLines.length, fixLines.length, impLines.length, areaLines.length);
    const rowH = Math.max(5.8, maxL * 2.65 + 2.2);

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ay, contentW, rowH, 'FD');

    let rx = margin;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(30, 64, 175);
    doc.text(pdfSafe(row.id), rx + 1.5, ay + 3.3);
    rx += aCols[0];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(15, 23, 42);
    doc.text(areaLines, rx + 1.5, ay + 3.3);
    rx += aCols[1];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.9);
    doc.setTextColor(127, 29, 29);
    doc.text(flawLines, rx + 1.5, ay + 3.3);
    rx += aCols[2];

    doc.setTextColor(30, 41, 59);
    doc.text(fixLines, rx + 1.5, ay + 3.3);
    rx += aCols[3];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(4, 120, 87);
    doc.text(impLines, rx + 1.5, ay + 3.3);

    ay += rowH;
  }

  return doc;
}

export function exportCostosPdfReport(
  selectedTopology: TopologyId,
  params: SimulationParams,
  batchSize: 2 | 5
): void {
  const doc = buildCostosPdfDoc(selectedTopology, params, batchSize);
  doc.save(`CoSTOS-Pt1000-RevD-Gemini-${selectedTopology}.pdf`);
}
