import React, { useMemo, useState } from 'react';
import {
  GEMINI_WD_THRESHOLDS,
  WatchdogSimParams,
  computeWatchdogDecaySweep,
  computeWatchdogFrequencySweep,
} from '../physics/model';

interface WatchdogSweepChartProps {
  params: WatchdogSimParams;
}

export const WatchdogSweepChart: React.FC<WatchdogSweepChartProps> = ({ params }) => {
  const [mode, setMode] = useState<'frequency' | 'decay'>('frequency');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const freqData = useMemo(() => computeWatchdogFrequencySweep(params), [params]);
  const decayData = useMemo(() => computeWatchdogDecaySweep(params), [params]);

  const W = 760;
  const H = 270;
  const padL = 52;
  const padR = 22;
  const padT = 18;
  const padB = 38;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const yPos = (v: number) => padT + ph - (Math.max(0, Math.min(3.5, v)) / 3.5) * ph;

  const freqX = (logF: number) => padL + ((logF - -1) / 4.7) * pw;
  const decayX = (t: number) => padL + (t / 26) * pw;

  const makePath = (pts: Array<[number, number]>) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const hoveredFreq =
    mode === 'frequency' && hoverIdx !== null && freqData[hoverIdx] ? freqData[hoverIdx] : null;
  const hoveredDecay =
    mode === 'decay' && hoverIdx !== null && decayData[hoverIdx] ? decayData[hoverIdx] : null;

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === 'frequency'
              ? 'Bandpass Frequency Window Sweep (0.1 Hz → 5 kHz)'
              : 'Heartbeat Cutoff & Linux Stall Decay (0 s → 26 s)'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'frequency'
              ? 'Compares C18 voltage / output state across slow hangs, valid 5–200 Hz heartbeats, and 2 kHz runaway software loops.'
              : 'Shows capacitor discharge from 20 Hz steady state vs AO3400A V_th spread (0.65–1.45 V) and Dedicated U4 Rev B 10 s stall immunity.'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode('frequency');
              setHoverIdx(null);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
              mode === 'frequency'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Frequency Window
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('decay');
              setHoverIdx(null);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
              mode === 'decay'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stall &amp; Cutoff Decay
          </button>
        </div>
      </div>

      {/* Interactive Readout Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
        {hoveredFreq ? (
          <>
            <span className="font-semibold text-slate-900">
              f = {hoveredFreq.freqHz >= 1000 ? `${(hoveredFreq.freqHz / 1000).toFixed(1)} kHz` : `${hoveredFreq.freqHz} Hz`}
            </span>
            <span className="text-emerald-700 font-semibold">U4 V_CAP: {hoveredFreq.u3bV.toFixed(2)} V</span>
            <span className="text-amber-700 font-semibold">D24 WD_OK: {hoveredFreq.d24V.toFixed(2)} V</span>
            <span className="text-slate-600">74LVC1G123: {hoveredFreq.mono74V > 1 ? 'ON' : 'OFF'}</span>
            <span className="text-rose-700">TPS3823: {hoveredFreq.tps3823V > 1 ? 'ON' : 'OFF'}</span>
          </>
        ) : hoveredDecay ? (
          <>
            <span className="font-semibold text-slate-900">t = {hoveredDecay.timeS.toFixed(1)} s</span>
            <span className="text-emerald-700 font-semibold">
              U4 V_CAP: {hoveredDecay.u3bV.toFixed(2)} V ({hoveredDecay.u3bOutV > 1 ? 'ON' : 'OFF'})
            </span>
            <span className="text-amber-700 font-semibold">D24 WD_OK: {hoveredDecay.d24V.toFixed(2)} V</span>
            <span className="text-slate-600">74LVC1G123: {hoveredDecay.mono74OutV > 1 ? 'ON' : 'OFF'}</span>
            <span className="text-rose-700">TPS3823: {hoveredDecay.tps3823OutV > 1 ? 'ON' : 'OFF'}</span>
          </>
        ) : (
          <span className="text-slate-500">
            Hover over the plot to inspect exact node voltages across all 5 watchdog architectures.
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* AO3400A V_th uncertainty band (0.65 - 1.45 V) */}
          <rect
            x={padL}
            y={yPos(1.45)}
            width={pw}
            height={yPos(0.65) - yPos(1.45)}
            fill="#fef3c7"
            fillOpacity={0.65}
          />
          <text
            x={padL + 6}
            y={yPos(1.45) + 11}
            fontSize="9.5"
            fontFamily="ui-monospace, monospace"
            fill="#b45309"
          >
            AO3400A V_gs(th) spread (0.65–1.45 V)
          </text>

          {/* Horizontal Y grid */}
          {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((v) => (
            <g key={v}>
              <line x1={padL} y1={yPos(v)} x2={padL + pw} y2={yPos(v)} stroke="#e2e8f0" strokeWidth={1} />
              <text
                x={padL - 7}
                y={yPos(v) + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fill="#475569"
              >
                {v.toFixed(1)}V
              </text>
            </g>
          ))}

          {mode === 'frequency' ? (
            <>
              {[
                { lf: -1, lbl: '0.1 Hz' },
                { lf: 0, lbl: '1 Hz' },
                { lf: Math.log10(5), lbl: '5 Hz' },
                { lf: Math.log10(20), lbl: '20 Hz' },
                { lf: Math.log10(200), lbl: '200 Hz' },
                { lf: 3, lbl: '1 kHz' },
                { lf: Math.log10(2000), lbl: '2 kHz' },
              ].map((tk) => (
                <g key={tk.lbl}>
                  <line
                    x1={freqX(tk.lf)}
                    y1={padT}
                    x2={freqX(tk.lf)}
                    y2={padT + ph}
                    stroke={tk.lbl === '20 Hz' ? '#93c5fd' : '#e2e8f0'}
                    strokeDasharray={tk.lbl === '20 Hz' ? '4 3' : undefined}
                    strokeWidth={1}
                  />
                  <text
                    x={freqX(tk.lf)}
                    y={padT + ph + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fill={tk.lbl === '20 Hz' ? '#1d4ed8' : '#475569'}
                    fontWeight={tk.lbl === '20 Hz' ? 700 : 400}
                  >
                    {tk.lbl}
                  </text>
                </g>
              ))}

              <line
                x1={padL}
                y1={yPos(GEMINI_WD_THRESHOLDS.vThHi)}
                x2={padL + pw}
                y2={yPos(GEMINI_WD_THRESHOLDS.vThHi)}
                stroke="#047857"
                strokeDasharray="5 4"
                strokeWidth={1.2}
              />
              <text
                x={padL + pw - 4}
                y={yPos(GEMINI_WD_THRESHOLDS.vThHi) - 4}
                textAnchor="end"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                fill="#047857"
              >
                U4 ON 1.54–1.56 V
              </text>

              <line
                x1={padL}
                y1={yPos(GEMINI_WD_THRESHOLDS.vThLo)}
                x2={padL + pw}
                y2={yPos(GEMINI_WD_THRESHOLDS.vThLo)}
                stroke="#047857"
                strokeDasharray="2 3"
                strokeWidth={1.2}
              />
              <text
                x={padL + pw - 4}
                y={yPos(GEMINI_WD_THRESHOLDS.vThLo) + 11}
                textAnchor="end"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                fill="#047857"
              >
                U4A Relay OFF 0.93 V (U4B 0.81 V)
              </text>

              <path
                d={makePath(freqData.map((d) => [freqX(d.logF), yPos(d.mono74V)]))}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.6}
                strokeDasharray="5 3"
              />
              <path
                d={makePath(freqData.map((d) => [freqX(d.logF), yPos(d.ne555V)]))}
                fill="none"
                stroke="#7c3aed"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <path
                d={makePath(freqData.map((d) => [freqX(d.logF), yPos(d.tps3823V)]))}
                fill="none"
                stroke="#e11d48"
                strokeWidth={1.6}
                strokeDasharray="2 3"
              />
              <path
                d={makePath(freqData.map((d) => [freqX(d.logF), yPos(d.d24V)]))}
                fill="none"
                stroke="#d97706"
                strokeWidth={2.2}
              />
              <path
                d={makePath(freqData.map((d) => [freqX(d.logF), yPos(d.u3bV)]))}
                fill="none"
                stroke="#047857"
                strokeWidth={2.8}
              />

              {freqData.map((d, i) => (
                <rect
                  key={d.freqHz}
                  x={freqX(d.logF) - 14}
                  y={padT}
                  width={28}
                  height={ph}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              ))}
              {hoveredFreq && (
                <line
                  x1={freqX(hoveredFreq.logF)}
                  y1={padT}
                  x2={freqX(hoveredFreq.logF)}
                  y2={padT + ph}
                  stroke="#0f172a"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}

              <text
                x={padL + pw / 2}
                y={H - 5}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="ui-monospace, monospace"
                fill="#475569"
              >
                GPIO 24 Heartbeat Frequency (log scale)
              </text>
            </>
          ) : (
            <>
              {[0, 5, 10, 15, 20, 26].map((t) => (
                <g key={t}>
                  <line
                    x1={decayX(t)}
                    y1={padT}
                    x2={decayX(t)}
                    y2={padT + ph}
                    stroke={t === 10 || t === 5 ? '#93c5fd' : '#e2e8f0'}
                    strokeDasharray={t === 10 || t === 5 ? '4 3' : undefined}
                    strokeWidth={1}
                  />
                  <text
                    x={decayX(t)}
                    y={padT + ph + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fill={t === 10 ? '#1d4ed8' : '#475569'}
                    fontWeight={t === 10 ? 700 : 400}
                  >
                    {t === 10 ? '10s Stall' : `${t}s`}
                  </text>
                </g>
              ))}

              <line
                x1={padL}
                y1={yPos(GEMINI_WD_THRESHOLDS.vThLo)}
                x2={padL + pw}
                y2={yPos(GEMINI_WD_THRESHOLDS.vThLo)}
                stroke="#047857"
                strokeDasharray="3 3"
                strokeWidth={1.3}
              />
              <text
                x={padL + pw - 4}
                y={yPos(GEMINI_WD_THRESHOLDS.vThLo) + 11}
                textAnchor="end"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                fill="#047857"
              >
                U4A Snap Trip 0.93 V (~15.4 s)
              </text>

              <path
                d={makePath(decayData.map((d) => [decayX(d.timeS), yPos(d.mono74OutV)]))}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <path
                d={makePath(decayData.map((d) => [decayX(d.timeS), yPos(d.tps3823OutV)]))}
                fill="none"
                stroke="#e11d48"
                strokeWidth={1.6}
                strokeDasharray="2 3"
              />
              <path
                d={makePath(decayData.map((d) => [decayX(d.timeS), yPos(d.d24V)]))}
                fill="none"
                stroke="#d97706"
                strokeWidth={2.2}
              />
              <path
                d={makePath(decayData.map((d) => [decayX(d.timeS), yPos(d.u3bV)]))}
                fill="none"
                stroke="#047857"
                strokeWidth={2.5}
              />
              <path
                d={makePath(decayData.map((d) => [decayX(d.timeS), yPos(d.u3bOutV)]))}
                fill="none"
                stroke="#059669"
                strokeWidth={2.2}
                strokeDasharray="6 2"
              />

              {decayData.map((d, i) => (
                <rect
                  key={d.timeS}
                  x={decayX(d.timeS) - 8}
                  y={padT}
                  width={16}
                  height={ph}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              ))}
              {hoveredDecay && (
                <line
                  x1={decayX(hoveredDecay.timeS)}
                  y1={padT}
                  x2={decayX(hoveredDecay.timeS)}
                  y2={padT + ph}
                  stroke="#0f172a"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}

              <text
                x={padL + pw / 2}
                y={H - 5}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="ui-monospace, monospace"
                fill="#475569"
              >
                Seconds After Heartbeat Stops (from 20 Hz Steady State)
              </text>
            </>
          )}

          <rect x={padL} y={padT} width={pw} height={ph} fill="none" stroke="#cbd5e1" strokeWidth={1.1} />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-700 inline-block" /> Dedicated U4 Schmitt (Rev B · Gemini)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-600 inline-block" /> Claude D24 Passive Pump
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-500 inline-block" /> 74LVC1G123 (no upper window)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-600 inline-block" /> TPS3823-33 (1.6 s trips Linux)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 bg-amber-100 border border-amber-300 inline-block" /> AO3400A V_th spread (0.65–1.45 V)
        </span>
      </div>
    </section>
  );
};
