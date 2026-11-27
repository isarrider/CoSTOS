import React, { useState } from 'react';

interface KicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  jlcpcbClass: 'Basic' | 'Extended';
  purpose: string;
}

export const WATCHDOG_REV_B_BOM: KicadBomRow[] = [
  {
    refDes: 'U4',
    qty: 1,
    value: 'LM393DR2G',
    partNumber: 'onsemi LM393DR2G SOIC-8 (C7955 Basic, shared reel with Pt1000 U1 & Pump U3)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    jlcpcbClass: 'Basic',
    purpose: 'Dedicated Dual Schmitt Watchdog: U4A = +5V Relay (Q12, 16.11 s), U4B = +3.3V Pump (Q15→Q5) + GPIO20/D3 (18.42 s)',
  },
  {
    refDes: 'C_u4',
    qty: 1,
    value: '100nF X7R',
    partNumber: '0805 100 nF 50 V X7R (C49678 Basic, shared reel)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Local +5V_HAT supply decoupling placed directly across U4 Pin 8 (VCC) and Pin 4 (GND)',
  },
  {
    refDes: 'R48, C16',
    qty: 2,
    value: '4.7k + 100nF',
    partNumber: '0805 4.7 kΩ ±1% + 100 nF 50 V X7R C49678 (shared Basic reels)',
    footprint: '0805 (R_0805 / C_0805)',
    jlcpcbClass: 'Basic',
    purpose: 'Runaway-loop input LPF (f_c = 340 Hz; TI LM393 SPICE caps 1 kHz runaway at 0.745 V max)',
  },
  {
    refDes: 'C17, C19',
    qty: 2,
    value: '1uF X7R',
    partNumber: '0805 1 µF 50 V X7R (C28323 Basic, shared with Pump Supply)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Two series coupling caps (500 nF eff): double-fault DC blocking if either cap shorts',
  },
  {
    refDes: 'D19, D20',
    qty: 2,
    value: '1N4148W',
    partNumber: '1N4148W SOD-123 (C81598 Basic · 25 nA low leakage)',
    footprint: 'Diode_SMD:D_SOD-123',
    jlcpcbClass: 'Basic',
    purpose: 'Charge-pump clamp (D20) & rectifier (D19); low 60 °C leakage (do NOT use SS14 here)',
  },
  {
    refDes: 'C18A, C18B',
    qty: 2,
    value: '22uF 25V X5R',
    partNumber: '1206 22 µF 25 V X5R (C12891 Basic · shared w/ C2A/C2B +5V_HAT bulk)',
    footprint: 'Capacitor_SMD:C_1206_3216Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Hold capacitor bank on V_CAP (unscaled TI LM393 SPICE: V_CAP_ss = 2.171 V, 16.11 s / 18.42 s cutoffs)',
  },
  {
    refDes: 'R49, R50',
    qty: 2,
    value: '1.0M 1%',
    partNumber: '0805 1.0 MΩ ±1% 0.125 W (C17514 Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Redundant parallel bleed resistors (500 kΩ): keeps node low-Z for LM393 I_bias & humidity',
  },
  {
    refDes: 'R55A, R56A, R57A',
    qty: 3,
    value: '100k / 47k / 220k',
    partNumber: '0805 1% Basic (100k & 47k shared; 220k C17556)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U4A Pin 3 Schmitt divider from +3V3: 1.54 V ON / 0.93 V OFF (0.61 V hyst, 16.11 s SPICE relay cutoff)',
  },
  {
    refDes: 'R55B, R56B, R57B',
    qty: 3,
    value: '100k / 47k / 100k',
    partNumber: '0805 1% Basic (all shared reels)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U4B Pin 5 Schmitt divider from +3V3: 1.56 V ON / 0.81 V OFF (0.75 V hyst, 18.42 s SPICE pump/RB cutoff)',
  },
  {
    refDes: 'R45, Q12',
    qty: 2,
    value: '10k + AO3401A',
    partNumber: '0805 10 kΩ to +5V_HAT + AO3401A P-MOSFET (C15127 Basic, factory-populated per D25)',
    footprint: 'R_0805 / SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'U4A Pin 1 (+5V_HAT) directly drives Q12 high-side +5V_REL switch (5.046 V → 3.6 nV at 16.11 s; deletes Q13)',
  },
  {
    refDes: 'Q15',
    qty: 1,
    value: 'S8550',
    partNumber: 'S8550 PNP SOT-23 (C105432 Basic — shared w/ Tab 05 Q7/Q8 → €0.00 Extended fee!)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Inverts active-LOW U4B Pin 7 (+3.3V domain) to drive Q5 pump series gate (+3.28 V ON / 0.0 V OFF)',
  },
  {
    refDes: 'R51, R53, R54, Q5',
    qty: 4,
    value: '10k×2, 100k, AO3400A',
    partNumber: '0805 1% Basic + AO3400A N-MOSFET (C20917 Basic, 30 V 5.7 A)',
    footprint: 'R_0805 / SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'U4B Pin 7 pull-up (R51) drives GPIO20 directly (deletes Q14!); Q15→Q5 gates H3 Pump PWM',
  },
  {
    refDes: 'JP1, D3, R5',
    qty: 3,
    value: 'JP1, Grn LED, 1.5k',
    partNumber: 'Unpopulated 2-pad copper test point (DNP) + KT-0805G Green LED (C2297 Basic) + 1.5 kΩ',
    footprint: 'SolderJumper-2 (Open) / LED_0805 / R_0805',
    jlcpcbClass: 'Basic',
    purpose: 'Unpopulated bench override pads JP1 & D3 WD_OK green LED sunk by U4B Pin 7 (1.1 mA)',
  },
  {
    refDes: 'Q23, D36, R314',
    qty: 3,
    value: 'AO3400A, Red LED, 2.2k',
    partNumber: 'AO3400A (C20917 Basic) + NCD0805R1 Red LED (C84256 Basic) + 2.2 kΩ 0805',
    footprint: 'SOT-23 / LED_0805 / R_0805',
    jlcpcbClass: 'Basic',
    purpose: 'Dedicated WD_FAULT red indicator LED — lights whenever U4B Pin 7 goes HIGH (watchdog tripped/stopped)',
  },
];

