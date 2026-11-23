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
import { CircuitDiagramSvg } from './CircuitDiagramSvg';
import { ConclusionScorecard } from './ConclusionScorecard';
import { KicadBomPinout } from './KicadBomPinout';
import { HardwareAuditHistory } from './AuditHistory';

interface FullComparisonBoardProps {
  selectedTopology: TopologyId;
  params: SimulationParams;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
  onInspectInSimulator: (id: TopologyId) => void;
  onExportPdf: () => void;
}

export const FullComparisonBoard: React.FC<FullComparisonBoardProps> = ({
  selectedTopology,
  params,
  batchSize,
  onChangeBatchSize,
  onInspectInSimulator,
  onExportPdf,
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

  const handleCopyMarkdown = async () => {
    const header =
      '| Topology | Parts BOM | JLCPCB Fee | Cost / Board (2× / 5×) | Worst-Case (−50…+250 °C) | Pi Interface | Pros | Cons |\n|---|---:|---:|---:|---:|---|---|---|';
    const lines = rows.map(({ spec, peakWorstK }) => {
      const c2 = perBoardCostEur(spec, 2).toFixed(2);
      const c5 = perBoardCostEur(spec, 5).toFixed(2);
      return `| **${spec.shortName}** | €${spec.partCostEur.toFixed(2)} | €${spec.jlcpcbFeederFeeEur.toFixed(2)} | €${c2} / €${c5} | ±${peakWorstK.toFixed(2)} K | ${spec.interfacePins} | ${spec.advantages.join('; ')} | ${spec.tradeoffs.join('; ')} |`;
    });
    try {
      await navigator.clipboard.writeText(`${header}\n${lines.join('\n')}\n`);
      setCopiedMarkdown(true);
      window.setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // Ignore clipboard denial in restricted iframes
    }
  };

  return (
    <div className="space-y-8">
      {/* Top 4-Column Executive Cost & Recommendation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Current MAX31865 Cost</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono tabular-nums font-semibold text-slate-900">
              €{baselineCost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">/ board ({batchSize}×)</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600">
            €4.08 parts + €2.80 JLCPCB feeder fee
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Best Zero-Fee Option (Rev D)</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono tabular-nums font-semibold text-emerald-700">
              €0.42
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">/ board</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-700 font-medium">
            Audit-Verified 72 Hz RC Ramp + ln()
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Savings Per {batchSize}-Board Order</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono tabular-nums font-semibold text-blue-700">
              €{((baselineCost - 0.42) * batchSize).toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">total saved</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600">
            Eliminates the final extended-part fee on the HAT
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Active Bench Condition</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono tabular-nums font-semibold text-slate-900">
              {params.collectorTempC}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">°C · {params.pollIntervalS}s poll</span>
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-slate-600">
            ±{params.resistorTolerancePct}% R · {params.cableResistanceOhm.toFixed(2)} Ω cable
          </div>
        </div>
      </div>

      {/* Section 1: Summary Comparison Table */}
      <section id="comparison-table" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Summary Comparison Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {params.collectorTempC} °C · {params.pollIntervalS} s poll · ±{params.resistorTolerancePct}% tol ·{' '}
              {params.calibrateCableAndZero ? 'calibrated' : 'uncalibrated'} · {params.supplyVoltageV.toFixed(2)} V rail
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => onChangeBatchSize(2)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  batchSize === 2
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2× Min Order
              </button>
              <button
                type="button"
                onClick={() => onChangeBatchSize(5)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  batchSize === 5
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                5× Group Batch
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedMarkdown ? 'Copied Markdown' : 'Copy Markdown'}
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5">Topology</th>
                <th className="py-3.5 px-4 text-right">Parts BOM</th>
                <th className="py-3.5 px-4 text-right">JLCPCB Fee</th>
                <th className="py-3.5 px-4 text-right">Cost / Board</th>
                <th className="py-3.5 px-4 text-right">Saved vs MAX</th>
                <th className="py-3.5 px-4 text-right">Worst-Case ΔT</th>
                <th className="py-3.5 px-4">Pi Interface</th>
                <th className="py-3.5 px-4">Open / Short Detection</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {rows.map(({ spec, peakWorstK, unitCost, savings }) => {
                const isSelected = spec.id === selectedTopology;
                return (
                  <tr
                    key={spec.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{spec.badgeText}</div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums text-slate-700">
                      €{spec.partCostEur.toFixed(2)}
                    </td>
                    <td
                      className={`py-4 px-4 text-right font-mono tabular-nums font-medium ${
                        spec.jlcpcbFeederFeeEur === 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      €{unitCost.toFixed(2)}
                    </td>
                    <td
                      className={`py-4 px-4 text-right font-mono tabular-nums font-semibold ${
                        savings > 0 ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {savings > 0 ? `−€${savings.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={`py-4 px-4 text-right font-mono tabular-nums font-semibold ${
                        peakWorstK <= 0.8
                          ? 'text-emerald-700'
                          : peakWorstK <= 1.3
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      ±{peakWorstK.toFixed(2)} K
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {spec.interfacePins.split(' (')[0]}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-700 max-w-xs">
                      {spec.openShortDetection}
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectInSimulator(spec.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Simulate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Detailed Pros & Cons Breakdown (Spacious, Full-Height Cards) */}
      <section id="pros-cons" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detailed Pros &amp; Cons per Topology
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete trade-off analysis across JLCPCB assembly economics, Linux timing, protection, and CoSTOS Rust software fit.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {rows.map(({ spec, peakWorstK, unitCost, savings }, index) => {
            const c2 = perBoardCostEur(spec, 2);
            const c5 = perBoardCostEur(spec, 5);
            const res = estimateResourceFootprint(spec.id, params.pollIntervalS);
            return (
              <article
                key={spec.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <h3 className="text-base font-semibold text-slate-900">
                        0{index + 1}. {spec.name}
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        {spec.badgeText}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{spec.verdict}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-sm font-semibold text-slate-900">
                        €{unitCost.toFixed(2)} / board
                        {savings > 0 && (
                          <span className="ml-2 text-emerald-700">(−€{savings.toFixed(2)})</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        2× €{c2.toFixed(2)} · 5× €{c5.toFixed(2)} · ±{peakWorstK.toFixed(2)} K
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectInSimulator(spec.id)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open in Simulator
                    </button>
                  </div>
                </div>

                {/* Circuit Diagram for This Topology */}
                <div className="px-6 py-4 bg-white border-b border-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Circuit Schematic ({spec.shortName})
                  </div>
                  <CircuitDiagramSvg topologyId={spec.id} compact />
                </div>

                {/* 2-Column Hardware Pros vs Cons Body */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  <div className="p-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-3">
                      Hardware &amp; Cost Pros
                    </h4>
                    <ul className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                      {spec.advantages.map((adv) => (
                        <li key={adv} className="flex items-start gap-2.5">
                          <span className="text-emerald-600 font-bold select-none mt-0.5">+</span>
                          <span>{adv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-800 mb-3">
                      Hardware Cons &amp; Watch-Outs
                    </h4>
                    <ul className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                      {spec.tradeoffs.map((tr) => (
                        <li key={tr} className="flex items-start gap-2.5">
                          <span className="text-rose-600 font-bold select-none mt-0.5">−</span>
                          <span>{tr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Pi Overlays & Software Changes (vs. MAX31865 Ref) */}
                <div className="border-t border-slate-200 bg-slate-50/40 p-6 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Pi /boot/firmware/config.txt Change
                      </div>
                      <div className="font-mono text-xs text-slate-900 leading-relaxed break-words">
                        {spec.configTxtDiff}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Software Change (vs. MAX31865 Ref)
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed">
                        {spec.softwareChanges}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Extra Pi CPU Usage (@ {params.pollIntervalS} s Poll)
                      </div>
                      <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                        {res.cpuDelta}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {res.detail}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Extra Pi RAM Usage (Kernel + Rust RSS)
                      </div>
                      <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                        {res.ramDelta}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-2">
                        Software Advantages
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {spec.softwarePros.map((pro) => (
                          <li key={pro} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold select-none">+</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-800 mb-2">
                        Software Disadvantages
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {spec.softwareCons.map((con) => (
                          <li key={con} className="flex items-start gap-2">
                            <span className="text-rose-600 font-bold select-none">−</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Security & Functional Safety */}
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Linux OS / Privilege Security
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed">
                        {spec.securityNotes.linuxOsSecurity}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Electrical &amp; Fail-Safe Safety
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed">
                        {spec.securityNotes.electricalSafety}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 mb-1">
                        Required Mitigation
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed">
                        {spec.securityNotes.mitigation}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Spec Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-600">
                  <span>Interface: {spec.interfacePins}</span>
                  <span aria-hidden="true">·</span>
                  <span>Protection: {spec.inputProtection}</span>
                  <span aria-hidden="true">·</span>
                  <span>Soldering: {spec.handSolderability}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 3: Final Engineering Conclusion (Initial vs. Now Used) */}
      <ConclusionScorecard params={params} batchSize={batchSize} />

      {/* Section 4: KiCad Ready BOM & Raspberry Pi Pinout */}
      <KicadBomPinout />

      {/* Section 5: Hardware Audit & Revision History (Rev A -> Rev D) */}
      <HardwareAuditHistory />
    </div>
  );
};
