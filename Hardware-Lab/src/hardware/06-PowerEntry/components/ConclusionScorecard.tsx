export interface PowerScorecardRow {
  criterion: string;
  revAD18: string;
  optionCPtc: string;
  revBGemini: string;
  winner: 'Rev B' | 'Tie';
}

export const POWER_SCORECARD_ROWS: PowerScorecardRow[] = [
  {
    criterion: 'JLCPCB Extended Feeder Fees',
    revAD18: '€2.80 (100 µF electrolytic)',
    optionCPtc: '€2.80 (R601 1.8 Ω C15545 Ext)',
    revBGemini: '€0.00 (100% Basic parts)',
    winner: 'Rev B',
  },
  {
    criterion: 'Cost / Board (5× Batch)',
    revAD18: '€0.74/bd (€0.18 + €2.80/5)',
    optionCPtc: '€0.90/bd (€0.34 + €2.80/5)',
    revBGemini: '€0.23/bd (12 Basic SMD parts)',
    winner: 'Rev B',
  },
  {
    criterion: 'Delivered +5V_HAT Voltage',
    revAD18: '5.045 V (direct copper)',
    optionCPtc: '4.78–4.96 V (0.09–0.27 V drop)',
    revBGemini: '5.045 V (+V_DRV = 9.19 V, 1W = 4.92 V)',
    winner: 'Rev B',
  },
  {
    criterion: 'Field Terminal Short Protection',
    revAD18: 'Local terminal limiters only',
    optionCPtc: '136.5 mA board eFuse (redundant)',
    revBGemini: 'PASS — REL1 123.2 mA · 1W 48 mA · J2 39 mA',
    winner: 'Rev B',
  },
  {
    criterion: '+3V3_ANA Noise for Pt1000 & WD',
    revAD18: '45–60 mVpp raw Pi buck noise',
    optionCPtc: '0.7 mVpp (−36.04 dB Pi-filter)',
    revBGemini: '0.7 mVpp (−36.04 dB @ 100 kHz)',
    winner: 'Rev B',
  },
  {
    criterion: 'Pi-OFF +24 V Field Clamp Back-Feed',
    revAD18: 'FAIL — lifts +3V3 to ~5.15 V',
    optionCPtc: 'PASS — D9 holds <= 3.68 V',
    revBGemini: 'PASS — Basic D9 TL431 (3.67 V) holds <= 3.68 V',
    winner: 'Rev B',
  },
  {
    criterion: '60 °C Boiler-Room Cap Lifetime',
    revAD18: '~4.2 yr electrolytic dry-out',
    optionCPtc: '>25 yr solid MLCC bank',
    revBGemini: '>25 yr solid 2× 22 µF 1206 X5R MLCC',
    winner: 'Rev B',
  },
];

export function PowerConclusionScorecard() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <h3 className="text-sm font-semibold text-slate-900">
          Engineering Scorecard: Rev A Bare vs. Dropped Foldback eFuse vs. Rev B Active (D18 Direct +5V)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Matches CoSTOS D18 (direct Pi +5V, zero eFuse drop, saves C15545 €2.80) while keeping solid 44 µF MLCC caps, −36.04 dB +3V3_ANA filtering, and D9 Pi-OFF clamping
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white font-mono text-[11px]">
              <th className="px-3 py-2">Criterion</th>
              <th className="px-3 py-2">Rev A D18 Bare</th>
              <th className="px-3 py-2">Dropped Foldback eFuse</th>
              <th className="px-3 py-2 bg-emerald-900">Rev B Active (D18 Direct +5V)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-[11.5px]">
            {POWER_SCORECARD_ROWS.map((r) => (
              <tr key={r.criterion} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-sans font-semibold text-slate-900">{r.criterion}</td>
                <td className="px-3 py-2 text-slate-600">{r.revAD18}</td>
                <td className="px-3 py-2 text-slate-600">{r.optionCPtc}</td>
                <td className="px-3 py-2 bg-emerald-50/50 text-emerald-900 font-semibold">{r.revBGemini}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
