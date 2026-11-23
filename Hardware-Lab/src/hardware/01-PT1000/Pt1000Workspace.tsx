import { useMemo, useState } from 'react';
import { Header, WorkspaceView } from './components/Header';
import { FullComparisonBoard } from './components/ComparisonBoard';
import { ControlConsole } from './components/ControlConsole';
import { CircuitSchematic } from './components/CircuitSchematic';
import { ErrorSweepChart } from './components/SweepChart';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import {
  DEFAULT_PARAMS,
  SimulationParams,
  TOPOLOGY_SPECS,
  TopologyId,
  evaluateTopology,
  perBoardCostEur,
} from './physics/model';
import { exportCostosPdfReport } from './utils/exportPdfReport';

export function Pt1000Workspace() {
  const [activeView, setActiveView] = useState<WorkspaceView>('comparison');
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('switched_rc');
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(2);

  const result = useMemo(
    () => evaluateTopology(selectedTopology, params),
    [selectedTopology, params]
  );

  const baselineSpec = TOPOLOGY_SPECS.max31865;
  const activeSpec = TOPOLOGY_SPECS[selectedTopology];
  const activeUnitCost = perBoardCostEur(activeSpec, batchSize);
  const baselineUnitCost = perBoardCostEur(baselineSpec, batchSize);
  const costDelta = baselineUnitCost - activeUnitCost;

  const handleSelectView = (view: WorkspaceView, anchor?: string) => {
    setActiveView(view);
    if (anchor) {
      window.requestAnimationFrame(() => {
        if (anchor === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  };

  const handleInspectInSimulator = (id: TopologyId) => {
    setSelectedTopology(id);
    setActiveView('simulator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('switched_rc');
    setParams(DEFAULT_PARAMS);
    setBatchSize(2);
  };

  const handleExportPdf = () => {
    exportCostosPdfReport(selectedTopology, params, batchSize);
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        onReset={handleReset}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Workspace Headline & Mode Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              Replacing the MAX31865 on the CoSTOS 1-Wire HAT
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Compare zero-fee JLCPCB basic-part circuits and low-cost ADCs against the MAX31865AAP+ baseline across −50 °C to +250 °C collector conditions, 2-wire cable resistance, and fault injection.
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
          <FullComparisonBoard
            selectedTopology={selectedTopology}
            params={params}
            batchSize={batchSize}
            onChangeBatchSize={setBatchSize}
            onInspectInSimulator={handleInspectInSimulator}
            onExportPdf={handleExportPdf}
          />
        ) : (
          <div id="simulator" className="space-y-6">
            {/* Asymmetric Split Console: Left Controls + Main Stage */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <ControlConsole
                selectedTopology={selectedTopology}
                onSelectTopology={setSelectedTopology}
                params={params}
                onChangeParams={setParams}
                batchSize={batchSize}
                onChangeBatchSize={setBatchSize}
              />

              <div className="flex-1 min-w-0 w-full space-y-6">
                {/* 4-Column KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* KPI 1: Measured Temperature */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Measured Collector Temp</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        {result.measuredTempC === null ? 'FAULT' : result.measuredTempC.toFixed(2)}
                      </span>
                      {result.measuredTempC !== null && (
                        <span className="text-xs font-mono text-slate-400 uppercase">°C</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      {result.errorK === null
                        ? `True: ${result.trueTempC.toFixed(1)} °C`
                        : `ΔT Error: ${result.errorK >= 0 ? '+' : ''}${result.errorK.toFixed(2)} K`}
                    </div>
                  </div>

                  {/* KPI 2: Worst-Case Bound */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Worst-Case Error Bound</div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-mono tabular-nums font-semibold ${
                          result.worstCaseBoundK <= 1.0
                            ? 'text-emerald-700'
                            : result.worstCaseBoundK <= 1.8
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {params.activeFault !== 'none' ? '—' : `±${result.worstCaseBoundK.toFixed(2)}`}
                      </span>
                      {params.activeFault === 'none' && (
                        <span className="text-xs font-mono text-slate-400 uppercase">K</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-600">
                      Self-heat: +{result.selfHeatingK.toFixed(3)} K ({result.selfHeatingMw.toFixed(2)} mW)
                    </div>
                  </div>

                  {/* KPI 3: Effective Board Cost */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Pt1000 Cost / Board ({batchSize}×)
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                        €{activeUnitCost.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400 uppercase">EUR</span>
                    </div>
                    <div
                      className={`mt-1 text-xs font-mono tabular-nums ${
                        costDelta > 0 ? 'text-emerald-700 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {costDelta > 0
                        ? `Saves €${costDelta.toFixed(2)} vs MAX31865`
                        : 'Reference baseline'}
                    </div>
                  </div>

                  {/* KPI 4: Safety & Fault Verdict */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-slate-500">Safety &amp; Fault Verdict</div>
                    <div className="mt-1.5">
                      <span
                        className={`text-base font-semibold ${
                          result.safetyStatus === 'Nominal'
                            ? 'text-emerald-700'
                            : result.safetyStatus === 'FaultCaught'
                            ? 'text-blue-700'
                            : result.safetyStatus === 'Drifting'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {result.safetyStatus === 'Nominal' && '● Nominal'}
                        {result.safetyStatus === 'FaultCaught' && `● Caught: ${result.detectedFault}`}
                        {result.safetyStatus === 'Drifting' && '▲ Tolerance Drift'}
                        {result.safetyStatus === 'Unsafe' && '✖ Unsafe State'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {result.safetyDetail}
                    </div>
                  </div>
                </div>

                {/* Interactive Circuit Schematic */}
                <CircuitSchematic
                  topologyId={selectedTopology}
                  params={params}
                  result={result}
                />

                {/* Full-Range Error Sweep Chart */}
                <ErrorSweepChart topologyId={selectedTopology} params={params} />
              </div>
            </div>

            {/* Full-Width Comparison Matrix & BOM Breakdown */}
            <ComparisonMatrix
              selectedTopology={selectedTopology}
              onSelectTopology={setSelectedTopology}
              params={params}
              batchSize={batchSize}
            />
          </div>
        )}
      </main>
    </div>
  );
}
