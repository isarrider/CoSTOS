import { useState } from 'react';
import {
  DEFAULT_OUTPUT_PARAMS,
  OUTPUT_TOPOLOGY_SPECS,
  OutputSimParams,
  OutputTopologyId,
  evaluateOutputStage,
  outputPerBoardCostEur,
} from './physics/model';
import { OutputStageCircuitSvg } from './components/CircuitDiagramSvg';
import { OutputFreqSweepChart } from './components/SweepChart';
import { OutputControlConsole } from './components/ControlConsole';
import { OutputComparisonBoard } from './components/ComparisonBoard';
import { OutputConclusionScorecard } from './components/ConclusionScorecard';
import { OutputKicadBomPinout } from './components/KicadBomPinout';
import { OutputAuditHistory } from './components/AuditHistory';
import { exportOutputStagePdfReport } from './utils/exportPdfReport';

type SubTab = 'bench' | 'scorecard' | 'kicad' | 'audit';

export function OutputStageWorkspace() {
  const [selectedId, setSelectedId] = useState<OutputTopologyId>('gemini_rev_b_pushpull');
  const [params, setParams] = useState<OutputSimParams>(DEFAULT_OUTPUT_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bench');

  const spec = OUTPUT_TOPOLOGY_SPECS[selectedId];
  const result = evaluateOutputStage(selectedId, params);
  const unitCost = outputPerBoardCostEur(spec, batchSize);

  return (
    <div className="space-y-5">
      {/* Header Strip */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 05 · PUMP PWM OUTPUT &amp; RELAY DRIVER STAGE</span>
            <span>·</span>
            <span>GPIO 18 / 23 / 6 / 25 / 5 · J2 &amp; J4</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Pump PWM Output (H3 → Rev B Push-Pull), Readback/Feedback &amp; Active-Protected Relay Driver
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            100% JLCPCB Basic (€0.00 Extended fees!) eliminating Rev A H3&apos;s exposed Q7 blowout, 60 °C Q6 leakage, Pi 5
            GPIO6 overvoltage, and unprotected J4 relay shorts. Matches D25 with all REL1 SMD parts factory-populated
            (R501A∥R501B = 5.0 Ω Basic, 123.2 mA limit; only J4 THT optional) under D18 direct +5V_HAT (+V_DRV = 9.193 V).
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportOutputStagePdfReport(selectedId, params, batchSize)}
          className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition shrink-0"
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
              { id: 'scorecard', label: '3-Way Scorecard' },
              { id: 'kicad', label: 'KiCad BOM & Pinout (Rev B)' },
              { id: 'audit', label: 'Audit History (OUT-01..06)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
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
          Active: <strong className="text-slate-900">{spec.shortName}</strong> · €{unitCost.toFixed(2)}/bd ({batchSize}×)
        </div>
      </div>

      {activeSubTab === 'bench' && (
        <div className="space-y-5">
          {/* Live Telemetry KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">J2 Pump PWM High</div>
              <div className={`text-lg font-mono font-bold mt-0.5 ${result.vHighAtPumpV >= 4.0 || params.activeFault === 'wd_tripped' ? 'text-slate-900' : 'text-rose-700'}`}>
                {result.vHighAtPumpV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">Min V_IH: 4.00 V</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Worst Edge (t_r / t_f)</div>
              <div className={`text-lg font-mono font-bold mt-0.5 ${result.edgeRulePass ? 'text-emerald-700' : 'text-rose-700'}`}>
                {Math.max(result.tRiseUs, result.tFallUs).toFixed(2)} µs
              </div>
              <div className="text-[11px] font-mono text-slate-500">Limit T/500: {result.edgeLimitUs.toFixed(2)} µs</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Pi 5 Readback (GPIO 6)</div>
              <div className={`text-lg font-mono font-bold mt-0.5 ${result.readbackSafe ? 'text-slate-900' : 'text-rose-700'}`}>
                {result.readbackPiV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {spec.hasReadbackClamp ? 'Clamped <= 3.6 V' : 'UNCLAMPED!'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">J4 REL1 Short Limit</div>
              <div className={`text-lg font-mono font-bold mt-0.5 ${result.relayShortCurrentMa < 300 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {result.relayShortCurrentMa >= 1000 ? '>15 A!' : `${result.relayShortCurrentMa} mA`}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Load V_out: {result.relayVoutV.toFixed(2)} V
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
                Shoot-thru: {result.shootThroughMa} mA
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
            {result.faultPartStressNote}
          </div>

          <OutputControlConsole
            params={params}
            batchSize={batchSize}
            onChange={setParams}
            onBatchChange={setBatchSize}
          />

          <OutputComparisonBoard
            selectedId={selectedId}
            params={params}
            batchSize={batchSize}
            onSelect={setSelectedId}
          />

          <OutputStageCircuitSvg topologyId={selectedId} result={result} />

          <OutputFreqSweepChart params={params} />
        </div>
      )}

      {activeSubTab === 'scorecard' && <OutputConclusionScorecard />}
      {activeSubTab === 'kicad' && <OutputKicadBomPinout />}
      {activeSubTab === 'audit' && <OutputAuditHistory />}
    </div>
  );
}
