import { jsPDF } from 'jspdf';
import {
  PUMP_TOPOLOGY_ORDER,
  PUMP_TOPOLOGY_SPECS,
  PumpSimParams,
  PumpTopologyId,
  PumpTopologySpec,
  buildPumpConclusion,
  computePumpVoltageSweep,
  evaluatePumpSupply,
  pumpPerBoardCostEur,
} from '../physics/model';
import { PUMP_REV_D_BOM, PUMP_REV_D_PINOUT } from '../components/KicadBomPinout';
import {
  PUMP_D25_TO_REVD_FIXES,
  PUMP_REVISION_HISTORY,
} from '../components/AuditHistory';

// Sanitize Unicode characters unsupported by standard PDF WinAnsi Helvetica / Courier
// Keeps native WinAnsi glyphs ° (0xB0), ± (0xB1), ² (0xB2), µ (0xB5), × (0xD7)
function pdfSafe(text: string): string {
  return text
    .replace(/€/g, 'EUR ')
    .replace(/Ω/g, 'Ohm')
    .replace(/μ/g, 'µ')
    .replace(/\bdeg\s*C\b/g, '°C')
    .replace(/\+\/-/g, '±')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≈/g, '~')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/—/g, ' - ')
    .replace(/·/g, '|')
    .replace(/’/g, "'")
    .replace(/‘/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/[^\x20-\x7E\xB0\xB1\xB2\xB5\xD7]/g, ' ');
}

/**
 * Draws a crisp, authentic IEEE/IEC component-level vector schematic for each of the
 * 5 pump driver supply topologies + shared H3 (Q6 PNP / R9 / SMBJ / R31-R32 / J2 PUMP1)
 * using genuine electronic symbols (BJTs with arrows, S-hook Schottkys, inductors,
 * zig-zag resistors, parallel-plate caps, TVS diodes, comparator triangles, GND & VCC rails).
 */
