import {
  CONNECTOR_OPTIONS,
  ConnectorOption,
  HAT_EDGE_BUDGET,
} from '../data/connectorCatalog';

interface ConnectorVisualsProps {
  options: ConnectorOption[];
  selected: ConnectorOption;
  onSelect: (id: string) => void;
  onResetFilters?: () => void;
}

/**
 * Technical cross-section & mechanical profile SVG for the currently selected connector family.
 * Shows clamp geometry (rising cage vs leaf spring vs push-in spring vs crimp), wire/ferrule entry,
 * and whether the connector unplugs from the PCB.
 */
function ConnectorCrossSectionSvg({ option }: { option: ConnectorOption }) {
  const isPluggable = option.mounting === 'Pluggable';
  const isTwoTier = option.tiersAllPt1000 === '2-Tier (2×8P)' && option.clampMechanism !== 'crimp_housing';
  const isPushIn = option.clampMechanism === 'push_in_spring';
  const isLeaf = option.clampMechanism === 'leaf_spring_screw';
  const isMicro = option.clampMechanism === 'micro_screw';
  const isCrimp = option.clampMechanism === 'crimp_housing';

  const bodyColor = isPushIn
    ? option.mounting === 'Pluggable'
      ? '#1d4ed8'
      : '#64748b'
    : isCrimp
    ? '#e2e8f0'
    : '#15803d';
  const bodyStroke = isCrimp ? '#64748b' : '#0f172a';
  const bodyLight = isPushIn
    ? option.mounting === 'Pluggable'
      ? '#3b82f6'
      : '#94a3b8'
    : isCrimp
    ? '#f8fafc'
    : '#22c55e';

  return (
    <svg
      viewBox="0 0 360 190"
      className="w-full h-auto block select-none"
      role="img"
      aria-label={`Mechanical cross-section of ${option.name}`}
    >
      <rect x="0" y="0" width="360" height="190" fill="#f8fafc" rx="6" />

      {/* Engineering grid lines */}
      <g stroke="#e2e8f0" strokeWidth="0.6">
        {[30, 60, 90, 120, 150].map((y) => (
          <line key={y} x1="12" y1={y} x2="348" y2={y} />
        ))}
        {[60, 120, 180, 240, 300].map((x) => (
          <line key={x} x1={x} y1="12" x2={x} y2="178" />
        ))}
      </g>

      {/* PCB Substrate Cross-Section */}
      <rect x="118" y="146" width="224" height="12" fill="#166534" stroke="#0f172a" strokeWidth="1" />
      <rect x="118" y="144" width="224" height="2" fill="#d97706" />
      <text x="292" y="155" fontSize="8" fontFamily="monospace" fill="#dcfce7" textAnchor="middle">
        1.6 mm FR-4 HAT PCB
      </text>
      <text x="118" y="172" fontSize="8.5" fontFamily="monospace" fill="#475569">
        ← Left Edge (x = 0 mm)
      </text>

      {/* Solder THT Pins going into PCB */}
      {isTwoTier ? (
        <>
          <rect x="150" y="144" width="4" height="20" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <rect x="176" y="144" width="4" height="20" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <circle cx="152" cy="158" r="2.2" fill="#94a3b8" />
          <circle cx="178" cy="158" r="2.2" fill="#94a3b8" />
        </>
      ) : (
        <>
          <rect x="158" y="144" width="4" height="20" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <circle cx="160" cy="158" r="2.2" fill="#94a3b8" />
        </>
      )}

      {/* === CASE 1: PLUGGABLE DUAL-TIER (SCREW OR PUSH-IN) === */}
      {isPluggable && !isCrimp && (
        <g>
          {/* Fixed PCB Shrouded Header (Right side, soldered on PCB) */}
          <rect x="134" y="42" width="60" height="102" rx="3" fill={bodyColor} stroke={bodyStroke} strokeWidth="1.2" />
          {/* Header pins mating horizontally to the left */}
          <rect x="118" y="64" width="24" height="4" fill="#eab308" stroke="#713f12" strokeWidth="0.7" />
          <rect x="118" y="114" width="24" height="4" fill="#eab308" stroke="#713f12" strokeWidth="0.7" />
          <text x="164" y="96" fontSize="8" fontFamily="monospace" fill="#ffffff" textAnchor="middle" fontWeight="bold">
            PCB
          </text>
          <text x="164" y="106" fontSize="7.5" fontFamily="monospace" fill="#e2e8f0" textAnchor="middle">
            HEADER
          </text>

          {/* Detachable Top & Bottom Plugs (slightly separated to show pluggability) */}
          {[46, 98].map((py, idx) => (
            <g key={py}>
              <rect
                x="56"
                y={py}
                width="68"
                height="42"
                rx="3"
                fill={bodyLight}
                stroke={bodyStroke}
                strokeWidth="1.2"
              />
              {/* Wire & Ferrule entering from left */}
              <line x1="14" y1={py + 22} x2="56" y2={py + 22} stroke={idx === 0 ? '#dc2626' : '#2563eb'} strokeWidth="3.5" />
              <rect x="52" y={py + 19.5} width="26" height="5" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />

              {isPushIn ? (
                <>
                  {/* Orange Push-In Release Lever */}
                  <rect x="78" y={py + 4} width="16" height="9" rx="1.5" fill="#f97316" stroke="#7c2d12" strokeWidth="0.8" />
                  {/* Curved stainless spring leaf */}
                  <path
                    d={`M 98 ${py + 12} Q 84 ${py + 16} 76 ${py + 20}`}
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth="2.2"
                  />
                </>
              ) : (
                <>
                  {/* Brass Rising Cage around ferrule */}
                  <rect x="64" y={py + 16} width="24" height="12" fill="none" stroke="#facc15" strokeWidth="2.2" />
                  {/* M2 Slotted Screw Head on Top */}
                  <rect x="73" y={py + 3} width="6" height="13" fill="#e2e8f0" stroke="#334155" strokeWidth="0.8" />
                  <rect x="70" y={py + 2} width="12" height="4" rx="1" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
                </>
              )}

              <text x="105" y={py + 36} fontSize="7" fontFamily="monospace" fill="#ffffff" textAnchor="middle">
                {idx === 0 ? 'PT1–4' : 'PT5–8'}
              </text>
            </g>
          ))}

          {/* Unplugging callout arrow */}
          <path d="M 130 28 L 88 28" stroke="#0f172a" strokeWidth="1.4" markerEnd="url(#arrowHead)" />
          <text x="108" y="22" fontSize="8.5" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
            2 s unplug (no tools)
          </text>
        </g>
      )}

      {/* === CASE 2: FIXED PCB TERMINAL (2-TIER OR 1-TIER SCREW / WAGO) === */}
      {!isPluggable && !isCrimp && (
        <g>
          {isTwoTier ? (
            <>
              {/* Upper Tier Step (Set back for top screwdriver access) */}
              <rect x="148" y="34" width="54" height="54" rx="3" fill={bodyLight} stroke={bodyStroke} strokeWidth="1.2" />
              {/* Lower Tier Front */}
              <rect x="122" y="88" width="80" height="56" rx="3" fill={bodyColor} stroke={bodyStroke} strokeWidth="1.2" />
              {/* Top wire + cage + screw */}
              <line x1="18" y1="62" x2="148" y2="62" stroke="#dc2626" strokeWidth="3.5" />
              <rect x="144" y="59.5" width="24" height="5" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />
              <rect x="156" y="55" width="22" height="13" fill="none" stroke="#facc15" strokeWidth="2.2" />
              <rect x="164" y="38" width="6" height="17" fill="#e2e8f0" stroke="#334155" strokeWidth="0.8" />
              <rect x="161" y="36" width="12" height="4" rx="1" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
              {/* Bottom wire + cage + screw */}
              <line x1="18" y1="118" x2="122" y2="118" stroke="#2563eb" strokeWidth="3.5" />
              <rect x="118" y="115.5" width="24" height="5" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />
              <rect x="130" y="111" width="22" height="13" fill="none" stroke="#facc15" strokeWidth="2.2" />
              <rect x="138" y="92" width="6" height="19" fill="#e2e8f0" stroke="#334155" strokeWidth="0.8" />
              <rect x="135" y="90" width="12" height="4" rx="1" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
              <text x="175" y="25" fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
                Stepped 2-Tier Fixed (0 mm overhang)
              </text>
            </>
          ) : (
            <>
              {/* Single-Tier Fixed Block */}
              <rect
                x="124"
                y={isMicro ? 84 : 74}
                width={isMicro ? 56 : 74}
                height={isMicro ? 60 : 70}
                rx="3"
                fill={bodyColor}
                stroke={bodyStroke}
                strokeWidth="1.2"
              />
              {/* Wire */}
              <line
                x1="18"
                y1={isPushIn ? 94 : 114}
                x2="128"
                y2="114"
                stroke="#dc2626"
                strokeWidth={isMicro ? 2.2 : 3.5}
              />
              <rect x="124" y="111.5" width="22" height="5" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />

              {isPushIn ? (
                <>
                  {/* 45-degree WAGO push button */}
                  <rect x="150" y="78" width="18" height="11" rx="2" fill="#f97316" stroke="#7c2d12" strokeWidth="0.8" />
                  <path d="M 164 94 Q 152 104 142 112" fill="none" stroke="#f8fafc" strokeWidth="2.2" />
                  <text x="160" y="64" fontSize="8" fontFamily="monospace" fill="#0f172a" textAnchor="middle" fontWeight="bold">
                    45° Push-Button Spring
                  </text>
                </>
              ) : isLeaf ? (
                <>
                  {/* Leaf-spring screw (KF301) */}
                  <path d="M 134 106 L 166 106 L 166 122 L 134 122" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                  <line x1="134" y1="110" x2="162" y2="110" stroke="#facc15" strokeWidth="2.2" />
                  <rect x="148" y="80" width="8" height="29" fill="#e2e8f0" stroke="#334155" strokeWidth="0.8" />
                  <rect x="144" y="77" width="16" height="5" rx="1" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
                  <text x="162" y="64" fontSize="8" fontFamily="monospace" fill="#b45309" textAnchor="middle" fontWeight="bold">
                    Leaf-Spring (twists bare strands)
                  </text>
                </>
              ) : (
                <>
                  {/* Rising cage screw (or micro M1.6) */}
                  <rect
                    x="136"
                    y="107"
                    width={isMicro ? 18 : 24}
                    height="13"
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="2"
                  />
                  <rect
                    x={isMicro ? 143 : 145}
                    y={isMicro ? 88 : 80}
                    width={isMicro ? 4 : 6}
                    height={isMicro ? 19 : 27}
                    fill="#e2e8f0"
                    stroke="#334155"
                    strokeWidth="0.8"
                  />
                  <rect
                    x={isMicro ? 140 : 142}
                    y={isMicro ? 86 : 77}
                    width={isMicro ? 10 : 12}
                    height="4"
                    rx="1"
                    fill="#f8fafc"
                    stroke="#334155"
                    strokeWidth="0.8"
                  />
                  <text
                    x="162"
                    y="64"
                    fontSize="8"
                    fontFamily="monospace"
                    fill={isMicro ? '#b91c1c' : '#0f172a'}
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {isMicro ? 'M1.6 Micro Screw (max 0.5 mm²)' : 'M2 Rising-Cage Fixed Screw'}
                  </text>
                </>
              )}
            </>
          )}
        </g>
      )}

      {/* === CASE 3: JST-XH CRIMP === */}
      {isCrimp && (
        <g>
          {/* Vertical White Shroud on PCB */}
          <rect x="136" y="88" width="48" height="56" rx="2" fill="#f8fafc" stroke="#475569" strokeWidth="1.2" />
          <rect x="158" y="96" width="4" height="48" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          {/* Mating Crimp Plug above */}
          <rect x="140" y="38" width="40" height="40" rx="2" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
          <rect x="156" y="54" width="8" height="22" fill="#94a3b8" stroke="#334155" strokeWidth="0.7" />
          <line x1="160" y1="14" x2="160" y2="54" stroke="#dc2626" strokeWidth="2.2" />
          <text x="235" y="56" fontSize="8" fontFamily="monospace" fill="#b91c1c" fontWeight="bold">
            Requires JST crimper
          </text>
          <text x="235" y="68" fontSize="7.5" fontFamily="monospace" fill="#475569">
            Max 22 AWG (0.33 mm²)
          </text>
        </g>
      )}

      {/* Dimension callout box on the right */}
      <g fontFamily="monospace" fontSize="8.5" fill="#1e293b">
        <rect x="218" y="36" width="128" height="96" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <text x="226" y="51" fontWeight="bold" fill="#0f172a">
          MECHANICAL PROFILE
        </text>
        <line x1="226" y1="56" x2="338" y2="56" stroke="#e2e8f0" />
        <text x="226" y="70">
          Pitch:  {option.pitchMm.toFixed(2)} mm
        </text>
        <text x="226" y="83">
          Height: {option.heightMm.toFixed(1)} mm
        </text>
        <text x="226" y="96">
          Depth:  {option.depthMm.toFixed(1)} mm
        </text>
        <text x="226" y="109">
          Wire:   {option.wireRangeMm2}
        </text>
        <text x="226" y="122" fill={option.usesScrews ? '#15803d' : '#475569'} fontWeight="bold">
          {option.usesScrews ? `Screw: ${option.screwSize.split(' ')[0]}` : 'Tool-Free / No Screw'}
        </text>
      </g>

      <defs>
        <marker id="arrowHead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f172a" />
        </marker>
      </defs>
    </svg>
  );
}

