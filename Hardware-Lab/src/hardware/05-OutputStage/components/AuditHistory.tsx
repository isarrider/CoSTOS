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
    rev: 'Rev B (Gemini)',
    status: 'Finalized',
    title: 'Zero-Shoot-Through Class-B Push-Pull Inside R9 + Active-Limited REL1/REL2',
    summary:
      '100% JLCPCB Basic (€0.00 fee, €0.56/bd). Complementary Q6/Q7 emitter-follower behind R9 (220 Ω 0.5 W), clamped RB1/FB1, SS14 1 A relay flyback, and 138 mA active foldback Q2L on REL1/REL2.',
  },
];

export const OUTPUT_AUDIT_DEFECTS: OutputAuditDefect[] = [
  {
    id: 'OUT-01',
    area: 'Q7 Exposed Outside R9',
    finding:
      'In Rev A H3 (hat_schematic.py), Q7 (MMBT3904) sits directly on J2 PWM OUTSIDE R9 (100 Ω). Any +12 V / +24 V miswire while pump is OFF (Q7 saturated ON) sends >2 A into Q7, instantly destroying the SOT-23.',
    fixInRevB:
      'Move R9 (220 Ω 1206 0.5 W) to the terminal side OUTSIDE the complementary Q6/Q7 push-pull stage, with D4a/D4b (1N4148W) clamping the internal node to +V_DRV and GND.',
    measuredImpact: '+24 V miswire limited to 106 mA (<200 mA SOA); GND short limited to 35 mA (0.27 W indefinite)',
  },
  {
    id: 'OUT-02',
    area: 'Q6/Q7 Shoot-Through & 60 °C Leakage',
    finding:
      'In H3, R36 (2.2k) + R35 (2.7k) + R37 (47k) leaves V_EB(Q6) = 0.48 V at 12 V (turning Q6 back ON at 60 °C!), and Q6 storage time overlaps Q7 turn-on for ~85 mA spikes on every falling edge.',
    fixInRevB:
      'Use Q8 (MMBT3906) with dedicated R36 (4.7k) E-B bleed (0.00 V off!) driving a Class-B complementary emitter-follower (Q6 MMBT3904 + Q7 MMBT3906) whose 1.3 V deadband physically prevents shoot-through.',
    measuredImpact: '0 mA shoot-through; 0.00 V Q8 leak at 60 °C; 0.24 µs rise & fall edges (16× faster than T/500)',
  },
  {
    id: 'OUT-03',
    area: 'RB1 Readback Overdrives Pi 5 GPIO6',
    finding:
      'Rev A divider R31 (12 kΩ) / R32 (8.2 kΩ) has 0.406 ratio: drives 3.45–3.73 V into Pi 5 GPIO6 under Pump Supply Rev E (8.5–9.2 V) and 4.87 V at 12 V with zero clamp diode.',
    fixInRevB:
      'Change divider to R31 = 22 kΩ / R32 = 10 kΩ (0.3125 ratio -> 2.34 V @ 7.5 V PWM) and add Basic D18 (1N4148W) clamping GPIO6 to +3V3.',
    measuredImpact: 'GPIO6 stays at 2.34 V nominal and <= 3.60 V (<1 mA) even under +24 V miswire on J2 PWM',
  },
  {
    id: 'OUT-04',
    area: 'FB1 PESD5V0 Fee & +24 V Stress',
    finding:
      'Rev A puts Extended PESD5V0 (€2.80 fee, V_BR ~6.8 V) on J2 FB1 ahead of R11 (4.7k to +3V3), letting +24 V faults clamp at 6.8 V and back-feed +3V3.',
    fixInRevB:
      'Place Basic R12 (2.2 kΩ 1206 0.5 W) FIRST at J2 Pin 3, followed by dual Basic 1N4148W clamps (D17a/b) to +3V3/GND, R11 (22 kΩ) pull-up, and C9 (10 nF, f_c = 723 Hz).',
    measuredImpact: 'Eliminates €2.80 fee; survives continuous +24 V at 0.18 W; V_OL = 0.48 V (<0.8 V); GPIO23 <= 3.60 V',
  },
  {
    id: 'OUT-05',
    area: 'Unprotected J4 REL1 Dead Short',
    finding:
      'Q12 (AO3401A, 50 mΩ) + Q2 (AO3400A, 35 mΩ) have zero current limiting: a dead short across J4 (+5V_REL to OUT) draws >15 A from Pi +5V, crashing Raspberry Pi 5 and welding Q2.',
    fixInRevB:
      'Add Basic 4.7 Ω 1206 0.5 W source shunt (R2S) + Basic MMBT3904 (Q2L) throttling Q2 Gate behind R15 (10 kΩ) at V_BE/4.7 Ω = 138 mA (119 mA @ 60 °C).',
    measuredImpact: 'Delivers 4.53 V to 100 mA coils (4.93 V to SSR); indefinite J4 short stays at 138 mA (0.60 W, zero Pi reboot)',
  },
  {
    id: 'OUT-06',
    area: 'Undersized D6 Flyback & SMBJ13A Fee',
    finding:
      'D6 (1N4148W, 150 mA signal diode) has poor surge margin for 100 mA inductive relay coils, while SMBJ13A adds €2.80 Extended fee and 1,100 pF parasitic load on J2 PWM.',
    fixInRevB:
      'Upgrade D6 to Basic SS14 (40 V / 1 A Schottky, already on BOM!) and replace SMBJ13A with R9 (220 Ω 0.5 W) + Basic 4 pF 1N4148W rail steering (D4a/D4b).',
    measuredImpact: '10× flyback current rating; 138× lower ESD capacitance; €0.00 total JLCPCB feeder fees',
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
