import { useMemo, useState } from 'react';
import {
  DEFAULT_WATCHDOG_PARAMS,
  WATCHDOG_TOPOLOGY_SPECS,
  WatchdogSimParams,
  WatchdogTopologyId,
  evaluateWatchdog,
  watchdogPerBoardCostEur,
} from './physics/model';
import { WatchdogComparisonBoard } from './components/ComparisonBoard';
import { WatchdogControlConsole } from './components/ControlConsole';
import { WatchdogCircuitSvg } from './components/CircuitDiagramSvg';
import { WatchdogSweepChart } from './components/SweepChart';
import { exportWatchdogPdfReport } from './utils/exportPdfReport';

type WatchdogViewMode = 'comparison' | 'simulator';

export function WatchdogWorkspace() {
  const [activeView, setActiveView] = useState<WatchdogViewMode>('comparison');
  const [selectedTopology, setSelectedTopology] =
    useState<WatchdogTopologyId>('u3b_schmitt_wd');
  const [params, setParams] = useState<WatchdogSimParams>(DEFAULT_WATCHDOG_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(2);

  const result = useMemo(
    () => evaluateWatchdog(selectedTopology, params),
    [selectedTopology, params]
  );

  const activeSpec = WATCHDOG_TOPOLOGY_SPECS[selectedTopology];
  const baselineCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], batchSize);
  const activeCost = watchdogPerBoardCostEur(activeSpec, batchSize);
  const costDelta = baselineCost - activeCost;

  const handleSelectView = (view: WatchdogViewMode, anchor?: string) => {
    setActiveView(view);
    if (anchor) {
      window.requestAnimationFrame(() => {
        if (anchor === 'wd-top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  };

  const handleInspectInSimulator = (id: WatchdogTopologyId) => {
    setSelectedTopology(id);
    setActiveView('simulator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('u3b_schmitt_wd');
    setParams(DEFAULT_WATCHDOG_PARAMS);
    setBatchSize(2);
  };

  const handleExportPdf = () => {
    exportWatchdogPdfReport(selectedTopology, params, batchSize);
  };

  return (
    <div id="wd-top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Subsystem Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <a
            href="#wd-top"
            onClick={(e) => {
              e.preventDefault();
              handleSelectView('comparison', 'wd-top');
            }}
            className="text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            04. Hardware Watchdog &amp; Relay Switch Lab
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#wd-comparison-table"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'wd-comparison-table');
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
              href="#wd-pros-cons"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'wd-pros-cons');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Pros &amp; Cons
            </a>
            <a
              href="#wd-simulator"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('simulator', 'wd-simulator');
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
              href="#wd-conclusion"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'wd-conclusion');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              Conclusion
            </a>
            <a
              href="#wd-kicad-bom"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'wd-kicad-bom');
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-slate-300"
            >
              KiCad BOM
            </a>
            <a
              href="#wd-audit-history"
              onClick={(e) => {
                e.preventDefault();
                handleSelectView('comparison', 'wd-audit-history');
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
              Dedicated U4 Dual-Schmitt Window Watchdog (Rev B · Gemini Version)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Evaluates the original 74LVC1G123 + TPS22918 baseline, Claude’s D24 passive capacitor charge-pump from GitHub (HAT-development.md §8.2), NE555, TPS3823-33, and the Gemini Version (Rev B) dual-channel window watchdog using a dedicated U4 (LM393DR) for independent Relay (U4A, +5V) and Pump/GPIO20 (U4B, +3.3V) snap-action cutoffs with 15.4–17.7 s timeout.
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
          <WatchdogComparisonBoard
            selectedTopology={selectedTopology}
            params={params}
            batchSize={batchSize}
            onChangeBatchSize={setBatchSize}
            onInspectInSimulator={handleInspectInSimulator}
            onExportPdf={handleExportPdf}
          />
        ) : (
          <div id="wd-simulator" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <WatchdogControlConsole
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
                    <div className="text-xs font-medium text-slate-500">Relay &amp; Pump Output Gate</div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-mono tabular-nums font-semibold ${
                          result.safetyStatus === 'UnsafeFail'
                            ? 'text-rose-700'
                            : result.relayEnergized
                            ? 'text-emerald-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {result.relayEnergized ? 'ON' : 'OFF'}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {result.edgeSpeedLabel}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      Q12: −{result.vGateRelayV.toFixed(2)} V · Q5: +{result.vGatePumpV.toFixed(2)} V
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Timeout &amp; Readback Match</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        {result.cutoffTimeoutS.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">s</span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      GPIO 20: {result.gpio20ReadbackLow ? 'LOW (ON)' : 'HIGH (OFF)'} · Δ{' '}
                      {result.readbackMismatchS.toFixed(1)} s
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Cost / Board ({batchSize}× batch)
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        €{activeCost.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">EUR</span>
                    </div>
                    <div
                      className={`mt-1 text-xs font-mono tabular-nums ${
                        costDelta > 0.01 ? 'text-emerald-700 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {costDelta > 0.01
                        ? `Saves €${costDelta.toFixed(2)} vs 74LVC1G123`
                        : 'Original baseline'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Safety Verification</div>
                    <div className="mt-1.5">
                      <span
                        className={`text-sm font-semibold ${
                          result.safetyStatus === 'Nominal'
                            ? 'text-emerald-700'
                            : result.safetyStatus === 'FailSafeOff'
                            ? 'text-blue-700'
                            : result.safetyStatus === 'Borderline'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {result.safetyStatus === 'Nominal' && `● ${result.statusHeadline}`}
                        {result.safetyStatus === 'FailSafeOff' && `● ${result.statusHeadline}`}
                        {result.safetyStatus === 'Borderline' && `▲ ${result.statusHeadline}`}
                        {result.safetyStatus === 'UnsafeFail' && `✖ ${result.statusHeadline}`}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      HB: {result.effectiveFreqHz} Hz · Stall: {params.linuxStallS.toFixed(1)} s
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
                      {params.ambientTempC} °C · {params.fluxLeakage === 'humid_boiler' ? '3 MΩ Humid' : 'Clean PCB'} · V_th {params.mosfetCorner.toUpperCase()}
                    </span>
                  </div>

                  <WatchdogCircuitSvg topologyId={selectedTopology} />

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

                {/* Bandpass Window & Stall Decay Chart */}
                <WatchdogSweepChart params={params} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
