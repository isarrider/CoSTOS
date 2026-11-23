import { useMemo, useState } from 'react';
import {
  DEFAULT_PUMP_PARAMS,
  PUMP_TOPOLOGY_SPECS,
  PumpSimParams,
  PumpTopologyId,
  evaluatePumpSupply,
  pumpPerBoardCostEur,
} from './physics/model';
import { PumpComparisonBoard } from './components/ComparisonBoard';
import { PumpControlConsole } from './components/ControlConsole';
import { PumpCircuitSvg } from './components/CircuitDiagramSvg';
import { PumpVoltageSweepChart } from './components/SweepChart';
import { exportPumpSupplyPdfReport } from './utils/exportPdfReport';

type PumpViewMode = 'comparison' | 'simulator';

export function PumpSupplyWorkspace() {
  const [activeView, setActiveView] = useState<PumpViewMode>('comparison');
  const [selectedTopology, setSelectedTopology] =
    useState<PumpTopologyId>('lm393_schottky_doubler');
  const [params, setParams] = useState<PumpSimParams>(DEFAULT_PUMP_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(2);

  const result = useMemo(
    () => evaluatePumpSupply(selectedTopology, params),
    [selectedTopology, params]
  );

  const activeSpec = PUMP_TOPOLOGY_SPECS[selectedTopology];
  const baselineCost = pumpPerBoardCostEur(PUMP_TOPOLOGY_SPECS.b0512s, batchSize);
  const activeCost = pumpPerBoardCostEur(activeSpec, batchSize);
  const costDelta = baselineCost - activeCost;

  const handleSelectView = (view: PumpViewMode, anchor?: string) => {
    setActiveView(view);
    if (anchor) {
      window.requestAnimationFrame(() => {
        if (anchor === 'pump-top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  };

  const handleInspectInSimulator = (id: PumpTopologyId) => {
    setSelectedTopology(id);
    setActiveView('simulator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('lm393_schottky_doubler');
    setParams(DEFAULT_PUMP_PARAMS);
    setBatchSize(2);
  };

  const handleExportPdf = () => {
    exportPumpSupplyPdfReport(selectedTopology, params, batchSize);
  };

  return (
    <div id="pump-top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Subsystem Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <a
            href="#pump-top"
            onClick={(e) => {
              e.preventDefault();
              handleSelectView('comparison', 'pump-top');
            }}
            className="text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            03. Pump PWM Driver Supply Lab
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#pump-comparison-table"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'pump-comparison-table');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeView === 'comparison'
                  ? 'text-slate-900 border-blue-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Comparison Table
            </a>
            <a
              href="#pump-pros-cons"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'pump-pros-cons');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Pros &amp; Cons
            </a>
            <a
              href="#pump-simulator"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('simulator', 'pump-simulator');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeView === 'simulator'
                  ? 'text-slate-900 border-blue-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Live Simulator
            </a>
            <a
              href="#pump-conclusion"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'pump-conclusion');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Conclusion
            </a>
            <a
              href="#pump-kicad-bom"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'pump-kicad-bom');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              KiCad BOM
            </a>
            <a
              href="#pump-audit-history"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'pump-audit-history');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Audit History
            </a>
          </nav>

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Bench
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Workspace Headline & Mode Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              Replacing B0512S &amp; Auditing Claude’s D25 Pump PWM Driver Supply
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Evaluates the +V_DRV rail that powers the solar pump PWM output stage (B0512S 12 V brick, Claude’s D25 4-BJT astable doubler from GitHub HAT-development.md §9, MT3608 boost, and the Gemini Version Rev E 14-part zero-fee LM393 + SS14 Schottky doubler) across 1×/2× pumps, Pi 4.63 V under-voltage, and fault injection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView('comparison')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeView === 'comparison'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Table &amp; Detailed Pros/Cons
              </button>
              <button
                type="button"
                onClick={() => setActiveView('simulator')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeView === 'simulator'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Circuit Simulator
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Export PDF Report
            </button>
          </div>
        </div>

        {activeView === 'comparison' ? (
          <PumpComparisonBoard
            selectedTopology={selectedTopology}
            params={params}
            batchSize={batchSize}
            onChangeBatchSize={setBatchSize}
            onInspectInSimulator={handleInspectInSimulator}
            onExportPdf={handleExportPdf}
          />
        ) : (
          <div id="pump-simulator" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <PumpControlConsole
                selectedTopology={selectedTopology}
                onSelectTopology={setSelectedTopology}
                params={params}
                onChangeParams={setParams}
                batchSize={batchSize}
                onChangeBatchSize={setBatchSize}
              />

              <div className="flex-1 min-w-0 w-full space-y-6">
                {/* 4-KPI Live Telemetry Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Pump PWM High Voltage</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-mono tabular-nums font-semibold ${
                          result.vPumpTerminalV >= 4.8
                            ? 'text-emerald-700'
                            : result.vPumpTerminalV >= 4.0
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {result.vPumpTerminalV.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">V</span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      Margin vs 4.0 V:{' '}
                      <span
                        className={
                          result.marginAbove4V >= 0.8
                            ? 'text-emerald-700 font-semibold'
                            : result.marginAbove4V >= 0
                            ? 'text-amber-700 font-semibold'
                            : 'text-rose-700 font-semibold'
                        }
                      >
                        {result.marginAbove4V >= 0 ? '+' : ''}
                        {result.marginAbove4V.toFixed(2)} V
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">+V_DRV Rail &amp; Ripple</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        {result.vDrvLoadedV.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">V</span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      Ripple: {result.rippleMvPp.toFixed(0)} mVpp · Pi 5V: {result.pi5vCurrentMa.toFixed(0)} mA
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Supply Cost / Board ({batchSize}×)
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        €{activeCost.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">EUR</span>
                    </div>
                    <div
                      className={`mt-1 text-xs font-mono tabular-nums ${
                        costDelta > 0.01
                          ? 'text-emerald-700 font-medium'
                          : costDelta < -0.01
                          ? 'text-rose-700 font-medium'
                          : 'text-slate-600'
                      }`}
                    >
                      {Math.abs(costDelta) < 0.01
                        ? 'B0512S baseline'
                        : costDelta > 0
                        ? `Saves €${costDelta.toFixed(2)} vs B0512S`
                        : `+€${Math.abs(costDelta).toFixed(2)} vs B0512S`}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Safety &amp; Readback</div>
                    <div className="mt-1.5">
                      <span
                        className={`text-base font-semibold ${
                          result.safetyStatus === 'Nominal'
                            ? 'text-emerald-700'
                            : result.safetyStatus === 'FailSafeCaught'
                            ? 'text-blue-700'
                            : result.safetyStatus === 'Borderline'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {result.safetyStatus === 'Nominal' && `● ${result.statusHeadline}`}
                        {result.safetyStatus === 'FailSafeCaught' && `● ${result.statusHeadline}`}
                        {result.safetyStatus === 'Borderline' && `▲ ${result.statusHeadline}`}
                        {result.safetyStatus === 'FailsSpec' && `✖ ${result.statusHeadline}`}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      GPIO 6: {result.readbackGpio6V.toFixed(2)} V · P(R9): {result.r9PowerW.toFixed(2)} W
                    </div>
                  </div>
                </div>

                {/* Live Schematic & Node Readouts */}
                <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">{activeSpec.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{result.statusDetail}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-600">
                      Pi Rail: {result.effectivePiV.toFixed(2)} V · {params.pumpCount}×{' '}
                      {params.loadProfile === 'stress' ? 'Stress' : 'Normal'}
                    </span>
                  </div>

                  <PumpCircuitSvg topologyId={selectedTopology} />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {result.nodes.map((n) => (
                      <div
                        key={n.label}
                        className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5"
                      >
                        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                          {n.label}
                        </div>
                        <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                          {n.value}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{n.note}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Voltage Sag Sweep Chart */}
                <PumpVoltageSweepChart params={params} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
