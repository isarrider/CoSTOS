export interface OutputKicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  footprint: string;
  lcsc: string;
  jlcpcbClass: 'Basic';
  purpose: string;
}

export interface OutputPinoutRow {
  device: string;
  pin: string;
  netName: string;
  connectionNote: string;
}

export const OUTPUT_REV_B_BOM: OutputKicadBomRow[] = [
  {
    refDes: 'Q4, Q6, Q2L',
    qty: 3,
    value: 'MMBT3904',
    footprint: 'SOT-23',
    lcsc: 'C20526',
    jlcpcbClass: 'Basic',
    purpose: '40 V 200 mA NPN: PWM switch (Q4), Class-B high-side emitter-follower (Q6), REL1 138 mA active current limiter (Q2L)',
  },
  {
    refDes: 'Q7, Q8',
    qty: 2,
    value: 'MMBT3906',
    footprint: 'SOT-23',
    lcsc: 'C2146',
    jlcpcbClass: 'Basic',
    purpose: '40 V 200 mA PNP: Class-B low-side emitter-follower (Q7) & hard-off pre-driver stage (Q8)',
  },
  {
    refDes: 'Q5',
    qty: 1,
    value: '2N7002',
    footprint: 'SOT-23',
    lcsc: 'C8545',
    jlcpcbClass: 'Basic',
    purpose: '60 V N-MOSFET watchdog series-AND switch driven by WD_OK (+3.3 V from Watchdog Rev B Q15)',
  },
  {
    refDes: 'Q2',
    qty: 1,
    value: 'AO3400A',
    footprint: 'SOT-23',
    lcsc: 'C20917',
    jlcpcbClass: 'Basic',
    purpose: '30 V 5.7 A low-Rds(on) N-MOSFET low-side REL1/SSR driver (protected by Q2L + R2S 4.7 Ohm)',
  },
  {
    refDes: 'D4a, D4b, D17a, D17b, D18',
    qty: 5,
    value: '1N4148W',
    footprint: 'SOD-123',
    lcsc: 'C81598',
    jlcpcbClass: 'Basic',
    purpose: '4 pF fast ESD/overvoltage steering clamps for J2 PWM (D4a/b), J2 FB1 (D17a/b), and RB1 GPIO6 (D18 -> +3V3)',
  },
  {
    refDes: 'D6',
    qty: 1,
    value: 'SS14',
    footprint: 'SMA',
    lcsc: 'C2480',
    jlcpcbClass: 'Basic',
    purpose: '40 V 1 A Schottky inductive flyback diode across J4 REL1 (replaces undersized 150 mA 1N4148W)',
  },
  {
    refDes: 'R9',
    qty: 1,
    value: '220 Ω 0.5W',
    footprint: '1206',
    lcsc: 'C17956',
    jlcpcbClass: 'Basic',
    purpose: 'Series PWM fault/short limiter OUTSIDE Q6/Q7 (35 mA / 0.27 W indefinite GND short; +12V/+24V safe)',
  },
  {
    refDes: 'R12',
    qty: 1,
    value: '2.2 kΩ 0.5W',
    footprint: '1206',
    lcsc: 'C17924',
    jlcpcbClass: 'Basic',
    purpose: 'Series FB1 fault limiter FIRST at J2 Pin 3 (survives continuous +24 V miswire at 0.18 W)',
  },
  {
    refDes: 'R2S',
    qty: 1,
    value: '4.7 Ω 0.5W',
    footprint: '1206',
    lcsc: 'C17972',
    jlcpcbClass: 'Basic',
    purpose: 'REL1 source current-sense shunt triggering Q2L foldback at ~138 mA (0.09 W in dead short)',
  },
  {
    refDes: 'R31, R11',
    qty: 2,
    value: '22 kΩ 1%',
    footprint: '0805',
    lcsc: 'C17560',
    jlcpcbClass: 'Basic',
    purpose: 'Readback RB1 upper divider (R31) & FB1 +3V3 pull-up (R11 -> 0.48 V V_OL with R12=2.2k)',
  },
  {
    refDes: 'R15, R32, R33',
    qty: 3,
    value: '10 kΩ 1%',
    footprint: '0805',
    lcsc: 'C17414',
    jlcpcbClass: 'Basic',
    purpose: 'REL1 gate foldback series R (R15), RB1 lower divider (R32 -> 2.34 V @ 7.5 V), PWM1 base drive (R33)',
  },
  {
    refDes: 'R35, R36, R38',
    qty: 3,
    value: '4.7 kΩ 1%',
    footprint: '0805',
    lcsc: 'C17673',
    jlcpcbClass: 'Basic',
    purpose: 'Q8 base drive (R35), Q8 hard-off E-B bleed (R36 -> 0 V at 60°C), J2 PWM idle pull-down (R38)',
  },
  {
    refDes: 'R22, R37',
    qty: 2,
    value: '2.2 kΩ 1%',
    footprint: '0805',
    lcsc: 'C17520',
    jlcpcbClass: 'Basic',
    purpose: 'PUMP1 LED series resistor (R22) & NODE_DRV active pull-down drive (R37 for Q7 PNP)',
  },
  {
    refDes: 'R7, R16, R19',
    qty: 3,
    value: '100 kΩ 1%',
    footprint: '0805',
    lcsc: 'C149504',
    jlcpcbClass: 'Basic',
    purpose: 'Boot-safe pull-downs on GPIO18 (PWM1), GPIO25 (REL1), and GPIO5 (REL2 spare)',
  },
  {
    refDes: 'R17',
    qty: 1,
    value: '1.0 kΩ 1%',
    footprint: '0805',
    lcsc: 'C17513',
    jlcpcbClass: 'Basic',
    purpose: 'REL1 yellow status LED series resistor (3 mA @ +5V_REL)',
  },
  {
    refDes: 'C9',
    qty: 1,
    value: '10 nF X7R',
    footprint: '0805',
    lcsc: 'C1710',
    jlcpcbClass: 'Basic',
    purpose: 'FB1 RC noise filter (f_c = 723 Hz — clean 75 Hz Grundfos/Wilo feedback, rejects 50 Hz EMI)',
  },
  {
    refDes: 'D7, D12',
    qty: 2,
    value: 'LED 0805',
    footprint: '0805',
    lcsc: 'C2296',
    jlcpcbClass: 'Basic',
    purpose: 'Visual status indicators: D12 green (PUMP1 PWM activity), D7 yellow (REL1 energized)',
  },
];

