import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  computeArchitectureComparison,
  computeSplitArchitectureComparison,
  getComparisonCriteria,
  getSubsystemRows,
  getThtChecklist,
  type ArchId,
  type AssemblyMode,
  type BatchSize,
} from './data/architectureCompareData';
import { type HatEdition } from '../08-FullHat/data/masterBom';

interface ArchitectureCompareWorkspaceProps {
  edition: HatEdition;
  onEditionChange: (edition: HatEdition) => void;
}

const BATCH_OPTIONS: BatchSize[] = [2, 5, 10, 25];

export function ArchitectureCompareWorkspace({
  edition,
  onEditionChange,
}: ArchitectureCompareWorkspaceProps) {
  const [assemblyMode, setAssemblyMode] = useState<AssemblyMode>('jlcpcb_zero_solder');
  const [batchSize, setBatchSize] = useState<BatchSize>(5);
  const [splitAllPtQty, setSplitAllPtQty] = useState<number>(3);
  const [splitOneWireQty, setSplitOneWireQty] = useState<number>(3);

  const isAllPt = edition === 'all_pt1000';
  const editionLabel = isAllPt ? 'All-Pt1000 8×' : '1-Wire';
  const isZeroSolder = assemblyMode === 'jlcpcb_zero_solder';

  const stepSplitQty = (current: number, delta: -1 | 1): number => {
    if (delta === 1) return current === 0 ? 2 : Math.min(25, current + 1);
    return current <= 2 ? 0 : current - 1;
  };

  const splitCompareActive = useMemo(
    () => computeSplitArchitectureComparison(splitOneWireQty, splitAllPtQty, assemblyMode),
    [splitOneWireQty, splitAllPtQty, assemblyMode]
  );
  const splitCompareAlt = useMemo(
    () =>
      computeSplitArchitectureComparison(
        splitOneWireQty,
        splitAllPtQty,
        isZeroSolder ? 'diy_tht' : 'jlcpcb_zero_solder'
      ),
    [splitOneWireQty, splitAllPtQty, isZeroSolder]
  );

  const thtChecklist = useMemo(() => getThtChecklist(edition), [edition]);
  const { architectures, zeroSolderBreakdown } = useMemo(
    () => computeArchitectureComparison(edition, batchSize, assemblyMode),
    [edition, batchSize, assemblyMode]
  );
  const subsystemRows = useMemo(() => getSubsystemRows(edition), [edition]);
  const criteriaRows = useMemo(
    () => getComparisonCriteria(edition, architectures, batchSize),
    [edition, architectures, batchSize]
  );

  // Batch scaling curve data (2, 5, 10, 25 boards) for all 3 architectures
  const scalingSeries = useMemo(() => {
    return BATCH_OPTIONS.map((n) => {
      const res = computeArchitectureComparison(edition, n, assemblyMode).architectures;
      return {
        batch: n,
        discrete: res[0].perBoardLandedEur,
        hybrid: res[1].perBoardLandedEur,
        fullIc: res[2].perBoardLandedEur,
      };
    });
  }, [edition, assemblyMode]);

  const [disc, hyb, full] = architectures;
  const maxBarEur = Math.max(...architectures.map((a) => a.perBoardLandedEur), 20);

  // SVG scaling chart bounds
  const chartW = 500;
  const chartH = 225;
  const padL = 48;
  const padR = 24;
  const padT = 22;
  const padB = 34;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxCurveY = Math.ceil(
    Math.max(...scalingSeries.flatMap((p) => [p.discrete, p.hybrid, p.fullIc])) / 10
  ) * 10;

  const xPos = (idx: number) => padL + (idx / (BATCH_OPTIONS.length - 1)) * innerW;
  const yPos = (val: number) => padT + innerH - (val / maxCurveY) * innerH;

  const buildPolyline = (key: 'discrete' | 'hybrid' | 'fullIc') =>
    scalingSeries.map((pt, i) => `${xPos(i).toFixed(1)},${yPos(pt[key]).toFixed(1)}`).join(' ');

  const winnerLabel = (w: ArchId | 'tie') => {
    if (w === 'discrete_active') return 'Our Discrete Build';
    if (w === 'hybrid_pt1000_ic') return 'Smart Hybrid';
    if (w === 'full_ic') return 'Full Dedicated-IC';
    return 'Tie';
  };

  const winnerClass = (w: ArchId | 'tie') => {
    if (w === 'discrete_active') return 'text-emerald-800 font-semibold';
    if (w === 'hybrid_pt1000_ic') return 'text-blue-800 font-semibold';
    if (w === 'full_ic') return 'text-amber-800 font-semibold';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-5">
      {/* Executive Dark Header Strip (Tab 05 Design System) */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 11 · ARCHITECTURE &amp; ASSEMBLY TRADE-OFF</span>
            <span>·</span>
            <span>65 × 56 mm HAT · ACTIVE BOM SYNCED</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Discrete Basic-Part HAT vs. Dedicated-IC HAT &amp; Zero-Hand-Soldering
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Exact JLCPCB landed cost and engineering trade-off comparing our active discrete design against a{' '}
            <strong className="text-white">Smart Hybrid (MAX31865 Pt1000 IC only)</strong> and a{' '}
            <strong className="text-white">Full Dedicated-IC HAT</strong> — plus a live switch to move all 3 remaining
            through-hole connectors to{' '}
            <strong className="text-white">100% factory turnkey assembly (zero soldering iron required)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setAssemblyMode('jlcpcb_zero_solder')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              isZeroSolder
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            JLCPCB 100% Zero-Solder
          </button>
          <button
            type="button"
            onClick={() => setAssemblyMode('diy_tht')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              !isZeroSolder
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            DIY 3-Part THT
          </button>
        </div>
      </div>

      {/* Sub-Navigation Bar: HAT Edition + Batch Size */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onEditionChange('onewire')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              edition === 'onewire'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            1-Wire (1× Pt1000 + 2× 1W)
          </button>
          <button
            type="button"
            onClick={() => onEditionChange('all_pt1000')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              edition === 'all_pt1000'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All-Pt1000 (8× Pt1000)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-slate-500 mr-0.5">Batch:</span>
          {BATCH_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBatchSize(n)}
              className={`px-2.5 py-1.5 rounded text-xs font-mono tabular-nums font-semibold transition whitespace-nowrap cursor-pointer ${
                batchSize === n
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {n} pcs
            </button>
          ))}
        </div>
      </div>

      {/* Top Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {architectures.map((arch, idx) => (
          <div
            key={arch.id}
            className={`rounded-lg border p-3.5 space-y-1 ${
              idx === 0 ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">{arch.shortName}</span>
              <span
                className={`font-mono tabular-nums ${
                  idx === 0 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'
                }`}
              >
                {idx === 0 ? 'Active Baseline' : `+€${arch.deltaVsActivePerBoardEur.toFixed(2)}/bd`}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                €{arch.perBoardLandedEur.toFixed(2)}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                /bd landed ({batchSize} pcs · VAT+ship)
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 tabular-nums">
              {arch.smdPartCount} SMD · {arch.extendedReelCount} Ext reels ·{' '}
              {isZeroSolder ? '0 parts you solder' : `${arch.thtSolderedParts} THT parts you solder`}
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 0: MIXED / SPLIT ORDER COMPARISON (e.g. 3× All-Pt1000 + 3× 1-Wire = 6 HATs) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">
              Mixed / Split Order Comparison: {splitAllPtQty}× All-Pt1000 + {splitOneWireQty}× 1-Wire ({splitAllPtQty + splitOneWireQty} Assembled HATs)
            </h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              One combined JLCPCB checkout · Discrete vs. Smart Hybrid (MAX31865) vs. Full Dedicated-IC · incl. 1× EU shipping &amp; 19% VAT
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { label: '3× Pt1000 + 3× 1-Wire', pt: 3, ow: 3 },
                { label: '2 + 2', pt: 2, ow: 2 },
                { label: '5 + 5', pt: 5, ow: 5 },
                { label: '5× Pt1000 only', pt: 5, ow: 0 },
                { label: '5× 1-Wire only', pt: 0, ow: 5 },
              ] as const
            ).map((p) => {
              const active = splitAllPtQty === p.pt && splitOneWireQty === p.ow;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSplitAllPtQty(p.pt);
                    setSplitOneWireQty(p.ow);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                    active
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Interactive Quantity Steppers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-blue-200 bg-blue-50/40 rounded-md px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-blue-950">All-Pt1000 HATs (8× Pt1000 · 2×8P)</div>
                <div className="text-[11px] font-mono text-blue-800 tabular-nums">
                  {splitAllPtQty > 0
                    ? `${splitAllPtQty} assembled · ${splitAllPtQty <= 5 ? 5 : splitAllPtQty <= 10 ? 10 : Math.ceil(splitAllPtQty / 5) * 5} bare PCBs (${Math.max(0, (splitAllPtQty <= 5 ? 5 : splitAllPtQty <= 10 ? 10 : Math.ceil(splitAllPtQty / 5) * 5) - splitAllPtQty)} free spares)`
                    : 'Not in cart (0)'}
                </div>
              </div>
              <div className="inline-flex items-center border border-blue-300 bg-white rounded-md overflow-hidden">
                <button
                  type="button"
                  aria-label="Decrease All-Pt1000 HATs"
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
                  aria-label="Increase All-Pt1000 HATs"
                  disabled={splitAllPtQty >= 25}
                  onClick={() => setSplitAllPtQty((q) => stepSplitQty(q, 1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/40 rounded-md px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-950">1-Wire HATs (1× Pt1000 + 2× 1-Wire · 8P)</div>
                <div className="text-[11px] font-mono text-emerald-800 tabular-nums">
                  {splitOneWireQty > 0
                    ? `${splitOneWireQty} assembled · ${splitOneWireQty <= 5 ? 5 : splitOneWireQty <= 10 ? 10 : Math.ceil(splitOneWireQty / 5) * 5} bare PCBs (${Math.max(0, (splitOneWireQty <= 5 ? 5 : splitOneWireQty <= 10 ? 10 : Math.ceil(splitOneWireQty / 5) * 5) - splitOneWireQty)} free spares)`
                    : 'Not in cart (0)'}
                </div>
              </div>
              <div className="inline-flex items-center border border-emerald-300 bg-white rounded-md overflow-hidden">
                <button
                  type="button"
                  aria-label="Decrease 1-Wire HATs"
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
                  aria-label="Increase 1-Wire HATs"
                  disabled={splitOneWireQty >= 25}
                  onClick={() => setSplitOneWireQty((q) => stepSplitQty(q, 1))}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {splitCompareActive[0].totalHats === 0 ? (
            <div className="border border-slate-200 rounded-md p-4 text-xs font-mono text-slate-600">
              Select at least 2 HATs above to compare Discrete vs. Smart Hybrid vs. Full Dedicated-IC checkout totals.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">
                      Combined Cart Line Item ({isZeroSolder ? '100% Zero-Solder Turnkey' : 'DIY 3-Part THT'})
                    </th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950">Our Discrete Build</th>
                    <th className="py-2.5 px-3 text-right">Smart Hybrid (Pt1000 IC)</th>
                    <th className="py-2.5 px-3 text-right">Full Dedicated-IC HAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11.5px] tabular-nums">
                  <tr>
                    <td className="py-1.5 px-3 font-sans text-slate-800">
                      Bare PCBs ({splitCompareActive[0].totalBarePcbs} pcs · {splitCompareActive[0].totalSpareBarePcbs} free spares) + PCBA Setup &amp; SMT Joints
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-1.5 px-3 text-right ${i === 0 ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                        €{a.pcbAndSetupOrderEur.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-sans text-slate-800">
                      SMD Components ({splitAllPtQty}× All-Pt1000 + {splitOneWireQty}× 1-Wire)
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-1.5 px-3 text-right ${i === 0 ? 'bg-emerald-50/40 font-semibold text-emerald-900' : ''}`}>
                        €{a.smdPartsOrderEur.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-sans text-slate-800">
                      Extended Feeder Fees (€2.80/reel across {splitCompareActive[0].activeDesignCount} PCB {splitCompareActive[0].activeDesignCount === 1 ? 'design' : 'designs'})
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-1.5 px-3 text-right ${i === 0 ? 'bg-emerald-50/40 font-semibold text-emerald-900' : 'text-rose-700'}`}>
                        €{a.extendedFeesOrderEur.toFixed(2)}{' '}
                        <span className="text-[10px] text-slate-500">({a.totalExtendedReelCount} reels)</span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-sans text-slate-800">
                      THT Hardware (J1/J2/J6 + Nylon Standoffs){isZeroSolder ? ' + Factory THT Pins' : ''}
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-1.5 px-3 text-right ${i === 0 ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                        €{a.thtPartsAndAssemblyOrderEur.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-sans text-slate-800">
                      Combined EU Shipping (€{splitCompareActive[0].combinedShippingEur.toFixed(2)}
                      {splitCompareActive[0].shippingSavedVsSeparateEur > 0 ? `, saves €${splitCompareActive[0].shippingSavedVsSeparateEur.toFixed(2)}` : ''}) + 19% VAT
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-1.5 px-3 text-right ${i === 0 ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                        €{(a.combinedShippingEur + a.vatEur).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 font-bold text-slate-950">
                    <td className="py-2 px-3 font-sans">
                      Grand Total ({splitCompareActive[0].totalHats} HATs · {isZeroSolder ? '100% Zero-Solder' : 'DIY 3-Part THT'})
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-2 px-3 text-right ${i === 0 ? 'bg-emerald-100 text-emerald-950' : ''}`}>
                        <div>€{a.grandTotalOrderEur.toFixed(2)}</div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {isZeroSolder ? 'DIY THT' : 'Zero-Solder'}: €{splitCompareAlt[i].grandTotalOrderEur.toFixed(2)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-emerald-50/60 font-bold">
                    <td className="py-2 px-3 font-sans text-emerald-950">
                      Landed Cost per HAT &amp; Difference vs. Discrete
                    </td>
                    {splitCompareActive.map((a, i) => (
                      <td key={a.id} className={`py-2 px-3 text-right ${i === 0 ? 'bg-emerald-700 text-white' : 'text-slate-900'}`}>
                        <div>€{a.perHatLandedEur.toFixed(2)}/HAT</div>
                        <div className={`text-[10px] font-normal ${i === 0 ? 'text-emerald-100' : 'text-amber-800 font-semibold'}`}>
                          {i === 0
                            ? `${isZeroSolder ? 'DIY' : 'Zero-Solder'}: €${splitCompareAlt[0].perHatLandedEur.toFixed(2)}/HAT`
                            : `+€${a.deltaTotalVsDiscreteEur.toFixed(2)} order (+€${a.deltaPerHatVsDiscreteEur.toFixed(2)}/HAT)`}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: ZERO-HAND-SOLDERING BREAKDOWN */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">
              1. What Requires Soldering — And How to Order 100% Zero-Hand-Soldered from JLCPCB
            </h2>
          </div>
          <div className="text-xs font-mono text-slate-300 tabular-nums">
            {isZeroSolder
              ? `Factory Turnkey Active · 0 solder joints for you (+€${zeroSolderBreakdown.extraPerBoardInclVatEur.toFixed(2)}/bd incl. VAT @ ${batchSize} pcs)`
              : `Economic SMD Active · Only 3 THT parts (${zeroSolderBreakdown.thtPinsPerBoard} pins) left for hand-soldering`}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left 7 cols: Exact 5-item non-SMD inventory */}
          <div className="lg:col-span-7 p-4 space-y-3">
            <div className="text-xs text-slate-600 leading-relaxed">
              JLCPCB&apos;s pick-and-place robots automatically solder all{' '}
              <strong className="text-slate-900">
                {disc.smdPartCount} surface-mount (SMD) components
              </strong>{' '}
              on the top side. Out of the remaining 5 non-SMD items on the BOM,{' '}
              <strong className="text-slate-900">2 need zero soldering at all</strong> (nylon standoffs + bare copper
              pads), leaving only <strong className="text-slate-900">3 through-hole connectors</strong>:
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200">
                    <th className="py-2 px-3">Ref</th>
                    <th className="py-2 px-3">Part &amp; Placement Side</th>
                    <th className="py-2 px-3 text-right">Pins</th>
                    <th className="py-2 px-3 text-right">Part Cost</th>
                    <th className="py-2 px-3">Status ({isZeroSolder ? 'Turnkey' : 'Economic'})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {thtChecklist.map((item) => (
                    <tr key={item.refDes} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.refDes}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-900">
                          {item.name}{' '}
                          <span className="font-mono text-[11px] text-slate-500">({item.side})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.lcscNote}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {item.pins}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                        €{item.partCostEur.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                        {!item.solderRequired ? (
                          <span className="text-emerald-700 font-semibold">No Solder Needed</span>
                        ) : isZeroSolder ? (
                          <span className="text-emerald-700 font-semibold">JLCPCB Factory THT</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Hand-Solder (THT)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 5 cols: Exact Factory Zero-Solder Fee Breakdown */}
          <div className="lg:col-span-5 p-4 bg-slate-50/50 space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              How JLCPCB 100% Zero-Solder Turnkey Pricing Works ({batchSize} pcs)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select <strong>Standard PCBA</strong> (instead of Economic) at JLCPCB checkout and include{' '}
              <span className="font-mono">J1</span>, <span className="font-mono">J6</span>, and{' '}
              <span className="font-mono">J2</span> in the BOM. JLCPCB reflows all {disc.smdPartCount} top SMDs, then
              factory wave/hand-solders the 3 connectors on both sides — the boards arrive{' '}
              <strong>100% plug-and-play</strong>.
            </p>

            <table className="w-full text-xs border-t border-slate-200">
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                <tr>
                  <td className="py-1.5 font-sans text-slate-700">Standard PCBA setup upgrade (vs Economic)</td>
                  <td className="py-1.5 text-right text-slate-900">
                    +€{zeroSolderBreakdown.standardPcbaUpgradeOrderEur.toFixed(2)} /order
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700">THT factory wave/hand-soldering setup</td>
                  <td className="py-1.5 text-right text-slate-900">
                    +€{zeroSolderBreakdown.thtWaveSetupOrderEur.toFixed(2)} /order
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700">3× THT Extended part fees (J1, J6, J2)</td>
                  <td className="py-1.5 text-right text-slate-900">
                    +€{zeroSolderBreakdown.thtExtendedFeesOrderEur.toFixed(2)} /order
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-700">
                    THT solder joints ({zeroSolderBreakdown.thtPinsPerBoard} pins × {batchSize} pcs × €0.016)
                  </td>
                  <td className="py-1.5 text-right text-slate-900">
                    +€{zeroSolderBreakdown.thtPinAssemblyOrderEur.toFixed(2)} /order
                  </td>
                </tr>
                <tr className="bg-slate-100/80 font-semibold">
                  <td className="py-2 px-1 font-sans text-slate-900">
                    Total Zero-Solder Adder (incl. 19% VAT)
                  </td>
                  <td className="py-2 px-1 text-right text-slate-900">
                    +€{zeroSolderBreakdown.extraPerBoardInclVatEur.toFixed(2)}/bd
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-slate-200">
              <strong className="text-slate-800">Zero-Solder LCSC Tip:</strong> Keep{' '}
              <span className="font-mono">J1</span>, <span className="font-mono">J2</span>, and{' '}
              <span className="font-mono">J6</span> mapped to in-stock LCSC assembly parts (on All-Pt1000 8×, if the
              2×8P <span className="font-mono">DG350D</span> dual-tier block is not in local JLCPCB stock, use JLCPCB
              Global Sourcing pre-order 5 days ahead — still zero soldering for you).
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GRAPHICAL COST BREAKDOWN & BATCH SCALING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: Stacked Cost Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <div className="text-[11px] font-mono text-slate-500">
                Per-Board Landed Cost Breakdown · {batchSize} Boards ·{' '}
                {isZeroSolder ? 'JLCPCB 100% Zero-Solder' : 'DIY 3-Part THT'}
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                Where Every Euro Goes: Discrete vs. Hybrid vs. Full Dedicated-IC
              </h2>
            </div>
          </div>

          <svg
            viewBox="0 0 600 225"
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Stacked per-board cost comparison bar chart"
          >
            <rect x="0" y="0" width="600" height="225" fill="#ffffff" />

            {/* Legend */}
            {[
              { label: 'PCB + Setup', color: '#475569', x: 10 },
              { label: 'SMD Parts', color: '#0284c7', x: 112 },
              { label: 'Ext Reel Fees', color: '#dc2626', x: 204 },
              { label: 'THT + Assm', color: '#16a34a', x: 312 },
              { label: 'Ship + 19% VAT', color: '#cbd5e1', x: 414 },
            ].map((leg) => (
              <g key={leg.label} transform={`translate(${leg.x}, 6)`}>
                <rect x="0" y="0" width="10" height="10" rx="2" fill={leg.color} />
                <text x="14" y="8.5" fontSize="10" fontFamily="monospace" fill="#334155">
                  {leg.label}
                </text>
              </g>
            ))}

            {architectures.map((arch, idx) => {
              const rowY = 34 + idx * 62;
              const barLeft = 10;
              const barMaxW = 490;
              const scale = barMaxW / maxBarEur;

              const segs = [
                { val: arch.pcbAndSetupOrderEur / batchSize, color: '#475569' },
                { val: arch.smdPartsOrderEur / batchSize, color: '#0284c7' },
                { val: arch.extendedFeesOrderEur / batchSize, color: '#dc2626' },
                { val: arch.thtPartsAndAssemblyOrderEur / batchSize, color: '#16a34a' },
                { val: (arch.shippingOrderEur + arch.vatEur) / batchSize, color: '#cbd5e1' },
              ];

              let curX = barLeft;
              return (
                <g key={arch.id}>
                  <text
                    x={barLeft}
                    y={rowY + 11}
                    fontSize="11.5"
                    fontWeight="700"
                    fill="#0f172a"
                    fontFamily="sans-serif"
                  >
                    {arch.shortName}
                  </text>
                  <text
                    x={barLeft + barMaxW}
                    y={rowY + 11}
                    textAnchor="end"
                    fontSize="10.5"
                    fontFamily="monospace"
                    fill="#475569"
                  >
                    SMD €{(arch.smdPartsOrderEur / batchSize).toFixed(2)} · Ext €
                    {(arch.extendedFeesOrderEur / batchSize).toFixed(2)} · {arch.extendedReelCount} reels
                  </text>

                  {/* Track */}
                  <rect
                    x={barLeft}
                    y={rowY + 18}
                    width={barMaxW}
                    height="24"
                    rx="3"
                    fill="#f8fafc"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />

                  {/* Segments */}
                  {segs.map((s, sIdx) => {
                    const w = Math.max(0, s.val * scale);
                    const x = curX;
                    curX += w;
                    return (
                      <rect
                        key={sIdx}
                        x={x}
                        y={rowY + 18}
                        width={w}
                        height="24"
                        fill={s.color}
                      />
                    );
                  })}

                  {/* Total label right of bar */}
                  <text
                    x={curX + 8}
                    y={rowY + 34}
                    fontSize="12.5"
                    fontWeight="700"
                    fontFamily="monospace"
                    fill={idx === 0 ? '#047857' : '#0f172a'}
                  >
                    €{arch.perBoardLandedEur.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right 5 cols: Batch Size Scaling Curve */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="pb-2 border-b border-slate-100">
            <div className="text-[11px] font-mono text-slate-500">
              Volume Amortization · 2 to 25 Boards ({isZeroSolder ? 'Zero-Solder' : 'DIY THT'})
            </div>
            <h2 className="text-sm font-bold text-slate-900 mt-0.5">
              Landed Cost per Board vs. Order Quantity
            </h2>
          </div>

          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Landed cost per board vs batch size scaling chart"
          >
            <rect x="0" y="0" width={chartW} height={chartH} fill="#ffffff" />

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const val = maxCurveY * frac;
              const y = yPos(val);
              return (
                <g key={frac}>
                  <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#64748b"
                  >
                    €{val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Highlight active batch vertical line */}
            {(() => {
              const activeIdx = BATCH_OPTIONS.indexOf(batchSize);
              const ax = xPos(activeIdx);
              return (
                <line
                  x1={ax}
                  y1={padT}
                  x2={ax}
                  y2={chartH - padB}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              );
            })()}

            {/* Curves */}
            <polyline
              fill="none"
              stroke="#d97706"
              strokeWidth="2.2"
              points={buildPolyline('fullIc')}
            />
            <polyline
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.2"
              points={buildPolyline('hybrid')}
            />
            <polyline
              fill="none"
              stroke="#15803d"
              strokeWidth="2.6"
              points={buildPolyline('discrete')}
            />

            {/* Data points & X-axis labels */}
            {scalingSeries.map((pt, i) => {
              const cx = xPos(i);
              const isCur = pt.batch === batchSize;
              return (
                <g key={pt.batch}>
                  <circle cx={cx} cy={yPos(pt.fullIc)} r={isCur ? 4.5 : 3} fill="#d97706" />
                  <circle cx={cx} cy={yPos(pt.hybrid)} r={isCur ? 4.5 : 3} fill="#0284c7" />
                  <circle cx={cx} cy={yPos(pt.discrete)} r={isCur ? 4.5 : 3} fill="#15803d" />
                  <text
                    x={cx}
                    y={chartH - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={isCur ? '700' : '400'}
                    fill={isCur ? '#0f172a' : '#64748b'}
                  >
                    {pt.batch} pcs
                  </text>
                </g>
              );
            })}

            {/* Inline legend top-right */}
            <g transform="translate(260, 6)">
              <line x1="0" y1="5" x2="14" y2="5" stroke="#15803d" strokeWidth="2.5" />
              <text x="18" y="8.5" fontSize="9.5" fontFamily="monospace" fill="#15803d" fontWeight="700">
                Discrete
              </text>
              <line x1="78" y1="5" x2="92" y2="5" stroke="#0284c7" strokeWidth="2.2" />
              <text x="96" y="8.5" fontSize="9.5" fontFamily="monospace" fill="#0284c7" fontWeight="700">
                Hybrid
              </text>
              <line x1="146" y1="5" x2="160" y2="5" stroke="#d97706" strokeWidth="2.2" />
              <text x="164" y="8.5" fontSize="9.5" fontFamily="monospace" fill="#b45309" fontWeight="700">
                Full IC
              </text>
            </g>
          </svg>

          <div className="text-[11px] font-mono text-slate-600 tabular-nums flex flex-wrap justify-between gap-2 pt-1 border-t border-slate-100">
            <span>
              25 pcs Discrete: <strong className="text-emerald-800">€{scalingSeries[3].discrete.toFixed(2)}/bd</strong>
            </span>
            <span>
              25 pcs Hybrid: <strong className="text-blue-800">€{scalingSeries[3].hybrid.toFixed(2)}/bd</strong>
            </span>
            <span>
              25 pcs Full IC: <strong className="text-amber-800">€{scalingSeries[3].fullIc.toFixed(2)}/bd</strong>
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: SUBSYSTEM-BY-SUBSYSTEM SILICON VS DISCRETE TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              2. Subsystem-by-Subsystem Breakdown (01–06): Discrete vs. Hybrid vs. Full Dedicated-IC
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact parts, per-board SMD cost (ex-VAT), and JLCPCB Extended feeder reels (€2.80/reel) per block
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="py-2.5 px-3 w-[16%]">Subsystem</th>
                <th className="py-2.5 px-3 w-[28%]">Our Active Build (Discrete)</th>
                <th className="py-2.5 px-3 w-[28%]">Smart Hybrid (Pt1000 IC Only)</th>
                <th className="py-2.5 px-3 w-[28%]">Full Dedicated-IC HAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subsystemRows.map((row) => (
                <tr key={row.block} className="hover:bg-slate-50/60 align-top">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{row.block}</td>
                  {[row.discrete, row.hybrid, row.fullIc].map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-2.5 px-3 ${cIdx === 0 ? 'bg-emerald-50/25' : ''}`}
                    >
                      <div className="font-semibold text-slate-900">{cell.impl}</div>
                      <div className="font-mono text-[11px] tabular-nums text-slate-600 mt-0.5">
                        €{cell.costEur.toFixed(2)}/bd ·{' '}
                        <span className={cell.extReels === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'}>
                          {cell.extReels} Ext {cell.extReels === 1 ? 'reel' : 'reels'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 leading-snug">{cell.note}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: ENGINEERING CONSTRAINTS & TRADE-OFF MATRIX */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-sm font-bold text-slate-900">
            3. Engineering Constraints &amp; Trade-Off Scorecard ({editionLabel} Edition)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct technical comparison covering accuracy, wiring modes, firmware effort, GPIO budget, and supply-chain risk
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Criterion</th>
                <th className="py-2.5 px-3">Our Discrete Build</th>
                <th className="py-2.5 px-3">Smart Hybrid</th>
                <th className="py-2.5 px-3">Full Dedicated-IC</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {criteriaRows.map((row) => (
                <tr key={row.criterion} className="hover:bg-slate-50/70 align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{row.criterion}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{row.detail}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">{row.discrete}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">{row.hybrid}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">{row.fullIc}</td>
                  <td className={`py-2.5 px-3 whitespace-nowrap ${winnerClass(row.winner)}`}>
                    {winnerLabel(row.winner)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: CLEAR ENGINEERING RECOMMENDATION */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">
            4. Recommendation for Your {editionLabel} Build ({batchSize} pcs ·{' '}
            {isZeroSolder ? 'Zero-Solder Turnkey' : 'DIY 3-Part THT'})
          </h2>
          <span className="text-xs font-mono text-emerald-300 tabular-nums">
            Savings vs Full IC: €{(full.perBoardLandedEur - disc.perBoardLandedEur).toFixed(2)}/bd
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="lg:col-span-7 p-5 space-y-2 bg-emerald-50/30">
            <div className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wide">
              Best Overall Choice · Our Active Discrete Build +{' '}
              {isZeroSolder ? 'JLCPCB Zero-Solder Turnkey' : 'DIY 3-Part THT'}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isAllPt
                ? `Keep the Discrete 8× Mux (€${disc.perBoardLandedEur.toFixed(2)}/bd) — 8× MAX31865 costs €${full.perBoardLandedEur.toFixed(2)}/bd and barely fits 65 × 56 mm`
                : `Keep the Discrete Rev B/D/E HAT (€${disc.perBoardLandedEur.toFixed(2)}/bd) — saves €${(full.perBoardLandedEur - disc.perBoardLandedEur).toFixed(2)}/bd over Full IC with zero supply-chain bottlenecks`}
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              {isAllPt ? (
                <>
                  On an 8-channel Pt1000 board, dedicated per-channel silicon (<span className="font-mono">8× MAX31865</span>)
                  explodes BOM cost by <strong>+€{full.deltaVsActivePerBoardEur.toFixed(2)}/bd</strong> and crowds a
                  65 × 56 mm HAT past practical 2-layer routing limits. Our discrete switched-mux front-end now runs{' '}
                  <strong>100% JLCPCB Basic SMD (0 Extended reels = €0.00 loading fees!)</strong> using single-reel 1.00 kΩ 1%
                  Basic (<span className="font-mono">C17513</span>), 10 nF X7R (<span className="font-mono">C1710</span>),
                  and 100 nF 50 V ESD caps on all 8 channels — giving ~±0.5 K after a 5 s Setup Wizard calibration (±2–4 K raw;
                  drop-in 0.1% <span className="font-mono">C110774</span> optional). With{' '}
                  <strong>100% JLCPCB factory zero-solder assembly</strong>, your landed cost stays at{' '}
                  <strong>€{disc.perBoardLandedEur.toFixed(2)}/bd</strong>.
                </>
              ) : (
                <>
                  ALL 6 subsystems — Pt1000, Pump Doubler, Watchdog, 5 V 1-Wire Shifter, D18 direct{' '}
                  <span className="font-mono">+5V_HAT</span>, and factory-populated <span className="font-mono">REL1</span>{' '}
                  SMD driver — are now <strong>100% JLCPCB Basic/Preferred (0 Extended SMD reels = €0.00 loading fees!)</strong>{' '}
                  with <strong>zero firmware penalty</strong> on Subsystems 02–06. Ordering with{' '}
                  <strong>JLCPCB Standard PCBA + Factory THT</strong> gives you a 100% plug-and-play board for{' '}
                  <strong>€{disc.perBoardLandedEur.toFixed(2)}/bd</strong> — cheaper than a DIY-soldered Full-IC
                  board!
                </>
              )}
            </p>
          </div>

          <div className="lg:col-span-5 p-5 space-y-2 bg-slate-50/60">
            <div className="text-[11px] font-mono font-bold text-blue-800 uppercase tracking-wide">
              When to Consider the Smart Hybrid (+€{hyb.deltaVsActivePerBoardEur.toFixed(2)}/bd)
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Never pay for the Full-IC version (its boost converter, watchdog IC, eFuse IC, and{' '}
              <span className="font-mono">DS2482</span> add <strong>+€{full.deltaVsActivePerBoardEur.toFixed(2)}/bd</strong>{' '}
              for minimal solar-thermal gain). The <strong>only</strong> IC worth considering is swapping Pt1000 alone
              to the <strong>Smart Hybrid (€{hyb.perBoardLandedEur.toFixed(2)}/bd)</strong> if you specifically want:
            </p>
            <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
              <li>
                <strong>Zero custom Rust timing code:</strong> drop-in <span className="font-mono">max31865</span> SPI
                crate instead of ~{isAllPt ? '110' : '80'} lines of{' '}
                <span className="font-mono">gpio_v2</span> ramp math
              </li>
              <li>
                <strong>Native 3-wire / 4-wire Kelvin cables</strong> (1-Wire edition) or{' '}
                <strong>fewer Pi GPIOs</strong> (All-Pt1000 edition)
              </li>
              <li>
                <strong>Hardware SPI fault register &amp; ±45 V tolerance</strong> straight from silicon
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
