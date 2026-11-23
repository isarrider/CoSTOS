import React, { useState } from 'react';

interface KicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  jlcpcbClass: 'Basic' | 'Preferred';
  purpose: string;
}

interface PinoutRow {
  device: string;
  pin: string;
  netName: string;
  direction: string;
  connectionNote: string;
}

export const REV_D_KICAD_BOM: KicadBomRow[] = [
  {
    refDes: 'U1',
    qty: 1,
    value: 'LM393DR',
    partNumber: 'LM393DR (TI / onsemi Dual Comp)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    jlcpcbClass: 'Basic',
    purpose: 'U1A = Duty slicer; U1B = 72 Hz exponential RC ramp (powered from +5V; open-collector outputs pulled to +3V3)',
  },
  {
    refDes: 'Q1, Q2, Q3',
    qty: 3,
    value: 'AO3400A',
    partNumber: 'AO3400A (30 V, 5.7 A, ~30 mΩ)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Low-Rds(on) DC mux switches for PT1 (GPIO 27), R_lo (GPIO 12), R_hi (GPIO 13)',
  },
  {
    refDes: 'R1',
    qty: 1,
    value: '3.90k 0.1%',
    partNumber: '0805 3.90 kΩ ±0.1% 25 ppm/K 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Preferred',
    purpose: 'Upper precision excitation divider leg (+3V3_HAT -> V_DIV); dissipates only 0.11 W under continuous +24 V fault',
  },
  {
    refDes: 'R2',
    qty: 1,
    value: '1.00k 0.1%',
    partNumber: '0805 1.00 kΩ ±0.1% 25 ppm/K',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Preferred',
    purpose: 'Lower 2-point calibration & BIST reference (~0 °C point)',
  },
  {
    refDes: 'R3',
    qty: 1,
    value: '1.80k 0.1%',
    partNumber: '0805 1.80 kΩ ±0.1% 25 ppm/K',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Preferred',
    purpose: 'Upper 2-point calibration & BIST reference (~+212 °C point)',
  },
  {
    refDes: 'R4, R12, R13, R14',
    qty: 4,
    value: '10k 1%',
    partNumber: '0805 10 kΩ ±1% 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'R4 = sense isolator (V_DIV -> U1A+, 36 mW @ +24 V); R12–R14 = stiff 10 kΩ Q1–Q3 gate pull-downs (0.00 V boot-safe + EMI)',
  },
  {
    refDes: 'R5',
    qty: 1,
    value: '47R 1% (0.5W 1206)',
    partNumber: '1206 47 Ω ±1% 0.5 W thick-film',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Low-R Q1 guard (PT1_B -> Q1 Drain): limits ESD/short inrush; ±0.12 K raw, 0.00 K after Setup Wizard cable zero',
  },
  {
    refDes: 'R6, R7',
    qty: 2,
    value: '390k 1%',
    partNumber: '0805 390 kΩ ±1% 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'R6 = 72.2 Hz RC ramp timing (with 20 nF C0G); R7 = U1B upper hysteresis leg (+3V3 -> Pin 5)',
  },
  {
    refDes: 'R8',
    qty: 1,
    value: '100k 1%',
    partNumber: '0805 100 kΩ ±1% 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U1B lower hysteresis leg (Pin 5 -> GND)',
  },
  {
    refDes: 'R9',
    qty: 1,
    value: '150k 1%',
    partNumber: '0805 150 kΩ ±1% 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U1B positive hysteresis feedback (Pin 7 -> Pin 5); sets tight 0.44 V – 1.57 V ramp window (1.7× less jitter)',
  },
  {
    refDes: 'R10, R11',
    qty: 2,
    value: '4.7k 1%',
    partNumber: '0805 4.7 kΩ ±1% 0.125 W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Open-collector pull-ups to +3V3_HAT: R10 on U1A OUT (GPIO 22), R11 on U1B OUT (OSC_OUT)',
  },
  {
    refDes: 'C1, C2',
    qty: 2,
    value: '10nF C0G/NP0',
    partNumber: '0805 10 nF 50 V C0G/NP0 (20 nF parallel)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Genuine JLCPCB Basic C0G/NP0 ramp capacitors (zero dielectric absorption; 72.2 Hz with 390 kΩ R6)',
  },
  {
    refDes: 'C3, C4',
    qty: 2,
    value: '100nF X7R',
    partNumber: '0805 100 nF 16 V X7R',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'C3 = 159 Hz DC EMI filter at U1A+ (with 10 kΩ R4); C4 = local +5V decoupling at U1 Pin 8 & Pin 4',
  },
  {
    refDes: 'D2',
    qty: 1,
    value: 'PESD24VL1BA',
    partNumber: 'PESD24VL1BA / SMAJ24CA (24 V bidirectional ESD TVS)',
    footprint: 'Diode_SMD:D_SOD-323',
    jlcpcbClass: 'Basic',
    purpose: '24 V-standoff ESD/lightning clamp at J1 PT1_A: handles kV ESD without conducting during +24 V DC miswiring',
  },
  {
    refDes: 'D3',
    qty: 1,
    value: 'BZX84C5V1',
    partNumber: 'BZX84C5V1 (5.1 V, 250 mW Zener)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Sense-node clamp (U1A+ -> GND): <5 nA leakage @ <1.3 V (0.00 K error) while clamping +24 V faults safely to 5.1 V',
  },
];

