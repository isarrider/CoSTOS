import React from 'react';
import {
  FaultMode,
  SimulationParams,
  TOPOLOGY_ORDER,
  TOPOLOGY_SPECS,
  TopologyId,
  perBoardCostEur,
} from '../physics/model';
import { pt1000Resistance } from '../physics/pt1000';

interface ControlConsoleProps {
  selectedTopology: TopologyId;
  onSelectTopology: (id: TopologyId) => void;
  params: SimulationParams;
  onChangeParams: (next: SimulationParams) => void;
  batchSize: 2 | 5;
  onChangeBatchSize: (qty: 2 | 5) => void;
}

const FAULT_OPTIONS: { id: FaultMode; label: string }[] = [
  { id: 'none', label: 'Nominal' },
  { id: 'open', label: 'Open Circuit' },
  { id: 'short', label: 'Short Circuit' },
  { id: 'surge_24v', label: '+24 V Surge' },
  { id: 'stale', label: 'Stale Bus' },
];

export const ControlConsole: React.FC<ControlConsoleProps> = ({
  selectedTopology,
  onSelectTopology,
  params,
  onChangeParams,
  batchSize,
  onChangeBatchSize,
}) => {
  const rPt = pt1000Resistance(params.collectorTempC);

  const applyPreset = (preset: 'ref' | 'zero_fee' | 'stagnation' | 'uv') => {
    if (preset === 'ref') {
      onChangeParams({
        collectorTempC: 100,
        resistorTolerancePct: 0.1,
        cableResistanceOhm: 1.2,
        calibrateCableAndZero: true,
        supplyVoltageV: 5.0,
        ambientTempC: 25,
        gpioJitterUs: 40,
        pollIntervalS: 10,
        activeFault: 'none',
      });
    } else if (preset === 'zero_fee') {
      onSelectTopology('switched_rc');
      onChangeParams({
        ...params,
        collectorTempC: 100,
        resistorTolerancePct: 0.1,
        cableResistanceOhm: 1.2,
        calibrateCableAndZero: true,
        gpioJitterUs: 60,
        activeFault: 'none',
      });
    } else if (preset === 'stagnation') {
      onChangeParams({
        ...params,
        collectorTempC: 220,
        ambientTempC: 45,
        activeFault: 'none',
      });
    } else if (preset === 'uv') {
      onChangeParams({
        ...params,
        supplyVoltageV: 4.63,
        gpioJitterUs: 180,
        activeFault: 'none',
      });
    }
  };

  return (
    <aside className="w-full lg:w-[360px] shrink-0 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
      {/* Section 1: Topology Selector */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Circuit Topology</h2>
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

        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {TOPOLOGY_ORDER.map((id) => {
            const spec = TOPOLOGY_SPECS[id];
            const isSelected = selectedTopology === id;
            const unitCost = perBoardCostEur(spec, batchSize);
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

      {/* Section 2: Quick Test Scenarios */}
      <div className="p-5">
        <div className="text-xs font-semibold text-slate-700 mb-2.5">Quick Scenarios</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('ref')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            25 m Cable Ref
          </button>
          <button
            type="button"
            onClick={() => applyPreset('zero_fee')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            Zero-Fee Test
          </button>
          <button
            type="button"
            onClick={() => applyPreset('stagnation')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            Stagnation 220 °C
          </button>
          <button
            type="button"
            onClick={() => applyPreset('uv')}
            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-left transition-colors cursor-pointer"
          >
            Pi Sag (4.63 V)
          </button>
        </div>
      </div>

      {/* Section 3: Collector Temperature */}
      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="collector-temp" className="text-xs font-semibold text-slate-700">
              Collector Temperature
            </label>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900">
              {params.collectorTempC.toFixed(0)} °C{' '}
              <span className="text-xs font-normal text-slate-500">({rPt.toFixed(1)} Ω)</span>
            </div>
          </div>
          <input
            id="collector-temp"
            type="range"
            min={-50}
            max={250}
            step={1}
            value={params.collectorTempC}
            onChange={(e) =>
              onChangeParams({ ...params, collectorTempC: Number(e.target.value) })
            }
            className="w-full lab-slider"
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[
              { label: '−20 °C', temp: -20 },
              { label: '100 °C', temp: 100 },
              { label: '130 °C', temp: 130 },
              { label: '220 °C', temp: 220 },
            ].map((step) => (
              <button
                key={step.temp}
                type="button"
                onClick={() => onChangeParams({ ...params, collectorTempC: step.temp })}
                className={`py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                  params.collectorTempC === step.temp
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resistor Tolerance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Resistor Tolerance</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {params.resistorTolerancePct === 0.1 ? 'Precision 0.1%' : 'Standard 0805'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200">
            {([0.1, 0.5, 1.0] as const).map((tol) => (
              <button
                key={tol}
                type="button"
                onClick={() => onChangeParams({ ...params, resistorTolerancePct: tol })}
                className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded transition-colors cursor-pointer ${
                  params.resistorTolerancePct === tol
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ±{tol}%
              </button>
            ))}
          </div>
        </div>

        {/* Collector Poll Interval */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Collector Poll Period</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {params.pollIntervalS === 1 ? '1 Hz continuous' : `Every ${params.pollIntervalS} s`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200">
            {([1, 3, 5, 10] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChangeParams({ ...params, pollIntervalS: sec })}
                className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded transition-colors cursor-pointer ${
                  params.pollIntervalS === sec
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sec} s
              </button>
            ))}
          </div>
        </div>

        {/* 2-Wire Cable Resistance */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="cable-res" className="text-xs font-semibold text-slate-700">
              2-Wire Roof Cable
            </label>
            <span className="text-xs font-mono tabular-nums text-slate-700">
              {params.cableResistanceOhm.toFixed(2)} Ω (~
              {Math.round((params.cableResistanceOhm / 0.0475))} m)
            </span>
          </div>
          <input
            id="cable-res"
            type="range"
            min={0}
            max={4}
            step={0.05}
            value={params.cableResistanceOhm}
            onChange={(e) =>
              onChangeParams({ ...params, cableResistanceOhm: Number(e.target.value) })
            }
            className="w-full lab-slider"
          />
          <label className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <span>CoSTOS software zero/cable calibration</span>
            <input
              type="checkbox"
              checked={params.calibrateCableAndZero}
              onChange={(e) =>
                onChangeParams({ ...params, calibrateCableAndZero: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
          </label>
        </div>

        {/* Pi 5V Rail & Ambient Temp */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="supply-v" className="text-xs font-semibold text-slate-700">
                Pi 5 V Rail
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-700">
                {params.supplyVoltageV.toFixed(2)} V
              </span>
            </div>
            <input
              id="supply-v"
              type="range"
              min={4.55}
              max={5.25}
              step={0.01}
              value={params.supplyVoltageV}
              onChange={(e) =>
                onChangeParams({ ...params, supplyVoltageV: Number(e.target.value) })
              }
              className="w-full lab-slider"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="ambient-t" className="text-xs font-semibold text-slate-700">
                Board Amb
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-700">
                {params.ambientTempC.toFixed(0)} °C
              </span>
            </div>
            <input
              id="ambient-t"
              type="range"
              min={5}
              max={60}
              step={1}
              value={params.ambientTempC}
              onChange={(e) =>
                onChangeParams({ ...params, ambientTempC: Number(e.target.value) })
              }
              className="w-full lab-slider"
            />
          </div>
        </div>

        {/* Linux GPIO Jitter */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="irq-jitter" className="text-xs font-semibold text-slate-700">
              Linux GPIO Edge Jitter
            </label>
            <span className="text-xs font-mono tabular-nums text-slate-700">
              ±{params.gpioJitterUs} µs
            </span>
          </div>
          <input
            id="irq-jitter"
            type="range"
            min={0}
            max={400}
            step={10}
            value={params.gpioJitterUs}
            onChange={(e) =>
              onChangeParams({ ...params, gpioJitterUs: Number(e.target.value) })
            }
            className="w-full lab-slider"
          />
        </div>
      </div>

      {/* Section 4: Fault Injection */}
      <div className="p-5">
        <div className="text-xs font-semibold text-slate-700 mb-2.5">Fault Injection</div>
        <div className="grid grid-cols-2 gap-1.5">
          {FAULT_OPTIONS.map((f) => {
            const active = params.activeFault === f.id;
            const isDanger = f.id !== 'none' && active;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChangeParams({ ...params, activeFault: f.id })}
                className={`px-2.5 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  f.id === 'none' ? 'col-span-2' : ''
                } ${
                  isDanger
                    ? 'bg-rose-50 border-rose-600 text-rose-800 font-semibold'
                    : active
                    ? 'bg-slate-900 border-slate-900 text-white'
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
