import { useMemo, useState } from 'react';
import {
  OneWireSimParams,
  computeCableLengthSweep,
  computeReadSlotWaveform,
} from '../physics/model';

interface Props {
  params: OneWireSimParams;
}

type ChartMode = 'waveform' | 'reach';

export function OneWireSweepChart({ params }: Props) {
  const [mode, setMode] = useState<ChartMode>('waveform');
  const waveform = useMemo(() => computeReadSlotWaveform(params), [params]);
  const reachSweep = useMemo(() => computeCableLengthSweep(params), [params]);

  const W = 720;
  const H = 265;
  const padL = 52;
  const padR = 24;
  const padT = 20;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yV = (v: number) => padT + ((5.5 - Math.max(0, Math.min(5.5, v))) / 5.5) * innerH;
  const xTime = (t: number) => padL + (t / 24) * innerW;
  const xLen = (m: number) => padL + ((m - 2) / (80 - 2)) * innerW;

  const sampleT = params.activeFault === 'pi5_jitter' ? 11.5 : 15.0;

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === 'waveform'
              ? `1-Wire Read-1 Slot Rising Edge (${params.cableLengthM} m · ${params.sensorCount}× DS18B20)`
              : `Cable Reach Sweep: Sampled Voltage vs. Cable Length (2 m – 80 m)`}
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {mode === 'waveform'
              ? `Master releases DQ at 4.0 µs and samples at ${sampleT.toFixed(1)} µs · Raspberry Pi V_IH = 2.00 V minimum`
              : `Shows Pi GPIO voltage at the 15 µs Read-1 sample point across increasing boiler-room cable runs`}
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('waveform')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'waveform' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Read-1 Waveform (µs)
          </button>
          <button
            type="button"
            onClick={() => setMode('reach')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'reach' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cable Reach Sweep (m)
          </button>
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none">
          {/* Danger zone below 2.0 V Pi V_IH */}
          <rect
            x={padL}
            y={yV(2.0)}
            width={innerW}
            height={yV(0) - yV(2.0)}
            fill="#fff1f2"
          />
          <line x1={padL} y1={yV(2.0)} x2={W - padR} y2={yV(2.0)} stroke="#e11d48" strokeWidth="1.2" strokeDasharray="4 3" />
          <text x={W - padR - 4} y={yV(2.0) - 4} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#be123c" fontFamily="monospace">
            Pi V_IH Min = 2.00 V (CRC FAIL below)
          </text>

          {/* 3.3 V Pi Rail Reference */}
          <line x1={padL} y1={yV(3.3)} x2={W - padR} y2={yV(3.3)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
          <text x={padL + 6} y={yV(3.3) - 4} fontSize="9" fill="#64748b" fontFamily="monospace">
            3.30 V Pi GPIO Rail
          </text>

          {/* Horizontal Y grid & labels */}
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={padL} y1={yV(v)} x2={W - padR} y2={yV(v)} stroke="#e2e8f0" strokeWidth="0.8" />
              <text x={padL - 8} y={yV(v) + 3.5} textAnchor="end" fontSize="10" fill="#475569" fontFamily="monospace">
                {v.toFixed(0)}V
              </text>
            </g>
          ))}

          {/* Chart Frame */}
          <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#cbd5e1" strokeWidth="1" />

          {mode === 'waveform' ? (
            <g>
              {/* Vertical X grid (µs) */}
              {[0, 4, 8, 12, 15, 20, 24].map((t) => (
                <g key={t}>
                  <line
                    x1={xTime(t)}
                    y1={padT}
                    x2={xTime(t)}
                    y2={padT + innerH}
                    stroke={t === 4 ? '#94a3b8' : '#f1f5f9'}
                    strokeWidth={t === 4 ? 1.1 : 0.8}
                  />
                  <text x={xTime(t)} y={H - 20} textAnchor="middle" fontSize="10" fill="#475569" fontFamily="monospace">
                    {t}µs
                  </text>
                </g>
              ))}

              {/* Sample window marker */}
              <line x1={xTime(sampleT)} y1={padT} x2={xTime(sampleT)} y2={padT + innerH} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x={xTime(sampleT) + 4} y={padT + 13} fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
                Sample ({sampleT.toFixed(1)}µs)
              </text>

              {/* Curves */}
              <path
                d={buildPath(waveform.map((p) => ({ x: xTime(p.timeUs), y: yV(p.ds2482DqV) })))}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.6"
                strokeDasharray="5 3"
              />
              <path
                d={buildPath(waveform.map((p) => ({ x: xTime(p.timeUs), y: yV(p.revBFieldDqV) })))}
                fill="none"
                stroke="#0891b2"
                strokeWidth="2.4"
              />
              <path
                d={buildPath(waveform.map((p) => ({ x: xTime(p.timeUs), y: yV(p.revBPiGpioV) })))}
                fill="none"
                stroke="#059669"
                strokeWidth="2.2"
              />
              <path
                d={buildPath(waveform.map((p) => ({ x: xTime(p.timeUs), y: yV(p.hardened3v3DqV) })))}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.7"
              />
              <path
                d={buildPath(waveform.map((p) => ({ x: xTime(p.timeUs), y: yV(p.revADqV) })))}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.0"
              />
            </g>
          ) : (
            <g>
              {/* Vertical X grid (m) */}
              {[10, 20, 30, 40, 50, 60, 70, 80].map((m) => (
                <g key={m}>
                  <line x1={xLen(m)} y1={padT} x2={xLen(m)} y2={padT + innerH} stroke="#f1f5f9" strokeWidth="0.8" />
                  <text x={xLen(m)} y={H - 20} textAnchor="middle" fontSize="10" fill="#475569" fontFamily="monospace">
                    {m}m
                  </text>
                </g>
              ))}

              {/* Active Cable Length Cursor */}
              <line
                x1={xLen(params.cableLengthM)}
                y1={padT}
                x2={xLen(params.cableLengthM)}
                y2={padT + innerH}
                stroke="#0f172a"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text x={xLen(params.cableLengthM) + 4} y={padT + 13} fontSize="9.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
                Active: {params.cableLengthM} m
              </text>

              {/* Curves */}
              <path
                d={buildPath(reachSweep.map((p) => ({ x: xLen(p.lengthM), y: yV(p.ds2482DqV) })))}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.6"
                strokeDasharray="5 3"
              />
              <path
                d={buildPath(reachSweep.map((p) => ({ x: xLen(p.lengthM), y: yV(p.revBPiV) })))}
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
              />
              <path
                d={buildPath(reachSweep.map((p) => ({ x: xLen(p.lengthM), y: yV(p.hardened3v3PiV) })))}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.8"
              />
              <path
                d={buildPath(reachSweep.map((p) => ({ x: xLen(p.lengthM), y: yV(p.revAPiV) })))}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.0"
              />
            </g>
          )}
        </svg>

        {/* Clean inline legend */}
        <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] font-mono">
          {mode === 'waveform' && (
            <span className="flex items-center gap-1.5 text-cyan-800 font-semibold">
              <span className="inline-block w-4 h-0.5 bg-cyan-600" />
              Rev B Field DQ (5 V)
            </span>
          )}
          <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <span className="inline-block w-4 h-0.5 bg-emerald-600" />
            Rev B Pi GPIO (3.3 V)
          </span>
          <span className="flex items-center gap-1.5 text-amber-800">
            <span className="inline-block w-4 h-0.5 bg-amber-600" />
            Hardened 3.3 V (2.2 kΩ)
          </span>
          <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
            <span className="inline-block w-4 h-0.5 bg-rose-600" />
            Rev A Baseline (4.7 kΩ)
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-slate-500" />
            DS2482 APU (5 V)
          </span>
        </div>
      </div>
    </div>
  );
}
