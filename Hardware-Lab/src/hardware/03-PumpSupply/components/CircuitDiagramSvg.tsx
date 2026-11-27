import React from 'react';
import { PumpTopologyId } from '../physics/model';

interface PumpCircuitSvgProps {
  topologyId: PumpTopologyId;
  compact?: boolean;
}

// Reusable IEEE/IEC schematic primitives in clean technical line art
const Gnd: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke="#334155" strokeWidth="1.3" fill="none">
    <line x1={x} y1={y} x2={x} y2={y + 6} />
    <line x1={x - 7} y1={y + 6} x2={x + 7} y2={y + 6} />
    <line x1={x - 4.5} y1={y + 9.5} x2={x + 4.5} y2={y + 9.5} />
    <line x1={x - 2} y1={y + 13} x2={x + 2} y2={y + 13} />
  </g>
);

const Rail5V: React.FC<{ x: number; y: number; label?: string }> = ({
  x,
  y,
  label = '+5V',
}) => (
  <g>
    <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke="#2563eb" strokeWidth="1.6" />
    <line x1={x} y1={y} x2={x} y2={y + 6} stroke="#2563eb" strokeWidth="1.3" />
    <text
      x={x}
      y={y - 3.5}
      textAnchor="middle"
      className="fill-blue-700 text-[8.2px] font-mono font-bold"
    >
      {label}
    </text>
  </g>
);

const Dot: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#334155',
}) => <circle cx={x} cy={y} r="2.3" fill={color} />;

// Horizontal resistor centered at (x, y), total span 32px (x-16 .. x+16)
const ResH: React.FC<{
  x: number;
  y: number;
  label: string;
  sub?: string;
  stroke?: string;
}> = ({ x, y, label, sub, stroke = '#334155' }) => (
  <g>
    <rect
      x={x - 16}
      y={y - 5.5}
      width="32"
      height="11"
      rx="1.5"
      fill="#ffffff"
      stroke={stroke}
      strokeWidth="1.25"
    />
    <text
      x={x}
      y={y - 8.5}
      textAnchor="middle"
      className="fill-slate-800 text-[7.8px] font-mono font-semibold"
    >
      {label}
    </text>
    {sub && (
      <text
        x={x}
        y={y + 13.5}
        textAnchor="middle"
        className="fill-slate-500 text-[7px] font-mono"
      >
        {sub}
      </text>
    )}
  </g>
);

// Vertical resistor centered at (x, y), total span 26px (y-13 .. y+13)
const ResV: React.FC<{
  x: number;
  y: number;
  label: string;
  side?: 'left' | 'right';
  stroke?: string;
}> = ({ x, y, label, side = 'right', stroke = '#334155' }) => (
  <g>
    <rect
      x={x - 5}
      y={y - 13}
      width="10"
      height="26"
      rx="1.5"
      fill="#ffffff"
      stroke={stroke}
      strokeWidth="1.25"
    />
    <text
      x={side === 'right' ? x + 8 : x - 8}
      y={y + 3}
      textAnchor={side === 'right' ? 'start' : 'end'}
      className="fill-slate-800 text-[7.6px] font-mono font-semibold"
    >
      {label}
    </text>
  </g>
);

// Horizontal capacitor centered at (x, y), leads connect at x-4 and x+4
const CapH: React.FC<{ x: number; y: number; label: string; sub?: string }> = ({
  x,
  y,
  label,
  sub,
}) => (
  <g>
    <line x1={x - 3.5} y1={y - 10} x2={x - 3.5} y2={y + 10} stroke="#0f172a" strokeWidth="1.7" />
    <line x1={x + 3.5} y1={y - 10} x2={x + 3.5} y2={y + 10} stroke="#0f172a" strokeWidth="1.7" />
    <text
      x={x}
      y={y - 13}
      textAnchor="middle"
      className="fill-slate-900 text-[7.8px] font-mono font-semibold"
    >
      {label}
    </text>
    {sub && (
      <text
        x={x}
        y={y + 19}
        textAnchor="middle"
        className="fill-slate-500 text-[7px] font-mono"
      >
        {sub}
      </text>
    )}
  </g>
);

// Vertical capacitor centered at (x, y), leads connect at y-3.5 and y+3.5
const CapV: React.FC<{
  x: number;
  y: number;
  label: string;
  side?: 'left' | 'right';
}> = ({ x, y, label, side = 'right' }) => (
  <g>
    <line x1={x - 9} y1={y - 3.5} x2={x + 9} y2={y - 3.5} stroke="#0f172a" strokeWidth="1.7" />
    <line x1={x - 9} y1={y + 3.5} x2={x + 9} y2={y + 3.5} stroke="#0f172a" strokeWidth="1.7" />
    <text
      x={side === 'right' ? x + 12 : x - 12}
      y={y + 3}
      textAnchor={side === 'right' ? 'start' : 'end'}
      className="fill-slate-800 text-[7.6px] font-mono font-semibold"
    >
      {label}
    </text>
  </g>
);

// Horizontal diode pointing right (anode x-8, cathode x+8)
const DiodeH: React.FC<{
  x: number;
  y: number;
  label: string;
  schottky?: boolean;
  color?: string;
}> = ({ x, y, label, schottky = false, color = '#0f172a' }) => (
  <g>
    <polygon
      points={`${x - 7},${y - 7} ${x - 7},${y + 7} ${x + 6},${y}`}
      fill={schottky ? '#ecfdf5' : '#ffffff'}
      stroke={color}
      strokeWidth="1.35"
    />
    <line x1={x + 6} y1={y - 7.5} x2={x + 6} y2={y + 7.5} stroke={color} strokeWidth="1.5" />
    {schottky && (
      <>
        <polyline
          points={`${x + 6},${y - 7.5} ${x + 9.5},${y - 7.5} ${x + 9.5},${y - 4.5}`}
          fill="none"
          stroke={color}
          strokeWidth="1.3"
        />
        <polyline
          points={`${x + 6},${y + 7.5} ${x + 2.5},${y + 7.5} ${x + 2.5},${y + 4.5}`}
          fill="none"
          stroke={color}
          strokeWidth="1.3"
        />
      </>
    )}
    <text
      x={x}
      y={y - 11}
      textAnchor="middle"
      className={`text-[7.6px] font-mono font-semibold ${
        schottky ? 'fill-emerald-800' : 'fill-slate-800'
      }`}
    >
      {label}
    </text>
  </g>
);

