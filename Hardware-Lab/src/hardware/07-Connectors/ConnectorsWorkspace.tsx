import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  FileSpreadsheet,
  Ruler,
  Search,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import {
  AUX_CONNECTOR_OPTIONS,
  CONNECTOR_OPTIONS,
  ConnectorOption,
  FitStatus,
  HAT_EDGE_BUDGET,
  generateConnectorsComparisonCsv,
} from './data/connectorCatalog';
import { ConnectorVisuals } from './components/ConnectorVisuals';
import { triggerTextFileDownload } from '../08-FullHat/utils/kicadAndSpiceExports';

type MountingFilter = 'all' | 'Pluggable' | 'Fixed PCB';
type SortKey =
  | 'default'
  | 'onewire_cost'
  | 'allpt_cost'
  | 'pitch'
  | 'allpt_len';

function fitLabel(status: FitStatus, edgeMm: number, clearanceMm: number): { text: string; cls: string } {
  if (status === 'fits') {
    return {
      text: `FITS · ${edgeMm.toFixed(1)} mm (${clearanceMm.toFixed(1)} mm/end)`,
      cls: 'text-emerald-700',
    };
  }
  if (status === 'tight') {
    return {
      text: `TIGHT · ${edgeMm.toFixed(1)} mm (${clearanceMm.toFixed(1)} mm/end)`,
      cls: 'text-amber-700',
    };
  }
  const over = edgeMm - HAT_EDGE_BUDGET.usableLeftEdgeMm;
  return {
    text: `OVERFLOW · ${edgeMm.toFixed(1)} mm (+${over.toFixed(1)} mm)`,
    cls: 'text-rose-700',
  };
}

function deltaFmt(val: number): { text: string; cls: string } {
  if (Math.abs(val) < 0.005) return { text: 'Baseline', cls: 'text-slate-500' };
  if (val < 0) return { text: `−€${Math.abs(val).toFixed(2)}`, cls: 'text-emerald-700 font-semibold' };
  return { text: `+€${val.toFixed(2)}`, cls: 'text-rose-700 font-semibold' };
}

