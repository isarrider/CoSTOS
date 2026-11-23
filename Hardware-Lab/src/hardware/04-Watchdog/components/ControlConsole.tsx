import React from 'react';
import {
  FluxLeakageMode,
  MosfetCorner,
  WATCHDOG_TOPOLOGY_ORDER,
  WATCHDOG_TOPOLOGY_SPECS,
  WatchdogFaultMode,
  WatchdogSimParams,
  WatchdogTopologyId,
  watchdogPerBoardCostEur,
} from '../physics/model';

interface WatchdogControlConsoleProps {
  selectedTopology: WatchdogTopologyId;
  onSelectTopology: (id: WatchdogTopologyId) => void;
  params: WatchdogSimParams;
  onChangeParams: (next: WatchdogSimParams) => void;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
}

const FAULT_OPTIONS: Array<{ id: WatchdogFaultMode; label: string; detail: string }> = [
  { id: 'none', label: 'Normal Operation', detail: 'Healthy GPIO24 heartbeat & intact components' },
  { id: 'stuck_high', label: 'GPIO24 Stuck HIGH (0 Hz)', detail: 'Frozen software leaves pin high — must cut off' },
  { id: 'runaway_2khz', label: 'Runaway Loop (2 kHz)', detail: 'Crashed software toggling rapidly — window test' },
  { id: 'r49_open', label: 'R49 Open-Circuit', detail: 'One parallel drain resistor fails open (τ doubles)' },
  { id: 'c17_short', label: 'C17 Shorted', detail: 'First series coupling cap shorts (C19 still blocks DC)' },
  { id: 'ic_stuck_on', label: 'IC Output Shorted ON', detail: 'Active IC pin stuck active — single-fault audit' },
];

export const WatchdogControlConsole: React.FC<WatchdogControlConsoleProps> = ({
  selectedTopology,
  onSelectTopology,
  params,
  onChangeParams,
  batchSize,
  onChangeBatchSize,
}) => {
  return (
    <aside className="w-full lg:w-[340px] shrink-0 bg-white border border-slate-200 rounded-lg p-5 space-y-5 lg:sticky lg:top-16">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Watchdog Bench Controls</h2>
          <p className="text-xs text-slate-500 mt-0.5">GPIO24 heartbeat, stalls &amp; corners</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
          {([2, 5] as const).map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => onChangeBatchSize(qty)}
              className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                batchSize === qty
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {qty}×
            </button>
          ))}
        </div>
      </div>

      {/* Topology Selector */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500">
          Watchdog Architecture
        </div>
        <div className="space-y-1.5">
          {WATCHDOG_TOPOLOGY_ORDER.map((id) => {
            const spec = WATCHDOG_TOPOLOGY_SPECS[id];
            const cost = watchdogPerBoardCostEur(spec, batchSize);
            const active = selectedTopology === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTopology(id)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50/70 border-blue-500 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{spec.shortName}</span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 shrink-0">
                    €{cost.toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{spec.badgeText}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Heartbeat Frequency */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Heartbeat Rate (GPIO 24)</span>
          <span className="font-mono tabular-nums font-semibold text-blue-700">
            {params.heartbeatHz} Hz
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={2500}
          step={params.heartbeatHz < 20 ? 0.5 : params.heartbeatHz < 200 ? 5 : 50}
          value={params.heartbeatHz}
          onChange={(e) =>
            onChangeParams({ ...params, heartbeatHz: Number(e.target.value), activeFault: 'none' })
          }
          className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="grid grid-cols-3 gap-1">
          {[
            { f: 0, label: '0 Hz' },
            { f: 0.5, label: '0.5 Hz' },
            { f: 5, label: '5 Hz' },
            { f: 20, label: '20 Hz' },
            { f: 200, label: '200 Hz' },
            { f: 2000, label: '2 kHz' },
          ].map((preset) => (
            <button
              key={preset.f}
              type="button"
              onClick={() =>
                onChangeParams({ ...params, heartbeatHz: preset.f, activeFault: 'none' })
              }
              className={`px-1.5 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                params.heartbeatHz === preset.f
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Linux Stall Duration */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Linux Stall Duration</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {params.linuxStallS.toFixed(1)} s
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={22}
          step={0.5}
          value={params.linuxStallS}
          onChange={(e) => onChangeParams({ ...params, linuxStallS: Number(e.target.value) })}
          className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="grid grid-cols-4 gap-1">
          {[0, 5, 10, 20].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeParams({ ...params, linuxStallS: s })}
              className={`px-1.5 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                params.linuxStallS === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {s} s
            </button>
          ))}
        </div>
      </div>

      {/* AO3400A MOSFET V_th Corner */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">AO3400A V_gs(th) Corner</span>
          <span className="font-mono text-[11px] text-slate-500">0.65 / 1.05 / 1.45 V</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'min', label: 'Min 0.65 V' },
              { id: 'typ', label: 'Typ 1.05 V' },
              { id: 'max', label: 'Max 1.45 V' },
            ] as Array<{ id: MosfetCorner; label: string }>
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChangeParams({ ...params, mosfetCorner: c.id })}
              className={`px-2 py-1.5 text-[11px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                params.mosfetCorner === c.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Boiler Room Temp & Humidity / Flux */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Boiler Room Temp</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {params.ambientTempC} °C
          </span>
        </div>
        <input
          type="range"
          min={15}
          max={60}
          step={5}
          value={params.ambientTempC}
          onChange={(e) => onChangeParams({ ...params, ambientTempC: Number(e.target.value) })}
          className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="grid grid-cols-2 gap-1 pt-1">
          {(
            [
              { id: 'clean', label: 'Clean PCB (>100 MΩ)' },
              { id: 'humid_boiler', label: 'Humid / Flux (3 MΩ)' },
            ] as Array<{ id: FluxLeakageMode; label: string }>
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChangeParams({ ...params, fluxLeakage: mode.id })}
              className={`px-2 py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                params.fluxLeakage === mode.id
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fault Injection */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200">
        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500">
          Hardware Fault Injection
        </div>
        <div className="space-y-1">
          {FAULT_OPTIONS.map((f) => {
            const active = params.activeFault === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChangeParams({ ...params, activeFault: f.id })}
                className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition-colors cursor-pointer ${
                  active
                    ? f.id === 'none'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-rose-50 text-rose-900 border-rose-400 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium">{f.label}</div>
                <div
                  className={`text-[10.5px] ${
                    active && f.id === 'none' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {f.detail}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
