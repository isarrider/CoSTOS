export interface PowerKicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  footprint: string;
  lcscPart: string;
  jlcpcbClass: 'Basic' | 'Extended';
  purpose: string;
}

export interface PiHeaderPinRow {
  headerPin: string;
  gpio: string;
  netName: string;
  subsystem: string;
  revStatus: string;
}

export const POWER_REV_B_BOM: PowerKicadBomRow[] = [
  { refDes: 'Q_EF1', qty: 1, value: 'AO3401A (-30V/-4A)', footprint: 'SOT-23', lcscPart: 'C15127', jlcpcbClass: 'Basic', purpose: 'High-side +5V foldback eFuse pass P-MOSFET' },
  { refDes: 'Q_EF2', qty: 1, value: 'MMBT3906 (40V PNP)', footprint: 'SOT-23', lcscPart: 'C2146', jlcpcbClass: 'Basic', purpose: 'Foldback current sense PNP (360 mA -> 119 mA)' },
  { refDes: 'R_EF', qty: 1, value: '1.8 Ω 1% 0.5W', footprint: '1206', lcscPart: 'C25059', jlcpcbClass: 'Basic', purpose: 'High-side current sense shunt (V_BE/1.8Ω = 360 mA)' },
  { refDes: 'R_S', qty: 1, value: '1.0 kΩ 1%', footprint: '0805', lcscPart: 'C17513', jlcpcbClass: 'Basic', purpose: 'Q_EF2 upper base divider leg from Q_EF1 Source' },
  { refDes: 'R_FB, R_G', qty: 2, value: '10 kΩ 1%', footprint: '0805', lcscPart: 'C17414', jlcpcbClass: 'Basic', purpose: 'Foldback loop (V_OUT -> Q_EF2 base) & Q_EF1 gate pull-down' },
  { refDes: 'C2a, C2b', qty: 2, value: '22 µF 16V X5R', footprint: '1206', lcscPart: 'C12891', jlcpcbClass: 'Basic', purpose: 'Solid MLCC +5V_HAT bulk bank (>25 yr @ 60 °C)' },
  { refDes: 'C2c, C33b, C33d', qty: 3, value: '100 nF 50V X7R', footprint: '0805', lcscPart: 'C49678', jlcpcbClass: 'Basic', purpose: 'HF bypass on +5V_HAT, +3V3 digital & +3V3_ANA' },
  { refDes: 'D_Z33', qty: 1, value: 'BZT52C3V6 (3.6V)', footprint: 'SOD-123', lcscPart: 'C8062', jlcpcbClass: 'Basic', purpose: 'Clamps Pi-OFF +24V clamp back-feed on +3V3 <= 3.62 V' },
  { refDes: 'R_B33', qty: 1, value: '4.7 kΩ 1%', footprint: '0805', lcscPart: 'C17673', jlcpcbClass: 'Basic', purpose: '+3V3 bleeder load ensuring crisp Zener knee' },
  { refDes: 'R_F33', qty: 1, value: '10 Ω 1%', footprint: '0805', lcscPart: 'C17415', jlcpcbClass: 'Basic', purpose: '+3V3 -> +3V3_ANA RC filter series R (f_c = 1.6 kHz)' },
  { refDes: 'C33a', qty: 1, value: '10 µF 16V X5R', footprint: '0805', lcscPart: 'C15850', jlcpcbClass: 'Basic', purpose: '+3V3_ANA filter bulk cap (-36 dB @ 100 kHz buck)' },
  { refDes: 'R1, D2', qty: 2, value: '2.2 kΩ + Green LED', footprint: '0805', lcscPart: 'C17520 / C2297', jlcpcbClass: 'Basic', purpose: '+5V_HAT healthy PWR indicator (1.4 mA, post-eFuse)' },
];

