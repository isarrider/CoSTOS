import React, { useMemo, useState } from 'react';
import {
  SimulationParams,
  TOPOLOGY_ORDER,
  TOPOLOGY_SPECS,
  TopologyId,
  computeErrorSweep,
  estimateResourceFootprint,
  evaluateTopology,
  perBoardCostEur,
} from '../physics/model';
import { ConclusionScorecard } from './ConclusionScorecard';
import { KicadBomPinout } from './KicadBomPinout';

interface ComparisonMatrixProps {
  selectedTopology: TopologyId;
  onSelectTopology: (id: TopologyId) => void;
  params: SimulationParams;
  batchSize: 2 | 5;
}

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  selectedTopology,
  onSelectTopology,
  params,
  batchSize,
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const baselineCost = perBoardCostEur(TOPOLOGY_SPECS.max31865, batchSize);

  const rows = useMemo(() => {
    return TOPOLOGY_ORDER.map((id) => {
      const spec = TOPOLOGY_SPECS[id];
      const live = evaluateTopology(id, params);
      const sweep = computeErrorSweep(id, params);
      const peakWorstK = sweep.reduce(
        (acc, p) => Math.max(acc, Math.abs(p.errorK) + (p.upperBoundK - p.errorK)),
        0
      );
      const unitCost = perBoardCostEur(spec, batchSize);
      const savings = baselineCost - unitCost;

      return {
        spec,
        live,
        peakWorstK,
        unitCost,
        savings,
      };
    });
  }, [params, batchSize, baselineCost]);

  const activeSpec = TOPOLOGY_SPECS[selectedTopology];
  const activeResources = estimateResourceFootprint(selectedTopology, params.pollIntervalS);

  const handleCopyMarkdown = async () => {
    const header =
      '| Topology | Parts BOM | JLCPCB Fee | Cost / Board (2× / 5×) | Peak Worst-Case | Pros | Cons |\n|---|---:|---:|---:|---:|---|---|';
    const lines = rows.map(({ spec, peakWorstK }) => {
      const c2 = perBoardCostEur(spec, 2).toFixed(2);
      const c5 = perBoardCostEur(spec, 5).toFixed(2);
      const pros = spec.advantages.join('; ');
      const cons = spec.tradeoffs.join('; ');
      return `| **${spec.shortName}** | €${spec.partCostEur.toFixed(2)} | €${spec.jlcpcbFeederFeeEur.toFixed(2)} | €${c2} / €${c5} | ±${peakWorstK.toFixed(2)} K | ${pros} | ${cons} |`;
    });
    const md = `${header}\n${lines.join('\n')}\n`;
    try {
      await navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      window.setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  return (
    <div className="space-y-6">
      {/* Full-Width Comparison Matrix */}
      <section id="matrix" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              All Topologies Compared ({batchSize}× JLCPCB Assembly Batch)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any row to load that circuit into the live simulator and error sweep.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Baseline MAX31865: €{baselineCost.toFixed(2)} / board
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Topology</th>
                <th className="py-3 px-4 text-right">Parts BOM</th>
                <th className="py-3 px-4 text-right">JLCPCB Fee</th>
                <th className="py-3 px-4 text-right">Cost / Board</th>
                <th className="py-3 px-4 text-right">Saved vs MAX</th>
                <th className="py-3 px-4 text-right">Error @ {params.collectorTempC}°C</th>
                <th className="py-3 px-4 text-right">Peak Worst-Case</th>
                <th className="py-3 px-4">Interface</th>
                <th className="py-3 px-4">Fault Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rows.map(({ spec, live, peakWorstK, unitCost, savings }) => {
                const isSelected = spec.id === selectedTopology;
                return (
                  <tr
                    key={spec.id}
                    onClick={() => onSelectTopology(spec.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{spec.badgeText}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      €{spec.partCostEur.toFixed(2)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums font-medium ${
                        spec.jlcpcbFeederFeeEur === 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      €{unitCost.toFixed(2)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        savings > 0 ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {savings > 0 ? `−€${savings.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {live.errorK === null
                        ? 'FAULT'
                        : `${live.errorK >= 0 ? '+' : ''}${live.errorK.toFixed(2)} K`}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums font-medium ${
                        peakWorstK <= 1.0
                          ? 'text-emerald-700'
                          : peakWorstK <= 1.8
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      ±{peakWorstK.toFixed(2)} K
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {spec.interfacePins.split(' (')[0]}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          live.safetyStatus === 'Nominal'
                            ? 'text-emerald-700'
                            : live.safetyStatus === 'FaultCaught'
                            ? 'text-blue-700'
                            : live.safetyStatus === 'Drifting'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {live.safetyStatus === 'Nominal' && '● Nominal'}
                        {live.safetyStatus === 'FaultCaught' && `● ${live.detectedFault}`}
                        {live.safetyStatus === 'Drifting' && '▲ Drifting'}
                        {live.safetyStatus === 'Unsafe' && '✖ Unsafe'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Side-by-Side Detailed Pros & Cons Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Detailed Pros &amp; Cons Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trade-offs across JLCPCB assembly fees, Raspberry Pi Linux timing, input protection, and fault detection.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedMarkdown ? 'Copied Markdown' : 'Copy Markdown Table'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-56">Topology &amp; Cost</th>
                <th className="py-3 px-4">Pros (Why Choose It)</th>
                <th className="py-3 px-4">Cons &amp; Watch-Outs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs align-top">
              {rows.map(({ spec, peakWorstK }) => {
                const isSelected = spec.id === selectedTopology;
                const cost2 = perBoardCostEur(spec, 2);
                const cost5 = perBoardCostEur(spec, 5);
                return (
                  <tr
                    key={spec.id}
                    onClick={() => onSelectTopology(spec.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="mt-1 font-mono tabular-nums text-[11px] text-slate-600 space-y-0.5">
                        <div>2× order: €{cost2.toFixed(2)} / bd</div>
                        <div>5× batch: €{cost5.toFixed(2)} / bd</div>
                        <div>Peak bound: ±{peakWorstK.toFixed(2)} K</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <ul className="space-y-1.5 text-slate-700">
                        {spec.advantages.map((adv) => (
                          <li key={adv} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold leading-4">+</span>
                            <span>{adv}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-4 px-4">
                      <ul className="space-y-1.5 text-slate-700">
                        {spec.tradeoffs.map((tr) => (
                          <li key={tr} className="flex items-start gap-2">
                            <span className="text-rose-600 font-bold leading-4">−</span>
                            <span>{tr}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* BOM Breakdown + Safety & Trade-Offs for Active Topology */}
      <section id="bom" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: BOM Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Bill of Materials: {activeSpec.shortName}
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Parts €{activeSpec.partCostEur.toFixed(2)} · Feeder Fee €
              {activeSpec.jlcpcbFeederFeeEur.toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Ref</th>
                  <th className="py-2.5 px-4">Component</th>
                  <th className="py-2.5 px-4">Package</th>
                  <th className="py-2.5 px-4">LCSC Class</th>
                  <th className="py-2.5 px-4 text-right">Est. EUR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {activeSpec.bom.map((item) => (
                  <tr key={item.designator}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                      {item.designator}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{item.part}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{item.packageType}</td>
                    <td
                      className={`py-2.5 px-4 font-medium ${
                        item.jlcpcbClass === 'Basic'
                          ? 'text-emerald-700'
                          : item.jlcpcbClass === 'Preferred'
                          ? 'text-blue-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {item.jlcpcbClass}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      €{item.unitCostEur.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Engineering Notes & CoSTOS Fit */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Safety &amp; Protection Summary
              </h3>
              <div className="mt-1.5 text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                <span>Protection: {activeSpec.inputProtection}</span>
                <span aria-hidden="true">·</span>
                <span>Open/Short: {activeSpec.openShortDetection}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-emerald-800 mb-1.5">Strengths</div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {activeSpec.advantages.map((adv) => (
                  <li key={adv} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold leading-4">+</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-amber-800 mb-1.5">Watch-Outs &amp; Limits</div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {activeSpec.tradeoffs.map((tr) => (
                  <li key={tr} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold leading-4">!</span>
                    <span>{tr}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
            CoSTOS Reference (HAT-1wire.md §8.2): replacing MAX31865 with the audit-verified Rev D DC-mux + 72 Hz RC ramp basic-part circuit removes the final €2.80 feeder fee and cuts 2-board prototype cost by ~€5.06/board (~€10.12 total order).
          </div>
        </div>
      </section>

      {/* Pi Overlays & Software Changes (directly under BOM) */}
      <section
        id="software-changes"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pi Overlays &amp; Software Changes vs. MAX31865 Reference: {activeSpec.shortName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes to <code className="font-mono text-slate-700">/boot/firmware/config.txt</code>, Linux device permissions, and <code className="font-mono text-slate-700">costos-hw-linux</code> Rust polling code.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
            {activeSpec.interfacePins}
          </span>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                /boot/firmware/config.txt Overlay Diff
              </div>
              <div className="font-mono text-xs text-slate-900 leading-relaxed break-words">
                {activeSpec.configTxtDiff}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Rust Driver (costos-hw-linux) &amp; Polling Change
              </div>
              <div className="text-xs text-slate-800 leading-relaxed">
                {activeSpec.softwareChanges}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                CPU Overhead vs. MAX31865 (@ {params.pollIntervalS} s Poll)
              </div>
              <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                {activeResources.cpuDelta}
              </div>
              <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeResources.detail}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                RAM Overhead vs. MAX31865 (Pi Kernel + Rust RSS)
              </div>
              <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                {activeResources.ramDelta}
              </div>
              <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                Static allocation at startup; zero dynamic heap growth across continuous 24/7 operation.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div>
              <div className="text-xs font-semibold text-emerald-800 mb-2">
                Software Advantages
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {activeSpec.softwarePros.map((pro) => (
                  <li key={pro} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold leading-4">+</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-rose-800 mb-2">
                Software Disadvantages
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {activeSpec.softwareCons.map((con) => (
                  <li key={con} className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold leading-4">−</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Security & Functional Safety */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Security &amp; Functional Safety Profile ({activeSpec.shortName})
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Linux OS / Privilege Security
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">
                  {activeSpec.securityNotes.linuxOsSecurity}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Electrical &amp; Fail-Safe Safety
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">
                  {activeSpec.securityNotes.electricalSafety}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 mb-1">
                  Required Software / HW Mitigation
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">
                  {activeSpec.securityNotes.mitigation}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Engineering Conclusion at Bottom of Simulator View */}
      <ConclusionScorecard params={params} batchSize={batchSize} />

      {/* KiCad Ready BOM & Pinout */}
      <KicadBomPinout />
    </div>
  );
};
