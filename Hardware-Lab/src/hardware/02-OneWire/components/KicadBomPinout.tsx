import { useState } from 'react';

export interface OneWireKicadBomRow {
  refDes: string;
  qty: number;
  value: string;
  partNumber: string;
  footprint: string;
  lcsc: string;
  jlcpcbClass: 'Basic' | 'THT (Shared)';
  unitEur: number;
  purpose: string;
}

export const ONEWIRE_REV_B_BOM: OneWireKicadBomRow[] = [
  {
    refDes: 'Q19, Q20',
    qty: 2,
    value: '2N7002',
    partNumber: '2N7002 (60 V 115 mA N-MOSFET, V_GS(th) 1.0–2.5 V)',
    footprint: 'SOT-23-3',
    lcsc: 'C8545',
    jlcpcbClass: 'Basic',
    unitEur: 0.01,
    purpose: '3.3 V ↔ 5 V bidirectional bus level shifter & +60 V fault blocker for 1W-A (Q19) and 1W-B (Q20)',
  },
  {
    refDes: 'D23, D24, D25, D27, D28',
    qty: 5,
    value: '1N4148W',
    partNumber: '1N4148W (75 V 150 mA 4 pF Fast Switching Diode)',
    footprint: 'SOD-123',
    lcsc: 'C81598',
    jlcpcbClass: 'Basic',
    unitEur: 0.006,
    purpose: 'D23 sets shared temp-tracked V_G = +3V3 + 0.62 V = 3.92 V (@ 0.7 mA); D24/D25 (A) & D27/D28 (B) = 4 pF ESD steering (+5V/GND)',
  },
  {
    refDes: 'D26, D29',
    qty: 2,
    value: 'SS14',
    partNumber: 'SS14 (40 V 1 A Schottky — shared with Pump Rev E!)',
    footprint: 'SMA (DO-214AC)',
    lcsc: 'C2480',
    jlcpcbClass: 'Basic',
    unitEur: 0.02,
    purpose: 'Per-bus 40 V reverse-voltage blocking on +5V_1WA (D26) and +5V_1WB (D29); blocks +12 V/+24 V/+40 V miswiring from Pi +5V',
  },
  {
    refDes: 'R63, R64, R67, R68',
    qty: 4,
    value: '100 Ω 0.5 W',
    partNumber: '1206 100 Ω ±1% 0.5 W (shared with H3 R9!)',
    footprint: 'R_1206',
    lcsc: 'C17901',
    jlcpcbClass: 'Basic',
    unitEur: 0.01,
    purpose: 'R64/R68 = per-bus VDD short limiters (47 mA, 0.22 W continuous); R63/R67 = DQ surge/+12 V current limiters (0.38 W max)',
  },
  {
    refDes: 'R62, R66',
    qty: 2,
    value: '2.2 kΩ',
    partNumber: '0805 2.2 kΩ ±1% 0.125 W (shared with H3 R36!)',
    footprint: 'R_0805',
    lcsc: 'C17520',
    jlcpcbClass: 'Basic',
    unitEur: 0.005,
    purpose: 'Field-side 5 V bus pull-ups tapped at D26/D29 cathode (ahead of R64/R68!) — zero Reset-pulse droop on sensor VDD',
  },
  {
    refDes: 'R61, R65',
    qty: 2,
    value: '10 kΩ',
    partNumber: '0805 10 kΩ ±1% 0.125 W (shared board-wide!)',
    footprint: 'R_0805',
    lcsc: 'C17414',
    jlcpcbClass: 'Basic',
    unitEur: 0.005,
    purpose: 'Pi-side 3.3 V pull-ups (GPIO 4/17 -> +3V3); 150 ns rise on 15 pF trace & halves body-diode current for extra 2N7002 V_th margin',
  },
  {
    refDes: 'R60',
    qty: 1,
    value: '1.5 kΩ',
    partNumber: '0805 1.5 kΩ ±1% 0.125 W (shared with Pump Rev E R59!)',
    footprint: 'R_0805',
    lcsc: 'C22843',
    jlcpcbClass: 'Basic',
    unitEur: 0.005,
    purpose: 'Shared 0.71 mA bias feed (+5V -> V_G_1W -> D23 -> +3V3) setting V_G = 3.92 V (+0.23 V min overdrive even at 0 °C worst-case!)',
  },
  {
    refDes: 'C24, C25, C26',
    qty: 3,
    value: '100 nF',
    partNumber: '0805 100 nF 50 V X7R (shared board-wide!)',
    footprint: 'C_0805',
    lcsc: 'C49678',
    jlcpcbClass: 'Basic',
    unitEur: 0.007,
    purpose: 'C24 stiffens V_G_1W against switching coupling; C25/C26 decouple +5V_1WA & +5V_1WB directly at J6 (DG350-3.5-08P) pins 3 & 6',
  },
];

