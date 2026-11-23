import { useState } from 'react';
import { AlertTriangle, Box, Cpu, Eye, Layers, Ruler } from 'lucide-react';
import {
  HAT_DIMS,
  HatEdition,
  PlacedPart,
  SubsystemKey,
  getHatEditionSpec,
} from './data/hatLayout';
import {
  BoardSimState,
  HatBoardSvg,
  HatViewMode,
  SolderMaskColor,
} from './components/HatBoardSvg';

const STATE_LABELS: Record<BoardSimState, { label: string; desc: string }> = {
  running: {
    label: 'Solar Running',
    desc: 'D2 PWR, D33 +V_DRV, D3 WD OK, D12 PWM & 1W-A/B lit · Red D36 OFF',
  },
  standby: {
    label: 'Idle / Standby',
    desc: 'D2 PWR, D33 +V_DRV, D3 WD OK & 1W-A/B lit · PUMP1 PWM & Red D36 OFF',
  },
  wd_trip: {
    label: 'Watchdog Tripped',
    desc: 'RED D36 WD FAULT ON · D3 WD OK & D12 PWM OFF · Q5 cuts PUMP1 immediately',
  },
};

export interface HatPreviewWorkspaceProps {
  edition?: HatEdition;
  onEditionChange?: (next: HatEdition) => void;
}

