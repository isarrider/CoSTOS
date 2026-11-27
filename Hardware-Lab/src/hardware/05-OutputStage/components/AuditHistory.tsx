export interface OutputRevisionStep {
  rev: string;
  status: 'Legacy' | 'Audited' | 'Finalized';
  title: string;
  summary: string;
}

export interface OutputAuditDefect {
  id: string;
  area: string;
  finding: string;
  fixInRevB: string;
  measuredImpact: string;
}

export const OUTPUT_REVISION_STEPS: OutputRevisionStep[] = [
  {
    rev: 'Rev A (Fallback)',
    status: 'Legacy',
    title: '74LVC1G08 AND + TC4427 Driver + Unprotected Q2 Relay',
    summary:
      'Clean stripboard push-pull driver, but costs €11.20 in JLCPCB Extended fees (4 parts), has 22 V abs max, overdrives Pi 5 GPIO6 at +V_DRV > 8.1 V, and lets a J4 relay short crash Pi +5V.',
  },
  {
    rev: 'Rev A (Default H3)',
    status: 'Audited',
    title: 'Discrete Transistor Chain H3 (Q4/Q5/Q6/Q7) + SMBJ13A + PESD5V0',
    summary:
      'Cut driver IC fees, but placed Q7 outside R9 (vaporizes on +12V/+24V miswire when OFF), introduced Q6/Q7 shoot-through & 60°C Q6 leakage, kept €5.60 Extended TVS fees, and left RB1/FB1/REL1 exposed.',
  },
  {
    rev: 'Rev B (Locked)',
    status: 'Finalized',
    title: 'Zero-Shoot-Through Class-B Push-Pull Inside R9 + D25 Populated REL1 SMD',
    summary:
      '100% JLCPCB Basic BOM (~€0.39/bd; €0.00 Extended fees!). Class-B Q6/Q7 (MMBT3904/S8550 Basic) behind R9A+R9B (2×100 Ω 1206 = 200 Ω/500 mW), clamped RB1 (2.39 V) & FB1 (R12A||B 2×4.7 kΩ + C9 10 nF X7R + TL431 D9), D6 SS14 flyback (5.31 V), and D25-populated REL1 SMD with Q11 + R501A∥R501B (5.0 Ω Basic, 123.2 mA limit, €0 extra fees).',
  },
];