// NPN or PNP transistor centered at (x, y): base enters left at (x-14, y), top terminal at (x+6, y-14), bottom at (x+6, y+14)
const BjtSymbol: React.FC<{
  x: number;
  y: number;
  type: 'NPN' | 'PNP';
  label: string;
  sub?: string;
  labelSide?: 'right' | 'left';
}> = ({ x, y, type, label, sub, labelSide = 'right' }) => (
  <g>
    <circle cx={x} cy={y} r="13" fill="#ffffff" stroke="#475569" strokeWidth="1.15" />
    {/* Base bar */}
    <line x1={x - 5} y1={y - 7.5} x2={x - 5} y2={y + 7.5} stroke="#0f172a" strokeWidth="2" />
    {/* Base lead */}
    <line x1={x - 14} y1={y} x2={x - 5} y2={y} stroke="#334155" strokeWidth="1.3" />
    {/* Top leg */}
    <polyline points={`${x - 5},${y - 3.5} ${x + 6},${y - 9.5} ${x + 6},${y - 14}`} fill="none" stroke="#334155" strokeWidth="1.3" />
    {/* Bottom leg */}
    <polyline points={`${x - 5},${y + 3.5} ${x + 6},${y + 9.5} ${x + 6},${y + 14}`} fill="none" stroke="#334155" strokeWidth="1.3" />
    {/* Emitter arrow */}
    {type === 'NPN' ? (
      <polygon
        points={`${x + 4.5},${y + 8.7} ${x + 0.2},${y + 8.6} ${x + 2.2},${y + 5.2}`}
        fill="#0f172a"
      />
    ) : (
      <polygon
        points={`${x - 3.2},${y - 4.4} ${x + 1.1},${y - 4.3} ${x - 0.8},${y - 7.8}`}
        fill="#0f172a"
      />
    )}
    <text
      x={labelSide === 'right' ? x + 16 : x - 16}
      y={y - 1}
      textAnchor={labelSide === 'right' ? 'start' : 'end'}
      className="fill-slate-900 text-[7.8px] font-mono font-bold"
    >
      {label}
    </text>
    {sub && (
      <text
        x={labelSide === 'right' ? x + 16 : x - 16}
        y={y + 8.5}
        textAnchor={labelSide === 'right' ? 'start' : 'end'}
        className="fill-slate-500 text-[6.8px] font-mono"
      >
        {sub}
      </text>
    )}
  </g>
);