export function HatPreviewWorkspace({
  edition: controlledEdition,
  onEditionChange,
}: HatPreviewWorkspaceProps = {}) {
  const [localEdition, setLocalEdition] = useState<HatEdition>('onewire');
  const edition = controlledEdition ?? localEdition;
  const [viewMode, setViewMode] = useState<HatViewMode>('pcb');
  const [maskColor, setMaskColor] = useState<SolderMaskColor>('green');
  const [boardState, setBoardState] = useState<BoardSimState>('running');
  const [showZones, setShowZones] = useState<boolean>(false);
  const [showCopper, setShowCopper] = useState<boolean>(false);
  const [showDnp, setShowDnp] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showPiOutline, setShowPiOutline] = useState<boolean>(true);
  const [highlightedZone, setHighlightedZone] = useState<SubsystemKey | null>(null);

  const spec = getHatEditionSpec(edition);
  const [selectedPartId, setSelectedPartId] = useState<string>(spec.defaultSelectedId);

  const selectedPart: PlacedPart =
    spec.parts.find((p) => p.id === selectedPartId) ??
    spec.parts.find((p) => p.id === spec.defaultSelectedId) ??
    spec.parts[0];

  const selectedZone = spec.zones.find((z) => z.id === selectedPart.subsystem) ?? null;

  const handleSwitchEdition = (nextEdition: HatEdition) => {
    setLocalEdition(nextEdition);
    onEditionChange?.(nextEdition);
    const nextSpec = getHatEditionSpec(nextEdition);
    setSelectedPartId(nextSpec.defaultSelectedId);
    setHighlightedZone(null);
  };

  return (
    <div className="space-y-5">
      {/* Header & Edition + View Mode Switchers */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
              <span>Physical PCB Floorplan &amp; Mechanical Fit</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">65.0 × 56.0 mm Raspberry Pi HAT</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{spec.partCountSummary}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">
              10. CoSTOS HAT Physical Layout &amp; 3D Preview — {spec.shortName}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">{spec.summaryLine}</p>
          </div>

          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {(
              [
                { id: 'pcb', label: 'Top PCB View', icon: Cpu },
                { id: 'iso3d', label: '3D on Pi 5', icon: Box },
                { id: 'cad', label: 'CAD Zones & AGND', icon: Layers },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    viewMode === m.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dedicated Hardware Edition Switcher Bar (1-Wire <-> All-Pt1000) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wide">
              HAT Edition:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  {
                    id: 'onewire',
                    label: '1-Wire (1× Pt1000 + 2× 1W · 8P)',
                  },
                  {
                    id: 'all_pt1000',
                    label: 'All-Pt1000 (8× Pt1000 · 2×8P)',
                  },
                ] as const
              ).map((ed) => (
                <button
                  key={ed.id}
                  type="button"
                  onClick={() => handleSwitchEdition(ed.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    edition === ed.id
                      ? ed.id === 'all_pt1000'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ed.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-mono text-slate-600 tabular-nums">
            Sensors: <span className="font-semibold text-slate-900">{spec.sensorSummary}</span>
          </div>
        </div>
      </div>

      {/* Control Strip: Solder Mask, Live LED State & CAD Overlays */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Solder Mask Finish */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">Solder Mask:</span>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'green', label: 'JLCPCB Green', swatch: 'bg-emerald-800' },
                  { id: 'black', label: 'Matte Black', swatch: 'bg-slate-900' },
                  { id: 'blue', label: 'Royal Blue', swatch: 'bg-blue-800' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setMaskColor(c.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                    maskColor === c.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-xs border border-white/40 ${c.swatch}`} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <span className="hidden sm:inline text-slate-300">|</span>

          {/* Operating LED State */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">LED State:</span>
            <div className="flex items-center gap-1">
              {(['running', 'standby', 'wd_trip'] as BoardSimState[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setBoardState(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                    boardState === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {STATE_LABELS[st].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Layer Visibility Toggles */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDnp}
              onChange={(e) => setShowDnp(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <span>DNP Footprints (incl. J4)</span>
          </label>
          {viewMode === 'pcb' && (
            <>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-medium text-emerald-800">
                <input
                  type="checkbox"
                  checked={showCopper}
                  onChange={(e) => setShowCopper(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>2-Layer Routed Copper</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showZones}
                  onChange={(e) => setShowZones(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span>Zone Overlay</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPiOutline}
                  onChange={(e) => setShowPiOutline(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span>Pi 5 Outline</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showRulers}
                  onChange={(e) => setShowRulers(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span>Dimensions</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Main Asymmetric Split Console: Board Canvas (8 cols) + Inspector & Zones (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Dominant Board Viewport */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
              <Eye className="w-3.5 h-3.5" />
              Click any terminal, IC, MOSFET, LED, fiducial, or net-tie to inspect
            </span>
            <span className="tabular-nums">{STATE_LABELS[boardState].desc}</span>
          </div>

          <HatBoardSvg
            edition={edition}
            viewMode={viewMode}
            maskColor={maskColor}
            boardState={boardState}
            showZones={showZones}
            showCopper={showCopper}
            showDnp={showDnp}
            showRulers={showRulers}
            showPiOutline={showPiOutline}
            selectedPartId={selectedPart.id}
            highlightedZone={highlightedZone}
            onSelectPart={(part) => {
              setSelectedPartId(part.id);
              setHighlightedZone(part.subsystem === 'DNP' ? null : part.subsystem);
            }}
          />

          {/* Compact Mechanical Spec Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <div className="text-[11px] font-mono text-slate-500">Board Outline</div>
              <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {HAT_DIMS.widthMm.toFixed(1)} × {HAT_DIMS.heightMm.toFixed(1)} mm
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">Mounting Holes (H1–H4)</div>
              <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                58.0 × 49.0 mm (M2.5)
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">Stack Height (J1 Normal)</div>
              <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {HAT_DIMS.stackHeightMm.toFixed(1)} mm (Passive Pi OK)
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">Relays J4 (REL1) / J5 (REL2)</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                Depopulated (DNP · €0)
              </div>
            </div>
          </div>

          {/* Pre-Fab Sign-Off Note */}
          <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-bold">Pre-Fab Sign-Off Note:</span> Geometric copper clearances and pour continuity
              are verified automatically, but before uploading Gerbers to JLCPCB, open the exported{' '}
              <span className="font-mono font-semibold">.kicad_pcb</span> in{' '}
              <span className="font-semibold">KiCad 10 PCB Editor</span>, press{' '}
              <kbd className="px-1.5 py-0.5 text-[10.5px] font-mono font-bold bg-white border border-amber-300 rounded">
                B
              </kbd>{' '}
              to pour the Priority-2 <span className="font-mono font-semibold">AGND</span> and Priority-1{' '}
              <span className="font-mono font-semibold">GND</span> <span className="font-mono">B.Cu</span> copper zones,
              and run <span className="font-semibold">Inspect → Design Rules Checker (DRC)</span> once to confirm final
              zone-filled clearances.
            </p>
          </div>
        </div>

        {/* Right Engineering Inspector Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* Active Component Inspector */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="text-[11px] font-mono text-slate-500">Selected Component</div>
                <h2 className="text-base font-bold font-mono text-slate-900">
                  {selectedPart.ref} — {selectedPart.value}
                </h2>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                ({selectedPart.x.toFixed(1)}, {selectedPart.y.toFixed(1)}) mm
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 border border-slate-100 rounded p-2">
                <div className="text-[10.5px] font-mono text-slate-500">Package</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5">{selectedPart.pkg}</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded p-2">
                <div className="text-[10.5px] font-mono text-slate-500">LCSC / Status</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5">
                  {selectedPart.isDnp ? 'DNP / n.f. (€0.00)' : selectedPart.lcsc}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">{selectedPart.role}</p>

            {selectedPart.pinout && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[11px] font-mono font-semibold text-slate-500">Terminal / Header Pinout</div>
                <ul className="space-y-1 text-xs font-mono text-slate-800">
                  {selectedPart.pinout.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedZone && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[11px] font-mono font-semibold text-slate-500">
                  Zone Placement Rationale ({selectedZone.shortTitle})
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{selectedZone.emiNote}</p>
              </div>
            )}
          </div>

          {/* Functional Floorplan Zones Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                {spec.zones.length} Circuit Zones (EMI Partitioned)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setViewMode('cad');
                  setHighlightedZone(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 hover:underline cursor-pointer"
              >
                <Ruler className="w-3 h-3" />
                Inspect CAD
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {spec.zones.map((z) => {
                const isActive = highlightedZone === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      setHighlightedZone(isActive ? null : z.id);
                      if (viewMode === 'pcb') setShowZones(true);
                      const firstPart = spec.parts.find((p) => p.subsystem === z.id);
                      if (firstPart) setSelectedPartId(firstPart.id);
                    }}
                    className={`w-full text-left py-2 px-2 rounded transition-colors cursor-pointer ${
                      isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{z.title}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: z.stroke }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{z.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Edge-by-Edge Wiring & Clearance Architecture Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Edge-by-Edge Wiring &amp; Raspberry Pi 4 / 5 Mechanical Clearance Plan — {spec.shortName}
          </h2>
          <span className="text-xs font-mono text-slate-500">J4 REL1 Depopulated on Both Editions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="px-3.5 py-2">HAT Edge</th>
                <th className="px-3.5 py-2">Connectors / Features</th>
                <th className="px-3.5 py-2">Engineering Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {spec.edgeRows.map((row) => (
                <tr key={row.edge}>
                  <td className={`px-3.5 py-2.5 font-mono font-bold whitespace-nowrap ${row.colorClass}`}>
                    {row.edge}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-slate-900">{row.connectors}</td>
                  <td className="px-3.5 py-2.5">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