function drawPdfPumpSchematic(
  doc: jsPDF,
  spec: PumpTopologySpec,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  // Normalized 800 x 260 schematic canvas mapped cleanly into (bx, by, bw, bh)
  const sx = (u: number) => bx + (u / 800) * bw;
  const sy = (v: number) => by + (v / 260) * bh;
  const sw = (u: number) => (u / 800) * bw;
  const sh = (v: number) => (v / 260) * bh;

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
    doc.circle(sx(x), sy(y), sw(2.3), 'F');
  };

  const vcc = (x: number, y: number, label = '+5V', rgb: [number, number, number] = [29, 78, 216]) => {
    setStroke(rgb[0], rgb[1], rgb[2], 0.34);
    doc.line(sx(x - 8), sy(y), sx(x + 8), sy(y));
    doc.line(sx(x), sy(y), sx(x), sy(y + 8));
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(label, sx(x), sy(y - 3.5), { align: 'center' });
  };

  const gnd = (x: number, y: number, rgb: [number, number, number] = [71, 85, 105]) => {
    setStroke(rgb[0], rgb[1], rgb[2], 0.3);
    doc.line(sx(x), sy(y), sx(x), sy(y + 6));
    doc.line(sx(x - 9), sy(y + 6), sx(x + 9), sy(y + 6));
    doc.line(sx(x - 6), sy(y + 10), sx(x + 6), sy(y + 10));
    doc.line(sx(x - 3), sy(y + 14), sx(x + 3), sy(y + 14));
  };

  // Authentic IEEE zig-zag horizontal resistor between x1 and x2 at y
  const resH = (x1: number, x2: number, y: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const mid = (x1 + x2) / 2;
    const body = Math.min(28, (x2 - x1) * 0.65);
    const b1 = mid - body / 2;
    const b2 = mid + body / 2;
    const step = body / 6;
    const amp = 5.5;
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x1), sy(y), sx(b1), sy(y));
    const pts: [number, number][] = [
      [b1, y],
      [b1 + step * 0.5, y - amp],
      [b1 + step * 1.5, y + amp],
      [b1 + step * 2.5, y - amp],
      [b1 + step * 3.5, y + amp],
      [b1 + step * 4.5, y - amp],
      [b1 + step * 5.5, y + amp],
      [b2, y],
    ];
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1][0]), sy(pts[i - 1][1]), sx(pts[i][0]), sy(pts[i][1]));
    }
    doc.line(sx(b2), sy(y), sx(x2), sy(y));
  };

  // Authentic IEEE zig-zag vertical resistor at x between y1 and y2
  const resV = (x: number, y1: number, y2: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const mid = (y1 + y2) / 2;
    const body = Math.min(24, (y2 - y1) * 0.65);
    const b1 = mid - body / 2;
    const b2 = mid + body / 2;
    const step = body / 6;
    const amp = 5.2;
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(x), sy(y1), sx(x), sy(b1));
    const pts: [number, number][] = [
      [x, b1],
      [x - amp, b1 + step * 0.5],
      [x + amp, b1 + step * 1.5],
      [x - amp, b1 + step * 2.5],
      [x + amp, b1 + step * 3.5],
      [x - amp, b1 + step * 4.5],
      [x + amp, b1 + step * 5.5],
      [x, b2],
    ];
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1][0]), sy(pts[i - 1][1]), sx(pts[i][0]), sy(pts[i][1]));
    }
    doc.line(sx(x), sy(b2), sx(x), sy(y2));
  };

  // Parallel-plate capacitor (horizontal)
  const capH = (x1: number, x2: number, y: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const mid = (x1 + x2) / 2;
    const gap = 3.2;
    const h = 11;
    setStroke(rgb[0], rgb[1], rgb[2], 0.3);
    doc.line(sx(x1), sy(y), sx(mid - gap), sy(y));
    doc.line(sx(mid - gap), sy(y - h), sx(mid - gap), sy(y + h));
    doc.line(sx(mid + gap), sy(y - h), sx(mid + gap), sy(y + h));
    doc.line(sx(mid + gap), sy(y), sx(x2), sy(y));
  };

  // Parallel-plate capacitor (vertical)
  const capV = (x: number, y1: number, y2: number, rgb: [number, number, number] = [51, 65, 85]) => {
    const mid = (y1 + y2) / 2;
    const gap = 3.2;
    const w = 10;
    setStroke(rgb[0], rgb[1], rgb[2], 0.3);
    doc.line(sx(x), sy(y1), sx(x), sy(mid - gap));
    doc.line(sx(x - w), sy(mid - gap), sx(x + w), sy(mid - gap));
    doc.line(sx(x - w), sy(mid + gap), sx(x + w), sy(mid + gap));
    doc.line(sx(x), sy(mid + gap), sx(x), sy(y2));
  };

  // Horizontal diode (silicon or S-hook Schottky), pointing left -> right
  const diodeH = (
    x1: number,
    x2: number,
    y: number,
    schottky: boolean,
    rgb: [number, number, number] = [5, 150, 105],
    fill: [number, number, number] = [236, 253, 245]
  ) => {
    const mid = (x1 + x2) / 2;
    const triA = mid - 7;
    const triK = mid + 6;
    const halfH = 8.5;
    setStroke(rgb[0], rgb[1], rgb[2], 0.32);
    doc.line(sx(x1), sy(y), sx(triA), sy(y));
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.triangle(sx(triA), sy(y - halfH), sx(triA), sy(y + halfH), sx(triK), sy(y), 'FD');
    doc.line(sx(triK), sy(y - halfH), sx(triK), sy(y + halfH));
    if (schottky) {
      // Authentic S-hook Schottky wings on cathode bar
      doc.line(sx(triK), sy(y - halfH), sx(triK + 3.5), sy(y - halfH));
      doc.line(sx(triK + 3.5), sy(y - halfH), sx(triK + 3.5), sy(y - halfH + 3.2));
      doc.line(sx(triK), sy(y + halfH), sx(triK - 3.5), sy(y + halfH));
      doc.line(sx(triK - 3.5), sy(y + halfH), sx(triK - 3.5), sy(y + halfH - 3.2));
    }
    doc.line(sx(triK), sy(y), sx(x2), sy(y));
  };

  // Vertical unidirectional TVS / Zener clamp diode (cathode at top y1, anode at bottom y2)
  const tvsV = (x: number, y1: number, y2: number, rgb: [number, number, number] = [29, 78, 216]) => {
    const mid = (y1 + y2) / 2;
    const kY = mid - 5.5;
    const aY = mid + 6.5;
    const halfW = 6.5;
    setStroke(rgb[0], rgb[1], rgb[2], 0.3);
    doc.line(sx(x), sy(y1), sx(x), sy(kY));
    doc.setFillColor(239, 246, 255);
    doc.triangle(sx(x - halfW), sy(aY), sx(x + halfW), sy(aY), sx(x), sy(kY), 'FD');
    doc.line(sx(x - halfW), sy(kY), sx(x + halfW), sy(kY));
    // Zener/TVS angled cathode wings
    doc.line(sx(x - halfW), sy(kY), sx(x - halfW - 2.5), sy(kY - 3));
    doc.line(sx(x + halfW), sy(kY), sx(x + halfW + 2.5), sy(kY + 3));
    doc.line(sx(x), sy(aY), sx(x), sy(y2));
  };

  // Authentic 4-arch ferromagnetic inductor coil between x1 and x2 at y
  const inductorH = (x1: number, x2: number, y: number, rgb: [number, number, number] = [30, 64, 175]) => {
    const mid = (x1 + x2) / 2;
    const arches = 4;
    const r = 6.5;
    const totalW = arches * 2 * r;
    const startX = mid - totalW / 2;
    const endX = mid + totalW / 2;
    setStroke(rgb[0], rgb[1], rgb[2], 0.32);
    doc.line(sx(x1), sy(y), sx(startX), sy(y));
    const steps = 8;
    for (let a = 0; a < arches; a++) {
      const acx = startX + r + a * 2 * r;
      for (let s = 1; s <= steps; s++) {
        const th0 = Math.PI - ((s - 1) / steps) * Math.PI;
        const th1 = Math.PI - (s / steps) * Math.PI;
        const p0x = acx + r * Math.cos(th0);
        const p0y = y - r * 1.15 * Math.sin(th0);
        const p1x = acx + r * Math.cos(th1);
        const p1y = y - r * 1.15 * Math.sin(th1);
        doc.line(sx(p0x), sy(p0y), sx(p1x), sy(p1y));
      }
    }
    // Ferromagnetic core line above coils
    doc.line(sx(startX), sy(y - r * 1.55), sx(endX), sy(y - r * 1.55));
    doc.line(sx(endX), sy(y), sx(x2), sy(y));
  };

  // Authentic IEEE BJT transistor (vertical C-E, base entering from left)
  // For NPN: collector top, emitter bottom with outward arrow
  // For PNP: emitter top (or bottom if follower), inward arrow on emitter leg!
  const bjtVert = (
    cx: number,
    cy: number,
    type: 'npn' | 'pnp',
    emitterOnTop = false,
    rgb: [number, number, number] = [30, 41, 59]
  ) => {
    const r = 13.5;
    // Circle envelope
    doc.setFillColor(255, 255, 255);
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.circle(sx(cx), sy(cy), sw(r), 'FD');
    // Base lead + vertical base bar
    setStroke(rgb[0], rgb[1], rgb[2], 0.38);
    doc.line(sx(cx - 5), sy(cy - 8), sx(cx - 5), sy(cy + 8));
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(cx - 17), sy(cy), sx(cx - 5), sy(cy));
    // Top diagonal & vertical lead
    doc.line(sx(cx - 5), sy(cy - 4), sx(cx + 6), sy(cy - 11));
    doc.line(sx(cx + 6), sy(cy - 11), sx(cx + 6), sy(cy - 18));
    // Bottom diagonal & vertical lead
    doc.line(sx(cx - 5), sy(cy + 4), sx(cx + 6), sy(cy + 11));
    doc.line(sx(cx + 6), sy(cy + 11), sx(cx + 6), sy(cy + 18));

    // Emitter arrowhead
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    if (type === 'npn' && !emitterOnTop) {
      // Outward arrow on bottom-right leg
      doc.triangle(sx(cx + 6), sy(cy + 11), sx(cx + 1.2), sy(cy + 10.6), sx(cx + 3.2), sy(cy + 6.4), 'F');
    } else if (type === 'pnp' && emitterOnTop) {
      // Inward arrow on top-right leg (pointing toward base)
      doc.triangle(sx(cx - 4.2), sy(cy - 4.5), sx(cx + 0.8), sy(cy - 5.2), sx(cx - 1.2), sy(cy - 9.2), 'F');
    } else if (type === 'pnp' && !emitterOnTop) {
      // Inward arrow on bottom-right leg (for PNP collector-at-top / emitter-at-bottom)
      doc.triangle(sx(cx - 4.2), sy(cy + 4.5), sx(cx - 1.2), sy(cy + 9.2), sx(cx + 0.8), sy(cy + 5.2), 'F');
    }
  };

  // Authentic High-Side Horizontal PNP Switch (Q6 in H3: Emitter left from +V_DRV, Collector right to R9, Base down)
  const bjtHighSidePnp = (cx: number, cy: number, rgb: [number, number, number] = [30, 41, 59]) => {
    const r = 13.5;
    doc.setFillColor(255, 255, 255);
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.circle(sx(cx), sy(cy), sw(r), 'FD');
    // Horizontal base bar at bottom
    setStroke(rgb[0], rgb[1], rgb[2], 0.38);
    doc.line(sx(cx - 8), sy(cy + 5), sx(cx + 8), sy(cy + 5));
    setStroke(rgb[0], rgb[1], rgb[2], 0.28);
    doc.line(sx(cx), sy(cy + 5), sx(cx), sy(cy + 19)); // Base lead down
    // Left emitter diagonal + lead
    doc.line(sx(cx - 4), sy(cy + 5), sx(cx - 11), sy(cy - 5));
    doc.line(sx(cx - 11), sy(cy - 5), sx(cx - 18), sy(cy - 5));
    // Right collector diagonal + lead
    doc.line(sx(cx + 4), sy(cy + 5), sx(cx + 11), sy(cy - 5));
    doc.line(sx(cx + 11), sy(cy - 5), sx(cx + 18), sy(cy - 5));
    // PNP Emitter arrow pointing INWARD (down-right toward base bar)
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.triangle(sx(cx - 4.5), sy(cy + 4.2), sx(cx - 9.4), sy(cy + 1.8), sx(cx - 5.8), sy(cy - 1.5), 'F');
  };

  // Outer schematic frame
  doc.setFillColor(255, 255, 255);
  setStroke(203, 213, 225, 0.3);
  doc.rect(bx, by, bw, bh, 'FD');

  // Subtle zone dividers: Zone 1 (Supply Topology) | Zone 2 (H3 Output Stage & J2 PUMP1)
  setStroke(226, 232, 240, 0.2);
  doc.line(sx(564), by, sx(564), by + bh);

  doc.setFont('courier', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    spec.id === 'lm393_schottky_doubler'
      ? 'LOCKED REV E (15 PARTS | 62 kHz LM393DR2G + CMOS + 2x SS14)'
      : spec.id === 'd25_bjt_doubler'
      ? 'CLAUDE D25 (14 PARTS | 15 kHz 2-BJT ASTABLE + 2x 1N4148W)'
      : spec.id === 'b0512s'
      ? 'B0512S-1WR3 ISOLATED 5V -> 12V DC/DC (REV A BASELINE)'
      : spec.id === 'mt3608_boost'
      ? 'MT3608 1.2 MHz REGULATED 5V -> 10V INDUCTIVE BOOST'
      : 'DIRECT PI +5V PASS-THROUGH (FORMER 1-WIRE LITE)',
    sx(282),
    sy(15),
    { align: 'center' }
  );
  doc.text('H3 STAGE & J2 PUMP1', sx(682), sy(15), { align: 'center' });

  // =========================================================================
  // ZONE 1 (0..564): Dedicated Authentic IEEE Schematic per Topology
  // =========================================================================
  if (spec.id === 'b0512s') {
    // Pi +5V input rail + C3 4.7uF decoupling
    vcc(44, 52, '+5V Pi');
    wire(44, 60, 44, 86);
    wire(44, 86, 168, 86);
    dot(96, 86);
    capV(96, 86, 146);
    gnd(96, 146);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.1);
    doc.setTextColor(30, 41, 59);
    doc.text('C3 4.7uF', sx(96), sy(175), { align: 'center' });
    wire(140, 146, 168, 146);
    gnd(140, 146);

    // U2 B0512S-1WR3 SIP-4 Module with internal transformer isolation symbol
    doc.setFillColor(248, 250, 252);
    setStroke(71, 85, 105, 0.35);
    doc.rect(sx(168), sy(56), sw(164), sh(114), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);
    doc.text('U2: B0512S-1WR3', sx(250), sy(72), { align: 'center' });
    // Internal transformer coils + dashed isolation barrier
    inductorH(184, 240, 114, [71, 85, 105]);
    setStroke(148, 163, 184, 0.25);
    for (let dy = 86; dy <= 146; dy += 8) {
      doc.line(sx(250), sy(dy), sx(250), sy(dy + 4));
    }
    inductorH(260, 316, 114, [71, 85, 105]);
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(71, 85, 105);
    doc.text('1:+Vin', sx(184), sy(90));
    doc.text('2:GND', sx(184), sy(150));
    doc.text('4:+12V', sx(318), sy(90), { align: 'right' });
    doc.text('3:0V', sx(318), sy(150), { align: 'right' });
    doc.setTextColor(180, 83, 9);
    doc.text('1.5kV iso (unused)', sx(250), sy(162), { align: 'center' });

    // Output +V_DRV rail + C4 2.2uF + Preload R2 1.2k
    wire(332, 86, 564, 86, [51, 65, 85], 0.34);
    wire(332, 146, 360, 146);
    gnd(360, 146);
    dot(414, 86);
    capV(414, 86, 146);
    gnd(414, 146);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.1);
    doc.setTextColor(30, 41, 59);
    doc.text('C4 2.2uF', sx(414), sy(175), { align: 'center' });

    dot(492, 86);
    resV(492, 86, 146);
    gnd(492, 146);
    doc.text('R2 1.2k', sx(492), sy(175), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.7);
    doc.setTextColor(100, 116, 139);
    doc.text('10mA preload', sx(492), sy(189), { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.1);
    doc.setTextColor(29, 78, 216);
    doc.text('+V_DRV (~12V)', sx(538), sy(76), { align: 'center' });

    doc.setFontSize(5.2);
    doc.setTextColor(71, 85, 105);
    doc.text('Rev A Baseline: High Margin | Wastes Isolation + EUR 2.80 Extended THT Fee', sx(282), sy(244), { align: 'center' });
  } else if (spec.id === 'd25_bjt_doubler') {
    // Authentic Cross-Coupled 2-BJT Astable (Q15 & Q16 NPN)
    vcc(112, 34, '+5V');
    wire(56, 42, 178, 42, [29, 78, 216]);
    dot(112, 42, [29, 78, 216]);
    // Collector & base resistors
    resV(56, 42, 92); // R54 1k
    resV(96, 42, 92); // R56 10k
    resV(136, 42, 92); // R57 10k
    resV(178, 42, 92); // R55 1k
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(71, 85, 105);
    doc.text('R54', sx(44), sy(68), { align: 'right' });
    doc.text('R56', sx(86), sy(68), { align: 'right' });
    doc.text('R57', sx(146), sy(68));
    doc.text('R55', sx(188), sy(68));

    // Cross-coupling caps C20 & C21 (4.7nF)
    capH(56, 136, 102, [180, 83, 9]);
    capH(96, 178, 120, [180, 83, 9]);
    dot(56, 102);
    dot(178, 120);
    dot(96, 120);
    dot(136, 102);
    wire(56, 92, 56, 146);
    wire(178, 92, 178, 146);
    wire(96, 92, 96, 164);
    wire(96, 164, 34, 164); // to Q15 base
    wire(136, 92, 136, 164);
    wire(136, 164, 155, 164); // to Q16 base

    // Q15 & Q16 real NPN BJT symbols
    bjtVert(50, 164, 'npn', false, [146, 64, 14]);
    bjtVert(172, 164, 'npn', false, [146, 64, 14]);
    gnd(56, 182);
    gnd(178, 182);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(146, 64, 14);
    doc.text('Q15', sx(26), sy(156));
    doc.text('Q16', sx(190), sy(156));
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.6);
    doc.text('15kHz Astable (V_EBO -4.5V)', sx(114), sy(214), { align: 'center' });

    // Drive wire from Q16 collector -> Q17/Q18 complementary follower bases
    dot(178, 136);
    wire(178, 136, 256, 136);
    wire(256, 104, 256, 168);
    dot(256, 136);
    wire(256, 104, 268, 104);
    wire(256, 168, 268, 168);

    // Q17 (NPN top) + Q18 (PNP bottom, emitter on top!)
    bjtVert(285, 104, 'npn', false);
    bjtVert(285, 168, 'pnp', true);
    vcc(291, 68, '+5V');
    wire(291, 76, 291, 86);
    wire(291, 122, 291, 150); // Emitters tied!
    gnd(291, 186);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(15, 23, 42);
    doc.text('Q17', sx(304), sy(100));
    doc.text('Q18', sx(304), sy(172));

    // C22 2.2uF + D21/D22 1N4148W Silicon Diodes + C23 10uF
    dot(291, 136);
    capH(291, 392, 136);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.text('C22 2.2uF', sx(342), sy(157), { align: 'center' });
    wire(392, 136, 434, 136);
    wire(434, 136, 434, 86);
    dot(434, 86);

    vcc(366, 62, '+5V');
    wire(366, 70, 366, 86);
    diodeH(366, 434, 86, false, [180, 83, 9], [254, 243, 199]); // D21 1N4148W
    diodeH(434, 512, 86, false, [180, 83, 9], [254, 243, 199]); // D22 1N4148W
    wire(512, 86, 564, 86);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(180, 83, 9);
    doc.text('D21 1N4148W', sx(400), sy(70), { align: 'center' });
    doc.text('D22 1N4148W', sx(476), sy(70), { align: 'center' });

    dot(522, 86);
    capV(522, 86, 152);
    gnd(522, 152);
    doc.setTextColor(30, 41, 59);
    doc.text('C23 10uF', sx(522), sy(180), { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(180, 83, 9);
    doc.text('Claude D25 (Rev C): 2x 0.75V Si drop + R_out ~108 Ohm -> FAILS 2x Stress UV (3.98 V)', sx(282), sy(244), { align: 'center' });
  } else if (spec.id === 'lm393_schottky_doubler') {
    // Authentic U3A LM393 Schmitt Relaxation Oscillator (60 kHz, 14 Basic Parts)
    // Voltage divider R54 100k / R55 47k feeding U3A (+) input
    vcc(46, 36, '+5V');
    resV(46, 44, 96); // R54 100k
    dot(46, 96);
    resV(46, 96, 150); // R55 47k
    gnd(46, 150);
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(51, 65, 85);
    doc.text('R54 100k', sx(38), sy(72), { align: 'right' });
    doc.text('R55 47k', sx(38), sy(124), { align: 'right' });

    // Comparator Triangle U3A
    wire(46, 96, 118, 96); // (+) input
    wire(86, 126, 118, 126); // (-) input
    doc.setFillColor(236, 253, 245);
    setStroke(5, 150, 105, 0.36);
    doc.triangle(sx(118), sy(76), sx(118), sy(146), sx(184), sy(111), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(6, 95, 70);
    doc.text('+', sx(126), sy(100));
    doc.text('-', sx(126), sy(130));
    doc.text('U3A', sx(149), sy(115), { align: 'center' });

    // Hysteresis R56 100k from Output back to (+)
    dot(78, 96);
    wire(78, 96, 78, 56);
    resH(78, 206, 56, [5, 150, 105]);
    wire(206, 56, 206, 111);
    dot(206, 111, [5, 150, 105]);
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.7);
    doc.setTextColor(6, 95, 70);
    doc.text('R56 100k (hyst)', sx(142), sy(46), { align: 'center' });

    // Pull-up R59 1.5k (<=3.5mA datasheet-safe LM393 sink)
    vcc(226, 36, '+5V');
    resV(226, 44, 111, [5, 150, 105]);
    dot(226, 111, [5, 150, 105]);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.7);
    doc.text('R59 1.5k', sx(236), sy(76));
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.3);
    doc.text('(<=3.5mA)', sx(236), sy(88));

    // RC Timing R58 15k (=R31) + C20 1nF C0G on (-) input
    wire(206, 111, 206, 166);
    resH(86, 206, 166, [5, 150, 105]);
    wire(86, 126, 86, 166);
    dot(86, 166);
    capV(86, 166, 204);
    gnd(86, 204);
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.7);
    doc.setTextColor(51, 65, 85);
    doc.text('R58 15k (=R31)', sx(146), sy(182), { align: 'center' });
    doc.text('C20 1nF', sx(74), sy(190), { align: 'right' });

    // Unused U3B Tie-Off schematic callout
    doc.setFillColor(248, 250, 252);
    setStroke(148, 163, 184, 0.24);
    doc.rect(sx(128), sy(194), sw(126), sh(24), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(71, 85, 105);
    doc.text('U3B Tied: P5=+5V P6=GND P7=NC', sx(191), sy(209), { align: 'center' });

    // Direct drive from U3A Pin 1 -> Q17 (AO3401A P-MOS) / Q18 (AO3400A N-MOS) CMOS + R60 47R
    wire(184, 111, 272, 111, [5, 150, 105], 0.34);
    dot(272, 111);
    wire(272, 108, 272, 170);
    wire(272, 108, 284, 108);
    wire(272, 170, 284, 170);

    bjtVert(301, 108, 'pnp', true);
    bjtVert(301, 170, 'npn', false);
    vcc(307, 40, '+5V');
    resV(307, 48, 90, [5, 150, 105]);
    wire(307, 126, 307, 152);
    gnd(307, 188);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(6, 95, 70);
    doc.text('R60 47R', sx(318), sy(70));
    doc.setFontSize(4.7);
    doc.setTextColor(15, 23, 42);
    doc.text('Q17 3401A', sx(318), sy(105));
    doc.text('Q18 3400A', sx(318), sy(174));

    // C22 4.7uF + 2x SS14 S-hook Schottky Diodes + C23 10uF
    dot(307, 136);
    capH(307, 396, 136, [5, 150, 105]);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.text('C22 4.7uF', sx(352), sy(157), { align: 'center' });
    wire(396, 136, 438, 136, [5, 150, 105]);
    wire(438, 136, 438, 86, [5, 150, 105]);
    dot(438, 86, [5, 150, 105]);

    vcc(370, 62, '+5V');
    wire(370, 70, 370, 86);
    diodeH(370, 438, 86, true, [5, 150, 105], [236, 253, 245]); // D21 SS14 Schottky
    diodeH(438, 514, 86, true, [5, 150, 105], [236, 253, 245]); // D22 SS14 Schottky
    wire(514, 86, 564, 86, [5, 150, 105], 0.34);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(6, 95, 70);
    doc.text('D21 SS14', sx(404), sy(70), { align: 'center' });
    doc.text('D22 SS14', sx(476), sy(70), { align: 'center' });

    dot(526, 86);
    capV(526, 86, 152);
    gnd(526, 152);
    doc.setTextColor(30, 41, 59);
    doc.text('C23 10uF', sx(526), sy(180), { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(6, 95, 70);
    doc.text('Locked Rev E (TI LM393 ngspice-39): 15 Parts | AO3401A/3400A + R60 47R | +9.21 V Nom / +7.98 V UVLO (D18)', sx(282), sy(244), { align: 'center' });
  } else if (spec.id === 'mt3608_boost') {
    // Pi +5V -> C_in 10uF -> L1 22uH real 4-arch inductor -> SW -> D21 SS14 -> FB divider -> C_out
    vcc(46, 52, '+5V Pi');
    wire(46, 60, 46, 86);
    wire(46, 86, 134, 86);
    dot(90, 86);
    capV(90, 86, 152);
    gnd(90, 152);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(30, 41, 59);
    doc.text('Cin 10uF', sx(90), sy(180), { align: 'center' });

    // Real 4-arch shielded inductor L1 22uH
    inductorH(134, 240, 86, [30, 64, 175]);
    doc.setTextColor(30, 64, 175);
    doc.text('L1 22uH (Ext)', sx(187), sy(64), { align: 'center' });

    // SW node -> MT3608 IC with internal NMOS glyph
    wire(240, 86, 308, 86);
    dot(274, 86);
    wire(274, 86, 274, 124);
    doc.setFillColor(248, 250, 252);
    setStroke(71, 85, 105, 0.34);
    doc.rect(sx(226), sy(124), sw(122), sh(70), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(15, 23, 42);
    doc.text('U2: MT3608 (Ext)', sx(287), sy(144), { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(71, 85, 105);
    doc.text('SW(1)   1.2 MHz', sx(287), sy(162), { align: 'center' });
    doc.text('2A Boost  FB(3)', sx(287), sy(180), { align: 'center' });
    gnd(274, 194);

    // Real SS14 S-hook Schottky diode D21
    diodeH(308, 404, 86, true, [5, 150, 105], [236, 253, 245]);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(6, 95, 70);
    doc.text('D21 SS14', sx(356), sy(68), { align: 'center' });
    wire(404, 86, 564, 86, [30, 64, 175], 0.34);

    // Feedback divider 100k / 6.34k
    dot(448, 86);
    resV(448, 86, 146);
    dot(448, 146);
    resV(448, 146, 196);
    gnd(448, 196);
    wire(448, 146, 348, 146);
    wire(348, 146, 348, 174);
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(51, 65, 85);
    doc.text('100k', sx(460), sy(118));
    doc.text('6.34k', sx(460), sy(174));

    // Output cap 10uF 25V
    dot(518, 86);
    capV(518, 86, 152);
    gnd(518, 152);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.9);
    doc.setTextColor(30, 41, 59);
    doc.text('Cout 10uF', sx(518), sy(180), { align: 'center' });

    doc.setFontSize(5.2);
    doc.setTextColor(30, 64, 175);
    doc.text('MT3608 Boost: Flat Regulated 10.0 V | 2x Extended Fees (+EUR 5.60) + 1.2 MHz EMI', sx(282), sy(244), { align: 'center' });
  } else {
    // direct_5v: Pi +5V -> R26 0 Ohm jumper -> +V_DRV
    vcc(76, 52, '+5V Pi');
    wire(76, 60, 76, 86);
    wire(76, 86, 224, 86, [190, 18, 60], 0.34);
    resH(224, 338, 86, [190, 18, 60]);
    wire(338, 86, 564, 86, [190, 18, 60], 0.34);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(159, 18, 57);
    doc.text('R26: 0 Ohm Link (No Boost)', sx(281), sy(68), { align: 'center' });
    gnd(76, 146);
    wire(76, 146, 520, 146, [148, 163, 184], 0.22);
    gnd(520, 146);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(159, 18, 57);
    doc.text('Zero Voltage Lift - Drops to 4.09 V (1x Stress UV) / <4.0 V on Sag', sx(282), sy(124), { align: 'center' });
    doc.setFont('courier', 'bold');
    doc.text('Former 1-Wire Lite: EUR 0.01 | Unsafe Margin vs Wilo / Grundfos 4.00 V Floor', sx(282), sy(244), { align: 'center' });
  }

  // =========================================================================
  // ZONE 2 (564..800): Shared Authentic H3 Driver Stage (Q6 PNP, R9, TVS, R31/R32, J2)
  // =========================================================================
  // +V_DRV enters at (564, 86) -> Q6 high-side PNP emitter at (596, 86)
  wire(564, 86, 594, 86, [51, 65, 85], 0.34);
  bjtHighSidePnp(612, 91);
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Q6 PNP', sx(612), sy(68), { align: 'center' });
  // Base drive label PWM1
  resV(612, 110, 148, [100, 116, 139]);
  doc.setFont('courier', 'normal');
  doc.setFontSize(4.6);
  doc.setTextColor(71, 85, 105);
  doc.text('PWM1 (Q5)', sx(612), sy(160), { align: 'center' });

  // R9 Series Protection Resistor (zig-zag)
  wire(630, 86, 646, 86);
  resH(646, 704, 86);
  doc.setFont('courier', 'bold');
  doc.setFontSize(4.9);
  doc.setTextColor(15, 23, 42);
  doc.text(`R9 ${spec.r9Spec.split(' ')[0]}`, sx(675), sy(72), { align: 'center' });

  // Output rail to J2 PUMP1 Terminal
  wire(704, 86, 766, 86, [29, 78, 216], 0.34);
  doc.setFillColor(255, 255, 255);
  setStroke(29, 78, 216, 0.38);
  doc.circle(sx(772), sy(86), sw(5.5), 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.3);
  doc.setTextColor(29, 78, 216);
  doc.text('J2 PUMP1', sx(764), sy(68), { align: 'center' });

  // TVS Diode SMBJ13A / SMBJ6.0A to GND
  dot(748, 86, [29, 78, 216]);
  tvsV(748, 86, 152);
  gnd(748, 152);
  doc.setFont('courier', 'normal');
  doc.setFontSize(4.6);
  doc.setTextColor(30, 64, 175);
  doc.text(spec.id === 'direct_5v' ? 'SMBJ6.0A' : 'SMBJ13A', sx(772), sy(124), { align: 'center' });

  // R31 / R32 Readback Divider -> GPIO 6
  dot(716, 86);
  resV(716, 86, 148);
  dot(716, 148);
  resV(716, 148, 200);
  gnd(716, 200);
  wire(716, 148, 668, 148, [29, 78, 216], 0.3);
  doc.setFillColor(239, 246, 255);
  setStroke(147, 197, 253, 0.25);
  doc.rect(sx(586), sy(182), sw(94), sh(34), 'FD');
  wire(668, 148, 668, 182, [29, 78, 216], 0.25);
  doc.setFont('courier', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(30, 64, 175);
  doc.text('GPIO 6 Readback', sx(633), sy(196), { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pdfSafe(spec.r31r32Spec.split(' (')[0]), sx(633), sy(209), { align: 'center' });
  doc.text('R31', sx(706), sy(118), { align: 'right' });
  doc.text('R32', sx(706), sy(176), { align: 'right' });
}

export function buildPumpSupplyPdfDoc(
  selectedTopology: PumpTopologyId,
  params: PumpSimParams,
  batchSize: 2 | 5
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 14;

  const activeSpec = PUMP_TOPOLOGY_SPECS[selectedTopology];
  const activeRes = evaluatePumpSupply(selectedTopology, params);
  const baselineCost = pumpPerBoardCostEur(PUMP_TOPOLOGY_SPECS.b0512s, batchSize);
  const dateStr = new Date().toISOString().slice(0, 10);

  const addHeaderFooter = (pageNum: number, totalPages: number, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CoSTOS 1-Wire HAT | 03. Pump PWM Driver Supply Evaluation Report', margin, 8.3);
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
      pdfSafe(`Rev E (Gemini Version) | 60 kHz U3A LM393 + SS14 Schottky Doubler | Generated ${dateStr}`),
      margin,
      pageH - 6.8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 6.8, { align: 'right' });
  };

  const evalRows = PUMP_TOPOLOGY_ORDER.map((id) => {
    const spec = PUMP_TOPOLOGY_SPECS[id];
    const live = evaluatePumpSupply(id, params);
    const norm1 = evaluatePumpSupply(id, { ...params, piSupplyV: 5.0, pumpCount: 1, loadProfile: 'normal', activeFault: 'none' });
    const uv1 = evaluatePumpSupply(id, { ...params, piSupplyV: 4.63, pumpCount: 1, loadProfile: 'stress', activeFault: 'none' });
    const uv2 = evaluatePumpSupply(id, { ...params, piSupplyV: 4.63, pumpCount: 2, loadProfile: 'stress', activeFault: 'none' });
    const deadOsc = evaluatePumpSupply(id, { ...params, piSupplyV: 5.0, pumpCount: 1, loadProfile: 'normal', activeFault: 'osc_dead' });
    const unitCost = pumpPerBoardCostEur(spec, batchSize);
    const savings = baselineCost - unitCost;
    return { spec, live, norm1, uv1, uv2, deadOsc, unitCost, savings };
  });

  // =========================================================================
  // PAGE 1: Executive Overview, Bench Parameters, Matrix, Sweep Chart & Active BOM
  // =========================================================================
  addHeaderFooter(1, 9, 'Executive Summary & Pi 5 V Undervoltage Sweep');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Pump PWM Driver Supply Evaluation (B0512S / D25 -> Rev E Gemini)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(`Active Circuit: ${activeSpec.shortName} | Batch Size: ${batchSize}x JLCPCB | Pi 5V: ${params.piSupplyV.toFixed(2)} V | Load: ${params.pumpCount}x ${params.loadProfile.toUpperCase()}`),
    margin,
    26.8
  );
  y = 33.5;

  // Section 1: Configured Bench Parameters
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. Configured Bench Parameters', margin, y);
  y += 2.8;

  const paramRows: [string, string, string, string][] = [
    ['Selected Topology', pdfSafe(activeSpec.shortName), 'Pi 5 V Supply Rail', `${params.piSupplyV.toFixed(2)} V (UV: 4.63 V)`],
    ['Active Pump Channels', `${params.pumpCount}x (${params.pumpCount === 1 ? 'PUMP1 Only' : 'PUMP1 + PUMP2'})`, 'Opto Load Profile', params.loadProfile === 'stress' ? 'Stress (470 Ohm / ~10 mA)' : 'Normal (2.2 kOhm / ~2.5 mA)'],
    ['PWM Duty Cycle', `${params.pwmDutyPct}%`, 'Board Ambient Temp', `${params.ambientTempC} °C`],
    ['Wilo / Grundfos Floor', '4.00 V Min PWM High', 'Injected Fault Mode', params.activeFault === 'none' ? 'Nominal (No Fault)' : params.activeFault.toUpperCase()],
    ['H3 Series / Readback', pdfSafe(activeSpec.r9Spec), 'R31 / R32 Scaling', pdfSafe(activeSpec.r31r32Spec.split(' (')[0])],
  ];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentW, paramRows.length * 5.6 + 2.8, 'FD');
  let py = y + 4.7;
  doc.setFontSize(7.9);
  for (const [k1, v1, k2, v2] of paramRows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k1 + ':', margin + 3, py);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v1, margin + 40, py);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k2 + ':', margin + 95, py);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v2, margin + 131, py);
    py += 5.6;
  }
  y += paramRows.length * 5.6 + 7.5;

  // Section 2: Summary Comparison Table (All 5 Topologies)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. All Topologies Compared (${batchSize}x JLCPCB Batch | HAT-development.md Sec. 9 Model)`, margin, y);
  y += 2.8;

  const colW = [42, 15, 16, 17, 17, 19, 24, 32];
  const headers = ['Topology', 'Parts', 'Fee', 'Cost/Bd', 'Saved', '1x Norm', '2x UV Stress', 'GPIO 6 / Status'];

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  let cx = margin;
  headers.forEach((h, i) => {
    doc.text(h, cx + 1.8, y + 4.5);
    cx += colW[i];
  });
  y += 6.8;

  doc.setFontSize(7.2);
  for (const { spec, live, norm1, uv2, unitCost, savings } of evalRows) {
    const isSel = spec.id === selectedTopology;
    const isRec = spec.id === 'lm393_schottky_doubler';
    doc.setFillColor(isRec ? 236 : isSel ? 239 : 255, isRec ? 253 : isSel ? 246 : 255, isRec ? 245 : isSel ? 255 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.9, 'FD');

    const uvPass = uv2.vPumpTerminalV >= 4.0;
    const rowVals = [
      pdfSafe(spec.shortName),
      `EUR ${spec.partCostEur.toFixed(2)}`,
      `EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)}`,
      `EUR ${unitCost.toFixed(2)}`,
      savings > 0 ? `-EUR ${savings.toFixed(2)}` : savings < 0 ? `+EUR ${Math.abs(savings).toFixed(2)}` : '-',
      `${norm1.vPumpTerminalV.toFixed(2)} V`,
      `${uv2.vPumpTerminalV.toFixed(2)} V (${uvPass ? 'PASS' : 'FAIL'})`,
      `${live.readbackGpio6V.toFixed(2)}V | ${live.safetyStatus}`,
    ];

    cx = margin;
    rowVals.forEach((val, idx) => {
      doc.setFont(idx === 0 ? 'helvetica' : 'courier', idx === 0 || idx === 3 || idx === 6 ? 'bold' : 'normal');
      if (idx === 4 && savings > 0) doc.setTextColor(4, 120, 87);
      else if (idx === 4 && savings < 0) doc.setTextColor(190, 18, 60);
      else if (idx === 6) doc.setTextColor(uvPass ? 4 : 190, uvPass ? 120 : 18, uvPass ? 87 : 60);
      else doc.setTextColor(15, 23, 42);
      doc.text(val, cx + 1.8, y + 4.7);
      cx += colW[idx];
    });
    y += 6.9;
  }
  y += 7;

  // Section 3: Vector Voltage Sweep Chart (Pi 5V Rail 4.20 V -> 5.25 V)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pdfSafe(`3. Pump Terminal Voltage Sweep vs. Pi 5 V Rail (${params.pumpCount}x ${params.loadProfile.toUpperCase()} Load)`),
    margin,
    y
  );
  y += 3.2;

  const sweep = computePumpVoltageSweep(params);
  const chartX = margin + 12;
  const chartY = y + 1.5;
  const chartW = contentW - 16;
  const chartH = 44;
  const vMin = 3.0;
  const vMax = 12.0;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const xPos = (piV: number) => chartX + ((piV - 4.2) / (5.25 - 4.2)) * chartW;
  const yPos = (v: number) => {
    const clamped = Math.max(vMin, Math.min(vMax, v));
    return chartY + ((vMax - clamped) / (vMax - vMin)) * chartH;
  };

  const y4v = yPos(4.0);
  doc.setFillColor(254, 242, 242);
  doc.rect(chartX, y4v, chartW, chartY + chartH - y4v, 'F');
  doc.setDrawColor(225, 29, 72);
  doc.setLineWidth(0.35);
  doc.line(chartX, y4v, chartX + chartW, y4v);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  for (const vt of [3, 4, 6, 8, 10, 12]) {
    const ty = yPos(vt);
    if (vt !== 4) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(chartX, ty, chartX + chartW, ty);
    }
    doc.setTextColor(vt === 4 ? 190 : 100, vt === 4 ? 18 : 116, vt === 4 ? 60 : 139);
    doc.text(`${vt.toFixed(0)}V`, margin + 1, ty + 1.6);
  }

  for (const xt of [4.2, 4.4, 4.63, 4.8, 5.0, 5.25]) {
    const tx = xPos(xt);
    doc.setDrawColor(xt === 4.63 ? 217 : 241, xt === 4.63 ? 119 : 245, xt === 4.63 ? 6 : 249);
    doc.setLineWidth(xt === 4.63 ? 0.32 : 0.2);
    doc.line(tx, chartY, tx, chartY + chartH);
    doc.setTextColor(xt === 4.63 ? 180 : 100, xt === 4.63 ? 83 : 116, xt === 4.63 ? 9 : 139);
    doc.text(xt === 4.63 ? '4.63 UV' : `${xt.toFixed(1)}V`, tx - (xt === 4.63 ? 6.5 : 3.2), chartY + chartH + 3.8);
  }

  const series: { key: keyof typeof sweep[number]; rgb: [number, number, number]; width: number; label: string }[] = [
    { key: 'b0512sV', rgb: [100, 116, 139], width: 0.4, label: 'B0512S' },
    { key: 'mt3608V', rgb: [37, 99, 235], width: 0.4, label: 'MT3608' },
    { key: 'revDV', rgb: [5, 150, 105], width: 0.75, label: 'Gemini Rev E' },
    { key: 'd25V', rgb: [217, 119, 6], width: 0.5, label: 'Claude D25' },
    { key: 'direct5vV', rgb: [225, 29, 72], width: 0.4, label: 'Direct 5V' },
  ];

  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(s.width);
    for (let i = 1; i < sweep.length; i++) {
      doc.line(
        xPos(sweep[i - 1].piV),
        yPos(Number(sweep[i - 1][s.key])),
        xPos(sweep[i].piV),
        yPos(Number(sweep[i][s.key]))
      );
    }
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.32);
  doc.line(xPos(params.piSupplyV), chartY, xPos(params.piSupplyV), chartY + chartH);

  let legX = chartX;
  const legY = chartY + chartH + 7.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  for (const s of series) {
    doc.setDrawColor(...s.rgb);
    doc.setLineWidth(0.8);
    doc.line(legX, legY - 1, legX + 4.5, legY - 1);
    doc.setTextColor(...s.rgb);
    doc.text(s.label, legX + 6, legY);
    legX += 30.5;
  }

  y = legY + 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Live Operating Point (${activeSpec.shortName} @ ${activeRes.effectivePiV.toFixed(2)} V): +V_DRV = ${activeRes.vDrvLoadedV.toFixed(2)} V | V_pump = ${activeRes.vPumpTerminalV.toFixed(2)} V (Margin ${activeRes.marginAbove4V >= 0 ? '+' : ''}${activeRes.marginAbove4V.toFixed(2)} V) | Ripple ${activeRes.rippleMvPp.toFixed(0)} mVpp | GPIO 6 = ${activeRes.readbackGpio6V.toFixed(2)} V.`
    ),
    margin,
    y
  );
  y += 7;

  // Section 4: Active Topology BOM Summary on Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(`4. Active Topology BOM: ${activeSpec.shortName}`), margin, y);
  y += 3.0;

  const bomCol = [26, 78, 28, 26, 24];
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

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'See Pages 2-6 for dedicated option schematics, BOMs & fail-safe profiles; Page 7 for Scorecard; Page 8 for KiCad BOM; Page 9 for Audit History.',
    margin,
    y + 5.5
  );

  // =========================================================================
  // PAGES 2-6: ONE DEDICATED PUMP SUPPLY OPTION PER PAGE — FIXED EXACT Y COORDINATES!
  // =========================================================================
  const Y_VERDICT = 32.5;
  const Y_CIRCUIT_TITLE = 43.5;
  const Y_CIRCUIT_BOX = 46;
  const CIRCUIT_H = 58;
  const Y_BOM_TITLE = 109.5;
  const Y_BOM_TABLE = 112;
  const Y_CORNER_TITLE = 144.5;
  const Y_CORNER_BOX = 147;
  const CORNER_BOX_H = 26;
  const Y_PROCON_TITLE = 178.5;
  const Y_PROCON_BODY = 182.5;
  const Y_SEC_TITLE = 247.5;
  const Y_SEC_BOX = 250;
  const SEC_BOX_H = 33;

  evalRows.forEach(({ spec, norm1, uv1, uv2, deadOsc, unitCost, savings }, idx) => {
    doc.addPage();
    addHeaderFooter(idx + 2, 9, `Option ${idx + 1} of 5 | ${spec.shortName}`);

    const c2 = pumpPerBoardCostEur(spec, 2);
    const c5 = pumpPerBoardCostEur(spec, 5);
    const uv2Pass = uv2.vPumpTerminalV >= 4.0;

    // 1. Page Title & Cost Summary directly under full-bleed dark top bar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.4);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(`Option 0${idx + 1}: ${spec.name}`), margin, 21.0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      pdfSafe(
        `Cost (${batchSize}x): EUR ${unitCost.toFixed(2)}/bd (2x EUR ${c2.toFixed(2)} | 5x EUR ${c5.toFixed(2)})  |  ${savings > 0 ? `Saves EUR ${savings.toFixed(2)}/bd` : savings < 0 ? `+EUR ${Math.abs(savings).toFixed(2)}/bd` : 'Baseline'}  |  2x UV: ${uv2.vPumpTerminalV.toFixed(2)} V (${uv2Pass ? 'PASS' : 'FAIL'})`
      ),
      margin,
      26.4
    );

    // 2. Verdict
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.9);
    doc.setTextColor(51, 65, 85);
    const verdictLines = doc.splitTextToSize(pdfSafe(spec.verdict), contentW).slice(0, 2);
    doc.text(verdictLines, margin, Y_VERDICT);

    // 3. Dedicated Authentic Vector Schematic
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Circuit Schematic & H3 / J2 PUMP1 Interface', margin, Y_CIRCUIT_TITLE);
    drawPdfPumpSchematic(doc, spec, margin, Y_CIRCUIT_BOX, contentW, CIRCUIT_H);

    // 4. Topology Bill of Materials
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text(
      pdfSafe(`2. Bill of Materials (${spec.partCount} Parts | Parts: EUR ${spec.partCostEur.toFixed(2)} | Feeder Fee: EUR ${spec.jlcpcbFeederFeeEur.toFixed(2)})`),
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
      doc.setDrawColor(226, 232, 240);
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

    // 5. Corner Operating Points, H3 Scaling & Software Impact
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Multi-Corner Bench Performance, H3 Interface & Pi Firmware Impact', margin, Y_CORNER_TITLE);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, Y_CORNER_BOX, contentW, CORNER_BOX_H, 'FD');

    const line1 = pdfSafe(
      `1x Norm (5.00 V): V_pump = ${norm1.vPumpTerminalV.toFixed(2)} V (${norm1.rippleMvPp.toFixed(0)} mVpp, Pi ${norm1.pi5vCurrentMa.toFixed(0)} mA, GPIO6 ${norm1.readbackGpio6V.toFixed(2)} V)  |  1x Stress UV (4.63 V): ${uv1.vPumpTerminalV.toFixed(2)} V`
    );
    const line2 = pdfSafe(
      `2x Stress UV (4.63 V): V_pump = ${uv2.vPumpTerminalV.toFixed(2)} V (${uv2Pass ? 'PASS >= 4.00 V' : 'FAIL < 4.00 V'})  |  Osc Dead Fault: ${spec.id === 'direct_5v' ? 'N/A (passive)' : `V_pump ${deadOsc.vPumpTerminalV.toFixed(2)} V / GPIO6 ${deadOsc.readbackGpio6V.toFixed(2)} V`}`
    );
    const line3 = pdfSafe(
      `H3 Interface: R9 = ${spec.r9Spec}  |  Readback: ${spec.r31r32Spec}  |  Assembly: ${spec.handSolderability}`
    );
    const line4 = pdfSafe(
      `Pi Software / GPIO Impact: 0 GPIOs consumed, 0 LOC Rust changes in costos-hw-linux (autonomous hardware supply; reuses existing GPIO 6 readback).`
    );

    let cy = Y_CORNER_BOX + 4.4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(line1, contentW - 6).slice(0, 1), margin + 3, cy);
    cy += 5.2;

    doc.setTextColor(uv2Pass ? 4 : 190, uv2Pass ? 120 : 18, uv2Pass ? 87 : 60);
    doc.text(doc.splitTextToSize(line2, contentW - 6).slice(0, 1), margin + 3, cy);
    cy += 5.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(line3, contentW - 6).slice(0, 1), margin + 3, cy);
    cy += 5.0;

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(30, 64, 175);
    doc.text(doc.splitTextToSize(line4, contentW - 6).slice(0, 2), margin + 3, cy);

    // 6. Hardware & Integration Pros / Cons
    const colHalf = (contentW - 6) / 2;
    const rightColX = margin + colHalf + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(4, 120, 87);
    doc.text('4. Hardware & Integration Advantages', margin, Y_PROCON_TITLE);
    doc.setTextColor(190, 18, 60);
    doc.text('Disadvantages & Engineering Risks', rightColX, Y_PROCON_TITLE);

    let leftY = Y_PROCON_BODY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(30, 41, 59);
    for (const item of spec.advantages) {
      const lines = doc.splitTextToSize(pdfSafe(`+ ${item}`), colHalf - 2);
      if (leftY + lines.length * 3.15 <= 244) {
        doc.text(lines, margin + 1, leftY);
        leftY += lines.length * 3.15 + 1.0;
      }
    }

    let rightY = Y_PROCON_BODY;
    for (const item of spec.tradeoffs) {
      const lines = doc.splitTextToSize(pdfSafe(`- ${item}`), colHalf - 2);
      if (rightY + lines.length * 3.15 <= 244) {
        doc.text(lines, rightColX + 1, rightY);
        rightY += lines.length * 3.15 + 1.0;
      }
    }

    // 7. Fail-Safe, Protection & Readback Safety Profile
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(30, 64, 175);
    doc.text('5. Fail-Safe, Short-Circuit & Readback Safety Profile', margin, Y_SEC_TITLE);

    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.rect(margin, Y_SEC_BOX, contentW, SEC_BOX_H, 'FD');

    const fsOsc = doc.splitTextToSize(pdfSafe(`Oscillator / Startup Risk: ${spec.startupRisk}. ${spec.failSafeNotes.oscillatorFailure}`), contentW - 6);
    const fsShort = doc.splitTextToSize(pdfSafe(`Dead-Short Survival (PUMP1): ${spec.failSafeNotes.shortCircuitBehavior}`), contentW - 6);
    const fsRead = doc.splitTextToSize(pdfSafe(`GPIO 6 Readback Safety: ${spec.failSafeNotes.readbackSafety}`), contentW - 6);

    let secY = Y_SEC_BOX + 4.3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    for (const blk of [fsOsc, fsShort, fsRead]) {
      doc.text(blk.slice(0, 3), margin + 3, secY);
      secY += Math.min(3, blk.length) * 3.1 + 1.1;
    }
  });

  // =========================================================================
  // PAGE 7: FINAL ENGINEERING CONCLUSION SCORECARD (B0512S vs D25 vs Gemini Rev E)
  // =========================================================================
  doc.addPage();
  addHeaderFooter(7, 9, '3-Way Engineering Verdict & Undervoltage Scorecard');
  const summary = buildPumpConclusion(params, batchSize);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Engineering Conclusion: B0512S vs. Claude D25 vs. Gemini (Rev E)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      `Batch: ${batchSize}x JLCPCB  |  Saves EUR ${summary.savingsVsB05PerBd.toFixed(2)}/bd (EUR ${summary.savingsVsB05Batch.toFixed(2)}/batch vs B0512S)  |  Score vs D25: ${summary.betterCount} BETTER, ${summary.equalCount} EQUAL, ${summary.worseCount} WORSE`
    ),
    margin,
    26.8
  );

  let cy7 = 34;
  const kpi3W = (contentW - 8) / 3;
  const kpiCards: { label: string; count: number; sub: string; fill: [number, number, number]; border: [number, number, number]; text: [number, number, number] }[] = [
    { label: 'BETTER (Gemini Rev E)', count: summary.betterCount, sub: 'vs Claude D25 Proposal', fill: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
    { label: 'EQUAL / PARITY', count: summary.equalCount, sub: 'Same 14 parts, EUR 0 fee', fill: [248, 250, 252], border: [203, 213, 225], text: [51, 65, 85] },
    { label: 'WORSE / REGRESSIONS', count: summary.worseCount, sub: 'Zero trade-off penalties', fill: [255, 241, 242], border: [254, 205, 211], text: [190, 18, 60] },
  ];
  kpiCards.forEach((k, idx) => {
    const kx = margin + idx * (kpi3W + 4);
    doc.setFillColor(...k.fill);
    doc.setDrawColor(...k.border);
    doc.rect(kx, cy7, kpi3W, 17, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...k.text);
    doc.text(k.label, kx + 3, cy7 + 5.2);
    doc.setFont('courier', 'bold');
    doc.setFontSize(13.5);
    doc.text(String(k.count), kx + 3, cy7 + 12.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(71, 85, 105);
    doc.text(k.sub, kx + 14, cy7 + 12.2);
  });
  cy7 += 22;

  const cCols = [33, 31, 31, 35, 15, 37];
  const cHeaders = ['Aspect', 'B0512S (Rev A)', 'Claude D25', 'Gemini (Rev E)', 'vs D25', 'Engineering Rationale'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, cy7, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  cx = margin + 1.5;
  cHeaders.forEach((h, i) => {
    doc.text(h, cx, cy7 + 4.6);
    cx += cCols[i];
  });
  cy7 += 6.8;

  summary.rows.forEach((row) => {
    const ratLines = doc.splitTextToSize(pdfSafe(row.rationale), cCols[5] - 2);
    const rowH = Math.max(13.2, Math.min(4, ratLines.length) * 3.1 + 4.0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cy7, contentW, rowH, 'FD');

    cx = margin + 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(row.aspect), cCols[0] - 2).slice(0, 2), cx, cy7 + 4.3);
    cx += cCols[0];

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(pdfSafe(row.b0512sValue), cCols[1] - 2).slice(0, 2), cx, cy7 + 4.3);
    cx += cCols[1];

    doc.text(doc.splitTextToSize(pdfSafe(row.d25Value), cCols[2] - 2).slice(0, 2), cx, cy7 + 4.3);
    cx += cCols[2];

    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(row.revDValue), cCols[3] - 2).slice(0, 2), cx, cy7 + 4.3);
    cx += cCols[3];

    if (row.verdictVsD25 === 'BETTER') doc.setTextColor(4, 120, 87);
    else if (row.verdictVsD25 === 'WORSE') doc.setTextColor(190, 18, 60);
    else doc.setTextColor(71, 85, 105);
    doc.text(row.verdictVsD25, cx, cy7 + 5.2);
    cx += cCols[4];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(51, 65, 85);
    doc.text(ratLines.slice(0, 4), cx, cy7 + 3.9);

    cy7 += rowH;
  });

  cy7 += 4.5;
  const takeawayLines = doc.splitTextToSize(pdfSafe(`Bottom Line Recommendation: ${summary.takeaway}`), contentW - 8);
  const tbH = takeawayLines.length * 3.8 + 7;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.rect(margin, cy7, contentW, tbH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(6, 78, 59);
  doc.text(takeawayLines, margin + 4, cy7 + 5.5);

  // =========================================================================
  // PAGE 8: KICAD READY BOM & NET MAP (Pump Supply Rev E - Gemini Version)
  // =========================================================================
  doc.addPage();
  addHeaderFooter(8, 9, 'KiCad Production BOM & U3 / H3 Pinout');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('KiCad Manufacturing Package: Pump PWM Supply Rev E (Gemini Version)', margin, 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  const totalQty = PUMP_REV_D_BOM.reduce((s, r) => s + r.qty, 0);
  doc.text(
    pdfSafe(`14 Total Parts (${PUMP_REV_D_BOM.length} Unique Lines)  |  100% JLCPCB Basic (EUR 0.00 Fee)  |  EUR 0.18/board  |  0 GPIOs`),
    margin,
    26.8
  );

  let ky = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Power Rails, LM393 Pinout & H3 Readback Scaling Map', margin, ky);
  ky += 3.5;

  const pCols = [33, 23, 30, 22, 74];
  const pHeaders = ['Device', 'Pin / Rail', 'KiCad Net', 'Role', 'Engineering Note'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ky, contentW, 6.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(255, 255, 255);
  cx = margin + 1.5;
  pHeaders.forEach((h, i) => {
    doc.text(h, cx, ky + 4.2);
    cx += pCols[i];
  });
  ky += 6.2;

  PUMP_REV_D_PINOUT.forEach((p) => {
    const nLines = doc.splitTextToSize(pdfSafe(p.connectionNote), pCols[4] - 2);
    const rowH = Math.max(8.8, Math.min(3, nLines.length) * 3.0 + 3.0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');

    cx = margin + 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(p.device), cx, ky + 4.0);
    cx += pCols[0];

    doc.setFont('courier', 'normal');
    doc.text(pdfSafe(p.pin), cx, ky + 4.0);
    cx += pCols[1];

    doc.setFont('courier', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.text(pdfSafe(p.netName), cx, ky + 4.0);
    cx += pCols[2];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(p.direction), cx, ky + 4.0);
    cx += pCols[3];

    doc.setFontSize(6.3);
    doc.setTextColor(30, 41, 59);
    doc.text(nLines.slice(0, 3), cx, ky + 3.8);
    ky += rowH;
  });

  ky += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pdfSafe(`2. KiCad / JLCPCB Bill of Materials (${PUMP_REV_D_BOM.length} Unique Lines | ${totalQty} Total Parts | EUR 0.00 Feeder Fee)`),
    margin,
    ky
  );
  ky += 3.5;

  const bCols = [19, 9, 23, 42, 14, 75];
  const bHeaders = ['RefDes', 'Qty', 'Value', 'KiCad Footprint', 'Class', 'Part & Engineering Role'];
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, ky, contentW, 6.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  cx = margin + 1.5;
  bHeaders.forEach((h, i) => {
    doc.text(h, cx, ky + 4.1);
    cx += bCols[i];
  });
  ky += 6.0;

  PUMP_REV_D_BOM.forEach((b) => {
    const roleLines = doc.splitTextToSize(pdfSafe(`${b.partNumber} - ${b.purpose}`), bCols[5] - 2);
    const rowH = Math.max(8.8, Math.min(3, roleLines.length) * 2.9 + 2.8);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ky, contentW, rowH, 'FD');

    cx = margin + 1.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(b.refDes), cx, ky + 3.9);
    cx += bCols[0];

    doc.setFont('courier', 'normal');
    doc.text(String(b.qty), cx, ky + 3.9);
    cx += bCols[1];

    doc.setFont('courier', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(pdfSafe(b.value), cx, ky + 3.9);
    cx += bCols[2];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.9);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(pdfSafe(b.footprint), bCols[3] - 2).slice(0, 2), cx, ky + 3.8);
    cx += bCols[3];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(4, 120, 87);
    doc.text(b.jlcpcbClass, cx, ky + 3.9);
    cx += bCols[4];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(30, 41, 59);
    doc.text(roleLines.slice(0, 3), cx, ky + 3.6);
    ky += rowH;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  const kicadNote = doc.splitTextToSize(
    pdfSafe(
      'Rev E (Gemini, ngspice-39) Layout Note: Place C21 (100 nF) tightly across U3 Pin 8 (+5V) and Pin 4 (GND). Tie unused U3B cleanly (Pin 5 -> +5V, Pin 6 -> GND, Pin 7 -> NC). Use R59 = 1.5 kOhm (<= 3.50 mA LM393 sink < 4 mA V_OL guarantee) driving Q17 (AO3401A P-MOS) + Q18 (AO3400A N-MOS) with R60 (47 Ohm 1206, shared with Pt1000 R105) in Q17 source to cap shoot-through peaks < 44 mA. Delivers +8.81 V nom (+7.21 V J2 PWM, 2.25 V RB1) and +7.98 V at 4.63 V Pi UVLO (+2.01 V RB1).'
    ),
    contentW - 8
  );
  const noteH = kicadNote.length * 3.05 + 4.2;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.rect(margin, ky + 3.0, contentW, noteH, 'FD');
  doc.setTextColor(6, 78, 59);
  doc.text(kicadNote, margin + 4, ky + 6.7);

  // =========================================================================
  // PAGE 9: HARDWARE AUDIT & REVISION HISTORY (Rev A -> Rev E | Gemini Version)
  // =========================================================================
  doc.addPage();
  addHeaderFooter(9, 9, 'Hardware Audit & Revision History (Rev A -> Rev E)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Hardware Audit & Revision History (Rev A -> Rev E | Gemini Version)', margin, 21.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafe(
      'Complete engineering progression from B0512S through 1-Wire Lite, Claude D25, and 17-part Rev D draft to the 14-part Gemini Version (Rev E).'
    ),
    margin,
    26.8
  );

  let ay = 33.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Revision Iteration Timeline (Rev A -> Rev B -> Rev C -> Rev D -> Rev E Gemini)', margin, ay);
  ay += 3.5;

  for (const rev of PUMP_REVISION_HISTORY) {
    const isCurrent = rev.status === 'Production Baseline';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    const archLines = doc.splitTextToSize(pdfSafe(rev.architecture), contentW - 8);
    const findingLines: string[][] = rev.findings.map((f) =>
      doc.splitTextToSize(pdfSafe(`${isCurrent ? '+' : '-'} ${f}`), contentW - 10)
    );
    const totalFindingLines = findingLines.reduce((acc, arr) => acc + arr.length, 0);
    const cardH = 7.8 + archLines.length * 2.75 + totalFindingLines * 2.65 + 3.2;

    doc.setFillColor(isCurrent ? 236 : 255, isCurrent ? 253 : 255, isCurrent ? 245 : 255);
    doc.setDrawColor(isCurrent ? 167 : 226, isCurrent ? 243 : 232, isCurrent ? 208 : 240);
    doc.rect(margin, ay, contentW, cardH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(isCurrent ? 4 : 15, isCurrent ? 120 : 23, isCurrent ? 87 : 42);
    doc.text(pdfSafe(`${rev.rev} - ${rev.title}`), margin + 3, ay + 4.4);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafe(`${rev.status} | ${rev.costSnapshot}`), pageW - margin - 3, ay + 4.4, { align: 'right' });

    let ly = ay + 8.0;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.1);
    doc.setTextColor(51, 65, 85);
    doc.text(archLines, margin + 3, ly);
    ly += archLines.length * 2.75 + 0.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(isCurrent ? 6 : 30, isCurrent ? 78 : 41, isCurrent ? 59 : 59);
    for (const fl of findingLines) {
      doc.text(fl, margin + 4, ly);
      ly += fl.length * 2.65;
    }

    ay += cardH + 2.2;
  }

  ay += 2.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Prior (D25 / Rev D) -> Gemini Version (Rev E) Hardware Audit Resolution Matrix', margin, ay);
  ay += 3.2;

  const aCols = [15, 27, 46, 48, 46];
  const aHeaders = ['ID', 'Audit Area', 'Prior (D25 / Rev D) Defect', 'Rev E (Gemini) Fix', 'Verified Result'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, ay, contentW, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  cx = margin + 1.5;
  aHeaders.forEach((h, i) => {
    doc.text(h, cx, ay + 4.0);
    cx += aCols[i];
  });
  ay += 5.8;

  for (const row of PUMP_D25_TO_REVD_FIXES) {
    const fLines = doc.splitTextToSize(pdfSafe(row.revCFlaw), aCols[2] - 2);
    const fixLines = doc.splitTextToSize(pdfSafe(row.revDFix), aCols[3] - 2);
    const impLines = doc.splitTextToSize(pdfSafe(row.verifiedImpact), aCols[4] - 2);
    const maxL = Math.max(fLines.length, fixLines.length, impLines.length);
    const rowH = Math.max(9.0, Math.min(4, maxL) * 2.65 + 2.8);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, ay, contentW, rowH, 'FD');

    let rx = margin + 1.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(29, 78, 216);
    doc.text(row.id, rx, ay + 3.7);
    rx += aCols[0];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(pdfSafe(row.area), aCols[1] - 2).slice(0, 2), rx, ay + 3.6);
    rx += aCols[1];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.7);
    doc.setTextColor(159, 18, 57);
    doc.text(fLines.slice(0, 4), rx, ay + 3.4);
    rx += aCols[2];

    doc.setTextColor(30, 41, 59);
    doc.text(fixLines.slice(0, 4), rx, ay + 3.4);
    rx += aCols[3];

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(4, 120, 87);
    doc.text(impLines.slice(0, 4), rx, ay + 3.4);

    ay += rowH;
  }

  return doc;
}

export function exportPumpSupplyPdfReport(
  selectedTopology: PumpTopologyId,
  params: PumpSimParams,
  batchSize: 2 | 5
): void {
  const doc = buildPumpSupplyPdfDoc(selectedTopology, params, batchSize);
  doc.save(`CoSTOS-Pump-PWM-Driver-Supply-RevE-Gemini-${selectedTopology}.pdf`);
}
