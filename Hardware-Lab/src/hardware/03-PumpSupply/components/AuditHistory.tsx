import React from 'react';

export interface PumpRevisionEntry {
  rev: 'Rev A' | 'Rev B' | 'Rev C' | 'Rev D' | 'Rev E';
  title: string;
  status: 'Superseded' | 'Production Baseline';
  costSnapshot: string;
  architecture: string;
  findings: string[];
  resolution: string;
}

export interface PumpAuditFixRow {
  id: string;
  area: string;
  revCFlaw: string;
  revDFix: string;
  verifiedImpact: string;
}

export const PUMP_REVISION_HISTORY: PumpRevisionEntry[] = [
  {
    rev: 'Rev A',
    title: 'B0512S-1WR3 Isolated 5 V → 12 V DC/DC Brick (Original HAT)',
    status: 'Superseded',
    costSnapshot: '€2.58/bd @ 2× (€1.18 + €2.80 fee)',
    architecture:
      'SIP-4 1 W isolated DC/DC module generating 12 V for the H3 pump driver with 1.2 kΩ preload R2 and R9 = 470 Ω.',
    findings: [
      'Incurred €2.80 JLCPCB Extended/THT fee + €1.05 module cost on every prototype batch.',
      'Galvanic isolation barrier was completely unused because the H3 driver tied 0V_OUT straight to Pi GND.',
      'Unregulated output climbed toward 14–16 V at light load without a permanent 10 mA preload resistor R2.',
    ],
    resolution:
      'Prompted exploration of zero-fee 5 V direct (1-Wire Lite) and discrete charge-pump alternatives.',
  },
  {
    rev: 'Rev B',
    title: 'Direct Pi +5 V Rail — 1-Wire Lite (No Voltage Lift)',
    status: 'Superseded',
    costSnapshot: '€0.01/bd · €0.00 fee · 1 jumper',
    architecture:
      'Fed H3 pump driver directly from Pi +5 V via a 0 Ω link R26 to eliminate B0512S cost and THT assembly.',
    findings: [
      'Output sat at 4.80 V nominal and dropped to 4.09 V under 10 mA Grundfos stress + 4.63 V Pi under-voltage (0.09 V margin!).',
      'Dropped below the 4.0 V Wilo/Grundfos minimum high threshold on weak USB cables or cold silicon drops.',
      'Forced high-capacitance SMBJ6.0A (3.85 nF), slowing PWM switching edges.',
    ],
    resolution:
      'Retired 1-Wire Lite in D25; replaced with a discrete basic-part voltage doubler.',
  },
  {
    rev: 'Rev C',
    title: 'Claude D25 4-BJT Astable Voltage Doubler (GitHub HAT-1wire.md)',
    status: 'Superseded',
    costSnapshot: '€0.11/bd · €0.00 fee · 14 parts',
    architecture:
      'Two-BJT astable oscillator (Q15/Q16, ~15 kHz) + Q17/Q18 emitter followers + 2× 1N4148W silicon diodes into C22 (2.2 µF) / C23 (10 µF).',
    findings: [
      '2× 1N4148W silicon diodes threw away ~1.50 V of pump voltage (vs ~0.56 V for Basic SS14 Schottkys).',
      'High output impedance (~86 Ω @ 15 kHz / 2.2 µF) works for 1 pump (6.66 V) but collapses below 4.0 V if PUMP1 + PUMP2 run simultaneously at stress + 4.63 V UV.',
      'Matched-reel Q15/Q16 astable multivibrators can lock up (both saturated, 0 Hz) on slow USB-C power ramps.',
      'Q15/Q16 base-emitter junctions swing to −4.5 V every cycle (near −6.0 V V_EBO abs max), risking h_FE degradation over 10+ years of 24/7 boiler-room service.',
    ],
    resolution:
      'Upgraded oscillator, pump capacitor, and rectifier diodes using 100% JLCPCB Basic parts in Rev D.',
  },
  {
    rev: 'Rev D',
    title: 'LM393 Dual-Stage (U3A Osc + U3B Buffer) + SS14 Doubler (17-Part Draft)',
    status: 'Superseded',
    costSnapshot: '€0.19/bd · €0.00 fee · 17 parts',
    architecture:
      'Replaced D25’s BJT astable and 1N4148W diodes with LM393DR U3A (41 kHz Schmitt osc) + U3B buffer (R60 = 470 Ω pull-up) + Q17/Q18 + 2× SS14 Schottkys + C22 (4.7 µF).',
    findings: [
      'Datasheet check caught R60 = 470 Ω demanding 11.2 mA sink at 5.25 V—exceeding LM393’s 6 mA min sink / 4 mA V_OL ≤ 0.4 V guarantee.',
      'Dedicated U3B buffer stage added 3 extra resistors (R57a, R57b, R60) and ~3.5 mA idle draw despite Q17/Q18 already buffering the load.',
      'R58 = 22 kΩ introduced an unshared resistor reel instead of reusing rescaled H3 R31 (15 kΩ).',
    ],
    resolution:
      'Fixed LM393 sink current (R59 = 1.5 kΩ), dropped redundant U3B buffer, and consolidated R58 = 15 kΩ in Rev E (Gemini Version).',
  },
  {
    rev: 'Rev E',
    title: 'Gemini Version — 14-Part LM393 (U3A) + SS14 Schottky Doubler (Current)',
    status: 'Production Baseline',
    costSnapshot: '€0.18/bd · €0.00 fee · 14 parts',
    architecture:
      'Single LM393DR comparator U3A (60 kHz Schmitt osc, R58 = 15 kΩ shared w/ R31, R59 = 1.5 kΩ datasheet-safe pull-up; U3B cleanly tied off) driving Q17/Q18 + 2× SS14 Basic Schottkys (C2480) + C22 (4.7 µF) / C23 (10 µF).',
    findings: [
      'Recovers +0.95 V immediately via SS14 Schottkys: ~7.70 V at 1 normal pump (+3.70 V margin above 4.0 V).',
      '60 kHz + 4.7 µF + 1.5 kΩ pull-up cuts R_out >3× (~31 Ω): passes PUMP1 + PUMP2 at 10 mA stress + 4.63 V Pi UV (~5.63 V at pump).',
      'Datasheet-safe R59 = 1.5 kΩ caps U3A sink current to 3.50 mA @ 5.25 V (<4 mA V_OL guarantee) while dropping U3B trims count to 14 parts (= D25!).',
      'R58 = 15 kΩ shares the exact Basic reel as rescaled H3 R31 (15 kΩ / 8.2 kΩ → ≤3.12 V max, 1.41 V dead-osc LOW).',
    ],
    resolution:
      'Exact same 14-part count as D25 (€0.18/bd, €0.00 fee, saves €2.40/bd vs B0512S @ 2×), 0 GPIOs used, verified across simulator, KiCad BOM, and PDF.',
  },
];

