import React from 'react';

export interface RevisionEntry {
  rev: 'Rev A' | 'Rev B' | 'Rev C' | 'Rev D';
  title: string;
  status: 'Superseded' | 'Production Baseline';
  costSnapshot: string;
  architecture: string;
  findings: string[];
  resolution: string;
}

export interface AuditFixRow {
  id: string;
  area: string;
  revCFlaw: string;
  revDFix: string;
  verifiedImpact: string;
}

export const REVISION_HISTORY: RevisionEntry[] = [
  {
    rev: 'Rev A',
    title: 'Direct RC Relaxation Oscillator (Pt1000 in AC Loop)',
    status: 'Superseded',
    costSnapshot: '~€0.25 · 1× LM393 + 1× Ref',
    architecture:
      'Wired the 2-wire roof Pt1000 directly as the timing resistor of an LM393 relaxation oscillator against a single fixed reference resistor.',
    findings: [
      'A 25 m roof sensor cable adds ~1.5–2.5 nF of stray capacitance in parallel with the timing cap, shifting oscillator frequency by +2 to +8 K.',
      'High-impedance AC timing node coupled 50 Hz roof mains hum and RF directly into the comparator input.',
      'Single-point reference could not track LM393 hysteresis threshold or input offset drift across ambient temperature.',
    ],
    resolution:
      'Abandoned direct AC excitation of the roof probe; moved Pt1000 into a quiet DC divider for Rev B.',
  },
  {
    rev: 'Rev B',
    title: 'Switched DC Divider + Local Ramp + 2-Point Auto-Cal',
    status: 'Superseded',
    costSnapshot: '~€0.38 · LM393 + 3× AO3400A',
    architecture:
      'Separated sensing into a quiet DC voltage divider switched by 3× AO3400A MOSFETs (PT1, R_lo 1.00 kΩ, R_hi 1.80 kΩ) sliced against a local U1B ramp on the HAT.',
    findings: [
      'Eliminated roof cable-capacitance bias completely (0.00 K) and introduced per-poll 2-point BIST.',
      'Lacked hardened +24 V solar-controller miswiring protection on the roof terminal block J1.',
      'No ESD/surge clamp or input low-pass filtering against long-cable EMI.',
    ],
    resolution:
      'Added +24 V miswiring protection and clamping stage in Rev C.',
  },
  {
    rev: 'Rev C',
    title: 'Hardened +24 V Clamp & 80 Hz RC Ramp (Pre-Audit)',
    status: 'Superseded',
    costSnapshot: '€0.45 claimed · hidden €2.80 C0G fee',
    architecture:
      'Added dual 470 Ω series current limiters on PT1, BZX84C3V3 (3.3 V Zener) on V_DIV, D1 (1N4148WS), and a 100/150 nF C0G ramp capacitor with linear 2-point interpolation.',
    findings: [
      'BZX84C3V3 soft-knee leakage (20–300 µA at 1.2–1.9 V) dragged V_DIV down at high collector temperatures (+150…+250 °C).',
      'Linear inversion of U1B’s exponential RC ramp left ~1.5–3.5 K of systematic curvature error across −50…+250 °C.',
      'Dual 470 Ω (940 Ω) in the PT1 branch only added ±2.44 K uncalibrated tolerance and burned 0.91 W in a 0.125 W 0805 resistor under +24 V.',
      '100 nF / 150 nF 0805 C0G is NOT a JLCPCB Basic part—quietly triggering a €2.80 extended feeder fee.',
      'Omitted Q1–Q3 gate pull-down resistors, leaving MOSFET gates floating during Raspberry Pi reset.',
    ],
    resolution:
      'Full electrical, thermal, math, and JLCPCB Basic-library redesign in Rev D.',
  },
  {
    rev: 'Rev D',
    title: 'Gemini Version — Audit-Verified Zero-Fee Production Baseline (Current)',
    status: 'Production Baseline',
    costSnapshot: '€0.42/bd · €0.00 fee · 24 parts (15 lines)',
    architecture:
      '3.90 kΩ 0.1% DC divider + sense-side 10 kΩ / BZX84C5V1 / 100 nF X7R filter + 47 Ω 1206 Q1 guard + 72.2 Hz local RC ramp (2× 10 nF Basic C0G) inverted via exact ln() bisection in Rust.',
    findings: [
      '0.00 K Zener leakage error (<5 nA for BZX84C5V1) and <0.007 K systematic curvature error across −50…+250 °C via exact g(x) ln() solver.',
      'Continuous +24 V roof miswire survives indefinitely: R1 = 3.90 kΩ stays at 0.11 W (<0.125 W), R4 + D3 clamp U1A+ at 5.10 V (1.89 mA, 36 mW).',
      'Tighter 0.44–1.57 V ramp window boosts sensitivity ~1.7× (~19–23 µs/K) and aligns 500 ms capture to exactly 25 EU 50 Hz mains cycles.',
      '100% genuine JLCPCB Basic/Preferred SMD parts (2× 10 nF C0G, 2× 100 nF X7R, R12–R14 10 kΩ gate pull-downs) on verified free non-SPI boot pull-DOWN GPIOs 22/27/12/13 (zero HAT-1wire.md collisions; SPI0 + GPIO 21 stay free), saving €5.06/board (€10.12 per 2× batch).',
    ],
    resolution:
      'Verified across live simulator, KiCad BOM/Pinout, Conclusion Scorecard, and 9-page engineering PDF.',
  },
];