export const WATCHDOG_REV_A_BOM = WATCHDOG_REV_B_BOM;

export const WATCHDOG_PINOUT = [
  {
    pin: 'Pi Pin 18 (GPIO 24)',
    net: 'WD_HB',
    dir: 'Pi → HAT',
    note: '20 Hz software heartbeat (config.txt: gpio=24=op,dl — NEVER hardware PWM)',
  },
  {
    pin: 'Pi Pin 38 (GPIO 20)',
    net: 'WD_READBACK',
    dir: 'HAT → Pi',
    note: 'Direct to U4B Pin 7 (+3.3V domain via R51 10 kΩ, Q14 deleted). LOW = WD ON; HIGH at 18.42 s (SPICE).',
  },
  {
    pin: 'U4A Pin 2 (−) / Pin 3 (+)',
    net: 'WD_VCAP / VREF_A',
    dir: 'Channel A',
    note: 'Pin 2 = V_CAP (2×22 µF 1206 C12891 ∥ 500 kΩ, 2.171 V ss). Pin 3 = 100k/47k/220k (1.54 V / 0.93 V).',
  },
  {
    pin: 'U4A Pin 1 (OUT)',
    net: '~WD_REL',
    dir: '+5V Relay',
    note: 'Pull-up R45 (10 kΩ) to +5V_HAT (5.045 V); drives factory-populated Q12 (D25) directly (cutoff 16.11 s).',
  },
  {
    pin: 'U4B Pin 6 (−) / Pin 5 (+)',
    net: 'WD_VCAP / VREF_B',
    dir: 'Channel B',
    note: 'Pin 6 = V_CAP. Pin 5 = R55B 100k / R56B 47k / R57B 100k (1.56 V / 0.81 V; cutoff 18.42 s).',
  },
  {
    pin: 'U4B Pin 7 (OUT)',
    net: '~WD_PUMP_RB',
    dir: '+3.3V Pump/RB',
    note: 'Pull-up R51 (10 kΩ) to +3V3; drives GPIO20 + D3 Green / Q23+D36 Red LEDs & Q15 (S8550 C105432 Basic) → Q5.',
  },
];

