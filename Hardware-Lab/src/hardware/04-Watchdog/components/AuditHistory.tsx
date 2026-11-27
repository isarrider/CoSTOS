import React from 'react';

export interface WatchdogAuditEntry {
  id: string;
  revision: string;
  severity: 'Critical' | 'Major' | 'Optimization';
  title: string;
  finding: string;
  fix: string;
}

export const WATCHDOG_AUDIT_LOG: WatchdogAuditEntry[] = [
  {
    id: 'WAUD-01',
    revision: 'Baseline → D24',
    severity: 'Critical',
    title: '74LVC1G123 + TPS22918: €5.60 Extended Fees, No Upper Window & 3 s Linux Stall Trip',
    finding:
      'Original rev A used two JLCPCB Extended ICs (€5.60 fee), accepted runaway 2 kHz software toggle loops indefinitely, lacked GPIO20 self-test readback, and false-tripped during 3.5–5 s Pi Linux stalls.',
    fix:
      'Adopted Claude’s bandpass AC charge-pump front-end concept (R48/C16 340 Hz LPF + C17/C19 double-fault DC blocking caps) as the zero-fee foundation.',
  },
  {
    id: 'WAUD-02',
    revision: 'D24 Audit',
    severity: 'Critical',
    title: 'Claude D24 Slow 1.8 s Linear Ramp → Mechanical Relay Contact Arcing & Q12 Heating',
    finding:
      'Driving Q13 (AO3400A) directly from a slow τ = 11 s RC discharge causes Q12 (AO3401A) to sit in its linear region (~250 mW) for 1.5–2.5 s, browning out mechanical relay coils and arcing 230 VAC contacts.',
    fix:
      'Replaced direct analog MOSFET slicing with an LM393DR2G (C7955 Basic) Schmitt-trigger comparator (0.61 V / 0.75 V hysteresis) for < 5 µs snap-action switching — refined to dedicated dual-channel U4 in Rev B.',
  },
  {
    id: 'WAUD-03',
    revision: 'D24 Audit',
    severity: 'Critical',
    title: 'Claude D24 2.8× AO3400A V_th Spread Creates Up to 8 s GPIO20 Self-Test Blind Spot',
    finding:
      'Because Q14 (GPIO20), Q13 (Relay), and Q5 (Pump) are three independent AO3400A FETs (V_gs(th) = 0.65–1.45 V) on an analog ramp, high-V_th Q14 can report 5.2 s PASS while low-V_th Q13 keeps mains relays ON for 13.5 s (or 28 s if R49 opens!).',
    fix:
      'With U4A/U4B Schmitt slicing (1% resistor dividers), thresholds are locked to ±3%: in unscaled 34 s TI LM393 SPICE, U4A cuts factory-populated mains relay Q12 (D25) at 16.11 s (5.046 V → 3.6 nV) — conservatively 2.31 s BEFORE U4B drops GPIO20 & Q5 at 18.42 s (3.280 V → 3.2 µV).',
  },
  {
    id: 'WAUD-04',
    revision: 'Rev A → B',
    severity: 'Major',
    title: 'Rejected SS14 Schottky on Charge Pump & GPIO20 Due to 60 °C Reverse Leakage',
    finding:
      'Using SS14 power Schottky diodes (from Pump Supply Rev E) on V_CAP would leak tens of microamps at 60 °C and drain C18; using SS14 to isolate +5V ~WD_OK from GPIO20 would back-feed > 4.0 V into Pi 3.3 V GPIO at 60 °C.',
    fix:
      'Kept low-leakage 1N4148W (25 nA) on D19/D20, and in Rev B placed U4B natively in the +3.3 V domain — driving GPIO20 & D3 LED directly (deleting Q14) with zero +5V back-feed path.',
  },
  {
    id: 'WAUD-05',
    revision: 'Rev A → B',
    severity: 'Major',
    title: 'Caught R45 (100 kΩ) + R57 Hysteresis Feedback Drooping Output Into PNP V_EB',
    finding:
      'With R45 = 100 kΩ to +5V and R57 = 220 kΩ hysteresis feedback to Pin 3 (~1.5 V), the open-collector output drooped to 4.1 V when OFF — turning a +5V PNP (V_EB = 0.9 V) ON falsely!',
    fix:
      'Stiffened both pull-ups to 10 kΩ (R45 to +5V on U4A → 4.85 V OFF, 151 mV V_sg; R51 to +3.3V on U4B → 3.14 V OFF, 158 mV V_eb). Both Q12 and Q15 stay 100% OFF at 60 °C while sink currents remain 0.50 mA / 1.46 mA.',
  },
  {
    id: 'WAUD-06',
    revision: 'Rev A → B',
    severity: 'Optimization',
    title: '2.2× Lower Node Impedance (500 kΩ vs 1.1 MΩ) Preserves Accuracy Under Humidity & I_bias',
    finding:
      'D24’s 1.1 MΩ node dropped τ by 34% under 3 MΩ boiler-room humidity/flux; lengthening timeout by raising R_drain to 2.2 MΩ would also amplify LM393 input bias current (25–100 nA) drift.',
    fix:
      'Kept redundant 2× 1.0 MΩ parallel bleed (500 kΩ low-Z) and scaled capacitance to 2× 22 µF 25 V 1206 X5R (C12891 Basic, shared w/ C2A/C2B) — extending unscaled TI LM393 SPICE cutoff to 16.11 s Relay / 18.42 s Pump+RB cleanly.',
  },
  {
    id: 'WAUD-07',
    revision: 'Rev A → Rev B',
    severity: 'Major',
    title: 'Upgraded From Shared U3B to Dedicated U4 (LM393DR2G C7955) Dual-Schmitt + 10 s Linux Stall Survival',
    finding:
      'Sharing U3B with Pump Supply U3A risked 60 kHz switcher cross-talk into the high-Z V_CAP node and created a single-output common-cause fault on U3B Pin 7; meanwhile 8.5 s timeout left only ~2 s margin above occasional 6–8 s Pi Linux stalls.',
    fix:
      'Dedicated U4 (LM393DR2G, C7955 shared Basic reel) splits factory-populated Q12 Relay (U4A, +5V_HAT per D18/D25) and Pump/GPIO20 (U4B, +3.3V) onto independent comparator stages, deletes Q13 & Q14, adds Q23+D36 Red WD_FAULT LED, leaves Pump U3B tied off, and delivers +334 mV margin through a 10 s Linux stall (1 kHz runaway rejected at 0.745 V max in unscaled SPICE).',
  },
];

export const WatchdogAuditHistory: React.FC = () => {
  return (
    <section
      id="wd-audit-history"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">
          Hardware Audit Trail (Original 74LVC1G123 → Claude D24 → Rev A → Gemini Rev B)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Every physics defect caught during silicon review, SPICE time-step verification, and worst-case 60 °C boiler-room corner analysis.
        </p>
      </div>

      <div className="divide-y divide-slate-200">
        {WATCHDOG_AUDIT_LOG.map((item) => (
          <div key={item.id} className="px-6 py-4 flex flex-col md:flex-row gap-4">
            <div className="md:w-44 shrink-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">{item.id}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase rounded ${
                    item.severity === 'Critical'
                      ? 'bg-rose-100 text-rose-800'
                      : item.severity === 'Major'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.severity}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">{item.revision}</div>
            </div>

            <div className="flex-1 space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Finding: </span>
                {item.finding}
              </p>
              <p className="text-xs text-emerald-900 bg-emerald-50/60 border border-emerald-200/70 rounded px-3 py-1.5 leading-relaxed">
                <span className="font-semibold">Resolution: </span>
                {item.fix}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
