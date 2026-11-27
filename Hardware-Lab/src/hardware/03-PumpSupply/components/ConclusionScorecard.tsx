import React from 'react';
import {
  PumpSimParams,
  PumpVerdict,
  buildPumpConclusion,
} from '../physics/model';

interface PumpConclusionScorecardProps {
  params: PumpSimParams;
  batchSize: 2 | 5;
}

const VERDICT_STYLE: Record<PumpVerdict, string> = {
  BETTER: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  EQUAL: 'bg-slate-100 text-slate-700 border-slate-200',
  WORSE: 'bg-rose-50 text-rose-800 border-rose-200',
};

export const PumpConclusionScorecard: React.FC<PumpConclusionScorecardProps> = ({
  params,
  batchSize,
}) => {
  const summary = buildPumpConclusion(params, batchSize);

  return (
    <section
      id="pump-conclusion"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-700">
            Final Engineering Conclusion
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            B0512S (Rev A) vs. Claude D25 (Rev C) vs. Gemini Version (Rev E)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Direct verdict across all {summary.rows.length} cost, voltage-margin, reliability, and fail-safe criteria (verdict badges score{' '}
            <span className="font-mono text-slate-800">Gemini Rev E vs. Claude D25</span> at {batchSize}× JLCPCB batch).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-center">
            <div className="text-lg font-semibold text-emerald-800 leading-none">
              {summary.betterCount}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-1">
              Better
            </div>
          </div>
          <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-center">
            <div className="text-lg font-semibold text-slate-800 leading-none">
              {summary.equalCount}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mt-1">
              Equal
            </div>
          </div>
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-md text-center">
            <div className="text-lg font-semibold text-rose-800 leading-none">
              {summary.worseCount}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 mt-1">
              Worse
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4 w-32">Domain</th>
              <th className="py-3 px-4 w-48">Aspect</th>
              <th className="py-3 px-4 w-44">Original (B0512S)</th>
              <th className="py-3 px-4 w-44">Claude D25 (Rev C)</th>
              <th className="py-3 px-4 w-48">Gemini Version (Rev E)</th>
              <th className="py-3 px-3 text-center w-24">vs D25</th>
              <th className="py-3 px-4">Engineering Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs align-top">
            {summary.rows.map((row) => (
              <tr key={row.aspect} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  {row.category}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-900">{row.aspect}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{row.b0512sValue}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{row.d25Value}</td>
                <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                  {row.revDValue}
                </td>
                <td className="py-3 px-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider border rounded ${
                      VERDICT_STYLE[row.verdictVsD25]
                    }`}
                  >
                    {row.verdictVsD25}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700 leading-relaxed">{row.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-blue-50/60 border-t border-slate-200">
        <p className="text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold text-slate-900">Bottom Line: </span>
          {summary.takeaway}
        </p>
      </div>
    </section>
  );
};
