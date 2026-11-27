import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  Copy,
  Cpu,
  Download,
  FileCode2,
  FileDown,
  FileSpreadsheet,
  Layers,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import {
  CostCalcOptions,
  HatEdition,
  SplitAssemblyMode,
  computeFullHatCosts,
  computeSplitOrderCosts,
  getDnpList,
  getInterBlockNets,
  getMasterBom,
  getMasterBomStats,
} from './data/masterBom';
import {
  generateFullMasterBomCsv,
  generateJlcpcbBomCsv,
  generateKicadNetlist,
  generateKicadPcbStarter,
  generateNgspiceDeck,
  generateWatchdogRealTimeSpiceDeck,
  getVerifiedBoardNets,
  getVerifiedKicadDrcReport,
  triggerTextFileDownload,
} from './utils/kicadAndSpiceExports';
import {
  buildCompleteBundleZip,
  generateKicadProjectFile,
  generateKicadRootSchematic,
  generateKicadSubsheet,
  getKicadSubsheets,
  getProjectName,
  triggerBlobDownload,
} from './utils/kicadProjectGenerator';
import { exportFullHatCostsPdfReport } from './utils/exportPdfReport';
import { computeSplitArchitectureComparison } from '../11-DiscreteVsIC/data/architectureCompareData';

export interface FullHatWorkspaceProps {
  edition?: HatEdition;
  onEditionChange?: (next: HatEdition) => void;
}

type ExportTab =
  | 'kicad_pro'
  | 'kicad_root'
  | 'sch_01'
  | 'sch_02'
  | 'sch_03'
  | 'sch_04'
  | 'sch_05'
  | 'sch_06'
  | 'kicad_pcb'
  | 'kicad_drc'
  | 'kicad_net'
  | 'ngspice'
  | 'ngspice_wd'
  | 'csv'
  | 'master_csv';

