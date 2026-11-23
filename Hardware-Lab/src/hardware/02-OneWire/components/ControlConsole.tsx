import {
  CABLE_CAP_PF_PER_M,
  ONEWIRE_TOPOLOGY_ORDER,
  ONEWIRE_TOPOLOGY_SPECS,
  OneWireCableType,
  OneWireFaultId,
  OneWireSimParams,
  OneWireTopologyId,
} from '../physics/model';

interface Props {
  selectedTopology: OneWireTopologyId;
  onSelectTopology: (id: OneWireTopologyId) => void;
  params: OneWireSimParams;
  onChangeParams: (next: OneWireSimParams) => void;
}

const FAULT_OPTIONS: { id: OneWireFaultId; label: string }[] = [
  { id: 'none', label: 'Normal Operation' },
  { id: 'vdd_short_a', label: '1W-A VDD Short to GND' },
  { id: 'dq_to_vdrv', label: 'Pump +V_DRV (8.5 V) -> DQ' },
  { id: 'dq_to_12v', label: '+12 V Miswire -> DQ' },
  { id: 'vdd_to_12v', label: '+12 V Reverse-Feed -> VDD' },
  { id: 'esd_8kv', label: '±8 kV HBM ESD on DQ' },
  { id: 'pi5_jitter', label: 'Pi 5 RP1 Jitter (+3.5 µs)' },
];

export function OneWireControlConsole({
  selectedTopology,
  onSelectTopology,
  params,
  onChangeParams,
}: Props) {
  return (
    <aside className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      <div>
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2">
          1. Active 1-Wire Architecture
        </div>
        <div className="space-y-1.5">
          {ONEWIRE_TOPOLOGY_ORDER.map((id) => {
            const spec = ONEWIRE_TOPOLOGY_SPECS[id];
            const active = id === selectedTopology;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTopology(id)}
                className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-50 border-cyan-600 text-cyan-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{spec.shortName}</span>
                  <span className="font-mono text-[10.5px] text-slate-500 shrink-0">
                    {spec.busVoltageV.toFixed(1)}V · €{spec.jlcpcbFeederFeeEur.toFixed(0)} fee
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cable & Field Plant Controls */}
      <div className="space-y-4 pt-3 border-t border-slate-200">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
          2. Boiler-Room Cable &amp; Supply Corner
        </div>

        {/* Cable Length */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">Cable Length (Bus A)</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{params.cableLengthM} m</span>
          </div>
          <input
            type="range"
            min={2}
            max={80}
            step={1}
            value={params.cableLengthM}
            onChange={(e) => onChangeParams({ ...params, cableLengthM: Number(e.target.value) })}
            className="w-full accent-cyan-700 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>2 m</span>
            <span>30 m typ</span>
            <span>60 m</span>
            <span>80 m</span>
          </div>
        </div>

        {/* Cable Type */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Cable Capacitance</label>
          <select
            value={params.cableType}
            onChange={(e) => onChangeParams({ ...params, cableType: e.target.value as OneWireCableType })}
            className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-2 text-slate-800 focus:outline-none focus:border-cyan-600"
          >
            {(Object.keys(CABLE_CAP_PF_PER_M) as OneWireCableType[]).map((k) => (
              <option key={k} value={k}>
                {CABLE_CAP_PF_PER_M[k].label}
              </option>
            ))}
          </select>
        </div>

        {/* Sensors per bus */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">DS18B20 Sensors on Bus</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{params.sensorCount}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={params.sensorCount}
            onChange={(e) => onChangeParams({ ...params, sensorCount: Number(e.target.value) })}
            className="w-full accent-cyan-700 cursor-pointer"
          />
        </div>

        {/* Pi 5V Supply */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">Raspberry Pi +5V Rail</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {params.piSupplyV.toFixed(2)} V
            </span>
          </div>
          <input
            type="range"
            min={4.2}
            max={5.25}
            step={0.01}
            value={params.piSupplyV}
            onChange={(e) => onChangeParams({ ...params, piSupplyV: Number(e.target.value) })}
            className="w-full accent-cyan-700 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>4.20 V</span>
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, piSupplyV: 4.63 })}
              className="text-amber-700 hover:underline cursor-pointer"
            >
              4.63 V UV
            </button>
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, piSupplyV: 5.0 })}
              className="text-slate-600 hover:underline cursor-pointer"
            >
              5.00 V
            </button>
            <span>5.25 V</span>
          </div>
        </div>

        {/* Ambient Temperature */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">Boiler-Room Ambient Temp</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{params.ambientTempC} °C</span>
          </div>
          <input
            type="range"
            min={0}
            max={70}
            step={5}
            value={params.ambientTempC}
            onChange={(e) => onChangeParams({ ...params, ambientTempC: Number(e.target.value) })}
            className="w-full accent-cyan-700 cursor-pointer"
          />
        </div>
      </div>

      {/* Fault Injection */}
      <div className="pt-3 border-t border-slate-200">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2">
          3. Wiring &amp; Hardware Fault Injection
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {FAULT_OPTIONS.map((f) => {
            const active = params.activeFault === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChangeParams({ ...params, activeFault: f.id })}
                className={`text-left px-3 py-1.5 rounded text-xs border transition-colors cursor-pointer ${
                  active
                    ? f.id === 'none'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                      : 'bg-rose-50 border-rose-500 text-rose-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
}
