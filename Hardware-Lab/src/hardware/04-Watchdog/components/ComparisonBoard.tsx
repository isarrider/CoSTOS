import React, { useState } from 'react';
import {
  WATCHDOG_TOPOLOGY_ORDER,
  WATCHDOG_TOPOLOGY_SPECS,
  WatchdogSimParams,
  WatchdogTopologyId,
  evaluateWatchdog,
  watchdogPerBoardCostEur,
} from '../physics/model';
import { WatchdogCircuitSvg } from './CircuitDiagramSvg';

interface WatchdogComparisonBoardProps {
  selectedTopology: WatchdogTopologyId;
  params: WatchdogSimParams;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
  onInspectInSimulator: (id: WatchdogTopologyId) => void;
  onExportPdf: () => void;
}

export const WatchdogComparisonBoard: React.FC<WatchdogComparisonBoardProps> = ({
  selectedTopology,
  params,
  batchSize,
  onChangeBatchSize,
  onInspectInSimulator,
  onExportPdf,
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const origCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], batchSize);
  const d24Cost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.d24_cap_pump, batchSize);
  const gemCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.u3b_schmitt_wd, batchSize);

  const rows = WATCHDOG_TOPOLOGY_ORDER.map((id) => {
    const spec = WATCHDOG_TOPOLOGY_SPECS[id];
    const evalNom = evaluateWatchdog(id, {
      ...params,
      heartbeatHz: 20,
      linuxStallS: 0,
      ambientTempC: 30,
      mosfetCorner: 'typ',
      fluxLeakage: 'clean',
      activeFault: 'none',
    });
    const evalStall5Max = evaluateWatchdog(id, {
      ...params,
      heartbeatHz: 20,
      linuxStallS: 5.0,
      ambientTempC: 30,
      mosfetCorner: 'max',
      fluxLeakage: 'clean',
      activeFault: 'none',
    });
    const evalRunaway = evaluateWatchdog(id, {
      ...params,
      heartbeatHz: 2000,
      linuxStallS: 0,
      ambientTempC: 30,
      mosfetCorner: 'min',
      fluxLeakage: 'clean',
      activeFault: 'runaway_2khz',
    });
    const evalHumid60 = evaluateWatchdog(id, {
      ...params,
      heartbeatHz: 20,
      linuxStallS: 0,
      ambientTempC: 60,
      mosfetCorner: 'max',
      fluxLeakage: 'humid_boiler',
      activeFault: 'none',
    });
    const costPerBoard = watchdogPerBoardCostEur(spec, batchSize);
    return {
      spec,
      evalNom,
      evalStall5Max,
      evalRunaway,
      evalHumid60,
      costPerBoard,
      savingsVsOrig: origCost - costPerBoard,
    };
  });

  const handleCopyMarkdown = () => {
    const header = `| Topology | Cost/bd (${batchSize}×) | Window (2 kHz) | Relay Edge | Timeout / Readback | 5 s Linux Stall (max V_th) | Verdict |\n| --- | --- | --- | --- | --- | --- | --- |`;
    const body = rows
      .map(
        ({ spec, evalRunaway, evalStall5Max, costPerBoard }) =>
          `| **${spec.shortName}** | €${costPerBoard.toFixed(2)} (€${spec.partCostEur.toFixed(2)} + €${spec.jlcpcbFeederFeeEur.toFixed(2)} fee) | ${!evalRunaway.relayEnergized ? 'PASS (OFF)' : 'FAIL (ON)'} | ${spec.edgeTransition} | ${spec.timeoutSpec} | ${evalStall5Max.relayEnergized ? `PASS (+${evalStall5Max.stallMarginMv.toFixed(0)} mV)` : 'TRIPPED'} | ${spec.verdict} |`
      )
      .join('\n');
    navigator.clipboard?.writeText(`${header}\n${body}`);
    setCopiedMarkdown(true);
    window.setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Executive KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Original (74LVC1G123 + TPS22918)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
              €{origCost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500">/ board ({batchSize}×)</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            €1.68 parts + €5.60 extended fees. Accepts 2 kHz runaway &amp; trips at 3 s stall.
          </p>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/30 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-900">Claude D24 Passive Charge-Pump</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-amber-900">
              €{d24Cost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-amber-700 font-semibold">€0.00 fee · 3 flaws</span>
          </div>
          <p className="mt-1 text-xs text-slate-700">
            True window &amp; fault isolation, but 2 s relay brown-out arcing &amp; 8 s Q14/Q13 blind spot.
          </p>
        </div>

        <div className="bg-white border border-emerald-300 bg-emerald-50/40 rounded-lg p-4">
          <div className="text-xs font-medium text-emerald-900">Gemini Version · Rev B (Dedicated U4)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-emerald-800">
              €{gemCost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              Saves €{(origCost - gemCost).toFixed(2)}/bd
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-700">
            Dedicated U4 (C7955), D25 Q12 Relay 16.11 s / Pump+RB 18.42 s (unscaled TI LM393 SPICE), 10 s Linux stall safe.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">GPIO &amp; Firmware Compatibility</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-blue-700">2</span>
            <span className="text-xs font-mono text-slate-500">GPIOs (24 HB · 20 RB)</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            100% drop-in compatible with existing CoSTOS GPIO24 (20 Hz) &amp; GPIO20 (LOW = ON) spec.
          </p>
        </div>
      </div>



      {/* Master Summary Table */}
      <section
        id="wd-comparison-table"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Hardware Watchdog &amp; Relay Switch Matrix — All 5 Architectures
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated across 20 Hz nominal, 2 kHz runaway loop, 5 s Linux stall (worst-case AO3400A V_th = 1.45 V), and 60 °C boiler-room humidity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded border border-slate-200">
              {([2, 5] as const).map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => onChangeBatchSize(qty)}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                    batchSize === qty
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {qty}× Batch
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              {copiedMarkdown ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md cursor-pointer"
            >
              Export 9-Page PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Architecture</th>
                <th className="py-2.5 px-3">Cost / Bd ({batchSize}×)</th>
                <th className="py-2.5 px-3">Runaway 2 kHz</th>
                <th className="py-2.5 px-3">5 s Stall (Max V_th)</th>
                <th className="py-2.5 px-3">Relay Cutoff Edge</th>
                <th className="py-2.5 px-3">Timeout / Self-Test</th>
                <th className="py-2.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(({ spec, evalRunaway, evalStall5Max, evalNom, costPerBoard }) => {
                const isRec = spec.id === 'u3b_schmitt_wd';
                const isSelected = spec.id === selectedTopology;
                return (
                  <tr
                    key={spec.id}
                    className={`${
                      isRec
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : isSelected
                        ? 'bg-blue-50/30 hover:bg-blue-50/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="text-[11px] text-slate-500">{spec.badgeText}</div>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      <div className="font-semibold text-slate-900">€{costPerBoard.toFixed(2)}</div>
                      <div className="text-[10.5px] text-slate-500">
                        {spec.jlcpcbFeederFeeEur > 0
                          ? `€${spec.jlcpcbFeederFeeEur.toFixed(2)} fee`
                          : '€0.00 fee'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">
                      {!evalRunaway.relayEnergized ? (
                        <span className="text-emerald-700">PASS (OFF)</span>
                      ) : (
                        <span className="text-rose-700">FAIL (STAYS ON)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      {evalStall5Max.relayEnergized ? (
                        <span
                          className={
                            evalStall5Max.stallMarginMv >= 250
                              ? 'text-emerald-700 font-semibold'
                              : 'text-amber-700 font-semibold'
                          }
                        >
                          +{evalStall5Max.stallMarginMv.toFixed(0)} mV
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold">TRIPPED</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{spec.edgeTransition}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      <div>{spec.timeoutSpec}</div>
                      <div className="text-[10.5px] text-slate-500">
                        {spec.id === 'u3b_schmitt_wd'
                          ? 'Relay cuts 2.31 s before RB (safe)'
                          : evalNom.readbackMismatchS > 0.1
                          ? `Mismatch up to ${evalNom.readbackMismatchS.toFixed(1)} s`
                          : spec.id === '74lvc1g123'
                          ? 'No GPIO20 pin'
                          : '0.00 s mismatch'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectInSimulator(spec.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-white border border-blue-200 hover:bg-blue-600 rounded transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Simulate →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Option Dossiers (All 5 with Authentic IEEE Schematics, Telemetry Strips, BOMs, Pros & Cons) */}
      <section id="wd-pros-cons" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detailed Circuit Dossiers — Schematics, Telemetry, BOMs, Advantages &amp; Disadvantages
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every candidate evaluated with authentic IEEE/IEC circuit diagrams, 4-corner bench telemetry, and explicit failure-mode trade-offs.
            </p>
          </div>
        </div>

        {rows.map(({ spec, evalNom, evalStall5Max, evalRunaway, evalHumid60, costPerBoard }, idx) => {
          const isRec = spec.id === 'u3b_schmitt_wd';
          return (
            <article
              key={spec.id}
              className={`bg-white border rounded-lg overflow-hidden ${
                isRec ? 'border-emerald-300 ring-1 ring-emerald-200/70' : 'border-slate-200'
              }`}
            >
              <div
                className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
                  isRec ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500">
                    Option {idx + 1} of 5 · {spec.badgeText}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mt-0.5">{spec.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-sm font-bold text-slate-900">€{costPerBoard.toFixed(2)}/bd</div>
                    <div className="text-[11px] text-slate-500">
                      {spec.partCount} parts · €{spec.jlcpcbFeederFeeEur.toFixed(2)} fee
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectInSimulator(spec.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Open in Simulator
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-xs text-slate-700 leading-relaxed">{spec.summary}</p>

                {/* Authentic IEEE Schematic */}
                <WatchdogCircuitSvg topologyId={spec.id} />

                {/* 4-Corner Telemetry Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <div className="text-[10.5px] font-mono uppercase text-slate-500">20 Hz Nominal</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {evalNom.cutoffTimeoutS.toFixed(1)} s cutoff
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{evalNom.edgeSpeedLabel}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <div className="text-[10.5px] font-mono uppercase text-slate-500">5 s Linux Stall (Max V_th)</div>
                    <div
                      className={`text-sm font-mono tabular-nums font-semibold mt-0.5 ${
                        !evalStall5Max.relayEnergized
                          ? 'text-rose-700'
                          : evalStall5Max.stallMarginMv >= 250
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {evalStall5Max.relayEnergized
                        ? `PASS (+${evalStall5Max.stallMarginMv.toFixed(0)} mV)`
                        : 'TRIPPED OFF'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      V_CAP = {evalStall5Max.vCapAfterStallV.toFixed(2)} V
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <div className="text-[10.5px] font-mono uppercase text-slate-500">2 kHz Runaway Loop</div>
                    <div
                      className={`text-sm font-mono tabular-nums font-semibold mt-0.5 ${
                        !evalRunaway.relayEnergized ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {!evalRunaway.relayEnergized ? 'REJECTED (OFF)' : 'ACCEPTED (UNSAFE)'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {spec.windowWatchdog ? 'Bandpass LPF active' : 'No upper f limit'}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <div className="text-[10.5px] font-mono uppercase text-slate-500">60 °C + 3 MΩ Humid PCB</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {evalHumid60.cutoffTimeoutS.toFixed(1)} s timeout
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      V_CAP = {evalHumid60.vCapSteadyV.toFixed(2)} V
                    </div>
                  </div>
                </div>

                {/* Explicit Advantages & Disadvantages */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/40 border border-emerald-200 rounded-md p-4">
                    <div className="text-xs font-mono uppercase tracking-wider font-semibold text-emerald-800 mb-2">
                      Advantages
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                      {spec.advantages.map((a) => (
                        <li key={a} className="leading-relaxed">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-rose-50/40 border border-rose-200 rounded-md p-4">
                    <div className="text-xs font-mono uppercase tracking-wider font-semibold text-rose-800 mb-2">
                      Disadvantages &amp; Trade-offs
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                      {spec.tradeoffs.map((t) => (
                        <li key={t} className="leading-relaxed">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Per-Option BOM Table */}
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-600">
                    Bill of Materials — {spec.shortName} ({spec.partCount} parts · €{spec.partCostEur.toFixed(2)} + €{spec.jlcpcbFeederFeeEur.toFixed(2)} fee)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-[10.5px] font-mono text-slate-500">
                          <th className="py-1.5 px-3">RefDes</th>
                          <th className="py-1.5 px-3">Component</th>
                          <th className="py-1.5 px-3">Package</th>
                          <th className="py-1.5 px-3">JLCPCB Class</th>
                          <th className="py-1.5 px-3 text-right">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {spec.bom.map((b) => (
                          <tr key={b.designator}>
                            <td className="py-1.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {b.designator}
                            </td>
                            <td className="py-1.5 px-3 text-slate-700">{b.part}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{b.packageType}</td>
                            <td className="py-1.5 px-3 font-mono">
                              <span
                                className={
                                  b.jlcpcbClass === 'Basic'
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-rose-700 font-semibold'
                                }
                              >
                                {b.jlcpcbClass}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-800">
                              €{b.unitCostEur.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};
