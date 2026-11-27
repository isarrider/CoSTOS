import { useMemo, useState } from 'react';
import {
  DEFAULT_ONEWIRE_PARAMS,
  ONEWIRE_TOPOLOGY_SPECS,
  OneWireSimParams,
  OneWireTopologyId,
  evaluateOneWireBus,
  oneWirePerBoardCostEur,
} from './physics/model';
import { OneWireComparisonBoard } from './components/ComparisonBoard';
import { OneWireControlConsole } from './components/ControlConsole';
import { OneWireCircuitSvg } from './components/CircuitDiagramSvg';
import { OneWireSweepChart } from './components/SweepChart';
import { OneWireConclusionScorecard } from './components/ConclusionScorecard';
import { OneWireKicadBomPinout } from './components/KicadBomPinout';
import { OneWireAuditHistory } from './components/AuditHistory';
import { exportOneWirePdfReport } from './utils/exportPdfReport';

type SubTab = 'bench' | 'architectures' | 'scorecard' | 'kicad' | 'audit';

export function OneWireWorkspace() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bench');
  const [selectedTopology, setSelectedTopology] =
    useState<OneWireTopologyId>('gemini_rev_b_2n7002');
  const [params, setParams] = useState<OneWireSimParams>(DEFAULT_ONEWIRE_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);

  const result = useMemo(
    () => evaluateOneWireBus(selectedTopology, params),
    [selectedTopology, params]
  );

  const activeSpec = ONEWIRE_TOPOLOGY_SPECS[selectedTopology];
  const revACost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.rev_a_baseline, batchSize);
  const activeCost = oneWirePerBoardCostEur(activeSpec, batchSize);

  const handleInspectInSimulator = (id: OneWireTopologyId) => {
    setSelectedTopology(id);
    setActiveSubTab('bench');
  };

  const handleExportPdf = () => {
    exportOneWirePdfReport(selectedTopology, params, batchSize);
  };

  return (
    <div className="space-y-5">
      {/* Header Strip */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 02 · DUAL 1-WIRE BUSES &amp; FAULT PROTECTION</span>
            <span>·</span>
            <span>GPIO 4 &amp; 17 · J6 PINS 3–8 · 2N7002 + SS14 + BASIC TL431</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Dual 5 V 1-Wire Buses — Diode-Biased 2N7002, Per-Bus SS14/100 Ω &amp; Basic TL431 Clamps
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Locked Rev B (100% JLCPCB Basic — €0.00 Extended fee! +€0.23/bd vs 3.3 V) under D18 direct +5V_HAT =
            5.045 V: 1W_A/B_5V_PROT = 4.917 V, 40–65 m shielded reach (4.461 V @ 40 m / 3.773 V @ 65 m, Pi 3.297 V),
            48.0 mA VDD short cap, DQ +12 V clamped to 5.390 V via Basic TL431 (below DS18B20 5.5 V max! GPIO 4 = 3.300 V).
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPdf}
          className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition shrink-0 cursor-pointer"
        >
          Export 9-Page PDF Report
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'bench', label: 'Bench Simulator & Schematics' },
              { id: 'architectures', label: 'All 5 Architectures & Dossiers' },
              { id: 'scorecard', label: '3-Way Scorecard' },
              { id: 'kicad', label: 'KiCad BOM & Pinout' },
              { id: 'audit', label: 'Audit History (1W-01..07)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                activeSubTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-slate-600">
          Active: <strong className="text-slate-900">{activeSpec.shortName}</strong> · €{activeCost.toFixed(2)}/bd ({batchSize}×)
        </div>
      </div>

      {activeSubTab === 'bench' && (
        <div className="space-y-5">
          {/* 5-Tile Live Telemetry KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">V_Pi @ 15 µs Sample</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  result.piVihMarginV >= 0.3
                    ? 'text-emerald-700'
                    : result.piVihMarginV >= 0
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {result.vPiAtSampleV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Margin {result.piVihMarginV >= 0 ? '+' : ''}
                {result.piVihMarginV.toFixed(2)} V
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Sensor VDD / V_OL</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  result.sensorVddOk && result.vOlOk ? 'text-slate-900' : 'text-rose-700'
                }`}
              >
                {result.sensorVddV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                V_OL = {result.vOlAtPiV.toFixed(2)} V (≤0.80 V)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Max Cable Reach</div>
              <div className="text-lg font-mono tabular-nums font-bold mt-0.5 text-slate-900">
                {result.maxReachM.toFixed(0)} m
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                τ = {result.tauUs.toFixed(1)} µs ({result.busCapNf.toFixed(2)} nF)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Pi GPIO Peak / Cost</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  result.piGpioPeakV <= 3.63 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {result.piGpioPeakV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                €{activeCost.toFixed(2)}/bd (vs €{revACost.toFixed(2)})
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 ${
                result.faultVerdict === 'PASS'
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : result.faultVerdict === 'MARGINAL'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-rose-50/70 border-rose-300'
              }`}
            >
              <div className="text-[11px] text-slate-600 font-medium">Corner Verdict</div>
              <div
                className={`text-lg font-mono font-bold mt-0.5 ${
                  result.faultVerdict === 'PASS'
                    ? 'text-emerald-800'
                    : result.faultVerdict === 'MARGINAL'
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {result.faultVerdict}
              </div>
              <div className="text-[11px] font-mono text-slate-600">
                Bus B Alive: {result.busBAliveDuringFault ? 'YES' : 'NO'}
              </div>
            </div>
          </div>

          {/* Live Fault Explanation Banner */}
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
              result.faultVerdict === 'PASS'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : result.faultVerdict === 'MARGINAL'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <strong className="font-mono uppercase mr-2">[{result.faultVerdict}]</strong>
            {result.faultSummary}
            {result.vGateBiasV !== null && result.vGsOverdriveV !== null && (
              <span className="ml-2 font-mono text-[11px] opacity-90">
                (V_G = {result.vGateBiasV.toFixed(2)} V · V_GS Overdrive ={' '}
                {result.vGsOverdriveV >= 0 ? '+' : ''}
                {result.vGsOverdriveV.toFixed(2)} V)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4">
              <OneWireControlConsole
                selectedTopology={selectedTopology}
                onSelectTopology={setSelectedTopology}
                params={params}
                onChangeParams={setParams}
              />
            </div>

            <div className="lg:col-span-8 space-y-5">
              <OneWireCircuitSvg topologyId={selectedTopology} result={result} />
              <OneWireSweepChart params={params} />
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'architectures' && (
        <OneWireComparisonBoard
          params={params}
          batchSize={batchSize}
          onChangeBatchSize={setBatchSize}
          onInspectInSimulator={handleInspectInSimulator}
        />
      )}

      {activeSubTab === 'scorecard' && <OneWireConclusionScorecard batchSize={batchSize} />}
      {activeSubTab === 'kicad' && <OneWireKicadBomPinout />}
      {activeSubTab === 'audit' && <OneWireAuditHistory />}
    </div>
  );
}
