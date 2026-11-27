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
import { WatchdogConclusionScorecard } from './components/ConclusionScorecard';
import { WatchdogKicadBomPinout } from './components/KicadBomPinout';
import { WatchdogAuditHistory } from './components/AuditHistory';
import { exportWatchdogPdfReport } from './utils/exportPdfReport';

type WatchdogSubTab = 'bench' | 'comparison' | 'scorecard' | 'kicad' | 'audit';

export function WatchdogWorkspace() {
  const [activeSubTab, setActiveSubTab] = useState<WatchdogSubTab>('bench');
  const [selectedTopology, setSelectedTopology] =
    useState<WatchdogTopologyId>('u3b_schmitt_wd');
  const [params, setParams] = useState<WatchdogSimParams>(DEFAULT_WATCHDOG_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);

  const result = useMemo(
    () => evaluateWatchdog(selectedTopology, params),
    [selectedTopology, params]
  );

  const activeSpec = WATCHDOG_TOPOLOGY_SPECS[selectedTopology];
  const baselineCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], batchSize);
  const activeCost = watchdogPerBoardCostEur(activeSpec, batchSize);
  const costDelta = baselineCost - activeCost;

  const handleInspectInSimulator = (id: WatchdogTopologyId) => {
    setSelectedTopology(id);
    setActiveSubTab('bench');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSelectedTopology('u3b_schmitt_wd');
    setParams(DEFAULT_WATCHDOG_PARAMS);
    setBatchSize(5);
  };

  const handleExportPdf = () => {
    exportWatchdogPdfReport(selectedTopology, params, batchSize);
  };

  const verdictKind =
    result.safetyStatus === 'Nominal' || result.safetyStatus === 'FailSafeOff'
      ? 'PASS'
      : result.safetyStatus === 'Borderline'
      ? 'MARGINAL'
      : 'FAIL';

  return (
    <div id="wd-top" className="space-y-5">
      {/* Executive Dark Header Strip (Tab 05 Design System) */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 04 · HARDWARE WATCHDOG &amp; RELAY SUPPLY</span>
            <span>·</span>
            <span>GPIO 24 / 20 · DEDICATED U4 LM393DR2G (C7955)</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Dedicated U4 Dual-Schmitt Window Watchdog &amp; Snap-Action Relay Supply (Rev B)
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Compares 74LVC1G123 + TPS22918, Claude&apos;s D24 passive charge-pump, NE555, TPS3823-33, and the locked
            Rev B dual-channel U4 LM393 window watchdog — independent Relay (U4A → Q12 populated per D25, 16.11 s
            cutoff) and Pump/GPIO20 (U4B, 18.42 s cutoff) verified in unscaled 34 s TI LM393 SPICE (1 kHz runaway
            rejected at 0.745 V).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
          >
            Reset Bench
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            Export 9-Page PDF Report
          </button>
        </div>
      </div>

      {/* Sub-navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'bench', label: 'Bench Simulator & Schematics' },
              { id: 'comparison', label: 'All 5 Architectures & Dossiers' },
              { id: 'scorecard', label: '3-Way Scorecard' },
              { id: 'kicad', label: 'KiCad BOM & U4 Pinout' },
              { id: 'audit', label: 'Audit History (WAUD-01..07)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600">
          Active: <strong className="text-slate-900">{activeSpec.shortName}</strong> · €{activeCost.toFixed(2)}/bd ({batchSize}×)
        </div>
      </div>

      {activeSubTab === 'bench' && (
        <div id="wd-simulator" className="space-y-5">
          {/* 5-Tile Live Telemetry KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Relay &amp; Pump Gate</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  result.safetyStatus === 'UnsafeFail'
                    ? 'text-rose-700'
                    : result.relayEnergized
                    ? 'text-emerald-700'
                    : 'text-blue-700'
                }`}
              >
                {result.relayEnergized ? 'ON' : 'OFF'}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Q12: −{result.vGateRelayV.toFixed(2)} V · Q5: +{result.vGatePumpV.toFixed(2)} V
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Cutoff Timeout</div>
              <div className="text-lg font-mono tabular-nums font-bold mt-0.5 text-slate-900">
                {result.cutoffTimeoutS.toFixed(2)} s
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Edge: {result.edgeSpeedLabel}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">GPIO 20 Readback</div>
              <div className="text-lg font-mono tabular-nums font-bold mt-0.5 text-slate-900">
                {result.gpio20ReadbackLow ? 'LOW (ON)' : 'HIGH (OFF)'}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Mismatch Δ: {result.readbackMismatchS.toFixed(2)} s
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">
                Cost / Board ({batchSize}×)
              </div>
              <div className="text-lg font-mono tabular-nums font-bold mt-0.5 text-slate-900">
                €{activeCost.toFixed(2)}
              </div>
              <div
                className={`text-[11px] font-mono tabular-nums ${
                  costDelta > 0.01 ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                }`}
              >
                {costDelta > 0.01 ? `Saves €${costDelta.toFixed(2)} vs orig` : 'Original baseline'}
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 ${
                verdictKind === 'PASS'
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : verdictKind === 'MARGINAL'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-rose-50/70 border-rose-300'
              }`}
            >
              <div className="text-[11px] text-slate-600 font-medium">Corner Verdict</div>
              <div
                className={`text-lg font-mono font-bold mt-0.5 ${
                  verdictKind === 'PASS'
                    ? 'text-emerald-800'
                    : verdictKind === 'MARGINAL'
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {verdictKind}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-600">
                HB: {result.effectiveFreqHz} Hz · Stall: {params.linuxStallS.toFixed(1)} s
              </div>
            </div>
          </div>

          {/* Live Fault / Status Banner */}
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
              verdictKind === 'PASS'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : verdictKind === 'MARGINAL'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <strong className="font-mono uppercase mr-2">[{result.statusHeadline}]</strong>
            {result.statusDetail}
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <WatchdogControlConsole
              selectedTopology={selectedTopology}
              onSelectTopology={setSelectedTopology}
              params={params}
              onChangeParams={setParams}
              batchSize={batchSize}
              onChangeBatchSize={setBatchSize}
            />

            <div className="flex-1 min-w-0 w-full space-y-5">
              {/* Live Schematic & Node Readouts */}
              <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{activeSpec.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{activeSpec.badgeText}</p>
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

      {activeSubTab === 'comparison' && (
        <WatchdogComparisonBoard
          selectedTopology={selectedTopology}
          params={params}
          batchSize={batchSize}
          onChangeBatchSize={setBatchSize}
          onInspectInSimulator={handleInspectInSimulator}
          onExportPdf={handleExportPdf}
        />
      )}

      {activeSubTab === 'scorecard' && <WatchdogConclusionScorecard batchSize={batchSize} />}
      {activeSubTab === 'kicad' && <WatchdogKicadBomPinout />}
      {activeSubTab === 'audit' && <WatchdogAuditHistory />}
    </div>
  );
}