export interface OneWirePinoutRow {
  device: string;
  pin: string;
  netName: string;
  direction: string;
  connectionNote: string;
}

export const ONEWIRE_REV_B_PINOUT: OneWirePinoutRow[] = [
  {
    device: 'Pi 40-Pin Header',
    pin: 'Pin 7 (GPIO 4 · GPCLK0)',
    netName: '1W_A_PI',
    direction: 'Bidirectional OD',
    connectionNote: 'Q19 Source + R61 (10 kΩ to +3V3); dtoverlay=w1-gpio-pi5,gpiopin=4 (strictly 0–3.3 V, 0 mA fault injection)',
  },
  {
    device: 'Pi 40-Pin Header',
    pin: 'Pin 11 (GPIO 17)',
    netName: '1W_B_PI',
    direction: 'Bidirectional OD',
    connectionNote: 'Q20 Source + R65 (10 kΩ to +3V3); dtoverlay=w1-gpio-pi5,gpiopin=17 (independent Bus B, shielded by Pin 9 GND)',
  },
  {
    device: 'Shared Gate Ref',
    pin: 'R60 / D23 / C24',
    netName: 'V_G_1W',
    direction: '3.92 V Bias',
    connectionNote: '+5V -> R60 (1.5 kΩ, 0.71 mA) -> V_G_1W -> D23 (1N4148W) -> +3V3 + C24 (100 nF -> GND); feeds Q19 & Q20 Gates',
  },
  {
    device: 'J6 DG350-08P (1W-A)',
    pin: 'Pin 3 / Pin 4 / Pin 5',
    netName: '+5V_1WA / 1W_A_DQ / GND',
    direction: 'Field Bus A',
    connectionNote: 'Pin 3: D26 (SS14) -> R64 (100 Ω 0.5 W) + C25 (100 nF); R62 (2.2 kΩ) taps D26 cathode ahead of R64! Pin 4: R63 (100 Ω 0.5 W) -> Q19 Drain; Pin 5: GND',
  },
  {
    device: 'J6 DG350-08P (1W-B)',
    pin: 'Pin 6 / Pin 7 / Pin 8',
    netName: '+5V_1WB / 1W_B_DQ / GND',
    direction: 'Field Bus B',
    connectionNote: 'Pin 6: D29 (SS14) -> R68 (100 Ω 0.5 W) + C26 (100 nF); R66 (2.2 kΩ) taps D29 cathode ahead of R68! Pin 7: R67 (100 Ω 0.5 W) -> Q20 Drain; Pin 8: GND',
  },
  {
    device: 'Optional DNF Pads',
    pin: 'Pi Pins 3 & 5 (I²C1)',
    netName: 'SDA1 / SCL1 (U10 DNF)',
    direction: 'Spare Fallback',
    connectionNote: 'Unpopulated DS2482-100 footprint (U10) kept only as optional >80 m extreme-plant fallback; Rev B needs 0 I²C chips',
  },
];