// Reusable Right-Side H3 Pump Output Stage (Real Component Schematic)
const H3OutputStage: React.FC<{ topologyId: PumpTopologyId }> = ({ topologyId }) => {
  const r9Val =
    topologyId === 'b0512s'
      ? '470Ω 0.5W'
      : topologyId === 'mt3608_boost' || topologyId === 'lm393_schottky_doubler'
      ? '220Ω 0.5W'
      : '100Ω 0.5W';
  const r31Val =
    topologyId === 'b0512s' || topologyId === 'mt3608_boost'
      ? 'R31 27k'
      : topologyId === 'lm393_schottky_doubler'
      ? 'R31 22k'
      : topologyId === 'direct_5v'
      ? 'R31 6.8k'
      : 'R31 12k';
  const r32Val = topologyId === 'lm393_schottky_doubler' ? 'R32 10k' : 'R32 8.2k';
  const tvsVal = topologyId === 'direct_5v' ? 'SMBJ6.0A' : 'SMBJ13A';

  return (
    <g>
      {/* Container */}
      <rect
        x="634"
        y="12"
        width="234"
        height="274"
        rx="6"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.2"
      />
      <text
        x="751"
        y="28"
        textAnchor="middle"
        className="fill-slate-500 text-[9px] font-mono font-semibold uppercase"
      >
        H3 Driver Stage &amp; J2 PUMP1
      </text>

      {/* Incoming +V_DRV into Q6 PNP Emitter (high-side switch) */}
      <line x1="634" y1="68" x2="674" y2="68" stroke="#0f172a" strokeWidth="1.6" />
      <Dot x={674} y={68} />
      {/* Q6 PNP Switch */}
      <rect
        x="662"
        y="48"
        width="46"
        height="40"
        rx="4"
        fill="#ffffff"
        stroke="#334155"
        strokeWidth="1.3"
      />
      <text x="685" y="64" textAnchor="middle" className="fill-slate-900 text-[8.5px] font-mono font-bold">
        Q6 PNP
      </text>
      <text x="685" y="76" textAnchor="middle" className="fill-slate-600 text-[7px] font-mono">
        MMBT3906
      </text>
      {/* Gate drive from Q4/Q5 Watchdog */}
      <line x1="685" y1="88" x2="685" y2="114" stroke="#475569" strokeWidth="1.2" />
      <rect x="646" y="114" width="78" height="30" rx="3" fill="#ecfdf5" stroke="#059669" strokeWidth="1.1" />
      <text x="685" y="126.5" textAnchor="middle" className="fill-emerald-900 text-[7.5px] font-mono font-bold">
        Q4 PWM + Q5 WD
      </text>
      <text x="685" y="138" textAnchor="middle" className="fill-slate-600 text-[6.8px] font-mono">
        GPIO18 · WD_OK
      </text>

      {/* Q6 Collector -> R9 -> J2 PUMP1 */}
      <line x1="708" y1="68" x2="732" y2="68" stroke="#0f172a" strokeWidth="1.6" />
      <ResH x={748} y={68} label="R9" sub={r9Val} stroke="#0f172a" />
      <line x1="764" y1="68" x2="804" y2="68" stroke="#0f172a" strokeWidth="1.6" />
      <Dot x={786} y={68} />

      {/* J2 PUMP1 Terminal Block */}
      <rect x="804" y="50" width="54" height="38" rx="4" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.4" />
      <text x="831" y="65" textAnchor="middle" className="fill-blue-900 text-[8.5px] font-mono font-bold">
        J2 PUMP1
      </text>
      <text x="831" y="78" textAnchor="middle" className="fill-blue-700 text-[7.2px] font-mono">
        ≥4.0 V PWM
      </text>

      {/* TVS Diode to GND off J2 node */}
      <line x1="786" y1="68" x2="786" y2="108" stroke="#334155" strokeWidth="1.3" />
      <Dot x={786} y={108} />
      {/* Bidirectional TVS symbol */}
      <line x1="786" y1="108" x2="824" y2="108" stroke="#334155" strokeWidth="1.2" />
      <line x1="824" y1="108" x2="824" y2="122" stroke="#334155" strokeWidth="1.2" />
      <polygon points="819,122 829,122 824,130" fill="#ffffff" stroke="#334155" strokeWidth="1.15" />
      <polygon points="819,138 829,138 824,130" fill="#ffffff" stroke="#334155" strokeWidth="1.15" />
      <line x1="818" y1="130" x2="830" y2="130" stroke="#334155" strokeWidth="1.3" />
      <line x1="824" y1="138" x2="824" y2="148" stroke="#334155" strokeWidth="1.2" />
      <Gnd x={824} y={148} />
      <text x="833" y="133" textAnchor="start" className="fill-slate-700 text-[7px] font-mono font-semibold">
        {tvsVal}
      </text>

      {/* Readback Divider R31 / R32 -> GPIO 6 */}
      <line x1="786" y1="108" x2="786" y2="146" stroke="#2563eb" strokeWidth="1.3" />
      <ResV x={786} y={159} label={r31Val} side="left" stroke="#2563eb" />
      <line x1="786" y1="172" x2="786" y2="206" stroke="#2563eb" strokeWidth="1.3" />
      <Dot x={786} y={190} color="#2563eb" />
      <ResV x={786} y={219} label={r32Val} side="left" stroke="#2563eb" />
      <line x1="786" y1="232" x2="786" y2="246" stroke="#334155" strokeWidth="1.2" />
      <Gnd x={786} y={246} />

      {/* GPIO 6 Output Tap */}
      <line x1="786" y1="190" x2="808" y2="190" stroke="#2563eb" strokeWidth="1.4" />
      <rect x="808" y="177" width="52" height="26" rx="3" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.2" />
      <text x="834" y="189" textAnchor="middle" className="fill-blue-900 text-[7.8px] font-mono font-bold">
        GPIO 6
      </text>
      <text x="834" y="199" textAnchor="middle" className="fill-blue-700 text-[6.8px] font-mono">
        Readback
      </text>

      {/* Bottom R38 pull-down note */}
      <text x="708" y="274" textAnchor="middle" className="fill-slate-500 text-[7.2px] font-mono">
        0 V = Stop · R38 10k PD · GND = Pi GND
      </text>
    </g>
  );
};

