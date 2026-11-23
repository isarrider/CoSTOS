import { useMemo, useState } from 'react';
import {
  PowerEvalResult,
  PowerSimParams,
  computeFoldbackCurve,
} from '../physics/model';

interface Props {
  params: PowerSimParams;
  activeResult: PowerEvalResult;
}

type ChartMode = 'foldback' | 'budget';

export function PowerSweepChart({ params, activeResult }: Props) {
  const [mode, setMode] = useState<ChartMode>('foldback');
  const curve = useMemo(() => computeFoldbackCurve(params.pi5vRailV), [params.pi5vRailV]);

  const W = 720;
  const H = 260;
  const padL = 56;
  const padR = 24;
  const padT = 22;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Foldback plot: X = V_OUT (5.0V left -> 0.0V dead short right), Y = Current (0..1600 mA)
  const xVout = (v: number) => padL + ((params.pi5vRailV - Math.max(0, Math.min(params.pi5vRailV, v))) / params.pi5vRailV) * innerW;
  const yMa = (ma: number) => padT + ((1600 - Math.max(0, Math.min(1600, ma))) / 1600) * innerH;

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === 'foldback'
              ? 'eFuse Foldback Characteristic: Pi +5V Current Drawn vs. HAT Rail Collapse (5 V → 0 V Short)'
              : `Full-HAT Current Budget by Subsystem (Total: ${activeResult.total5vMa.toFixed(0)} mA @ +5V | ${activeResult.total3v3Ma.toFixed(1)} mA @ +3V3)`}
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {mode === 'foldback'
              ? 'Shows how Rev B foldback peaks at 360 mA knee then folds back to 119 mA on a dead short (0.57 W safe, zero Pi 5 reboot!)'
              : 'Live sum of Subsystems 01–06 against Pi 4/5 GPIO header budget (200 mA D18 design target / 360 mA Rev B eFuse knee)'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('foldback')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'foldback' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Foldback Curve (mA)
          </button>
          <button
            type="button"
            onClick={() => setMode('budget')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'budget' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full-HAT Rail Budget
          </button>
        </div>
      </div>

      <div className="p-4">
        {mode === 'foldback' ? (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none">
              {/* Pi 5 Brown-out danger zone above 1000 mA */}
              <rect x={padL} y={padT} width={innerW} height={yMa(1000) - padT} fill="#fff1f2" />
              <line x1={padL} y1={yMa(1000)} x2={W - padR} y2={yMa(1000)} stroke="#e11d48" strokeWidth="1.2" strokeDasharray="5 3" />
              <text x={W - padR - 6} y={yMa(1000) - 5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#be123c" fontFamily="monospace">
                Pi 5 Brown-Out / PMIC Trip Risk (&gt;1000 mA Surge)
              </text>

              {/* Y gridlines */}
              {[0, 200, 400, 800, 1200, 1600].map((ma) => (
                <g key={ma}>
                  <line x1={padL} y1={yMa(ma)} x2={W - padR} y2={yMa(ma)} stroke="#e2e8f0" strokeWidth="0.8" />
                  <text x={padL - 8} y={yMa(ma) + 3.5} textAnchor="end" fontSize="9.5" fill="#475569" fontFamily="monospace">
                    {ma}mA
                  </text>
                </g>
              ))}

              {/* X gridlines (V_OUT from 5V down to 0V dead short) */}
              {[5, 4, 3, 2, 1, 0].map((v) => {
                const vx = xVout(Math.min(params.pi5vRailV, v));
                return (
                  <g key={v}>
                    <line x1={vx} y1={padT} x2={vx} y2={padT + innerH} stroke="#f1f5f9" strokeWidth="0.8" />
                    <text x={vx} y={H - 18} textAnchor="middle" fontSize="9.5" fill="#475569" fontFamily="monospace">
                      {v === 0 ? '0V (Short)' : `${v.toFixed(0)}V`}
                    </text>
                  </g>
                );
              })}

              <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#cbd5e1" strokeWidth="1" />

              {/* Curves */}
              <path
                d={buildPath(curve.map((p) => ({ x: xVout(p.vOutV), y: yMa(p.revACurrentMa) })))}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.0"
                strokeDasharray="4 3"
              />
              <path
                d={buildPath(curve.map((p) => ({ x: xVout(p.vOutV), y: yMa(p.ptcCurrentMa) })))}
                fill="none"
                stroke="#d97706"
                strokeWidth="2.0"
              />
              <path
                d={buildPath(curve.map((p) => ({ x: xVout(p.vOutV), y: yMa(p.revBCurrentMa) })))}
                fill="none"
                stroke="#059669"
                strokeWidth="2.8"
              />

              {/* Highlight Rev B knee & dead-short foldback point */}
              <circle cx={xVout(0)} cy={yMa(curve[curve.length - 1].revBCurrentMa)} r="4" fill="#059669" stroke="#ffffff" strokeWidth="1.2" />
              <text x={xVout(0) - 8} y={yMa(curve[curve.length - 1].revBCurrentMa) - 8} textAnchor="end" fontSize="9" fontWeight="700" fill="#065f46" fontFamily="monospace">
                Rev B Short: {curve[curve.length - 1].revBCurrentMa.toFixed(0)} mA (0.57 W safe!)
              </text>

              {/* Nominal HAT load horizontal marker */}
              <line
                x1={padL}
                y1={yMa(activeResult.total5vMa)}
                x2={W - padR}
                y2={yMa(activeResult.total5vMa)}
                stroke="#0f172a"
                strokeWidth="1.1"
                strokeDasharray="3 3"
              />
              <text x={padL + 6} y={yMa(activeResult.total5vMa) - 4} fontSize="9" fontWeight="700" fill="#0f172a" fontFamily="monospace">
                Active HAT Load: {activeResult.total5vMa.toFixed(0)} mA
              </text>
            </svg>

            <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <span className="inline-block w-4 h-0.5 bg-emerald-600" />
                Rev B Foldback eFuse (360 mA → 119 mA)
              </span>
              <span className="flex items-center gap-1.5 text-amber-800">
                <span className="inline-block w-4 h-0.5 bg-amber-600" />
                Option C 500 mA PTC (1.45 A Pre-Trip Surge)
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-rose-600" />
                Rev A Bare D18 (&gt;5 A Pi 5 Crash)
              </span>
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {activeResult.breakdown.map((row) => {
              const pct5v = Math.min(100, (row.rail5vMa / 200) * 100);
              return (
                <div key={row.id} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <div className="col-span-4 font-mono font-semibold text-slate-800 truncate">{row.label}</div>
                  <div className="col-span-5">
                    <div className="h-4 bg-slate-100 rounded overflow-hidden border border-slate-200 flex">
                      {row.rail5vMa > 0 && (
                        <div
                          className="h-full bg-rose-500/85"
                          style={{ width: `${pct5v}%` }}
                          title={`+5V: ${row.rail5vMa.toFixed(1)} mA`}
                        />
                      )}
                      {row.rail3v3Ma > 0 && (
                        <div
                          className="h-full bg-sky-500/85"
                          style={{ width: `${Math.max(2, (row.rail3v3Ma / 200) * 100)}%` }}
                          title={`+3V3: ${row.rail3v3Ma.toFixed(1)} mA`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 font-mono text-right text-[11px] text-slate-700">
                    <span className="text-rose-700 font-semibold">{row.rail5vMa.toFixed(1)} mA</span>
                    <span className="text-slate-400"> | </span>
                    <span className="text-sky-700 font-semibold">{row.rail3v3Ma.toFixed(1)} mA</span>
                  </div>
                </div>
              );
            })}
            <div className="pt-2.5 mt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-mono">
              <span className="text-slate-600">
                Full-HAT Total: <strong className="text-rose-700">{activeResult.total5vMa.toFixed(1)} mA @ +5V</strong> +{' '}
                <strong className="text-sky-700">{activeResult.total3v3Ma.toFixed(1)} mA @ +3V3</strong> ={' '}
                <strong className="text-slate-900">{activeResult.totalHatPowerMw.toFixed(0)} mW</strong>
              </span>
              <span className="text-emerald-700 font-semibold">
                Headroom to 360 mA Rev B Knee: +{(360 - activeResult.total5vMa).toFixed(0)} mA
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