export function OneWireKicadBomPinout() {
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const totalQty = ONEWIRE_REV_B_BOM.reduce((s, r) => s + r.qty, 0);
  const totalEur = ONEWIRE_REV_B_BOM.reduce((s, r) => s + r.qty * r.unitEur, 0);

  const handleDownloadCsv = () => {
    const header = [
      'Designator',
      'Qty',
      'Value',
      'Description',
      'Footprint',
      'LCSC Part #',
      'JLCPCB Class',
      'Unit EUR',
      'Purpose',
    ];
    const lines = [
      header.join(','),
      ...ONEWIRE_REV_B_BOM.map((r) =>
        [
          `"${r.refDes}"`,
          r.qty,
          `"${r.value}"`,
          `"${r.partNumber}"`,
          `"${r.footprint}"`,
          r.lcsc,
          r.jlcpcbClass,
          r.unitEur.toFixed(3),
          `"${r.purpose}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CoSTOS-1Wire-RevB-Gemini-KiCad-BOM.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2000);
  };

  return (
    <section id="onewire-kicad-bom" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-700">
            KiCad &amp; JLCPCB Manufacturing Package · 1-Wire Bus Rev B (Gemini Version)
          </div>
          <h2 className="text-base font-semibold text-slate-900 mt-0.5">
            5 V Diode-Biased 2N7002 + SS14/100 Ω Dual 1-Wire Bus — KiCad BOM ({totalQty} SMD Parts) &amp; Pinout
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            100% genuine JLCPCB Basic parts (€{totalEur.toFixed(2)}/board for BOTH buses, €0.00 fee — deletes €5.60 extended fees on F2 PTC + PESD5V0; 7 of 8 part lines already shared with Pt1000 / Pump / Watchdog!).
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {downloadedCsv ? 'Downloaded KiCad CSV' : 'Download KiCad BOM (.csv)'}
        </button>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          1. Dual-Bus KiCad Component Table (Both 1W-A &amp; 1W-B · 8 Unique Basic Lines · €0.00 Fee)
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3">RefDes</th>
                <th className="py-2.5 px-2 text-center">Qty</th>
                <th className="py-2.5 px-3">Value</th>
                <th className="py-2.5 px-3">Footprint</th>
                <th className="py-2.5 px-3">LCSC</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Engineering Function</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {ONEWIRE_REV_B_BOM.map((r) => (
                <tr key={r.refDes} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{r.refDes}</td>
                  <td className="py-2 px-2 font-mono text-center text-slate-700 tabular-nums">{r.qty}</td>
                  <td className="py-2 px-3 font-mono font-semibold text-cyan-800 whitespace-nowrap">{r.value}</td>
                  <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{r.footprint}</td>
                  <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{r.lcsc}</td>
                  <td className="py-2 px-3 font-mono font-semibold text-emerald-700 whitespace-nowrap">{r.jlcpcbClass}</td>
                  <td className="py-2 px-3 text-slate-600 leading-snug">{r.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          2. Raspberry Pi GPIO, Shared V_G Bias &amp; J6 (DG350-3.5-08P) Screw Terminal Map
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-[11px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3">Device / Block</th>
                <th className="py-2.5 px-3">Pin / Signal</th>
                <th className="py-2.5 px-3">Net Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Connection &amp; Protection Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {ONEWIRE_REV_B_PINOUT.map((p) => (
                <tr key={p.netName} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">{p.device}</td>
                  <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{p.pin}</td>
                  <td className="py-2 px-3 font-mono font-semibold text-cyan-800 whitespace-nowrap">{p.netName}</td>
                  <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{p.direction}</td>
                  <td className="py-2 px-3 text-slate-600 leading-snug">{p.connectionNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-cyan-50/70 border border-cyan-200 rounded-md px-4 py-3 text-xs text-slate-700 leading-relaxed">
          <span className="font-semibold text-cyan-900">Silkscreen Note for J6 (DG350-3.5-08P):</span> Both 1-Wire buses share the unified 8-pin 3.50 mm fixed rising-cage screw block on the left edge with Pt1000 (<span className="font-mono">Pins 1–2: PT1±</span> · <span className="font-mono">Pins 3–5: 1W-A 5V/DQ/G</span> · <span className="font-mono">Pins 6–8: 1W-B 5V/DQ/G</span>). Mark Pin 3 and Pin 6 as <span className="font-mono font-semibold">5V</span> (DS18B20 runs natively from 3.0 V to 5.5 V; 5 V unlocks 2.5× higher noise immunity, 60 m reach, and full SS14 + 100 Ω short/reverse protection).
        </div>
      </div>
    </section>
  );
}
