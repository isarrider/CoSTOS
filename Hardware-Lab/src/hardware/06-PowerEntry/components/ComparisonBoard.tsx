import { CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  POWER_TOPOLOGY_ORDER,
  POWER_TOPOLOGY_SPECS,
  PowerSimParams,
  PowerTopologyId,
  evaluatePowerEntry,
  powerPerBoardCostEur,
} from '../physics/model';

interface Props {
  selected: PowerTopologyId;
  onSelect: (id: PowerTopologyId) => void;
  params: PowerSimParams;
  batchSize: 2 | 5;
}

export function PowerComparisonBoard({ selected, onSelect, params, batchSize }: Props) {
  const revACost = powerPerBoardCostEur(POWER_TOPOLOGY_SPECS.rev_a_d18_bare, batchSize);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {POWER_TOPOLOGY_ORDER.map((id, idx) => {
          const spec = POWER_TOPOLOGY_SPECS[id];
          const res = evaluatePowerEntry(id, params);
          const cost = powerPerBoardCostEur(spec, batchSize);
          const isSelected = selected === id;
          const deltaVsRevA = cost - revACost;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? spec.recommended
                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-900 ring-2 ring-slate-900/15'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Option 0{idx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      res.faultVerdict === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : res.faultVerdict === 'MARGINAL'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {res.faultVerdict}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-900 leading-snug">{spec.shortName}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">{spec.badge}</div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">+5V_HAT:</span>
                    <span className="font-semibold text-slate-900">{res.v5HatV.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Short I:</span>
                    <span className={`font-semibold ${res.pi5BrownoutRisk ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {res.shortCurrentMa >= 2000 ? '>5 A Crash' : `${res.shortCurrentMa} mA`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">3V3 Ripple:</span>
                    <span className={`font-semibold ${res.v3v3AnaRippleMv > 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {res.v3v3AnaRippleMv.toFixed(1)} mVpp
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pi-OFF 3V3:</span>
                    <span className={`font-semibold ${res.piOff3v3PeakV > 3.8 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {res.piOff3v3PeakV.toFixed(2)} V
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-baseline justify-between font-mono">
                <span className="text-xs font-bold text-slate-900">€{cost.toFixed(2)}/bd</span>
                <span className={`text-[10px] font-semibold ${deltaVsRevA <= 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {spec.jlcpcbFeederFeeEur === 0 ? '€0 fee' : `€${spec.jlcpcbFeederFeeEur.toFixed(2)} fee`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Fault Note Banner for Active Topology */}
      {(() => {
        const res = evaluatePowerEntry(selected, params);
        const spec = POWER_TOPOLOGY_SPECS[selected];
        const ok = res.faultVerdict === 'PASS';
        return (
          <div
            className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
              ok
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : res.faultVerdict === 'MARGINAL'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            {ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold">{spec.shortName}: </span>
              <span className="font-mono">{res.faultNote}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
