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
    title: 'Locked Rev E — 15-Part LM393DR2G + CMOS + SS14 Schottky Doubler (Current)',
    status: 'Production Baseline',
    costSnapshot: '€0.24 parts + €2.80 C20 Ext · 15 parts',
    architecture:
      'Single LM393DR2G comparator U3A (C7955 Basic, 62 kHz Schmitt osc, R59 = 1.5 kΩ ≤3.5 mA sink; U3B tied off) driving rail-to-rail CMOS Q17 (AO3401A) + Q18 (AO3400A) with R60 (47 Ω 1206 C17969 shared Ext) + 2× SS14 Basic Schottkys (C2480) + C22 (4.7 µF) / C23 (10 µF).',
    findings: [
      'Rail-to-rail CMOS + SS14 Schottkys under D18 direct +5V_HAT = 5.045 V deliver +9.21 V +V_DRV / +7.55 V at J2 PWM1 (TI .SUBCKT LM393 ngspice-39 verified).',
      '62 kHz + 4.7 µF + CMOS cuts R_out >3× (~28 Ω): delivers +7.98 V (+6.45 V J2) at 4.63 V Pi 5 UVLO and passes PUMP1 + PUMP2 stress.',
      'Datasheet-safe R59 = 1.5 kΩ caps U3A sink current to 3.50 mA @ 5.25 V (<4 mA V_OL guarantee); R60 47 Ω caps CMOS shoot-through peaks to 43.8 mA.',
      'Live JLCPCB audit honestly marks C20 (C1791 1 nF C0G, €2.80 unique) and R60 (C17969 47 Ω 1206, shared w/ Tab 01 R105) as Extended; pairs with Sub 05 R31 22 kΩ / R32 10 kΩ (2.36 V nom / 2.01 V UVLO).',
    ],
    resolution:
      'Locked 15-part Rev E baseline (€0.24 parts + €2.80 C20 Ext fee, saves €0.94/bd parts vs B0512S), 0 GPIOs used, TI LM393 ngspice-39 verified across simulator, KiCad BOM, and PDF.',
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
    revCFlaw: 'Higher +9.21 V rail (+7.55 V J2) on R31 = 12 kΩ / R32 = 8.2 kΩ would push >3.05 V into GPIO 6.',
    revDFix: 'Paired with locked Sub 05 R31 = 22 kΩ / R32 = 10 kΩ + D18 1N4148W clamp to +3V3.',
    verifiedImpact: '2.36 V nominal (+5V_HAT = 5.045 V), 2.01 V at 4.63 V UVLO, 1.13 V dead-osc LOW alarm.',
  },
  {
    id: 'PAUD-05',
    area: 'LM393 Sink, CMOS & Honest BOM',
    revCFlaw: 'Rev D draft overloaded LM393 sink (11.2 mA) & BJT followers lost 1.45 V; earlier BOM mislabeled C20/R60 as Basic.',
    revDFix: 'Set R59 = 1.5 kΩ (≤3.50 mA), upgraded Q17/Q18 to AO3401A/AO3400A + R60 47 Ω, and logged C20 (C1791) & R60 (C17969) honestly as Extended.',
    verifiedImpact: 'Guaranteed V_OL ≤ 0.4 V, +9.21 V nom / +7.98 V UVLO (TI LM393 ngspice-39), 15 parts.',
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
            Pump PWM Driver Supply Revision History (Rev A → Rev E Locked)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Engineering progression from B0512S through 1-Wire Lite, Claude’s D25 4-BJT doubler, and the 17-part Rev D draft to the finalized 15-part Rev E LM393DR2G + CMOS + SS14 Schottky doubler.
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
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-center">
            <div className="text-base font-semibold text-amber-800 leading-none">+9.21 V</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mt-1">
              TI SPICE D18
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
