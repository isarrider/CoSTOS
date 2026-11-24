export type OneWireTopologyId =
  | 'rev_a_baseline'
  | 'hardened_3v3_basic'
  | 'bss138_5v_shifter'
  | 'gemini_rev_b_2n7002'
  | 'ds2482_i2c_bridge';

export type OneWireCableType = 'cat5e' | 'liycy_shielded' | 'twin_lead';

export type OneWireFaultId =
  | 'none'
  | 'vdd_short_a'
  | 'dq_to_vdrv'
  | 'dq_to_12v'
  | 'vdd_to_12v'
  | 'esd_8kv'
  | 'pi5_jitter';

export interface OneWireSimParams {
  piSupplyV: number; // 4.20 .. 5.25 V (4.63 V Pi UV threshold)
  cableLengthM: number; // 2 .. 80 m per bus
  cableType: OneWireCableType;
  sensorCount: number; // 1 .. 8 DS18B20 sensors per bus
  ambientTempC: number; // 0 .. 70 °C (boiler-room temperature corner)
  activeFault: OneWireFaultId;
}

export const DEFAULT_ONEWIRE_PARAMS: OneWireSimParams = {
  piSupplyV: 5.0,
  cableLengthM: 30,
  cableType: 'liycy_shielded',
  sensorCount: 5,
  ambientTempC: 50,
  activeFault: 'none',
};

export const CABLE_CAP_PF_PER_M: Record<OneWireCableType, { label: string; pfPerM: number; ohmPerM: number }> = {
  twin_lead: { label: 'Unshielded 3x0.5 mm² (45 pF/m)', pfPerM: 45, ohmPerM: 0.072 },
  cat5e: { label: 'Cat5e Twisted Pair (55 pF/m)', pfPerM: 55, ohmPerM: 0.188 },
  liycy_shielded: { label: 'LiYCY Shielded Boiler Cable (75 pF/m)', pfPerM: 75, ohmPerM: 0.078 },
};

export interface OneWireBomItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Extended' | 'DNF / Manual';
  unitCostEur: number;
}

export interface OneWireTopologySpec {
  id: OneWireTopologyId;
  name: string;
  shortName: string;
  busVoltageV: number;
  pullupOhm: number;
  seriesDqOhm: number;
  supplyLimitOhm: number;
  sharedSupplyFuse: boolean;
  reverseVddBlocked: boolean;
  hasActivePullup: boolean;
  piInterface: string;
  partCountBothBuses: number;
  partCostEur: number;
  jlcpcbFeederFeeEur: number;
  verdict: string;
  pros: string[];
  cons: string[];
  failSafeProfile: string;
  softwareNote: string;
  bom: OneWireBomItem[];
}

export const ONEWIRE_TOPOLOGY_ORDER: OneWireTopologyId[] = [
  'rev_a_baseline',
  'hardened_3v3_basic',
  'bss138_5v_shifter',
  'gemini_rev_b_2n7002',
  'ds2482_i2c_bridge',
];

