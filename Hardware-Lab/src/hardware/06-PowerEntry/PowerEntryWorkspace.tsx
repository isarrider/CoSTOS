import { useState } from 'react';
import {
  DEFAULT_POWER_PARAMS,
  POWER_TOPOLOGY_SPECS,
  PowerSimParams,
  PowerTopologyId,
  evaluatePowerEntry,
  powerPerBoardCostEur,
} from './physics/model';
import { PowerControlConsole } from './components/ControlConsole';
import { PowerComparisonBoard } from './components/ComparisonBoard';
import { PowerCircuitDiagramSvg } from './components/CircuitDiagramSvg';
import { PowerSweepChart } from './components/SweepChart';
import { PowerConclusionScorecard } from './components/ConclusionScorecard';
import { PowerKicadBomPinout } from './components/KicadBomPinout';
import { PowerAuditHistory } from './components/AuditHistory';
import { exportPowerEntryPdfReport } from './utils/exportPdfReport';

type SubTab = 'bench' | 'scorecard' | 'kicad' | 'audit';

export function PowerEntryWorkspace() {
  const [selected, setSelected] = useState<PowerTopologyId>('gemini_rev_b_efuse');
  const [params, setParams] = useState<PowerSimParams>(DEFAULT_POWER_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bench');

  const activeSpec = POWER_TOPOLOGY_SPECS[selected];
  const activeRes = evaluatePowerEntry(selected, params);
  const unitCost = powerPerBoardCostEur(activeSpec, batchSize);

  return (
    <div className="space-y-5">
      {/* Header Strip */}
      <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span>SUBSYSTEM 06 · PI POWER ENTRY (D18), +3V3_ANA FILTER &amp; RAIL BUDGET</span>
            <span>·</span>
            <span>J1 40-PIN · C2A/C2B · R602/C604 · D9</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            Pi Power Entry (D18 Direct +5V), +3V3_ANA Pi-Filter &amp; Full-HAT Rail Budget
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Locked to CoSTOS D18 (100% JLCPCB Basic, €0.00 fee, €0.23/bd): direct Pi pins 2/4 deliver +5V_HAT = 5.045 V
            (eFuse dropped, saving C15545 €2.80 &amp; 0.27 V drop), backed by a 44 µF solid MLCC bank, −36.04 dB +3V3_ANA
            filter, Basic D9 TL431 3.67 V Pi-OFF clamp (≤3.68 V), and local short limiters on every field terminal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportPowerEntryPdfReport(selected, params, batchSize)}
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
              { id: 'scorecard', label: '3-Way Scorecard' },
              { id: 'kicad', label: 'KiCad BOM & 40-Pin Map' },
              { id: 'audit', label: 'Audit History (PWR-01..06)' },
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
          Active: <strong className="text-slate-900">{activeSpec.shortName}</strong> · €{unitCost.toFixed(2)}/bd ({batchSize}×)
        </div>
      </div>

      {activeSubTab === 'bench' && (
        <div className="space-y-5">
          {/* Live Telemetry KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">+5V_HAT Rail</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  activeRes.v5HatV >= 4.7 ? 'text-slate-900' : activeRes.v5HatV >= 4.4 ? 'text-amber-700' : 'text-rose-700'
                }`}
              >
                {activeRes.v5HatV.toFixed(3)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Drop: {(activeRes.v5DropV * 1000).toFixed(0)} mV
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">+3V3_ANA Ripple</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  activeRes.v3v3AnaRippleMv <= 5 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {activeRes.v3v3AnaRippleMv.toFixed(1)} mVpp
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {activeSpec.has3v3AnaFilter ? `−${activeSpec.filterRejectionDb.toFixed(2)} dB @ 100k` : 'Unfiltered!'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Total HAT Load</div>
              <div className="text-lg font-mono tabular-nums font-bold mt-0.5 text-slate-900">
                {activeRes.total5vMa.toFixed(0)} mA
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                +3V3: {activeRes.total3v3Ma.toFixed(1)} mA · {(activeRes.totalHatPowerMw / 1000).toFixed(2)} W
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] text-slate-500 font-medium">Pi-OFF +3V3 Clamp</div>
              <div
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                  activeRes.piOff3v3PeakV <= 3.7 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {activeRes.piOff3v3PeakV.toFixed(2)} V
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {activeSpec.has3v3BackfeedZener ? 'D9 TL431 3.67V Basic' : 'UNCLAMPED!'} · {activeRes.capLifetimeYearsAt60C.toFixed(0)} yr cap
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 ${
                activeRes.faultVerdict === 'PASS'
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : activeRes.faultVerdict === 'MARGINAL'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-rose-50/70 border-rose-300'
              }`}
            >
              <div className="text-[11px] text-slate-600 font-medium">Corner Verdict</div>
              <div
                className={`text-lg font-mono font-bold mt-0.5 ${
                  activeRes.faultVerdict === 'PASS'
                    ? 'text-emerald-800'
                    : activeRes.faultVerdict === 'MARGINAL'
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {activeRes.faultVerdict}
              </div>
              <div className="text-[11px] font-mono text-slate-600">
                Short: {activeRes.shortCurrentMa >= 1000 ? '>5 A!' : `${activeRes.shortCurrentMa} mA`}
              </div>
            </div>
          </div>

          {/* Live Fault Explanation Banner */}
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
              activeRes.faultVerdict === 'PASS'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : activeRes.faultVerdict === 'MARGINAL'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <strong className="font-mono uppercase mr-2">[{activeRes.faultVerdict}]</strong>
            {activeRes.faultNote}
          </div>

          {/* Controls & Fault Injection */}
          <PowerControlConsole
            params={params}
            onChange={setParams}
            batchSize={batchSize}
            onBatchSizeChange={setBatchSize}
          />

          {/* 5-Option Topology Cards */}
          <PowerComparisonBoard
            selected={selected}
            onSelect={setSelected}
            params={params}
            batchSize={batchSize}
          />

          {/* Interactive IEEE Schematic + Foldback / Budget Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <PowerCircuitDiagramSvg spec={activeSpec} params={params} result={activeRes} />
            <PowerSweepChart params={params} activeResult={activeRes} />
          </div>
        </div>
      )}

      {activeSubTab === 'scorecard' && <PowerConclusionScorecard />}
      {activeSubTab === 'kicad' && <PowerKicadBomPinout />}
      {activeSubTab === 'audit' && <PowerAuditHistory />}
    </div>
  );
}
