import { OutputEvalResult, OutputTopologyId } from '../physics/model';

interface Props {
  topologyId: OutputTopologyId;
  result: OutputEvalResult;
}

function ResH({ x, y, w = 44, label, val }: { x: number; y: number; w?: number; label?: string; val?: string }) {
  const lead = (w - 28) / 2;
  const x0 = x + lead;
  const d = `M ${x} ${y} L ${x0} ${y} l 2.3 -4.5 l 4.6 9 l 4.6 -9 l 4.6 9 l 4.6 -9 l 4.6 9 l 2.7 -4.5 L ${x + w} ${y}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
      {label && (
        <text x={x + w / 2} y={y - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={x + w / 2} y={y + 16} textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function ResV({ x, y, h = 38, label, val, side = 'right' }: { x: number; y: number; h?: number; label?: string; val?: string; side?: 'left' | 'right' }) {
  const body = Math.min(26, h - 10);
  const y0 = y + (h - body) / 2;
  const s = body / 6;
  const d = `M ${x} ${y} L ${x} ${y0} l 4.5 ${s * 0.5} l -9 ${s} l 9 ${s} l -9 ${s} l 9 ${s} l -9 ${s} l 4.5 ${s * 0.5} L ${x} ${y + h}`;
  const tx = side === 'right' ? x + 9 : x - 9;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <path d={d} fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
      {label && (
        <text x={tx} y={y + h / 2 - 2} textAnchor={anchor} fontSize="8.8" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={tx} y={y + h / 2 + 8} textAnchor={anchor} fontSize="7.8" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function DiodeV({
  x,
  y,
  h = 34,
  schottky = false,
  tvs = false,
  label,
  val,
  side = 'right',
}: {
  x: number;
  y: number;
  h?: number;
  schottky?: boolean;
  tvs?: boolean;
  label?: string;
  val?: string;
  side?: 'left' | 'right';
}) {
  const cy = y + h / 2;
  const tx = side === 'right' ? x + 10 : x - 10;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={cy - 5.5} stroke="#0f172a" strokeWidth="1.5" />
      {tvs ? (
        <>
          <polygon points={`${x - 5.5},${cy - 5.5} ${x + 5.5},${cy - 5.5} ${x},${cy}`} fill="#fff" stroke="#0f172a" strokeWidth="1.4" />
          <polygon points={`${x - 5.5},${cy + 5.5} ${x + 5.5},${cy + 5.5} ${x},${cy}`} fill="#fff" stroke="#0f172a" strokeWidth="1.4" />
          <path d={`M ${x - 6.5} ${cy - 2} L ${x - 4.5} ${cy} L ${x + 4.5} ${cy} L ${x + 6.5} ${cy + 2}`} fill="none" stroke="#0f172a" strokeWidth="1.3" />
        </>
      ) : (
        <>
          <polygon points={`${x - 5.5},${cy + 5.5} ${x + 5.5},${cy + 5.5} ${x},${cy - 5.5}`} fill="#fff" stroke="#0f172a" strokeWidth="1.4" />
          {schottky ? (
            <path d={`M ${x - 6.5} ${cy - 3} L ${x - 6.5} ${cy - 5.5} L ${x + 6.5} ${cy - 5.5} L ${x + 6.5} ${cy - 8}`} fill="none" stroke="#0f172a" strokeWidth="1.5" />
          ) : (
            <line x1={x - 5.5} y1={cy - 5.5} x2={x + 5.5} y2={cy - 5.5} stroke="#0f172a" strokeWidth="1.6" />
          )}
        </>
      )}
      <line x1={x} y1={cy + 5.5} x2={x} y2={y + h} stroke="#0f172a" strokeWidth="1.5" />
      {label && (
        <text x={tx} y={cy - 1} textAnchor={anchor} fontSize="8.8" fontWeight="700" fill="#0f172a" fontFamily="monospace">
          {label}
        </text>
      )}
      {val && (
        <text x={tx} y={cy + 9} textAnchor={anchor} fontSize="7.8" fill="#475569" fontFamily="monospace">
          {val}
        </text>
      )}
    </g>
  );
}

function Rail({ x, y, label, color = '#b91c1c' }: { x: number; y: number; label: string; color?: string }) {
  return (
    <g>
      <line x1={x - 9} y1={y} x2={x + 9} y2={y} stroke={color} strokeWidth="2.1" />
      <text x={x} y={y - 4.5} textAnchor="middle" fontSize="8.8" fontWeight="700" fill={color} fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 6} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 8} y1={y + 6} x2={x + 8} y2={y + 6} stroke="#0f172a" strokeWidth="1.7" />
      <line x1={x - 5} y1={y + 9.5} x2={x + 5} y2={y + 9.5} stroke="#0f172a" strokeWidth="1.4" />
      <line x1={x - 2} y1={y + 13} x2={x + 2} y2={y + 13} stroke="#0f172a" strokeWidth="1.2" />
    </g>
  );
}

/** Authentic BJT (NPN or PNP) vertical with base on left */
function BjtV({
  x,
  y,
  pnp = false,
  label,
  val,
  side = 'right',
}: {
  x: number;
  y: number;
  pnp?: boolean;
  label: string;
  val: string;
  side?: 'left' | 'right';
}) {
  const tx = side === 'right' ? x + 13 : x - 18;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <circle cx={x - 1} cy={y} r="12" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
      <line x1={x - 16} y1={y} x2={x - 5} y2={y} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 5} y1={y - 7} x2={x - 5} y2={y + 7} stroke="#0f172a" strokeWidth="2.1" />
      <line x1={x - 5} y1={y - 4} x2={x + 5} y2={y - 10} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x + 5} y1={y - 10} x2={x + 5} y2={y - 16} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 5} y1={y + 4} x2={x + 5} y2={y + 10} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x + 5} y1={y + 10} x2={x + 5} y2={y + 16} stroke="#0f172a" strokeWidth="1.5" />
      {pnp ? (
        <polygon points={`${x - 4},${y - 4.5} ${x + 1.5},${y - 9.5} ${x + 2.5},${y - 4.5}`} fill="#0f172a" />
      ) : (
        <polygon points={`${x + 4.5},${y + 9.5} ${x - 1},${y + 9} ${x + 1.5},${y + 4.5}`} fill="#0f172a" />
      )}
      <text x={tx} y={y - 2} textAnchor={anchor} fontSize="8.8" fontWeight="700" fill="#0f172a" fontFamily="monospace">
        {label}
      </text>
      <text x={tx} y={y + 8.5} textAnchor={anchor} fontSize="7.6" fill="#0e7490" fontFamily="monospace">
        {val}
      </text>
    </g>
  );
}

/** Authentic Vertical N-MOSFET (Gate left, Drain top, Source bottom) */
function NmosV({ x, y, label, val, side = 'right' }: { x: number; y: number; label: string; val: string; side?: 'left' | 'right' }) {
  const tx = side === 'right' ? x + 13 : x - 18;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <circle cx={x - 1} cy={y} r="12.5" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
      <line x1={x - 16} y1={y + 4} x2={x - 7} y2={y + 4} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 7} y1={y - 7} x2={x - 7} y2={y + 7} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={x - 3.5} y1={y - 8} x2={x - 3.5} y2={y - 3.5} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={x - 3.5} y1={y - 2} x2={x - 3.5} y2={y + 2} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={x - 3.5} y1={y + 3.5} x2={x - 3.5} y2={y + 8} stroke="#0f172a" strokeWidth="1.8" />
      <path d={`M ${x - 3.5} ${y - 6} L ${x + 5} ${y - 6} L ${x + 5} ${y - 16}`} fill="none" stroke="#0f172a" strokeWidth="1.5" />
      <path d={`M ${x - 3.5} ${y} L ${x + 5} ${y} L ${x + 5} ${y + 16}`} fill="none" stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 3.5} y1={y + 6} x2={x + 5} y2={y + 6} stroke="#0f172a" strokeWidth="1.5" />
      <polygon points={`${x - 3},${y} ${x + 1.5},${y - 2.6} ${x + 1.5},${y + 2.6}`} fill="#0f172a" />
      <text x={tx} y={y - 2} textAnchor={anchor} fontSize="8.8" fontWeight="700" fill="#0f172a" fontFamily="monospace">
        {label}
      </text>
      <text x={tx} y={y + 8.5} textAnchor={anchor} fontSize="7.6" fill="#0e7490" fontFamily="monospace">
        {val}
      </text>
    </g>
  );
}

export function OutputStageCircuitSvg({ topologyId, result }: Props) {
  const verdictColor =
    result.faultVerdict === 'PASS' ? '#047857' : result.faultVerdict === 'MARGINAL' ? '#b45309' : '#be123c';
  const isRevB = topologyId === 'gemini_rev_b_pushpull';
  const isH3 = topologyId === 'rev_a_h3_baseline';
  const isTc = topologyId === 'rev_a_tc4427_fallback';
  const isUcc = topologyId === 'ucc27524_integrated';
  const isOpto = topologyId === 'opto_pc817_isolated';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900">
          Authentic IEEE Schematic — Top: Pump PWM Output &amp; Readback (J2) · Bottom: Active-Protected Relay Driver (J4)
        </span>
        <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
          <span className="text-slate-700">V_PWM = {result.vHighAtPumpV.toFixed(2)} V</span>
          <span className="text-slate-300">·</span>
          <span className={result.edgeRulePass ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
            t_edge = {Math.max(result.tRiseUs, result.tFallUs).toFixed(2)} µs
          </span>
          <span className="text-slate-300">·</span>
          <span className={result.readbackSafe ? 'text-slate-700' : 'text-rose-700 font-semibold'}>
            RB1 = {result.readbackPiV.toFixed(2)} V
          </span>
          <span className="text-slate-300">·</span>
          <span style={{ color: verdictColor }} className="font-bold">
            {result.faultVerdict}
          </span>
        </div>
      </div>

      <div className="p-3">
        <svg viewBox="0 0 820 315" className="w-full h-auto block select-none" role="img" aria-label="Pump PWM and Relay Driver Schematic">
          <rect x="0" y="0" width="820" height="315" fill="#ffffff" />

          {/* Section divider line between Pump PWM (top) and Relay Driver (bottom) */}
          <line x1="12" y1="205" x2="808" y2="205" stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="5 4" />
          <text x="16" y="16" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
            A. PUMP1 PWM OUTPUT (GPIO 18 + WD_OK -&gt; J2) &amp; CLAMPED RB1/FB1
          </text>
          <text x="16" y="220" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
            B. REL1 / SSR LOW-SIDE DRIVER (GPIO 25 + +5V_REL -&gt; J4)
          </text>

          {/* ================= TOP HALF: PUMP PWM OUTPUT STAGE ================= */}
          {/* Left Pi / Watchdog inputs */}
          <rect x="14" y="34" width="98" height="148" rx="4" fill="#f1f5f9" stroke="#334155" strokeWidth="1.4" />
          <rect x="14" y="34" width="98" height="20" rx="3" fill="#0f172a" />
          <text x="63" y="47.5" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#fff" fontFamily="monospace">
            PI + WATCHDOG
          </text>
          <text x="106" y="80" textAnchor="end" fontSize="8.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">PWM1 G18</text>
          <text x="106" y="132" textAnchor="end" fontSize="8.5" fontWeight="700" fill="#0e7490" fontFamily="monospace">WD_OK</text>
          <text x="106" y="164" textAnchor="end" fontSize="8.2" fontWeight="700" fill="#475569" fontFamily="monospace">RB1 G6</text>

          {/* J2 PUMP1 Terminal Block (Right Top) */}
          <rect x="706" y="34" width="100" height="148" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.6" />
          <rect x="706" y="34" width="100" height="20" rx="3" fill="#0f172a" />
          <text x="756" y="47.5" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#fff" fontFamily="monospace">
            J2 (PUMP1)
          </text>
          {[
            { py: 82, txt: '1: PWM (Brn)', col: '#b91c1c' },
            { py: 120, txt: '2: GND (Blu)', col: '#334155' },
            { py: 158, txt: '3: FB  (Blk)', col: '#0e7490' },
          ].map((p) => (
            <g key={p.txt}>
              <circle cx="719" cy={p.py} r="5.5" fill="#fff" stroke="#0f172a" strokeWidth="1.3" />
              <line x1="715.5" y1={p.py - 3.5} x2="722.5" y2={p.py + 3.5} stroke="#64748b" strokeWidth="1" />
              <text x="729" y={p.py + 3} fontSize="8.4" fontWeight="700" fill={p.col} fontFamily="monospace">
                {p.txt}
              </text>
            </g>
          ))}
          <line x1="686" y1="120" x2="706" y2="120" stroke="#334155" strokeWidth="1.4" />
          <Gnd x={686} y={120} />

          {/* Feedback summary pill on bottom-right of Top Half */}
          <line x1="590" y1="158" x2="706" y2="158" stroke="#0e7490" strokeWidth="1.5" />
          <rect x="524" y="144" width="142" height="28" rx="3" fill={isRevB || isUcc || isOpto ? '#ecfdf5' : '#fff1f2'} stroke={isRevB || isUcc || isOpto ? '#6ee7b7' : '#fda4af'} strokeWidth="1.1" />
          <text x="595" y="156" textAnchor="middle" fontSize="7.8" fontWeight="700" fill={isRevB || isUcc || isOpto ? '#065f46' : '#9f1239'} fontFamily="monospace">
            {isRevB || isUcc || isOpto ? 'FB1: 2.2k + 2x1N4148W + 22k' : 'FB1: PESD5V0 (Ext) + 4.7k'}
          </text>
          <text x="595" y="167" textAnchor="middle" fontSize="7.4" fill="#475569" fontFamily="monospace">
            {isRevB || isUcc || isOpto ? '-> C9 10nF -> GPIO23 (+24V safe)' : '-> 10k/1nF -> GPIO23 (6.8V clamp)'}
          </text>

          {/* ---- TOPOLOGY 4: REV B (GEMINI COMPLEMENTARY PUSH-PULL INSIDE R9) ---- */}
          {isRevB && (
            <g>
              {/* PWM1 -> R7 100k -> R33 10k -> Q4 NPN; WD_OK -> Q5 2N7002 */}
              <line x1="112" y1="77" x2="152" y2="77" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="132" cy="77" r="2.6" fill="#0f172a" />
              <ResV x={132} y={77} h={34} label="R7" val="100k" side="left" />
              <Gnd x={132} y={111} />
              <ResH x={152} y={77} w={42} label="R33" val="10k" />
              <BjtV x={210} y={77} label="Q4" val="3904" side="right" />
              <line x1="112" y1="129" x2="194" y2="129" stroke="#0e7490" strokeWidth="1.5" />
              <NmosV x={210} y={125} label="Q5" val="AO3400A" side="right" />
              <line x1="215" y1="93" x2="215" y2="109" stroke="#0f172a" strokeWidth="1.5" />
              <Gnd x={215} y={141} />

              {/* Q4 Collector -> R35 4.7k -> Q8 PNP Hard-Off Inverter */}
              <line x1="215" y1="61" x2="215" y2="52" stroke="#0f172a" strokeWidth="1.5" />
              <ResH x={215} y={52} w={56} label="R35" val="4.7k" />
              <line x1="271" y1="52" x2="310" y2="52" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="290" cy="52" r="2.6" fill="#0f172a" />
              <ResV x={290} y={24} h={28} label="R36" val="4.7k" side="left" />
              <Rail x={290} y={24} label="+V_DRV" />
              <BjtV x={326} y={52} pnp label="Q8" val="3906" side="right" />
              <line x1="331" y1="24" x2="331" y2="36" stroke="#b91c1c" strokeWidth="1.5" />
              <Rail x={331} y={24} label="+V_DRV" />

              {/* NODE_DRV -> R37 2.2k pull-down & Class-B Q6/Q7 Emitter-Follower Bases */}
              <line x1="331" y1="68" x2="331" y2="82" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="331" cy="82" r="2.6" fill="#0f172a" />
              <ResV x={331} y={82} h={42} label="R37" val="2.2k" side="left" />
              <Gnd x={331} y={124} />
              <line x1="331" y1="82" x2="404" y2="82" stroke="#0f172a" strokeWidth="1.6" />
              <line x1="404" y1="56" x2="404" y2="110" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="404" cy="82" r="2.6" fill="#0f172a" />

              {/* Q6 MMBT3904 Top + Q7 MMBT3906 Bottom (Zero Shoot-Through Class-B) */}
              <BjtV x={420} y={56} label="Q6" val="3904" side="right" />
              <line x1="425" y1="24" x2="425" y2="40" stroke="#b91c1c" strokeWidth="1.5" />
              <Rail x={425} y={24} label="+V_DRV" />
              <BjtV x={420} y={110} pnp label="Q7" val="3906" side="right" />
              <Gnd x={425} y={126} />
              <line x1="425" y1="72" x2="425" y2="94" stroke="#0f172a" strokeWidth="1.6" />
              <circle cx="425" cy="82" r="2.8" fill="#0f172a" />

              {/* NODE_OUT -> D4a/D4b 1N4148W Clamps -> R9 220R 0.5W OUTSIDE! -> J2 PWM */}
              <line x1="425" y1="82" x2="546" y2="82" stroke="#0f172a" strokeWidth="1.6" />
              <circle cx="496" cy="82" r="2.6" fill="#0f172a" />
              <DiodeV x={496} y={44} h={38} label="D4a" val="4148W" side="right" />
              <Rail x={496} y={44} label="+V_DRV" />
              <DiodeV x={496} y={82} h={36} label="D4b" val="4148W" side="right" />
              <Gnd x={496} y={118} />

              <ResH x={546} y={82} w={54} label="R9 (OUTSIDE!)" val="220Ω 1206" />
              <line x1="600" y1="82" x2="706" y2="82" stroke="#b91c1c" strokeWidth="1.7" />
              <circle cx="640" cy="82" r="2.6" fill="#b91c1c" />
              <ResV x={640} y={82} h={36} label="R38" val="4.7k" side="left" />
              <Gnd x={640} y={118} />

              {/* Readback RB1 tap note */}
              <text x="360" y="170" textAnchor="middle" fontSize="8" fontWeight="700" fill="#047857" fontFamily="monospace">
                RB1 (GPIO6): R31 22k / R32 10k + D18 1N4148W -&gt; +3V3 (2.36 V @ 7.55 V PWM, &lt;=3.6 V @ 24V)
              </text>
            </g>
          )}

          {/* ---- TOPOLOGY 2: REV A DEFAULT H3 (Q7 OUTSIDE R9!) ---- */}
          {isH3 && (
            <g>
              <line x1="112" y1="77" x2="152" y2="77" stroke="#0f172a" strokeWidth="1.5" />
              <ResH x={152} y={77} w={42} label="R33" val="10k" />
              <BjtV x={210} y={77} label="Q4" val="3904" side="right" />
              <line x1="112" y1="129" x2="194" y2="129" stroke="#0e7490" strokeWidth="1.5" />
              <NmosV x={210} y={125} label="Q5" val="AO3400" side="right" />
              <line x1="215" y1="93" x2="215" y2="109" stroke="#0f172a" strokeWidth="1.5" />
              <Gnd x={215} y={141} />

              <ResH x={215} y={52} w={54} label="R35" val="2.7k" />
              <line x1="215" y1="61" x2="215" y2="52" stroke="#0f172a" strokeWidth="1.5" />
              <line x1="269" y1="52" x2="326" y2="52" stroke="#0f172a" strokeWidth="1.5" />
              <ResV x={294} y={24} h={28} label="R36" val="2.2k" side="left" />
              <Rail x={294} y={24} label="+V_DRV" />
              <BjtV x={342} y={52} pnp label="Q6" val="3906" side="right" />
              <line x1="347" y1="24" x2="347" y2="36" stroke="#b91c1c" strokeWidth="1.5" />
              <Rail x={347} y={24} label="+V_DRV" />

              {/* Q6 -> R9 100R BEFORE Q7! */}
              <line x1="347" y1="68" x2="347" y2="82" stroke="#0f172a" strokeWidth="1.5" />
              <line x1="347" y1="82" x2="412" y2="82" stroke="#0f172a" strokeWidth="1.5" />
              <ResH x={412} y={82} w={54} label="R9" val="100Ω 0.5W" />
              <line x1="466" y1="82" x2="706" y2="82" stroke="#b91c1c" strokeWidth="1.7" />

              {/* EXPOSED Q7 OUTSIDE R9! */}
              <circle cx="526" cy="82" r="2.8" fill="#be123c" />
              <line x1="526" y1="82" x2="526" y2="96" stroke="#be123c" strokeWidth="1.6" />
              <BjtV x={521} y={112} label="Q7 (!)" val="OUTSIDE R9!" side="right" />
              <Gnd x={526} y={128} />
              <text x="480" y="114" textAnchor="end" fontSize="7.5" fill="#be123c" fontFamily="monospace">R37 47k</text>
              <line x1="484" y1="112" x2="505" y2="112" stroke="#be123c" strokeWidth="1.2" strokeDasharray="3 2" />

              {/* SMBJ13A 1.1 nF Extended TVS */}
              <circle cx="634" cy="82" r="2.6" fill="#0f172a" />
              <DiodeV x={634} y={82} h={38} tvs label="D4" val="SMBJ13A" side="right" />
              <Gnd x={634} y={120} />

              <text x="340" y="170" textAnchor="middle" fontSize="8" fontWeight="700" fill="#be123c" fontFamily="monospace">
                DEFECTS: Q7 explodes on +12/+24V · Q6 leaks @ 12V/60°C · RB1 12k/8.2k &gt;3.3V on Pi 5!
              </text>
            </g>
          )}

          {/* ---- TOPOLOGY 1, 3, 5: IC / OPTO BLOCKS ---- */}
          {(isTc || isUcc || isOpto) && (
            <g>
              <line x1="112" y1="77" x2="210" y2="77" stroke="#0f172a" strokeWidth="1.6" />
              <line x1="112" y1="129" x2="210" y2="129" stroke="#0e7490" strokeWidth="1.6" />

              {isTc && (
                <>
                  <rect x="210" y="64" width="94" height="72" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
                  <text x="257" y="94" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f172a" fontFamily="monospace">U4: 74LVC1G08</text>
                  <text x="257" y="108" textAnchor="middle" fontSize="8" fill="#be123c" fontFamily="monospace">AND (Extended)</text>
                  <line x1="304" y1="96" x2="352" y2="96" stroke="#0f172a" strokeWidth="1.6" />
                  <rect x="352" y="54" width="126" height="84" rx="4" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="1.6" />
                  <text x="415" y="84" textAnchor="middle" fontSize="9.2" fontWeight="700" fill="#1e3a8a" fontFamily="monospace">U6: TC4427A</text>
                  <text x="415" y="99" textAnchor="middle" fontSize="8" fill="#1e40af" fontFamily="monospace">1.5A Push-Pull</text>
                  <text x="415" y="114" textAnchor="middle" fontSize="7.8" fill="#be123c" fontFamily="monospace">Ext · 22V AbsMax</text>
                  <line x1="478" y1="82" x2="528" y2="82" stroke="#0f172a" strokeWidth="1.6" />
                </>
              )}

              {isUcc && (
                <>
                  <rect x="210" y="54" width="248" height="86" rx="4" fill="#fff1f2" stroke="#be123c" strokeWidth="1.6" />
                  <text x="334" y="82" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#9f1239" fontFamily="monospace">U6: TI UCC27524DR (Extended)</text>
                  <text x="334" y="98" textAnchor="middle" fontSize="8.3" fill="#be123c" fontFamily="monospace">ENA/ENB Internal Pull-UP = UNSAFE DEFAULT!</text>
                  <text x="334" y="114" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">Missing pull-down + open WD_OK = Pump ON</text>
                  <line x1="458" y1="82" x2="528" y2="82" stroke="#0f172a" strokeWidth="1.6" />
                </>
              )}

              {isOpto && (
                <>
                  <rect x="210" y="54" width="248" height="86" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1.6" />
                  <text x="334" y="82" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#92400e" fontFamily="monospace">U11: PC817C / EL817C Opto (Ext)</text>
                  <text x="334" y="98" textAnchor="middle" fontSize="8.3" fill="#b45309" fontFamily="monospace">t_fall ~13-18 us (FAILS &lt;=4 us T/500 Rule!)</text>
                  <text x="334" y="114" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">Redundant: Grundfos/Wilo have internal opto</text>
                  <line x1="458" y1="82" x2="528" y2="82" stroke="#0f172a" strokeWidth="1.6" />
                </>
              )}

              <ResH x={528} y={82} w={54} label="R9" val="100Ω 0.5W" />
              <line x1="582" y1="82" x2="706" y2="82" stroke="#b91c1c" strokeWidth="1.7" />
              <circle cx="634" cy="82" r="2.6" fill="#0f172a" />
              <DiodeV x={634} y={82} h={38} tvs={!isOpto} label="D4" val={isOpto ? '1N4148W' : 'SMBJ13A'} side="right" />
              <Gnd x={634} y={120} />

              <text x="340" y="170" textAnchor="middle" fontSize="8" fontWeight="700" fill={isTc ? '#be123c' : '#475569'} fontFamily="monospace">
                {isTc
                  ? 'RB1 (GPIO6): 12k / 8.2k (UNCLAMPED! 3.45–4.87 V @ 8.5–12V) · €11.20 Extended fees'
                  : 'RB1 (GPIO6): 22k / 10k + D18 1N4148W clamp to +3V3'}
              </text>
            </g>
          )}

          {/* ================= BOTTOM HALF: RELAY / SSR DRIVER STAGE ================= */}
          <rect x="14" y="232" width="98" height="72" rx="4" fill="#f1f5f9" stroke="#334155" strokeWidth="1.4" />
          <text x="63" y="254" textAnchor="middle" fontSize="8.6" fontWeight="700" fill="#0f172a" fontFamily="monospace">GPIO 25</text>
          <text x="63" y="268" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">REL1 (Pin 22)</text>
          <text x="63" y="292" textAnchor="middle" fontSize="7.6" fill="#047857" fontFamily="monospace">+5V_REL (Q12)</text>

          {/* J4 REL1 Terminal Block (Right Bottom) */}
          <rect x="706" y="232" width="100" height="72" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.6" />
          <rect x="706" y="232" width="100" height="18" rx="3" fill="#0f172a" />
          <text x="756" y="244" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" fontFamily="monospace">J4 (REL1)</text>
          <circle cx="719" cy="264" r="5" fill="#fff" stroke="#0f172a" strokeWidth="1.3" />
          <text x="729" y="267" fontSize="8.2" fontWeight="700" fill="#b91c1c" fontFamily="monospace">1: +5V_REL</text>
          <circle cx="719" cy="288" r="5" fill="#fff" stroke="#0f172a" strokeWidth="1.3" />
          <text x="729" y="291" fontSize="8.2" fontWeight="700" fill="#0f172a" fontFamily="monospace">2: OUT (Lo)</text>

          {/* Shared +5V_REL top bus */}
          <Rail x={470} y={242} label="+5V_REL (Watchdog Q12)" />
          <line x1="470" y1="242" x2="670" y2="242" stroke="#b91c1c" strokeWidth="1.7" />
          <line x1="670" y1="242" x2="670" y2="264" stroke="#b91c1c" strokeWidth="1.7" />
          <line x1="670" y1="264" x2="706" y2="264" stroke="#b91c1c" strokeWidth="1.7" />

          {/* Gate drive R16 100k + R15 */}
          <line x1="112" y1="268" x2="178" y2="268" stroke="#0f172a" strokeWidth="1.5" />
          <circle cx="144" cy="268" r="2.6" fill="#0f172a" />
          <ResV x={144} y={268} h={30} label="R16" val="100k" side="left" />
          <Gnd x={144} y={298} />
          <ResH x={178} y={268} w={48} label="R15" val={isRevB || isOpto ? '10k' : '100Ω'} />
          <line x1="226" y1="268" x2="352" y2="268" stroke="#0f172a" strokeWidth="1.5" />

          {/* Active 123.2 mA Current Limiter (Rev B D25 Populated / Opto) vs Unprotected (Rev A) */}
          {isRevB || isOpto ? (
            <g>
              <circle cx="290" cy="268" r="2.6" fill="#047857" />
              <BjtV x={285} y={286} label="Q11" val="3904 (123mA)" side="left" />
              <Gnd x={290} y={302} />
              <line x1="269" y1="286" x2="260" y2="286" stroke="#047857" strokeWidth="1.3" />
              <line x1="260" y1="286" x2="260" y2="298" stroke="#047857" strokeWidth="1.3" />
              <line x1="260" y1="298" x2="373" y2="298" stroke="#047857" strokeWidth="1.3" />

              <NmosV x={368} y={264} label="Q10" val="AO3400A" side="right" />
              <line x1="373" y1="280" x2="373" y2="298" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="373" cy="298" r="2.5" fill="#047857" />
              <ResH x={373} y={298} w={52} label="R501A∥B" val="2×10Ω=5Ω" />
              <Gnd x={425} y={298} />
            </g>
          ) : (
            <g>
              <NmosV x={368} y={264} label="Q2" val="AO3400A" side="right" />
              <Gnd x={373} y={280} />
              <text x="290" y="295" textAnchor="middle" fontSize="8" fontWeight="700" fill="#be123c" fontFamily="monospace">
                {isUcc ? 'PTC 200mA (~1.5A surge)' : 'NO CURRENT LIMIT (>15A short!)'}
              </text>
            </g>
          )}

          {/* Drain -> D6 Flyback -> J4 Pin 2 OUT */}
          <line x1="373" y1="248" x2="373" y2="288" stroke="none" />
          <path d="M 373 248 L 456 248 L 456 288 L 706 288" fill="none" stroke="#0f172a" strokeWidth="1.6" />
          <circle cx="536" cy="242" r="2.6" fill="#b91c1c" />
          <circle cx="536" cy="288" r="2.6" fill="#0f172a" />
          <DiodeV
            x={536}
            y={242}
            h={46}
            schottky={isRevB || isUcc || isOpto}
            label="D6"
            val={isRevB || isUcc || isOpto ? 'SS14 1A' : '1N4148W'}
            side="right"
          />
          <circle cx="622" cy="242" r="2.6" fill="#b91c1c" />
          <circle cx="622" cy="288" r="2.6" fill="#0f172a" />
          <ResV x={622} y={242} h={24} label="R17" val="2.2k" side="right" />
          <DiodeV x={622} y={266} h={22} label="D7" val="Grn LED" side="right" />
        </svg>
      </div>
    </div>
  );
}
