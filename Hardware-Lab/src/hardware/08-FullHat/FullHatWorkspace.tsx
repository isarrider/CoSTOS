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
  getVerifiedBoardNets,
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
  | 'kicad_net'
  | 'ngspice'
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
    conservative01PctFee: false,
  });
  const [splitOneWireQty, setSplitOneWireQty] = useState<number>(3);
  const [splitAllPtQty, setSplitAllPtQty] = useState<number>(3);
  const [splitAssemblyMode, setSplitAssemblyMode] = useState<SplitAssemblyMode>('diy_tht');
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
      kicad_net: {
        filename: `${projName}.net`,
        mime: 'text/plain;charset=utf-8',
        label: 'Netlist (.net)',
        content: generateKicadNetlist(edition),
      },
      ngspice: {
        filename: `${projName}_Full_Sim.cir`,
        mime: 'text/plain;charset=utf-8',
        label: 'ngspice (.cir)',
        content: generateNgspiceDeck(edition),
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
      {/* Top Executive Header, Edition Switcher & 1-Click Export Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
              <span>Full-HAT Roll-Up · All 6 Subsystems</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-semibold text-emerald-800">
                {stats.smdPartCount} SMD ({stats.uniqueSmdReels} Reels) + {stats.thtPartCount} THT · €{costs.revBGemini.extendedFeesOrderEur.toFixed(2)} Ext Fee
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">
              08. Full-HAT Costs, Master BOM, KiCad 10 &amp; ngspice —{' '}
              {isAllPt
                ? 'All-Pt1000 Edition (8× Mux · DG350D 2×8P Screw)'
                : '1-Wire Edition (1× Pt1000 + 2× 1-Wire · DG350 8P Screw)'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
              {isAllPt
                ? 'Reuses 100% of the Tab 01 Pt1000 measurement engine (ONE €0.08 LM393DR + ONE 0.1% thin-film bridge) across 8 switched-mux channels on a single compact Dual-Tier 2×8P (16-pin) 3.50 mm Fixed Rising-Cage Screw Terminal (J6 DG350D-3.5-08P: Upper PT1–4, Lower PT5–8, 0 mm overhang) with ZERO new SMD reels (39 reels total, all 8 GPIOs Pull-DOWN at boot). DNP: J4 REL1, J3 PUMP2, J5 REL2, U_ID EEPROM.'
                : 'Consolidated JLCPCB Economic PCBA cost estimator, clash-free board-wide RefDes, combined 8-pin J6 DG350-3.5-08P fixed rising-cage screw block (PT1 + 1W-A + 1W-B, 0 mm overhang), normal 11 mm J1 header, unpopulated DNP list, and direct KiCad 10 + ngspice exports.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={zipBusy}
              onClick={handleDownloadCompleteZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              {zipBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              {zipBusy ? 'Packing KiCad 10 + PDFs…' : `Download Complete Bundle (.zip · ${isAllPt ? '20' : '21'} Files)`}
            </button>
            <button
              type="button"
              onClick={() => exportFullHatCostsPdfReport(opts, edition)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              Costs PDF (6p)
            </button>
            <button
              type="button"
              onClick={() =>
                triggerTextFileDownload(exportPayloads.csv.filename, exportPayloads.csv.content, exportPayloads.csv.mime)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              JLCPCB CSV
            </button>
            <button
              type="button"
              onClick={() =>
                triggerTextFileDownload(exportPayloads.kicad_pcb.filename, exportPayloads.kicad_pcb.content)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-md cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              .kicad_pcb
            </button>
            <button
              type="button"
              onClick={() =>
                triggerTextFileDownload(exportPayloads.ngspice.filename, exportPayloads.ngspice.content)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-300 rounded-md cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              ngspice .cir
            </button>
          </div>
        </div>

        {/* Hardware Edition Switcher (Synced with Tab 09, Tab 10 & Tab 11) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-500 uppercase">HAT Edition:</span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    edition === ed.id
                      ? ed.id === 'all_pt1000'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {ed.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-mono text-slate-600 tabular-nums">
            {isAllPt
              ? 'Reuses Tab 01 U1 + 0.1% bridge · 7× AO3400A mux adds 0 new SMD reels (39 reels vs 41) · J6 DG350D 2×8P Fixed Screw'
              : 'Combined J6 DG350-3.5-08P (PT1 + 1W-A + 1W-B) + J2 DG350-3.5-03P · 41 SMD reels · J4 REL1 DNP'}
          </div>
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
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={opts.includeThtHardware}
              onChange={(e) => setOpts((o) => ({ ...o, includeThtHardware: e.target.checked }))}
              className="accent-slate-900"
            />
            <span>THT Header/Terminals (€{stats.thtHardwarePerBoardEur.toFixed(2)}/bd)</span>
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
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={opts.conservative01PctFee}
              onChange={(e) => setOpts((o) => ({ ...o, conservative01PctFee: e.target.checked }))}
              className="accent-amber-600"
            />
            <span className="text-amber-800 font-medium">Conservative 0.1% Fee (+€8.40)</span>
          </label>
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
            Order Total: €{costs.revBGemini.grandTotalOrderEur.toFixed(2)} (ex-VAT €{costs.revBGemini.perBoardExVatEur.toFixed(2)}/bd)
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
            Order Total: €{costs.revAD25Repo.grandTotalOrderEur.toFixed(2)} (€{costs.revAD25Repo.extendedFeesOrderEur.toFixed(2)} Ext fees)
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
            Order Total: €{costs.revAPreD25.grandTotalOrderEur.toFixed(2)} (€{costs.revAPreD25.extendedFeesOrderEur.toFixed(2)} Ext fees)
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5">
          <div className="text-[11px] font-mono font-bold text-blue-800 uppercase">
            Net Savings ({opts.batchSize}× Order)
          </div>
          <div className="text-2xl font-mono font-bold text-blue-950 mt-1 tabular-nums">
            -€{(costs.revAD25Repo.grandTotalOrderEur - costs.revBGemini.grandTotalOrderEur).toFixed(2)}
          </div>
          <div className="text-[11px] font-mono text-blue-800 mt-1 tabular-nums">
            vs {isAllPt ? '1×MAX+8Ch Mux' : 'D25 Repo'} (-€{(costs.revAPreD25.grandTotalOrderEur - costs.revBGemini.grandTotalOrderEur).toFixed(2)} vs {isAllPt ? '8×MAX31865' : 'Pre-D25'})
          </div>
        </div>
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
              Zero Extended IC fees + 3× shared LM393DR Basic reel drops small-batch cost dramatically
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
                  Complete ZIP packs <span className="font-mono">.kicad_pro</span> + root sheet + 6 separate wired <span className="font-mono">.kicad_sch</span> sheets ({totalParts} parts, {netCount} nets) + 65×56 mm <span className="font-mono">.kicad_pcb</span> + <span className="font-mono">.net</span> + JLCPCB/Master CSVs + ngspice <span className="font-mono">.cir</span> + all {isAllPt ? '6' : '7'} PDF reports
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
              Board / Sim / BOM:
            </span>
            {(['kicad_pcb', 'kicad_net', 'ngspice', 'csv', 'master_csv'] as ExportTab[]).map((t) => (
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

          <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950">
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
                <th className="px-3 py-2">Value / Part</th>
                <th className="px-2 py-2">Pkg</th>
                <th className="px-2 py-2">LCSC</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2 text-right">Ext €</th>
                <th className="px-3 py-2">Subsystems &amp; Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {filteredBom.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[200px] break-words">
                    {l.designators.join(', ')}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{l.designators.length}</td>
                  <td className="px-3 py-1.5 text-slate-800">{l.partName}</td>
                  <td className="px-2 py-1.5 text-slate-600">{l.shortPkg}</td>
                  <td className="px-2 py-1.5 text-emerald-700 font-semibold">{l.lcsc}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        l.bomClass === 'Basic'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : l.bomClass === 'Preferred'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
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
    </div>
  );
}
