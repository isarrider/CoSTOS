import { PowerEvalResult, PowerSimParams, PowerTopologySpec } from '../physics/model';

interface Props {
  spec: PowerTopologySpec;
  params: PowerSimParams;
  result: PowerEvalResult;
}

/** Authentic IEEE/IEC Component-Level SVG Schematic for Block 1 (Pi Power Entry + +3V3_ANA Filter) */
export function PowerCircuitDiagramSvg({ spec, params, result }: Props) {
  const isRevB = spec.id === 'gemini_rev_b_efuse';
  const isRevA = spec.id === 'rev_a_d18_bare';
  const isPreD18 = spec.id === 'pre_d18_j1_ideal_diode';
  const isPtc = spec.id === 'ptc_ferrite_filter';
  const isTps = spec.id === 'tps25921_efuse_ic';

  const shortActive = params.activeFault === 'hat_5v_short';
  const backfeedActive = params.activeFault === 'pi_off_24v_backfeed';

  const ResH = ({ x, y, label, sub }: { x: number; y: number; label: string; sub?: string }) => (
    <g>
      <path
        d={`M ${x} ${y} l 5 0 l 3 -5 l 5 10 l 5 -10 l 5 10 l 5 -10 l 5 10 l 3 -5 l 5 0`}
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text x={x + 20.5} y={y - 9} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
        {label}
      </text>
      {sub && (
        <text x={x + 20.5} y={y + 15} textAnchor="middle" fontSize="8.5" fill="#475569" fontFamily="monospace">
          {sub}
        </text>
      )}
    </g>
  );

  const ResV = ({ x, y, label, sub, side = 'r' }: { x: number; y: number; label: string; sub?: string; side?: 'l' | 'r' }) => (
    <g>
      <path
        d={`M ${x} ${y} l 0 5 l -5 3 l 10 5 l -10 5 l 10 5 l -10 5 l 10 5 l -5 3 l 0 5`}
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x={side === 'r' ? x + 9 : x - 9}
        y={y + 18}
        textAnchor={side === 'r' ? 'start' : 'end'}
        fontSize="9.5"
        fontWeight="700"
        fill="#0f172a"
        fontFamily="monospace"
      >
        {label}
      </text>
      {sub && (
        <text
          x={side === 'r' ? x + 9 : x - 9}
          y={y + 29}
          textAnchor={side === 'r' ? 'start' : 'end'}
          fontSize="8.5"
          fill="#475569"
          fontFamily="monospace"
        >
          {sub}
        </text>
      )}
    </g>
  );

  const CapV = ({ x, y, label, sub, polarized = false, side = 'r' }: { x: number; y: number; label: string; sub?: string; polarized?: boolean; side?: 'l' | 'r' }) => (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 13} stroke="#0f172a" strokeWidth="1.6" />
      <line x1={x - 10} y1={y + 13} x2={x + 10} y2={y + 13} stroke="#0f172a" strokeWidth="2.1" />
      {polarized ? (
        <>
          <path d={`M ${x - 10} ${y + 21} Q ${x} ${y + 16} ${x + 10} ${y + 21}`} fill="none" stroke="#0f172a" strokeWidth="2" />
          <text x={x - 13} y={y + 11} fontSize="9" fontWeight="700" fill="#dc2626">+</text>
        </>
      ) : (
        <line x1={x - 10} y1={y + 19} x2={x + 10} y2={y + 19} stroke="#0f172a" strokeWidth="2.1" />
      )}
      <line x1={x} y1={polarized ? y + 19 : y + 19} x2={x} y2={y + 32} stroke="#0f172a" strokeWidth="1.6" />
      <text
        x={side === 'r' ? x + 13 : x - 13}
        y={y + 14}
        textAnchor={side === 'r' ? 'start' : 'end'}
        fontSize="9.5"
        fontWeight="700"
        fill="#0f172a"
        fontFamily="monospace"
      >
        {label}
      </text>
      {sub && (
        <text
          x={side === 'r' ? x + 13 : x - 13}
          y={y + 25}
          textAnchor={side === 'r' ? 'start' : 'end'}
          fontSize="8.5"
          fill="#475569"
          fontFamily="monospace"
        >
          {sub}
        </text>
      )}
    </g>
  );

  const Gnd = ({ x, y }: { x: number; y: number }) => (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 7} stroke="#0f172a" strokeWidth="1.6" />
      <line x1={x - 9} y1={y + 7} x2={x + 9} y2={y + 7} stroke="#0f172a" strokeWidth="1.8" />
      <line x1={x - 5.5} y1={y + 11} x2={x + 5.5} y2={y + 11} stroke="#0f172a" strokeWidth="1.5" />
      <line x1={x - 2.5} y1={y + 15} x2={x + 2.5} y2={y + 15} stroke="#0f172a" strokeWidth="1.2" />
    </g>
  );

  const ZenerUp = ({ x, y, label, sub }: { x: number; y: number; label: string; sub: string }) => (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 9} stroke="#0f172a" strokeWidth="1.6" />
      {/* Zener cathode bar with wings at top */}
      <path d={`M ${x - 8} ${y + 12} L ${x - 6} ${y + 9} L ${x + 6} ${y + 9} L ${x + 8} ${y + 6}`} fill="none" stroke="#059669" strokeWidth="1.9" />
      <polygon points={`${x},${y + 9} ${x - 7},${y + 21} ${x + 7},${y + 21}`} fill="#ecfdf5" stroke="#059669" strokeWidth="1.6" />
      <line x1={x} y1={y + 21} x2={x} y2={y + 30} stroke="#0f172a" strokeWidth="1.6" />
      <text x={x + 11} y={y + 14} fontSize="9.5" fontWeight="700" fill="#065f46" fontFamily="monospace">{label}</text>
      <text x={x + 11} y={y + 25} fontSize="8.5" fill="#475569" fontFamily="monospace">{sub}</text>
    </g>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Authentic IEEE Schematic — {spec.shortName}
          </h3>
          <p className="text-[11.5px] text-slate-500">
            Top: +5V Pi Header Entry (Pins 2/4) → Protection &amp; Bulk Bank → +5V_HAT · Bottom: +3V3 Pi Header (Pins 1/17) → Clamp &amp; Analog Pi-Filter → +3V3_ANA
          </p>
        </div>
        <span
          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
            result.faultVerdict === 'PASS'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : result.faultVerdict === 'MARGINAL'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {result.faultVerdict} · +5V_HAT {result.v5HatV.toFixed(2)} V · Ripple {result.v3v3AnaRippleMv.toFixed(1)} mVpp
        </span>
      </div>

      <div className="p-3 overflow-x-auto">
        <svg viewBox="0 0 820 300" className="w-full min-w-[680px] h-auto block select-none">
          {/* Subtle section divider */}
          <line x1="16" y1="168" x2="804" y2="168" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="5 4" />
          <text x="20" y="18" fontSize="9.5" fontWeight="700" fill="#dc2626" fontFamily="monospace">
            A. +5V POWER ENTRY (Pi 40-Pin Header Pins 2, 4 — D18 USB-C Powered)
          </text>
          <text x="20" y="184" fontSize="9.5" fontWeight="700" fill="#0284c7" fontFamily="monospace">
            B. +3V3 RAIL PROTECTION &amp; ANALOG FILTER (Pi Header Pins 1, 17 → Pt1000 &amp; Watchdog)
          </text>

          {/* ================= TOP: +5V RAIL ================= */}
          {/* Pi Header Block */}
          <rect x="20" y="34" width="114" height="72" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="1.6" />
          <text x="77" y="51" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">PI 40-PIN HDR</text>
          <text x="77" y="67" textAnchor="middle" fontSize="9" fontWeight="700" fill="#dc2626" fontFamily="monospace">Pins 2, 4: +5V</text>
          <text x="77" y="81" textAnchor="middle" fontSize="8.5" fill="#475569" fontFamily="monospace">{params.pi5vRailV.toFixed(2)} V USB-C</text>
          <text x="77" y="96" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">GND: 6,9,14,20...</text>

          {/* Main +5V bus out of header */}
          <line x1="134" y1="62" x2="180" y2="62" stroke="#dc2626" strokeWidth="2.2" />

          {isRevB && (
            <g>
              <line x1="180" y1="62" x2="432" y2="62" stroke="#dc2626" strokeWidth="2.4" />
              <rect x="198" y="36" width="214" height="52" rx="4" fill="#ecfdf5" stroke="#059669" strokeWidth="1.6" />
              <text x="305" y="53" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#065f46" fontFamily="monospace">
                D18 DIRECT +5V_HAT (5.045 V)
              </text>
              <text x="305" y="67" textAnchor="middle" fontSize="8.2" fill="#047857" fontFamily="monospace">
                Zero eFuse Drop (Saves C15545 €2.80)
              </text>
              <text x="305" y="80" textAnchor="middle" fontSize="7.8" fill="#475569" fontFamily="monospace">
                Local Limits: REL1 123mA · 1W 48mA · J2 38mA
              </text>
            </g>
          )}

          {isRevA && (
            <g>
              <line x1="180" y1="62" x2="432" y2="62" stroke="#dc2626" strokeWidth="2.2" />
              <rect x="218" y="38" width="176" height="46" rx="4" fill="#fff1f2" stroke="#e11d48" strokeWidth="1.4" strokeDasharray="4 3" />
              <text x="306" y="56" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#be123c" fontFamily="monospace">REV A BASELINE (D18)</text>
              <text x="306" y="72" textAnchor="middle" fontSize="8.5" fill="#9f1239" fontFamily="monospace">Elec C2 · No 3V3 Filter/Clamp</text>
            </g>
          )}

          {isPreD18 && (
            <g>
              <rect x="180" y="38" width="106" height="48" rx="4" fill="#fefce8" stroke="#ca8a04" strokeWidth="1.5" />
              <text x="233" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#854d0e" fontFamily="monospace">J1 + Ideal Diode</text>
              <text x="233" y="71" textAnchor="middle" fontSize="8" fill="#a16207" fontFamily="monospace">LM66100 / Q1 (€8.40)</text>
              <line x1="286" y1="62" x2="318" y2="62" stroke="#dc2626" strokeWidth="2" />
              <rect x="318" y="48" width="76" height="28" rx="3" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
              <text x="356" y="65" textAnchor="middle" fontSize="9" fontWeight="700" fill="#9a3412" fontFamily="monospace">F1 1A PTC</text>
              <line x1="394" y1="62" x2="432" y2="62" stroke="#dc2626" strokeWidth="2.2" />
            </g>
          )}

          {isPtc && (
            <g>
              {/* Evaluated Foldback eFuse (Dropped per D18) */}
              <ResH x={180} y={62} label="R601 1.8Ω" sub="C15545 Ext" />
              <line x1="221" y1="62" x2="292" y2="62" stroke="#dc2626" strokeWidth="2.2" />
              <rect x="292" y="42" width="84" height="40" rx="4" fill="#fff7ed" stroke="#d97706" strokeWidth="1.6" strokeDasharray="4 2" />
              <text x="334" y="58" textAnchor="middle" fontSize="9.2" fontWeight="700" fill="#92400e" fontFamily="monospace">Q21 AO3401A</text>
              <text x="334" y="71" textAnchor="middle" fontSize="8.2" fill="#b45309" fontFamily="monospace">Dropped (D18)</text>
              <circle cx="164" cy="62" r="3" fill="#dc2626" />
              <line x1="164" y1="62" x2="164" y2="112" stroke="#dc2626" strokeWidth="1.4" />
              <line x1="164" y1="112" x2="218" y2="112" stroke="#dc2626" strokeWidth="1.4" />
              <rect x="218" y="98" width="90" height="36" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1.4" />
              <text x="263" y="113" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#92400e" fontFamily="monospace">Q22 MMBT3906</text>
              <text x="263" y="126" textAnchor="middle" fontSize="8" fill="#b45309" fontFamily="monospace">360→136.5 mA</text>
              <line x1="308" y1="114" x2="334" y2="114" stroke="#d97706" strokeWidth="1.5" />
              <line x1="334" y1="82" x2="334" y2="128" stroke="#d97706" strokeWidth="1.5" />
              <Gnd x={334} y={128} />
              <line x1="376" y1="62" x2="432" y2="62" stroke={shortActive ? '#e11d48' : '#dc2626'} strokeWidth="2.2" />
            </g>
          )}

          {isTps && (
            <g>
              <rect x="190" y="38" width="196" height="48" rx="4" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.7" />
              <text x="288" y="56" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#1e40af" fontFamily="monospace">U_EF TPS25921A (SOIC-8)</text>
              <text x="288" y="71" textAnchor="middle" fontSize="8.5" fill="#1d4ed8" fontFamily="monospace">90mΩ · 450mA Hiccup · Extended IC</text>
              <line x1="386" y1="62" x2="432" y2="62" stroke="#dc2626" strokeWidth="2.2" />
            </g>
          )}

          {/* Shared +5V_HAT Bus -> Bulk Caps -> PWR LED -> Load Block */}
          <line x1="432" y1="62" x2="646" y2="62" stroke="#dc2626" strokeWidth="2.2" />
          <circle cx="468" cy="62" r="3" fill="#dc2626" />
          <CapV
            x={468}
            y={62}
            label={spec.bulkCapType === 'solid_mlcc' ? 'C2a,b 2×22µF' : 'C2 100µF'}
            sub={spec.bulkCapType === 'solid_mlcc' ? '1206 X5R (>25yr)' : 'Elec (60°C dry)'}
            polarized={spec.bulkCapType === 'electrolytic'}
          />
          <Gnd x={468} y={94} />

          {/* PWR LED branch */}
          <circle cx="578" cy="62" r="3" fill="#dc2626" />
          <ResV x={578} y={62} label={isRevB ? 'R1 2.2k' : 'R1 1.0k'} sub="D2 PWR" side="r" />
          <Gnd x={578} y={108} />

          {/* +5V_HAT Output Box */}
          <rect x="646" y="34" width="156" height="72" rx="4" fill={shortActive ? '#fff1f2' : '#f8fafc'} stroke={shortActive ? '#e11d48' : '#334155'} strokeWidth="1.6" />
          <text x="724" y="51" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#dc2626" fontFamily="monospace">
            +5V_HAT ({result.v5HatV.toFixed(2)} V)
          </text>
          <text x="724" y="66" textAnchor="middle" fontSize="8.5" fill="#0f172a" fontFamily="monospace">
            Load: {result.total5vMa.toFixed(0)} mA total
          </text>
          <text x="724" y="80" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">
            → 02 Doubler · 04 1W · 05 REL
          </text>
          <text x="724" y="96" textAnchor="middle" fontSize="8" fontWeight="700" fill={shortActive ? '#be123c' : '#047857'} fontFamily="monospace">
            {shortActive ? `SHORT: ${result.shortCurrentMa >= 1000 ? '>5A CRASH!' : `${result.shortCurrentMa}mA SAFE`}` : `Drop: ${(result.v5DropV * 1000).toFixed(0)} mV`}
          </text>

          {/* ================= BOTTOM: +3V3 RAIL ================= */}
          <rect x="20" y="198" width="114" height="70" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="1.6" />
          <text x="77" y="216" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">PI 40-PIN HDR</text>
          <text x="77" y="232" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0284c7" fontFamily="monospace">Pins 1, 17: +3V3</text>
          <text x="77" y="246" textAnchor="middle" fontSize="8.5" fill="#475569" fontFamily="monospace">Ripple: {params.pi3v3RippleMv} mVpp</text>
          <text x="77" y="260" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">Load: {result.total3v3Ma.toFixed(1)} mA</text>

          <line x1="134" y1="224" x2="364" y2="224" stroke="#0284c7" strokeWidth="2.2" />

          {/* Digital bypass cap */}
          <circle cx="182" cy="224" r="3" fill="#0284c7" />
          <CapV x={182} y={224} label="C602" sub="100nF" side="r" />
          <Gnd x={182} y={256} />

          {/* Back-feed Zener Clamp D9 */}
          {spec.has3v3BackfeedZener ? (
            <g>
              <circle cx="272" cy="224" r="3" fill="#059669" />
              <ZenerUp x={272} y={224} label="D9 TL431 (Basic)" sub="Clamps <=3.68V" />
              <Gnd x={272} y={254} />
            </g>
          ) : (
            <g>
              <rect x="242" y="238" width="116" height="32" rx="3" fill="#fff1f2" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="3 2" />
              <text x="300" y="252" textAnchor="middle" fontSize="8.2" fontWeight="700" fill="#be123c" fontFamily="monospace">NO 3.6V ZENER</text>
              <text x="300" y="264" textAnchor="middle" fontSize="7.8" fill="#9f1239" fontFamily="monospace">Pi-OFF lifts {result.piOff3v3PeakV.toFixed(1)}V</text>
            </g>
          )}

          {/* +3V3_ANA RC Filter */}
          {spec.has3v3AnaFilter ? (
            <g>
              <ResH x={364} y={224} label="R602 10Ω" sub="−36.04 dB" />
              <line x1="405" y1="224" x2="646" y2="224" stroke="#0284c7" strokeWidth="2.2" />
              <circle cx="482" cy="224" r="3" fill="#0284c7" />
              <CapV x={482} y={224} label="C604 10µF" sub="0805 MLCC" />
              <Gnd x={482} y={256} />
              <circle cx="576" cy="224" r="3" fill="#0284c7" />
              <CapV x={576} y={224} label="C603 100nF" sub="HF Bypass" />
              <Gnd x={576} y={256} />
            </g>
          ) : (
            <g>
              <line x1="364" y1="224" x2="646" y2="224" stroke="#0284c7" strokeWidth="2.2" />
              <rect x="430" y="204" width="166" height="36" rx="3" fill="#fffbeb" stroke="#d97706" strokeWidth="1.3" strokeDasharray="4 3" />
              <text x="513" y="219" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#b45309" fontFamily="monospace">NO +3V3_ANA FILTER</text>
              <text x="513" y="233" textAnchor="middle" fontSize="8" fill="#92400e" fontFamily="monospace">Raw {result.v3v3AnaRippleMv.toFixed(0)} mVpp Buck Noise</text>
            </g>
          )}

          {/* +3V3_ANA Destination Box */}
          <rect x="646" y="198" width="156" height="70" rx="4" fill={backfeedActive && !spec.has3v3BackfeedZener ? '#fff1f2' : '#f0f9ff'} stroke={backfeedActive && !spec.has3v3BackfeedZener ? '#e11d48' : '#0284c7'} strokeWidth="1.6" />
          <text x="724" y="215" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0369a1" fontFamily="monospace">
            +3V3_ANA ({result.v3v3AnaV.toFixed(2)} V)
          </text>
          <text x="724" y="230" textAnchor="middle" fontSize="8.5" fill="#0f172a" fontFamily="monospace">
            Ripple: {result.v3v3AnaRippleMv.toFixed(1)} mVpp
          </text>
          <text x="724" y="244" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">
            → 01 Pt1000 · 03 LM393 WD
          </text>
          <text x="724" y="259" textAnchor="middle" fontSize="8" fontWeight="700" fill={spec.has3v3BackfeedZener ? '#047857' : '#be123c'} fontFamily="monospace">
            Pi-OFF Clamp: {result.piOff3v3PeakV.toFixed(2)} V
          </text>
        </svg>
      </div>
    </div>
  );
}
