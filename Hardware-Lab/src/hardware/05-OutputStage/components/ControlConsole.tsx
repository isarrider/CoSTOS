import {
  OutputFaultMode,
  OutputSimParams,
  RELAY_LOAD_PRESETS,
  RelayLoadPreset,
} from '../physics/model';

interface Props {
  params: OutputSimParams;
  batchSize: 2 | 5;
  onChange: (next: OutputSimParams) => void;
  onBatchChange: (b: 2 | 5) => void;
}

const FAULTS: { id: OutputFaultMode; label: string }[] = [
  { id: 'none', label: 'Nominal (No Fault)' },
  { id: 'pwm_gnd_short', label: 'J2 PWM Short to GND' },
  { id: 'pwm_12v_miswire', label: '+12 V Miswire on J2 PWM' },
  { id: 'pwm_24v_miswire', label: '+24 V Miswire on J2 PWM' },
  { id: 'fb_24v_miswire', label: '+24 V Miswire on J2 FB1' },
  { id: 'rel_dead_short', label: 'J4 REL1 Dead Short' },
  { id: 'wd_tripped', label: 'Watchdog Tripped (WD_OK=0)' },
];

export function OutputControlConsole({ params, batchSize, onChange, onBatchChange }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Boiler-Room Bench &amp; Fault Injection Controls
          </h3>
          <p className="text-xs text-slate-500">
            Sweep Grundfos/Wilo PWM parameters, +V_DRV supply, relay coil load, ambient heat, and live wiring faults
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">JLCPCB Batch:</span>
          {([2, 5] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onBatchChange(b)}
              className={`px-2.5 py-1 rounded font-mono font-semibold border transition ${
                batchSize === b
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {b}× Boards
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-medium">PWM Freq</span>
            <span className="font-mono font-bold text-slate-900">{params.pwmFreqHz} Hz</span>
          </div>
          <input
            type="range"
            min={100}
            max={1000}
            step={50}
            value={params.pwmFreqHz}
            onChange={(e) => onChange({ ...params, pwmFreqHz: Number(e.target.value) })}
            className="w-full accent-slate-900"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-medium">+V_DRV Rail</span>
            <span className="font-mono font-bold text-slate-900">{params.vDrvV.toFixed(1)} V</span>
          </div>
          <input
            type="range"
            min={5.0}
            max={12.0}
            step={0.5}
            value={params.vDrvV}
            onChange={(e) => onChange({ ...params, vDrvV: Number(e.target.value) })}
            className="w-full accent-slate-900"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-medium">Pump Load / Cable</span>
            <span className="font-mono font-bold text-slate-900">
              {params.pumpLoadMa.toFixed(1)} mA · {params.cableLengthM} m
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={params.pumpLoadMa}
            onChange={(e) => onChange({ ...params, pumpLoadMa: Number(e.target.value) })}
            className="w-full accent-slate-900"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-medium">Boiler Ambient</span>
            <span className="font-mono font-bold text-slate-900">{params.ambientTempC} °C</span>
          </div>
          <input
            type="range"
            min={0}
            max={65}
            step={5}
            value={params.ambientTempC}
            onChange={(e) => onChange({ ...params, ambientTempC: Number(e.target.value) })}
            className="w-full accent-slate-900"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-medium">J4 REL1 Load</span>
          </div>
          <select
            value={params.relayLoad}
            onChange={(e) => onChange({ ...params, relayLoad: e.target.value as RelayLoadPreset })}
            className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-900 font-medium"
          >
            {(Object.keys(RELAY_LOAD_PRESETS) as RelayLoadPreset[]).map((k) => (
              <option key={k} value={k}>
                {RELAY_LOAD_PRESETS[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fault Injection Strip */}
      <div className="pt-2 border-t border-slate-100">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Active Fault Injection Corner
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FAULTS.map((f) => {
            const active = params.activeFault === f.id;
            const isDanger = f.id !== 'none';
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ ...params, activeFault: f.id })}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                  active
                    ? isDanger
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