export const REV_D_PINOUT: PinoutRow[] = [
  {
    device: 'Pi Header J8 (Pin 15)',
    pin: 'GPIO 22 (Non-SPI · Boot PD)',
    netName: 'DUTY_IN',
    direction: 'HAT -> Pi Input',
    connectionNote: 'U1A OUT (Pin 1) + R10 (4.7 kΩ to +3V3); shielded from Pin 12 PWM1 by Pin 14 GND; 72 Hz duty square wave (HIGH=Open, LOW=Short)',
  },
  {
    device: 'Pi Header J8 (Pin 13)',
    pin: 'GPIO 27 (Non-SPI · Boot PD)',
    netName: 'PT_SEL',
    direction: 'Pi Output -> HAT',
    connectionNote: 'Drives Q1 Gate (+ R12 10 kΩ pull-down); paired with Pin 15 across Pin 14 GND; native boot pull-DOWN holds Q1 strictly OFF',
  },
  {
    device: 'Pi Header J8 (Pin 32)',
    pin: 'GPIO 12 (Non-SPI · Boot PD)',
    netName: 'REF_LO_SEL',
    direction: 'Pi Output -> HAT',
    connectionNote: 'Drives Q2 Gate (+ R13 10 kΩ pull-down); double-GND shielded (Pin 30/34); HIGH connects R2 (1.00 kΩ 0.1%) to GND',
  },
  {
    device: 'Pi Header J8 (Pin 33)',
    pin: 'GPIO 13 (Non-SPI · Boot PD)',
    netName: 'REF_HI_SEL',
    direction: 'Pi Output -> HAT',
    connectionNote: 'Drives Q3 Gate (+ R14 10 kΩ pull-down); paired with Pin 32 across Pin 34 GND; HIGH connects R3 (1.80 kΩ 0.1%) to GND',
  },
  {
    device: 'Pi Header J8 (Pin 1/17)',
    pin: '+3V3 Power',
    netName: '+3V3_HAT',
    direction: 'Power Rail',
    connectionNote: 'Pin 17 sits right beside Pin 15 (GPIO 22); supplies R1 (3.90 kΩ), R7 (390 kΩ), R10 (4.7 kΩ), R11 (4.7 kΩ) — 100% ratiometric',
  },
  {
    device: 'Pi Header J8 (Pin 2/4)',
    pin: '+5V Power',
    netName: '+5V_COMP',
    direction: 'Power Rail',
    connectionNote: 'Powers U1 Pin 8 (LM393 VCC) + C4 (100 nF) for 0–3.5 V input headroom while OUTA stays 3.3 V',
  },
  {
    device: 'Pi Header J8 (Pin 14/30/34)',
    pin: 'GND',
    netName: 'GND',
    direction: 'Ground',
    connectionNote: 'Pin 14 shields GPIO 22/27; Pins 30/34 shield GPIO 12/13 (GPIO 21 Pin 40 + SPI0 stay 100% free as HAT spares)',
  },
  {
    device: 'U1 (LM393DR, SOIC-8)',
    pin: 'Pin 1 (OUTA) / 2 (INA-) / 3 (INA+)',
    netName: 'DUTY_IN / V_RAMP / V_SENSE',
    direction: 'Slicer Comp',
    connectionNote: 'Pin 3 = V_DIV via R4 (10 kΩ) + C3 (100 nF) + D3 (5.1 V); Pin 2 = 72 Hz V_RAMP; Pin 1 = DUTY_IN',
  },
  {
    device: 'U1 (LM393DR, SOIC-8)',
    pin: 'Pin 5 (INB+) / 6 (INB-) / 7 (OUTB)',
    netName: 'RAMP_TH / V_RAMP / OSC_OUT',
    direction: '72 Hz Ramp',
    connectionNote: 'U1B relaxation RC oscillator (R6=R7=390k, R8=100k, R9=150k, R11=4.7k, C1||C2=20 nF C0G)',
  },
  {
    device: 'J1 Terminal (Pin 1 / 2)',
    pin: 'PT1_A / PT1_B',
    netName: 'PT1_A_EXT / PT1_B_EXT',
    direction: 'Roof Probe',
    connectionNote: 'PT1_A -> D2 (PESD24V to GND) & V_DIV; PT1_B -> R5 (47 Ω 1206 0.5W) -> Q1 Drain',
  },
];