export const PumpCircuitSvg: React.FC<PumpCircuitSvgProps> = ({
  topologyId,
  compact = false,
}) => {
  return (
    <div className="w-full overflow-x-auto bg-white rounded-md border border-slate-200 p-2">
      <svg
        viewBox="0 0 880 300"
        className={`w-full h-auto ${compact ? 'max-h-[270px]' : 'max-h-[340px]'}`}
        role="img"
        aria-label={`Component-level schematic for ${topologyId}`}
      >
        {/* Main Supply Stage Container */}
        <rect
          x="12"
          y="12"
          width="612"
          height="274"
          rx="6"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />
        <text
          x="318"
          y="28"
          textAnchor="middle"
          className="fill-slate-500 text-[9px] font-mono font-semibold uppercase"
        >
          {topologyId === 'lm393_schottky_doubler' &&
            'Locked Rev E (16 Parts): U3A LM393DR2G 62 kHz Schmitt → Q17/Q18 CMOS + R60A∥B 50Ω → C22 + 2× SS14 Doubler'}
          {topologyId === 'd25_bjt_doubler' &&
            'Claude D25 Schematic: Q15/Q16 15 kHz BJT Astable → Q17/Q18 Follower → C22 + 2× 1N4148W Silicon Doubler'}
          {topologyId === 'b0512s' &&
            'Original Rev A Schematic: B0512S-1WR3 5 V → 12 V Isolated SIP-4 Brick (0V_OUT Tied to Pi GND)'}
          {topologyId === 'mt3608_boost' &&
            'MT3608 1.2 MHz Inductive Boost Schematic: L1 22 µH + SOT-23-6 + SS14 + 100k/6.34k Feedback'}
          {topologyId === 'direct_5v' &&
            'Former 1-Wire Lite (Rev B) Schematic: Direct Pi +5 V Rail via R26 0 Ω Jumper'}
        </text>

        {/* Right-hand real component H3 output stage */}
        <H3OutputStage topologyId={topologyId} />

        {/* =====================================================================
            TOPOLOGY 1: AUDITED REV D — 14-PART LM393 (U3A) + SS14 SCHOTTKY DOUBLER
           ===================================================================== */}
        {topologyId === 'lm393_schottky_doubler' && (
          <g>
            {/* Pi +5V Rail Entry & Local LM393 Decoupling */}
            <Rail5V x={46} y={54} label="+5V_PI" />
            <line x1="46" y1="60" x2="46" y2="98.5" stroke="#2563eb" strokeWidth="1.4" />
            <CapV x={46} y={102} label="C21 100n" side="right" />
            <line x1="46" y1="105.5" x2="46" y2="132" stroke="#334155" strokeWidth="1.2" />
            <Gnd x={46} y={132} />

            {/* --- STAGE 1: U3A 60 kHz Schmitt Relaxation Oscillator (Direct Drive) --- */}
            {/* R54 (100k to +5V) & R55 (47k to GND) -> U3A (+) Pin 3 */}
            <Rail5V x={136} y={54} />
            <line x1="136" y1="60" x2="136" y2="66" stroke="#334155" strokeWidth="1.2" />
            <ResV x={136} y={79} label="R54 100k" side="left" />
            <line x1="136" y1="92" x2="136" y2="112" stroke="#334155" strokeWidth="1.3" />
            <Dot x={136} y={104} />
            <ResV x={136} y={125} label="R55 47k" side="left" />
            <line x1="136" y1="138" x2="136" y2="152" stroke="#334155" strokeWidth="1.2" />
            <Gnd x={136} y={152} />

            {/* Wire into U3A (+) */}
            <line x1="136" y1="104" x2="168" y2="104" stroke="#334155" strokeWidth="1.3" />

            {/* U3A Comparator Triangle */}
            <polygon
              points="168,84 168,150 228,117"
              fill="#ecfdf5"
              stroke="#059669"
              strokeWidth="1.5"
            />
            <text x="175" y="108" className="fill-slate-900 text-[10px] font-mono font-bold">+</text>
            <text x="175" y="136" className="fill-slate-900 text-[10px] font-mono font-bold">−</text>
            <text x="194" y="120" textAnchor="middle" className="fill-emerald-900 text-[8.8px] font-mono font-bold">
              U3A
            </text>
            <text x="196" y="77" textAnchor="middle" className="fill-emerald-800 text-[7.6px] font-mono font-semibold">
              LM393 (60 kHz)
            </text>

            {/* R59 1.5k datasheet-safe pull-up on U3A OUT (<=3.5 mA sink @ 5.25 V) */}
            <Rail5V x={252} y={54} />
            <line x1="252" y1="60" x2="252" y2="66" stroke="#059669" strokeWidth="1.3" />
            <ResV x={252} y={79} label="R59 1.5k" side="right" stroke="#059669" />
            <line x1="252" y1="92" x2="252" y2="117" stroke="#059669" strokeWidth="1.4" />
            <Dot x={252} y={117} color="#059669" />
            <text x="260" y="96" className="fill-emerald-700 text-[6.8px] font-mono">
              ≤3.5 mA sink
            </text>

            {/* Hysteresis R56 (100k) from U3A OUT back over top to U3A (+) */}
            <polyline
              points="252,117 252,52 150,52 150,104"
              fill="none"
              stroke="#059669"
              strokeWidth="1.15"
              strokeDasharray="3 2"
            />
            <ResH x={200} y={52} label="R56 100k" stroke="#059669" />
            <Dot x={150} y={104} color="#059669" />

            {/* RC Timing R58 (15k, shared reel w/ R31) + C20 (1 nF X7R Basic) from U3A OUT to U3A (-) */}
            <polyline
              points="252,117 252,182 150,182 150,132 168,132"
              fill="none"
              stroke="#334155"
              strokeWidth="1.3"
            />
            <ResH x={200} y={182} label="R58 15k" sub="= R31 reel" />
            <Dot x={150} y={182} />
            <line x1="150" y1="182" x2="150" y2="202" stroke="#334155" strokeWidth="1.3" />
            <CapV x={150} y={205.5} label="C20 1nF X7R" side="right" />
            <line x1="150" y1="209" x2="150" y2="224" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={150} y={224} />

            {/* Unused U3B Quiet Tie-Off Note Box */}
            <rect
              x="252"
              y="196"
              width="112"
              height="42"
              rx="4"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            <text x="308" y="209" textAnchor="middle" className="fill-slate-700 text-[7.4px] font-mono font-bold">
              U3B (Unused Tie-Off)
            </text>
            <text x="308" y="221" textAnchor="middle" className="fill-slate-600 text-[6.9px] font-mono">
              Pin 5 (+) → +5V · Pin 6 (−) → GND
            </text>
            <text x="308" y="232" textAnchor="middle" className="fill-slate-500 text-[6.7px] font-mono">
              Pin 7 (OUTB) → NC (quiet)
            </text>

            {/* --- STAGE 2: Rail-to-Rail CMOS Q17 (AO3401A) / Q18 (AO3400A) + R60A||B 50Ω Damper --- */}
            <line x1="228" y1="117" x2="348" y2="117" stroke="#059669" strokeWidth="1.5" />
            <Dot x={348} y={117} color="#059669" />
            <polyline points="348,117 348,96 364,96" fill="none" stroke="#334155" strokeWidth="1.3" />
            <polyline points="348,117 348,166 364,166" fill="none" stroke="#334155" strokeWidth="1.3" />

            {/* R60A||B (2x 100Ω 1206 Basic = 50Ω) Shoot-Through Damper -> Q17 P-MOSFET (AO3401A) */}
            <Rail5V x={384} y={40} />
            <line x1="384" y1="46" x2="384" y2="52" stroke="#334155" strokeWidth="1.3" />
            <ResV x={384} y={64} label="R60A∥B 50Ω" side="right" stroke="#059669" />
            <line x1="384" y1="76" x2="384" y2="82" stroke="#334155" strokeWidth="1.3" />
            <BjtSymbol x={378} y={96} type="PNP" label="Q17" sub="AO3401A" />

            {/* Q18 N-MOSFET (AO3400A) */}
            <BjtSymbol x={378} y={166} type="NPN" label="Q18" sub="AO3400A" />
            <line x1="384" y1="180" x2="384" y2="210" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={384} y={210} />

            {/* Tied Drains -> Rail-to-Rail SW Node */}
            <line x1="384" y1="110" x2="384" y2="152" stroke="#059669" strokeWidth="1.6" />
            <Dot x={384} y={126} color="#059669" />

            {/* --- STAGE 3: C22 + D21/D22 SS14 Schottky Doubler + C23 --- */}
            <line x1="384" y1="126" x2="454.5" y2="126" stroke="#059669" strokeWidth="1.6" />
            <CapH x={458} y={126} label="C22 4.7µF" sub="16V X7R" />
            <line x1="461.5" y1="126" x2="512" y2="126" stroke="#059669" strokeWidth="1.6" />
            <polyline points="512,126 512,68" fill="none" stroke="#059669" strokeWidth="1.6" />
            <Dot x={512} y={68} color="#059669" />
            <text x="512" y="138" textAnchor="middle" className="fill-slate-600 text-[7.2px] font-mono">
              Node A
            </text>

            {/* D21 SS14 (+5V -> Node A) */}
            <Rail5V x={462} y={54} label="+5V" />
            <line x1="462" y1="60" x2="462" y2="68" stroke="#2563eb" strokeWidth="1.4" />
            <line x1="462" y1="68" x2="480" y2="68" stroke="#059669" strokeWidth="1.5" />
            <DiodeH x={487} y={68} label="D21 SS14" schottky color="#059669" />
            <line x1="493" y1="68" x2="512" y2="68" stroke="#059669" strokeWidth="1.5" />

            {/* D22 SS14 (Node A -> +V_DRV) */}
            <line x1="512" y1="68" x2="544" y2="68" stroke="#059669" strokeWidth="1.6" />
            <DiodeH x={551} y={68} label="D22 SS14" schottky color="#059669" />
            <line x1="557" y1="68" x2="634" y2="68" stroke="#059669" strokeWidth="1.7" />
            <Dot x={586} y={68} color="#059669" />
            <text x="608" y="60" textAnchor="middle" className="fill-emerald-900 text-[8.2px] font-mono font-bold">
              +V_DRV (9.21V)
            </text>

            {/* Output Reservoir Cap C23 10uF */}
            <line x1="586" y1="68" x2="586" y2="122.5" stroke="#334155" strokeWidth="1.4" />
            <CapV x={586} y={126} label="C23 10µF" side="left" />
            <line x1="586" y1="129.5" x2="586" y2="176" stroke="#334155" strokeWidth="1.4" />
            <Gnd x={586} y={176} />

            {/* Engineering Footer Bar */}
            <rect x="24" y="254" width="588" height="24" rx="4" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
            <text x="318" y="269" textAnchor="middle" className="fill-emerald-900 text-[7.8px] font-mono font-semibold">
              Locked Rev E (TI LM393 ngspice-39) · 16 Parts · AO3401A/AO3400A + R60A∥B 50Ω · +9.18 V Nom / +7.98 V UVLO (D18)
            </text>
          </g>
        )}

        {/* =====================================================================
            TOPOLOGY 2: CLAUDE D25 — 4-BJT ASTABLE VOLTAGE DOUBLER
           ===================================================================== */}
        {topologyId === 'd25_bjt_doubler' && (
          <g>
            {/* Common +5V Top Bus for Astable */}
            <Rail5V x={42} y={54} label="+5V_PI" />
            <line x1="42" y1="60" x2="290" y2="60" stroke="#2563eb" strokeWidth="1.5" />

            {/* Left leg: R54 1k -> Q15 Collector */}
            <Dot x={68} y={60} color="#2563eb" />
            <line x1="68" y1="60" x2="68" y2="70" stroke="#334155" strokeWidth="1.2" />
            <ResV x={68} y={83} label="R54 1k" side="left" />
            <line x1="68" y1="96" x2="68" y2="146" stroke="#334155" strokeWidth="1.3" />
            <Dot x={68} y={118} />
            <BjtSymbol x={62} y={160} type="NPN" label="Q15" sub="3904" labelSide="left" />
            <line x1="68" y1="174" x2="68" y2="210" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={68} y={210} />

            {/* Middle base bias resistors R56 10k & R57 10k */}
            <Dot x={132} y={60} color="#2563eb" />
            <line x1="132" y1="60" x2="132" y2="70" stroke="#334155" strokeWidth="1.2" />
            <ResV x={132} y={83} label="R56 10k" side="left" />
            <line x1="132" y1="96" x2="132" y2="160" stroke="#334155" strokeWidth="1.2" />

            <Dot x={198} y={60} color="#2563eb" />
            <line x1="198" y1="60" x2="198" y2="70" stroke="#334155" strokeWidth="1.2" />
            <ResV x={198} y={83} label="R57 10k" side="right" />
            <line x1="198" y1="96" x2="198" y2="160" stroke="#334155" strokeWidth="1.2" />

            {/* Right leg: R55 1k -> Q16 Collector */}
            <Dot x={274} y={60} color="#2563eb" />
            <line x1="274" y1="60" x2="274" y2="70" stroke="#334155" strokeWidth="1.2" />
            <ResV x={274} y={83} label="R55 1k" side="right" stroke="#e11d48" />
            <line x1="274" y1="96" x2="274" y2="146" stroke="#334155" strokeWidth="1.3" />
            <Dot x={274} y={118} />
            <BjtSymbol x={268} y={160} type="NPN" label="Q16" sub="3904" labelSide="right" />
            <line x1="274" y1="174" x2="274" y2="210" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={274} y={210} />

            {/* Cross-coupling Capacitors C20 (4.7nF) & C21 (4.7nF) */}
            {/* Q15 Coll (68,118) -> C20 -> Q16 Base (254,160) */}
            <line x1="68" y1="118" x2="108" y2="118" stroke="#e11d48" strokeWidth="1.3" />
            <CapH x={111.5} y={118} label="C20 4.7n" />
            <polyline points="115,118 198,160 254,160" fill="none" stroke="#e11d48" strokeWidth="1.25" />
            <Dot x={198} y={160} color="#e11d48" />

            {/* Q16 Coll (274,118) -> C21 -> Q15 Base (48,160) */}
            <line x1="274" y1="118" x2="226" y2="118" stroke="#d97706" strokeWidth="1.3" />
            <CapH x={222.5} y={118} label="C21 4.7n" />
            <polyline points="219,118 132,160 48,160" fill="none" stroke="#d97706" strokeWidth="1.25" />
            <Dot x={132} y={160} color="#d97706" />

            {/* Warning tag on astable */}
            <text x="170" y="236" textAnchor="middle" className="fill-rose-700 text-[7.6px] font-mono font-semibold">
              15 kHz Astable: slow-ramp latch-up &amp; −4.5 V V_EBO kicks
            </text>

            {/* Tap Q16 Collector -> Q17/Q18 Emitter Follower */}
            <line x1="274" y1="126" x2="366" y2="126" stroke="#334155" strokeWidth="1.5" />
            <Dot x={274} y={126} />
            <Dot x={366} y={126} />
            <polyline points="366,126 366,88 380,88" fill="none" stroke="#334155" strokeWidth="1.3" />
            <polyline points="366,126 366,164 380,164" fill="none" stroke="#334155" strokeWidth="1.3" />

            <Rail5V x={400} y={54} />
            <line x1="400" y1="60" x2="400" y2="74" stroke="#334155" strokeWidth="1.3" />
            <BjtSymbol x={394} y={88} type="NPN" label="Q17" sub="3904" />
            <BjtSymbol x={394} y={164} type="PNP" label="Q18" sub="3906" />
            <line x1="400" y1="178" x2="400" y2="210" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={400} y={210} />
            <line x1="400" y1="102" x2="400" y2="150" stroke="#334155" strokeWidth="1.6" />
            <Dot x={400} y={126} />

            {/* C22 2.2uF + 2x 1N4148W Silicon Diodes + C23 10uF */}
            <line x1="400" y1="126" x2="462.5" y2="126" stroke="#334155" strokeWidth="1.6" />
            <CapH x={466} y={126} label="C22 2.2µF" sub="R_out ~108Ω" />
            <line x1="469.5" y1="126" x2="516" y2="126" stroke="#334155" strokeWidth="1.6" />
            <line x1="516" y1="126" x2="516" y2="68" stroke="#334155" strokeWidth="1.6" />
            <Dot x={516} y={68} />

            <Rail5V x={466} y={54} label="+5V" />
            <line x1="466" y1="60" x2="466" y2="68" stroke="#2563eb" strokeWidth="1.4" />
            <line x1="466" y1="68" x2="484" y2="68" stroke="#334155" strokeWidth="1.5" />
            <DiodeH x={491} y={68} label="D21 1N4148" color="#d97706" />
            <line x1="497" y1="68" x2="516" y2="68" stroke="#334155" strokeWidth="1.5" />

            <line x1="516" y1="68" x2="546" y2="68" stroke="#334155" strokeWidth="1.6" />
            <DiodeH x={553} y={68} label="D22 1N4148" color="#d97706" />
            <line x1="559" y1="68" x2="634" y2="68" stroke="#334155" strokeWidth="1.6" />
            <Dot x={588} y={68} />
            <text x="610" y="60" textAnchor="middle" className="fill-amber-900 text-[8px] font-mono font-bold">
              +V_DRV (~7.0V)
            </text>

            <line x1="588" y1="68" x2="588" y2="122.5" stroke="#334155" strokeWidth="1.4" />
            <CapV x={588} y={126} label="C23 10µF" side="left" />
            <line x1="588" y1="129.5" x2="588" y2="176" stroke="#334155" strokeWidth="1.4" />
            <Gnd x={588} y={176} />

            <rect x="24" y="254" width="588" height="24" rx="4" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1" />
            <text x="318" y="269" textAnchor="middle" className="fill-rose-900 text-[8px] font-mono font-semibold">
              D25 Audit: −1.5 V lost in 1N4148W · R55 (1k) starves Q17 at 2× pumps (3.98 V FAIL @ 4.63 V UV) · Slow-ramp lock-up risk
            </text>
          </g>
        )}

        {/* =====================================================================
            TOPOLOGY 3: B0512S-1WR3 ISOLATED 5 V -> 12 V DC/DC BRICK
           ===================================================================== */}
        {topologyId === 'b0512s' && (
          <g>
            {/* Pi +5V -> C3 -> U2 */}
            <Rail5V x={56} y={54} label="+5V_PI" />
            <line x1="56" y1="60" x2="56" y2="86" stroke="#2563eb" strokeWidth="1.6" />
            <line x1="56" y1="86" x2="188" y2="86" stroke="#2563eb" strokeWidth="1.6" />
            <Dot x={118} y={86} color="#2563eb" />
            <line x1="118" y1="86" x2="118" y2="124.5" stroke="#334155" strokeWidth="1.3" />
            <CapV x={118} y={128} label="C3 4.7µF" side="left" />
            <line x1="118" y1="131.5" x2="118" y2="172" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={118} y={172} />

            {/* U2 B0512S-1WR3 Module with Internal Transformer */}
            <rect x="188" y="56" width="212" height="128" rx="5" fill="#fffbeb" stroke="#d97706" strokeWidth="1.6" />
            <text x="294" y="73" textAnchor="middle" className="fill-amber-900 text-[9.5px] font-mono font-bold">
              U2: B0512S-1WR3 (SIP-4 THT)
            </text>
            {/* Primary coil */}
            <path d="M 264 90 Q 274 98 264 106 Q 274 114 264 122 Q 274 130 264 138" fill="none" stroke="#92400e" strokeWidth="1.6" />
            {/* Isolation barrier lines */}
            <line x1="286" y1="88" x2="286" y2="142" stroke="#d97706" strokeWidth="1.3" strokeDasharray="3 2" />
            <line x1="294" y1="88" x2="294" y2="142" stroke="#d97706" strokeWidth="1.3" strokeDasharray="3 2" />
            {/* Secondary coil */}
            <path d="M 316 90 Q 306 98 316 106 Q 306 114 316 122 Q 306 130 316 138" fill="none" stroke="#92400e" strokeWidth="1.6" />
            <text x="202" y="90" className="fill-slate-700 text-[7.6px] font-mono font-semibold">Pin 2 (+Vin)</text>
            <text x="202" y="162" className="fill-slate-700 text-[7.6px] font-mono font-semibold">Pin 1 (GND)</text>
            <text x="394" y="72" textAnchor="end" className="fill-slate-700 text-[7.6px] font-mono font-semibold">Pin 4 (+12V)</text>
            <text x="394" y="162" textAnchor="end" className="fill-slate-700 text-[7.6px] font-mono font-semibold">Pin 3 (0V)</text>
            <text x="294" y="172" textAnchor="middle" className="fill-rose-800 text-[7.5px] font-mono font-semibold">
              1.5 kV Barrier Bypassed by R25 0 Ω!
            </text>

            {/* Primary & Secondary GND tied together! */}
            <polyline points="188,158 158,158 158,172" fill="none" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={158} y={172} />
            <polyline points="400,158 430,158 430,172" fill="none" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={430} y={172} />
            <line x1="158" y1="196" x2="430" y2="196" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="4 2" />
            <text x="294" y="208" textAnchor="middle" className="fill-rose-700 text-[7.5px] font-mono">
              Pin 3 (0V_OUT) tied directly to Pi GND (R25 0 Ω)
            </text>

            {/* +12V Output -> R2 Preload + C4 -> +V_DRV */}
            <line x1="400" y1="68" x2="634" y2="68" stroke="#0f172a" strokeWidth="1.7" />
            <Dot x={478} y={68} />
            <line x1="478" y1="68" x2="478" y2="96" stroke="#334155" strokeWidth="1.3" />
            <ResV x={478} y={109} label="R2 1.2k" side="right" stroke="#d97706" />
            <line x1="478" y1="122" x2="478" y2="172" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={478} y={172} />
            <text x="478" y="198" textAnchor="middle" className="fill-amber-800 text-[7.2px] font-mono">
              10 mA Preload
            </text>

            <Dot x={562} y={68} />
            <line x1="562" y1="68" x2="562" y2="118.5" stroke="#334155" strokeWidth="1.3" />
            <CapV x={562} y={122} label="C4 2.2µF" side="right" />
            <line x1="562" y1="125.5" x2="562" y2="172" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={562} y={172} />

            <text x="600" y="60" textAnchor="middle" className="fill-slate-900 text-[8.2px] font-mono font-bold">
              +V_DRV (~12 V)
            </text>

            <rect x="24" y="254" width="588" height="24" rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1" />
            <text x="318" y="269" textAnchor="middle" className="fill-amber-900 text-[8px] font-mono font-semibold">
              Original Rev A: Stiff 12 V, but €2.58/bd @ 2× (+€2.80 Extended/THT fee) &amp; floats to 15 V without R2 preload
            </text>
          </g>
        )}

        {/* =====================================================================
            TOPOLOGY 4: MT3608 1.2 MHz REGULATED 10 V INDUCTIVE BOOST
           ===================================================================== */}
        {topologyId === 'mt3608_boost' && (
          <g>
            {/* +5V -> C_in -> L1 (Inductor Coil) -> SW -> D21 SS14 -> C_out -> 10V */}
            <Rail5V x={52} y={54} label="+5V_PI" />
            <line x1="52" y1="60" x2="52" y2="68" stroke="#2563eb" strokeWidth="1.6" />
            <line x1="52" y1="68" x2="156" y2="68" stroke="#2563eb" strokeWidth="1.6" />
            <Dot x={100} y={68} color="#2563eb" />
            <line x1="100" y1="68" x2="100" y2="120.5" stroke="#334155" strokeWidth="1.3" />
            <CapV x={100} y={124} label="C_in 10µF" side="left" />
            <line x1="100" y1="127.5" x2="100" y2="174" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={100} y={174} />

            {/* L1 22uH Shielded Inductor Coil */}
            <path
              d="M 156 68 Q 165 52 174 68 Q 183 52 192 68 Q 201 52 210 68 Q 219 52 228 68"
              fill="none"
              stroke="#ea580c"
              strokeWidth="1.8"
            />
            <line x1="158" y1="53" x2="226" y2="53" stroke="#ea580c" strokeWidth="1.2" />
            <text x="192" y="45" textAnchor="middle" className="fill-orange-900 text-[8px] font-mono font-bold">
              L1: 22 µH (Extended +€2.80)
            </text>

            {/* SW Node -> U2 MT3608 + D21 SS14 */}
            <line x1="228" y1="68" x2="360" y2="68" stroke="#ea580c" strokeWidth="1.6" />
            <Dot x={294} y={68} color="#ea580c" />
            <line x1="294" y1="68" x2="294" y2="112" stroke="#ea580c" strokeWidth="1.5" />

            {/* U2 MT3608 SOT-23-6 IC */}
            <rect x="234" y="112" width="128" height="84" rx="4" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
            <text x="298" y="130" textAnchor="middle" className="fill-orange-900 text-[9px] font-mono font-bold">
              U2: MT3608 (SOT-23-6)
            </text>
            <text x="298" y="144" textAnchor="middle" className="fill-rose-700 text-[7.5px] font-mono font-semibold">
              Extended (+€2.80 Fee)
            </text>
            <text x="298" y="159" textAnchor="middle" className="fill-slate-700 text-[7.4px] font-mono">
              1.2 MHz PWM · V_ref 0.6 V
            </text>
            <text x="294" y="122" textAnchor="middle" className="fill-slate-500 text-[6.8px] font-mono">SW</text>
            <text x="356" y="176" textAnchor="end" className="fill-blue-800 text-[7.4px] font-mono font-bold">FB</text>
            <text x="242" y="176" textAnchor="start" className="fill-slate-700 text-[7.4px] font-mono">EN/IN</text>
            <line x1="298" y1="196" x2="298" y2="214" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={298} y={214} />

            {/* D21 SS14 Schottky */}
            <DiodeH x={368} y={68} label="D21 SS14" schottky color="#059669" />
            <line x1="374" y1="68" x2="634" y2="68" stroke="#0f172a" strokeWidth="1.7" />
            <text x="580" y="60" textAnchor="middle" className="fill-slate-900 text-[8.2px] font-mono font-bold">
              +V_DRV (10.0 V Reg.)
            </text>

            {/* Feedback Divider 100k / 6.34k */}
            <Dot x={464} y={68} />
            <line x1="464" y1="68" x2="464" y2="106" stroke="#334155" strokeWidth="1.3" />
            <ResV x={464} y={119} label="R_fb1 100k" side="right" />
            <line x1="464" y1="132" x2="464" y2="184" stroke="#334155" strokeWidth="1.3" />
            <Dot x={464} y={173} color="#2563eb" />
            <line x1="464" y1="173" x2="362" y2="173" stroke="#2563eb" strokeWidth="1.3" />
            <ResV x={464} y={197} label="R_fb2 6.34k" side="right" />
            <line x1="464" y1="210" x2="464" y2="222" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={464} y={222} />

            {/* C_out 10uF 25V */}
            <Dot x={558} y={68} />
            <line x1="558" y1="68" x2="558" y2="120.5" stroke="#334155" strokeWidth="1.3" />
            <CapV x={558} y={124} label="C_out 10µF" side="right" />
            <line x1="558" y1="127.5" x2="558" y2="174" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={558} y={174} />

            <rect x="24" y="254" width="588" height="24" rx="4" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
            <text x="318" y="269" textAnchor="middle" className="fill-orange-900 text-[8px] font-mono font-semibold">
              Regulated 10.0 V, but 2× JLCPCB Extended Fees (€5.60 → €3.08/bd @ 2×) + 1.2 MHz inductor EMI near Pt1000/1-Wire
            </text>
          </g>
        )}

        {/* =====================================================================
            TOPOLOGY 5: DIRECT PI +5 V RAIL (1-WIRE LITE, REV B)
           ===================================================================== */}
        {topologyId === 'direct_5v' && (
          <g>
            <Rail5V x={96} y={54} label="+5V_PI (4.2–5.25 V)" />
            <line x1="96" y1="60" x2="96" y2="68" stroke="#2563eb" strokeWidth="1.7" />
            <line x1="96" y1="68" x2="294" y2="68" stroke="#2563eb" strokeWidth="1.7" />
            <ResH x={310} y={68} label="R26 0 Ω" sub="Jumper" stroke="#2563eb" />
            <line x1="326" y1="68" x2="634" y2="68" stroke="#2563eb" strokeWidth="1.7" />

            <Dot x={170} y={68} color="#2563eb" />
            <line x1="170" y1="68" x2="170" y2="118.5" stroke="#334155" strokeWidth="1.3" />
            <CapV x={170} y={122} label="C_bulk 10µF" side="right" />
            <line x1="170" y1="125.5" x2="170" y2="164" stroke="#334155" strokeWidth="1.3" />
            <Gnd x={170} y={164} />

            <text x="480" y="60" textAnchor="middle" className="fill-blue-800 text-[8.4px] font-mono font-bold">
              +V_DRV = +5V_PI (No Boost)
            </text>

            <rect x="64" y="186" width="508" height="76" rx="4" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1.2" />
            <text x="318" y="208" textAnchor="middle" className="fill-rose-900 text-[9px] font-mono font-bold">
              Retired (Rev B → D25): Fails Below 4.00 V Pump Floor Under Stress + Pi UV
            </text>
            <text x="318" y="226" textAnchor="middle" className="fill-slate-700 text-[8.2px] font-mono">
              4.63 V Pi UV − 0.18 V (Q6 Vce) − 0.61 V (R9 100 Ω @ stress) = 3.84 V &lt; 4.00 V minimum!
            </text>
            <text x="318" y="244" textAnchor="middle" className="fill-slate-600 text-[8px] font-mono">
              Also forces SMBJ6.0A (3.85 nF capacitance), slowing PWM rise/fall times
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
