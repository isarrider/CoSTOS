import React, { useMemo, useState } from 'react';
import {
  SimulationParams,
  TOPOLOGY_SPECS,
  TopologyId,
  computeErrorSweep,
} from '../physics/model';

interface ErrorSweepChartProps {
  topologyId: TopologyId;
  params: SimulationParams;
}

export const ErrorSweepChart: React.FC<ErrorSweepChartProps> = ({ topologyId, params }) => {
  const [showBaselineOverlay, setShowBaselineOverlay] = useState(true);
  const [hoverTemp, setHoverTemp] = useState<number | null>(null);

  const sweep = useMemo(() => computeErrorSweep(topologyId, params), [topologyId, params]);
  const baselineSweep = useMemo(
    () => (topologyId === 'max31865' ? [] : computeErrorSweep('max31865', params)),
    [topologyId, params]
  );

  // Chart dimensions
  const width = 760;
  const height = 290;
  const pad = { top: 20, right: 24, bottom: 38, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Dynamic symmetric Y scale (at least +/- 2.5 K)
  const maxAbs = useMemo(() => {
    let peak = 2.5;
    for (const p of sweep) {
      peak = Math.max(peak, Math.abs(p.upperBoundK), Math.abs(p.lowerBoundK));
    }
    return Math.min(12, Math.ceil(peak * 1.15 * 2) / 2);
  }, [sweep]);

  const xScale = (t: number) => pad.left + ((t - -50) / 300) * plotW;
  const yScale = (err: number) => {
    const clamped = Math.max(-maxAbs, Math.min(maxAbs, err));
    return pad.top + ((maxAbs - clamped) / (2 * maxAbs)) * plotH;
  };

  const nominalPath = sweep
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.tempC).toFixed(1)} ${yScale(p.errorK).toFixed(1)}`)
    .join(' ');

  const baselinePath = baselineSweep
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.tempC).toFixed(1)} ${yScale(p.errorK).toFixed(1)}`)
    .join(' ');

  const envelopePath =
    sweep
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.tempC).toFixed(1)} ${yScale(p.upperBoundK).toFixed(1)}`)
      .join(' ') +
    ' ' +
    [...sweep]
      .reverse()
      .map((p) => `L ${xScale(p.tempC).toFixed(1)} ${yScale(p.lowerBoundK).toFixed(1)}`)
      .join(' ') +
    ' Z';

  const inspectedTemp = hoverTemp ?? params.collectorTempC;
  const closestPoint = sweep.reduce((prev, curr) =>
    Math.abs(curr.tempC - inspectedTemp) < Math.abs(prev.tempC - inspectedTemp) ? curr : prev
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const t = -50 + ((relX - pad.left) / plotW) * 300;
    if (t >= -50 && t <= 250) {
      setHoverTemp(Math.round(t / 5) * 5);
    } else {
      setHoverTemp(null);
    }
  };

  const yTicks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const xTicks = [-50, 0, 50, 100, 130, 150, 200, 250];

  return (
    <section
      id="sweep"
      className="bg-white border border-slate-200 rounded-lg p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Full-Range Measurement Error Sweep (−50 °C to +250 °C)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Solid line shows modeled ΔT error; shaded band shows worst-case resistor, offset, and jitter tolerance.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {topologyId !== 'max31865' && (
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBaselineOverlay}
                onChange={(e) => setShowBaselineOverlay(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Overlay MAX31865 baseline</span>
            </label>
          )}
          <span className="font-mono tabular-nums text-slate-600">
            Target: ±1.0 K
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverTemp(null)}
          role="img"
          aria-label={`Error curve for ${TOPOLOGY_SPECS[topologyId].shortName} from -50 to +250 degrees Celsius`}
        >
          {/* +/- 1.0 K CoSTOS target band */}
          <rect
            x={pad.left}
            y={yScale(1.0)}
            width={plotW}
            height={Math.max(0, yScale(-1.0) - yScale(1.0))}
            fill="#10b981"
            fillOpacity={0.07}
          />
          <line
            x1={pad.left}
            y1={yScale(1.0)}
            x2={width - pad.right}
            y2={yScale(1.0)}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="4 4"
            strokeOpacity={0.65}
          />
          <line
            x1={pad.left}
            y1={yScale(-1.0)}
            x2={width - pad.right}
            y2={yScale(-1.0)}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="4 4"
            strokeOpacity={0.65}
          />

          {/* Horizontal Y gridlines */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                y1={yScale(tick)}
                x2={width - pad.right}
                y2={yScale(tick)}
                stroke={tick === 0 ? '#94a3b8' : '#e2e8f0'}
                strokeWidth={tick === 0 ? 1.2 : 1}
              />
              <text
                x={pad.left - 8}
                y={yScale(tick) + 3.5}
                textAnchor="end"
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {tick > 0 ? `+${tick.toFixed(1)}` : tick.toFixed(1)} K
              </text>
            </g>
          ))}

          {/* X gridlines & 130C stagnation threshold */}
          {xTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={xScale(tick)}
                y1={pad.top}
                x2={xScale(tick)}
                y2={height - pad.bottom}
                stroke={tick === 130 ? '#d97706' : '#f1f5f9'}
                strokeWidth={1}
                strokeDasharray={tick === 130 ? '3 3' : undefined}
              />
              <text
                x={xScale(tick)}
                y={height - pad.bottom + 16}
                textAnchor="middle"
                className={`text-[10px] font-mono tabular-nums ${
                  tick === 130 ? 'fill-amber-700 font-semibold' : 'fill-slate-500'
                }`}
              >
                {tick}°C
              </text>
            </g>
          ))}

          <text
            x={xScale(130) + 4}
            y={pad.top + 11}
            className="fill-amber-700 text-[9px] font-mono"
          >
            130°C Shutdown
          </text>

          {/* Worst-case tolerance envelope */}
          <path d={envelopePath} fill="#2563eb" fillOpacity={0.13} />

          {/* Baseline MAX31865 comparison line */}
          {showBaselineOverlay && topologyId !== 'max31865' && (
            <path
              d={baselinePath}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          )}

          {/* Active topology nominal curve */}
          <path d={nominalPath} fill="none" stroke="#2563eb" strokeWidth={2.2} />

          {/* Active operating collector temperature marker */}
          <line
            x1={xScale(params.collectorTempC)}
            y1={pad.top}
            x2={xScale(params.collectorTempC)}
            y2={height - pad.bottom}
            stroke="#0f172a"
            strokeWidth={1}
            strokeDasharray="2 2"
          />

          {/* Hover / inspected crosshair point */}
          <line
            x1={xScale(closestPoint.tempC)}
            y1={pad.top}
            x2={xScale(closestPoint.tempC)}
            y2={height - pad.bottom}
            stroke="#2563eb"
            strokeWidth={1}
            strokeOpacity={0.45}
          />
          <circle
            cx={xScale(closestPoint.tempC)}
            cy={yScale(closestPoint.errorK)}
            r={4.5}
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </svg>

        {/* Live Monospace Crosshair HUD */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <span>
              T_true: <strong className="text-slate-900">{closestPoint.tempC} °C</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <span>
              R_Pt1000: <strong className="text-slate-900">{closestPoint.resistanceOhm.toFixed(1)} Ω</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <span>
              Nominal ΔT:{' '}
              <strong className="text-blue-700">
                {closestPoint.errorK >= 0 ? '+' : ''}
                {closestPoint.errorK.toFixed(2)} K
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <span>
              Worst-Case Bound:{' '}
              <strong className="text-slate-900">
                [{closestPoint.lowerBoundK.toFixed(2)} K … +{closestPoint.upperBoundK.toFixed(2)} K]
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-blue-600" />
              <span>{TOPOLOGY_SPECS[topologyId].shortName}</span>
            </span>
            {showBaselineOverlay && topologyId !== 'max31865' && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 border-t border-dashed border-slate-500" />
                <span>MAX31865</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
