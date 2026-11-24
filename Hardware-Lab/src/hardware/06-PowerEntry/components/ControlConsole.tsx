import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  DEFAULT_POWER_PARAMS,
  PowerFaultMode,
  PowerSimParams,
} from '../physics/model';

interface Props {
  params: PowerSimParams;
  onChange: (next: PowerSimParams) => void;
  batchSize: 2 | 5;
  onBatchSizeChange: (b: 2 | 5) => void;
}

const FAULTS: { id: PowerFaultMode; label: string }[] = [
  { id: 'none', label: 'Nominal' },
  { id: 'hat_5v_short', label: 'HAT +5V Dead Short' },
  { id: 'hot_plug_inrush', label: 'Hot-Plug Inrush' },
  { id: 'pi_uvlo_465v', label: 'Pi UVLO (4.65 V)' },
  { id: 'pi_off_24v_backfeed', label: 'Pi-OFF +24V Back-Feed' },
  { id: 'buck_ripple_60mv', label: '60 mVpp Buck Ripple' },
  { id: 'boiler_60c_10yr', label: '60 °C / 10-Yr Aging' },
];

export function PowerControlConsole({ params, onChange, batchSize, onBatchSizeChange }: Props) {
  const set = <K extends keyof PowerSimParams>(key: K, val: PowerSimParams[K]) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Block 1 Bench Parameters &amp; Power-Tree Fault Injection
          </h2>
          <p className="text-xs text-slate-500">
            Adjust Pi header supply rails, full-HAT load (Subsystems 01–06), and inject real boiler-room power faults
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded border border-slate-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => onBatchSizeChange(2)}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                batchSize === 2 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2× Batch
            </button>
            <button
              type="button"
              onClick={() => onBatchSizeChange(5)}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                batchSize === 5 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5× Batch
            </button>
          </div>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_POWER_PARAMS)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Parameter Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <label className="block space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">Pi +5V Header</span>
            <span className="font-mono font-semibold text-slate-900">{params.pi5vRailV.toFixed(2)} V</span>
          </div>
          <input
            type="range"
            min={4.65}
            max={5.25}
            step={0.05}
            value={params.pi5vRailV}
            onChange={(e) => set('pi5vRailV', Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>4.65V UV</span>
            <span>5.05V</span>
            <span>5.25V</span>
          </div>
        </label>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">REL1 Load (05)</span>
            <span className="font-mono font-semibold text-slate-900">{params.relayLoadMa} mA</span>
          </div>
          <input
            type="range"
            min={0}
            max={138}
            step={5}
            value={params.relayLoadMa}
            onChange={(e) => set('relayLoadMa', Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0mA</span>
            <span>15mA SSR</span>
            <span>100mA Coil</span>
          </div>
        </label>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">DS18B20 Qty (04)</span>
            <span className="font-mono font-semibold text-slate-900">{params.oneWireSensorCount}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={params.oneWireSensorCount}
            onChange={(e) => set('oneWireSensorCount', Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1</span>
            <span>10× (15mA)</span>
            <span>16</span>
          </div>
        </label>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">Pi +3V3 Ripple</span>
            <span className="font-mono font-semibold text-slate-900">{params.pi3v3RippleMv} mVpp</span>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={5}
            value={params.pi3v3RippleMv}
            onChange={(e) => set('pi3v3RippleMv', Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>10mV</span>
            <span>45mV</span>
            <span>80mV</span>
          </div>
        </label>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">Boiler Ambient</span>
            <span className="font-mono font-semibold text-slate-900">{params.ambientTempC} °C</span>
          </div>
          <input
            type="range"
            min={0}
            max={65}
            step={5}
            value={params.ambientTempC}
            onChange={(e) => set('ambientTempC', Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0 °C</span>
            <span>45 °C</span>
            <span>65 °C</span>
          </div>
        </label>
      </div>

      {/* Fault Injection Toolbar */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mr-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Fault Injection:
        </span>
        {FAULTS.map((f) => {
          const active = params.activeFault === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => set('activeFault', f.id)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
                active
                  ? f.id === 'none'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
