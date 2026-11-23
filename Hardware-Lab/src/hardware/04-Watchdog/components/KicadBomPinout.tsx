import React, { useState } from 'react';

interface KicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  jlcpcbClass: 'Basic';
  purpose: string;
}

export const WATCHDOG_REV_B_BOM: KicadBomRow[] = [
  {
    refDes: 'U4',
    qty: 1,
    value: 'LM393DR',
    partNumber: 'LM393DR SOIC-8 (shared Basic reel with Pt1000 U1 & Pump U3)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    jlcpcbClass: 'Basic',
    purpose: 'Dedicated Dual Schmitt Watchdog: U4A = +5V Relay (Q12), U4B = +3.3V Pump (Q15→Q5) + GPIO20/D3',
  },
  {
    refDes: 'C_u4',
    qty: 1,
    value: '100nF X7R',
    partNumber: '0805 100 nF 16 V X7R (shared reel)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Local +5V supply decoupling placed directly across U4 Pin 8 (VCC) and Pin 4 (GND)',
  },
  {
    refDes: 'R48, C16',
    qty: 2,
    value: '4.7k + 100nF',
    partNumber: '0805 4.7 kΩ ±1% + 100 nF X7R (shared reels)',
    footprint: '0805 (R_0805 / C_0805)',
    jlcpcbClass: 'Basic',
    purpose: 'Runaway-loop input LPF (f_c = 340 Hz; rejects ≥ 1 kHz software toggle loops)',
  },
  {
    refDes: 'C17, C19',
    qty: 2,
    value: '1uF X7R',
    partNumber: '0805 1 µF 16 V X7R (shared with Pump Supply)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Two series coupling caps (500 nF eff): double-fault DC blocking if either cap shorts',
  },
  {
    refDes: 'D19, D20',
    qty: 2,
    value: '1N4148W',
    partNumber: '1N4148W SOD-123 (25 nA low leakage)',
    footprint: 'Diode_SMD:D_SOD-123',
    jlcpcbClass: 'Basic',
    purpose: 'Charge-pump clamp (D20) & rectifier (D19); low 60 °C leakage (do NOT use SS14 here)',
  },
  {
    refDes: 'C18A, C18B',
    qty: 2,
    value: '22uF 16V X5R',
    partNumber: '0805 22 µF 16 V X5R (C45783 Basic · 38 µF eff @ 2.2 V DC bias)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Hold capacitor bank on V_CAP (τ = 17.4 s with 500 kΩ; rides through 10 s Linux stalls)',
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
    partNumber: '0805 1% Basic (100k & 47k shared; 220k C17557)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U4A Pin 3 Schmitt divider from +3V3: 1.54 V ON / 0.93 V OFF (0.61 V hyst, 15.4 s relay cutoff)',
  },
  {
    refDes: 'R55B, R56B, R57B',
    qty: 3,
    value: '100k / 47k / 100k',
    partNumber: '0805 1% Basic (all shared reels)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U4B Pin 5 Schmitt divider from +3V3: 1.56 V ON / 0.81 V OFF (0.75 V hyst, 17.7 s pump/RB cutoff)',
  },
  {
    refDes: 'R45, Q12',
    qty: 2,
    value: '10k + AO3401A',
    partNumber: '0805 10 kΩ to +5V + AO3401A P-MOSFET (−30 V, 45 mΩ)',
    footprint: 'R_0805 / SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'U4A Pin 1 (+5V) directly drives Q12 high-side +5V_REL switch (< 5 µs snap; deletes Q13)',
  },
  {
    refDes: 'R51, Q15, R53, R54',
    qty: 4,
    value: '10k×2, 100k, MMBT3906',
    partNumber: '0805 1% Basic + MMBT3906 PNP from +3.3V (shared with H3)',
    footprint: 'R_0805 / SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'U4B Pin 7 (+3.3V) drives GPIO20 + D3 LED directly (deletes Q14!) & Q15 → Q5 gate',
  },
  {
    refDes: 'Q5',
    qty: 1,
    value: 'AO3400A',
    partNumber: 'AO3400A N-MOSFET (30 V, 5.7 A, 35 mΩ @ 3.2 V)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Pump H3 series enable gate driven by independent U4B → Q15 (+3.2 V ON / 0.0 V OFF)',
  },
  {
    refDes: 'JP1, D3, R5',
    qty: 3,
    value: 'JP1, LED, 1.5k',
    partNumber: 'Unpopulated 2-pad copper test point (DNP) + 0805 Green LED + 1.5 kΩ Basic',
    footprint: 'SolderJumper-2 (Open) / LED_0805 / R_0805',
    jlcpcbClass: 'Basic',
    purpose: 'Unpopulated 2-pad bench override JP1 (short with tweezers only during bench tests) & D3 status LED sunk by U4B Pin 7 (1.1 mA)',
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
    note: 'Direct to U4B Pin 7 (+3.3V domain via R51 10 kΩ, Q14 deleted). LOW = WD ON; HIGH > 17.7 s.',
  },
  {
    pin: 'U4A Pin 2 (−) / Pin 3 (+)',
    net: 'WD_VCAP / VREF_A',
    dir: 'Channel A',
    note: 'Pin 2 = V_CAP (38 µF ∥ 500 kΩ). Pin 3 = R55A 100k / R56A 47k / R57A 220k (1.54 V / 0.93 V).',
  },
  {
    pin: 'U4A Pin 1 (OUT)',
    net: '~WD_REL',
    dir: '+5V Relay',
    note: 'Pull-up R45 (10 kΩ) to +5V; drives Q12 AO3401A gate directly (4.85 V OFF, 0.05 V ON; 15.4 s).',
  },
  {
    pin: 'U4B Pin 6 (−) / Pin 5 (+)',
    net: 'WD_VCAP / VREF_B',
    dir: 'Channel B',
    note: 'Pin 6 = V_CAP. Pin 5 = R55B 100k / R56B 47k / R57B 100k (1.56 V / 0.81 V; 17.7 s).',
  },
  {
    pin: 'U4B Pin 7 (OUT)',
    net: '~WD_PUMP_RB',
    dir: '+3.3V Pump/RB',
    note: 'Pull-up R51 (10 kΩ) to +3V3; drives GPIO20 + D3 LED (1.5 kΩ) & Q15 base (R53 10 kΩ) → Q5.',
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
            100% JLCPCB Basic parts (€0.00 fee, €0.21/board, 25 parts). Dedicated U4 (LM393DR, shared reel with Pt1000 U1 &amp; Pump U3) cleanly isolates Relay (U4A) and Pump/GPIO20 (U4B).
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
        Giving the Watchdog its own <span className="font-mono font-semibold">U4 (LM393DR)</span> leaves <span className="font-mono">U3B</span> on <span className="font-semibold">02. Pump Driver Supply (Rev E)</span> cleanly tied off (no 60 kHz switcher coupling into the 500 kΩ <span className="font-mono">V_CAP</span> node), separates the <span className="font-mono">+5V</span> Relay switch (<span className="font-mono font-semibold">U4A → Q12</span>) from the <span className="font-mono">+3.3V</span> Pump/Readback channel (<span className="font-mono font-semibold">U4B → GPIO20 + D3 + Q15 → Q5</span>), and deletes both <span className="font-mono">Q13</span> and <span className="font-mono">Q14</span>.
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
                <td className="py-2 px-3 font-mono text-emerald-700 font-semibold">
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
