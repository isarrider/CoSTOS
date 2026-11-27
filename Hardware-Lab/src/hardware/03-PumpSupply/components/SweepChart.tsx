import React, { useMemo, useState } from 'react';
import { PumpSimParams, computePumpVoltageSweep } from '../physics/model';

interface PumpVoltageSweepChartProps {
  params: PumpSimParams;
}

const SERIES = [
  { key: 'b0512sV' as const, label: 'B0512S 12V', color: '#64748b', dash: undefined, width: 1.7 },
  { key: 'mt3608V' as const, label: 'MT3608 10V', color: '#ea580c', dash: '5 3', width: 1.7 },
  { key: 'revDV' as const, label: 'LM393+SS14 Rev E (Gemini)', color: '#059669', dash: undefined, width: 2.6 },
  { key: 'd25V' as const, label: 'Claude D25', color: '#2563eb', dash: undefined, width: 2.0 },
  { key: 'direct5vV' as const, label: 'Direct 5V', color: '#e11d48', dash: '3 3', width: 1.6 },
];

export const PumpVoltageSweepChart: React.FC<PumpVoltageSweepChartProps> = ({ params }) => {
  const [hoverPiV, setHoverPiV] = useState<number | null>(null);
  const data = useMemo(() => computePumpVoltageSweep(params), [params]);

  const width = 760;
  const height = 290;
  const pad = { top: 20, right: 24, bottom: 38, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const minX = 4.2;
  const maxX = 5.25;
  const minY = 2.5;
  const maxY = 11.5;

  const xScale = (v: number) => pad.left + ((v - minX) / (maxX - minX)) * plotW;
  const yScale = (v: number) => {
    const clamped = Math.max(minY, Math.min(maxY, v));
    return pad.top + ((maxY - clamped) / (maxY - minY)) * plotH;
  };

  const buildPath = (key: (typeof SERIES)[number]['key']) =>
    data
      .map(
        (pt, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${xScale(pt.piV).toFixed(1)} ${yScale(pt[key]).toFixed(1)}`
      )
      .join(' ');

  const inspectedV = hoverPiV ?? params.piSupplyV;
  const closest = data.reduce((prev, curr) =>
    Math.abs(curr.piV - inspectedV) < Math.abs(prev.piV - inspectedV) ? curr : prev
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const v = minX + ((relX - pad.left) / plotW) * (maxX - minX);
    if (v >= minX && v <= maxX) {
      setHoverPiV(Math.round(v * 20) / 20);
    } else {
      setHoverPiV(null);
    }
  };

  const xTicks = [4.2, 4.4, 4.63, 4.8, 5.0, 5.25];
  const yTicks = [3, 4, 6, 8, 10, 11];

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Pump Terminal High Voltage vs. Pi +5 V Rail Sag (4.20 V → 5.25 V)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Active load: {params.pumpCount}×{' '}
            {params.loadProfile === 'stress' ? 'Grundfos Stress (470 Ω)' : 'Normal Pump (2.2 kΩ)'} ·{' '}
            {params.ambientTempC} °C boiler room · {params.pwmDutyPct}% PWM duty
          </p>
        </div>
        <div className="text-xs font-mono text-rose-700 font-semibold">
          Wilo / Grundfos Minimum High: 4.00 V
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPiV(null)}
        role="img"
        aria-label="Pump terminal voltage across Raspberry Pi 5V rail sag from 4.20V to 5.25V"
      >
        {/* Fail zone below 4.0 V */}
        <rect
          x={pad.left}
          y={yScale(4.0)}
          width={plotW}
          height={Math.max(0, height - pad.bottom - yScale(4.0))}
          fill="#e11d48"
          fillOpacity={0.07}
        />

        {/* Horizontal Y gridlines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={yScale(tick)}
              x2={width - pad.right}
              y2={yScale(tick)}
              stroke={tick === 4 ? '#e11d48' : '#e2e8f0'}
              strokeWidth={tick === 4 ? 1.6 : 1}
              strokeDasharray={tick === 4 ? '6 3' : undefined}
            />
            <text
              x={pad.left - 8}
              y={yScale(tick) + 3.5}
              textAnchor="end"
              className={`text-[10px] font-mono tabular-nums ${
                tick === 4 ? 'fill-rose-700 font-semibold' : 'fill-slate-500'
              }`}
            >
              {tick} V
            </text>
          </g>
        ))}

        <text
          x={width - pad.right - 4}
          y={yScale(4.0) - 5}
          textAnchor="end"
          className="fill-rose-700 text-[9.5px] font-mono font-semibold"
        >
          4.00 V Min Pump High Floor (Below = Fail)
        </text>

        {/* X gridlines & 4.63 V Pi UV line */}
        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={xScale(tick)}
              y1={pad.top}
              x2={xScale(tick)}
              y2={height - pad.bottom}
              stroke={tick === 4.63 ? '#d97706' : '#f1f5f9'}
              strokeWidth={tick === 4.63 ? 1.2 : 1}
              strokeDasharray={tick === 4.63 ? '4 3' : undefined}
            />
            <text
              x={xScale(tick)}
              y={height - pad.bottom + 16}
              textAnchor="middle"
              className={`text-[10px] font-mono tabular-nums ${
                tick === 4.63 ? 'fill-amber-700 font-semibold' : 'fill-slate-500'
              }`}
            >
              {tick.toFixed(2)}V
            </text>
          </g>
        ))}

        <text
          x={xScale(4.63) + 4}
          y={pad.top + 11}
          className="fill-amber-700 text-[9px] font-mono font-semibold"
        >
          Pi UV Flag (4.63 V)
        </text>

        {/* Topology curves */}
        {SERIES.map((s) => (
          <path
            key={s.key}
            d={buildPath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
          />
        ))}

        {/* Active slider Pi supply line */}
        <line
          x1={xScale(params.piSupplyV)}
          y1={pad.top}
          x2={xScale(params.piSupplyV)}
          y2={height - pad.bottom}
          stroke="#0f172a"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* Inspected crosshair */}
        <line
          x1={xScale(closest.piV)}
          y1={pad.top}
          x2={xScale(closest.piV)}
          y2={height - pad.bottom}
          stroke="#2563eb"
          strokeWidth={1}
          strokeOpacity={0.45}
        />
        <circle
          cx={xScale(closest.piV)}
          cy={yScale(closest.revDV)}
          r={4.2}
          fill="#059669"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <circle
          cx={xScale(closest.piV)}
          cy={yScale(closest.d25V)}
          r={3.8}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </svg>

      {/* Live Crosshair HUD & Legend */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-3 text-slate-700">
          <span>
            Pi +5V: <strong className="text-slate-900">{closest.piV.toFixed(2)} V</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">|</span>
          <span className="text-emerald-800">
            Rev E (Gemini): <strong>{closest.revDV.toFixed(2)} V</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">|</span>
          <span className="text-blue-700">
            D25: <strong>{closest.d25V.toFixed(2)} V</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">|</span>
          <span className="text-slate-600">
            B0512S: <strong>{closest.b0512sV.toFixed(2)} V</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">|</span>
          <span className="text-rose-700">
            5V Dir: <strong>{closest.direct5vV.toFixed(2)} V</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="inline-block w-3 h-0.5"
                style={{
                  backgroundColor: s.dash ? 'transparent' : s.color,
                  borderTop: s.dash ? `2px dashed ${s.color}` : undefined,
                }}
              />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
