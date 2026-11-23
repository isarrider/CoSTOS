import React from 'react';
import {
  SimulationParams,
  SimulationResult,
  TOPOLOGY_SPECS,
  TopologyId,
} from '../physics/model';

interface CircuitDiagramSvgProps {
  topologyId: TopologyId;
  params?: SimulationParams;
  result?: SimulationResult;
  compact?: boolean;
}

/* ==================== AUTHENTIC IEEE/IEC SVG SYMBOL PRIMITIVES ==================== */

const Gnd: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#475569',
}) => (
  <g stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <line x1={x} y1={y} x2={x} y2={y + 6} />
    <line x1={x - 9} y1={y + 6} x2={x + 9} y2={y + 6} />
    <line x1={x - 6} y1={y + 10} x2={x + 6} y2={y + 10} />
    <line x1={x - 3} y1={y + 14} x2={x + 3} y2={y + 14} />
  </g>
);

const Vcc: React.FC<{ x: number; y: number; label: string; color?: string }> = ({
  x,
  y,
  label,
  color = '#1d4ed8',
}) => (
  <g>
    <line x1={x - 8} y1={y} x2={x + 8} y2={y} stroke={color} strokeWidth="1.7" />
    <line x1={x} y1={y} x2={x} y2={y + 8} stroke={color} strokeWidth="1.4" />
    <text
      x={x}
      y={y - 4}
      textAnchor="middle"
      className="text-[8.5px] font-mono font-bold"
      fill={color}
    >
      {label}
    </text>
  </g>
);

const ResH: React.FC<{
  x1: number;
  x2: number;
  y: number;
  color?: string;
  bodyW?: number;
  amp?: number;
}> = ({ x1, x2, y, color = '#334155', bodyW = 34, amp = 5.5 }) => {
  const mid = (x1 + x2) / 2;
  const w = Math.min(bodyW, (x2 - x1) * 0.72);
  const b1 = mid - w / 2;
  const b2 = mid + w / 2;
  const s = w / 6;
  const d = `M ${x1} ${y} L ${b1} ${y} L ${b1 + s * 0.5} ${y - amp} L ${b1 + s * 1.5} ${y + amp} L ${b1 + s * 2.5} ${y - amp} L ${b1 + s * 3.5} ${y + amp} L ${b1 + s * 4.5} ${y - amp} L ${b1 + s * 5.5} ${y + amp} L ${b2} ${y} L ${x2} ${y}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
};

const ResV: React.FC<{
  x: number;
  y1: number;
  y2: number;
  color?: string;
  bodyH?: number;
  amp?: number;
}> = ({ x, y1, y2, color = '#334155', bodyH = 30, amp = 5.2 }) => {
  const mid = (y1 + y2) / 2;
  const h = Math.min(bodyH, (y2 - y1) * 0.72);
  const b1 = mid - h / 2;
  const b2 = mid + h / 2;
  const s = h / 6;
  const d = `M ${x} ${y1} L ${x} ${b1} L ${x - amp} ${b1 + s * 0.5} L ${x + amp} ${b1 + s * 1.5} L ${x - amp} ${b1 + s * 2.5} L ${x + amp} ${b1 + s * 3.5} L ${x - amp} ${b1 + s * 4.5} L ${x + amp} ${b1 + s * 5.5} L ${x} ${b2} L ${x} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
};

