import React, { useState } from 'react';
import {
  PUMP_TOPOLOGY_ORDER,
  PUMP_TOPOLOGY_SPECS,
  PumpSimParams,
  PumpTopologyId,
  evaluatePumpSupply,
  pumpPerBoardCostEur,
} from '../physics/model';
import { PumpCircuitSvg } from './CircuitDiagramSvg';

interface PumpComparisonBoardProps {
  selectedTopology: PumpTopologyId;
  params: PumpSimParams;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
  onInspectInSimulator: (id: PumpTopologyId) => void;
  onExportPdf: () => void;
}

export const PumpComparisonBoard: React.FC<PumpComparisonBoardProps> = ({
  selectedTopology,
  params,
  batchSize,
  onChangeBatchSize,
  onInspectInSimulator,
  onExportPdf,
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const b05Cost = pumpPerBoardCostEur(PUMP_TOPOLOGY_SPECS.b0512s, batchSize);
  const d25Cost = pumpPerBoardCostEur(PUMP_TOPOLOGY_SPECS.d25_bjt_doubler, batchSize);
  const revDCost = pumpPerBoardCostEur(PUMP_TOPOLOGY_SPECS.lm393_schottky_doubler, batchSize);

  const rows = PUMP_TOPOLOGY_ORDER.map((id) => {
    const spec = PUMP_TOPOLOGY_SPECS[id];
    const eval1Norm = evaluatePumpSupply(id, {
      ...params,
      piSupplyV: 5.0,
      pumpCount: 1,
      loadProfile: 'normal',
      activeFault: 'none',
    });
    const eval1StressUv = evaluatePumpSupply(id, {
      ...params,
      piSupplyV: 4.63,
      pumpCount: 1,
      loadProfile: 'stress',
      activeFault: 'none',
    });
    const eval2StressUv = evaluatePumpSupply(id, {
      ...params,
      piSupplyV: 4.63,
      pumpCount: 2,
      loadProfile: 'stress',
      activeFault: 'none',
    });
    const evalDeadOsc = evaluatePumpSupply(id, {
      ...params,
      piSupplyV: 5.0,
      pumpCount: 1,
      loadProfile: 'normal',
      activeFault: 'osc_dead',
    });
    const costPerBoard = pumpPerBoardCostEur(spec, batchSize);
    return {
      spec,
      eval1Norm,
      eval1StressUv,
      eval2StressUv,
      evalDeadOsc,
      costPerBoard,
      savingsVsB05: b05Cost - costPerBoard,
    };
  });

  const handleCopyMarkdown = () => {
    const header = `| Topology | Parts + Fee (${batchSize}×) | 1× Normal @ 5V | 2× Stress @ 4.63V UV | Startup Risk | R9 / R31 Spec | Verdict |\n| --- | --- | --- | --- | --- | --- | --- |`;
    const body = rows
      .map(
        ({ spec, eval1Norm, eval2StressUv, costPerBoard }) =>
          `| **${spec.shortName}** | €${costPerBoard.toFixed(2)} (€${spec.partCostEur.toFixed(2)} + €${spec.jlcpcbFeederFeeEur.toFixed(2)} fee) | ${eval1Norm.vPumpTerminalV.toFixed(2)} V | ${eval2StressUv.vPumpTerminalV.toFixed(2)} V (${eval2StressUv.vPumpTerminalV >= 4.0 ? 'PASS' : 'FAIL'}) | ${spec.startupRisk} | ${spec.r9Spec} · ${spec.r31r32Spec} | ${spec.verdict} |`
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
          <div className="text-xs font-medium text-slate-500">Original Baseline (B0512S)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
              €{b05Cost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500">/ board ({batchSize}×)</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            €1.18 parts + €2.80 extended/THT fee. Stiff 12 V, but isolation is unused.
          </p>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/30 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-900">Claude D25 (4-BJT Doubler)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-amber-900">
              €{d25Cost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-amber-700 font-semibold">€0.00 fee · 4 flaws</span>
          </div>
          <p className="mt-1 text-xs text-slate-700">
            Works for 1 pump (6.66 V), but fails 2× stress @ 4.63 V UV &amp; risks astable lock-up.
          </p>
        </div>

        <div className="bg-white border border-emerald-300 bg-emerald-50/40 rounded-lg p-4">
          <div className="text-xs font-medium text-emerald-900">Locked Rev E (15 Parts · CMOS)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-emerald-800">
              €{revDCost.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              Saves €{(b05Cost - revDCost).toFixed(2)}/bd
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-700">
            +9.21 V +V_DRV / +7.65 V J2 under D18 +5V_HAT = 5.045 V. 100% JLCPCB Basic (€0.00 Ext fees): C20 (C46653 1 nF X7R) + R60A∥R60B (2×100 Ω 1206 = 50 Ω).
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">GPIO &amp; Firmware Cost</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono tabular-nums font-semibold text-blue-700">0</span>
            <span className="text-xs font-mono text-slate-500">GPIOs · 0 LOC Rust</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Autonomous hardware supply. Locked Sub 05 R31 22 kΩ / R32 10 kΩ gives 2.36 V nominal / 2.01 V UVLO on GPIO 6.
          </p>
        </div>
      </div>

      {/* Master Summary Table */}
      <section
        id="pump-comparison-table"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pump PWM Driver Supply Comparison Table (All 5 Architectures)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calibrated against CoSTOS HAT-development.md §9 ngspice runs · Wilo / Grundfos minimum PWM high = 4.00 V
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
                2× Batch
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
                5× Batch
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedMarkdown ? 'Copied Markdown' : 'Copy Markdown'}
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-5">Topology</th>
                <th className="py-3 px-3 text-right">Parts / Fee</th>
                <th className="py-3 px-3 text-right">Cost ({batchSize}×)</th>
                <th className="py-3 px-3 text-right">1× Norm (5 V)</th>
                <th className="py-3 px-3 text-right">2× Stress (4.63 V)</th>
                <th className="py-3 px-3">Startup Risk</th>
                <th className="py-3 px-3">R9 / R31 Spec</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rows.map(({ spec, eval1Norm, eval2StressUv, costPerBoard, savingsVsB05 }) => {
                const isRec = spec.id === 'lm393_schottky_doubler';
                const isSelected = spec.id === selectedTopology;
                const pass2x = eval2StressUv.vPumpTerminalV >= 4.0;
                return (
                  <tr
                    key={spec.id}
                    className={`transition-colors ${
                      isRec
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : isSelected
                        ? 'bg-blue-50/40 hover:bg-blue-50/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{spec.shortName}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {spec.badgeText}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="text-slate-900">€{spec.partCostEur.toFixed(2)}</div>
                      <div
                        className={`text-[11px] ${
                          spec.jlcpcbFeederFeeEur === 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-rose-700'
                        }`}
                      >
                        Fee €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900">€{costPerBoard.toFixed(2)}</div>
                      <div
                        className={`text-[11px] ${
                          savingsVsB05 > 0.05
                            ? 'text-emerald-700'
                            : savingsVsB05 < -0.05
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {Math.abs(savingsVsB05) < 0.01
                          ? 'Baseline'
                          : savingsVsB05 > 0
                          ? `−€${savingsVsB05.toFixed(2)}`
                          : `+€${Math.abs(savingsVsB05).toFixed(2)}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          eval1Norm.vPumpTerminalV >= 6.0
                            ? 'text-emerald-800'
                            : eval1Norm.vPumpTerminalV >= 4.5
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {eval1Norm.vPumpTerminalV.toFixed(2)} V
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div
                        className={`font-semibold ${
                          pass2x ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {eval2StressUv.vPumpTerminalV.toFixed(2)} V
                      </div>
                      <div
                        className={`text-[10px] font-bold uppercase ${
                          pass2x ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {pass2x ? 'PASS ≥4V' : 'FAIL <4V'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 max-w-[180px]">{spec.startupRisk}</td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-700">
                      <div>R9: {spec.r9Spec}</div>
                      <div className="text-slate-500">{spec.r31r32Spec}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectInSimulator(spec.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
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

      {/* Detailed Topology Cards: Schematics + Advantages & Disadvantages */}
      <section id="pump-pros-cons" className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Detailed Architecture Breakdown — Advantages, Disadvantages &amp; Fail-Safe Behavior
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every candidate evaluated with schematic block diagram, BOM summary, explicit pros/cons, and H3 safety analysis.
          </p>
        </div>

        <div className="space-y-5">
          {rows.map(({ spec, eval1Norm, eval1StressUv, eval2StressUv, evalDeadOsc, costPerBoard }, idx) => {
            const isRec = spec.id === 'lm393_schottky_doubler';
            const pass2x = eval2StressUv.vPumpTerminalV >= 4.0;
            return (
              <article
                key={spec.id}
                className={`bg-white rounded-lg border overflow-hidden ${
                  isRec ? 'border-emerald-300 ring-1 ring-emerald-200/70' : 'border-slate-200'
                }`}
              >
                <div
                  className={`px-6 py-4 border-b flex flex-wrap items-start justify-between gap-4 ${
                    isRec
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        0{idx + 1}. {spec.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-[10.5px] font-mono font-semibold border rounded ${
                          isRec
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {spec.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-4xl leading-relaxed">
                      {spec.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-sm font-semibold text-slate-900">
                        €{costPerBoard.toFixed(2)} / bd
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {spec.partCount} parts · 1× {eval1Norm.vPumpTerminalV.toFixed(2)} V · 2× UV{' '}
                        {eval2StressUv.vPumpTerminalV.toFixed(2)} V
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectInSimulator(spec.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Open in Sim
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <PumpCircuitSvg topologyId={spec.id} compact />

                  {/* Per-Option BOM Table */}
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono">
                      <span className="font-semibold uppercase tracking-wider text-slate-600">
                        Topology Bill of Materials ({spec.partCount} Parts)
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        Parts €{spec.partCostEur.toFixed(2)} · Feeder Fee €{spec.jlcpcbFeederFeeEur.toFixed(2)} · {spec.handSolderability}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-1.5 px-3">Ref</th>
                            <th className="py-1.5 px-3">Component</th>
                            <th className="py-1.5 px-3">Package</th>
                            <th className="py-1.5 px-3">JLCPCB Class</th>
                            <th className="py-1.5 px-3 text-right">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {spec.bom.map((b) => (
                            <tr key={b.designator} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {b.designator}
                              </td>
                              <td className="py-1.5 px-3 text-slate-700">{b.part}</td>
                              <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {b.packageType}
                              </td>
                              <td className="py-1.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border ${
                                    b.jlcpcbClass === 'Basic'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {b.jlcpcbClass}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                €{b.unitCostEur.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Multi-Corner Bench Telemetry & H3 / Firmware Impact Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        1× Norm @ 5.00 V
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {eval1Norm.vPumpTerminalV.toFixed(2)} V
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {eval1Norm.rippleMvPp.toFixed(0)} mVpp · Pi {eval1Norm.pi5vCurrentMa.toFixed(0)} mA
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        1× Stress @ 4.63 V UV
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {eval1StressUv.vPumpTerminalV.toFixed(2)} V
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        GPIO 6: {eval1StressUv.readbackGpio6V.toFixed(2)} V
                      </div>
                    </div>
                    <div
                      className={`border rounded-md p-3 ${
                        pass2x
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        2× Stress @ 4.63 V UV
                      </div>
                      <div
                        className={`text-sm font-bold mt-0.5 ${
                          pass2x ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {eval2StressUv.vPumpTerminalV.toFixed(2)} V ({pass2x ? 'PASS' : 'FAIL'})
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Floor: 4.00 V Wilo/Grundfos
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Osc Dead / Pi SW Cost
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {spec.id === 'direct_5v'
                          ? 'N/A (0 Ω)'
                          : `${evalDeadOsc.vPumpTerminalV.toFixed(2)} V / G6 ${evalDeadOsc.readbackGpio6V.toFixed(2)} V`}
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        0 GPIOs · 0 LOC Rust
                      </div>
                    </div>
                  </div>

                  {/* Advantages vs Disadvantages */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-md p-4">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 mb-2">
                        Advantages
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {spec.advantages.map((adv) => (
                          <li key={adv} className="flex items-start gap-2">
                            <span className="text-emerald-700 font-bold select-none">+</span>
                            <span>{adv}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-rose-50/40 border border-rose-200/80 rounded-md p-4">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800 mb-2">
                        Disadvantages &amp; Trade-Offs
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {spec.tradeoffs.map((con) => (
                          <li key={con} className="flex items-start gap-2">
                            <span className="text-rose-600 font-bold select-none">−</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Fail-Safe Strip */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs">
                    <div>
                      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        Oscillator Failure
                      </div>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {spec.failSafeNotes.oscillatorFailure}
                      </p>
                    </div>
                    <div>
                      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        Shorted PWM Cable
                      </div>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {spec.failSafeNotes.shortCircuitBehavior}
                      </p>
                    </div>
                    <div>
                      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        GPIO 6 Readback Safety
                      </div>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {spec.failSafeNotes.readbackSafety}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 bg-blue-50/50 border border-blue-200/70 rounded-md px-4 py-2.5">
                    <span className="font-semibold text-slate-900">Engineering Verdict: </span>
                    {spec.verdict}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
