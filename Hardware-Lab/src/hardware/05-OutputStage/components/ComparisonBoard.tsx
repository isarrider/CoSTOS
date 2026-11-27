import {
  OUTPUT_TOPOLOGY_ORDER,
  OUTPUT_TOPOLOGY_SPECS,
  OutputSimParams,
  OutputTopologyId,
  evaluateOutputStage,
  outputPerBoardCostEur,
} from '../physics/model';

interface Props {
  selectedId: OutputTopologyId;
  params: OutputSimParams;
  batchSize: 2 | 5;
  onSelect: (id: OutputTopologyId) => void;
}

export function OutputComparisonBoard({ selectedId, params, batchSize, onSelect }: Props) {
  const rows = OUTPUT_TOPOLOGY_ORDER.map((id) => {
    const spec = OUTPUT_TOPOLOGY_SPECS[id];
    const res = evaluateOutputStage(id, params);
    const pwm24 = evaluateOutputStage(id, { ...params, activeFault: 'pwm_24v_miswire' });
    const relShort = evaluateOutputStage(id, { ...params, activeFault: 'rel_dead_short' });
    const cost = outputPerBoardCostEur(spec, batchSize);
    return { spec, res, pwm24, relShort, cost };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {rows.map(({ spec, res, cost }) => {
          const selected = spec.id === selectedId;
          const badgeStyle = spec.recommended
            ? 'bg-emerald-700 text-white'
            : res.faultVerdict === 'FAIL'
            ? 'bg-rose-100 text-rose-800'
            : 'bg-slate-100 text-slate-700';

          return (
            <button
              key={spec.id}
              type="button"
              onClick={() => onSelect(spec.id)}
              className={`text-left rounded-lg border p-3.5 transition flex flex-col justify-between ${
                selected
                  ? spec.recommended
                    ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                    : 'border-slate-900 bg-slate-50/60 ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${badgeStyle}`}>
                    {spec.badge}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 leading-snug mb-2">
                  {spec.shortName}
                </div>
                <div className="space-y-1 text-[11px] font-mono tabular-nums text-slate-600">
                  <div className="flex justify-between">
                    <span>t_edge:</span>
                    <span className={res.edgeRulePass ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                      {Math.max(res.tRiseUs, res.tFallUs).toFixed(2)} µs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>RB1 Pi:</span>
                    <span className={res.readbackSafe ? 'text-slate-900' : 'text-rose-700 font-semibold'}>
                      {res.readbackPiV.toFixed(2)} V
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>REL Short:</span>
                    <span className={res.relayShortCurrentMa < 300 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                      {res.relayShortCurrentMa >= 1000 ? '>15 A!' : `${res.relayShortCurrentMa} mA`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-900">€{cost.toFixed(2)}/bd</span>
                <span
                  className={`font-bold ${
                    res.faultVerdict === 'PASS'
                      ? 'text-emerald-700'
                      : res.faultVerdict === 'MARGINAL'
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {res.faultVerdict}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Master Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900">
            All 5 Output Stage Architectures — Side-by-Side Stress &amp; Cost Matrix ({batchSize}× JLCPCB Batch)
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            +V_DRV = {params.vDrvV.toFixed(1)} V · {params.pwmFreqHz} Hz · {params.ambientTempC} °C
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="py-2 px-3">Architecture</th>
                <th className="py-2 px-2">V_PWM</th>
                <th className="py-2 px-2">t_edge</th>
                <th className="py-2 px-2">Shoot-Thru</th>
                <th className="py-2 px-2">RB1 (G6)</th>
                <th className="py-2 px-2">+24V PWM</th>
                <th className="py-2 px-2">J4 Short</th>
                <th className="py-2 px-2">Fees</th>
                <th className="py-2 px-3 text-right">Cost ({batchSize}×)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {rows.map(({ spec, res, pwm24, relShort, cost }) => (
                <tr
                  key={spec.id}
                  onClick={() => onSelect(spec.id)}
                  className={`cursor-pointer ${
                    spec.id === selectedId
                      ? 'bg-emerald-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 px-3 font-sans font-semibold text-slate-900">{spec.shortName}</td>
                  <td className="py-2 px-2 text-slate-800">{res.vHighAtPumpV.toFixed(2)} V</td>
                  <td className={`py-2 px-2 ${res.edgeRulePass ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}`}>
                    {Math.max(res.tRiseUs, res.tFallUs).toFixed(2)} µs
                  </td>
                  <td className={`py-2 px-2 ${res.shootThroughMa === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'}`}>
                    {res.shootThroughMa} mA
                  </td>
                  <td className={`py-2 px-2 ${res.readbackSafe ? 'text-emerald-700' : 'text-rose-700 font-semibold'}`}>
                    {res.readbackPiV.toFixed(2)} V
                  </td>
                  <td className={`py-2 px-2 font-bold ${pwm24.faultVerdict === 'PASS' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {pwm24.faultVerdict}
                  </td>
                  <td className={`py-2 px-2 font-bold ${relShort.faultVerdict === 'PASS' ? 'text-emerald-700' : relShort.faultVerdict === 'MARGINAL' ? 'text-amber-700' : 'text-rose-700'}`}>
                    {relShort.faultVerdict}
                  </td>
                  <td className={`py-2 px-2 ${spec.jlcpcbFeederFeeEur === 0 ? 'text-emerald-700 font-bold' : 'text-rose-700'}`}>
                    €{spec.jlcpcbFeederFeeEur.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">€{cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