/**
 * Interactive Grouped Horizontal Cost Comparison Chart (1-Wire vs All-Pt1000 per-board terminal EUR).
 * Clicking any row selects that connector across the whole workspace.
 */
function CostComparisonChart({
  options,
  selected,
  onSelect,
  onResetFilters,
}: ConnectorVisualsProps) {
  const maxEur = 3.6;
  const pct = (eur: number) => Math.min(100, (eur / maxEur) * 100);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
        <span>
          Showing {options.length} of {CONNECTOR_OPTIONS.length} · Click any bar to inspect
        </span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-cyan-800">
            <span className="w-2.5 h-2.5 rounded-xs bg-cyan-600 inline-block" />
            1-Wire (8+3P)
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-800">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
            All-Pt1000 (16+3P)
          </span>
          <span className="inline-flex items-center gap-1 text-rose-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-200 border border-rose-500 inline-block" />
            Overflow (Won&apos;t Fit)
          </span>
        </div>
      </div>

      <div className="space-y-1.5 relative">
        {options.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-md">
            No connector families match the active filter.{' '}
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="font-semibold text-slate-900 underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          options.map((opt) => {
            const isSel = opt.id === selected.id;
            const ptOverflow = opt.allPt1000.fitStatus === 'overflow';
            const ptTight = opt.allPt1000.fitStatus === 'tight';

            return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                isSel
                  ? 'bg-orange-50/80 border-orange-300'
                  : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-5 sm:col-span-4 truncate">
                  <div className="text-[11px] font-semibold text-slate-900 truncate">
                    {opt.shortName}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    {opt.usesScrews ? opt.clampLabel : opt.clampLabel} · {opt.mounting}
                  </div>
                </div>

                <div className="col-span-7 sm:col-span-8 space-y-1">
                  {/* 1-Wire Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        className={`h-full rounded-xs transition-all duration-150 ${
                          opt.onewire.fitStatus === 'tight' ? 'bg-amber-500' : 'bg-cyan-600'
                        }`}
                        style={{ width: `${pct(opt.onewire.costPerBoardEur)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono tabular-nums text-[10px] font-semibold text-slate-800">
                      €{opt.onewire.costPerBoardEur.toFixed(2)}
                    </span>
                  </div>

                  {/* All-Pt1000 Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                      {ptOverflow ? (
                        <div
                          className="h-full bg-rose-100 border border-rose-400 rounded-xs flex items-center pl-1.5 text-[9px] font-mono font-bold text-rose-700 whitespace-nowrap"
                          style={{ width: '100%' }}
                        >
                          OVERFLOW ({opt.allPt1000.leftEdgeMm.toFixed(0)} mm &gt; 42 mm)
                        </div>
                      ) : (
                        <div
                          className={`h-full rounded-xs transition-all duration-150 ${
                            ptTight ? 'bg-amber-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${pct(opt.allPt1000.costPerBoardEur)}%` }}
                        />
                      )}
                    </div>
                    <span
                      className={`w-16 text-right font-mono tabular-nums text-[10px] font-semibold ${
                        ptOverflow ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {ptOverflow ? 'N/A' : `€${opt.allPt1000.costPerBoardEur.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })
        )}
      </div>

      {/* Baseline footnote */}
      <div className="flex flex-wrap justify-between gap-2 pt-1 text-[10px] font-mono tabular-nums text-slate-500">
        <span>Current 1-Wire baseline: €{HAT_EDGE_BUDGET.currentOnewireTermCostEur.toFixed(2)}/bd</span>
        <span>Current All-Pt1000 baseline: €{HAT_EDGE_BUDGET.currentAllPt1000TermCostEur.toFixed(2)}/bd</span>
      </div>
    </div>
  );
}

