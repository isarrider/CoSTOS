import { useState } from 'react';
import { FileDown } from 'lucide-react';
import {
  DEFAULT_POWER_PARAMS,
  POWER_TOPOLOGY_SPECS,
  PowerSimParams,
  PowerTopologyId,
  evaluatePowerEntry,
} from './physics/model';
import { PowerControlConsole } from './components/ControlConsole';
import { PowerComparisonBoard } from './components/ComparisonBoard';
import { PowerCircuitDiagramSvg } from './components/CircuitDiagramSvg';
import { PowerSweepChart } from './components/SweepChart';
import { PowerConclusionScorecard } from './components/ConclusionScorecard';
import { PowerKicadBomPinout } from './components/KicadBomPinout';
import { PowerAuditHistory } from './components/AuditHistory';
import { exportPowerEntryPdfReport } from './utils/exportPdfReport';

export function PowerEntryWorkspace() {
  const [selected, setSelected] = useState<PowerTopologyId>('gemini_rev_b_efuse');
  const [params, setParams] = useState<PowerSimParams>(DEFAULT_POWER_PARAMS);
  const [batchSize, setBatchSize] = useState<2 | 5>(5);

  const activeSpec = POWER_TOPOLOGY_SPECS[selected];
  const activeRes = evaluatePowerEntry(selected, params);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-900 text-white rounded">
              Block 1 &amp; 3 · D18 → Rev B
            </span>
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
              100% JLCPCB Basic · €0.00 Fee · 0.34 €/bd
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1.5">
            06. Pi Power Entry, Foldback eFuse &amp; Full-HAT Rail Budget
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Evaluates Pi 4/5 header pins 2/4 (+5V) &amp; pins 1/17 (+3V3), active foldback short protection, +3V3_ANA analog filtering, Pi-OFF +24V back-feed clamping, and the master 40-pin GPIO map
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportPowerEntryPdfReport(selected, params, batchSize)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <FileDown className="w-4 h-4" />
          Export 9-Page PDF Report
        </button>
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

      {/* 3-Way Scorecard */}
      <PowerConclusionScorecard />

      {/* Block 1 KiCad BOM + Block 3 Master 40-Pin Header */}
      <PowerKicadBomPinout />

      {/* PWR-01..06 Audit History */}
      <PowerAuditHistory />
    </div>
  );
}
