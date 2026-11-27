import React from 'react';
import { WATCHDOG_TOPOLOGY_SPECS, watchdogPerBoardCostEur } from '../physics/model';

interface WatchdogConclusionScorecardProps {
  batchSize: 2 | 5;
}

export const WatchdogConclusionScorecard: React.FC<WatchdogConclusionScorecardProps> = ({
  batchSize,
}) => {
  const origCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS['74lvc1g123'], batchSize);
  const d24Cost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.d24_cap_pump, batchSize);
  const gemCost = watchdogPerBoardCostEur(WATCHDOG_TOPOLOGY_SPECS.u3b_schmitt_wd, batchSize);

  const rows = [
    {
      metric: `Cost / Board (${batchSize}× batch, incl. JLCPCB fees)`,
      orig: `€${origCost.toFixed(2)} (€5.60 fee)`,
      d24: `€${d24Cost.toFixed(2)} (€0.00 fee)`,
      gem: `€${gemCost.toFixed(2)} (100% JLCPCB Basic · €0.00 Ext; Q15 S8550 C105432)`,
      winner: 'gem',
    },
    {
      metric: 'Runaway 2 kHz Loop Rejection (Window)',
      orig: 'FAIL — Retriggers forever',
      d24: 'PASS — R48/C16 LPF cuts off',
      gem: 'PASS — 1 kHz max 0.745 V (+5V_REL = 2.2 µV, SPICE)',
      winner: 'gem',
    },
    {
      metric: 'Relay Cutoff Edge (Contact Arcing Risk)',
      orig: 'PASS — < 20 ns digital',
      d24: 'POOR — 1.8 s linear brown-out',
      gem: 'PASS — < 5 µs snap (0.61 V / 0.75 V hyst)',
      winner: 'gem',
    },
    {
      metric: 'Timeout & Self-Test Ordering (Unscaled SPICE)',
      orig: '3.0 s fixed (no GPIO20 readback)',
      d24: '5.0–14.0 s (up to 8 s Q14/Q13 blind spot)',
      gem: '16.11 s Q12 Relay / 18.42 s Pump+RB (relay cuts first)',
      winner: 'gem',
    },
    {
      metric: 'Linux Stall Ride-Through (5 s & 10 s)',
      orig: 'FAIL — Trips at 3.0 s',
      d24: 'BORDERLINE — +30 mV @ 5 s (trips @ 10 s)',
      gem: 'PASS — +753 mV @ 5 s · +334 mV @ 10 s',
      winner: 'gem',
    },
    {
      metric: '60 °C Humid Boiler-Room Flux Sensitivity',
      orig: 'Low (active IC)',
      d24: 'High (1.1 MΩ node → −34% τ shift)',
      gem: 'Low (500 kΩ node · 11.8–13.6 s @ 60 °C)',
      winner: 'gem',
    },
    {
      metric: 'Single-Fault Dual-Channel Independence',
      orig: 'POOR — IC Q stuck high keeps both ON',
      d24: 'GOOD — No shared IC above Q5 & Q13',
      gem: 'PASS — Separate U4A (Relay) & U4B (Pump) outputs',
      winner: 'gem',
    },
  ];

  return (
    <section
      id="wd-conclusion"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70">
        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-emerald-700">
          3-Way Engineering Verdict · Watchdog &amp; Relay Supply
        </div>
        <h2 className="text-base font-semibold text-slate-900 mt-0.5">
          Original 74LVC1G123 vs. Claude D24 Passive Pump vs. Gemini Rev B (Dedicated U4 Dual-Schmitt)
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-4xl">
          Giving the Hardware Watchdog its own dedicated LM393DR2G (U4, C7955 Basic, shared reel with Pt1000 U1 &amp; Pump U3) eliminates 60 kHz cross-talk from Pump U3A, provides two independent Schmitt output stages (U4A → factory-populated Q12 Relay per D25 + U4B → Pump/GPIO20), deletes Q13 &amp; Q14, and pairs 2× 22 µF 25 V 1206 (C12891 Basic) with 500 kΩ bleed to survive 10 s Linux stalls (16.11 s / 18.42 s unscaled TI LM393 SPICE).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-4 font-semibold">Engineering Criterion</th>
              <th className="py-2.5 px-4 font-semibold">Original (74LVC1G123 + TPS22918)</th>
              <th className="py-2.5 px-4 font-semibold">Claude D24 Passive Pump</th>
              <th className="py-2.5 px-4 font-semibold text-emerald-800 bg-emerald-50/50">
                Gemini Rev B (Dedicated U4)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.metric} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-medium text-slate-900">{r.metric}</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">{r.orig}</td>
                <td
                  className={`py-2.5 px-4 font-mono ${
                    r.winner === 'd24' ? 'text-emerald-800 font-semibold bg-emerald-50/30' : 'text-amber-900'
                  }`}
                >
                  {r.d24}
                </td>
                <td
                  className={`py-2.5 px-4 font-mono ${
                    r.winner === 'gem'
                      ? 'text-emerald-800 font-semibold bg-emerald-50/40'
                      : 'text-slate-700 bg-emerald-50/20'
                  }`}
                >
                  {r.gem}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-emerald-50/40 border-t border-emerald-200 text-xs text-slate-800 leading-relaxed">
        <span className="font-semibold text-emerald-900">Honest Engineering Decision: </span>
        Use <span className="font-mono font-semibold text-emerald-900">Rev B (Dedicated U4 LM393DR2G Dual-Schmitt)</span>. Dedicating U4 (C7955 Basic) decouples the watchdog from Pump U3A&apos;s 60 kHz switcher, restores true dual-channel single-fault independence (U4A → D25 populated Q12 Relay vs U4B → Pump/GPIO20), deletes Q14 by keeping U4B natively in the +3.3 V Pi domain, and achieves 16.11 s Relay / 18.42 s Pump+RB cutoffs in unscaled 36 s TI LM393 SPICE (1 kHz runaway rejected at 0.745 V). With Tier 2 Q15 = S8550 (C105432 Basic, shared with Tab 05 Q7/Q8), this entire subsystem is 100% JLCPCB Basic (€0.00 Extended fees). Keep the mandatory boot-time cutoff self-test (stop HB, verify GPIO20 HIGH &lt; 25 s).
      </div>
    </section>
  );
};