/**
 * Scaled 65 × 56 mm HAT Left-Edge Mini Blueprint showing how the selected connector physically sits
 * between H1 (y = 3.5 mm) and H3 (y = 52.5 mm) on BOTH editions simultaneously.
 */
function HatBlueprintFitPair({ option }: { option: ConnectorOption }) {
  const renderBoard = (
    title: string,
    lengthMm: number,
    status: 'fits' | 'tight' | 'overflow',
    pinText: string,
    isDualTier: boolean
  ) => {
    const scale = 2.4; // 1 mm = 2.4 SVG px -> 65 mm = 156 px, 56 mm = 134.4 px
    const ox = 22;
    const oy = 18;
    const bw = 65 * scale;
    const bh = 56 * scale;

    const connH = lengthMm * scale;
    const connY = oy + (28 - lengthMm / 2) * scale;
    const connW = (isDualTier ? 10.2 : 7.8) * scale;
    const connX = ox - (option.mounting === 'Pluggable' ? 3.5 * scale : 0);

    const fill =
      status === 'fits'
        ? option.clampMechanism === 'push_in_spring'
          ? '#2563eb'
          : '#15803d'
        : status === 'tight'
        ? '#d97706'
        : '#dc2626';

    return (
      <div className="border border-slate-200 rounded-md bg-slate-50 p-2.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px] mb-1">
          <span className="font-semibold text-slate-900">{title}</span>
          <span
            className={`font-mono tabular-nums font-bold ${
              status === 'fits'
                ? 'text-emerald-700'
                : status === 'tight'
                ? 'text-amber-700'
                : 'text-rose-700'
            }`}
          >
            {lengthMm.toFixed(1)} / 42.0 mm
          </span>
        </div>

        <svg viewBox="0 0 190 168" className="w-full h-auto block select-none">
          {/* PCB 65 × 56 mm Outline */}
          <rect
            x={ox}
            y={oy}
            width={bw}
            height={bh}
            rx={3 * scale}
            fill="#14532d"
            stroke="#0f172a"
            strokeWidth="1.2"
          />

          {/* 40-pin J1 Header top */}
          <rect
            x={ox + 7.5 * scale}
            y={oy + 1.0 * scale}
            width={50 * scale}
            height={5.2 * scale}
            fill="#1e293b"
            stroke="#94a3b8"
            strokeWidth="0.6"
          />
          <text x={ox + 32.5 * scale} y={oy + 4.6 * scale} fontSize="6.5" fontFamily="monospace" fill="#cbd5e1" textAnchor="middle">
            J1 40-PIN PI GPIO
          </text>

          {/* Usable 42.0 mm Left-Edge Window highlight */}
          <rect
            x={ox + 0.5}
            y={oy + 7.0 * scale}
            width={3}
            height={42.0 * scale}
            fill="#86efac"
            opacity="0.7"
          />

          {/* 4 Mounting Holes with 3.5 mm keepout ring */}
          {[
            { ref: 'H1', x: 3.5, y: 3.5 },
            { ref: 'H2', x: 61.5, y: 3.5 },
            { ref: 'H3', x: 3.5, y: 52.5 },
            { ref: 'H4', x: 61.5, y: 52.5 },
          ].map((h) => (
            <g key={h.ref}>
              <circle
                cx={ox + h.x * scale}
                cy={oy + h.y * scale}
                r={3.5 * scale}
                fill="none"
                stroke="#facc15"
                strokeWidth="0.7"
                strokeDasharray="2 1.5"
              />
              <circle
                cx={ox + h.x * scale}
                cy={oy + h.y * scale}
                r={1.35 * scale}
                fill="#f8fafc"
                stroke="#ca8a04"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Front Edge J2 PUMP1 */}
          <rect
            x={ox + 26 * scale}
            y={oy + 47.5 * scale}
            width={12 * scale}
            height={8 * scale}
            rx="1.5"
            fill="#0f766e"
            stroke="#f8fafc"
            strokeWidth="0.8"
          />
          <text x={ox + 32 * scale} y={oy + 52.6 * scale} fontSize="6.5" fontFamily="monospace" fill="#ffffff" textAnchor="middle">
            J2
          </text>

          {/* Selected Left-Edge Sensor Connector */}
          <rect
            x={connX}
            y={connY}
            width={connW}
            height={connH}
            rx="2"
            fill={fill}
            fillOpacity="0.92"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          <text
            x={connX + connW / 2}
            y={oy + 28 * scale}
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
            fill="#ffffff"
            textAnchor="middle"
            transform={`rotate(-90 ${connX + connW / 2} ${oy + 28 * scale})`}
          >
            {pinText}
          </text>

          {/* Overflow warning marker */}
          {status === 'overflow' && (
            <text
              x={ox + 36 * scale}
              y={oy + 29 * scale}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
              fill="#fecaca"
              textAnchor="middle"
            >
              CRASHES H1 &amp; H3!
            </text>
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {renderBoard(
        '1-Wire HAT (8 sensor pins)',
        option.onewire.leftEdgeMm,
        option.onewire.fitStatus,
        option.onewire.thtPartsCount === 2 ? 'J6 (8P)' : 'J6+J8+J9 (8P)',
        false
      )}
      {renderBoard(
        'All-Pt1000 HAT (16 sensor pins)',
        option.allPt1000.leftEdgeMm,
        option.allPt1000.fitStatus,
        option.tiersAllPt1000 === '2-Tier (2×8P)' ? 'J6 2×8P' : 'J6 16P',
        option.tiersAllPt1000 === '2-Tier (2×8P)'
      )}
    </div>
  );
}

export function ConnectorVisuals({
  options,
  selected,
  onSelect,
  onResetFilters,
}: ConnectorVisualsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 7 cols: Interactive Cost Comparison Bar Chart */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="pb-2 border-b border-slate-100">
          <div className="text-[11px] font-mono text-slate-500">
            Visual Cost &amp; Feasibility Overview · Both HAT Editions
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-0.5">
            Terminal Cost per Board &amp; Mechanical Fit (Click to Compare)
          </h2>
        </div>
        <CostComparisonChart
          options={options}
          selected={selected}
          onSelect={onSelect}
          onResetFilters={onResetFilters}
        />
      </div>

      {/* Right 5 cols: Live CAD Cross-Section + Scaled 65×56 mm Blueprint Pair */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="pb-2 border-b border-slate-100 flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono text-slate-500">
              Live Mechanical Preview · Selected Row
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">{selected.shortName}</h2>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-600">
            {selected.pitchMm.toFixed(2)} mm
          </span>
        </div>

        <ConnectorCrossSectionSvg option={selected} />
        <HatBlueprintFitPair option={selected} />
      </div>
    </div>
  );
}