export const WatchdogKicadBomPinout: React.FC = () => {
  const [copiedCsv, setCopiedCsv] = useState(false);

  const handleCopyCsv = () => {
    const header = 'RefDes,Qty,Value,PartNumber,Footprint,JLCPCB_Class,Purpose';
    const lines = WATCHDOG_REV_B_BOM.map(
      (r) =>
        `"${r.refDes}",${r.qty},"${r.value}","${r.partNumber}","${r.footprint}","${r.jlcpcbClass}","${r.purpose}"`
    );
    navigator.clipboard?.writeText([header, ...lines].join('\n'));
    setCopiedCsv(true);
    window.setTimeout(() => setCopiedCsv(false), 2000);
  };

  return (
    <section
      id="wd-kicad-bom"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            KiCad Production BOM &amp; Dedicated U4 Pinout — Rev B (Gemini Version)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            28 JLCPCB Basic parts (100% Basic, €0.00 Extended fees! Q15 = S8550 C105432 Basic, shared w/ Tab 05 Q7/Q8). Dedicated U4 (LM393DR2G C7955) isolates factory-populated Q12 Relay (D25, 16.11 s) and Pump/GPIO20 (18.42 s).
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyCsv}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors cursor-pointer"
        >
          {copiedCsv ? 'Copied CSV!' : 'Copy KiCad BOM CSV'}
        </button>
      </div>

      {/* Dedicated U4 Architecture Callout */}
      <div className="mx-6 mt-4 p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-md text-xs text-emerald-950">
        <span className="font-mono font-semibold uppercase tracking-wider text-emerald-800 mr-2">
          Dedicated U4 Architecture (Zero Cross-Talk &amp; Dual-Channel Fault Isolation):
        </span>
        Giving the Watchdog its own <span className="font-mono font-semibold">U4 (LM393DR2G, C7955 Basic)</span> leaves <span className="font-mono">U3B</span> on <span className="font-semibold">03. Pump Driver Supply (Rev E)</span> cleanly tied off (no 60 kHz switcher coupling into the 500 kΩ <span className="font-mono">V_CAP</span> node), separates the <span className="font-mono">+5V_HAT</span> Relay switch (<span className="font-mono font-semibold">U4A → Q12 populated per D25, 16.11 s</span>) from the <span className="font-mono">+3.3V</span> Pump/Readback channel (<span className="font-mono font-semibold">U4B → GPIO20 + D3/D36 + Q15 → Q5, 18.42 s</span>), and deletes both <span className="font-mono">Q13</span> and <span className="font-mono">Q14</span>.
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-mono uppercase tracking-wider text-slate-500">
              <th className="py-2 px-4">RefDes</th>
              <th className="py-2 px-3">Qty</th>
              <th className="py-2 px-3">Value</th>
              <th className="py-2 px-3">Part / Reel Synergy</th>
              <th className="py-2 px-3">Class</th>
              <th className="py-2 px-4">Engineering Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {WATCHDOG_REV_B_BOM.map((row) => (
              <tr key={row.refDes} className="hover:bg-slate-50/70">
                <td className="py-2 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                  {row.refDes}
                </td>
                <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                  {row.qty}
                </td>
                <td className="py-2 px-3 font-mono font-semibold text-blue-800 whitespace-nowrap">
                  {row.value}
                </td>
                <td className="py-2 px-3 text-slate-700">{row.partNumber}</td>
                <td
                  className={`py-2 px-3 font-mono font-semibold ${
                    row.jlcpcbClass === 'Basic' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {row.jlcpcbClass}
                </td>
                <td className="py-2 px-4 text-slate-600">{row.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* GPIO & U4 Pinout Map */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/40">
        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-600 mb-3">
          Raspberry Pi Header &amp; Dedicated U4 (U4A / U4B) Net Map (Pi 3 / 4 / 5 Identical)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {WATCHDOG_PINOUT.map((p) => (
            <div key={p.pin} className="bg-white border border-slate-200 rounded-md p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-slate-900">{p.pin}</span>
                <span className="text-[10.5px] font-mono text-blue-700 font-semibold">{p.net}</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1">{p.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