export const OUTPUT_REV_B_PINOUT: OutputPinoutRow[] = [
  {
    device: 'Raspberry Pi',
    pin: 'GPIO 18 (Pin 12)',
    netName: 'PWM1',
    connectionNote: 'Hardware PWM0 (100–1000 Hz) -> R7 (100k GND) + R33 (10k) -> Q4 Base',
  },
  {
    device: 'Watchdog Rev B',
    pin: 'Q15 Collector',
    netName: 'WD_OK',
    connectionNote: '+3.3 V when heartbeat alive (0 V on fault) -> Q5 (2N7002) Gate (series-AND with Q4)',
  },
  {
    device: 'Raspberry Pi',
    pin: 'GPIO 23 (Pin 16)',
    netName: 'FB1',
    connectionNote: '75 Hz pump feedback via R12 (2.2k 0.5W) + D17a/b (1N4148W) + R11 (22k -> +3V3) + C9 (10 nF)',
  },
  {
    device: 'Raspberry Pi',
    pin: 'GPIO 6 (Pin 31)',
    netName: 'RB1',
    connectionNote: 'PWM output readback via R31 (22k) / R32 (10k) + D18 (1N4148W -> +3V3); 2.34 V @ 7.5 V PWM',
  },
  {
    device: 'Raspberry Pi',
    pin: 'GPIO 25 (Pin 22)',
    netName: 'REL1',
    connectionNote: 'Low-side relay/SSR enable -> R16 (100k GND) + R15 (10k) -> Q2 (AO3400A) Gate w/ Q2L foldback',
  },
  {
    device: 'Raspberry Pi',
    pin: 'GPIO 5 (Pin 29)',
    netName: 'REL2 (Spare)',
    connectionNote: 'Pulled low by R19 (100k); unpopulated identical REL2 footprint (J5) for future expansion',
  },
  {
    device: 'J2 (PUMP1)',
    pin: 'Pin 1 / 2 / 3',
    netName: 'PWM / GND / FB',
    connectionNote: 'Brown = PWM (after R9 220R 0.5W), Blue = GND, Black = FB (before R12 2.2k 0.5W)',
  },
  {
    device: 'J4 (REL1)',
    pin: 'Pin 1 / 2',
    netName: '+5V_REL / OUT',
    connectionNote: 'Pin 1 = Watchdog-switched +5V_REL (Q12), Pin 2 = Q2 Drain (138 mA short-limited, SS14 D6 flyback)',
  },
];

export function OutputKicadBomPinout() {
  const totalParts = OUTPUT_REV_B_BOM.reduce((sum, r) => sum + r.qty, 0);
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              KiCad Production BOM — 05. Pump PWM &amp; Relay Stage Rev B (Gemini Version)
            </h3>
            <p className="text-xs text-slate-500">
              {totalParts} SMD parts ({OUTPUT_REV_B_BOM.length} unique Basic lines) · 100% JLCPCB Basic (€0.00 feeder fees) · ~€0.56/board
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            €0.00 Extended Fees
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="py-2 px-3">RefDes</th>
                <th className="py-2 px-2 text-center">Qty</th>
                <th className="py-2 px-3">Value</th>
                <th className="py-2 px-3">Package</th>
                <th className="py-2 px-3">LCSC</th>
                <th className="py-2 px-3">Class</th>
                <th className="py-2 px-3">Engineering Function</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OUTPUT_REV_B_BOM.map((row) => (
                <tr key={row.refDes} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{row.refDes}</td>
                  <td className="py-2 px-2 font-mono text-center text-slate-700">{row.qty}</td>
                  <td className="py-2 px-3 font-mono font-semibold text-cyan-800 whitespace-nowrap">{row.value}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{row.footprint}</td>
                  <td className="py-2 px-3 font-mono font-semibold text-emerald-700">{row.lcsc}</td>
                  <td className="py-2 px-3 font-mono text-emerald-700 font-semibold">{row.jlcpcbClass}</td>
                  <td className="py-2 px-3 text-slate-600">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">
            Raspberry Pi GPIO, Watchdog Interface &amp; J2 / J4 Screw Terminal Pinout
          </h3>
          <p className="text-xs text-slate-500">
            Zero pin conflicts with Pt1000 Rev D (GPIO 27/22/12/13), Pump Supply Rev E (GPIO 26), Watchdog Rev B (GPIO 24/20), or 1-Wire Rev B (GPIO 4/17)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-mono text-[11px]">
                <th className="py-2 px-3">Block</th>
                <th className="py-2 px-3">Pin / Signal</th>
                <th className="py-2 px-3">Net Name</th>
                <th className="py-2 px-3">Connection &amp; Protection Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OUTPUT_REV_B_PINOUT.map((row) => (
                <tr key={row.netName} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">{row.device}</td>
                  <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{row.pin}</td>
                  <td className="py-2 px-3 font-mono font-bold text-cyan-800 whitespace-nowrap">{row.netName}</td>
                  <td className="py-2 px-3 text-slate-600">{row.connectionNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
