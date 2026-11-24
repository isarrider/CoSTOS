import { ONEWIRE_TOPOLOGY_SPECS, oneWirePerBoardCostEur } from '../physics/model';

interface Props {
  batchSize: 2 | 5;
}

export const ONEWIRE_SCORECARD_ROWS = [
  {
    criterion: 'Boiler-Room Cable Reach (LiYCY 75 pF/m, 5× DS18B20)',
    revA: 'FAIL (~22 m max · 4.7 kΩ @ 3.3 V)',
    revB: 'PASS (~60 m max · 2.2 kΩ @ 5 V)',
    ds2482: 'BEST (>85 m · Active Pull-Up)',
  },
  {
    criterion: 'High-Side EMI Noise Margin (above 2.2 V V_IH)',
    revA: '1.10 V (weak near 230 V pumps)',
    revB: '2.80 V (2.5× higher immunity)',
    ds2482: '2.80 V (2.5× higher immunity)',
  },
  {
    criterion: 'Bus A / Bus B Independence on VDD Dead Short',
    revA: 'FAIL (shared F2 kills BOTH buses)',
    revB: 'PASS (per-bus 47 mA, 0.22 W)',
    ds2482: 'PASS (with per-bus SS14+100 Ω)',
  },
  {
    criterion: 'Pi 3.3 V GPIO Safety (+V_DRV 8.5 V / +12 V on DQ)',
    revA: 'FAIL (30–38 mA into Pi GPIO)',
    revB: 'PASS (2N7002 OFF · GPIO 3.30 V)',
    ds2482: 'PASS (with external clamp)',
  },
  {
    criterion: 'Pi Rail Safety (+12 V / +24 V Reverse-Feed on VDD)',
    revA: 'FAIL (kills Pi +3V3 PMIC)',
    revB: 'PASS (SS14 blocks up to 40 V)',
    ds2482: 'PASS (with external SS14)',
  },
  {
    criterion: 'Pi 5 RP1 Linux Driver & Jitter Resilience',
    revA: 'Marginal (slow RC edge + jitter)',
    revB: 'PASS (fast 5 V edge + w1-gpio-pi5)',
    ds2482: 'BEST (hardware I²C master)',
  },
  {
    criterion: 'JLCPCB SMT Availability & Feeder Fees',
    revA: '2 Extended (€5.60 fee · SOD-882)',
    revB: '100% Basic (€0.00 fee · 7/8 shared)',
    ds2482: 'NOT at LCSC (manual solder / €5.60+)',
  },
];

export function OneWireConclusionScorecard({ batchSize }: Props) {
  const revACost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.rev_a_baseline, batchSize);
  const revBCost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.gemini_rev_b_2n7002, batchSize);
  const dsCost = oneWirePerBoardCostEur(ONEWIRE_TOPOLOGY_SPECS.ds2482_i2c_bridge, batchSize);

  return (
    <section id="onewire-conclusion" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-700">
          Engineering Decision Matrix · Subsystem 04
        </div>
        <h2 className="text-base font-semibold text-slate-900 mt-0.5">
          3-Way 1-Wire Scorecard: Rev A Baseline vs. Rev B (Gemini) vs. DS2482 I²C Bridge
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Direct comparison across cable reach, 230 V boiler-room noise immunity, miswiring survivability, Raspberry Pi 5 compatibility, and JLCPCB manufacturing cost ({batchSize}× batch).
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Engineering Criterion</th>
                <th className="py-2.5 px-3.5">Rev A Baseline (3.3 V)</th>
                <th className="py-2.5 px-3.5 bg-cyan-950">Rev B · Gemini (5 V Basic)</th>
                <th className="py-2.5 px-3.5">DS2482 I²C Bridge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {ONEWIRE_SCORECARD_ROWS.map((r) => (
                <tr key={r.criterion} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900">{r.criterion}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[11.5px] text-rose-800">{r.revA}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[11.5px] font-semibold text-emerald-800 bg-emerald-50/40">
                    {r.revB}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-[11.5px] text-slate-700">{r.ds2482}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-mono font-semibold text-xs">
                <td className="py-2.5 px-3.5 font-sans text-slate-900">
                  Per-Board Cost ({batchSize}× JLCPCB Batch, Both Buses)
                </td>
                <td className="py-2.5 px-3.5 text-slate-700 tabular-nums">€{revACost.toFixed(2)} / bd</td>
                <td className="py-2.5 px-3.5 text-emerald-800 bg-emerald-50/60 tabular-nums">
                  €{revBCost.toFixed(2)} / bd (Saves €{(revACost - revBCost).toFixed(2)})
                </td>
                <td className="py-2.5 px-3.5 text-slate-700 tabular-nums">€{dsCost.toFixed(2)} / bd</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-md p-4 text-xs text-emerald-950 leading-relaxed">
          <span className="font-semibold">Final Recommendation — Adopt 1-Wire Rev B (Gemini Version):</span> Moving the field cables to <span className="font-mono font-semibold">5 V</span> via diode-biased Basic <span className="font-mono font-semibold">2N7002 (Q19/Q20)</span> + per-bus <span className="font-mono font-semibold">SS14 + 100 Ω 0.5 W</span> fixes all six Rev A defects simultaneously, stretches cable reach from 22 m to 60 m, makes both buses completely independent and Pi-safe against +12 V/+24 V miswires, and <span className="font-semibold">cuts JLCPCB feeder fees from €5.60 to €0.00</span>. Keep optional unpopulated <span className="font-mono">U10 (DS2482-100)</span> pads on I²C1 only as a free insurance policy for extreme &gt;80 m installations.
        </div>
      </div>
    </section>
  );
}
