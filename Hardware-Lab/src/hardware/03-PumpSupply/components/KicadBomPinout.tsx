import React, { useState } from 'react';

export interface PumpKicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  jlcpcbClass: 'Basic' | 'Extended';
  purpose: string;
}

export interface PumpPinoutRow {
  device: string;
  pin: string;
  netName: string;
  direction: string;
  connectionNote: string;
}

export const PUMP_REV_D_BOM: PumpKicadBomRow[] = [
  {
    refDes: 'U3',
    qty: 1,
    value: 'LM393DR2G',
    partNumber: 'onsemi LM393DR2G (LCSC C7955 Basic — same reel as Pt1000 U1 & WD U4)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    jlcpcbClass: 'Basic',
    purpose: 'U3A = guaranteed-start 62 kHz Schmitt osc driving Q17/Q18 CMOS gates; U3B = unused quiet tie-off (Pin5=+5V_HAT, Pin6=GND, Pin7=NC)',
  },
  {
    refDes: 'Q17',
    qty: 1,
    value: 'AO3401A',
    partNumber: 'Alpha & Omega AO3401A -30V P-MOSFET (LCSC C15127 Basic — shared w/ Sub 04/05)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Upper rail-to-rail CMOS driver pushing C22 cleanly to +5V_HAT (eliminates 0.75 V BJT V_BE loss)',
  },
  {
    refDes: 'Q18',
    qty: 1,
    value: 'AO3400A',
    partNumber: 'Alpha & Omega AO3400A 30V N-MOSFET (LCSC C20917 Basic — shared w/ Sub 05)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Lower rail-to-rail CMOS driver pulling C22 cleanly to GND (eliminates bottom 0.70 V BJT V_BE loss)',
  },
  {
    refDes: 'R60A, R60B',
    qty: 2,
    value: '100Ω 1206 (2∥ = 50 Ω)',
    partNumber: 'UNI-ROYAL 100 Ω ±1% 0.25W 1206 (LCSC C17901 Basic — shared w/ 1-Wire, R105 & R9)',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Source-side CMOS shoot-through damper between +5V_HAT and Q17 Source (50 Ω / 0.5 W; caps peak to 89.1 mA, €0.00 Ext fee!)',
  },
  {
    refDes: 'D21, D22',
    qty: 2,
    value: 'SS14',
    partNumber: 'MDD SS14 1 A 40 V Schottky (LCSC C2480 Basic, Vf ≈ 0.28 V @ 15 mA)',
    footprint: 'Diode_SMD:D_SMA',
    jlcpcbClass: 'Basic',
    purpose: 'Low-Vf charge-pump rectifiers (+5V_HAT -> Node A -> +V_DRV); recovers +0.95 V vs D25 1N4148W',
  },
  {
    refDes: 'R54, R56',
    qty: 2,
    value: '100k 1%',
    partNumber: 'UNI-ROYAL 0805 100 kΩ ±1% (LCSC C17407 Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A upper bias (R54) + positive-feedback hysteresis (R56)',
  },
  {
    refDes: 'R55',
    qty: 1,
    value: '47k 1%',
    partNumber: 'UNI-ROYAL 0805 47 kΩ ±1% (LCSC C17713 Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Shifts U3A V_th to 1.21–2.41 V (0.24–0.48·Vcc) so LM393 stays well below V_cm_max even at 4.2 V Pi sag',
  },
  {
    refDes: 'R58',
    qty: 1,
    value: '15k 1%',
    partNumber: 'UNI-ROYAL 0805 15 kΩ ±1% (LCSC C17471 Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A ~57 kHz RC timing resistor (from U3A OUT to U3A− with C20 = 1 nF X7R Basic)',
  },
  {
    refDes: 'R59',
    qty: 1,
    value: '1.5k 1%',
    partNumber: 'UNI-ROYAL 0805 1.5 kΩ ±1% (LCSC C4310 Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A open-collector pull-up to +5V_HAT driving Q17/Q18 gates; caps I_sink ≤ 3.50 mA @ 5.25 V (<4 mA LM393 V_OL spec)',
  },
  {
    refDes: 'C20',
    qty: 1,
    value: '1nF X7R',
    partNumber: '0805 1 nF 50 V ±10% X7R (LCSC C46653 Basic — €0.00 Extended fee!)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A relaxation timing capacitor (~56.9 kHz; SPICE ±15% corner 49.9–66.3 kHz shifts +V_DRV by <1 mV!)',
  },
  {
    refDes: 'C21',
    qty: 1,
    value: '100nF X7R',
    partNumber: 'Samsung 0805 100 nF 50 V X7R (LCSC C49678 Basic)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Local +5V_HAT decoupling directly across U3 Pin 8 and Pin 4',
  },
  {
    refDes: 'C22',
    qty: 1,
    value: '4.7uF 16V',
    partNumber: 'Samsung 0805 4.7 µF 16 V X5R/X7R MLCC (LCSC C1779 Basic)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Flying charge-pump capacitor (SW -> Node A); 4.7 µF @ 62 kHz cuts X_c to 3.4 Ω (>3× stiffer than D25)',
  },
  {
    refDes: 'C23',
    qty: 1,
    value: '10uF 25V',
    partNumber: 'Samsung 0805 10 µF 25 V X5R MLCC (LCSC C15850 Basic)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Output reservoir capacitor (+V_DRV -> GND); holds <25 mVpp ripple @ 62 kHz under 2× pump load',
  },
];