export const OUTPUT_AUDIT_DEFECTS: OutputAuditDefect[] = [
  {
    id: 'OUT-01',
    area: 'Q7 Exposed Outside R9',
    finding:
      'In Rev A H3 (hat_schematic.py), Q7 (MMBT3904) sits directly on J2 PWM OUTSIDE R9 (100 Ω). Any +12 V / +24 V miswire while pump is OFF (Q7 saturated ON) sends >2 A into Q7, instantly destroying the SOT-23.',
    fixInRevB:
      'Move R9A+R9B (2× 100 Ω 1206 Basic C17901 = 200 Ω / 500 mW) to the terminal side OUTSIDE the complementary Q6/Q7 push-pull stage, with D4/D5 (1N4148W) clamping the internal node to +V_DRV and GND.',
    measuredImpact: 'GND short = 39.1 mA (153 mW/R continuous safe); +24 V keeps Q6/Q7 & GPIO6 safe (R9A/B 0.493 W ea WARN)',
  },
  {
    id: 'OUT-02',
    area: 'Q6/Q7 Shoot-Through & 60 °C Leakage',
    finding:
      'In H3, R36 (2.2k) + R35 (2.7k) + R37 (47k) leaves V_EB(Q6) = 0.48 V at 12 V (turning Q6 back ON at 60 °C!), and Q6 storage time overlaps Q7 turn-on for ~85 mA spikes on every falling edge.',
    fixInRevB:
      'Use Q8 (S8550 Basic PNP C105432) with dedicated R36 (4.7k) E-B bleed (0.00 V off!) driving a Class-B complementary emitter-follower (Q6 MMBT3904 + Q7 S8550 Basic) whose 1.3 V deadband physically prevents shoot-through.',
    measuredImpact: '0 mA shoot-through; 0.00 V Q8 leak at 60 °C; 0.24 µs edges; WD=0 cuts J2 to 145 µV',
  },
  {
    id: 'OUT-03',
    area: 'RB1 Readback Overdrives Pi 5 GPIO6',
    finding:
      'Rev A divider R31 (12 kΩ) / R32 (8.2 kΩ) has 0.406 ratio: drives 3.74 V into Pi 5 GPIO6 under D18 +V_DRV = 9.21 V (and 4.87 V at 12 V) with zero clamp diode.',
    fixInRevB:
      'Change divider to R31 = 22 kΩ / R32 = 10 kΩ (0.3125 ratio -> 2.39 V @ 7.63 V PWM) and add Basic D18 (1N4148W) clamping GPIO6 to +3V3.',
    measuredImpact: 'GPIO6 stays at 2.39 V nominal (SPICE verified) and <= 3.86 V (<1 mA) even under +24 V miswire',
  },
  {
    id: 'OUT-04',
    area: 'FB1 PESD5V0 Fee & +24 V Stress',
    finding:
      'Rev A puts Extended PESD5V0 (€2.80 fee, V_BR ~6.8 V) on J2 FB1 ahead of R11 (4.7k to +3V3), letting +24 V faults clamp at 6.8 V and back-feed +3V3.',
    fixInRevB:
      'Place R12A||R12B (2× 4.7 kΩ 0805 Basic C17673 = 2.35 kΩ) FIRST at J2 Pin 3, followed by dual Basic 1N4148W clamps (D17/D30) to +3V3/GND (guarded by Basic D9 TL431 3.67 V clamp), R11 (22 kΩ) pull-up, and C9 (10 nF X7R Basic C1710, f_c = 677 Hz).',
    measuredImpact: 'Survives continuous +24 V at 85 mW/R (68% load); V_OL = 0.48 V; Pi-OFF +3V3 held <= 3.68 V by D9 TL431',
  },
  {
    id: 'OUT-05',
    area: 'Unprotected J4 REL1 Dead Short (D25 Matched)',
    finding:
      'Q12 (AO3401A, 60 mΩ) + Q10 (AO3400A, 48 mΩ) have zero current limiting: a dead short across J4 (+5V_REL to OUT) draws >15 A from Pi +5V, crashing Raspberry Pi 5 and welding the MOSFET.',
    fixInRevB:
      'Populate all REL1 SMD parts per D25 (€0 extra fee, only J4 THT optional): reuse Basic 10 Ω 0805 reel (R501A∥R501B = 5.0 Ω / 250 mW, C17415) + Q11 MMBT3904 throttling Q10 behind R15 (10 kΩ).',
    measuredImpact: 'Drives 67 mA coil cleanly; dead J4 short folds to 123.2 mA (38 mW/R, zero Pi reboot); Q12 cuts at 16.11 s',
  },
  {
    id: 'OUT-06',
    area: 'Undersized D6 Flyback & SMBJ13A Cap/Fee',
    finding:
      'D6 (1N4148W, 150 mA signal diode) has poor surge margin for inductive relay coils, while SMBJ13A adds €2.80 Extended fee and 1,100 pF parasitic load on J2 PWM.',
    fixInRevB:
      'Upgrade D6 to Basic SS14 (40 V / 1 A Schottky, C2480, already on BOM!) and replace SMBJ13A with R9A+R9B (2× 100 Ω 1206 Basic) + Basic 4 pF 1N4148W rail steering (D4/D5) and unified Green LED D7 (C2297).',
    measuredImpact: '10× flyback rating (5.31 V clamp); 138× lower ESD cap; €0.00 Extended fees across entire Output Stage',
  },
];

export function OutputAuditHistory() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Design Iteration Progression (Rev A Fallback → Rev A H3 → Rev B Gemini)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {OUTPUT_REVISION_STEPS.map((step) => {
            const isFinal = step.status === 'Finalized';
            return (
              <div
                key={step.rev}
                className={`rounded-lg border p-3.5 ${
                  isFinal ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`font-mono text-xs font-bold ${isFinal ? 'text-emerald-800' : 'text-slate-900'}`}>
                    {step.rev}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      isFinal
                        ? 'bg-emerald-700 text-white'
                        : step.status === 'Audited'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-900 mb-1">{step.title}</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{step.summary}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">
            Detailed Hardware Defect &amp; Resolution Log (OUT-01 through OUT-06)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">Subsystem Area</th>
                <th className="py-2 px-3">Rev A Defect Found</th>
                <th className="py-2 px-3">Rev B (Gemini) Hardware Fix</th>
                <th className="py-2 px-3">Verified Electrical Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OUTPUT_AUDIT_DEFECTS.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70 align-top">
                  <td className="py-2.5 px-3 font-mono font-bold text-cyan-800 whitespace-nowrap">{d.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">{d.area}</td>
                  <td className="py-2.5 px-3 text-rose-800">{d.finding}</td>
                  <td className="py-2.5 px-3 text-slate-700">{d.fixInRevB}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-800 font-semibold">{d.measuredImpact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
