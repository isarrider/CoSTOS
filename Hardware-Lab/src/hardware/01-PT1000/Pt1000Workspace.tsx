import { useMemo, useState } from 'react';
import { FullComparisonBoard } from './components/ComparisonBoard';
import { ControlConsole } from './components/ControlConsole';
import { CircuitSchematic } from './components/CircuitSchematic';
import { ErrorSweepChart } from './components/SweepChart';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { ConclusionScorecard } from './components/ConclusionScorecard';
import { KicadBomPinout } from './components/KicadBomPinout';
import { HardwareAuditHistory } from './components/AuditHistory';
import {
  DEFAULT_PARAMS,
  SimulationParams,
  TOPOLOGY_SPECS,
  TopologyId,
  evaluateTopology,
  perBoardCostEur,
} from './physics/model';
import { exportCostosPdfReport } from './utils/exportPdfReport';

type Pt1000Tab = 'bench' | 'comparison' | 'scorecard' | 'kicad' | 'audit';

export function Pt1000Workspace() {
  const [activeTab, setActiveTab] = useState<Pt1000Tab>('bench');
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('switched_rc');
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);

  const result = useMemo(
    () => evaluateTopology(selectedTopology, params),
    [selectedTopology, params]
  );

  const baselineSpec = TOPOLOGY_SPECS.max31865;
  const activeSpec = TOPOLOGY_SPECS[selectedTopology];
  const activeUnitCost = perBoardCostEur(activeSpec, batchSize);
  const baselineUnitCost = perBoardCostEur(baselineSpec, batchSize);
  const costDelta = baselineUnitCost - activeUnitCost;

  const handleInspectInSimulator = (id: TopologyId) => {
    setSelectedTopology(id);
    setActiveTab('bench');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('switched_rc');
    setParams(DEFAULT_PARAMS);
    setBatchSize(5);
  };

  const handleExportPdf = () => {
    exportCostosPdfReport(selectedTopology, params, batchSize);
  };

  const statusTone =
    result.safetyStatus === 'Nominal'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : result.safetyStatus === 'FaultCaught'
      ? 'bg-blue-50 border-blue-200 text-blue-900'
      : result.safetyStatus === 'Drifting'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-rose-50 border-rose-200 text-rose-900';

  return (
    <div id="top" className="space-y-6">
      {/* Dark Executive Header Strip (Unified Tab 05 Layout) */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-emerald-400 mb-1">
            SUBSYSTEM 01 · PT1000 COLLECTOR FRONT-END · U1 LM393DR2G (C7955) · GPIO 22 / 27 / 12 / 13
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            Pt1000 Collector Front-End &amp; 72.2 Hz RC Ramp Slicer Bench
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            100% JLCPCB Basic SMD: 7× 1.00 kΩ ±1% (C17513: 4.00 kΩ / 1.00 kΩ / 2.00 kΩ) + 72.2 Hz TI LM393 RC ramp
            (0.476–1.533 V, C1710 10 nF X7R) + 100 nF 50 V ESD caps on both probe wires + exact ln() solver. 0 Extended
            SMD reels (€0.00 across entire HAT) · ±0.4–0.6 K after 5 s cal · simulated in ngspice-39.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            Reset Bench
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            Export 9-Page PDF Report
          </button>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['bench', 'Bench Simulator & Schematics'],
              ['comparison', 'All 5 Architectures & Dossiers'],
              ['scorecard', 'Head-to-Head Scorecard'],
              ['kicad', 'KiCad BOM & Pinout'],
              ['audit', 'Audit History (Rev A → D)'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-slate-500">
          Active: <strong className="text-slate-900">{activeSpec.shortName}</strong> · €
          {activeUnitCost.toFixed(2)}/bd ({batchSize}×)
        </div>
      </div>

      {/* TAB 1: BENCH SIMULATOR */}
      {activeTab === 'bench' && (
        <div id="simulator" className="space-y-5">
          {/* 5-Tile Live Telemetry KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Measured Collector Temp</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {result.measuredTempC === null ? 'FAULT' : `${result.measuredTempC.toFixed(2)} °C`}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                {result.errorK === null
                  ? `True: ${result.trueTempC.toFixed(1)} °C`
                  : `ΔT: ${result.errorK >= 0 ? '+' : ''}${result.errorK.toFixed(2)} K`}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Worst-Case Error Bound</div>
              <div
                className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${
                  result.worstCaseBoundK <= 1.15
                    ? 'text-emerald-700'
                    : result.worstCaseBoundK <= 1.8
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {params.activeFault !== 'none' ? '—' : `±${result.worstCaseBoundK.toFixed(2)} K`}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                {selectedTopology === 'switched_rc'
                  ? '±0.69 K RSS / ±1.14 K WC'
                  : `Res ±${activeSpec.resolutionK} K`}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Excitation &amp; Self-Heat</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {result.excitationCurrentMa.toFixed(2)} mA
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                +{result.selfHeatingK.toFixed(4)} K ({result.selfHeatingMw.toFixed(2)} mW)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">
                Pt1000 Cost / Board ({batchSize}×)
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                €{activeUnitCost.toFixed(2)}
              </div>
              <div
                className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                  costDelta > 0 ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                Parts €{activeSpec.partCostEur.toFixed(2)} · Ext €{activeSpec.jlcpcbFeederFeeEur.toFixed(2)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Corner Verdict</div>
              <div
                className={`text-lg font-bold font-mono mt-0.5 ${
                  result.safetyStatus === 'Nominal'
                    ? 'text-emerald-700'
                    : result.safetyStatus === 'FaultCaught'
                    ? 'text-blue-700'
                    : result.safetyStatus === 'Drifting'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {result.safetyStatus === 'Nominal' && 'NOMINAL'}
                {result.safetyStatus === 'FaultCaught' && `CAUGHT`}
                {result.safetyStatus === 'Drifting' && 'DRIFTING'}
                {result.safetyStatus === 'Unsafe' && 'UNSAFE'}
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                {params.activeFault !== 'none'
                  ? result.detectedFault
                  : selectedTopology === 'switched_rc'
                  ? 'TI LM393 0.476–1.533 V'
                  : activeSpec.interfacePins.split(' (')[0]}
              </div>
            </div>
          </div>

          {/* Live Status / Fault Banner */}
          <div className={`rounded-lg border px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${statusTone}`}>
            <div>
              <strong>
                {result.safetyStatus === 'Nominal' && 'NOMINAL: '}
                {result.safetyStatus === 'FaultCaught' && `FAULT CAUGHT (${result.detectedFault}): `}
                {result.safetyStatus === 'Drifting' && 'TOLERANCE DRIFT: '}
                {result.safetyStatus === 'Unsafe' && 'UNSAFE STATE: '}
              </strong>
              {result.safetyDetail}
            </div>
            <span className="font-mono text-[11px] shrink-0">
              {result.digitalReadoutLabel}: {result.digitalReadoutValue}
            </span>
          </div>

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
              <CircuitSchematic
                topologyId={selectedTopology}
                params={params}
                result={result}
              />

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

      {/* TAB 2: ALL 5 ARCHITECTURES & DOSSIERS */}
      {activeTab === 'comparison' && (
        <FullComparisonBoard
          selectedTopology={selectedTopology}
          params={params}
          batchSize={batchSize}
          onChangeBatchSize={setBatchSize}
          onInspectInSimulator={handleInspectInSimulator}
          onExportPdf={handleExportPdf}
        />
      )}

      {/* TAB 3: HEAD-TO-HEAD SCORECARD */}
      {activeTab === 'scorecard' && (
        <ConclusionScorecard params={params} batchSize={batchSize} />
      )}

      {/* TAB 4: KICAD BOM & PINOUT */}
      {activeTab === 'kicad' && <KicadBomPinout />}

      {/* TAB 5: AUDIT HISTORY */}
      {activeTab === 'audit' && <HardwareAuditHistory />}
    </div>
  );
}