export function FullHatWorkspace({ edition: controlledEdition, onEditionChange }: FullHatWorkspaceProps = {}) {
  const [localEdition, setLocalEdition] = useState<HatEdition>('onewire');
  const edition = controlledEdition ?? localEdition;
  const setEdition = (next: HatEdition) => {
    setLocalEdition(next);
    onEditionChange?.(next);
  };
  const isAllPt = edition === 'all_pt1000';

  const [opts, setOpts] = useState<CostCalcOptions>({
    batchSize: 5,
    includeVat19: true,
    includeShipping: true,
    includeThtHardware: true,
    includeJlcpcbThtSoldering: true,
    conservative01PctFee: false,
  });
  const [splitOneWireQty, setSplitOneWireQty] = useState<number>(3);
  const [splitAllPtQty, setSplitAllPtQty] = useState<number>(3);
  const [splitAssemblyMode, setSplitAssemblyMode] = useState<SplitAssemblyMode>('jlcpcb_zero_solder');
  const [subFilter, setSubFilter] = useState<string>('ALL');
  const [exportTab, setExportTab] = useState<ExportTab>('kicad_root');
  const [copied, setCopied] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const stepSplitQty = (current: number, delta: -1 | 1): number => {
    if (delta === 1) {
      if (current === 0) return 2; // JLCPCB SMT minimum is 2 boards per active PCB design
      return Math.min(25, current + 1);
    }
    if (current <= 2) return 0;
    return current - 1;
  };

  const masterBom = useMemo(() => getMasterBom(edition), [edition]);
  const dnpList = useMemo(() => getDnpList(edition), [edition]);
  const interNets = useMemo(() => getInterBlockNets(edition), [edition]);
  const stats = useMemo(() => getMasterBomStats(edition), [edition]);
  const netCount = useMemo(() => getVerifiedBoardNets(edition).length, [edition]);
  const totalParts = stats.smdPartCount + stats.thtPartCount;
  const costs = useMemo(() => computeFullHatCosts(opts, edition), [opts, edition]);
  const b2 = useMemo(() => computeFullHatCosts({ ...opts, batchSize: 2 }, edition), [opts, edition]);
  const b5 = useMemo(() => computeFullHatCosts({ ...opts, batchSize: 5 }, edition), [opts, edition]);
  const b10 = useMemo(() => computeFullHatCosts({ ...opts, batchSize: 10 }, edition), [opts, edition]);
  const b25 = useMemo(() => computeFullHatCosts({ ...opts, batchSize: 25 }, edition), [opts, edition]);

  const splitBaseOpts = useMemo(
    () => ({
      includeVat19: opts.includeVat19,
      includeShipping: opts.includeShipping,
      includeThtHardware: opts.includeThtHardware,
      conservative01PctFee: opts.conservative01PctFee,
    }),
    [opts.includeVat19, opts.includeShipping, opts.includeThtHardware, opts.conservative01PctFee]
  );

  const splitDiy = useMemo(
    () => computeSplitOrderCosts(splitOneWireQty, splitAllPtQty, splitBaseOpts, 'diy_tht'),
    [splitOneWireQty, splitAllPtQty, splitBaseOpts]
  );
  const splitZeroSolder = useMemo(
    () => computeSplitOrderCosts(splitOneWireQty, splitAllPtQty, splitBaseOpts, 'jlcpcb_zero_solder'),
    [splitOneWireQty, splitAllPtQty, splitBaseOpts]
  );
  const splitActive = splitAssemblyMode === 'jlcpcb_zero_solder' ? splitZeroSolder : splitDiy;
  const singleDesign5AllPtZero = useMemo(
    () => computeSplitOrderCosts(0, 5, splitBaseOpts, 'jlcpcb_zero_solder'),
    [splitBaseOpts]
  );
  const splitArchCompare = useMemo(
    () => computeSplitArchitectureComparison(splitOneWireQty, splitAllPtQty, splitAssemblyMode),
    [splitOneWireQty, splitAllPtQty, splitAssemblyMode]
  );

  const filteredBom = useMemo(() => {
    if (subFilter === 'ALL') return masterBom;
    if (subFilter === 'THT') return masterBom.filter((l) => l.bomClass === 'THT');
    return masterBom.filter((l) => l.subsystems.includes(subFilter));
  }, [subFilter, masterBom]);

  const exportPayloads = useMemo(() => {
    const projName = getProjectName(edition);
    const subsheets = getKicadSubsheets(edition);
    const subsheetMap = Object.fromEntries(
      subsheets.map((s) => [
        `sch_${s.id}`,
        {
          filename: s.filename,
          mime: 'text/plain;charset=utf-8',
          label: `${s.shortLabel} (.kicad_sch)`,
          content: generateKicadSubsheet(s.id, edition),
        },
      ])
    ) as Record<
      'sch_01' | 'sch_02' | 'sch_03' | 'sch_04' | 'sch_05' | 'sch_06',
      { filename: string; mime: string; label: string; content: string }
    >;

    return {
      kicad_pro: {
        filename: `${projName}.kicad_pro`,
        mime: 'application/json;charset=utf-8',
        label: 'Project (.kicad_pro)',
        content: generateKicadProjectFile(edition),
      },
      kicad_root: {
        filename: `${projName}.kicad_sch`,
        mime: 'text/plain;charset=utf-8',
        label: 'Root Sheet (.kicad_sch)',
        content: generateKicadRootSchematic(edition),
      },
      ...subsheetMap,
      kicad_pcb: {
        filename: `${projName}.kicad_pcb`,
        mime: 'text/plain;charset=utf-8',
        label: 'HAT Board (.kicad_pcb)',
        content: generateKicadPcbStarter(edition),
      },
      kicad_drc: {
        filename: `${projName}_KiCad_DRC_Report.rpt`,
        mime: 'text/plain;charset=utf-8',
        label: 'KiCad DRC (.rpt)',
        content: getVerifiedKicadDrcReport(edition),
      },
      kicad_net: {
        filename: `${projName}.net`,
        mime: 'text/plain;charset=utf-8',
        label: 'Netlist (.net)',
        content: generateKicadNetlist(edition),
      },
      ngspice: {
        filename: `${projName}_Full_Sim.cir`,
        mime: 'text/plain;charset=utf-8',
        label: 'Full SPICE (.cir)',
        content: generateNgspiceDeck(edition),
      },
      ngspice_wd: {
        filename: `${projName}_Watchdog_RealTime.cir`,
        mime: 'text/plain;charset=utf-8',
        label: 'Watchdog Real-Time (.cir)',
        content: generateWatchdogRealTimeSpiceDeck(edition),
      },
      csv: {
        filename: `${projName}_JLCPCB_BOM.csv`,
        mime: 'text/csv;charset=utf-8',
        label: 'JLCPCB BOM (.csv)',
        content: generateJlcpcbBomCsv(edition),
      },
      master_csv: {
        filename: `${projName}_Full_Master_BOM.csv`,
        mime: 'text/csv;charset=utf-8',
        label: 'Master BOM (.csv)',
        content: generateFullMasterBomCsv(edition),
      },
    };
  }, [edition]);

  const activeExport = exportPayloads[exportTab];

  const handleDownloadCompleteZip = async () => {
    if (zipBusy) return;
    setZipBusy(true);
    try {
      const blob = await buildCompleteBundleZip(opts, edition);
      const dateStr = new Date().toISOString().slice(0, 10);
      const projName = getProjectName(edition);
      triggerBlobDownload(`${projName}_KiCad10_Complete_Bundle_${dateStr}.zip`, blob);
    } finally {
      setZipBusy(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(activeExport.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const maxPerBoard = Math.max(costs.revAPreD25.perBoardEur, 1);

  return (
    <div className="space-y-5">
      {/* Executive Dark Header Strip (Tab 05 Design System) */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 08 · FULL-HAT ROLL-UP (ALL 6 SUBSYSTEMS)</span>
            <span>·</span>
            <span className="tabular-nums">
              {stats.smdPartCount} SMD ({stats.basicLines} Basic + {stats.preferredLines} Pref + {stats.extendedLines} Ext) + {stats.thtPartCount} THT · €{costs.revBGemini.extendedFeesOrderEur.toFixed(2)} Ext
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Full-HAT Costs, Master BOM, KiCad 10 &amp; ngspice —{' '}
            {isAllPt
              ? 'All-Pt1000 Edition (8× Mux · DG350D 2×8P Screw)'
              : '1-Wire Edition (1× Pt1000 + 2× 1-Wire · DG350 8P Screw)'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            {isAllPt
              ? `Reuses the Tab 01 Pt1000 RC-ramp engine (ONE C7955 LM393DR2G + 3× 0.1% thin-film Extended bridge — bench-unproven vs MAX31865) across 8 channels on J6 DG350D-3.5-08P (${stats.uniqueSmdReels} SMD reels: ${stats.basicLines} Basic + ${stats.preferredLines} Preferred + ${stats.extendedLines} Extended = €${costs.revBGemini.extendedFeesOrderEur.toFixed(2)}). Pre-filled B.Cu zones & KiCad DRC 0/0/0 verified.`
              : `Consolidated JLCPCB Economic PCBA cost estimator with 100% live-audited LCSC/MPN/Tolerance/Class (${stats.uniqueSmdReels} SMD reels: ${stats.basicLines} Basic + ${stats.preferredLines} Preferred + ${stats.extendedLines} Extended = €${costs.revBGemini.extendedFeesOrderEur.toFixed(2)}), pre-filled B.Cu zones & KiCad DRC 0/0/0 report, official TI LM393 + real-time unscaled Watchdog SPICE, and Proposed Changes vs. D18/D25.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={zipBusy}
            onClick={handleDownloadCompleteZip}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap cursor-pointer"
          >
            {zipBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            {zipBusy ? 'Packing KiCad 10 + PDFs…' : `Download Bundle (.zip · ${isAllPt ? '22' : '23'} Files)`}
          </button>
          <button
            type="button"
            onClick={() => exportFullHatCostsPdfReport(opts, edition)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            Costs PDF (6p)
          </button>
        </div>
      </div>

      {/* Sub-Navigation Bar: Edition Switcher + Quick File Exports */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'onewire', label: '1-Wire Edition (1× Pt1000 + 2× 1-Wire · 8P)' },
              { id: 'all_pt1000', label: 'All-Pt1000 Edition (8× Pt1000 · 2×8P)' },
            ] as const
          ).map((ed) => (
            <button
              key={ed.id}
              type="button"
              onClick={() => setEdition(ed.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                edition === ed.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ed.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              triggerTextFileDownload(exportPayloads.csv.filename, exportPayloads.csv.content, exportPayloads.csv.mime)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            JLCPCB CSV
          </button>
          <button
            type="button"
            onClick={() =>
              triggerTextFileDownload(exportPayloads.kicad_pcb.filename, exportPayloads.kicad_pcb.content)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition whitespace-nowrap cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-700" />
            .kicad_pcb
          </button>
          <button
            type="button"
            onClick={() =>
              triggerTextFileDownload(exportPayloads.ngspice.filename, exportPayloads.ngspice.content)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition whitespace-nowrap cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-violet-700" />
            ngspice .cir
          </button>
        </div>
      </div>

      {/* Cost Calculator Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-500 uppercase">Batch Size:</span>
          {([2, 5, 10, 25] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOpts((o) => ({ ...o, batchSize: n }))}
              className={`px-3 py-1 text-xs font-mono font-bold rounded border cursor-pointer transition-colors ${
                opts.batchSize === n
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {n}× Boards
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-emerald-900">
            <input
              type="checkbox"
              checked={Boolean(opts.includeJlcpcbThtSoldering)}
              onChange={(e) => {
                const checked = e.target.checked;
                setOpts((o) => ({
                  ...o,
                  includeJlcpcbThtSoldering: checked,
                  includeThtHardware: checked ? true : o.includeThtHardware,
                }));
                setSplitAssemblyMode(checked ? 'jlcpcb_zero_solder' : 'diy_tht');
              }}
              className="accent-emerald-700"
            />
            <span>JLCPCB THT Soldering (Turnkey · +€{costs.revBGemini.thtSolderingOrderEur > 0 ? costs.revBGemini.thtSolderingOrderEur.toFixed(2) : (26.3 + costs.revBGemini.thtPinsPerBoard * opts.batchSize * 0.016).toFixed(2)})</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={opts.includeThtHardware}
              onChange={(e) => {
                const checked = e.target.checked;
                setOpts((o) => ({
                  ...o,
                  includeThtHardware: checked,
                  includeJlcpcbThtSoldering: checked ? o.includeJlcpcbThtSoldering : false,
                }));
                if (!checked) setSplitAssemblyMode('diy_tht');
              }}
              className="accent-slate-900"
            />
            <span>THT Parts (€{stats.thtHardwarePerBoardEur.toFixed(2)}/bd)</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={opts.includeShipping}
              onChange={(e) => setOpts((o) => ({ ...o, includeShipping: e.target.checked }))}
              className="accent-slate-900"
            />
            <span>EU Shipping (€14.50)</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={opts.includeVat19}
              onChange={(e) => setOpts((o) => ({ ...o, includeVat19: e.target.checked }))}
              className="accent-slate-900"
            />
            <span>19% EU/DE VAT</span>
          </label>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[11px] font-semibold">
            {stats.extendedLines} Audited Extended Reels (€{costs.revBGemini.extendedFeesOrderEur.toFixed(2)} incl.)
          </span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-300 rounded-lg p-3.5">
          <div className="text-[11px] font-mono font-bold text-emerald-800 uppercase">
            {costs.revBGemini.label} ({opts.batchSize}×)
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-950 mt-1 tabular-nums">
            €{costs.revBGemini.perBoardEur.toFixed(2)}
            <span className="text-xs font-normal text-emerald-700"> / board</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-800 mt-1 tabular-nums">
            Order Total: €{costs.revBGemini.grandTotalOrderEur.toFixed(2)} (€{costs.revBGemini.extendedFeesOrderEur.toFixed(2)} Ext · {costs.revBGemini.extendedReelCount} reels)
          </div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5">
          <div className="text-[11px] font-mono font-bold text-amber-800 uppercase">
            {costs.revAD25Repo.label} ({opts.batchSize}×)
          </div>
          <div className="text-2xl font-mono font-bold text-amber-950 mt-1 tabular-nums">
            €{costs.revAD25Repo.perBoardEur.toFixed(2)}
            <span className="text-xs font-normal text-amber-700"> / board</span>
          </div>
          <div className="text-[11px] font-mono text-amber-800 mt-1 tabular-nums">
            Order Total: €{costs.revAD25Repo.grandTotalOrderEur.toFixed(2)} (€{costs.revAD25Repo.extendedFeesOrderEur.toFixed(2)} Ext · {costs.revAD25Repo.extendedReelCount} reel{costs.revAD25Repo.extendedReelCount === 1 ? '' : 's'})
          </div>
        </div>

        <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3.5">
          <div className="text-[11px] font-mono font-bold text-rose-800 uppercase">
            {costs.revAPreD25.label} ({opts.batchSize}×)
          </div>
          <div className="text-2xl font-mono font-bold text-rose-950 mt-1 tabular-nums">
            €{costs.revAPreD25.perBoardEur.toFixed(2)}
            <span className="text-xs font-normal text-rose-700"> / board</span>
          </div>
          <div className="text-[11px] font-mono text-rose-800 mt-1 tabular-nums">
            Order Total: €{costs.revAPreD25.grandTotalOrderEur.toFixed(2)} (€{costs.revAPreD25.extendedFeesOrderEur.toFixed(2)} Ext · {costs.revAPreD25.extendedReelCount} reels)
          </div>
        </div>

        {(() => {
          const deltaVsD25 = costs.revBGemini.grandTotalOrderEur - costs.revAD25Repo.grandTotalOrderEur;
          const deltaVsPre = costs.revBGemini.grandTotalOrderEur - costs.revAPreD25.grandTotalOrderEur;
          const isCheaper = deltaVsD25 <= 0;
          const fmtSigned = (v: number) => `${v <= 0 ? '-' : '+'}€${Math.abs(v).toFixed(2)}`;
          return (
            <div
              className={`rounded-lg p-3.5 border ${
                isCheaper
                  ? 'bg-blue-50/70 border-blue-200'
                  : 'bg-amber-50/80 border-amber-300'
              }`}
            >
              <div
                className={`text-[11px] font-mono font-bold uppercase ${
                  isCheaper ? 'text-blue-800' : 'text-amber-900'
                }`}
              >
                Net Delta vs {isAllPt ? '1×MAX+Mux' : 'Repo D25'} ({opts.batchSize}×)
              </div>
              <div
                className={`text-2xl font-mono font-bold mt-1 tabular-nums ${
                  isCheaper ? 'text-blue-950' : 'text-amber-950'
                }`}
              >
                {fmtSigned(deltaVsD25)}
              </div>
              <div
                className={`text-[11px] font-mono mt-1 tabular-nums ${
                  isCheaper ? 'text-blue-800' : 'text-amber-900'
                }`}
              >
                {isCheaper ? 'Cheaper' : 'More expensive'} vs {isAllPt ? '1×MAX+Mux' : 'D25 (1 Ext reel)'} · {fmtSigned(deltaVsPre)} vs {isAllPt ? '8×MAX' : 'Pre-D25'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Cost Breakdown Table + Visual Volume Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-sm font-semibold text-slate-900">
              Line-by-Line Expected JLCPCB &amp; Hardware Cost ({opts.batchSize}× Boards)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-mono text-[11px]">
                  <th className="px-3 py-2">Cost Line Item</th>
                  <th className="px-3 py-2 text-right">{isAllPt ? '8× MAX31865' : 'Pre-D25'}</th>
                  <th className="px-3 py-2 text-right">{isAllPt ? '1× MAX + 8Ch Mux' : 'Repo D25'}</th>
                  <th className="px-3 py-2 text-right bg-emerald-900">{isAllPt ? 'All-Pt1000 8× Mux' : 'Rev B/D/E 1-Wire'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11.5px]">
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">2-Layer 65×56 mm PCB Fab (5 pcs min)</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.pcbFabOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.pcbFabOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{costs.revBGemini.pcbFabOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">Economic PCBA Setup + Stencil (1-side)</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.smtSetupAndStencilEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.smtSetupAndStencilEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{costs.revBGemini.smtSetupAndStencilEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">SMT Solder Joints ({stats.smdJointsPerBoard}/bd)</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.solderJointsOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.solderJointsOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{costs.revBGemini.solderJointsOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">Extended Reel Feeder Loading Fees</td>
                  <td className="px-3 py-1.5 text-right text-rose-700">€{costs.revAPreD25.extendedFeesOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right text-amber-700">€{costs.revAD25Repo.extendedFeesOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-bold text-emerald-800">€{costs.revBGemini.extendedFeesOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">Populated SMD Components ({opts.batchSize}×)</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.smdPartsOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.smdPartsOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold text-emerald-800">€{costs.revBGemini.smdPartsOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">THT Header, Screw Terminals &amp; Standoffs</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.thtHardwareOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.thtHardwareOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{costs.revBGemini.thtHardwareOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">
                    JLCPCB THT Soldering (Std PCBA + Wave + 3× THT Ext + {costs.revBGemini.thtPinsPerBoard} pins/bd)
                  </td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAPreD25.thtSolderingOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{costs.revAD25Repo.thtSolderingOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{costs.revBGemini.thtSolderingOrderEur.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-sans text-slate-800">EU Shipping + 19% VAT</td>
                  <td className="px-3 py-1.5 text-right">€{(costs.revAPreD25.shippingOrderEur + costs.revAPreD25.vatEur).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€{(costs.revAD25Repo.shippingOrderEur + costs.revAD25Repo.vatEur).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right bg-emerald-50/40 font-semibold">€{(costs.revBGemini.shippingOrderEur + costs.revBGemini.vatEur).toFixed(2)}</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-3 py-2 font-sans text-slate-900">Grand Total ({opts.batchSize}× Order)</td>
                  <td className="px-3 py-2 text-right">€{costs.revAPreD25.grandTotalOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">€{costs.revAD25Repo.grandTotalOrderEur.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right bg-emerald-100 text-emerald-950">€{costs.revBGemini.grandTotalOrderEur.toFixed(2)}</td>
                </tr>
                <tr className="bg-emerald-50/70 font-bold">
                  <td className="px-3 py-2 font-sans text-emerald-950">Landed Cost Per Board</td>
                  <td className="px-3 py-2 text-right text-rose-800">€{costs.revAPreD25.perBoardEur.toFixed(2)}/bd</td>
                  <td className="px-3 py-2 text-right text-amber-800">€{costs.revAD25Repo.perBoardEur.toFixed(2)}/bd</td>
                  <td className="px-3 py-2 text-right bg-emerald-600 text-white">€{costs.revBGemini.perBoardEur.toFixed(2)}/bd</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Per-Board Landed Cost Comparison ({opts.batchSize}× Batch)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAllPt
                ? `Audited ${stats.extendedLines} Extended reels (€${costs.revBGemini.extendedFeesOrderEur.toFixed(2)}) vs 8× MAX31865 silicon cost — discrete 8-ch mux wins strongly on 8 channels, though RC-ramp accuracy (±1.55 K) is bench-unproven.`
                : `Honest comparison: Rev B/D/E carries ${stats.extendedLines} audited Extended reels (€${costs.revBGemini.extendedFeesOrderEur.toFixed(2)}) vs Repo D25's 1 Extended reel (MAX31865 €2.80), so D25 is cheaper at 2–5× while discrete catches up only at higher volume.`}
            </p>

            <div className="mt-4 space-y-3">
              {[
                { label: costs.revAPreD25.label, val: costs.revAPreD25.perBoardEur, bar: 'bg-rose-500' },
                { label: costs.revAD25Repo.label, val: costs.revAD25Repo.perBoardEur, bar: 'bg-amber-500' },
                { label: costs.revBGemini.label, val: costs.revBGemini.perBoardEur, bar: 'bg-emerald-600' },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-sans font-semibold text-slate-800">{row.label}</span>
                    <span className="font-bold text-slate-900">€{row.val.toFixed(2)}/bd</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded overflow-hidden border border-slate-200">
                    <div
                      className={`h-full ${row.bar} transition-all`}
                      style={{ width: `${Math.max(8, (row.val / maxPerBoard) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-900 mb-2">Batch Volume Scaling (Gemini Rev B/D/E)</div>
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              {[
                { n: '2×', r: b2.revBGemini },
                { n: '5×', r: b5.revBGemini },
                { n: '10×', r: b10.revBGemini },
                { n: '25×', r: b25.revBGemini },
              ].map((item) => (
                <div
                  key={item.n}
                  className={`p-2 rounded border ${
                    item.n === `${opts.batchSize}×`
                      ? 'bg-emerald-50 border-emerald-400'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 font-bold">{item.n}</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">€{item.r.perBoardEur.toFixed(2)}</div>
                  <div className="text-[9.5px] text-slate-500">€{item.r.grandTotalOrderEur.toFixed(0)} tot</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mixed / Split Order Combined JLCPCB Cart Calculator (e.g. 3× 1-Wire + 3× All-Pt1000) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShoppingCart className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Mixed / Split Order Combined JLCPCB Cart Calculator (Two Separate PCB Designs in One Shipment)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Models ordering both the <span className="font-semibold text-emerald-800">1-Wire HAT</span> and{' '}
                <span className="font-semibold text-blue-800">All-Pt1000 HAT</span> together in a single JLCPCB checkout
                (min 5 bare PCBs + min 2 assembled PCBA per active design; unused bare PCBs ship free as spares; combined EU shipping paid once).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { label: '3× 1-Wire + 3× All-Pt1000', ow: 3, pt: 3 },
                { label: '2× + 2×', ow: 2, pt: 2 },
                { label: '5× + 5×', ow: 5, pt: 5 },
                { label: '0 + 5× All-Pt1000', ow: 0, pt: 5 },
              ] as const
            ).map((p) => {
              const active = splitOneWireQty === p.ow && splitAllPtQty === p.pt;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSplitOneWireQty(p.ow);
                    setSplitAllPtQty(p.pt);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded border cursor-pointer transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Quantity Steppers & Assembly Mode Switch */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            <div className="lg:col-span-4 border border-emerald-200 bg-emerald-50/40 rounded-md p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-950">1-Wire HAT Quantity</div>
                <div className="text-[11px] font-mono text-emerald-800 tabular-nums mt-0.5">
                  {splitOneWireQty > 0
                    ? `${splitOneWireQty} assembled · ${splitOneWireQty <= 5 ? 5 : splitOneWireQty <= 10 ? 10 : Math.ceil(splitOneWireQty / 5) * 5} bare PCBs (${Math.max(0, (splitOneWireQty <= 5 ? 5 : splitOneWireQty <= 10 ? 10 : Math.ceil(splitOneWireQty / 5) * 5) - splitOneWireQty)} spares)`
                    : 'Not included in cart (0)'}
                </div>
              </div>
              <div className="inline-flex items-center border border-emerald-300 bg-white rounded-md overflow-hidden">
                <button
                  type="button"
                  aria-label="Decrease 1-Wire HAT quantity"
                  disabled={splitOneWireQty === 0}
                  onClick={() => setSplitOneWireQty((q) => stepSplitQty(q, -1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 py-1.5 text-sm font-mono font-bold text-slate-900 tabular-nums border-x border-emerald-200 min-w-[2.5rem] text-center">
                  {splitOneWireQty}
                </span>
                <button
                  type="button"
                  aria-label="Increase 1-Wire HAT quantity"
                  disabled={splitOneWireQty >= 25}
                  onClick={() => setSplitOneWireQty((q) => stepSplitQty(q, 1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 border border-blue-200 bg-blue-50/40 rounded-md p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-blue-950">All-Pt1000 HAT Quantity</div>
                <div className="text-[11px] font-mono text-blue-800 tabular-nums mt-0.5">
                  {splitAllPtQty > 0
                    ? `${splitAllPtQty} assembled · ${splitAllPtQty <= 5 ? 5 : splitAllPtQty <= 10 ? 10 : Math.ceil(splitAllPtQty / 5) * 5} bare PCBs (${Math.max(0, (splitAllPtQty <= 5 ? 5 : splitAllPtQty <= 10 ? 10 : Math.ceil(splitAllPtQty / 5) * 5) - splitAllPtQty)} spares)`
                    : 'Not included in cart (0)'}
                </div>
              </div>
              <div className="inline-flex items-center border border-blue-300 bg-white rounded-md overflow-hidden">
                <button
                  type="button"
                  aria-label="Decrease All-Pt1000 HAT quantity"
                  disabled={splitAllPtQty === 0}
                  onClick={() => setSplitAllPtQty((q) => stepSplitQty(q, -1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 py-1.5 text-sm font-mono font-bold text-slate-900 tabular-nums border-x border-blue-200 min-w-[2.5rem] text-center">
                  {splitAllPtQty}
                </span>
                <button
                  type="button"
                  aria-label="Increase All-Pt1000 HAT quantity"
                  disabled={splitAllPtQty >= 25}
                  onClick={() => setSplitAllPtQty((q) => stepSplitQty(q, 1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 border border-slate-200 bg-slate-50/70 rounded-md p-3 flex flex-col justify-between gap-1.5">
              <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase">
                THT Assembly Service
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSplitAssemblyMode('diy_tht')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded border text-left cursor-pointer transition-colors ${
                    splitAssemblyMode === 'diy_tht'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>DIY 3-Part THT</div>
                  <div className={`text-[10px] font-mono tabular-nums ${splitAssemblyMode === 'diy_tht' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    €{splitDiy.grandTotalOrderEur.toFixed(2)} total
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitAssemblyMode('jlcpcb_zero_solder')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded border text-left cursor-pointer transition-colors ${
                    splitAssemblyMode === 'jlcpcb_zero_solder'
                      ? 'bg-indigo-700 text-white border-indigo-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>100% Zero-Solder</div>
                  <div className={`text-[10px] font-mono tabular-nums ${splitAssemblyMode === 'jlcpcb_zero_solder' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    €{splitZeroSolder.grandTotalOrderEur.toFixed(2)} total
                  </div>
                </button>
              </div>
            </div>
          </div>

          {splitActive.totalAssembledHats === 0 ? (
            <div className="border border-slate-200 rounded-md p-4 text-xs text-slate-600 font-mono">
              Add at least 2 boards of either HAT edition above to calculate combined JLCPCB checkout pricing.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Split Order Line-Item Table */}
              <div className="xl:col-span-8 border border-slate-200 rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-mono text-[11px]">
                        <th className="px-3 py-2">Combined Cart Line Item</th>
                        {splitActive.lines.map((line) => (
                          <th key={line.edition} className="px-3 py-2 text-right">
                            {line.assembledQty}× {line.edition === 'all_pt1000' ? 'All-Pt1000' : '1-Wire'}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right bg-slate-800">
                          Cart Total ({splitActive.totalAssembledHats} HATs)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11.5px] tabular-nums">
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          2-Layer 65×56 mm Bare PCBs ({splitActive.totalBarePcbs} ordered · {splitActive.totalSpareBarePcbs} free spares)
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right">
                            €{line.pcbFabEur.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{splitActive.pcbFabOrderEur.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          Economic PCBA Setup + Stencil (€8.80 per active PCB design)
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right">
                            €{line.smtSetupEur.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{splitActive.smtSetupOrderEur.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          SMD Components + SMT Solder Joints + Ext Fees (€{splitActive.extendedFeesOrderEur.toFixed(2)})
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right">
                            €{(line.smdPartsEur + line.smtJointsEur + line.extendedFeesEur).toFixed(2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{(splitActive.smdPartsOrderEur + splitActive.smtJointsOrderEur + splitActive.extendedFeesOrderEur).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          THT Hardware (J1 11mm Header, J2/J6 DG350 Screw Terminals, Nylon Standoffs)
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right">
                            €{line.thtHardwareEur.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{splitActive.thtHardwareOrderEur.toFixed(2)}
                        </td>
                      </tr>
                      {splitAssemblyMode === 'jlcpcb_zero_solder' && (
                        <tr className="bg-indigo-50/40">
                          <td className="px-3 py-1.5 font-sans text-indigo-950 font-medium">
                            JLCPCB Zero-Solder THT Service (+€26.30/design + €0.016/pin)
                          </td>
                          {splitActive.lines.map((line) => (
                            <td key={line.edition} className="px-3 py-1.5 text-right text-indigo-900">
                              €{line.zeroSolderUpgradeEur.toFixed(2)}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right bg-indigo-50 font-bold text-indigo-950">
                            €{splitActive.zeroSolderOrderEur.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          Combined EU Tracked Shipping{' '}
                          {splitActive.shippingSavedVsSeparateEur > 0 && (
                            <span className="font-mono text-[10.5px] text-emerald-700 font-semibold">
                              (saves €{splitActive.shippingSavedVsSeparateEur.toFixed(2)} ex-VAT vs 2 separate orders)
                            </span>
                          )}
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right text-slate-400">
                            shared
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{splitActive.combinedShippingEur.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans text-slate-800">
                          Subtotal ex-VAT / 19% EU VAT ({opts.includeVat19 ? 'included' : 'excluded'})
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-1.5 text-right text-slate-600">
                            €{line.lineSubtotalExVatEur.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right bg-slate-50 font-semibold">
                          €{splitActive.subtotalExVatEur.toFixed(2)} + €{splitActive.vatEur.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold text-slate-950">
                        <td className="px-3 py-2 font-sans">
                          Grand Total Checkout ({splitActive.totalAssembledHats} Assembled HATs)
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-2 text-right text-slate-600 font-normal text-[11px]">
                            {line.assembledQty} pcs + {line.spareBarePcbs} bare
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right bg-emerald-100 text-emerald-950">
                          €{splitActive.grandTotalOrderEur.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50/70 font-bold">
                        <td className="px-3 py-2 font-sans text-emerald-950">
                          Effective Landed Cost per Assembled HAT
                        </td>
                        {splitActive.lines.map((line) => (
                          <td key={line.edition} className="px-3 py-2 text-right text-slate-500 font-normal text-[11px]">
                            {line.thtPinsPerBoard} THT pins/bd
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right bg-emerald-700 text-white">
                          €{splitActive.perHatLandedEur.toFixed(2)}/HAT
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Side-by-Side DIY vs Zero-Solder Summary & Cost-Saving Insight */}
              <div className="xl:col-span-4 flex flex-col justify-between gap-3">
                <div className="border border-slate-200 rounded-md p-3.5 space-y-2.5 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-900">
                    DIY 3-Part THT vs. JLCPCB 100% Zero-Solder ({splitOneWireQty}× 1-Wire + {splitAllPtQty}× All-Pt1000)
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                    <div className="p-2.5 rounded border border-emerald-200 bg-white">
                      <div className="text-[10px] font-bold uppercase text-emerald-800">DIY 3-Part THT</div>
                      <div className="text-lg font-bold text-slate-950 mt-0.5">
                        €{splitDiy.grandTotalOrderEur.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-emerald-800 font-semibold">
                        €{splitDiy.perHatLandedEur.toFixed(2)} / HAT
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-sans">
                        Solder J1, J2, J6 yourself
                      </div>
                    </div>
                    <div className="p-2.5 rounded border border-indigo-200 bg-white">
                      <div className="text-[10px] font-bold uppercase text-indigo-800">100% Zero-Solder</div>
                      <div className="text-lg font-bold text-slate-950 mt-0.5">
                        €{splitZeroSolder.grandTotalOrderEur.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-indigo-800 font-semibold">
                        €{splitZeroSolder.perHatLandedEur.toFixed(2)} / HAT
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-sans">
                        +€{(splitZeroSolder.grandTotalOrderEur - splitDiy.grandTotalOrderEur).toFixed(2)} turnkey
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-amber-200 bg-amber-50/60 rounded-md p-3.5 text-xs text-amber-950 space-y-1.5">
                  <div className="font-semibold text-amber-900">
                    Zero-Solder 2-Design Overhead Note
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-amber-950/90">
                    For <span className="font-semibold">DIY 3-Part THT</span>, splitting {splitOneWireQty}× + {splitAllPtQty}× only adds one extra €2.00 PCB fab + €8.80 Economic setup (€12.85 incl. VAT).
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-amber-950/90">
                    For <span className="font-semibold">100% Zero-Solder</span>, JLCPCB charges Standard PCBA + Wave THT setup (+€26.30 ex-VAT) <span className="underline">per separate PCB design</span>. Ordering <span className="font-mono font-semibold tabular-nums">5× All-Pt1000</span> alone as 100% Zero-Solder costs only{' '}
                    <span className="font-mono font-bold tabular-nums">
                      €{singleDesign5AllPtZero.grandTotalOrderEur.toFixed(2)} (€{singleDesign5AllPtZero.perHatLandedEur.toFixed(2)}/HAT)
                    </span>
                    {splitActive.activeDesignCount === 2 && (
                      <>
                        {' '}— saving{' '}
                        <span className="font-mono font-bold tabular-nums">
                          €{(splitZeroSolder.grandTotalOrderEur - singleDesign5AllPtZero.grandTotalOrderEur).toFixed(2)}
                        </span>{' '}
                        compared to a 2-design Zero-Solder split.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {splitActive.totalAssembledHats > 0 && (
            <div className="border-t border-slate-200 pt-3.5 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-xs font-semibold text-slate-900">
                  Architecture Comparison for This Mixed Cart ({splitAllPtQty}× All-Pt1000 + {splitOneWireQty}× 1-Wire ·{' '}
                  {splitAssemblyMode === 'jlcpcb_zero_solder' ? '100% Zero-Solder Turnkey' : 'DIY 3-Part THT'} · incl. shipping &amp; 19% VAT)
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Synced with Tab 11 (Discrete vs. IC)
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border border-slate-200 rounded-md bg-slate-50/60 font-mono tabular-nums">
                {splitArchCompare.map((arch, idx) => (
                  <div key={arch.id} className={`p-3 space-y-0.5 ${idx === 0 ? 'bg-emerald-50/40' : ''}`}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-sans font-semibold text-slate-900">{arch.shortName}</span>
                      <span className={`text-[11px] font-semibold ${idx === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {idx === 0 ? 'Lowest Cost' : `+€${arch.deltaTotalVsDiscreteEur.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-slate-950">€{arch.grandTotalOrderEur.toFixed(2)}</span>
                      <span className="text-[11px] text-slate-600">(€{arch.perHatLandedEur.toFixed(2)}/HAT)</span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-sans">
                      SMD €{arch.smdPartsOrderEur.toFixed(2)} · {arch.totalExtendedReelCount} Ext reels (€{arch.extendedFeesOrderEur.toFixed(2)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KiCad 10 Hierarchical Project + ngspice + JLCPCB Interactive Export Studio */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  KiCad 10 Hierarchical Project (6 Wired Circuit Sheets), ngspice &amp; All-Downloadables Bundle
                </h2>
                <p className="text-xs text-slate-500">
                  Complete ZIP packs <span className="font-mono">.kicad_pro</span> + root + 6 wired <span className="font-mono">.kicad_sch</span> sheets ({totalParts} parts, {netCount} nets) + pre-filled <span className="font-mono">.kicad_pcb</span> + verbatim <span className="font-mono">KiCad DRC .rpt</span> + <span className="font-mono">.net</span> + JLCPCB/Master CSVs + Full &amp; Real-Time Watchdog <span className="font-mono">.cir</span> + all {isAllPt ? '6' : '7'} PDF reports
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={zipBusy}
              onClick={handleDownloadCompleteZip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 rounded shadow-xs cursor-pointer"
            >
              {zipBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              {zipBusy ? 'Building ZIP…' : 'Download All (.zip)'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-mono font-bold uppercase text-slate-500 mr-1">
              KiCad 10 Sheets:
            </span>
            {(['kicad_pro', 'kicad_root', 'sch_01', 'sch_02', 'sch_03', 'sch_04', 'sch_05', 'sch_06'] as ExportTab[]).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExportTab(t)}
                  className={`px-2 py-1 text-[11px] font-mono font-semibold rounded border cursor-pointer ${
                    exportTab === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {exportPayloads[t].label}
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-mono font-bold uppercase text-slate-500 mr-1">
              Board / DRC / Sim / BOM:
            </span>
            {(['kicad_pcb', 'kicad_drc', 'kicad_net', 'ngspice', 'ngspice_wd', 'csv', 'master_csv'] as ExportTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExportTab(t)}
                className={`px-2 py-1 text-[11px] font-mono font-semibold rounded border cursor-pointer ${
                  exportTab === t
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {exportPayloads[t].label}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-emerald-300 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950">
            <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-bold">Pre-Filled Zones &amp; Real KiCad DRC Verified (No Press-B Needed):</span> The exported{' '}
              <span className="font-mono font-semibold">.kicad_pcb</span> already embeds exact KiCad{' '}
              <span className="font-mono">pcbnew.ZONE_FILLER</span>{' '}
              <span className="font-mono">(filled_polygon ...)</span> blocks for Priority-2{' '}
              <span className="font-mono font-semibold">AGND</span> and Priority-1{' '}
              <span className="font-mono font-semibold">GND</span> on <span className="font-mono">B.Cu</span> ({isAllPt ? '93' : '33'} polygons @ 0.0001 mm) and passed real KiCad{' '}
              <span className="font-mono">WriteDRCReport</span> directly from disk with{' '}
              <span className="font-bold">0 DRC violations · 0 unconnected pads · 0 footprint errors</span>. Inspect the verbatim{' '}
              <span className="font-mono font-semibold">KiCad DRC (.rpt)</span> and unscaled{' '}
              <span className="font-mono font-semibold">Watchdog Real-Time (.cir)</span> tabs above.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-950 text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800 text-xs font-mono">
            <span className="text-slate-300">
              {activeExport.filename} ({activeExport.content.split('\n').length} lines)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerTextFileDownload(activeExport.filename, activeExport.content, activeExport.mime)
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download {activeExport.filename}
              </button>
            </div>
          </div>
          <pre className="text-[11px] font-mono leading-relaxed overflow-auto max-h-72 text-emerald-100/95">
            {(() => {
              const lines = activeExport.content.split('\n');
              if (lines.length <= 400) return activeExport.content;
              return `${lines.slice(0, 320).join('\n')}\n\n... [Preview truncated at 320 of ${lines.length.toLocaleString()} lines — Copy and Download export the complete file]`;
            })()}
          </pre>
        </div>
      </div>

      {/* Consolidated Master BOM Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Master Deduplicated Board-Wide BOM ({stats.smdPartCount} SMD + {stats.thtPartCount} THT Parts · {stats.uniqueSmdReels} SMD Reels)
            </h2>
            <p className="text-xs text-slate-500">
              Unique clash-free RefDes across all 6 subsystems — filter by subsystem or inspect shared Basic reels
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
            {['ALL', '01', '02', '03', '04', '05', '06', 'THT'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSubFilter(f)}
                className={`px-2 py-0.5 rounded border cursor-pointer ${
                  subFilter === f
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'THT' ? 'THT' : `Sub ${f}`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="px-3 py-2">Unique RefDes</th>
                <th className="px-2 py-2 text-center">Qty</th>
                <th className="px-3 py-2">Value / Tolerance</th>
                <th className="px-2 py-2">Pkg</th>
                <th className="px-2 py-2">LCSC / MPN</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2 text-right">Ext €</th>
                <th className="px-3 py-2">Subsystems &amp; Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {filteredBom.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[190px] break-words">
                    {l.designators.join(', ')}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{l.designators.length}</td>
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-slate-900">{l.value}</div>
                    <div className="text-[10px] text-slate-500">{l.tolerance}</div>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{l.shortPkg}</td>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold text-emerald-700">{l.lcsc}</div>
                    <div className="text-[10px] text-slate-600 max-w-[145px] break-all">{l.mpn}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        l.bomClass === 'Basic'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : l.bomClass === 'Preferred'
                          ? 'bg-sky-50 text-sky-800 border-sky-300'
                          : l.bomClass === 'Extended'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {l.bomClass}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-900">
                    €{(l.designators.length * l.unitCostEur).toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 font-sans text-slate-700">
                    <span className="font-mono text-[10px] text-slate-500 mr-1.5">[{l.subsystems.join(',')}]</span>
                    {l.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unpopulated (DNP) Footprints + Inter-Block Shared Rails */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h3 className="text-sm font-semibold text-slate-900">
              Unpopulated (DNP / n.f.) Footprints Kept on PCB (€0.00 Build Cost)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-mono text-[11px]">
                  <th className="px-3 py-2">Block</th>
                  <th className="px-3 py-2">RefDes</th>
                  <th className="px-3 py-2">Reason Kept Unpopulated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11.5px]">
                {dnpList.map((d) => (
                  <tr key={d.block} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-900">{d.block}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{d.refDes}</td>
                    <td className="px-3 py-2 text-slate-600">{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h3 className="text-sm font-semibold text-slate-900">
              Verified Inter-Block Power &amp; Safety Rails (01–06)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-mono text-[11px]">
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Nominal</th>
                  <th className="px-3 py-2">Hardware Protection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11.5px]">
                {interNets.map((n) => (
                  <tr key={n.netName} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-blue-800">{n.netName}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-800">{n.nominalState}</td>
                    <td className="px-3 py-2 text-emerald-900">{n.faultProtection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Explicit Proposed Changes Register vs. CoSTOS Repo D18 / D25 & Honest Pt1000 Error Budget */}
      <div className="bg-white border border-amber-300 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-950">
                Architecture Decisions Register (vs. CoSTOS Repo D18 / D25) &amp; Honest Pt1000 Error Budget
              </h3>
              <p className="text-xs text-amber-900/90">
                #1 (REL1) &amp; #2 (No 5 V eFuse) now match D25/D18; remaining 4 intentional deviations are documented with Reason, Cost Delta, Trade-Off, and Revert Path.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
            2 Matched to D18/D25 · 4 Intentional Deviations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Baseline Decision</th>
                <th className="px-3 py-2">Locked Hardware State (Rev B/D/E)</th>
                <th className="px-3 py-2">Engineering Reason &amp; Trade-Off</th>
                <th className="px-3 py-2">Revert / Upgrade Path</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11.5px]">
              <tr className="bg-emerald-50/40">
                <td className="px-3 py-2 font-mono font-bold text-emerald-700">1 ✓</td>
                <td className="px-3 py-2 font-semibold text-emerald-950">D25 (REL1 fitted) — MATCHED</td>
                <td className="px-3 py-2 text-slate-700">All REL1 SMD driver parts populated (Q10–Q12, D6 SS14, D7 Green, R15, R17, R501A/B = 5.0 Ω); only J4 2-pin THT screw terminal DNP</td>
                <td className="px-3 py-2 text-slate-700">Reuses existing Basic reels (<span className="font-semibold">€0.00 extra feeder fee</span>, +€0.23/bd SMD); active 123.2 mA short limit &amp; Q12 16.1 s WD cutoff verified in SPICE.</td>
                <td className="px-3 py-2 text-slate-600">Hand-solder J4 2-pin 3.5 mm terminal (+€0.15) to activate REL1 immediately — zero SMD rework.</td>
              </tr>
              <tr className="bg-emerald-50/40">
                <td className="px-3 py-2 font-mono font-bold text-emerald-700">2 ✓</td>
                <td className="px-3 py-2 font-semibold text-emerald-950">D18 (no 5 V eFuse) — MATCHED</td>
                <td className="px-3 py-2 text-slate-700">Foldback eFuse dropped (R601 C15545, Q21, Q22, R603, R605, R606 removed); direct Pi Pins 2/4 → +5V_HAT + 44 µF + 100 nF</td>
                <td className="px-3 py-2 text-slate-700">Saves <span className="font-semibold">−€2.80</span> on eFuse + <span className="font-semibold">−€33.60</span> via full Basic reel consolidation (<span className="font-semibold">12 → 0 Extended SMD reels = €0.00</span> across all Subsystems 01–06!), removes 90 mV drop (+5V_HAT = 5.045 V, +V_DRV = 9.179 V).</td>
                <td className="px-3 py-2 text-slate-600">Matches D18 directly; zero conflict with repo architecture.</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-bold text-amber-800">3</td>
                <td className="px-3 py-2 font-semibold text-slate-900">3.3 V 1-Wire baseline</td>
                <td className="px-3 py-2 text-slate-700">5 V bus with 2N7002 level-shifters + Basic TL431 (C181103) 5.36 V clamps + D34/D35 VDD LEDs (1-Wire Ed. only)</td>
                <td className="px-3 py-2 text-slate-700">Extends DS18B20 cable reach to <span className="font-semibold">40–65 m</span> without DS2482 (+€0.23/bd, €0.00 Extended fee); TL431 tightens +12 V DQ clamp to <span className="font-semibold">5.390 V</span> (below DS18B20 5.5 V max).</td>
                <td className="px-3 py-2 text-slate-600">Omit Q19/Q20 and tie DQ directly to 3.3 V pull-up for &lt;10 m buses.</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-bold text-amber-800">4</td>
                <td className="px-3 py-2 font-semibold text-slate-900">Stacking header (D25)</td>
                <td className="px-3 py-2 text-slate-700">Plain 11 mm female 2×20 header + 11 mm M2.5 nylon standoffs (JLCPCB turnkey THT)</td>
                <td className="px-3 py-2 text-slate-700">Fits passive Pi 5 heatsinks cleanly at lower cost (€0.45); factory wave-soldered by JLCPCB Standard PCBA.</td>
                <td className="px-3 py-2 text-slate-600">Drop in a standard 2×20 long-pin stacking header on the same J1 footprint.</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-bold text-amber-800">5</td>
                <td className="px-3 py-2 font-semibold text-slate-900">Separate terminals</td>
                <td className="px-3 py-2 text-slate-700">Combined 8-pin J6 (DG350-3.5-08P) or 2×8P Dual-Tier (DG350D-3.5-08P)</td>
                <td className="px-3 py-2 text-slate-700">Deliberately chosen for 0 mm overhang and only 3 factory-soldered THT parts (J1, J2, J6); <span className="font-semibold">trade-off:</span> single shared terminal block for field wiring.</td>
                <td className="px-3 py-2 text-slate-600">Split J6 back into individual 2P/3P terminal footprints in KiCad if preferred.</td>
              </tr>
              <tr className="bg-amber-50/50">
                <td className="px-3 py-2 font-mono font-bold text-rose-800">6 (Pt1000)</td>
                <td className="px-3 py-2 font-semibold text-rose-950">D25 MAX31865 (±0.59 K, 3 Ext reels)</td>
                <td className="px-3 py-2 text-slate-800">100% Basic 72 Hz LM393DR2G (C7955) RC ramp + 7× Basic 1.00 kΩ ±1% (C17513) + 10 nF X7R (C1710) + 100 nF 50 V ESD caps on every wire (C49678) + D8/D8B (1N4148W)</td>
                <td className="px-3 py-2 text-slate-800">
                  <span className="font-semibold text-rose-900">Honest Error Budget (€0.00 Ext):</span> ±2–4 K uncalibrated (±0.4–0.6 K year-round after 1-time 5 s software calibration against a tap/DS18B20 ref); <span className="font-semibold">bench-unproven</span> on Linux GPIO timing vs proven MAX31865 (±0.59 K).
                </td>
                <td className="px-3 py-2 text-slate-700">Run 1-time 5 s cal on 2× prototype, or select Smart Hybrid (MAX31865) in Tab 11.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
