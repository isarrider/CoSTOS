import { useMemo } from 'react';
import { OutputSimParams, computeOutputFreqSweep } from '../physics/model';

interface Props {
  params: OutputSimParams;
}

export function OutputFreqSweepChart({ params }: Props) {
  const data = useMemo(() => computeOutputFreqSweep(params), [params]);

  const W = 720;
  const H = 260;
  const padL = 52;
  const padR = 24;
  const padT = 22;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yUs = (us: number) => padT + ((16 - Math.max(0, Math.min(16, us))) / 16) * innerH;
  const xHz = (hz: number) => padL + ((Math.max(100, Math.min(1200, hz)) - 100) / 1100) * innerW;

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const activePoint =
    data.reduce((best, pt) =>
      Math.abs(pt.freqHz - params.pwmFreqHz) < Math.abs(best.freqHz - params.pwmFreqHz) ? pt : best
    ) ?? data[0];

  // Danger zone polygon ABOVE the T/500 curve (edge time slower than allowed)
  const limitPts = data.map((p) => ({ x: xHz(p.freqHz), y: yUs(p.limitUs) }));
  const dangerZoneD =
    `M ${padL} ${padT} L ${W - padR} ${padT} ` +
    [...limitPts]
      .reverse()
      .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') +
    ' Z';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            PWM Edge Time (µs) vs. Frequency (100–1200 Hz) — Grundfos/Wilo T/500 Compliance
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            Solar pump spec requires t_rise, t_fall &le; T / 500 (4.0 µs @ 500 Hz, 2.0 µs @ 1000 Hz) at {params.cableLengthM} m cable &amp; +{params.vDrvV.toFixed(1)} V
          </p>
        </div>
        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          Rev B: {activePoint.revBEdgeUs.toFixed(2)} µs vs {activePoint.limitUs.toFixed(1)} µs limit
        </span>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none">
          {/* Danger zone above T/500 */}
          <path d={dangerZoneD} fill="#fff1f2" />
          <text
            x={W - padR - 6}
            y={padT + 14}
            textAnchor="end"
            fontSize="9.5"
            fontWeight="700"
            fill="#be123c"
            fontFamily="monospace"
          >
            FAIL ZONE (Edge &gt; T/500 Budget)
          </text>

          {/* Horizontal Y grid & labels */}
          {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((us) => (
            <g key={us}>
              <line x1={padL} y1={yUs(us)} x2={W - padR} y2={yUs(us)} stroke="#e2e8f0" strokeWidth="0.8" />
              {us % 4 === 0 && (
                <text x={padL - 8} y={yUs(us) + 3.5} textAnchor="end" fontSize="10" fill="#475569" fontFamily="monospace">
                  {us}µs
                </text>
              )}
            </g>
          ))}

          {/* Vertical X grid & labels */}
          {[100, 300, 500, 750, 1000, 1200].map((hz) => (
            <g key={hz}>
              <line x1={xHz(hz)} y1={padT} x2={xHz(hz)} y2={padT + innerH} stroke="#f1f5f9" strokeWidth="0.8" />
              <text x={xHz(hz)} y={H - 18} textAnchor="middle" fontSize="10" fill="#475569" fontFamily="monospace">
                {hz} Hz
              </text>
            </g>
          ))}

          {/* Frame */}
          <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#cbd5e1" strokeWidth="1" />

          {/* Active Frequency Cursor */}
          <line
            x1={xHz(params.pwmFreqHz)}
            y1={padT}
            x2={xHz(params.pwmFreqHz)}
            y2={padT + innerH}
            stroke="#0f172a"
            strokeWidth="1.4"
            strokeDasharray="4 2"
          />
          <text
            x={Math.min(W - padR - 58, xHz(params.pwmFreqHz) + 5)}
            y={padT + 27}
            fontSize="9.5"
            fontWeight="700"
            fill="#0f172a"
            fontFamily="monospace"
          >
            Active: {params.pwmFreqHz} Hz
          </text>

          {/* T/500 Limit Curve */}
          <path
            d={buildPath(limitPts)}
            fill="none"
            stroke="#e11d48"
            strokeWidth="2.0"
            strokeDasharray="6 4"
          />

          {/* Option E PC817C Opto */}
          <path
            d={buildPath(data.map((p) => ({ x: xHz(p.freqHz), y: yUs(p.pc817EdgeUs) })))}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.7"
            strokeDasharray="3 3"
          />

          {/* Rev A H3 */}
          <path
            d={buildPath(data.map((p) => ({ x: xHz(p.freqHz), y: yUs(p.revAH3EdgeUs) })))}
            fill="none"
            stroke="#d97706"
            strokeWidth="2.0"
          />

          {/* Rev A TC4427 */}
          <path
            d={buildPath(data.map((p) => ({ x: xHz(p.freqHz), y: yUs(p.tc4427EdgeUs) })))}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.8"
          />

          {/* Rev B Gemini Push-Pull */}
          <path
            d={buildPath(data.map((p) => ({ x: xHz(p.freqHz), y: yUs(p.revBEdgeUs) })))}
            fill="none"
            stroke="#059669"
            strokeWidth="2.6"
          />
          <circle
            cx={xHz(params.pwmFreqHz)}
            cy={yUs(activePoint.revBEdgeUs)}
            r="3.8"
            fill="#059669"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        </svg>

        {/* Inline Legend */}
        <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] font-mono">
          <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
            <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-rose-600" />
            Max Allowed (T/500)
          </span>
          <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <span className="inline-block w-4 h-0.5 bg-emerald-600" />
            Rev B Push-Pull (4 pF)
          </span>
          <span className="flex items-center gap-1.5 text-blue-700">
            <span className="inline-block w-4 h-0.5 bg-blue-600" />
            Rev A TC4427 + SMBJ13A
          </span>
          <span className="flex items-center gap-1.5 text-amber-800">
            <span className="inline-block w-4 h-0.5 bg-amber-600" />
            Rev A H3 (SMBJ13A)
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="inline-block w-4 h-0.5 border-t-2 border-dotted border-slate-500" />
            PC817C Opto (FAILS)
          </span>
        </div>
      </div>
    </div>
  );
}
