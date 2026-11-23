import React, { useState } from 'react';

export interface PumpKicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  jlcpcbClass: 'Basic';
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
    value: 'LM393DR',
    partNumber: 'LM393DR (TI / onsemi Dual Comp — same reel as Pt1000 U1)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    jlcpcbClass: 'Basic',
    purpose: 'U3A = guaranteed-start 60 kHz Schmitt osc driving Q17/Q18 directly; U3B = unused quiet tie-off (Pin5=+5V, Pin6=GND, Pin7=NC)',
  },
  {
    refDes: 'Q17',
    qty: 1,
    value: 'MMBT3904',
    partNumber: 'MMBT3904 (40 V 200 mA NPN — same reel as H3 Q4/Q7)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Upper emitter follower pushing C22 high (+5V collector); natural 1.4 V dead-band prevents shoot-through',
  },
  {
    refDes: 'Q18',
    qty: 1,
    value: 'MMBT3906',
    partNumber: 'MMBT3906 (40 V 200 mA PNP — same reel as H3 Q6)',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    jlcpcbClass: 'Basic',
    purpose: 'Lower emitter follower pulling C22 low (GND collector); zero shoot-through on Pi +5 V rail',
  },
  {
    refDes: 'D21, D22',
    qty: 2,
    value: 'SS14',
    partNumber: 'SS14 (1 A 40 V Schottky, LCSC C2480, Vf ≈ 0.28 V @ 15 mA)',
    footprint: 'Diode_SMD:D_SMA',
    jlcpcbClass: 'Basic',
    purpose: 'Low-Vf charge-pump rectifiers (+5V -> Node A -> +V_DRV); recovers +0.95 V vs D25’s 1N4148W',
  },
  {
    refDes: 'R54, R56',
    qty: 2,
    value: '100k 1%',
    partNumber: '0805 100 kΩ ±1% 0.125 W (shared Basic reel)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A upper bias (R54) + positive-feedback hysteresis (R56)',
  },
  {
    refDes: 'R55',
    qty: 1,
    value: '47k 1%',
    partNumber: '0805 47 kΩ ±1% 0.125 W (shared Basic reel)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Shifts U3A V_th to 1.21–2.41 V (0.24–0.48·Vcc) so LM393 stays well below V_cm_max even at 4.2 V Pi sag',
  },
  {
    refDes: 'R58',
    qty: 1,
    value: '15k 1%',
    partNumber: '0805 15 kΩ ±1% 0.125 W (shared Basic reel with H3 R31!)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A 60 kHz RC timing resistor (from U3A OUT to U3A− with C20 = 1 nF C0G); consolidates reel with H3 R31',
  },
  {
    refDes: 'R59',
    qty: 1,
    value: '1.5k 1%',
    partNumber: '0805 1.5 kΩ ±1% 0.125 W (Basic)',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A open-collector pull-up to +5V driving Q17/Q18 bases; caps I_sink ≤ 3.50 mA @ 5.25 V (<4 mA LM393 V_OL spec)',
  },
  {
    refDes: 'C20',
    qty: 1,
    value: '1nF C0G',
    partNumber: '0805 1 nF 50 V C0G/NP0',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'U3A relaxation timing capacitor (sets ~60 kHz with 15 kΩ R58, zero temp drift)',
  },
  {
    refDes: 'C21',
    qty: 1,
    value: '100nF X7R',
    partNumber: '0805 100 nF 16 V X7R (shared Basic reel)',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Local +5V decoupling directly across U3 Pin 8 and Pin 4',
  },
  {
    refDes: 'C22',
    qty: 1,
    value: '4.7uF 16V X7R',
    partNumber: '0805 4.7 µF 16 V X7R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Flying charge-pump capacitor (SW -> Node A); 4.7 µF @ 60 kHz cuts X_c to 3.55 Ω (>3× stiffer than D25)',
  },
  {
    refDes: 'C23',
    qty: 1,
    value: '10uF 16V X7R',
    partNumber: '0805 10 µF 16 V X7R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    jlcpcbClass: 'Basic',
    purpose: 'Output reservoir capacitor (+V_DRV -> GND); holds <25 mVpp ripple @ 60 kHz under 2× pump load',
  },
];

export const PUMP_REV_D_PINOUT: PumpPinoutRow[] = [
  {
    device: 'Pi Header J8 (Pin 2/4)',
    pin: '+5V Power',
    netName: '+5V_PI',
    direction: 'Power Input',
    connectionNote: 'Feeds U3 Pin 8, Q17 Collector, D21 Anode, R54, R59; draws ~18 mA @ 1 pump (~50 mA @ 2 stress pumps)',
  },
  {
    device: 'Pi Header J8 (GND)',
    pin: 'GND',
    netName: 'GND',
    direction: 'Ground',
    connectionNote: 'Common return for U3 Pin 4, Q18 Collector, C20, C21, C23, and H3 pump driver',
  },
  {
    device: 'U3 (LM393DR, SOIC-8)',
    pin: 'Pin 1 / 2 / 3 (U3A)',
    netName: 'DRV_OSC / C_OSC / TH_A',
    direction: '60 kHz Osc + Drive',
    connectionNote: 'Schmitt osc (R54/R56=100k, R55=47k -> V_th 1.21–2.41 V; R58=15k, C20=1nF -> 60.2 kHz); R59=1.5k pull-up (≤3.5 mA sink) directly drives Q17/Q18 bases',
  },
  {
    device: 'U3 (LM393DR, SOIC-8)',
    pin: 'Pin 5 / 6 / 7 (U3B)',
    netName: '+5V / GND / NC',
    direction: 'Unused Tie-Off',
    connectionNote: 'Deterministic quiet state: Pin 5 (INB+) -> +5V, Pin 6 (INB−) -> GND, Pin 7 (OUTB) -> NC (zero oscillation or extra draw)',
  },
  {
    device: 'Output Link (R26 0 Ω)',
    pin: '+V_DRV Rail',
    netName: '+V_DRV',
    direction: 'Supply Output',
    connectionNote: '~8.1 V (1 normal pump) / ~6.75 V (2 stress pumps @ 4.63 V UV); feeds H3 Q6 Emitter & R36 (2.2 kΩ)',
  },
  {
    device: 'H3 Readback Update',
    pin: 'R31 / R32 -> GPIO 6',
    netName: 'PWM1_RB',
    direction: 'HAT -> Pi Input',
    connectionNote: 'Change R31 from 12 kΩ -> 15 kΩ (same Basic reel as R58!, keep R32 = 8.2 kΩ): 2.72 V nominal, ≤3.12 V max @ 5.25 V, 1.41 V dead-osc LOW',
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
    a.download = 'CoSTOS-Pump-Supply-RevE-Gemini-KiCad-BOM.csv';
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
            KiCad &amp; JLCPCB Manufacturing Package · Pump PWM Supply Rev E (Gemini Version)
          </div>
          <h2 className="text-base font-semibold text-slate-900 mt-0.5">
            LM393 + SS14 Doubler Rev E (Gemini Version) — KiCad BOM ({totalQty} Parts) &amp; Net Map
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            100% genuine JLCPCB Basic parts (€0.18/board, €0.00 fee, exact same 14-part count as D25): shares LM393DR with Pt1000 Gemini Rev D, 15 kΩ with H3 R31, and MMBT3904/3906 with H3. Zero GPIOs consumed.
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
          2. KiCad / JLCPCB Bill of Materials ({PUMP_REV_D_BOM.length} Unique Lines · {totalQty} Total Parts · €0.00 Feeder Fee)
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