export const PUMP_REV_D_PINOUT: PumpPinoutRow[] = [
  {
    device: 'Pi Header J1 (Pin 2/4)',
    pin: '+5V_HAT (D18 Direct)',
    netName: '+5V_HAT',
    direction: 'Power Input',
    connectionNote: 'D18 direct Pi +5 V (5.045 V nominal, zero eFuse drop) feeds U3 Pin 8, R60→Q17, D21 Anode, R54, R59; draws ~12.6 mA (1 pump)',
  },
  {
    device: 'Pi Header J1 (GND)',
    pin: 'GND',
    netName: 'GND',
    direction: 'Ground',
    connectionNote: 'Common return for U3 Pin 4, Q18 Source, C20, C21, C23, and Sub 05 Rev B push-pull pump driver',
  },
  {
    device: 'U3 (LM393DR2G, C7955)',
    pin: 'Pin 1 / 2 / 3 (U3A)',
    netName: 'DRV_OSC / C_OSC / TH_A',
    direction: '62 kHz Osc + Drive',
    connectionNote: 'Schmitt osc (R54/R56=100k, R55=47k -> V_th 1.21–2.41 V; R58=15k, C20=1nF -> 62 kHz); R59=1.5k pull-up (≤3.5 mA sink) directly drives Q17/Q18 CMOS gates',
  },
  {
    device: 'U3 (LM393DR2G, C7955)',
    pin: 'Pin 5 / 6 / 7 (U3B)',
    netName: '+5V_HAT / GND / NC',
    direction: 'Unused Tie-Off',
    connectionNote: 'Deterministic quiet state: Pin 5 (INB+) -> +5V_HAT, Pin 6 (INB−) -> GND, Pin 7 (OUTB) -> NC (zero oscillation or extra draw)',
  },
  {
    device: 'Output Rail',
    pin: '+V_DRV Rail',
    netName: '+V_DRV',
    direction: 'Supply Output',
    connectionNote: '+9.193 V nominal (+7.649 V at J2 PWM1) under D18 +5V_HAT = 5.045 V; ±15% C20 X7R corner shifts +V_DRV by <1 mV (ngspice-39 verified)',
  },
  {
    device: 'Sub 05 Readback & R9A+B',
    pin: 'R31 / R32 -> GPIO 6',
    netName: 'PWM1_RB',
    direction: 'HAT -> Pi Input',
    connectionNote: 'Locked Sub 05 Basic values: R9A+R9B = 2×100 Ω 1206 (200 Ω, 39.1 mA short limit), R31 = 22 kΩ / R32 = 10 kΩ + D18 1N4148W clamp → 2.393 V nominal',
  },
];

export const PumpKicadBomPinout: React.FC = () => {
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const totalQty = PUMP_REV_D_BOM.reduce((s, r) => s + r.qty, 0);

  const handleDownloadCsv = () => {
    const header = 'Comment,Designator,Footprint,Quantity,JLCPCB Class,Notes';
    const rows = PUMP_REV_D_BOM.map(
      (r) =>
        `"${r.value}","${r.refDes}","${r.footprint}",${r.qty},"${r.jlcpcbClass}","${r.partNumber} — ${r.purpose}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CoSTOS-Pump-Supply-RevE-KiCad-BOM.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2000);
  };

  return (
    <section id="pump-kicad-bom" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-700">
            KiCad &amp; JLCPCB Manufacturing Package · Pump PWM Supply Rev E (Locked)
          </div>
          <h2 className="text-base font-semibold text-slate-900 mt-0.5">
            LM393DR2G + CMOS + SS14 Doubler Rev E — KiCad BOM ({totalQty} Parts) &amp; Net Map
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            100% JLCPCB Basic BOM (€0.00 Extended fees! €0.24/bd parts): Tier 1+2 swapped R60 to R60A||B (2×100 Ω Basic C17901 = 50 Ω) and C20 to 1 nF X7R Basic (C46653, &lt;1 mV drift across ±15%). Shares LM393DR2G (C7955) and AO3401A/AO3400A across the HAT.
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

      <div className="px-6 pt-5 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          1. Power Rails, IC Pinout &amp; Readback Scaling Map
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Device / Interface</th>
                <th className="py-2.5 px-3.5">Pin / Rail</th>
                <th className="py-2.5 px-3.5">KiCad Net Name</th>
                <th className="py-2.5 px-3.5">Role</th>
                <th className="py-2.5 px-3.5">Engineering &amp; Layout Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {PUMP_REV_D_PINOUT.map((p) => (
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

      <div className="px-6 py-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          2. KiCad / JLCPCB Bill of Materials ({PUMP_REV_D_BOM.length} Unique Lines · {totalQty} Total Parts · 100% Basic, €0.00 Ext)
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
              {PUMP_REV_D_BOM.map((b) => (
                <tr key={b.refDes} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">{b.refDes}</td>
                  <td className="py-2.5 px-3.5 font-mono tabular-nums text-right text-slate-700">{b.qty}</td>
                  <td className="py-2.5 px-3.5 font-mono font-medium text-blue-800 whitespace-nowrap">{b.value}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{b.footprint}</td>
                  <td className="py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap">
                    <span className={b.jlcpcbClass === 'Basic' ? 'text-emerald-700' : 'text-amber-700'}>
                      {b.jlcpcbClass}
                    </span>
                  </td>
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
