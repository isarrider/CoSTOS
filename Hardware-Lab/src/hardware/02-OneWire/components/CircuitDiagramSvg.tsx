import { OneWireEvalResult, OneWireTopologyId } from '../physics/model';

interface Props {
  topologyId: OneWireTopologyId;
  result: OneWireEvalResult;
  compact?: boolean;
}

/** Authentic IEEE/IEC inline schematic primitives */
function ResH({ x, y, w = 44, label, val, below = false }: { x: number; y: number; w?: number; label?: string; val?: string; below?: boolean }) {
  const lead = (w - 28) / 2;
  const x0 = x + lead;
  const d = `M ${x} ${y} L ${x0} ${y} l 2.3 -5 l 4.6 10 l 4.6 -10 l 4.6 10 l 4.6 -10 l 4.6 10 l 2.7 -5 L ${x + w} ${y}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#0f172a" strokeWidth="1.6" strokeLinejoin="round" />
      {label && (
        <text x={x + w / 2} y={below ? y + 15 : y - 10} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={x + w / 2} y={below ? y + 25 : y - 20} textAnchor="middle" fontSize="8.5" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function ResV({ x, y, h = 44, label, val, side = 'right' }: { x: number; y: number; h?: number; label?: string; val?: string; side?: 'left' | 'right' }) {
  const lead = (h - 28) / 2;
  const y0 = y + lead;
  const d = `M ${x} ${y} L ${x} ${y0} l 5 2.3 l -10 4.6 l 10 4.6 l -10 4.6 l 10 4.6 l -10 4.6 l 5 2.7 L ${x} ${y + h}`;
  const tx = side === 'right' ? x + 10 : x - 10;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <path d={d} fill="none" stroke="#0f172a" strokeWidth="1.6" strokeLinejoin="round" />
      {label && (
        <text x={tx} y={y + h / 2 - 2} textAnchor={anchor} fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={tx} y={y + h / 2 + 9} textAnchor={anchor} fontSize="8.5" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function CapV({ x, y, h = 34, label, val, side = 'right' }: { x: number; y: number; h?: number; label?: string; val?: string; side?: 'left' | 'right' }) {
  const mid = y + h / 2;
  const tx = side === 'right' ? x + 12 : x - 12;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={mid - 3.5} stroke="#0f172a" strokeWidth="1.6" />
      <line x1={x - 9} y1={mid - 3.5} x2={x + 9} y2={mid - 3.5} stroke="#0f172a" strokeWidth="2.1" />
      <line x1={x - 9} y1={mid + 3.5} x2={x + 9} y2={mid + 3.5} stroke="#0f172a" strokeWidth="2.1" />
      <line x1={x} y1={mid + 3.5} x2={x} y2={y + h} stroke="#0f172a" strokeWidth="1.6" />
      {label && (
        <text x={tx} y={mid - 2} textAnchor={anchor} fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={tx} y={mid + 9} textAnchor={anchor} fontSize="8.5" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function DiodeH({ x, y, w = 36, schottky = false, label, val }: { x: number; y: number; w?: number; schottky?: boolean; label?: string; val?: string }) {
  const cx = x + w / 2;
  return (
    <g>
      <line x1={x} y1={y} x2={cx - 7} y2={y} stroke="#0f172a" strokeWidth="1.6" />
      <polygon points={`${cx - 7},${y - 7} ${cx - 7},${y + 7} ${cx + 6},${y}`} fill="#ffffff" stroke="#0f172a" strokeWidth="1.6" />
      {schottky ? (
        <path d={`M ${cx + 3} ${y - 7} L ${cx + 6} ${y - 7} L ${cx + 6} ${y + 7} L ${cx + 9} ${y + 7}`} fill="none" stroke="#0f172a" strokeWidth="1.6" />
      ) : (
        <line x1={cx + 6} y1={y - 7} x2={cx + 6} y2={y + 7} stroke="#0f172a" strokeWidth="1.8" />
      )}
      <line x1={cx + 6} y1={y} x2={x + w} y2={y} stroke="#0f172a" strokeWidth="1.6" />
      {label && (
        <text x={cx} y={y - 12} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={cx} y={y + 18} textAnchor="middle" fontSize="8.5" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function DiodeVUp({ x, y, h = 36, schottky = false, tvs = false, label, val, side = 'right' }: { x: number; y: number; h?: number; schottky?: boolean; tvs?: boolean; label?: string; val?: string; side?: 'left' | 'right' }) {
  const cy = y + h / 2;
  const tx = side === 'right' ? x + 11 : x - 11;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={cy - 6} stroke="#0f172a" strokeWidth="1.6" />
      {tvs ? (
        <>
          <polygon points={`${x - 6},${cy - 6} ${x + 6},${cy - 6} ${x},${cy}`} fill="#ffffff" stroke="#0f172a" strokeWidth="1.4" />
          <polygon points={`${x - 6},${cy + 6} ${x + 6},${cy + 6} ${x},${cy}`} fill="#ffffff" stroke="#0f172a" strokeWidth="1.4" />
          <path d={`M ${x - 7} ${cy - 2} L ${x - 5} ${cy} L ${x + 5} ${cy} L ${x + 7} ${cy + 2}`} fill="none" stroke="#0f172a" strokeWidth="1.4" />
        </>
      ) : (
        <>
          <polygon points={`${x - 6},${cy + 6} ${x + 6},${cy + 6} ${x},${cy - 6}`} fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
          {schottky ? (
            <path d={`M ${x - 7} ${cy - 3} L ${x - 7} ${cy - 6} L ${x + 7} ${cy - 6} L ${x + 7} ${cy - 9}`} fill="none" stroke="#0f172a" strokeWidth="1.5" />
          ) : (
            <line x1={x - 6} y1={cy - 6} x2={x + 6} y2={cy - 6} stroke="#0f172a" strokeWidth="1.7" />
          )}
        </>
      )}
      <line x1={x} y1={cy + 6} x2={x} y2={y + h} stroke="#0f172a" strokeWidth="1.6" />
      {label && (
        <text x={tx} y={cy - 1} textAnchor={anchor} fontSize="9.2" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={tx} y={cy + 10} textAnchor={anchor} fontSize="8.2" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 8} stroke="#0f172a" strokeWidth="1.6" />
      <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={x - 5.5} y1={y + 12} x2={x + 5.5} y2={y + 12} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 2.5} y1={y + 16} x2={x + 2.5} y2={y + 16} stroke="#0f172a" strokeWidth="1.3" />
    </g>
  );
}

function Rail({ x, y, label, color = '#b91c1c' }: { x: number; y: number; label: string; color?: string }) {
  return (
    <g>
      <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke={color} strokeWidth="2.2" />
      <text x={x} y={y - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={color} fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

/** Horizontal N-Channel MOSFET (Source left, Drain right, Gate top) for bidirectional AN97055 level shifter */
function NmosH({ cx, cy, label, val }: { cx: number; cy: number; label: string; val: string }) {
  return (
    <g>
      {/* Gate bar on top */}
      <line x1={cx - 12} y1={cy - 14} x2={cx + 12} y2={cy - 14} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy - 28} stroke="#0f172a" strokeWidth="1.6" />
      {/* Broken channel bar */}
      <line x1={cx - 12} y1={cy - 9} x2={cx - 6} y2={cy - 9} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={cx - 3} y1={cy - 9} x2={cx + 3} y2={cy - 9} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={cx + 6} y1={cy - 9} x2={cx + 12} y2={cy - 9} stroke="#0f172a" strokeWidth="1.8" />
      {/* Source (left), Substrate center arrow, Drain (right) */}
      <path d={`M ${cx - 22} ${cy} L ${cx - 9} ${cy} L ${cx - 9} ${cy - 9}`} fill="none" stroke="#0f172a" strokeWidth="1.6" />
      <path d={`M ${cx - 9} ${cy} L ${cx} ${cy} L ${cx} ${cy - 9}`} fill="none" stroke="#0f172a" strokeWidth="1.4" />
      <polygon points={`${cx - 3},${cy - 4} ${cx + 3},${cy - 4} ${cx},${cy - 9}`} fill="#0f172a" />
      <path d={`M ${cx + 9} ${cy - 9} L ${cx + 9} ${cy} L ${cx + 22} ${cy}`} fill="none" stroke="#0f172a" strokeWidth="1.6" />
      {/* Body diode (S -> D) shown cleanly below */}
      <path d={`M ${cx - 12} ${cy} L ${cx - 12} ${cy + 10} L ${cx - 4} ${cy + 10}`} fill="none" stroke="#64748b" strokeWidth="1.1" />
      <polygon points={`${cx - 4},${cy + 6.5} ${cx - 4},${cy + 13.5} ${cx + 3},${cy + 10}`} fill="#ffffff" stroke="#64748b" strokeWidth="1.1" />
      <line x1={cx + 3} y1={cy + 6.5} x2={cx + 3} y2={cy + 13.5} stroke="#64748b" strokeWidth="1.2" />
      <path d={`M ${cx + 3} ${cy + 10} L ${cx + 12} ${cy + 10} L ${cx + 12} ${cy}`} fill="none" stroke="#64748b" strokeWidth="1.1" />
      {/* Labels */}
      <text x={cx - 15} y={cy - 4} textAnchor="end" fontSize="7.8" fill="#64748b" fontFamily="monospace">S</text>
      <text x={cx + 15} y={cy - 4} textAnchor="start" fontSize="7.8" fill="#64748b" fontFamily="monospace">D</text>
      <text x={cx + 6} y={cy - 20} textAnchor="start" fontSize="7.8" fill="#64748b" fontFamily="monospace">G</text>
      <text x={cx} y={cy + 25} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">{label}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize="8.5" fill="#0e7490" fontFamily="monospace">{val}</text>
    </g>
  );
}

function TerminalBlock({ x, y, refDes, title, pin1, startPin = 1 }: { x: number; y: number; refDes: string; title: string; pin1: string; startPin?: number }) {
  return (
    <g>
      <rect x={x} y={y} width="96" height="148" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.8" />
      <rect x={x} y={y} width="96" height="22" rx="3" fill={refDes === 'J6' ? '#15803d' : '#0f172a'} />
      <text x={x + 48} y={y + 14.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#ffffff" fontFamily="monospace">
        {refDes} ({title})
      </text>
      {[
        { py: y + 42, name: pin1, col: '#b91c1c' },
        { py: y + 86, name: 'DQ (DATA)', col: '#0e7490' },
        { py: y + 128, name: 'GND', col: '#334155' },
      ].map((p, idx) => (
        <g key={p.name}>
          <circle cx={x + 14} cy={p.py} r="6.5" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
          <line x1={x + 10} y1={p.py - 4} x2={x + 18} y2={p.py + 4} stroke="#64748b" strokeWidth="1.1" />
          <text x={x + 26} y={p.py + 3.5} fontSize="9.5" fontWeight="700" fill={p.col} fontFamily="monospace">
            {startPin + idx}: {p.name}
          </text>
        </g>
      ))}
    </g>
  );
}

export function OneWireCircuitSvg({ topologyId, result, compact = false }: Props) {
  const vSampleColor = result.piVihMarginV >= 0.3 ? '#047857' : result.piVihMarginV >= 0 ? '#b45309' : '#be123c';
  const faultColor = result.faultVerdict === 'PASS' ? '#047857' : result.faultVerdict === 'MARGINAL' ? '#b45309' : '#be123c';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900">
          Authentic IEEE Schematic — Channel A Shown (J6 Pins 3–5 · Channel B on GPIO 17 / J6 Pins 6–8 is Identical)
        </span>
        <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
          <span style={{ color: vSampleColor }} className="font-semibold">
            V_Pi(15µs) = {result.vPiAtSampleV.toFixed(2)} V
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-700">VDD = {result.sensorVddV.toFixed(2)} V</span>
          <span className="text-slate-300">·</span>
          <span style={{ color: faultColor }} className="font-semibold">
            {result.faultVerdict}
          </span>
        </div>
      </div>

      <div className={compact ? 'p-2' : 'p-4'}>
        <svg viewBox="0 0 760 285" className="w-full h-auto block select-none" role="img" aria-label="1-Wire interface schematic">
          {/* Subtle lab schematic grid background */}
          <rect x="0" y="0" width="760" height="285" fill="#ffffff" />

          {/* Raspberry Pi GPIO Block (Left) */}
          <rect x="16" y="42" width="114" height="196" rx="4" fill="#f1f5f9" stroke="#334155" strokeWidth="1.6" />
          <rect x="16" y="42" width="114" height="24" rx="3" fill="#1e293b" />
          <text x="73" y="57.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#ffffff" fontFamily="monospace">
            RASPBERRY PI
          </text>
          <text x="73" y="84" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#b91c1c" fontFamily="monospace">
            +5V (Pins 2/4)
          </text>
          <text x="73" y="114" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#c2410c" fontFamily="monospace">
            +3V3 (Pins 1/17)
          </text>
          <line x1="28" y1="128" x2="118" y2="128" stroke="#cbd5e1" strokeWidth="1" />
          <text x="73" y="152" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
            {topologyId === 'ds2482_i2c_bridge' ? 'I2C1 SDA/SCL' : 'GPIO 4 (Pin 7)'}
          </text>
          <text x="73" y="166" textAnchor="middle" fontSize="8.2" fill="#475569" fontFamily="monospace">
            {topologyId === 'ds2482_i2c_bridge' ? 'Pins 3 / 5 (3.3V)' : '1W-A (3.3V Logic)'}
          </text>
          <text x="73" y="188" textAnchor="middle" fontSize="8.2" fill="#64748b" fontFamily="monospace">
            {topologyId === 'ds2482_i2c_bridge' ? 'ds2482 / owfs' : 'w1-gpio-pi5'}
          </text>
          <text x="73" y="218" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#334155" fontFamily="monospace">
            GND (Pin 9)
          </text>

          {/* ================= TOPOLOGY 1: REV A BASELINE ================= */}
          {topologyId === 'rev_a_baseline' && (
            <g>
              {/* Shared F2 100 mA PTC Supply Path */}
              <line x1="130" y1="108" x2="250" y2="108" stroke="#c2410c" strokeWidth="1.8" />
              {/* PTC Symbol */}
              <rect x="250" y="99" width="46" height="18" fill="#fff7ed" stroke="#c2410c" strokeWidth="1.6" />
              <line x1="255" y1="115" x2="291" y2="101" stroke="#c2410c" strokeWidth="1.4" />
              <text x="273" y="92" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#c2410c" fontFamily="monospace">F2 (Shared!)</text>
              <text x="273" y="129" textAnchor="middle" fontSize="8.3" fill="#be123c" fontFamily="monospace">100 mA PTC (Ext)</text>
              <line x1="296" y1="108" x2="626" y2="108" stroke="#c2410c" strokeWidth="1.8" />
              <text x="455" y="101" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#be123c" fontFamily="monospace">
                +3V3_SENS (Feeds BOTH 1W-A &amp; 1W-B — No Rev-Block!)
              </text>

              {/* DQ Path */}
              <line x1="130" y1="158" x2="360" y2="158" stroke="#0f172a" strokeWidth="1.8" />
              <circle cx="220" cy="158" r="3" fill="#0f172a" />
              <ResV x={220} y={108} h={50} label="R27" val="4.7k" side="left" />
              <circle cx="220" cy="108" r="3" fill="#c2410c" />

              <ResH x={360} y={158} w={54} label="R29" val="100Ω 0805" />
              <line x1="414" y1="158" x2="626" y2="158" stroke="#0f172a" strokeWidth="1.8" />

              {/* PESD5V0 TVS */}
              <circle cx="510" cy="158" r="3" fill="#0f172a" />
              <DiodeVUp x={510} y={162} h={42} tvs label="D15" val="PESD5V0 (Ext)" />
              <Gnd x={510} y={204} />

              {/* GND return */}
              <line x1="130" y1="215" x2="585" y2="215" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="215" x2="585" y2="200" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="200" x2="626" y2="200" stroke="#334155" strokeWidth="1.6" />

              {/* Warning Callout */}
              <rect x="165" y="236" width="440" height="34" rx="4" fill="#fff1f2" stroke="#fda4af" strokeWidth="1" />
              <text x="385" y="251" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#9f1239" fontFamily="monospace">
                DEFECTS: Shared F2 kills both buses + 1.85A PMIC surge · 4.7kΩ fails &gt;22m
              </text>
              <text x="385" y="263" textAnchor="middle" fontSize="8.4" fill="#be123c" fontFamily="monospace">
                PESD5V0 (V_BR ~6.6V) + 100Ω injects 30-38mA into Pi 3.3V GPIO on +V_DRV/+12V fault!
              </text>

              <TerminalBlock x={626} y={70} refDes="J8" title="1W-A" pin1="3V3" />
            </g>
          )}

          {/* ================= TOPOLOGY 2: HARDENED 3.3V BASIC ================= */}
          {topologyId === 'hardened_3v3_basic' && (
            <g>
              {/* Per-Bus 22 Ohm Supply Path */}
              <line x1="130" y1="108" x2="255" y2="108" stroke="#c2410c" strokeWidth="1.8" />
              <ResH x={255} y={108} w={56} label="R64 (Per-Bus)" val="22Ω 1206 0.5W" />
              <line x1="311" y1="108" x2="626" y2="108" stroke="#c2410c" strokeWidth="1.8" />
              <circle cx="555" cy="108" r="3" fill="#c2410c" />
              <CapV x={555} y={108} h={34} label="C25" val="100nF" />
              <Gnd x={555} y={142} />
              <text x="435" y="99" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#b45309" fontFamily="monospace">
                +3V3_1WA (No SS14 room: 3.3V-0.25V &lt; 3.0V!)
              </text>

              {/* DQ Path */}
              <line x1="130" y1="176" x2="385" y2="176" stroke="#0f172a" strokeWidth="1.8" />
              <circle cx="215" cy="176" r="3" fill="#0f172a" />
              <ResV x={215} y={120} h={56} label="R61" val="2.2k" side="left" />
              <Rail x={215} y={120} label="+3V3" color="#c2410c" />

              {/* Dual B5819W Clamp to +3V3 & GND */}
              <circle cx="310" cy="176" r="3" fill="#0f172a" />
              <DiodeVUp x={310} y={128} h={48} schottky label="D24" val="B5819W" />
              <Rail x={310} y={128} label="+3V3" color="#c2410c" />
              <DiodeVUp x={310} y={176} h={42} schottky label="D25" val="B5819W" />
              <Gnd x={310} y={218} />

              <ResH x={385} y={176} w={60} label="R63" val="100Ω 0.5W" />
              <line x1="445" y1="176" x2="626" y2="176" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="600" y1="176" x2="600" y2="156" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="600" y1="156" x2="626" y2="156" stroke="#0f172a" strokeWidth="1.8" />

              {/* GND return */}
              <line x1="130" y1="215" x2="585" y2="215" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="215" x2="585" y2="198" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="198" x2="626" y2="198" stroke="#334155" strokeWidth="1.6" />

              <rect x="165" y="242" width="440" height="30" rx="4" fill="#fffbeb" stroke="#fcd34d" strokeWidth="1" />
              <text x="385" y="260" textAnchor="middle" fontSize="8.6" fontWeight="700" fill="#92400e" fontFamily="monospace">
                ZERO FEE &amp; ISOLATED BUSES, BUT: 1.1V noise margin · +12V VDD kills Pi · 150mA short
              </text>

              <TerminalBlock x={626} y={70} refDes="J6" title="1W-A" pin1="3V3" startPin={3} />
            </g>
          )}

          {/* ================= TOPOLOGY 3 & 4: 5V MOSFET LEVEL SHIFTERS (BSS138 / GEMINI REV B 2N7002) ================= */}
          {(topologyId === 'bss138_5v_shifter' || topologyId === 'gemini_rev_b_2n7002') && (
            <g>
              {/* Top Power Rail: +5V -> D26 (SS14) -> (+5V_1W_PROT tap for R62!) -> R64 (100R 0.5W) -> C25 -> J8 Pin 1 (+5V_1WA) */}
              <line x1="130" y1="80" x2="280" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <DiodeH x={280} y={80} w={42} schottky label="D26" val="SS14 (40V)" />
              <line x1="322" y1="80" x2="430" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <ResH x={430} y={80} w={54} label="R64" val="100Ω 0.5W" />
              <line x1="484" y1="80" x2="600" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <line x1="600" y1="80" x2="600" y2="112" stroke="#b91c1c" strokeWidth="1.8" />
              <line x1="600" y1="112" x2="626" y2="112" stroke="#b91c1c" strokeWidth="1.8" />
              <text x="540" y="72" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#b91c1c" fontFamily="monospace">
                +5V_1WA (47mA Short-Proof)
              </text>
              {/* Local C25 decoupling */}
              <circle cx="568" cy="80" r="3" fill="#b91c1c" />
              <CapV x={568} y={80} h={34} label="C25" val="100nF" side="left" />
              <Gnd x={568} y={114} />

              {/* Gate Bias Network */}
              {topologyId === 'gemini_rev_b_2n7002' ? (
                <g>
                  {/* Shared V_G_1W = +3V3 + V_F(D23 @ 0.71mA) = 3.92V */}
                  <circle cx="212" cy="80" r="3" fill="#b91c1c" />
                  <ResV x={212} y={80} h={40} label="R60" val="1.5k" side="left" />
                  <circle cx="212" cy="120" r="3" fill="#0e7490" />
                  {/* D23 from V_G_1W to +3V3 */}
                  <line x1="212" y1="120" x2="230" y2="120" stroke="#0e7490" strokeWidth="1.6" />
                  <DiodeH x={230} y={120} w={34} label="D23" val="1N4148W" />
                  <line x1="264" y1="120" x2="278" y2="120" stroke="#c2410c" strokeWidth="1.6" />
                  <Rail x={278} y={120} label="+3V3" color="#c2410c" />
                  {/* Wire V_G_1W to Q19 Gate */}
                  <line x1="212" y1="120" x2="212" y2="148" stroke="#0e7490" strokeWidth="1.6" />
                  <line x1="212" y1="148" x2="310" y2="148" stroke="#0e7490" strokeWidth="1.6" />
                  <text x="255" y="162" textAnchor="middle" fontSize="8.0" fontWeight="700" fill="#0e7490" fontFamily="monospace">
                    V_G_1W={(result.vGateBiasV ?? 3.92).toFixed(2)}V (+C24)
                  </text>
                </g>
              ) : (
                <g>
                  <Rail x={310} y={136} label="+3V3 Gate" color="#c2410c" />
                  <line x1="310" y1="136" x2="310" y2="148" stroke="#c2410c" strokeWidth="1.6" />
                </g>
              )}

              {/* Pi-side 3.3V Pull-up R61 (goes UPWARD to explicit +3V3 rail) */}
              <line x1="130" y1="176" x2="288" y2="176" stroke="#0f172a" strokeWidth="1.8" />
              <circle cx="166" cy="176" r="3" fill="#0f172a" />
              <ResV x={166} y={134} h={42} label="R61" val={topologyId === 'gemini_rev_b_2n7002' ? '10k' : '4.7k'} side="left" />
              <Rail x={166} y={134} label="+3V3" color="#c2410c" />

              {/* Bidirectional N-MOSFET Q19 */}
              <NmosH
                cx={310}
                cy={176}
                label="Q19"
                val={topologyId === 'gemini_rev_b_2n7002' ? '2N7002 (Basic)' : 'BSS138 (Ext)'}
              />

              {/* Field-side 5V Pull-up R62 (2.2k tapped ahead of R64 at D26 cathode!) */}
              <line x1="332" y1="176" x2="480" y2="176" stroke="#0f172a" strokeWidth="1.8" />
              <circle cx="378" cy="176" r="3" fill="#0f172a" />
              <ResV x={378} y={80} h={96} label="R62" val="2.2k" side="right" />
              <circle cx="378" cy="80" r="3" fill="#b91c1c" />

              {/* Dual 4 pF 1N4148W ESD Steering (D24 to +5V, D25 to GND) */}
              <circle cx="452" cy="176" r="3" fill="#0f172a" />
              <DiodeVUp x={452} y={134} h={42} label="D24" val="1N4148W" />
              <Rail x={452} y={134} label="+5V Bulk" color="#b91c1c" />
              <DiodeVUp x={452} y={176} h={38} label="D25" val="1N4148W" />
              <Gnd x={452} y={214} />

              {/* Field DQ Surge/Fault Limiter R63 (100 Ohm 1206 0.5W) */}
              <ResH x={480} y={176} w={58} label="R63" val="100Ω 0.5W" />
              <line x1="538" y1="176" x2="588" y2="176" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="588" y1="176" x2="588" y2="156" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="588" y1="156" x2="626" y2="156" stroke="#0f172a" strokeWidth="1.8" />

              {/* GND return */}
              <line x1="130" y1="215" x2="585" y2="215" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="215" x2="585" y2="198" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="198" x2="626" y2="198" stroke="#334155" strokeWidth="1.6" />

              {/* Status Banner */}
              <rect
                x="150"
                y="246"
                width="465"
                height="28"
                rx="4"
                fill={topologyId === 'gemini_rev_b_2n7002' ? '#ecfdf5' : '#f0f9ff'}
                stroke={topologyId === 'gemini_rev_b_2n7002' ? '#6ee7b7' : '#7dd3fc'}
                strokeWidth="1"
              />
              <text
                x="382"
                y="263"
                textAnchor="middle"
                fontSize="8.6"
                fontWeight="700"
                fill={topologyId === 'gemini_rev_b_2n7002' ? '#065f46' : '#0369a1'}
                fontFamily="monospace"
              >
                {topologyId === 'gemini_rev_b_2n7002'
                  ? 'LOCKED REV B (D18): 4.924 V prot · 48 mA short · D31/D32 shared (€0 Ext) · 40-65m · +12V DQ=5.98V/GPIO 3.30V'
                  : 'BSS138 5V SHIFTER: Full electrical protection & 60m reach · Extended part (+€2.80 fee)'}
              </text>

              <TerminalBlock x={626} y={70} refDes="J6" title="1W-A" pin1="5V" startPin={3} />
            </g>
          )}

          {/* ================= TOPOLOGY 5: DS2482 I2C HARDWARE BRIDGE ================= */}
          {topologyId === 'ds2482_i2c_bridge' && (
            <g>
              {/* Per-Bus SS14 + 100R 5V Supply */}
              <line x1="130" y1="80" x2="260" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <DiodeH x={260} y={80} w={42} schottky label="D26" val="SS14" />
              <line x1="302" y1="80" x2="365" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <ResH x={365} y={80} w={54} label="R64" val="100Ω 0.5W" />
              <line x1="419" y1="80" x2="600" y2="80" stroke="#b91c1c" strokeWidth="1.8" />
              <line x1="600" y1="80" x2="600" y2="112" stroke="#b91c1c" strokeWidth="1.8" />
              <line x1="600" y1="112" x2="626" y2="112" stroke="#b91c1c" strokeWidth="1.8" />

              {/* I2C lines into DS2482-100 IC */}
              <line x1="130" y1="150" x2="230" y2="150" stroke="#0f172a" strokeWidth="1.6" />
              <line x1="130" y1="176" x2="230" y2="176" stroke="#0f172a" strokeWidth="1.6" />
              <text x="180" y="143" textAnchor="middle" fontSize="8.3" fill="#475569" fontFamily="monospace">SDA1 (I²C)</text>
              <text x="180" y="169" textAnchor="middle" fontSize="8.3" fill="#475569" fontFamily="monospace">SCL1 (I²C)</text>

              {/* DS2482-100 IC Block */}
              <rect x="230" y="122" width="142" height="84" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.8" />
              <rect x="230" y="122" width="142" height="20" rx="3" fill="#334155" />
              <text x="301" y="135.5" textAnchor="middle" fontSize="9.2" fontWeight="700" fill="#ffffff" fontFamily="monospace">
                U10: DS2482S-100
              </text>
              <text x="301" y="157" textAnchor="middle" fontSize="8.5" fill="#0f172a" fontFamily="monospace">
                I²C → 1-Wire Master
              </text>
              <text x="301" y="172" textAnchor="middle" fontSize="8.2" fill="#047857" fontFamily="monospace">
                Active Pull-Up (APU)
              </text>
              <text x="301" y="191" textAnchor="middle" fontSize="8" fill="#be123c" fontFamily="monospace">
                NOT at JLCPCB SMT!
              </text>

              {/* IO Output -> ESD Steering -> R63 100R -> J8 DQ */}
              <line x1="372" y1="164" x2="490" y2="164" stroke="#0f172a" strokeWidth="1.8" />
              <circle cx="435" cy="164" r="3" fill="#0f172a" />
              <DiodeVUp x={435} y={122} h={42} label="D24" val="1N4148W" />
              <Rail x={435} y={122} label="+5V" color="#b91c1c" />
              <DiodeVUp x={435} y={164} h={42} label="D25" val="1N4148W" />
              <Gnd x={435} y={206} />

              <ResH x={490} y={164} w={54} label="R63" val="100Ω 0.5W" />
              <line x1="544" y1="164" x2="588" y2="164" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="588" y1="164" x2="588" y2="156" stroke="#0f172a" strokeWidth="1.8" />
              <line x1="588" y1="156" x2="626" y2="156" stroke="#0f172a" strokeWidth="1.8" />

              {/* GND return */}
              <line x1="130" y1="215" x2="585" y2="215" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="215" x2="585" y2="198" stroke="#334155" strokeWidth="1.6" />
              <line x1="585" y1="198" x2="626" y2="198" stroke="#334155" strokeWidth="1.6" />

              <rect x="165" y="244" width="440" height="28" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
              <text x="385" y="261" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155" fontFamily="monospace">
                &gt;80m reach &amp; zero Pi 5 jitter, but manual soldering + €7.65–10.45/bd + owfs/ds2482 driver
              </text>

              <TerminalBlock x={626} y={70} refDes="J6" title="1W-A" pin1="5V" startPin={3} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
