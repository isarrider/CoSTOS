import React from 'react';
import {
  PUMP_TOPOLOGY_ORDER,
  PUMP_TOPOLOGY_SPECS,
  PumpFaultMode,
  PumpSimParams,
  PumpTopologyId,
  pumpPerBoardCostEur,
} from '../physics/model';

interface PumpControlConsoleProps {
  selectedTopology: PumpTopologyId;
  onSelectTopology: (id: PumpTopologyId) => void;
  params: PumpSimParams;
  onChangeParams: (next: PumpSimParams) => void;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
}

const FAULT_OPTIONS: { id: PumpFaultMode; label: string }[] = [
  { id: 'none', label: 'Nominal' },
  { id: 'pi_uv', label: 'Pi UV (4.63 V)' },
  { id: 'short_pwm', label: 'Shorted PWM1' },
  { id: 'osc_dead', label: 'Dead Oscillator' },
  { id: 'slow_ramp', label: 'Slow PSU Ramp' },
];

export const PumpControlConsole: React.FC<PumpControlConsoleProps> = ({
  selectedTopology,
  onSelectTopology,
  params,
  onChangeParams,
  batchSize,
  onChangeBatchSize,
}) => {
  const applyScenario = (scenario: 'normal1' | 'stress2_uv' | 'slow_ramp' | 'short') => {
    if (scenario === 'normal1') {
      onChangeParams({
        piSupplyV: 5.0,
        pumpCount: 1,
        loadProfile: 'normal',
        ambientTempC: 30,
        pwmDutyPct: 100,
        activeFault: 'none',
      });
    } else if (scenario === 'stress2_uv') {
      onChangeParams({
        piSupplyV: 4.63,
        pumpCount: 2,
        loadProfile: 'stress',
        ambientTempC: 45,
        pwmDutyPct: 100,
        activeFault: 'pi_uv',
      });
    } else if (scenario === 'slow_ramp') {
      onSelectTopology('d25_bjt_doubler');
      onChangeParams({
        ...params,
        piSupplyV: 5.0,
        activeFault: 'slow_ramp',
      });
    } else if (scenario === 'short') {
      onChangeParams({
        ...params,
        piSupplyV: 5.25,
        pwmDutyPct: 100,
        activeFault: 'short_pwm',
      });
    }
  };

  return (
    <aside className="w-full lg:w-[360px] shrink-0 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
      {/* Topology Picker */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Driver Supply Topology</h2>
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeBatchSize(2)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                batchSize === 2
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2× Min
            </button>
            <button
              type="button"
              onClick={() => onChangeBatchSize(5)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                batchSize === 5
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5× Group
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {PUMP_TOPOLOGY_ORDER.map((id) => {
            const spec = PUMP_TOPOLOGY_SPECS[id];
            const isSelected = selectedTopology === id;
            const unitCost = pumpPerBoardCostEur(spec, batchSize);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTopology(id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-md border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-600 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{spec.shortName}</span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                    €{unitCost.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                  <span>Parts €{spec.partCostEur.toFixed(2)}</span>
                  <span aria-hidden="true">·</span>
                  <span className={spec.jlcpcbFeederFeeEur === 0 ? 'text-emerald-700 font-medium' : ''}>
                    Fee €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Stress Scenarios */}
      <div className="p-5">
        <div className="text-xs font-semibold text-slate-700 mb-2.5">Quick Audit Scenarios</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => applyScenario('normal1')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            1× Normal (5.0 V)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('stress2_uv')}
            className="px-2.5 py-2 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md text-left transition-colors cursor-pointer"
          >
            2× Stress + UV
          </button>
          <button
            type="button"
            onClick={() => applyScenario('slow_ramp')}
            className="px-2.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md text-left transition-colors cursor-pointer"
          >
            D25 Slow Ramp
          </button>
          <button
            type="button"
            onClick={() => applyScenario('short')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            Shorted Cable
          </button>
        </div>
      </div>

      {/* Electrical Sliders */}
      <div className="p-5 space-y-4">
        {/* Pi +5V Rail */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="pump-pi-5v" className="text-xs font-semibold text-slate-700">
              Raspberry Pi +5 V Rail
            </label>
            <span className="text-sm font-mono tabular-nums font-semibold text-slate-900">
              {params.piSupplyV.toFixed(2)} V
            </span>
          </div>
          <input
            id="pump-pi-5v"
            type="range"
            min={4.2}
            max={5.25}
            step={0.01}
            value={params.piSupplyV}
            onChange={(e) =>
              onChangeParams({ ...params, piSupplyV: Number(e.target.value), activeFault: params.activeFault === 'pi_uv' ? 'none' : params.activeFault })
            }
            className="w-full lab-slider"
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[4.2, 4.63, 5.0, 5.25].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChangeParams({ ...params, piSupplyV: v, activeFault: 'none' })}
                className={`py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                  Math.abs(params.piSupplyV - v) < 0.015
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {v.toFixed(2)}V
              </button>
            ))}
          </div>
        </div>

        {/* Fitted Pump Channels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Fitted Pump Outputs</span>
            <span className="text-xs font-mono text-slate-500">
              {params.pumpCount === 1 ? 'PUMP1 only' : 'PUMP1 + PUMP2'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200">
            {([1, 2] as const).map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => onChangeParams({ ...params, pumpCount: cnt })}
                className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  params.pumpCount === cnt
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cnt === 1 ? '1× Pump (Rev A)' : '2× Pumps (Full)'}
              </button>
            ))}
          </div>
        </div>

        {/* Pump Opto Input Load */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Pump PWM Input Load</span>
            <span className="text-xs font-mono text-slate-500">
              {params.loadProfile === 'normal' ? '2.2 kΩ (~2.6 mA)' : '470 Ω (~10 mA)'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, loadProfile: 'normal' })}
              className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                params.loadProfile === 'normal'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Normal (Wilo)
            </button>
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, loadProfile: 'stress' })}
              className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                params.loadProfile === 'stress'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stress (10 mA)
            </button>
          </div>
        </div>

        {/* Boiler Room Temp & Duty */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="pump-amb" className="text-xs font-semibold text-slate-700">
                Ambient
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-700">
                {params.ambientTempC} °C
              </span>
            </div>
            <input
              id="pump-amb"
              type="range"
              min={10}
              max={60}
              step={1}
              value={params.ambientTempC}
              onChange={(e) =>
                onChangeParams({ ...params, ambientTempC: Number(e.target.value) })
              }
              className="w-full lab-slider"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="pump-duty" className="text-xs font-semibold text-slate-700">
                PWM Duty
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-700">
                {params.pwmDutyPct}%
              </span>
            </div>
            <input
              id="pump-duty"
              type="range"
              min={10}
              max={100}
              step={5}
              value={params.pwmDutyPct}
              onChange={(e) =>
                onChangeParams({ ...params, pwmDutyPct: Number(e.target.value) })
              }
              className="w-full lab-slider"
            />
          </div>
        </div>
      </div>

      {/* Fault Injection */}
      <div className="p-5">
        <div className="text-xs font-semibold text-slate-700 mb-2.5">Fault Injection</div>
        <div className="grid grid-cols-2 gap-1.5">
          {FAULT_OPTIONS.map((f) => {
            const active = params.activeFault === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChangeParams({ ...params, activeFault: f.id })}
                className={`px-2.5 py-2 text-xs font-medium rounded-md border text-left transition-colors cursor-pointer ${
                  active
                    ? f.id === 'none'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                      : 'bg-rose-50 border-rose-600 text-rose-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