export const KicadBomPinout: React.FC = () => {
  const [downloadedCsv, setDownloadedCsv] = useState(false);

  const totalQty = REV_D_KICAD_BOM.reduce((sum, r) => sum + r.qty, 0);

  const handleDownloadCsv = () => {
    const header = 'Comment,Designator,Footprint,Quantity,JLCPCB Class,Notes';
    const rows = REV_D_KICAD_BOM.map(
      (r) =>
        `"${r.value}","${r.refDes}","${r.footprint}",${r.qty},"${r.jlcpcbClass}","${r.partNumber} — ${r.purpose}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CoSTOS-Switched-Ramp-RevD-Gemini-KiCad-BOM.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2000);
  };

  return (
    <section id="kicad-bom" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-700">
            KiCad &amp; JLCPCB Manufacturing Package · Rev D (Gemini Version)
          </div>
          <h2 className="text-base font-semibold text-slate-900 mt-0.5">
            Switched Ramp Rev D (Gemini Version) — KiCad BOM ({totalQty} Parts) &amp; Raspberry Pi Pinout
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            100% genuine JLCPCB Basic/Preferred parts (€0.42/board, €0.00 fee): sense-side 10 kΩ + BZX84C5V1 (&lt;5 nA leakage), 2× 10 nF Basic C0G ramp, 47 Ω 1206 Q1 guard, and exact ln() math in Rust.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {downloadedCsv ? 'Downloaded KiCad CSV' : 'Download KiCad BOM (.csv)'}
        </button>
      </div>

      {/* Pinout Table */}
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          1. Raspberry Pi 40-Pin Header &amp; IC Pinout Map
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Device / Header</th>
                <th className="py-2.5 px-3.5">Pin / GPIO</th>
                <th className="py-2.5 px-3.5">KiCad Net Name</th>
                <th className="py-2.5 px-3.5">Direction</th>
                <th className="py-2.5 px-3.5">Connection &amp; Engineering Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {REV_D_PINOUT.map((p) => (
                <tr key={`${p.device}-${p.netName}`} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900 whitespace-nowrap">{p.device}</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-700 whitespace-nowrap">{p.pin}</td>
                  <td className="py-2.5 px-3.5 font-mono font-semibold text-blue-700 whitespace-nowrap">{p.netName}</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">{p.direction}</td>
                  <td className="py-2.5 px-3.5 text-slate-700">{p.connectionNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KiCad BOM Table */}
      <div className="px-6 py-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          2. KiCad / JLCPCB Bill of Materials ({REV_D_KICAD_BOM.length} Unique Lines · {totalQty} Total Parts · €0.00 Feeder Fee)
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">RefDes</th>
                <th className="py-2.5 px-3.5 text-right">Qty</th>
                <th className="py-2.5 px-3.5">Value</th>
                <th className="py-2.5 px-3.5">KiCad Footprint</th>
                <th className="py-2.5 px-3.5">Class</th>
                <th className="py-2.5 px-3.5">Role / Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {REV_D_KICAD_BOM.map((b) => (
                <tr key={b.refDes} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">{b.refDes}</td>
                  <td className="py-2.5 px-3.5 font-mono tabular-nums text-right text-slate-700">{b.qty}</td>
                  <td className="py-2.5 px-3.5 font-mono font-medium text-blue-800 whitespace-nowrap">{b.value}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{b.footprint}</td>
                  <td className="py-2.5 px-3.5 font-mono text-emerald-700 font-semibold whitespace-nowrap">{b.jlcpcbClass}</td>
                  <td className="py-2.5 px-3.5 text-slate-700">{b.partNumber} — {b.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