export const PUMP_D25_TO_REVD_FIXES: PumpAuditFixRow[] = [
  {
    id: 'PAUD-01',
    area: 'Silicon Diode Voltage Loss',
    revCFlaw: '2× 1N4148W silicon diodes drop ~1.50 V total, capping +V_DRV at ~6.9 V.',
    revDFix: 'Replaced with 2× SS14 (1 A 40 V Basic Schottky, C2480, Vf ≈ 0.28 V).',
    verifiedImpact: '+0.95 V recovered (~7.70 V @ 1 normal pump; +3.70 V above 4.0 V floor).',
  },
  {
    id: 'PAUD-02',
    area: '2-Pump Load Sag (R_out)',
    revCFlaw: '15 kHz + 2.2 µF + R55 1k gave R_out ≈ 108 Ω; 2× stress @ 4.63 V UV collapsed <4.0 V (FAIL).',
    revDFix: 'Raised osc to 60 kHz (R58 = 15 kΩ, C20 = 1 nF), bumped C22 to 4.7 µF, direct-driven via R59 1.5 kΩ.',
    verifiedImpact: 'R_out cut >3× (~31 Ω); passes PUMP1 + PUMP2 @ 10 mA + 4.63 V UV (~5.63 V).',
  },
  {
    id: 'PAUD-03',
    area: 'Astable Lock-Up & V_EBO Wear',
    revCFlaw: 'Matched-reel Q15/Q16 astable risks slow-ramp 0 Hz lock-up and −4.5 V V_EBO aging.',
    revDFix: 'Replaced Q15/Q16 with LM393DR U3A Schmitt osc (same Basic reel as Pt1000 U1); U3B quietly tied off.',
    verifiedImpact: '100% guaranteed start on any PSU ramp; zero reverse V_EBO transistor wear.',
  },
  {
    id: 'PAUD-04',
    area: 'GPIO 6 Readback Headroom',
    revCFlaw: 'Higher ~8.1 V rail on R31 = 12 kΩ / R32 = 8.2 kΩ would push ~3.35 V into GPIO 6.',
    revDFix: 'Rescaled R31 from 12 kΩ → 15 kΩ (0805 Basic, shared reel with R58; keep R32 = 8.2 kΩ).',
    verifiedImpact: '2.72 V nominal, ≤3.12 V max @ 5.25 V rail, 1.41 V dead-osc LOW alarm.',
  },
  {
    id: 'PAUD-05',
    area: 'LM393 Sink Spec & 14-Part Trim',
    revCFlaw: 'Rev D draft used U3B + R60 = 470 Ω (11.2 mA > LM393 6 mA min sink / 4 mA V_OL spec) & 17 parts.',
    revDFix: 'Dropped redundant U3B buffer, set R59 = 1.5 kΩ (≤3.50 mA @ 5.25 V), and consolidated R58 = 15 kΩ with R31.',
    verifiedImpact: 'Guaranteed V_OL ≤ 0.4 V across all dies, 14 parts (= D25), −3.5 mA idle draw, €0.18/bd.',
  },
];