/** Interactive millimeter gauge comparing selected connector length against the 42.0 mm Left Edge keepout */
function EdgeFitBar({
  label,
  lengthMm,
  status,
  detail,
}: {
  label: string;
  lengthMm: number;
  status: FitStatus;
  detail: string;
}) {
  // Visual scale: 0 to 65 mm so overflows are clearly visible past the 56 mm HAT edge
  const maxScaleMm = 65;
  const pct = (mm: number) => Math.min(100, Math.max(0, (mm / maxScaleMm) * 100));
  const usableStartPct = pct(HAT_EDGE_BUDGET.usableLeftEdgeStartMm);
  const usableWidthPct = pct(HAT_EDGE_BUDGET.usableLeftEdgeMm);
  const boardEndPct = pct(HAT_EDGE_BUDGET.boardHeightMm);

  // Center connector inside the 56 mm edge (center = 28 mm)
  const connStartMm = Math.max(0, 28 - lengthMm / 2);
  const connStartPct = pct(connStartMm);
  const connWidthPct = pct(Math.min(lengthMm, maxScaleMm - connStartMm));

  const barColor =
    status === 'fits'
      ? 'bg-emerald-600'
      : status === 'tight'
      ? 'bg-amber-500'
      : 'bg-rose-600';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="font-mono tabular-nums text-[11px] text-slate-600">{detail}</span>
      </div>
      <div className="relative h-7 bg-slate-100 border border-slate-200 rounded overflow-hidden">
        {/* HAT 56 mm boundary */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-200/50 border-r border-dashed border-slate-400"
          style={{ width: `${boardEndPct}%` }}
          title="56.0 mm HAT Left Edge"
        />
        {/* Usable 42.0 mm clear window between H1 and H3 */}
        <div
          className="absolute inset-y-0 bg-white border-x border-slate-300"
          style={{ left: `${usableStartPct}%`, width: `${usableWidthPct}%` }}
          title="42.0 mm clear zone between H1 (3.5 mm) and H3 (52.5 mm)"
        />
        {/* H1 & H3 mounting hole markers */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white"
          style={{ left: `calc(${pct(3.5)}% - 5px)` }}
          title="H1 M2.5 mounting hole (y = 3.5 mm)"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-700 border border-white"
          style={{ left: `calc(${pct(52.5)}% - 5px)` }}
          title="H3 M2.5 mounting hole (y = 52.5 mm)"
        />
        {/* Connector footprint bar */}
        <div
          className={`absolute top-1 bottom-1 rounded-xs opacity-90 transition-all duration-150 flex items-center justify-center text-[10px] font-mono font-bold text-white px-1 overflow-hidden whitespace-nowrap ${barColor}`}
          style={{ left: `${connStartPct}%`, width: `${connWidthPct}%` }}
        >
          {lengthMm.toFixed(1)} mm
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-500">
        <span>0 mm (H1 @ 3.5 mm)</span>
        <span>Clear Window: 7.0 – 49.0 mm (42.0 mm max)</span>
        <span>56.0 mm HAT Edge (H3 @ 52.5 mm)</span>
      </div>
    </div>
  );
}

export function ConnectorsWorkspace() {
  const [mountingFilter, setMountingFilter] = useState<MountingFilter>('all');
  const [screwsOnly, setScrewsOnly] = useState<boolean>(false);
  const [fitsBothOnly, setFitsBothOnly] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('fixed_350_combined_screw');
  const [batchSize, setBatchSize] = useState<2 | 5 | 10 | 25>(5);
  const [useAltJ1, setUseAltJ1] = useState<boolean>(false);
  const [useAltStandoffs, setUseAltStandoffs] = useState<boolean>(false);
  const [useAltJp1, setUseAltJp1] = useState<boolean>(false);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = CONNECTOR_OPTIONS.filter((o) => {
      if (mountingFilter !== 'all' && o.mounting !== mountingFilter) return false;
      if (screwsOnly && !o.usesScrews) return false;
      if (
        fitsBothOnly &&
        (o.onewire.fitStatus === 'overflow' || o.allPt1000.fitStatus === 'overflow')
      ) {
        return false;
      }
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.familySeries.toLowerCase().includes(q) ||
        o.clampLabel.toLowerCase().includes(q) ||
        o.partNumbers.onewire.toLowerCase().includes(q) ||
        o.partNumbers.allPt1000.toLowerCase().includes(q) ||
        o.engineeringVerdict.toLowerCase().includes(q)
      );
    });

    if (sortKey === 'default') return list;

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'onewire_cost') cmp = a.onewire.costPerBoardEur - b.onewire.costPerBoardEur;
      else if (sortKey === 'allpt_cost') cmp = a.allPt1000.costPerBoardEur - b.allPt1000.costPerBoardEur;
      else if (sortKey === 'pitch') cmp = a.pitchMm - b.pitchMm;
      else if (sortKey === 'allpt_len') cmp = a.allPt1000.leftEdgeMm - b.allPt1000.leftEdgeMm;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [mountingFilter, screwsOnly, fitsBothOnly, searchQuery, sortKey, sortAsc]);

  const selectedOption: ConnectorOption =
    filteredRows.find((o) => o.id === selectedId) ??
    filteredRows[0] ??
    CONNECTOR_OPTIONS.find((o) => o.id === selectedId) ??
    CONNECTOR_OPTIONS[0];

  const auxSavingsPerBoard =
    (useAltStandoffs ? AUX_CONNECTOR_OPTIONS[0].savingsPerBoardEur : 0) +
    (useAltJp1 ? AUX_CONNECTOR_OPTIONS[1].savingsPerBoardEur : 0) +
    (useAltJ1 ? AUX_CONNECTOR_OPTIONS[2].savingsPerBoardEur : 0);

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const hasActiveFilters =
    mountingFilter !== 'all' || screwsOnly || fitsBothOnly || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setMountingFilter('all');
    setScrewsOnly(false);
    setFitsBothOnly(false);
    setSearchQuery('');
    setSortKey('default');
    setSortAsc(true);
  };

  // Live 5-board / batch landed impact calculation (including 19% VAT on THT delta)
  const onewireTermDelta = selectedOption.onewire.deltaVsCurrentEur;
  const allPtTermDelta = selectedOption.allPt1000.deltaVsCurrentEur;
  const onewireTotalExVatDelta = onewireTermDelta - auxSavingsPerBoard;
  const allPtTotalExVatDelta = allPtTermDelta - auxSavingsPerBoard;
  const onewireBatchDeltaVat = onewireTotalExVatDelta * batchSize * 1.19;
  const allPtBatchDeltaVat = allPtTotalExVatDelta * batchSize * 1.19;
  const projected5BdOnewire =
    HAT_EDGE_BUDGET.baseline5BdLandedOnewireEur + onewireTotalExVatDelta * 1.19;
  const projected5BdAllPt =
    HAT_EDGE_BUDGET.baseline5BdLandedAllPt1000Eur + allPtTotalExVatDelta * 1.19;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
              <span>THT Terminal &amp; Header Trade-Off Matrix</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Left Edge Budget: 42.0 mm (between H1 &amp; H3)</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">1-Wire: 8+3 pins · All-Pt1000: 16+3 pins</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">
              07. Connectors — Interactive Comparison Spreadsheet (Both HAT Editions)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
              Compare every realistic screw, pluggable, push-in, and crimp connector side-by-side for both the{' '}
              <strong className="text-slate-800">1-Wire Edition (11 pins)</strong> and the{' '}
              <strong className="text-slate-800">All-Pt1000 8× Edition (19 pins)</strong>. Click any row to inspect
              its millimeter board fit, part numbers, and live batch cost impact.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                triggerTextFileDownload(
                  'CoSTOS_07_Connectors_Comparison.csv',
                  generateConnectorsComparisonCsv(),
                  'text/csv;charset=utf-8'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Spreadsheet (.csv)
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mutually Exclusive Mounting Type Selector */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Mounting:
              </span>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {(
                  [
                    { id: 'all', label: `All (${CONNECTOR_OPTIONS.length})` },
                    {
                      id: 'Pluggable',
                      label: `Pluggable (${CONNECTOR_OPTIONS.filter((o) => o.mounting === 'Pluggable').length})`,
                    },
                    {
                      id: 'Fixed PCB',
                      label: `Fixed PCB (${CONNECTOR_OPTIONS.filter((o) => o.mounting === 'Fixed PCB').length})`,
                    },
                  ] as { id: MountingFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMountingFilter(f.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      mountingFilter === f.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Combinable Checkboxes */}
            <div className="flex flex-wrap items-center gap-3 pl-1 border-l border-slate-200">
              <label className="inline-flex items-center gap-1.5 pl-2 text-xs font-medium text-slate-800 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={screwsOnly}
                  onChange={(e) => setScrewsOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <span>Screws only</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={fitsBothOnly}
                  onChange={(e) => setFitsBothOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <span>Fits both boards</span>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 underline cursor-pointer whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search part, pitch, clamp…"
                aria-label="Filter connectors"
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:bg-white w-52"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Batch:</span>
              <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                {([2, 5, 10, 25] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBatchSize(n)}
                    className={`px-2 py-1 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                      batchSize === n
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Recommendation Panel */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold">
            Engineering Recommendation — Best Screw-Terminal Choices for Both CoSTOS HATs
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            Optimized for M2 rising-cage screws · 0.14–1.5 mm² ferruled solar leads · 42.0 mm edge fit
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Active Selected Standard */}
          <div className="lg:col-span-5 p-4 space-y-2.5 bg-emerald-50/30">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wide">
                Active BOM Selection · Lowest Cost + Zero Overhang
              </span>
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSelectedId('fixed_350_combined_screw');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  selectedOption.id === 'fixed_350_combined_screw'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                {selectedOption.id === 'fixed_350_combined_screw' ? 'Selected' : 'Inspect Active BOM'}
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              3.50 mm Fixed Rising-Cage Screw (DG350 / DG350D)
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
              <span className="text-slate-800">
                1-Wire: <strong>€0.58/bd</strong>{' '}
                <span className="text-emerald-700">(Active · €10.43 landed)</span>
              </span>
              <span className="text-slate-800">
                All-Pt1000: <strong>€1.13/bd</strong>{' '}
                <span className="text-emerald-700">(Active · €11.56 landed)</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Locked into all schematics, BOMs, and 2D/3D drawings. Real <strong>M2 rising-cage screws</strong> with{' '}
              <strong>0 mm edge overhang</strong> for tight DIN-rail cases, only 2 THT terminal parts per board, and
              saves €1.00/bd (1-Wire) / €2.24/bd (All-Pt1000) vs the legacy layout.
            </p>
          </div>

          {/* Pluggable Alternative */}
          <div className="lg:col-span-4 p-4 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wide">
                Pluggable Alternative · 2-Second Unplugging
              </span>
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSelectedId('pluggable_381_screw');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  selectedOption.id === 'pluggable_381_screw'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {selectedOption.id === 'pluggable_381_screw' ? 'Selected' : 'Inspect Pluggable'}
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              3.81 mm Pluggable Rising-Cage Screw (2EDG / 2EDGKD)
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
              <span className="text-slate-800">
                1-Wire: <strong>€0.95/bd</strong>{' '}
                <span className="text-slate-600">(+€0.37)</span>
              </span>
              <span className="text-slate-800">
                All-Pt1000: <strong>€1.74/bd</strong>{' '}
                <span className="text-slate-600">(+€0.61)</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Best upgrade if you later want <strong>2-second tool-free unplugging</strong> while keeping M2 rising-cage
              screws. Fits both boards in <strong>31.9 mm</strong> (5.05 mm clear of H1/H3) with ~5 mm plug overhang.
            </p>
          </div>

          {/* What to Skip */}
          <div className="lg:col-span-3 p-4 space-y-2 bg-slate-50/70">
            <div className="text-[11px] font-mono font-bold text-rose-800 uppercase tracking-wide">
              Avoid on Solar Plants
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li>
                <strong className="text-slate-900">2.54 mm KF128:</strong> tiny M1.6 screws strip easily and reject
                standard 0.75 mm² Pt1000 ferrules.
              </li>
              <li>
                <strong className="text-slate-900">5.08 mm KF301:</strong> leaf-spring twists bare wire strands and
                overflows All-Pt1000 by +39.3 mm.
              </li>
              <li>
                <strong className="text-slate-900">JST-XH Crimp:</strong> max 22 AWG (0.33 mm²); requires crimping
                tool in the boiler room.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Cost Chart + CAD Cross-Section + 65×56 mm Blueprint Fit */}
      <ConnectorVisuals
        options={filteredRows}
        selected={selectedOption}
        onSelect={setSelectedId}
        onResetFilters={resetFilters}
      />

      {/* Main High-Density Comparison Spreadsheet */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-900">
            1. Terminal Block Comparison Matrix — Click any row to inspect millimeter fit &amp; part numbers below
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            Showing {filteredRows.length} of {CONNECTOR_OPTIONS.length} families · Costs in EUR ex-VAT (LCSC / EU stock)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-3 whitespace-nowrap">Connector Family</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSortClick('pitch')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    Pitch
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Clamp &amp; Screws</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Wire / Ferrule</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Service</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap border-l border-slate-200 bg-cyan-50/40 text-cyan-950">
                  1-Wire Fit (8P)
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap text-right bg-cyan-50/40 text-cyan-950">
                  <button
                    type="button"
                    onClick={() => handleSortClick('onewire_cost')}
                    className="inline-flex items-center gap-1 hover:text-cyan-700 cursor-pointer"
                  >
                    1-Wire €/bd
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap border-l border-slate-200 bg-indigo-50/40 text-indigo-950">
                  <button
                    type="button"
                    onClick={() => handleSortClick('allpt_len')}
                    className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer"
                  >
                    All-Pt1000 Fit (16P)
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap text-right bg-indigo-50/40 text-indigo-950">
                  <button
                    type="button"
                    onClick={() => handleSortClick('allpt_cost')}
                    className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer"
                  >
                    All-Pt1000 €/bd
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap border-l border-slate-200">EU Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 px-4 text-center text-slate-500">
                    No connectors match your current filter.{' '}
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-slate-900 font-semibold underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isSel = row.id === selectedOption.id;
                  const owFit = fitLabel(
                    row.onewire.fitStatus,
                    row.onewire.leftEdgeMm,
                    row.onewire.clearancePerEndMm
                  );
                  const ptFit = fitLabel(
                    row.allPt1000.fitStatus,
                    row.allPt1000.leftEdgeMm,
                    row.allPt1000.clearancePerEndMm
                  );
                  const owDelta = deltaFmt(row.onewire.deltaVsCurrentEur);
                  const ptDelta = deltaFmt(row.allPt1000.deltaVsCurrentEur);

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-orange-50/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 align-top">
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSel
                                ? 'bg-orange-600 border-orange-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                            aria-hidden="true"
                          >
                            {isSel && <Check className="w-3 h-3" />}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug">
                              {row.name}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {row.rankTag ? (
                                <span className="font-semibold text-orange-700">{row.rankTag}</span>
                              ) : null}
                              {row.rankTag ? <span className="mx-1">·</span> : null}
                              <span>{row.mounting}</span>
                              <span className="mx-1">·</span>
                              <span className="font-mono">{row.tiersAllPt1000}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {row.pitchMm.toFixed(2)} mm
                      </td>

                      <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            row.usesScrews ? 'text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {row.clampLabel}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {row.usesScrews ? row.screwSize : 'No screws'}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-800">{row.wireRangeMm2}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.awgRange} · Ferrule: {row.ferruleFriendly}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                        <div className="font-medium text-slate-800">{row.unplugTime}</div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          H {row.heightMm} · D {row.depthMm} mm
                        </div>
                      </td>

                      {/* 1-Wire Edition Columns */}
                      <td className="py-2.5 px-2.5 align-top border-l border-slate-200 bg-cyan-50/20 whitespace-nowrap">
                        <div className={`font-mono tabular-nums text-[11px] font-semibold ${owFit.cls}`}>
                          {owFit.text}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.onewire.leftEdgeParts} + {row.onewire.frontEdgeParts}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top text-right bg-cyan-50/20 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          €{row.onewire.costPerBoardEur.toFixed(2)}
                        </div>
                        <div className={`text-[11px] ${owDelta.cls}`}>{owDelta.text}</div>
                      </td>

                      {/* All-Pt1000 Edition Columns */}
                      <td className="py-2.5 px-2.5 align-top border-l border-slate-200 bg-indigo-50/20 whitespace-nowrap">
                        <div className={`font-mono tabular-nums text-[11px] font-semibold ${ptFit.cls}`}>
                          {ptFit.text}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.allPt1000.leftEdgeParts}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top text-right bg-indigo-50/20 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {row.allPt1000.fitStatus === 'overflow'
                            ? 'N/A'
                            : `€${row.allPt1000.costPerBoardEur.toFixed(2)}`}
                        </div>
                        <div className={`text-[11px] ${row.allPt1000.fitStatus === 'overflow' ? 'text-rose-700 font-semibold' : ptDelta.cls}`}>
                          {row.allPt1000.fitStatus === 'overflow' ? 'Does not fit' : ptDelta.text}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 align-top border-l border-slate-200 text-[11px] text-slate-700 whitespace-nowrap">
                        {row.availabilityEu}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Connector Deep-Dive + Millimeter Edge-Fit Visualizer + Live Batch Cost Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: Mechanical Edge-Fit Gauge & Part Details */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="text-[11px] font-mono text-slate-500">
                Selected Connector Inspector · {selectedOption.familySeries}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedOption.name}</h2>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600">
              {selectedOption.pitchMm.toFixed(2)} mm · {selectedOption.clampLabel}
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">{selectedOption.engineeringVerdict}</p>

          {/* Millimeter Edge-Fit Visualizers */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Ruler className="w-3.5 h-3.5 text-slate-500" />
              Physical Fit on the 56.0 mm HAT Left Edge (42.0 mm clear between H1 &amp; H3)
            </div>
            <EdgeFitBar
              label="1-Wire Edition (J6 8P: PT1000 + 1W-A + 1W-B = 8 sensor pins)"
              lengthMm={selectedOption.onewire.leftEdgeMm}
              status={selectedOption.onewire.fitStatus}
              detail={`${selectedOption.onewire.leftEdgeParts} · Front: ${selectedOption.onewire.frontEdgeParts}`}
            />
            <EdgeFitBar
              label="All-Pt1000 Edition (J6 8× Pt1000 = 16 sensor pins)"
              lengthMm={selectedOption.allPt1000.leftEdgeMm}
              status={selectedOption.allPt1000.fitStatus}
              detail={`${selectedOption.allPt1000.leftEdgeParts} · Front: ${selectedOption.allPt1000.frontEdgeParts}`}
            />
          </div>

          {/* Part Numbers & Pros / Cons */}
          <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-500">1-Wire Edition Ordering Parts</div>
                <div className="font-mono text-[11px] text-slate-800 mt-0.5 break-words">
                  {selectedOption.partNumbers.onewire}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">All-Pt1000 Edition Ordering Parts</div>
                <div className="font-mono text-[11px] text-slate-800 mt-0.5 break-words">
                  {selectedOption.partNumbers.allPt1000}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <div className="font-semibold text-emerald-800 mb-1">Advantages</div>
                <ul className="space-y-1 text-slate-700 list-disc pl-4">
                  {selectedOption.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-rose-800 mb-1">Trade-offs</div>
                <ul className="space-y-1 text-slate-700 list-disc pl-4">
                  {selectedOption.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 cols: Live Cost Impact & Auxiliary Connector Savings */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <div className="text-[11px] font-mono text-slate-500">
              Live BOM Delta · {batchSize}-Board Batch (incl. 19% VAT)
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              2. Projected Landed Cost Impact
            </h2>
          </div>

          {/* 2-Edition Cost Impact Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-sans">
                  <th className="py-1.5 text-left font-semibold">Metric</th>
                  <th className="py-1.5 text-right font-semibold text-cyan-900">1-Wire</th>
                  <th className="py-1.5 text-right font-semibold text-indigo-900">All-Pt1000</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 font-sans text-slate-600">Current Terminals / bd</td>
                  <td className="py-2 text-right text-slate-700">
                    €{HAT_EDGE_BUDGET.currentOnewireTermCostEur.toFixed(2)}
                  </td>
                  <td className="py-2 text-right text-slate-700">
                    €{HAT_EDGE_BUDGET.currentAllPt1000TermCostEur.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-600">Selected Terminals / bd</td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    €{selectedOption.onewire.costPerBoardEur.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {selectedOption.allPt1000.fitStatus === 'overflow'
                      ? 'Overflow'
                      : `€${selectedOption.allPt1000.costPerBoardEur.toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-600">Optional Aux Savings / bd</td>
                  <td className="py-2 text-right text-emerald-700">
                    {auxSavingsPerBoard > 0 ? `−€${auxSavingsPerBoard.toFixed(2)}` : '€0.00'}
                  </td>
                  <td className="py-2 text-right text-emerald-700">
                    {auxSavingsPerBoard > 0 ? `−€${auxSavingsPerBoard.toFixed(2)}` : '€0.00'}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2 font-sans text-slate-900">
                    Total {batchSize}-Board Delta (incl. VAT)
                  </td>
                  <td
                    className={`py-2 text-right ${
                      onewireBatchDeltaVat <= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {onewireBatchDeltaVat <= 0
                      ? `−€${Math.abs(onewireBatchDeltaVat).toFixed(2)}`
                      : `+€${onewireBatchDeltaVat.toFixed(2)}`}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      selectedOption.allPt1000.fitStatus === 'overflow'
                        ? 'text-rose-700'
                        : allPtBatchDeltaVat <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {selectedOption.allPt1000.fitStatus === 'overflow'
                      ? 'N/A'
                      : allPtBatchDeltaVat <= 0
                      ? `−€${Math.abs(allPtBatchDeltaVat).toFixed(2)}`
                      : `+€${allPtBatchDeltaVat.toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans font-semibold text-slate-900">
                    Est. 5-Bd Landed / HAT (VAT+Ship)
                  </td>
                  <td className="py-2 text-right font-bold text-slate-900">
                    €{projected5BdOnewire.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-bold text-slate-900">
                    {selectedOption.allPt1000.fitStatus === 'overflow'
                      ? 'N/A'
                      : `€${projected5BdAllPt.toFixed(2)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Auxiliary Connectors Toggle Table */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Wrench className="w-3.5 h-3.5 text-slate-500" />
              3. Optional Hardware Upgrades (Nylon H1–H4, Bare JP1 Pads &amp; 11 mm J1 Active)
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {AUX_CONNECTOR_OPTIONS.map((aux) => {
                const checked =
                  aux.id === 'j1_tall_upgrade'
                    ? useAltJ1
                    : aux.id === 'h1_h4_standoffs'
                    ? useAltStandoffs
                    : useAltJp1;
                const toggle = () => {
                  if (aux.id === 'j1_tall_upgrade') setUseAltJ1((v) => !v);
                  else if (aux.id === 'h1_h4_standoffs') setUseAltStandoffs((v) => !v);
                  else setUseAltJp1((v) => !v);
                };
                const isSaving = aux.savingsPerBoardEur >= 0;
                return (
                  <label
                    key={aux.id}
                    className="flex items-start gap-2.5 p-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={toggle}
                      className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          <span className="font-mono text-slate-600 mr-1">{aux.refDes}</span>
                          {aux.altSpec}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-semibold whitespace-nowrap ${
                            isSaving ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isSaving
                            ? `−€${aux.savingsPerBoardEur.toFixed(2)}/bd`
                            : `+€${Math.abs(aux.savingsPerBoardEur).toFixed(2)}/bd`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Replaces {aux.currentSpec} (€{aux.currentCostEur.toFixed(2)} → €{aux.altCostEur.toFixed(2)}).{' '}
                        {aux.condition}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