/** Authentic diagonal IEEE resistor for Wheatstone Bridge legs */
const ResDiag: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
}> = ({ x1, y1, x2, y2, color = '#334155' }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const body = Math.min(34, len * 0.58);
  const start = (len - body) / 2;
  const s = body / 6;
  const amp = 4.6;
  const pt = (t: number, o: number) =>
    `${(x1 + ux * t + nx * o).toFixed(1)},${(y1 + uy * t + ny * o).toFixed(1)}`;
  const pts = [
    pt(0, 0),
    pt(start, 0),
    pt(start + s * 0.5, -amp),
    pt(start + s * 1.5, amp),
    pt(start + s * 2.5, -amp),
    pt(start + s * 3.5, amp),
    pt(start + s * 4.5, -amp),
    pt(start + s * 5.5, amp),
    pt(start + body, 0),
    pt(len, 0),
  ].join(' ');
  return (
    <polyline
      points={pts}
      fill="none"
      stroke={color}
      strokeWidth="1.45"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
};

const CapV: React.FC<{
  x: number;
  y1: number;
  y2: number;
  color?: string;
}> = ({ x, y1, y2, color = '#334155' }) => {
  const mid = (y1 + y2) / 2;
  return (
    <g stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <line x1={x} y1={y1} x2={x} y2={mid - 3.5} />
      <line x1={x - 9} y1={mid - 3.5} x2={x + 9} y2={mid - 3.5} strokeWidth="1.9" />
      <line x1={x - 9} y1={mid + 3.5} x2={x + 9} y2={mid + 3.5} strokeWidth="1.9" />
      <line x1={x} y1={mid + 3.5} x2={x} y2={y2} />
    </g>
  );
};

/** Authentic Zener / TVS clamp diode (cathode up at y1, anode down at y2) */
const ZenerV: React.FC<{
  x: number;
  y1: number;
  y2: number;
  color?: string;
  fill?: string;
}> = ({ x, y1, y2, color = '#475569', fill = '#ffffff' }) => {
  const mid = (y1 + y2) / 2;
  const kY = mid - 7;
  const aY = mid + 8;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={kY} stroke={color} strokeWidth="1.45" />
      <polygon
        points={`${x - 7.5},${aY} ${x + 7.5},${aY} ${x},${kY}`}
        fill={fill}
        stroke={color}
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <polyline
        points={`${x - 10},${kY - 3} ${x - 7.5},${kY} ${x + 7.5},${kY} ${x + 10},${kY + 3}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1={x} y1={aY} x2={x} y2={y2} stroke={color} strokeWidth="1.45" />
    </g>
  );
};

/** Authentic IEEE N-Channel Enhancement MOSFET (Drain top, Source bottom, Gate left) */
const NMosfet: React.FC<{
  cx: number;
  cy: number;
  color?: string;
}> = ({ cx, cy, color = '#334155' }) => (
  <g>
    <circle cx={cx} cy={cy} r="13.5" fill="#ffffff" stroke={color} strokeWidth="1.25" />
    {/* Gate lead + vertical insulated gate bar */}
    <line x1={cx - 17} y1={cy + 5} x2={cx - 6} y2={cy + 5} stroke={color} strokeWidth="1.4" />
    <line x1={cx - 6} y1={cy - 8} x2={cx - 6} y2={cy + 8} stroke={color} strokeWidth="1.7" />
    {/* 3-segment broken enhancement channel */}
    <line x1={cx - 2} y1={cy - 9} x2={cx - 2} y2={cy - 4} stroke={color} strokeWidth="1.6" />
    <line x1={cx - 2} y1={cy - 2.2} x2={cx - 2} y2={cy + 2.2} stroke={color} strokeWidth="1.6" />
    <line x1={cx - 2} y1={cy + 4} x2={cx - 2} y2={cy + 9} stroke={color} strokeWidth="1.6" />
    {/* Drain lead (top) */}
    <polyline
      points={`${cx - 2},${cy - 6.5} ${cx + 7},${cy - 6.5} ${cx + 7},${cy - 17}`}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
    />
    {/* Body + Source lead (bottom) */}
    <polyline
      points={`${cx - 2},${cy} ${cx + 7},${cy} ${cx + 7},${cy + 17}`}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
    />
    <line x1={cx - 2} y1={cy + 6.5} x2={cx + 7} y2={cy + 6.5} stroke={color} strokeWidth="1.4" />
    {/* N-channel inward arrowhead pointing toward gate */}
    <polygon
      points={`${cx - 1.5},${cy} ${cx + 3.8},${cy - 3} ${cx + 3.8},${cy + 3}`}
      fill={color}
    />
  </g>
);

export const CircuitDiagramSvg: React.FC<CircuitDiagramSvgProps> = ({
  topologyId,
  params,
  result,
  compact = false,
}) => {
  const spec = TOPOLOGY_SPECS[topologyId];
  const fault = params?.activeFault ?? 'none';
  const isOpen = fault === 'open';
  const isShort = fault === 'short';
  const isSurge = fault === 'surge_24v';
  const isStale = fault === 'stale';

  const wireStroke = isSurge ? '#d97706' : isOpen || isShort ? '#e11d48' : '#334155';
  const trueRText = result ? `${result.trueResistanceOhm.toFixed(0)} Ω` : '1000–1941 Ω';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 overflow-x-auto">
      <svg
        viewBox="0 0 900 300"
        className={`w-full h-auto select-none ${compact ? 'min-w-[620px]' : 'min-w-[700px]'}`}
        role="img"
        aria-label={`Authentic IEEE electronic schematic for ${spec.shortName}`}
      >
        <defs>
          <pattern
            id={`grid-${topologyId}`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.55"
              strokeOpacity="0.65"
            />
          </pattern>
          <marker
            id={`arrow-${topologyId}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>

        <rect width="900" height="300" rx="4" fill="#f8fafc" />
        <rect width="900" height="300" rx="4" fill={`url(#grid-${topologyId})`} />

        {/* ZONE 1 (14..128): Authentic IEEE PT1000 RTD Sensor & Screw Terminals */}
        <text x="16" y="24" className="fill-slate-500 text-[10px] font-mono font-semibold uppercase">
          Roof Probe (PT1)
        </text>

        {/* Vertical zig-zag RTD element with IEC/IEEE temperature slash bar */}
        <line x1="48" y1="66" x2="48" y2="104" stroke={wireStroke} strokeWidth="1.6" />
        <ResV x={48} y1={104} y2={176} color={wireStroke} bodyH={58} amp={8} />
        <line x1="48" y1="176" x2="48" y2="216" stroke={wireStroke} strokeWidth="1.6" />
        {/* RTD diagonal linear-temp bar + +t° tag */}
        <polyline
          points="28,162 28,154 68,120"
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <text x="20" y="148" className="fill-blue-700 text-[8.5px] font-mono font-bold">
          +t°
        </text>
        <text x="48" y="88" textAnchor="middle" className="fill-slate-900 text-[10px] font-mono font-bold">
          PT1000
        </text>
        <text x="48" y="200" textAnchor="middle" className="fill-blue-700 text-[9.2px] font-mono tabular-nums">
          {trueRText}
        </text>

        {/* Wires to PT1 screw terminals */}
        <line x1="48" y1="66" x2="114" y2="66" stroke={wireStroke} strokeWidth="1.6" />
        <line x1="48" y1="216" x2="114" y2="216" stroke={wireStroke} strokeWidth="1.6" />

        <circle cx="114" cy="66" r="4.5" fill="#ffffff" stroke="#334155" strokeWidth="1.6" />
        <circle cx="114" cy="216" r="4.5" fill="#ffffff" stroke="#334155" strokeWidth="1.6" />
        <text x="114" y="52" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono font-semibold">
          PT1_A
        </text>
        <text x="114" y="234" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono font-semibold">
          PT1_B
        </text>

        {/* Fault Overlays */}
        {isOpen && (
          <g>
            <rect x="68" y="56" width="26" height="20" fill="#f8fafc" />
            <line x1="70" y1="73" x2="92" y2="58" stroke="#e11d48" strokeWidth="2.4" />
            <text x="81" y="48" textAnchor="middle" className="fill-rose-700 text-[9.5px] font-mono font-bold">
              OPEN
            </text>
          </g>
        )}
        {isShort && (
          <g>
            <line x1="84" y1="66" x2="84" y2="216" stroke="#e11d48" strokeWidth="2.5" />
            <circle cx="84" cy="66" r="3.2" fill="#e11d48" />
            <circle cx="84" cy="216" r="3.2" fill="#e11d48" />
            <rect x="63" y="132" width="42" height="16" rx="2" fill="#fff1f2" />
            <text x="84" y="143" textAnchor="middle" className="fill-rose-700 text-[9.5px] font-mono font-bold">
              SHORT
            </text>
          </g>
        )}
        {isSurge && (
          <g>
            <circle cx="96" cy="66" r="4.2" fill="#d97706" />
            <text x="90" y="48" textAnchor="middle" className="fill-amber-700 text-[9.5px] font-mono font-bold">
              +24V FAULT
            </text>
          </g>
        )}

        {/* ZONE 2 (118..252): Authentic Input Protection (Zig-Zag Resistors + TVS Diode) */}
        {topologyId === 'switched_rc' ? (
          <line x1="118" y1="66" x2="216" y2="66" stroke={wireStroke} strokeWidth="1.6" />
        ) : (
          <g>
            <ResH x1={118} x2={216} y={66} color={wireStroke} bodyW={42} />
            <text x="167" y="54" textAnchor="middle" className="fill-slate-900 text-[9px] font-mono font-semibold">
              {topologyId === 'max31865'
                ? '100 Ω'
                : topologyId === 'bridge_lmv358_ads1115' || topologyId === 'pwm_dac_lm393'
                ? '1.0 kΩ'
                : '470 Ω'}
            </text>
          </g>
        )}

        {topologyId === 'pwm_dac_lm393' ? (
          <g>
            <line x1="118" y1="216" x2="170" y2="216" stroke={wireStroke} strokeWidth="1.6" />
            <Gnd x={170} y={216} />
          </g>
        ) : (
          <g>
            <ResH x1={118} x2={216} y={216} color={wireStroke} bodyW={42} />
            <text x="167" y="236" textAnchor="middle" className="fill-slate-900 text-[9px] font-mono font-semibold">
              {topologyId === 'max31865'
                ? '100 Ω'
                : topologyId === 'switched_rc'
                ? 'R5 47 Ω 1206'
                : topologyId === 'bridge_lmv358_ads1115'
                ? '1.0 kΩ'
                : '470 Ω'}
            </text>
          </g>
        )}

        {/* Authentic TVS / ESD Diode to GND */}
        <circle cx="222" cy="66" r="2.8" fill="#334155" />
        <ZenerV
          x={222}
          y1={66}
          y2={176}
          color={isSurge ? '#d97706' : '#475569'}
          fill={isSurge ? '#fef3c7' : '#ffffff'}
        />
        <Gnd x={222} y={176} />
        <text x="200" y="114" textAnchor="end" className="fill-slate-700 text-[8.3px] font-mono font-semibold">
          {topologyId === 'switched_rc' ? 'D2 PESD24V' : 'PESD5V0'}
        </text>
        <text x="200" y="128" textAnchor="end" className="fill-slate-500 text-[8px] font-mono">
          {topologyId === 'switched_rc' ? '24V TVS' : topologyId === 'max31865' ? '±45V IC' : '+ BAV99'}
        </text>

        {/* ZONE 3 (216..724): Topology-Specific Authentic IEEE Front End */}
        {topologyId === 'max31865' && (
          <g>
            <line x1="216" y1="66" x2="386" y2="66" stroke="#334155" strokeWidth="1.6" />
            <line x1="216" y1="216" x2="386" y2="216" stroke="#334155" strokeWidth="1.6" />

            {/* 100 nF Diff Cap */}
            <circle cx="272" cy="66" r="2.5" fill="#334155" />
            <circle cx="272" cy="216" r="2.5" fill="#334155" />
            <CapV x={272} y1={66} y2={216} color="#475569" />
            <text x="272" y="162" textAnchor="middle" className="fill-slate-700 text-[8.8px] font-mono">
              100 nF
            </text>

            {/* Authentic Zig-Zag R_ref 4.3k 0.1% */}
            <line x1="386" y1="108" x2="334" y2="108" stroke="#2563eb" strokeWidth="1.4" />
            <ResV x={334} y1={108} y2={166} color="#2563eb" bodyH={36} />
            <line x1="334" y1="166" x2="386" y2="166" stroke="#2563eb" strokeWidth="1.4" />
            <text x="322" y="136" textAnchor="end" className="fill-blue-800 text-[8.5px] font-mono font-semibold">
              R_ref
            </text>
            <text x="322" y="148" textAnchor="end" className="fill-blue-700 text-[8.2px] font-mono">
              4.3k 0.1%
            </text>

            {/* MAX31865 Package */}
            <rect x="386" y="34" width="214" height="214" rx="5" fill="#ffffff" stroke="#2563eb" strokeWidth="1.6" />
            <rect x="386" y="34" width="214" height="26" rx="4" fill="#eff6ff" />
            <text x="493" y="51" textAnchor="middle" className="fill-blue-800 text-[10.5px] font-mono font-bold">
              U1: MAX31865AAP+ (SSOP-20)
            </text>

            <text x="394" y="70" className="fill-slate-800 text-[9px] font-mono font-semibold">RTDIN+</text>
            <text x="394" y="112" className="fill-slate-600 text-[8.5px] font-mono">REFIN+</text>
            <text x="394" y="170" className="fill-slate-600 text-[8.5px] font-mono">REFIN−</text>
            <text x="394" y="220" className="fill-slate-800 text-[9px] font-mono font-semibold">RTDIN−</text>

            <rect x="462" y="76" width="124" height="52" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
            <text x="524" y="99" textAnchor="middle" className="fill-slate-900 text-[10px] font-mono font-semibold">
              15-bit ΔΣ ADC
            </text>
            <text x="524" y="116" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              50/60 Hz Notch
            </text>

            <rect x="462" y="142" width="124" height="52" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
            <text x="524" y="165" textAnchor="middle" className="fill-slate-900 text-[10px] font-mono font-semibold">
              ±45V Guard &amp; FSM
            </text>
            <text x="524" y="182" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              Reg 0x07 Open/Short
            </text>

            <text x="493" y="238" textAnchor="middle" className="fill-slate-500 text-[9px] font-mono">
              Extended Fee: +€2.80 · Parts: €4.08
            </text>

            {[78, 118, 158, 198].map((py, i) => {
              const lbl = ['SCLK (GPIO 11)', 'MISO (GPIO 9)', 'MOSI (GPIO 10)', 'CE0 (GPIO 8)'][i];
              return (
                <g key={lbl}>
                  <line
                    x1="600"
                    y1={py}
                    x2="722"
                    y2={py}
                    stroke="#334155"
                    strokeWidth="1.5"
                    markerEnd={i < 2 ? `url(#arrow-${topologyId})` : undefined}
                  />
                  <text x="661" y={py - 6} textAnchor="middle" className="fill-slate-800 text-[9px] font-mono font-medium">
                    {lbl}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {topologyId === 'switched_rc' && (
          <g>
            {/* V_DIV sense bus */}
            <line x1="216" y1="66" x2="392" y2="66" stroke="#334155" strokeWidth="1.6" />

            {/* R1 3.90k 0.1% Top Divider Zig-Zag from +3.3V */}
            <Vcc x={274} y={14} label="+3.3V" />
            <ResV x={274} y1={22} y2={66} color="#2563eb" bodyH={28} />
            <circle cx="274" cy="66" r="2.6" fill="#334155" />
            <text x="284" y="42" className="fill-blue-800 text-[8.3px] font-mono font-semibold">
              R1 3.90k 0.1%
            </text>

            {/* Branch 1: R2 1.00k 0.1% + Authentic Q2 N-MOSFET (GPIO 12) */}
            <circle cx="316" cy="66" r="2.5" fill="#334155" />
            <ResV x={316} y1={66} y2={116} color="#2563eb" bodyH={28} />
            <text x="306" y="94" textAnchor="end" className="fill-blue-800 text-[7.8px] font-mono font-semibold">
              1.00k
            </text>
            <NMosfet cx={309} cy={133} color="#475569" />
            <Gnd x={316} y={150} />
            <text x="292" y="137" textAnchor="end" className="fill-slate-700 text-[7.8px] font-mono font-semibold">
              Q2 G12
            </text>

            {/* Branch 2: R3 1.80k 0.1% + Authentic Q3 N-MOSFET (GPIO 13) */}
            <circle cx="372" cy="66" r="2.5" fill="#334155" />
            <ResV x={372} y1={66} y2={116} color="#2563eb" bodyH={28} />
            <text x="362" y="94" textAnchor="end" className="fill-blue-800 text-[7.8px] font-mono font-semibold">
              1.80k
            </text>
            <NMosfet cx={365} cy={133} color="#475569" />
            <Gnd x={372} y={150} />
            <text x="383" y="137" className="fill-slate-700 text-[7.8px] font-mono font-semibold">
              Q3 G13
            </text>

            {/* Branch 3: Authentic Q1 AO3400A N-MOSFET on PT1_B (GPIO 27) */}
            <line x1="216" y1="216" x2="296" y2="216" stroke="#334155" strokeWidth="1.5" />
            <line x1="296" y1="216" x2="296" y2="205" stroke="#059669" strokeWidth="1.5" />
            <NMosfet cx={289} cy={222} color="#059669" />
            <Gnd x={296} y={239} />
            <text x="268" y="226" textAnchor="end" className="fill-emerald-800 text-[8.2px] font-mono font-bold">
              Q1 G27
            </text>
            <text x="310" y="226" className="fill-slate-600 text-[7.6px] font-mono">
              AO3400A
            </text>

            {/* Sense-side Protection & Filter: R4 10k Zig-Zag + D3 5.1V Zener + C3 100nF */}
            <ResH x1={392} x2={446} y={66} color="#059669" bodyW={32} />
            <text x="419" y="54" textAnchor="middle" className="fill-emerald-800 text-[8.2px] font-mono font-semibold">
              R4 10k
            </text>
            <line x1="446" y1="66" x2="504" y2="66" stroke="#059669" strokeWidth="1.6" />

            {/* D3 BZX84C5V1 Zener */}
            <circle cx="458" cy="66" r="2.4" fill="#059669" />
            <ZenerV x={458} y1={66} y2={122} color="#059669" fill="#ecfdf5" />
            <Gnd x={458} y={122} />
            <text x="448" y="100" textAnchor="end" className="fill-emerald-800 text-[7.6px] font-mono font-semibold">
              D3 5.1V
            </text>

            {/* C3 100nF X7R */}
            <circle cx="486" cy="66" r="2.4" fill="#059669" />
            <CapV x={486} y1={66} y2={122} color="#059669" />
            <Gnd x={486} y={122} />
            <text x="496" y="98" className="fill-slate-700 text-[7.5px] font-mono">
              100nF
            </text>

            {/* Authentic LM393 U1A Slicer Comparator */}
            <polygon
              points="504,44 504,116 568,80"
              fill="#eff6ff"
              stroke="#2563eb"
              strokeWidth="1.6"
            />
            <text x="511" y="70" className="fill-slate-900 text-[10.5px] font-mono font-bold">+</text>
            <text x="511" y="101" className="fill-slate-900 text-[10.5px] font-mono font-bold">−</text>
            <text x="533" y="84" textAnchor="middle" className="fill-blue-900 text-[9px] font-mono font-bold">
              U1A
            </text>
            <Vcc x={532} y={24} label="+5V U1" color="#2563eb" />
            <line x1="532" y1="32" x2="532" y2="60" stroke="#2563eb" strokeWidth="1.2" />

            {/* Authentic U1B 72 Hz Schmitt RC Ramp Oscillator */}
            <polygon
              points="510,162 510,224 566,193"
              fill="#ecfdf5"
              stroke="#059669"
              strokeWidth="1.5"
            />
            <text x="517" y="182" className="fill-slate-900 text-[9.5px] font-mono font-bold">+</text>
            <text x="517" y="210" className="fill-slate-900 text-[9.5px] font-mono font-bold">−</text>
            <text x="536" y="196" textAnchor="middle" className="fill-emerald-900 text-[8.8px] font-mono font-bold">
              U1B
            </text>
            {/* Feedback R9 390k + C1/C2 2x10nF C0G */}
            <line x1="566" y1="193" x2="584" y2="193" stroke="#059669" strokeWidth="1.4" />
            <line x1="584" y1="193" x2="584" y2="244" stroke="#059669" strokeWidth="1.3" />
            <ResH x1={482} x2={584} y={244} color="#059669" bodyW={34} />
            <text x="534" y="258" textAnchor="middle" className="fill-emerald-800 text-[7.8px] font-mono font-semibold">
              R9 390k (72 Hz)
            </text>
            <line x1="482" y1="244" x2="482" y2="206" stroke="#059669" strokeWidth="1.4" />
            <line x1="482" y1="206" x2="510" y2="206" stroke="#059669" strokeWidth="1.4" />
            <circle cx="482" cy="206" r="2.4" fill="#059669" />
            <CapV x={450} y1={206} y2={252} color="#059669" />
            <line x1="450" y1="206" x2="482" y2="206" stroke="#059669" strokeWidth="1.4" />
            <Gnd x={450} y={252} />
            <text x="438" y="232" textAnchor="end" className="fill-emerald-800 text-[7.8px] font-mono font-semibold">
              2×10nF
            </text>
            <text x="438" y="243" textAnchor="end" className="fill-slate-600 text-[7.4px] font-mono">
              C0G
            </text>

            {/* V_ramp wire up to U1A (-) */}
            <polyline
              points="482,206 482,150 496,150 496,97 504,97"
              fill="none"
              stroke="#059669"
              strokeWidth="1.4"
              strokeDasharray="3 2"
            />
            <text x="488" y="144" textAnchor="middle" className="fill-emerald-800 text-[7.6px] font-mono font-bold">
              V_ramp
            </text>

            {/* R10 4.7k Pull-up Zig-Zag to +3.3V & DUTY_IN Output */}
            <Vcc x={604} y={24} label="+3.3V" />
            <ResV x={604} y1={32} y2={80} color="#334155" bodyH={26} />
            <circle cx="604" cy="80" r="2.5" fill="#334155" />
            <text x="615" y="58" className="fill-slate-800 text-[8px] font-mono font-semibold">
              4.7k
            </text>
            <line x1="568" y1="80" x2="722" y2="80" stroke="#334155" strokeWidth="1.6" markerEnd={`url(#arrow-${topologyId})`} />
            <text x="668" y="70" textAnchor="middle" className="fill-slate-900 text-[8.5px] font-mono font-semibold">
              DUTY_IN (G22 · 72 Hz)
            </text>

            {/* Mux Control Bus */}
            <polyline
              points="296,268 722,268"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.2"
              strokeDasharray="4 2"
            />
            <text x="530" y="286" textAnchor="middle" className="fill-emerald-800 text-[8.5px] font-mono font-semibold">
              Gemini Version (Rev D): GPIOs 22/27/12/13 · 100% Basic Parts · Exact ln() Math · €0.00 Fee
            </text>
          </g>
        )}

        {topologyId === 'bridge_cs1237' && (
          <g>
            {/* Authentic 4-Leg Diamond Wheatstone Bridge */}
            <Vcc x={356} y={32} label="+3.3V V_EXC" />
            <line x1="356" y1="40" x2="356" y2="54" stroke="#1d4ed8" strokeWidth="1.4" />
            <circle cx="356" cy="54" r="2.5" fill="#1d4ed8" />

            {/* 4 Diamond Legs */}
            <ResDiag x1={356} y1={54} x2={288} y2={136} color="#475569" />
            <ResDiag x1={356} y1={54} x2={424} y2={136} color="#475569" />
            <ResDiag x1={288} y1={136} x2={356} y2={218} color="#2563eb" />
            <ResDiag x1={424} y1={136} x2={356} y2={218} color="#059669" />
            <circle cx="356" cy="218" r="2.5" fill="#334155" />
            <Gnd x={356} y={218} />

            {/* Connect PT1000 input wires into bridge right leg */}
            <polyline points="216,66 254,66 254,136 288,136" fill="none" stroke="#334155" strokeWidth="1.4" />
            <line x1="216" y1="216" x2="356" y2="216" stroke="#334155" strokeWidth="1.4" />

            {/* Bridge Leg Labels */}
            <text x="304" y="88" textAnchor="end" className="fill-slate-700 text-[8px] font-mono font-semibold">4.7k</text>
            <text x="408" y="88" className="fill-slate-700 text-[8px] font-mono font-semibold">4.7k</text>
            <text x="304" y="192" textAnchor="end" className="fill-blue-800 text-[8px] font-mono font-semibold">1.0k</text>
            <text x="408" y="192" className="fill-emerald-800 text-[8px] font-mono font-bold">PT1000</text>

            {/* Diff taps AIN+ / AIN- */}
            <circle cx="288" cy="136" r="2.6" fill="#2563eb" />
            <circle cx="424" cy="136" r="2.6" fill="#2563eb" />
            <polyline points="288,136 288,112 478,112" fill="none" stroke="#2563eb" strokeWidth="1.3" strokeDasharray="3 2" />
            <polyline points="424,136 452,136 452,164 478,164" fill="none" stroke="#2563eb" strokeWidth="1.4" />
            <text x="458" y="105" textAnchor="middle" className="fill-blue-800 text-[8.3px] font-mono font-semibold">AIN+</text>
            <text x="458" y="178" textAnchor="middle" className="fill-blue-800 text-[8.3px] font-mono font-semibold">AIN−</text>

            {/* CS1237 IC */}
            <rect x="478" y="56" width="144" height="166" rx="5" fill="#ffffff" stroke="#2563eb" strokeWidth="1.6" />
            <rect x="478" y="56" width="144" height="26" rx="4" fill="#eff6ff" />
            <text x="550" y="73" textAnchor="middle" className="fill-blue-800 text-[10px] font-mono font-bold">
              U1: CS1237 / HX711
            </text>
            <text x="550" y="114" textAnchor="middle" className="fill-slate-900 text-[9.5px] font-mono font-semibold">
              24-bit PGA ΔΣ ADC
            </text>
            <text x="550" y="136" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              Gain = 2 · 10 SPS
            </text>
            <text x="550" y="156" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              50/60 Hz Notch
            </text>
            <text x="550" y="200" textAnchor="middle" className="fill-amber-700 text-[8.5px] font-mono font-semibold">
              Fee: +€2.80 (Extended)
            </text>

            {/* Pi Lines with Authentic Zig-Zag 1k DOUT resistor */}
            <line x1="622" y1="112" x2="722" y2="112" stroke="#334155" strokeWidth="1.5" />
            <text x="672" y="104" textAnchor="middle" className="fill-slate-800 text-[9px] font-mono">SCLK (GPIO 8)</text>

            <ResH x1={622} x2={722} y={166} color="#334155" bodyW={34} />
            <text x="672" y="154" textAnchor="middle" className="fill-slate-900 text-[8.5px] font-mono font-semibold">
              1 kΩ · DOUT (G9)
            </text>
          </g>
        )}

        {topologyId === 'bridge_lmv358_ads1115' && (
          <g>
            {/* Authentic Diamond Wheatstone Bridge */}
            <Vcc x={316} y={36} label="+3.3V" />
            <line x1="316" y1="44" x2="316" y2="58" stroke="#1d4ed8" strokeWidth="1.4" />
            <ResDiag x1={316} y1={58} x2={264} y2={136} color="#475569" />
            <ResDiag x1={316} y1={58} x2={368} y2={136} color="#475569" />
            <ResDiag x1={264} y1={136} x2={316} y2={214} color="#2563eb" />
            <ResDiag x1={368} y1={136} x2={316} y2={214} color="#059669" />
            <Gnd x={316} y={214} />
            <polyline points="216,66 244,66 244,136 264,136" fill="none" stroke="#334155" strokeWidth="1.4" />
            <line x1="216" y1="216" x2="316" y2="216" stroke="#334155" strokeWidth="1.4" />
            <text x="276" y="92" textAnchor="end" className="fill-slate-700 text-[7.6px] font-mono">3.3k</text>
            <text x="356" y="92" className="fill-slate-700 text-[7.6px] font-mono">3.3k</text>
            <text x="276" y="186" textAnchor="end" className="fill-blue-800 text-[7.6px] font-mono">800Ω</text>
            <text x="356" y="186" className="fill-emerald-800 text-[7.6px] font-mono font-bold">PT</text>

            {/* LMV358 Diff Amp with feedback resistor */}
            <ResH x1={368} x2={412} y={156} color="#334155" bodyW={24} amp={4} />
            <polyline points="264,136 264,116 412,116" fill="none" stroke="#334155" strokeWidth="1.3" strokeDasharray="3 2" />
            <polygon points="412,86 412,186 484,136" fill="#f8fafc" stroke="#475569" strokeWidth="1.6" />
            <text x="421" y="120" className="fill-slate-900 text-[10.5px] font-mono font-bold">−</text>
            <text x="421" y="160" className="fill-slate-900 text-[10.5px] font-mono font-bold">+</text>
            <text x="444" y="139" textAnchor="middle" className="fill-slate-900 text-[9px] font-mono font-bold">
              LMV358
            </text>
            {/* Feedback R_f across LMV358 */}
            <line x1="402" y1="116" x2="402" y2="66" stroke="#475569" strokeWidth="1.2" />
            <ResH x1={402} x2={496} y={66} color="#475569" bodyW={32} amp={4.5} />
            <line x1="496" y1="66" x2="496" y2="136" stroke="#475569" strokeWidth="1.2" />
            <circle cx="496" cy="136" r="2.4" fill="#334155" />
            <text x="449" y="55" textAnchor="middle" className="fill-slate-700 text-[8.5px] font-mono font-semibold">
              G = 3.5× (V_os ±1.7mV)
            </text>

            {/* ADS1115 */}
            <line x1="484" y1="136" x2="518" y2="136" stroke="#334155" strokeWidth="1.5" />
            <rect x="518" y="56" width="116" height="166" rx="5" fill="#ffffff" stroke="#2563eb" strokeWidth="1.6" />
            <rect x="518" y="56" width="116" height="26" rx="4" fill="#eff6ff" />
            <text x="576" y="73" textAnchor="middle" className="fill-blue-800 text-[10px] font-mono font-bold">
              U1: ADS1115
            </text>
            <text x="576" y="114" textAnchor="middle" className="fill-slate-900 text-[9.5px] font-mono font-semibold">
              16-bit I²C ADC
            </text>
            <text x="576" y="136" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              AIN0: V_amp
            </text>
            <text x="576" y="156" textAnchor="middle" className="fill-slate-600 text-[9px] font-mono">
              AIN2: 3.3V Ref
            </text>
            <text x="576" y="198" textAnchor="middle" className="fill-amber-700 text-[8.5px] font-mono font-semibold">
              Fee: +€2.80
            </text>

            <line x1="634" y1="112" x2="722" y2="112" stroke="#334155" strokeWidth="1.5" />
            <line x1="634" y1="158" x2="722" y2="158" stroke="#334155" strokeWidth="1.5" />
            <text x="678" y="104" textAnchor="middle" className="fill-slate-800 text-[9px] font-mono">SDA (GPIO 2)</text>
            <text x="678" y="150" textAnchor="middle" className="fill-slate-800 text-[9px] font-mono">SCL (GPIO 3)</text>
            <text x="678" y="186" textAnchor="middle" className="fill-slate-500 text-[8.2px] font-mono">Shared w/ DS2482</text>
          </g>
        )}

        {topologyId === 'pwm_dac_lm393' && (
          <g>
            {/* Top 3.3k Divider Leg to +3.3V */}
            <line x1="216" y1="66" x2="478" y2="66" stroke="#334155" strokeWidth="1.6" />
            <Vcc x={306} y={14} label="+3.3V" />
            <ResV x={306} y1={22} y2={66} color="#2563eb" bodyH={28} />
            <circle cx="306" cy="66" r="2.5" fill="#334155" />
            <text x="316" y="44" className="fill-blue-800 text-[8.5px] font-mono font-semibold">
              3.3k 0.1%
            </text>

            {/* Authentic 2-Stage RC Ladder PWM DAC (47k -> 100nF -> 47k -> 100nF) */}
            <ResH x1={276} x2={346} y={196} color="#475569" bodyW={34} />
            <circle cx="346" cy="196" r="2.4" fill="#334155" />
            <CapV x={346} y1={196} y2={248} color="#475569" />
            <Gnd x={346} y={248} />

            <ResH x1={346} x2={420} y={196} color="#475569" bodyW={34} />
            <circle cx="420" cy="196" r="2.4" fill="#334155" />
            <CapV x={420} y1={196} y2={248} color="#475569" />
            <Gnd x={420} y={248} />

            <text x="311" y="184" textAnchor="middle" className="fill-slate-700 text-[8.2px] font-mono font-semibold">47 kΩ</text>
            <text x="383" y="184" textAnchor="middle" className="fill-slate-700 text-[8.2px] font-mono font-semibold">47 kΩ</text>
            <text x="346" y="274" textAnchor="middle" className="fill-slate-600 text-[7.8px] font-mono">100 nF</text>
            <text x="420" y="274" textAnchor="middle" className="fill-slate-600 text-[7.8px] font-mono">100 nF</text>

            {/* V_dac wire into LM393 (-) */}
            <polyline points="420,196 456,196 456,118 478,118" fill="none" stroke="#334155" strokeWidth="1.5" />

            {/* Authentic LM393 Comparator Triangle */}
            <polygon points="478,44 478,144 558,94" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.6" />
            <text x="488" y="72" className="fill-slate-900 text-[11px] font-mono font-bold">+</text>
            <text x="488" y="124" className="fill-slate-900 text-[11px] font-mono font-bold">−</text>
            <text x="514" y="98" textAnchor="middle" className="fill-blue-900 text-[9.5px] font-mono font-bold">
              LM393
            </text>

            {/* Authentic 4.7k Pull-up Zig-Zag to +3.3V */}
            <Vcc x={588} y={28} label="+3.3V" />
            <ResV x={588} y1={36} y2={94} color="#334155" bodyH={28} />
            <circle cx="588" cy="94" r="2.5" fill="#334155" />
            <text x="598" y="66" className="fill-slate-800 text-[8.2px] font-mono font-semibold">4.7k</text>

            <line x1="558" y1="94" x2="722" y2="94" stroke="#334155" strokeWidth="1.6" markerEnd={`url(#arrow-${topologyId})`} />
            <text x="656" y="84" textAnchor="middle" className="fill-slate-800 text-[8.8px] font-mono font-semibold">
              COMP_IN (GPIO)
            </text>

            <polyline points="722,226 264,226 264,196 276,196" fill="none" stroke="#e11d48" strokeWidth="1.4" strokeDasharray="4 2" />
            <text x="580" y="218" textAnchor="middle" className="fill-rose-700 text-[8.6px] font-mono font-semibold">
              PWM_OUT (Conflicts w/ PUMP2 GPIO 19)
            </text>
          </g>
        )}

        {/* RIGHT ZONE (724..888): Raspberry Pi 40-Pin Header */}
        <rect
          x="724"
          y="30"
          width="162"
          height="226"
          rx="6"
          fill="#ffffff"
          stroke={isStale ? '#e11d48' : '#cbd5e1'}
          strokeWidth={isStale ? '1.8' : '1.3'}
        />
        <rect x="724" y="30" width="162" height="28" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.1" />
        <text x="805" y="48" textAnchor="middle" className="fill-slate-900 text-[10px] font-mono font-bold">
          RASPBERRY PI 3 / 4 / 5
        </text>
        <text x="805" y="80" textAnchor="middle" className="fill-slate-900 text-[10px] font-mono font-semibold">
          {spec.interfacePins.split(' (')[0]}
        </text>
        <text x="805" y="100" textAnchor="middle" className="fill-slate-500 text-[9px] font-mono">
          {params ? `${params.pollIntervalS}s Daemon Poll` : '10s Async Poll'}
        </text>

        <rect
          x="736"
          y="118"
          width="138"
          height="60"
          rx="4"
          fill={result && params?.activeFault !== 'none' ? '#fff1f2' : '#f8fafc'}
          stroke={result && params?.activeFault !== 'none' ? '#e11d48' : '#e2e8f0'}
        />
        <text x="805" y="138" textAnchor="middle" className="fill-slate-500 text-[8.8px] font-mono">
          {result ? result.digitalReadoutLabel : 'Resolution'}
        </text>
        <text
          x="805"
          y="158"
          textAnchor="middle"
          className="fill-slate-900 text-[10px] font-mono font-semibold tabular-nums"
        >
          {result
            ? result.digitalReadoutValue.length > 20
              ? result.digitalReadoutValue.slice(0, 20) + '…'
              : result.digitalReadoutValue
            : `±${spec.resolutionK} K / step`}
        </text>

        <text x="805" y="206" textAnchor="middle" className="fill-slate-700 text-[9px] font-mono tabular-nums">
          BOM: €{spec.partCostEur.toFixed(2)} · Fee: €{spec.jlcpcbFeederFeeEur.toFixed(2)}
        </text>
        <text x="805" y="226" textAnchor="middle" className="fill-slate-500 text-[8.8px] font-mono">
          {spec.handSolderability}
        </text>
      </svg>
    </div>
  );
};
