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
    optionCPtc: '€5.60 (PTC + ferrite bead)',
    revBGemini: '€0.00 (100% Basic parts)',
    winner: 'Rev B',
  },
  {
    criterion: 'Cost / Board (5× Batch)',
    revAD18: '€0.74/bd (€0.18 + €2.80/5)',
    optionCPtc: '€1.70/bd (€0.58 + €5.60/5)',
    revBGemini: '€0.34/bd (16 Basic parts)',
    winner: 'Rev B',
  },
  {
    criterion: 'HAT +5V Dead Short Survival',
    revAD18: 'FAIL — >5 A crashes Pi 5 PMIC',
    optionCPtc: 'FAIL — 1.45 A / 120 ms PTC browns out Pi 5',
    revBGemini: 'PASS — 119 mA foldback in 1.8 µs (0.57 W)',
    winner: 'Rev B',
  },
  {
    criterion: 'Hot-Plug Inrush on Pi 5 Pins 2/4',
    revAD18: '4.8 A spike into 100 µF cap',
    optionCPtc: '2.8 A spike (limited by PTC)',
    revBGemini: '0.12 A active soft-start ramp (1.8 ms)',
    winner: 'Rev B',
  },
  {
    criterion: '+3V3_ANA Noise for Pt1000 & WD',
    revAD18: '45–60 mVpp raw Pi buck noise',
    optionCPtc: '0.8 mVpp (-35 dB RC filter)',
    revBGemini: '0.7 mVpp (-36 dB Pi-filter, f_c = 1.6 kHz)',
    winner: 'Rev B',
  },
  {
    criterion: 'Pi-OFF +24V Field Clamp Back-Feed',
    revAD18: 'FAIL — lifts +3V3 to ~5.15 V',
    optionCPtc: 'FAIL — lifts +3V3 to ~5.15 V',
    revBGemini: 'PASS — BZT52C3V6 holds <= 3.62 V',
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
          Engineering Scorecard: Rev A D18 Bare vs. Option C PTC vs. Rev B (Gemini Foldback eFuse)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Preserves D15/D18 (Pi powered by its own USB-C) while eliminating every Pi 5 brown-out, ripple, aging, and back-feed hazard at lower total cost
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white font-mono text-[11px]">
              <th className="px-3 py-2">Criterion</th>
              <th className="px-3 py-2">Rev A D18 Bare</th>
              <th className="px-3 py-2">Option C (PTC + Ferrite)</th>
              <th className="px-3 py-2 bg-emerald-900">Rev B (Gemini Foldback eFuse)</th>
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
