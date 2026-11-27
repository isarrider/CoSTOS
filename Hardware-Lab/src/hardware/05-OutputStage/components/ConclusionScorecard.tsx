export interface OutputScorecardRow {
  criterion: string;
  tc4427: string;
  revAH3: string;
  revBGemini: string;
}

export const OUTPUT_SCORECARD_ROWS: OutputScorecardRow[] = [
  {
    criterion: 'PWM Edge Speed (500 Hz, 3 m cable, <= 4.0 µs limit)',
    tc4427: 'PASS (0.34 µs via R9 into 1.1 nF SMBJ)',
    revAH3: 'MARGINAL (2.0–3.2 µs falling edge)',
    revBGemini: 'PASS (0.24 µs both edges — 16× margin)',
  },
  {
    criterion: 'Shoot-Through & 60 °C Boiler-Room Leakage',
    tc4427: 'PASS (internal deadtime)',
    revAH3: 'FAIL (~85 mA spike; Q6 leaks @ 12V/60°C)',
    revBGemini: 'PASS (0 mA Class-B deadband; Q8 hard-off)',
  },
  {
    criterion: '+12 V / +24 V Miswire on J2 PWM (Pump OFF)',
    tc4427: 'FAIL (TC4427 22V abs max; RB1 kills Pi)',
    revAH3: 'FAIL (Q7 outside R9 explodes! RB1 kills Pi)',
    revBGemini: 'WARN (Q6/Q7 & G6 safe; sustained 24V = 0.895 W in R9)',
  },
  {
    criterion: 'J2 PWM Dead Short to GND (100% Duty)',
    tc4427: 'MARGINAL (84 mA, 0.71 W in R9)',
    revAH3: 'MARGINAL (84 mA, 0.71 W in R9)',
    revBGemini: 'PASS (38.2 mA, 0.32 W SPICE — SOA safe)',
  },
  {
    criterion: 'Pi 5 Readback (RB1 GPIO6) @ +V_DRV = 9.21 V',
    tc4427: 'FAIL (3.74 V > 3.3 V, unclamped!)',
    revAH3: 'FAIL (3.74 V > 3.3 V, unclamped!)',
    revBGemini: 'PASS (2.36 V nominal; D18 clamped <= 3.60 V)',
  },
  {
    criterion: '+24 V Miswire on J2 FB1 (GPIO23, Pi OFF)',
    tc4427: 'FAIL (PESD5V0 clamps @ 6.8 V -> +3V3)',
    revAH3: 'FAIL (PESD5V0 clamps @ 6.8 V -> +3V3)',
    revBGemini: 'PASS (R12A∥B 2.35k Basic + D17 + D9 TL431 <= 3.68 V)',
  },
  {
    criterion: 'J4 REL1 Dead Short (+5V_REL to OUT, D25 Pop.)',
    tc4427: 'FAIL (>15 A surge -> Pi 5 reboot / Q2 weld)',
    revAH3: 'FAIL (>15 A surge -> Pi 5 reboot / Q2 weld)',
    revBGemini: 'PASS (123.2 mA via Q11 + R501A∥B 5.0 Ω Basic)',
  },
  {
    criterion: 'Inductive 67–100 mA Relay Coil Flyback (D6)',
    tc4427: 'MARGINAL (1N4148W 150 mA signal diode)',
    revAH3: 'MARGINAL (1N4148W 150 mA signal diode)',
    revBGemini: 'PASS (SS14 40 V 1 A Schottky; 5.31 V clamp)',
  },
  {
    criterion: 'JLCPCB Extended Feeder Fees (Live-Audited)',
    tc4427: '€11.20 (4 Extended parts)',
    revAH3: '€8.40 (SMBJ13A + PESD5V0 + MMBT3906)',
    revBGemini: '€0.00 (100% JLCPCB Basic — Tier 1+2 S8550, R9A+B, R12A∥B, C9 X7R)',
  },
];

export function OutputConclusionScorecard() {
  return (
    <div className="space-y-5">
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-emerald-950">
            Final Recommendation: Adopt Pump PWM &amp; D25-Matched Relay Stage Rev B
          </h3>
          <span className="text-xs font-mono font-bold text-emerald-800 bg-white border border-emerald-300 px-2.5 py-0.5 rounded">
            D25 REL1 SMD POP. · 123.2 mA LIMIT · ZERO SHOOT-THROUGH
          </span>
        </div>
        <p className="text-xs text-emerald-900 leading-relaxed">
          Moving the series protection resistor <strong>R9A+R9B (2×100 Ω 1206 Basic = 200 Ω, 500 mW)</strong> outside a{' '}
          <strong>Class-B complementary emitter-follower (Q6 MMBT3904 + Q7 S8550 Basic C105432)</strong> eliminates shoot-through by
          physics, delivers <strong>7.65 V</strong> PWM / <strong>2.36 V</strong> RB1 under D18 direct +5V_HAT (+V_DRV =
          9.21 V), achieves <strong>0.24 µs edges</strong> (16× margin at 500 Hz), and keeps Pi-OFF +3V3 ≤ 3.68 V on
          +24 V FB1 miswires via <strong>R12A∥R12B (2×4.7 kΩ Basic = 2.35 kΩ)</strong> + <strong>D9 TL431 Basic</strong>. Matching D25, all REL1 SMD parts (<strong>Q10–Q12, D6 SS14, D7 Green, R501A∥R501B = 5.0 Ω
          Basic</strong>) are factory-populated at <strong>€0.00 total feeder fees</strong> (123.2 mA short limit, 5.31 V
          flyback, 16.11 s watchdog cutoff); only the J4 2-pin THT terminal (+€0.15) is optional.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-900">
            3-Way Engineering Scorecard: Rev A TC4427 vs. Rev A H3 vs. Rev B (Gemini Version)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="py-2.5 px-3">Engineering Criterion</th>
                <th className="py-2.5 px-3">Rev A TC4427 Fallback</th>
                <th className="py-2.5 px-3">Rev A H3 Baseline</th>
                <th className="py-2.5 px-3 bg-emerald-900">Rev B (Gemini Version)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OUTPUT_SCORECARD_ROWS.map((row) => (
                <tr key={row.criterion} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{row.criterion}</td>
                  <td
                    className={`py-2.5 px-3 font-mono ${
                      row.tc4427.startsWith('FAIL')
                        ? 'text-rose-700 font-semibold'
                        : row.tc4427.startsWith('MARGINAL')
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {row.tc4427}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono ${
                      row.revAH3.startsWith('FAIL')
                        ? 'text-rose-700 font-semibold'
                        : row.revAH3.startsWith('MARGINAL')
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {row.revAH3}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-emerald-800 bg-emerald-50/60">
                    {row.revBGemini}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