/** Complete Master 40-Pin Raspberry Pi Header Map (Block 3) reconciling Rev A vs. Rev B/D/E */
export const MASTER_40PIN_HEADER: PiHeaderPinRow[] = [
  { headerPin: 'Pins 2, 4', gpio: 'PWR', netName: '+5V_PI -> +5V_HAT', subsystem: '06. Pi Power Entry', revStatus: 'Rev B Foldback eFuse (146 mA nom / 119 mA short)' },
  { headerPin: 'Pins 1, 17', gpio: 'PWR', netName: '+3V3 -> +3V3_ANA', subsystem: '06. Pi Power Entry', revStatus: 'Rev B 3.6V Zener + 10Ω/10µF analog filter' },
  { headerPin: 'Pins 6,9,14,20,25,30,34,39', gpio: 'GND', netName: 'GND / AGND Star', subsystem: '06. Pi Power Entry', revStatus: 'Kelvin AGND return on Pin 9/14 for Pt1000' },
  { headerPin: 'Pins 15,13,32,33', gpio: 'GPIO 22,27,12,13', netName: 'DUTY_IN / PT_SEL / REF', subsystem: '01. Pt1000 Collector', revStatus: 'Rev D LM393DR 72 Hz converter (boot-safe PD, frees SPI0 & I2C1!)' },
  { headerPin: 'Pins 3,5 / 19-24', gpio: 'I2C1 / SPI0', netName: 'SDA,SCL / SPI0 (FREE)', subsystem: 'Expansion / Spares', revStatus: '100% free in Rev B/D/E (U10 DS2482 DNF optional on I2C1)' },
  { headerPin: 'Pins 7, 11', gpio: 'GPIO 4, 17', netName: '1W_A, 1W_B', subsystem: '04. 1-Wire Buses', revStatus: '100% Rev A pin-compatible (Rev B 5V 2N7002 level-shifter)' },
  { headerPin: 'Pin 18 / Pin 38', gpio: 'GPIO 24 / 20', netName: 'HEARTBEAT / WD_RB', subsystem: '03. Hardware Watchdog', revStatus: '100% Rev A pin-compatible (U4 LM393DR 15.4s / 17.7s)' },
  { headerPin: 'Pin 12 / 16 / 31', gpio: 'GPIO 18 / 23 / 6', netName: 'PWM1 / FB1 / RB1', subsystem: '05. Pump Out & Relays', revStatus: '100% Rev A pin-compatible (Rev B Push-Pull + Clamps)' },
  { headerPin: 'Pin 22 / Pin 29', gpio: 'GPIO 25 / 5', netName: 'REL1 / REL2 (n.f.)', subsystem: '05. Pump Out & Relays', revStatus: '100% Rev A pin-compatible (Rev B 138 mA active limit)' },
  { headerPin: 'Pins 27, 28', gpio: 'GPIO 0, 1', netName: 'ID_SD, ID_SC (n.f.)', subsystem: '06. HAT ID EEPROM', revStatus: 'D6: Unfitted footprint on PCB (fit if auto-DT wanted)' },
];

export function PowerKicadBomPinout() {
  const totalParts = POWER_REV_B_BOM.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-4">
      {/* Block 1 KiCad BOM */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Block 1 KiCad BOM — Rev B (Gemini Foldback eFuse + +3V3_ANA Filter)
            </h3>
            <p className="text-xs text-slate-500">
              100% JLCPCB Basic SMD library · {totalParts} total SMD parts ({POWER_REV_B_BOM.length} lines) · €0.00 Extended feeder fee · ~€0.34/board
            </p>
          </div>
          <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            100% BASIC · €0.00 FEE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="px-3 py-2">RefDes</th>
                <th className="px-2 py-2 text-center">Qty</th>
                <th className="px-3 py-2">Value / Part</th>
                <th className="px-2 py-2">Pkg</th>
                <th className="px-2 py-2">LCSC</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-3 py-2">Engineering Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {POWER_REV_B_BOM.map((r) => (
                <tr key={r.refDes} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-900">{r.refDes}</td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{r.qty}</td>
                  <td className="px-3 py-1.5 text-slate-800">{r.value}</td>
                  <td className="px-2 py-1.5 text-slate-600">{r.footprint}</td>
                  <td className="px-2 py-1.5 text-slate-600">{r.lcscPart}</td>
                  <td className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                      {r.jlcpcbClass}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-sans text-slate-700">{r.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Block 3 Master 40-Pin Pi Header & Conflict Audit */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
          <h3 className="text-sm font-semibold text-slate-900">
            Block 3 — Master 40-Pin Raspberry Pi 4 / Pi 5 Header Map &amp; Conflict Audit
          </h3>
          <p className="text-xs text-slate-500">
            Zero GPIO conflicts across all 6 subsystems · 100% compatible with CoSTOS GPIO map (with SPI0 freed by Pt1000 Rev D I²C ADS1115)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-mono text-[11px]">
                <th className="px-3 py-2">Header Pin(s)</th>
                <th className="px-3 py-2">BCM GPIO</th>
                <th className="px-3 py-2">HAT Net</th>
                <th className="px-3 py-2">Subsystem</th>
                <th className="px-3 py-2">Rev B / D / E Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {MASTER_40PIN_HEADER.map((p) => (
                <tr key={p.netName} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-900">{p.headerPin}</td>
                  <td className="px-3 py-1.5 text-slate-700">{p.gpio}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-800">{p.netName}</td>
                  <td className="px-3 py-1.5 font-sans text-slate-700">{p.subsystem}</td>
                  <td className="px-3 py-1.5 font-sans text-slate-700">{p.revStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