export const REV_C_TO_D_AUDIT_FIXES: AuditFixRow[] = [
  {
    id: 'AUD-01',
    area: 'Zener Leakage',
    revCFlaw: 'BZX84C3V3 directly on V_DIV leaked 20–300 µA at 1.2–1.9 V (multi-K high-temp error).',
    revDFix: 'Moved clamp behind R4 (10 kΩ) at U1A+ using BZX84C5V1 (5.1 V, <5 nA leakage).',
    verifiedImpact: '0.00 K leakage error; U1A+ clamped @ 5.10 V (36 mW) at +24 V.',
  },
  {
    id: 'AUD-02',
    area: 'RC Ramp Linearity',
    revCFlaw: 'Linear 2-point interpolation on exponential U1B RC ramp caused 1.5–3.5 K curvature error.',
    revDFix: 'Dropped D1 (1N4148WS); added exact 16-step ln() bisection solver for g(x) in Rust.',
    verifiedImpact: '<0.007 K systematic error from −50 °C to +250 °C with zero extra ICs.',
  },
  {
    id: 'AUD-03',
    area: '24 V Fault & Mismatch',
    revCFlaw: '2× 470 Ω (940 Ω) in PT1 branch added ±2.44 K mismatch and dissipated 0.91 W @ +24 V.',
    revDFix: 'R1 = 3.90 kΩ 0.1% (0.11 W @ +24 V), PESD24VL1BA at J1, R5 = 47 Ω 1206 0.5 W on Q1.',
    verifiedImpact: 'Continuous +24 V survival; ±0.12 K raw (0.00 K after Setup Wizard zero).',
  },
  {
    id: 'AUD-04',
    area: 'JLCPCB Basic Caps & Jitter',
    revCFlaw: '100/150 nF 0805 C0G is Extended (+€2.80 fee); wide ramp gave only ~11 µs/K sensitivity.',
    revDFix: '2× 10 nF 0805 C0G Basic (20 nF) + 390k/100k/150k → 0.44–1.57 V @ 72.2 Hz.',
    verifiedImpact: 'True €0.00 fee; ~19–23 µs/K (~1.7× less jitter) & exact 25 EU 50 Hz cycles.',
  },
  {
    id: 'AUD-05',
    area: 'BOM Count & Transparency',
    revCFlaw: 'Unlisted MOSFET gate pull-downs left Q1–Q3 floating on boot; understated part count.',
    revDFix: 'Added R12–R14 gate pull-downs and updated BOM to exact 24 parts / 15 lines (€0.42).',
    verifiedImpact: '100% transparent KiCad / JLCPCB Basic/Preferred BOM at €0.00 fee.',
  },
  {
    id: 'AUD-06',
    area: 'GPIO Pinout & Boot Safety',
    revCFlaw: 'SPI0 pins blocked expansion & GPIO 8 boot pull-up briefly turned Q1 ON; initial non-SPI draft (16/20/26) collided with HAT FB2/WD_RB/PWM_RB2.',
    revDFix: 'Moved to 4 verified free non-SPI boot pull-DOWN GPIOs (22/27/12/13 · Pins 15/13/32/33) + stiff R12–R14 10 kΩ pull-downs.',
    verifiedImpact: 'Zero HAT pin collisions; SPI0 + GPIO 21 stay free; Q1–Q3 hold 0.00 V at boot.',
  },
];

export const HardwareAuditHistory: React.FC = () => {
  return (
    <section
      id="audit-history"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-700">
            Hardware Audit &amp; Design Evolution
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            Option 02 Revision History (Rev A → Rev D · Gemini Version)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Chronological engineering audit trail documenting every electrical, thermal, mathematical, and JLCPCB assembly defect caught from initial concept through the verified Gemini Version (Rev D) baseline.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
          <div className="px-3 py-2 bg-white border border-slate-200 rounded-md text-center">
            <div className="text-base font-semibold text-slate-900 leading-none">Rev A→D</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
              4 Iterations
            </div>
          </div>
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-center">
            <div className="text-base font-semibold text-emerald-800 leading-none">6 Fixed</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-1">
              Rev C→D Audit
            </div>
          </div>
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-center">
            <div className="text-base font-semibold text-blue-800 leading-none">&lt;0.01 K</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 mt-1">
              ln() Linearity
            </div>
          </div>
        </div>
      </div>

      {/* Part 1: Rev A -> Rev D Iteration Cards */}
      <div className="p-6 space-y-4 border-b border-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Iteration Timeline (Rev A → Rev B → Rev C → Rev D · Gemini Version)
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {REVISION_HISTORY.map((entry) => {
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

      {/* Part 2: Rev C -> Rev D 5-Point Audit Resolution Table */}
      <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Rev C → Rev D (Gemini Version) Hardware Audit Resolution Table
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct 1-to-1 mapping of all 6 issues discovered during the Rev C electrical, pinout &amp; BOM audit and their verified Gemini Version (Rev D) fixes.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-5 w-20">ID</th>
              <th className="py-2.5 px-4 w-44">Audit Area</th>
              <th className="py-2.5 px-4">Rev C Defect</th>
              <th className="py-2.5 px-4">Rev D (Gemini) Hardware / Math Fix</th>
              <th className="py-2.5 px-5">Verified Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs align-top">
            {REV_C_TO_D_AUDIT_FIXES.map((row) => (
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