export const ONEWIRE_TOPOLOGY_SPECS: Record<OneWireTopologyId, OneWireTopologySpec> = {
  rev_a_baseline: {
    id: 'rev_a_baseline',
    name: 'CoSTOS Rev A Direct w1-gpio (3.3 V · 4.7 kΩ · Shared F2 PTC)',
    shortName: 'Rev A Baseline (3.3 V)',
    busVoltageV: 3.3,
    pullupOhm: 4700,
    seriesDqOhm: 100,
    supplyLimitOhm: 1.5,
    sharedSupplyFuse: true,
    reverseVddBlocked: false,
    hasActivePullup: false,
    piInterface: 'GPIO 4 (Pin 7) + GPIO 17 (Pin 11) · direct w1-gpio',
    partCountBothBuses: 7,
    partCostEur: 0.18,
    jlcpcbFeederFeeEur: 5.6, // Extended F2 100mA PTC (€2.80) + Extended PESD5V0 (€2.80)
    verdict:
      'Existing GitHub HAT-1wire.md §4.4 baseline. Shared F2 polyfuse breaks Bus A/B isolation and risks a Pi 4/5 3.3 V PMIC brownout before tripping; 4.7 kΩ @ 3.3 V misses the 15 µs read window past ~22 m of shielded boiler cable; PESD5V0 (V_BR ~6.5 V) + 100 Ω fails to protect Pi 3.3 V GPIOs from +8.5 V / +12 V miswiring.',
    pros: [
      'Lowest SMD part count (7 parts for both buses combined).',
      'Zero Linux driver configuration beyond dtoverlay=w1-gpio on GPIO 4 & 17.',
      'Leaves I²C1 (GPIO 2/3) completely free for future expansion.',
    ],
    cons: [
      'Shared F2 (100 mA PTC) kills BOTH Bus A and Bus B on a single pinched wire and allows a 1.5–2.5 A surge from Pi +3V3 PMIC for 10–50 ms before tripping.',
      'J8/J9 Pin 1 (+3V3_SENS) has zero ESD or reverse-voltage blocking: +12 V miswired onto 3V3 back-feeds straight into the Pi 3.3 V PMIC.',
      '4.7 kΩ pull-up at 3.3 V yields tau = 11.4 µs on 30 m LiYCY cable — V_DQ reaches only 1.93 V at the 15 µs read slot (below Pi 2.0 V V_IH → CRC errors).',
      'PESD5V0 (V_BR ≈ 6.5 V) + 100 Ω injects 30–50 mA into Pi 3.3 V GPIO under +8.5 V (+V_DRV) or +12 V miswiring — exceeds 3.63 V abs max.',
      'Both F2 (100 mA PTC) and PESD5V0 are JLCPCB Extended parts (€5.60 total feeder fee).',
    ],
    failSafeProfile:
      'FAILS Bus A/B independence on VDD short, FAILS Pi 3.3 V GPIO safety under +8.5 V/+12 V DQ miswiring, and FAILS +12 V VDD reverse-feed.',
    softwareNote:
      'Standard Linux w1-gpio (dtoverlay=w1-gpio-pi5,gpiopin=4 & gpiopin=17). Vulnerable to CRC=NO dropouts on long cables or Pi 5 RP1 jitter.',
    bom: [
      { designator: 'F2', part: '100 mA 0805/1206 PTC Polyfuse (Shared A+B)', packageType: '1206', jlcpcbClass: 'Extended', unitCostEur: 0.04 },
      { designator: 'R27, R28', part: '4.7 kΩ ±1% 0805 Pull-up to +3V3', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R29, R30', part: '100 Ω ±1% 0805 Series DQ Resistor', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'D15, D16', part: 'PESD5V0S1BL ESD Diode (DQ -> GND)', packageType: 'SOD-882', jlcpcbClass: 'Extended', unitCostEur: 0.12 },
    ],
  },

  hardened_3v3_basic: {
    id: 'hardened_3v3_basic',
    name: 'Hardened 3.3 V Direct w1-gpio (Per-Bus 22 Ω · 2.2 kΩ · B5819W Clamp)',
    shortName: 'Hardened 3.3 V (Basic)',
    busVoltageV: 3.3,
    pullupOhm: 2200,
    seriesDqOhm: 100,
    supplyLimitOhm: 22,
    sharedSupplyFuse: false,
    reverseVddBlocked: false,
    hasActivePullup: false,
    piInterface: 'GPIO 4 (Pin 7) + GPIO 17 (Pin 11) · direct w1-gpio',
    partCountBothBuses: 12,
    partCostEur: 0.12,
    jlcpcbFeederFeeEur: 0.0,
    verdict:
      'Zero-fee 3.3 V upgrade: replaces shared F2 with per-bus 22 Ω 1206 resistors and tightens pull-ups to 2.2 kΩ. Restores Bus A/B independence and doubles cable reach (~40 m), but 3.3 V lacks headroom for an SS14 reverse-blocking diode (would drop VDD below 3.0 V) and still clamps faults directly into Pi +3V3.',
    pros: [
      '100% JLCPCB Basic parts (€0.12/board, €0.00 feeder fee — saves €5.60 vs Rev A).',
      'True Bus A / Bus B fault isolation via separate 22 Ω 1206 supply resistors.',
      '2.2 kΩ pull-up cuts RC rise time by 2.1× vs Rev A (~40 m shielded cable reach).',
      'B5819W clamp to +3V3 holds Pi GPIO ≤ 3.58 V during ESD transients.',
    ],
    cons: [
      'Cannot fit a series Schottky reverse-blocking diode on 3.3 V (3.30 V − 0.25 V − 0.17 V = 2.88 V < 3.00 V DS18B20 V_DD_min).',
      'A dead short on 3V3 draws 150 mA (0.50 W) continuously from Pi +3V3 PMIC — right at 1206 resistor thermal limit.',
      'High-side noise margin stays tight at 1.1 V (3.3 V − 2.2 V) in noisy 230 V boiler rooms.',
      'Sustained +12 V miswire on DQ pushes ~85 mA into Pi +3V3 rail through B5819W, and +12 V on VDD still destroys Pi +3V3.',
    ],
    failSafeProfile:
      'Isolates Bus A/B shorts and passes 8 kV ESD, but CANNOT block +12 V reverse-feed on VDD and stresses Pi +3V3 on sustained DQ miswires.',
    softwareNote:
      'Zero software changes (w1-gpio on GPIO 4 & 17). Better edge speed than Rev A, but still only 1.1 V high-side noise margin.',
    bom: [
      { designator: 'R61, R65', part: '2.2 kΩ ±1% 0805 Pull-up to +3V3', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R63, R67', part: '100 Ω 0.5 W 1206 Series DQ Limiter', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R64, R68', part: '22 Ω 0.5 W 1206 Per-Bus 3.3 V Limiter', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'D24-D27', part: 'B5819W 40 V Schottky Clamp (+3V3 & GND)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.05 },
      { designator: 'C25, C26', part: '100 nF 50 V X7R 0805 Bus Decoupling', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
    ],
  },

  bss138_5v_shifter: {
    id: 'bss138_5v_shifter',
    name: '5 V BSS138 Bidirectional Shifter + Per-Bus SS14 / 100 Ω Supply',
    shortName: '5 V BSS138 Shifter (Ext)',
    busVoltageV: 5.0,
    pullupOhm: 2200,
    seriesDqOhm: 100,
    supplyLimitOhm: 100,
    sharedSupplyFuse: false,
    reverseVddBlocked: true,
    hasActivePullup: false,
    piInterface: 'GPIO 4 (Pin 7) + GPIO 17 (Pin 11) · 3.3 V ↔ 5 V w1-gpio',
    partCountBothBuses: 18,
    partCostEur: 0.19,
    jlcpcbFeederFeeEur: 2.8, // BSS138 (C78284) is Extended on JLCPCB
    verdict:
      'Textbook AN97055 3.3 V ↔ 5 V MOSFET level shifter with per-bus SS14 + 100 Ω 0.5 W power isolation. Electrically excellent (2.5× noise margin, ~60 m reach, full +12 V/+24 V Pi GPIO isolation), but BSS138 (C78284) is a JLCPCB Extended part adding a €2.80 feeder fee.',
    pros: [
      'Native 5 V bus gives 2.5× noise margin (2.8 V vs 1.1 V) and reaches 60 m of shielded cable cleanly inside the 15 µs read window.',
      'BSS138 (V_DS = 50 V, V_GS(th) = 0.8–1.5 V) works directly from Gate = +3V3 and blocks positive overvoltages on DQ completely from Pi GPIO.',
      'Per-bus SS14 (40 V) + 100 Ω 1206 0.5 W isolates Bus A/B shorts at 47 mA (0.22 W continuous) and blocks +12 V/+24 V VDD miswiring.',
      'Shorting J8 Pin 1 (5V) to Pin 2 (DQ) causes zero damage because DQ is natively 5 V.',
    ],
    cons: [
      'BSS138 (LCSC C78284) is a JLCPCB Extended part — incurs €2.80 feeder fee per order.',
      'Uses 18 SMD parts across both buses (still tiny footprint and ~€0.19 BOM).',
    ],
    failSafeProfile:
      'PASSES every single fault corner: Bus A/B isolated, +12 V/+V_DRV on DQ blocked by BSS138 + 1N4148W, +12 V on VDD blocked by SS14, ±8 kV ESD safe.',
    softwareNote:
      '100% transparent to Linux w1-gpio (dtoverlay=w1-gpio-pi5,gpiopin=4 & gpiopin=17). Faster edges also improve Pi 5 RP1 sample margin.',
    bom: [
      { designator: 'Q19, Q20', part: 'BSS138 50 V N-MOSFET (LCSC C78284)', packageType: 'SOT-23', jlcpcbClass: 'Extended', unitCostEur: 0.04 },
      { designator: 'R61, R65', part: '4.7 kΩ ±1% 0805 Pi-Side Pull-up (+3V3)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R62, R66', part: '2.2 kΩ ±1% 0805 Bus-Side Pull-up (+5V_1Wx)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R63, R64, R67, R68', part: '100 Ω 0.5 W 1206 DQ & VDD Limiters', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D24, D25, D27, D28', part: '1N4148W 4 pF ESD Steering (+5V / GND)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'D26, D29', part: 'SS14 40 V 1 A Reverse-Block Schottky', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'C25, C26', part: '100 nF 50 V X7R 0805 Bus Decoupling', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
    ],
  },

  gemini_rev_b_2n7002: {
    id: 'gemini_rev_b_2n7002',
    name: '5 V Diode-Biased 2N7002 + SS14/100 Ω Isolated Bus (Rev B · Gemini Version)',
    shortName: 'Rev B · Gemini (5 V Basic)',
    busVoltageV: 5.0,
    pullupOhm: 2200,
    seriesDqOhm: 100,
    supplyLimitOhm: 100,
    sharedSupplyFuse: false,
    reverseVddBlocked: true,
    hasActivePullup: false,
    piInterface: 'GPIO 4 (Pin 7) + GPIO 17 (Pin 11) · 3.3 V ↔ 5 V w1-gpio',
    partCountBothBuses: 21,
    partCostEur: 0.18,
    jlcpcbFeederFeeEur: 0.0,
    verdict:
      'RECOMMENDED (Rev B · Gemini Version). Replaces Extended BSS138 with JLCPCB Basic 2N7002 (C8545) and solves 2N7002’s 2.5 V worst-case V_th trap with a 3-part shared diode bias (R60 1.5 kΩ + D23 1N4148W + C24 100 nF → V_G = +3V3 + 0.62 V = 3.92 V, temperature-tracked!). R62/R66 pull-ups tap ahead of R64/R68 so DQ pulses never dip sensor VDD. 100% Basic (€0.00 fee), 60 m reach, and bulletproof across all corners.',
    pros: [
      '100% genuine JLCPCB Basic parts (€0.18/board for BOTH buses, €0.00 feeder fee — 7 of 8 part lines already shared with Pt1000/Pump/Watchdog!).',
      'Shared V_G = +3V3 + V_F(D23 @ 0.7 mA) = 3.92 V (R60 1.5 kΩ) + R61/R65 = 10 kΩ guarantees ≥ +0.23 V overdrive even at all 5 simultaneous worst-case corners (0 °C + 4.63 V UV + 100 Ω DS18B20 + 2.60 V 2N7002) while staying strictly OFF (V_GS = 0.54 V < 0.85 V) at 60 °C or Pi power-down.',
      'R62/R66 (2.2 kΩ) tap D26/D29 cathode ahead of R64/R68 (100 Ω), eliminating 200 mV Reset-pulse ripple on sensor VDD and supporting up to 8× DS18B20 even at 4.63 V Pi UV.',
      'Native 5 V bus delivers 2.5× higher noise immunity (2.8 V vs 1.1 V) and 60 m shielded cable reach inside the 15 µs read window.',
      'True Bus A / Bus B isolation: per-bus SS14 (40 V reverse block) + 100 Ω 1206 0.5 W caps dead shorts at 47 mA (0.22 W steady-state) — zero Pi PMIC reboot, Bus B stays 100% online.',
      'Survives continuous +12 V / +V_DRV miswire on DQ (2N7002 60 V stays OFF, 1N4148W shunts 62 mA into Pi +5V, Pi GPIO stays 3.30 V) and +24 V/+40 V on VDD (blocked by SS14).',
    ],
    cons: [
      'Uses 21 SMD parts total for both buses combined (compact 0805/SOT-23/SOD-123, ~€0.18 total).',
      'Still relies on Linux w1-gpio timing (keep optional unpopulated U10 DS2482-100 pads on I²C1 only if extreme >80 m runs are ever needed).',
    ],
    failSafeProfile:
      'PASSES ALL 6 FAULT CORNERS: Bus A/B isolated (47 mA short), continuous +12 V/+V_DRV DQ safe (GPIO = 3.30 V; +24 V DQ sacrifices R63 while saving Pi), +24 V/+40 V VDD blocked indefinitely (SS14), ±8 kV ESD safe (4 pF 1N4148W + 100 Ω), Pi power-off zero back-feed.',
    softwareNote:
      'Zero driver changes: standard dtoverlay=w1-gpio-pi5,gpiopin=4 and gpiopin=17. Fast 5 V rise time eliminates marginal Pi 5 RP1 read-slot CRC errors up to ~60 m.',
    bom: [
      { designator: 'Q19, Q20', part: '2N7002 60 V N-MOSFET (LCSC C8545)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R60', part: '1.5 kΩ ±1% 0805 Shared V_G Bias Feed (+5V)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R61, R65', part: '10 kΩ ±1% 0805 Pi-Side Pull-up (+3V3)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R62, R66', part: '2.2 kΩ ±1% 0805 Field Pull-up (D26/D29 Cathode)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R63, R64, R67, R68', part: '100 Ω 0.5 W 1206 DQ & VDD Limiters', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D23-D25, D27-D28', part: '1N4148W 4 pF (V_G Ref + ESD Steering)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'D26, D29', part: 'SS14 40 V 1 A Reverse-Block Schottky', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'C24, C25, C26', part: '100 nF 50 V X7R 0805 (V_G & Bus A/B)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
    ],
  },

  ds2482_i2c_bridge: {
    id: 'ds2482_i2c_bridge',
    name: 'Dual DS2482-100 (or DS2482-800) I²C-to-1-Wire Hardware Bridge',
    shortName: 'DS2482 I²C Bridge (APU)',
    busVoltageV: 5.0,
    pullupOhm: 1000, // Effective slew-controlled active pull-up (APU)
    seriesDqOhm: 100,
    supplyLimitOhm: 100,
    sharedSupplyFuse: false,
    reverseVddBlocked: true,
    hasActivePullup: true,
    piInterface: 'I²C1 SDA/SCL (GPIO 2/3, Pins 3/5) · ds2482 / owfs driver',
    partCountBothBuses: 18,
    partCostEur: 4.85,
    jlcpcbFeederFeeEur: 5.6, // DS2482-800 or manual consignment + I2C level shifter / extended parts
    verdict:
      'Gold-standard hardware 1-Wire timing master with Active Pull-Up (APU) reaching >80 m and zero Linux bit-bang jitter — ideal for extreme cable plants, but DS2482-100 is NOT stocked for JLCPCB SMT assembly (manual soldering or €5+ DS2482-800 Extended fee) and adds owfs/ds2482 software complexity.',
    pros: [
      'Hardware-timed 1-Wire waveforms: 100% immune to Raspberry Pi 5 RP1 / Linux kernel scheduling jitter.',
      'Built-in Active Pull-Up (APU) slew-rate controlled current boost reaches >80 m of heavy shielded cable effortlessly.',
      'Frees GPIO 4 and GPIO 17 (uses shared I²C1 bus on Pins 3/5).',
      'When paired with per-bus SS14 + 100 Ω + 1N4148W steering, achieves full electrical fault protection.',
    ],
    cons: [
      'DS2482-100 is NOT stocked at JLCPCB/LCSC SMT library (must be hand-soldered after delivery or swapped to expensive DS2482-800 ~€5 + €2.80 fee).',
      'Adds ~€7.65–€10.45 per board (2× batch) compared to €0.18 for Rev B Gemini.',
      'DS2482 IO pin abs max is only 6 V — still requires external 100 Ω + steering diodes + per-bus SS14 supply protection.',
      'Requires configuring kernel ds2482 module or owfs daemon instead of plug-and-play w1-gpio.',
    ],
    failSafeProfile:
      'PASSES with external 100 Ω + 1N4148W + SS14 protection; without external clamping, DS2482 IO pin blows above 6.0 V.',
    softwareNote:
      'Requires i2c-dev + w1_ds2482 kernel driver (echo ds2482 0x18 > /sys/bus/i2c/devices/i2c-1/new_device) or OWFS.',
    bom: [
      { designator: 'U10 (×2)', part: 'DS2482S-100 I²C-to-1-Wire Bridge (Not at LCSC)', packageType: 'SOIC-8', jlcpcbClass: 'DNF / Manual', unitCostEur: 4.6 },
      { designator: 'R61, R65', part: '4.7 kΩ ±1% 0805 I²C1 Pull-ups (+3V3)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'R63, R64, R67, R68', part: '100 Ω 0.5 W 1206 DQ & VDD Limiters', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D24, D25, D27, D28', part: '1N4148W 4 pF ESD Steering (+5V / GND)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'D26, D29', part: 'SS14 40 V 1 A Reverse-Block Schottky', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'C24-C26', part: '100 nF 50 V X7R 0805 Decoupling', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'U10_LS', part: 'I²C 3.3 V↔5 V Level Shift (2× 2N7002 + R)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.1 },
    ],
  },
};

export function oneWirePerBoardCostEur(spec: OneWireTopologySpec, batchSize: 2 | 5): number {
  return spec.partCostEur + spec.jlcpcbFeederFeeEur / batchSize;
}

export interface OneWireEvalResult {
  topologyId: OneWireTopologyId;
  busIdleV: number; // Idle DQ voltage on field cable (V)
  sensorVddV: number; // Loaded sensor VDD at end of cable during simultaneous conversion (V)
  sensorVddOk: boolean; // >= 3.00 V DS18B20 min
  busCapNf: number; // Total bus capacitance (cable + sensors + diode/MOSFET) in nF
  tauUs: number; // Rising edge RC time constant (µs)
  vDqAtSampleV: number; // Field DQ voltage at 15 µs read-1 sample point (V)
  vPiAtSampleV: number; // Pi GPIO voltage at 15 µs read-1 sample point (V)
  piVihMarginV: number; // vPiAtSampleV - 2.00 V (Pi V_IH threshold)
  noiseMarginV: number; // Field bus high-side noise margin above 2.20 V DS18B20 V_IH
  vOlAtPiV: number; // Pi GPIO logic LOW when DS18B20 pulls bus low (must be <= 0.80 V)
  vOlOk: boolean;
  maxReachM: number; // Max cable length (m) where Read-1 sample >= 2.30 V (0.3 V guardband)
  vGateBiasV: number | null; // Shared V_G bias voltage (Rev B Gemini)
  vGsOverdriveV: number | null; // Gate overdrive above worst-case V_th when DS18B20 pulls low
  // Fault metrics
  piGpioPeakV: number; // Peak voltage seen by Pi GPIO pin under activeFault (must be -0.3 .. 3.63 V)
  piGpioInjectMa: number; // Fault current injected into Pi GPIO pin (must be <= 2.0 mA)
  faultSupplyDrawMa: number; // Current drawn from Pi rail during fault
  busBAliveDuringFault: boolean; // Does Bus B stay online during Bus A fault?
  faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL';
  faultSummary: string;
}

export function evaluateOneWireBus(
  topologyId: OneWireTopologyId,
  params: OneWireSimParams
): OneWireEvalResult {
  const spec = ONEWIRE_TOPOLOGY_SPECS[topologyId];
  const cable = CABLE_CAP_PF_PER_M[params.cableType];
  const pi3v3 = 3.3;

  // Sensor & parasitic capacitance
  const sensorCapPf = params.sensorCount * 25;
  const diodeCapPf =
    topologyId === 'rev_a_baseline'
      ? 15
      : topologyId === 'hardened_3v3_basic'
      ? 95 // B5819W Schottky capacitance
      : 12; // 1N4148W (4 pF × 2) + 2N7002/BSS138 C_oss
  const mosfetCapPf =
    topologyId === 'gemini_rev_b_2n7002'
      ? 35
      : topologyId === 'bss138_5v_shifter'
      ? 25
      : 0;

  const totalCapPf = params.cableLengthM * cable.pfPerM + sensorCapPf + diodeCapPf + mosfetCapPf;
  const busCapNf = totalCapPf / 1000;
  const cableLoopOhm = params.cableLengthM * cable.ohmPerM * 2;

  // Loaded VDD at sensor end during simultaneous conversion (1.5 mA/sensor)
  const convCurrentA = params.sensorCount * 0.0015;
  let busIdleV = spec.busVoltageV;
  let sensorVddV = 3.3;

  if (spec.busVoltageV === 5.0) {
    const ss14Vf = 0.28 - (params.ambientTempC - 25) * 0.0018;
    const vSupplyRail = params.piSupplyV - (spec.reverseVddBlocked ? ss14Vf : 0);
    // R62/R66 pull-up taps D26/D29 cathode (+5V_1W_PROT) ahead of R64/R68 so DQ pulses never dip sensor VDD!
    busIdleV = Math.max(3.0, vSupplyRail);
    // Only sensor conversion current flows through R64/R68 (100 Ω)
    sensorVddV = vSupplyRail - convCurrentA * (spec.supplyLimitOhm + cableLoopOhm);
  } else {
    busIdleV = pi3v3;
    sensorVddV = pi3v3 - convCurrentA * (spec.supplyLimitOhm + cableLoopOhm);
  }
  const sensorVddOk = sensorVddV >= 3.0;

  // Rising edge time constant & Read-1 slot sample point
  // 1-Wire Read-1 slot: master pulls low for ~4 µs, releases, samples at t = 15 µs (11 µs recovery).
  // Pi 5 RP1 jitter eats ~3.5 µs of recovery margin for w1-gpio (0 µs for DS2482 hardware bridge).
  const recoveryWindowUs =
    params.activeFault === 'pi5_jitter' && !spec.hasActivePullup ? 7.5 : 11.0;

  let tauUs: number;
  let vDqAtSampleV: number;

  if (spec.hasActivePullup) {
    // DS2482 Active Pull-Up engages once V_DQ crosses ~0.9 V, providing low-impedance ~250–350 Ω slew boost
    const rEff = 650 + spec.seriesDqOhm;
    tauUs = (rEff * busCapNf) / 1000; // Ω * nF / 1000 = µs
    vDqAtSampleV = busIdleV * (1 - Math.exp(-recoveryWindowUs / Math.max(0.2, tauUs)));
  } else {
    // Effective charging resistance from bus supply to cable capacitance
    const rEff = spec.pullupOhm + spec.seriesDqOhm + cableLoopOhm * 0.5;
    tauUs = (rEff * busCapNf) / 1000;
    vDqAtSampleV = busIdleV * (1 - Math.exp(-recoveryWindowUs / Math.max(0.2, tauUs)));
  }

  // Pi GPIO voltage at sample point (clamped to 3.3 V via MOSFET level shifter or I2C bridge)
  const vPiAtSampleV =
    spec.hasActivePullup
      ? vDqAtSampleV >= 2.2
        ? 3.3
        : (vDqAtSampleV / 2.2) * 1.8
      : Math.min(pi3v3, vDqAtSampleV);

  const piVihMarginV = vPiAtSampleV - 2.0; // Raspberry Pi 3/4/5 V_IH ≈ 2.00 V
  const noiseMarginV = Math.max(0, busIdleV - 2.2); // DS18B20 V_IH_min = 2.20 V

  // V_OL when DS18B20 pulls DQ LOW (R_ds_sensor ≈ 75 Ω)
  const rSensorOn = 75;
  let vOlAtPiV: number;
  let vGateBiasV: number | null = null;
  let vGsOverdriveV: number | null = null;

  if (topologyId === 'gemini_rev_b_2n7002') {
    // D23 1N4148W anode on V_G_1W, cathode on +3V3, fed by R60 = 1.5 kΩ from +5V (~0.71 mA -> Vf = 0.62 V @ 25 °C)
    const vfD23 = 0.62 - (params.ambientTempC - 25) * 0.002 + (params.piSupplyV - 5.0) * 0.03;
    vGateBiasV = pi3v3 + vfD23;
    const iBus = busIdleV / (spec.pullupOhm + spec.seriesDqOhm + rSensorOn + cableLoopOhm);
    const iPi = pi3v3 / 10000; // R61 / R65 = 10 kΩ cuts body-diode current in half (τ_pi = 150 ns!)
    const vDrain = (iBus + iPi) * (rSensorOn + cableLoopOhm) + iBus * spec.seriesDqOhm;
    const vBodySource = vDrain + (0.62 - (params.ambientTempC - 25) * 0.002);
    const vThWorst = 2.5 - (params.ambientTempC - 25) * 0.002; // 2N7002 worst-case V_th
    const vGsBody = vGateBiasV - vBodySource;
    vGsOverdriveV = vGsBody - vThWorst;
    // With V_GS > V_th, channel snaps ON (R_ds ~ 8 Ω) pulling Source down to vDrain + I_pi * R_ds
    vOlAtPiV = vGsOverdriveV > 0 ? vDrain + iPi * 8 : vBodySource;
  } else if (topologyId === 'bss138_5v_shifter') {
    vGateBiasV = pi3v3;
    const iBus = busIdleV / (spec.pullupOhm + spec.seriesDqOhm + rSensorOn + cableLoopOhm);
    const iPi = pi3v3 / 4700;
    const vDrain = (iBus + iPi) * (rSensorOn + cableLoopOhm) + iBus * spec.seriesDqOhm;
    const vBodySource = vDrain + 0.65;
    const vThWorst = 1.5 - (params.ambientTempC - 25) * 0.002;
    vGsOverdriveV = pi3v3 - vBodySource - vThWorst;
    vOlAtPiV = vDrain + iPi * 5;
  } else if (topologyId === 'ds2482_i2c_bridge') {
    const iBus = busIdleV / (1500 + spec.seriesDqOhm + rSensorOn + cableLoopOhm);
    vOlAtPiV = iBus * (rSensorOn + spec.seriesDqOhm + cableLoopOhm);
  } else {
    const iBus = pi3v3 / (spec.pullupOhm + spec.seriesDqOhm + rSensorOn + cableLoopOhm);
    vOlAtPiV = iBus * (rSensorOn + spec.seriesDqOhm + cableLoopOhm);
  }

  const vOlOk = vOlAtPiV <= 0.8;

  // Max reliable cable reach (m) where vDqAtSampleV >= 2.35 V (0.35 V guardband above 2.0 V)
  const targetV = 2.35;
  const ratio = Math.min(0.95, targetV / Math.max(2.5, busIdleV));
  const tauMaxUs = -recoveryWindowUs / Math.log(1 - ratio);
  const rCharge = spec.hasActivePullup ? 650 + spec.seriesDqOhm : spec.pullupOhm + spec.seriesDqOhm + 4;
  const cMaxPf = (tauMaxUs * 1000 * 1000) / rCharge;
  const maxReachM = Math.max(2, Math.min(120, (cMaxPf - sensorCapPf - diodeCapPf - mosfetCapPf) / cable.pfPerM));

  // Fault Injection Analysis
  let piGpioPeakV = vPiAtSampleV;
  let piGpioInjectMa = 0;
  let faultSupplyDrawMa = params.sensorCount * 1.5;
  let busBAliveDuringFault = true;
  let faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL' =
    piVihMarginV >= 0.3 && sensorVddOk && vOlOk ? 'PASS' : piVihMarginV >= 0 && sensorVddOk && vOlOk ? 'MARGINAL' : 'FAIL';
  let faultSummary =
    faultVerdict === 'PASS'
      ? `Clean 15 µs Read-1 margin (+${piVihMarginV.toFixed(2)} V), V_OL = ${vOlAtPiV.toFixed(2)} V, VDD = ${sensorVddV.toFixed(2)} V.`
      : !sensorVddOk
      ? `Sensor VDD drops to ${sensorVddV.toFixed(2)} V (< 3.00 V DS18B20 minimum).`
      : `Read-1 rise time too slow (V_Pi = ${vPiAtSampleV.toFixed(2)} V at sample point; max reach ${maxReachM.toFixed(0)} m).`;

  if (params.activeFault === 'vdd_short_a') {
    if (topologyId === 'rev_a_baseline') {
      faultSupplyDrawMa = 1850; // Pre-trip surge out of Pi 3.3 V PMIC!
      busBAliveDuringFault = false;
      faultVerdict = 'FAIL';
      faultSummary =
        'Shared F2 PTC draws ~1.85 A surge from Pi +3V3 PMIC (10–50 ms brownout risk) and kills BOTH Bus A and Bus B!';
    } else if (topologyId === 'hardened_3v3_basic') {
      faultSupplyDrawMa = 150;
      busBAliveDuringFault = true;
      faultVerdict = 'MARGINAL';
      faultSummary =
        'Bus B stays online, but 22 Ω short draws 150 mA (0.50 W) continuously from Pi +3V3 PMIC — right at 1206 thermal limit.';
    } else {
      faultSupplyDrawMa = Math.round(((params.piSupplyV - 0.3) / spec.supplyLimitOhm) * 1000);
      busBAliveDuringFault = true;
      faultVerdict = 'PASS';
      faultSummary = `Per-bus SS14 + 100 Ω 0.5 W caps dead short at ${faultSupplyDrawMa} mA (0.22 W steady-state). Zero Pi droop; Bus B stays 100% online.`;
    }
  } else if (params.activeFault === 'dq_to_vdrv') {
    const vFault = 8.5; // Pump PWM +V_DRV rail accidentally touches DQ
    if (topologyId === 'rev_a_baseline') {
      piGpioPeakV = 6.6; // PESD5V0 V_BR ~ 6.6 V -> drives directly through 100 Ω into Pi GPIO!
      piGpioInjectMa = (6.6 - 3.6) / 0.1; // 30 mA into Pi GPIO
      faultVerdict = 'FAIL';
      faultSummary =
        'PESD5V0 breaks down at ~6.6 V → 100 Ω R29 injects 30 mA into Pi 3.3 V GPIO (abs max 3.63 V / 2 mA) — blows GPIO!';
    } else if (topologyId === 'hardened_3v3_basic') {
      piGpioPeakV = 3.62;
      piGpioInjectMa = 0.8;
      faultSupplyDrawMa = 49; // Shunted into +3V3 rail
      faultVerdict = 'MARGINAL';
      faultSummary =
        'B5819W clamps GPIO to 3.62 V, shunting 49 mA into Pi +3V3 rail (safe briefly, stresses +3V3 at higher faults).';
    } else {
      piGpioPeakV = 3.3;
      piGpioInjectMa = 0;
      faultSupplyDrawMa = Math.round(((vFault - (params.piSupplyV + 0.7)) / 100) * 1000);
      faultVerdict = 'PASS';
      faultSummary = `100 Ω + 1N4148W shunts ${faultSupplyDrawMa} mA harmlessly to Pi +5V; MOSFET stays OFF → Pi GPIO stays at 3.30 V (0 mA)!`;
    }
  } else if (params.activeFault === 'dq_to_12v') {
    const vFault = 12.0;
    if (topologyId === 'rev_a_baseline') {
      piGpioPeakV = 7.4;
      piGpioInjectMa = 38.0;
      faultVerdict = 'FAIL';
      faultSummary =
        'PESD5V0 overheats at continuous +12 V while 100 Ω injects 38 mA into Pi 3.3 V GPIO → permanent BCM2711 / RP1 damage!';
    } else if (topologyId === 'hardened_3v3_basic') {
      piGpioPeakV = 3.72;
      piGpioInjectMa = 4.5;
      faultSupplyDrawMa = 84;
      faultVerdict = 'FAIL';
      faultSummary =
        'Continuous +12 V dumps 84 mA through B5819W into Pi +3V3 (0.70 W in 100 Ω) and lifts GPIO to 3.72 V (> 3.63 V abs max).';
    } else {
      piGpioPeakV = 3.3;
      piGpioInjectMa = 0;
      faultSupplyDrawMa = Math.round(((vFault - (params.piSupplyV + 0.7)) / 100) * 1000);
      faultVerdict = 'PASS';
      faultSummary = `100 Ω (0.40 W < 0.50 W) + 1N4148W shunts ${faultSupplyDrawMa} mA into Pi +5V; 60 V/50 V MOSFET blocks +12 V → Pi GPIO = 3.30 V (0 mA)!`;
    }
  } else if (params.activeFault === 'vdd_to_12v') {
    if (!spec.reverseVddBlocked) {
      piGpioPeakV = 11.8;
      piGpioInjectMa = 250;
      faultSupplyDrawMa = 450;
      busBAliveDuringFault = false;
      faultVerdict = 'FAIL';
      faultSummary =
        'ZERO reverse-blocking on VDD pin: +12 V back-feeds straight into Pi +3V3 rail → destroys Raspberry Pi PMIC & SoC instantly!';
    } else {
      piGpioPeakV = 3.3;
      piGpioInjectMa = 0;
      faultSupplyDrawMa = 0;
      busBAliveDuringFault = true;
      faultVerdict = 'PASS';
      faultSummary =
        'SS14 (40 V reverse rating) blocks +12 V completely (0 mA into Pi +5V). Pi & Bus B remain 100% protected!';
    }
  } else if (params.activeFault === 'esd_8kv') {
    if (topologyId === 'rev_a_baseline') {
      piGpioPeakV = 9.5; // PESD5V0 dynamic clamping voltage at 8 kV HBM
      piGpioInjectMa = 58;
      faultVerdict = 'MARGINAL';
      faultSummary =
        'PESD5V0 clamps 8 kV HBM to ~9.5 V dynamic peak → brief ~58 mA pulse through 100 Ω into Pi GPIO ESD cell.';
    } else if (topologyId === 'hardened_3v3_basic') {
      piGpioPeakV = 3.6;
      piGpioInjectMa = 1.2;
      faultVerdict = 'PASS';
      faultSummary = '100 Ω + B5819W clamps ±8 kV HBM ESD tightly to −0.3 V / +3.6 V.';
    } else {
      piGpioPeakV = 3.32;
      piGpioInjectMa = 0.1;
      faultVerdict = 'PASS';
      faultSummary =
        '100 Ω + 4 pF 1N4148W clamps ±8 kV ESD to −0.8 V / +5.8 V; MOSFET isolates +5.8 V & body diode holds −ESD to ≥ −0.15 V at Pi GPIO!';
    }
  } else if (params.activeFault === 'pi5_jitter') {
    if (spec.hasActivePullup) {
      faultVerdict = 'PASS';
      faultSummary = 'DS2482 hardware master generates exact microsecond 1-Wire slots over I²C — 100% immune to Pi 5 RP1 jitter.';
    } else if (piVihMarginV >= 0.35) {
      faultVerdict = 'PASS';
      faultSummary = `Fast 5 V rise reaches V_Pi = ${vPiAtSampleV.toFixed(2)} V even with 3.5 µs Pi 5 RP1 jitter (+${piVihMarginV.toFixed(2)} V margin).`;
    } else if (piVihMarginV >= 0) {
      faultVerdict = 'MARGINAL';
      faultSummary = `Tight margin (+${piVihMarginV.toFixed(2)} V) under Pi 5 RP1 jitter at ${params.cableLengthM} m; use w1-gpio-pi5 overlay.`;
    } else {
      faultVerdict = 'FAIL';
      faultSummary = `Pi 5 RP1 jitter pushes sample into slow RC edge (V_Pi = ${vPiAtSampleV.toFixed(2)} V < 2.00 V) → CRC=NO read failures!`;
    }
  }

  return {
    topologyId,
    busIdleV,
    sensorVddV,
    sensorVddOk,
    busCapNf,
    tauUs,
    vDqAtSampleV,
    vPiAtSampleV,
    piVihMarginV,
    noiseMarginV,
    vOlAtPiV,
    vOlOk,
    maxReachM,
    vGateBiasV,
    vGsOverdriveV,
    piGpioPeakV,
    piGpioInjectMa,
    faultSupplyDrawMa,
    busBAliveDuringFault,
    faultVerdict,
    faultSummary,
  };
}

export interface OneWireWaveformPoint {
  timeUs: number;
  revADqV: number;
  hardened3v3DqV: number;
  revBFieldDqV: number;
  revBPiGpioV: number;
  ds2482DqV: number;
}

/**
 * Computes a 0..24 µs 1-Wire Read-1 Time Slot waveform:
 *   0..4 µs: Master pulls DQ low (t_RL = 4 µs)
 *   4..24 µs: Master releases DQ; bus charges via RC pull-up (or DS2482 APU)
 *   15 µs (11 µs after release, or 11.5 µs under Pi 5 jitter): Master samples DQ!
 */
export function computeReadSlotWaveform(params: OneWireSimParams): OneWireWaveformPoint[] {
  const revA = evaluateOneWireBus('rev_a_baseline', params);
  const hard3 = evaluateOneWireBus('hardened_3v3_basic', params);
  const revB = evaluateOneWireBus('gemini_rev_b_2n7002', params);
  const ds = evaluateOneWireBus('ds2482_i2c_bridge', params);

  const pts: OneWireWaveformPoint[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i * 0.5; // 0.0 .. 24.0 µs
    if (t < 1.0) {
      pts.push({
        timeUs: t,
        revADqV: revA.busIdleV,
        hardened3v3DqV: hard3.busIdleV,
        revBFieldDqV: revB.busIdleV,
        revBPiGpioV: 3.3,
        ds2482DqV: ds.busIdleV,
      });
    } else if (t < 4.0) {
      pts.push({
        timeUs: t,
        revADqV: 0.08,
        hardened3v3DqV: 0.08,
        revBFieldDqV: 0.08,
        revBPiGpioV: 0.05,
        ds2482DqV: 0.08,
      });
    } else {
      const dt = t - 4.0;
      const vRevA = revA.busIdleV * (1 - Math.exp(-dt / Math.max(0.2, revA.tauUs)));
      const vHard3 = hard3.busIdleV * (1 - Math.exp(-dt / Math.max(0.2, hard3.tauUs)));
      const vRevBField = revB.busIdleV * (1 - Math.exp(-dt / Math.max(0.2, revB.tauUs)));
      const vRevBPi = Math.min(3.3, vRevBField);
      const vDs = ds.busIdleV * (1 - Math.exp(-dt / Math.max(0.2, ds.tauUs)));
      pts.push({
        timeUs: t,
        revADqV: vRevA,
        hardened3v3DqV: vHard3,
        revBFieldDqV: vRevBField,
        revBPiGpioV: vRevBPi,
        ds2482DqV: vDs,
      });
    }
  }
  return pts;
}

export interface OneWireCableSweepPoint {
  lengthM: number;
  revAPiV: number;
  hardened3v3PiV: number;
  revBPiV: number;
  ds2482DqV: number;
}

export function computeCableLengthSweep(params: OneWireSimParams): OneWireCableSweepPoint[] {
  const pts: OneWireCableSweepPoint[] = [];
  for (let len = 2; len <= 80; len += 2) {
    const p = { ...params, cableLengthM: len };
    pts.push({
      lengthM: len,
      revAPiV: evaluateOneWireBus('rev_a_baseline', p).vPiAtSampleV,
      hardened3v3PiV: evaluateOneWireBus('hardened_3v3_basic', p).vPiAtSampleV,
      revBPiV: evaluateOneWireBus('gemini_rev_b_2n7002', p).vPiAtSampleV,
      ds2482DqV: evaluateOneWireBus('ds2482_i2c_bridge', p).vDqAtSampleV,
    });
  }
  return pts;
}