export const PumpAuditHistory: React.FC = () => {
  return (
    <section
      id="pump-audit-history"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-700">
            Hardware Audit &amp; Design Evolution
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            Pump PWM Driver Supply Revision History (Rev A → Rev E · Gemini Version)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Engineering progression from B0512S through 1-Wire Lite, Claude’s D25 4-BJT doubler, and the 17-part Rev D draft to the finalized 14-part Gemini Version (Rev E) zero-fee LM393 + SS14 Schottky doubler.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
          <div className="px-3 py-2 bg-white border border-slate-200 rounded-md text-center">
            <div className="text-base font-semibold text-slate-900 leading-none">Rev A→E</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
              5 Iterations
            </div>
          </div>
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-center">
            <div className="text-base font-semibold text-emerald-800 leading-none">5 Fixed</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-1">
              Full Audit
            </div>
          </div>
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-center">
            <div className="text-base font-semibold text-blue-800 leading-none">€0.00</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 mt-1">
              Feeder Fee
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4 border-b border-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Iteration Timeline (Rev A → Rev B → Rev C → Rev D → Rev E · Gemini Version)
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PUMP_REVISION_HISTORY.map((entry) => {
            const isCurrent = entry.status === 'Production Baseline';
            return (
              <article
                key={entry.rev}
                className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'bg-emerald-50/40 border-emerald-300'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider border rounded ${
                          isCurrent
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-800 border-slate-300'
                        }`}
                      >
                        {entry.rev}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">{entry.title}</h3>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {entry.costSnapshot}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">{entry.architecture}</p>

                  <div className="pt-1">
                    <div
                      className={`text-[10px] font-mono font-semibold uppercase tracking-wider mb-1.5 ${
                        isCurrent ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {isCurrent ? 'Verified Audit Outcomes' : 'Audit Findings & Why It Changed'}
                    </div>
                    <ul className="space-y-1 text-xs text-slate-700 leading-relaxed">
                      {entry.findings.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span
                            className={`font-bold select-none ${
                              isCurrent ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {isCurrent ? '+' : '−'}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div
                  className={`pt-2.5 border-t text-xs leading-relaxed ${
                    isCurrent
                      ? 'border-emerald-200 text-emerald-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="font-semibold">Outcome: </span>
                  {entry.resolution}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">
          Claude D25 (Rev C) &amp; Rev D → Gemini Version (Rev E) Hardware Resolution Matrix
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct 1-to-1 mapping of all 5 electrical, datasheet &amp; BOM findings resolved in the finalized 14-part Gemini Version (Rev E) baseline.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-5 w-24">ID</th>
              <th className="py-2.5 px-4 w-44">Audit Area</th>
              <th className="py-2.5 px-4">Prior (D25 / Rev D) Defect</th>
              <th className="py-2.5 px-4">Rev E (Gemini) Hardware Fix</th>
              <th className="py-2.5 px-5">Verified Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs align-top">
            {PUMP_D25_TO_REVD_FIXES.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                  {row.id}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  {row.area}
                </td>
                <td className="py-3 px-4 text-rose-900/90 leading-relaxed">{row.revCFlaw}</td>
                <td className="py-3 px-4 text-slate-800 leading-relaxed">{row.revDFix}</td>
                <td className="py-3 px-5 font-mono text-emerald-800 leading-relaxed">
                  {row.verifiedImpact}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
