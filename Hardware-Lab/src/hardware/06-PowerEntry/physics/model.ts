// CoSTOS 1-Wire HAT — Subsystem 06: Block 1 Pi Power Entry, Rail Budget & Protection
// Coupled physics engine for +5V (Pi Pins 2/4), +3V3 / +3V3_ANA (Pi Pins 1/17),
// foldback eFuse short-circuit dynamics, hot-plug inrush, analog ripple rejection,
// Pi-OFF +24V clamp back-feed protection, and full-HAT current budget (Subsystems 01-06).

export type PowerTopologyId =
  | 'rev_a_d18_bare'
  | 'pre_d18_j1_ideal_diode'
  | 'ptc_ferrite_filter'
  | 'gemini_rev_b_efuse'
  | 'tps25921_efuse_ic';

export type PowerFaultMode =
  | 'none'
  | 'hat_5v_short'
  | 'hot_plug_inrush'
  | 'pi_uvlo_465v'
  | 'pi_off_24v_backfeed'
  | 'buck_ripple_60mv'
  | 'boiler_60c_10yr';

export interface PowerSimParams {
  pi5vRailV: number;          // 4.60 .. 5.25 V at Pi pins 2/4
  pi3v3RailV: number;         // 3.20 .. 3.40 V at Pi pins 1/17
  relayLoadMa: number;        // 0 (SSR off), 15 (SSR on), 100 (mech coil), 138 (REL fault limit)
  oneWireSensorCount: number; // 1 .. 16 DS18B20 sensors (1.5 mA/ea)
  pumpActive: boolean;        // Adds ~22 mA on +5V via 02. Pump PWM Supply
  pi3v3RippleMv: number;      // 10 .. 80 mVpp Pi 4/5 buck switching ripple
  ambientTempC: number;       // 0 .. 65 °C boiler room ambient
  activeFault: PowerFaultMode;
}

export const DEFAULT_POWER_PARAMS: PowerSimParams = {
  pi5vRailV: 5.05,
  pi3v3RailV: 3.30,
  relayLoadMa: 100,
  oneWireSensorCount: 10,
  pumpActive: true,
  pi3v3RippleMv: 45,
  ambientTempC: 45,
  activeFault: 'none',
};

export interface PowerBomItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Extended';
  unitCostEur: number;
}

export interface PowerTopologySpec {
  id: PowerTopologyId;
  shortName: string;
  name: string;
  badge: string;
  recommended?: boolean;
  rSeries5vOhm: number;          // Nominal series resistance in +5V path (R_EF + R_DS(on) or PTC)
  hasFoldbackLimit: boolean;     // True active foldback eFuse (Rev B)
  kneeCurrentMa: number | null;  // Knee/trip current (null = unprotected!)
  shortCurrentMa: number | null; // Sustained dead-short current (null = >5 A Pi brown-out!)
  tripTimeUs: number | null;     // Response time to dead short (µs)
  bulkCapUf: number;             // Effective bulk capacitance on +5V_HAT (µF)
  bulkCapType: 'electrolytic' | 'solid_mlcc';
  has3v3AnaFilter: boolean;      // Dedicated 10 Ohm + 10 uF + 100 nF Pi-filter for Pt1000/WD
  filterRejectionDb: number;     // 100 kHz buck-ripple attenuation on +3V3_ANA (dB)
  has3v3BackfeedZener: boolean;  // 3.6 V Zener clamp preventing Pi-OFF +3V3 lift
  jlcpcbFeederFeeEur: number;
  partsCostEur: number;
  partCount: number;
  verdict: string;
  failSafeProfile: string;
  softwareNote: string;
  pros: string[];
  cons: string[];
  bom: PowerBomItem[];
}

export const POWER_TOPOLOGY_ORDER: PowerTopologyId[] = [
  'rev_a_d18_bare',
  'pre_d18_j1_ideal_diode',
  'ptc_ferrite_filter',
  'gemini_rev_b_efuse',
  'tps25921_efuse_ic',
];

export const POWER_TOPOLOGY_SPECS: Record<PowerTopologyId, PowerTopologySpec> = {
  rev_a_d18_bare: {
    id: 'rev_a_d18_bare',
    shortName: 'Rev A Baseline (D18 Bare)',
    name: 'Rev A Baseline (D18): Direct Pi 5V/3V3 + C2 100 µF Electrolytic',
    badge: 'REV A BASELINE · UNPROTECTED',
    rSeries5vOhm: 0.04,
    hasFoldbackLimit: false,
    kneeCurrentMa: null,
    shortCurrentMa: null,
    tripTimeUs: null,
    bulkCapUf: 100,
    bulkCapType: 'electrolytic',
    has3v3AnaFilter: false,
    filterRejectionDb: 0,
    has3v3BackfeedZener: false,
    jlcpcbFeederFeeEur: 2.8, // 100 uF radial/SMD electrolytic is Extended
    partsCostEur: 0.18,
    partCount: 3,
    verdict:
      'Simple D18 power entry (C2 100 µF electrolytic + R1/D2 LED), but a dead short on HAT +5V crashes/reboots Pi 5 instantly, raw 45 mVpp Pi buck ripple enters Pt1000/WD unattenuated, electrolytic C2 dries out at 60 °C, and Pi-OFF +24V clamp currents lift +3V3.',
    failSafeProfile:
      'Relies solely on Pi USB-C PMIC overcurrent shutdown (~3–5 A) — any HAT +5V short instantly reboots the Pi and risks SD corruption. Unclamped +3V3 can float >4.5 V when Pi is powered off during a field miswire.',
    softwareNote:
      'Zero software impact; however Pi 5 PMIC brown-outs trigger unclean kernel panics and lose CoSTOS logging state.',
    pros: [
      'Minimalist 3-part power entry (follows D18: no redundant external J1 barrel/terminal)',
      'Virtually zero nominal +5V voltage drop (~0.01 V at 150 mA)',
    ],
    cons: [
      'PWR-01: Zero +3V3 decoupling or analog filter — 45 mVpp Pi 5 buck ripple hits Pt1000 & LM393 directly',
      'PWR-02: C2 100 µF electrolytic dries out in 60 °C boiler rooms and creates >4 A hot-plug inrush spike',
      'PWR-03: Zero HAT +5V short protection — screwdriver slip crashes Pi 5 instantly',
      'PWR-04: No 3.6 V Zener on +3V3 — Pi-OFF +24V clamp current back-powers & stresses RP1 silicon',
      '100 µF aluminum electrolytic is a JLCPCB Extended part (€2.80 feeder fee)',
    ],
    bom: [
      { designator: 'C2', part: '100 µF 16V SMD Electrolytic Cap', packageType: 'SMD-6.3x5.4', jlcpcbClass: 'Extended', unitCostEur: 0.14 },
      { designator: 'R1', part: '1.0 kΩ 1% 0805 Resistor (PWR LED)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'D2', part: 'Green 0805 SMD LED (+5V PWR)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
    ],
  },

  pre_d18_j1_ideal_diode: {
    id: 'pre_d18_j1_ideal_diode',
    shortName: 'Pre-D18 (J1 + Ideal Diode)',
    name: 'Pre-D18 Draft (D5): J1 Power Terminal + LM66100/Ideal Diode + Fuse + SMBJ5.0A',
    badge: 'DROPPED IN D18 · HIGH COST',
    rSeries5vOhm: 0.28,
    hasFoldbackLimit: false,
    kneeCurrentMa: 1000,
    shortCurrentMa: 2200,
    tripTimeUs: 180000,
    bulkCapUf: 100,
    bulkCapType: 'electrolytic',
    has3v3AnaFilter: false,
    filterRejectionDb: 0,
    has3v3BackfeedZener: false,
    jlcpcbFeederFeeEur: 8.4, // Ideal diode + PTC + SMBJ5.0A / J1
    partsCostEur: 2.35,
    partCount: 10,
    verdict:
      'Early D5 concept for back-powering the Pi through the HAT. Rightly dropped in D18 because the Pi runs from its own official USB-C supply — adds €8.40 in Extended fees and still lacks +3V3 analog filtering and fast Pi-5-safe short limiting.',
    failSafeProfile:
      'Slow 1 A PTC fuse trips in ~180 ms after >2 A surge (still browns out Pi 5); ideal diode prevents USB-C vs J1 back-feed when dual-powered, which is unused under D15/D18.',
    softwareNote:
      'Back-powering Pi 5 over GPIO pins 2/4 triggers Pi 5 USB-PD current warnings unless config.txt overrides usb_max_current_enable=1.',
    pros: [
      'Allows DIN-rail 5 V PSU wiring directly to J1 if USB-C were not used',
      'Includes SMBJ5.0A surge clamping on external J1 terminal',
    ],
    cons: [
      'Redundant under D15/D18 (Pi uses its own USB-C supply; DIN-rail feeds Pi USB-C directly)',
      '€8.40 in JLCPCB Extended feeder fees + €2.35 parts for unused circuitry',
      'Still fails PWR-01 (+3V3 ripple) and PWR-04 (Pi-OFF +3V3 back-feed)',
    ],
    bom: [
      { designator: 'J1', part: '2-Pin 5.08 mm Screw Terminal (+5V)', packageType: 'THT', jlcpcbClass: 'Extended', unitCostEur: 0.45 },
      { designator: 'U1,Q1', part: 'Ideal Diode Controller + P-MOSFET', packageType: 'SOT-23-6', jlcpcbClass: 'Extended', unitCostEur: 1.15 },
      { designator: 'F1,D1', part: '1A PTC Fuse + SMBJ5.0A TVS', packageType: '1206/SMB', jlcpcbClass: 'Extended', unitCostEur: 0.55 },
      { designator: 'C1,C2,R1,D2', part: '100 µF Elec + 100 nF + PWR LED', packageType: 'SMD', jlcpcbClass: 'Basic', unitCostEur: 0.20 },
    ],
  },

  ptc_ferrite_filter: {
    id: 'ptc_ferrite_filter',
    shortName: 'Option C (PTC + Ferrite)',
    name: 'Option C: 500 mA SMD PTC Fuse + Ferrite Bead + 3.3V RC Filter',
    badge: 'SLOW PTC · BROWNS OUT PI 5',
    rSeries5vOhm: 0.72,
    hasFoldbackLimit: false,
    kneeCurrentMa: 500,
    shortCurrentMa: 1450,
    tripTimeUs: 120000,
    bulkCapUf: 44,
    bulkCapType: 'solid_mlcc',
    has3v3AnaFilter: true,
    filterRejectionDb: 35,
    has3v3BackfeedZener: false,
    jlcpcbFeederFeeEur: 5.6, // 500 mA PTC + ferrite bead Extended
    partsCostEur: 0.58,
    partCount: 11,
    verdict:
      'Adds solid MLCC caps and +3V3 filtering, but a 500 mA SMD PTC has high cold resistance (0.72 Ω → 1.2 Ω post-trip), needs a ~1.45 A surge for ~120 ms to trip (crashing Pi 5 before opening!), and incurs €5.60 in Extended fees.',
    failSafeProfile:
      'Thermal PTC prevents PCB traces from burning on a sustained short, but the 120 ms / 1.45 A trip transient causes Pi 5 +5V droop and reboot before the fuse opens.',
    softwareNote:
      'Zero software changes, but Pi 5 reboots on any field +5V short due to thermal PTC lag.',
    pros: [
      'Solid MLCC bulk caps eliminate 60 °C electrolytic dry-out',
      'Clean +3V3_ANA RC filter rejects Pi buck ripple (-35 dB)',
    ],
    cons: [
      'PTC thermal lag (~120 ms at ~1.45 A) still browns out Raspberry Pi 5 on a short',
      'High PTC resistance (0.72 Ω cold, up to 1.4 Ω after trip) sags +5V_HAT during relay switching',
      '€5.60 JLCPCB Extended feeder fees (PTC + ferrite bead)',
      'Still misses PWR-04 (Pi-OFF +3V3 back-feed clamp)',
    ],
    bom: [
      { designator: 'F1', part: '500 mA Hold / 1 A Trip SMD PTC', packageType: '1206', jlcpcbClass: 'Extended', unitCostEur: 0.24 },
      { designator: 'FB1', part: '600 Ω @ 100 MHz Ferrite Bead (2 A)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.10 },
      { designator: 'C2a-b,C33a-b', part: '2× 22 µF 1206 + 10 µF + 100 nF MLCC', packageType: '1206/0805', jlcpcbClass: 'Basic', unitCostEur: 0.18 },
      { designator: 'R1,R_F33,D2', part: '2.2 kΩ + 10 Ω + Green PWR LED', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
    ],
  },

  gemini_rev_b_efuse: {
    id: 'gemini_rev_b_efuse',
    shortName: 'Rev B (Gemini Foldback eFuse)',
    name: 'Rev B (Gemini Version): 100% Basic Foldback eFuse + Solid MLCC + +3V3_ANA Filter + 3.6V Clamp',
    badge: 'RECOMMENDED · 100% BASIC (€0 FEE)',
    recommended: true,
    rSeries5vOhm: 1.85, // R_EF (1.8 Ohm 1206 0.5W) + AO3401A R_DS(on) (0.05 Ohm)
    hasFoldbackLimit: true,
    kneeCurrentMa: 360,
    shortCurrentMa: 119,
    tripTimeUs: 1.8,
    bulkCapUf: 44, // 2x 22 uF 16V 1206 X5R (~26 uF effective @ 5V, zero dry-out!)
    bulkCapType: 'solid_mlcc',
    has3v3AnaFilter: true,
    filterRejectionDb: 36,
    has3v3BackfeedZener: true,
    jlcpcbFeederFeeEur: 0.0,
    partsCostEur: 0.34,
    partCount: 16,
    verdict:
      'Fixes all 6 Block-1 defects with 100% JLCPCB Basic parts (€0.00 fee, €0.34/bd): AO3401A + MMBT3906 high-side foldback eFuse (360 mA knee → 119 mA dead-short in 1.8 µs, zero Pi 5 reboot!), 20-year solid MLCC bank, -36 dB +3V3_ANA filter, and 3.6 V Pi-OFF back-feed Zener.',
    failSafeProfile:
      'Any HAT +5V short folds back to 119 mA within 1.8 µs (0.57 W in AO3401A, T_J <= 122 °C @ 60 °C ambient — survives indefinitely with ZERO Pi 5 droop and auto-recovers!). Soft-starts C2 at 119 mA (zero hot-plug spike). BZT52C3V6 clamps Pi-OFF +24V clamp back-feed <= 3.62 V.',
    softwareNote:
      '100% drop-in compatible with D15/D18 (Pi powered by its own USB-C). Zero config.txt changes; eliminates unclean Pi 5 reboots on wiring accidents.',
    pros: [
      '100% JLCPCB Basic BOM (€0.00 feeder fees — saves €2.80 vs Rev A electrolytic and €8.40 vs Pre-D18)',
      'True foldback eFuse (AO3401A + MMBT3906 + 1.8 Ω 1206): 360 mA knee folds to 119 mA on dead short in 1.8 µs (0.57 W safe indefinitely, zero Pi 5 reboot!)',
      'Automatic 119 mA soft-start ramp charges 44 µF MLCC bank in 1.8 ms with zero Pi 5 hot-plug inrush spike',
      'Solid 2× 22 µF 16 V 1206 X5R + 100 nF MLCC bank eliminates 60 °C electrolytic dry-out (>20 yr boiler-room life)',
      'Dedicated +3V3_ANA RC filter (10 Ω + 10 µF + 100 nF) rejects Pi 5 buck ripple by -36 dB for clean Pt1000 & LM393',
      'Basic BZT52C3V6 (3.6 V Zener) + 4.7 kΩ bleeder holds +3V3 <= 3.62 V even when Pi is OFF during a +24 V field fault',
    ],
    cons: [
      '1.85 Ω sense + FET path drops ~0.27 V at 146 mA full relay+pump load (+5V_HAT = 4.78 V @ 5.05 V Pi rail — still >0.7 V margin for 5 V relays & doubler)',
      'Adds 13 tiny Basic SMD passives/SOT-23s vs bare D18 wire (~€0.16 part delta, €0.00 setup fee)',
    ],
    bom: [
      { designator: 'Q_EF1', part: 'AO3401A 30V 4A P-MOSFET (eFuse Pass)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'Q_EF2', part: 'MMBT3906 PNP 40V (Foldback Sense)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R_EF', part: '1.8 Ω 1% 1206 0.5W Sense Resistor', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'C2a,C2b,C2c', part: '2× 22 µF 16V 1206 + 100 nF 0805 MLCC', packageType: '1206/0805', jlcpcbClass: 'Basic', unitCostEur: 0.11 },
      { designator: 'D_Z33', part: 'BZT52C3V6 3.6V 500mW Zener Clamp', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R_F33,C33a-c', part: '10 Ω + 2× 10 µF + 2× 100 nF (+3V3_ANA)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.07 },
      { designator: 'R1,R_S,R_FB,R_G,D2', part: '2.2k, 1k, 10k, 10k, 4.7k + Green LED', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.05 },
    ],
  },

  tps25921_efuse_ic: {
    id: 'tps25921_efuse_ic',
    shortName: 'Option E (TPS25921 eFuse IC)',
    name: 'Option E: Integrated TPS25921L 5V eFuse IC + Dedicated 3.3V Filter & Zener',
    badge: 'INTEGRATED IC · EXTENDED FEE',
    rSeries5vOhm: 0.09,
    hasFoldbackLimit: true,
    kneeCurrentMa: 450,
    shortCurrentMa: 0, // Latch-off / thermal hiccup
    tripTimeUs: 2.0,
    bulkCapUf: 44,
    bulkCapType: 'solid_mlcc',
    has3v3AnaFilter: true,
    filterRejectionDb: 36,
    has3v3BackfeedZener: true,
    jlcpcbFeederFeeEur: 2.8, // TPS25921L SOIC-8 is Extended
    partsCostEur: 1.48,
    partCount: 12,
    verdict:
      'Lowest nominal voltage drop (0.09 Ω → 13 mV at 146 mA) with true thermal hiccup and precision current limit, but TPS25921L is an Extended part (€2.80 fee + €1.15 IC) with single-vendor lead-time exposure.',
    failSafeProfile:
      'Clamps dead shorts in 2 µs and enters thermal hiccup/latch-off with near-zero average dissipation; includes internal overvoltage clamp at 6.1 V.',
    softwareNote:
      'Drop-in hardware replacement; latch-off variant requires cycling Pi power after a short (auto-retry variant TPS25921A recovers automatically).',
    pros: [
      'Ultra-low 0.09 Ω R_ON (~13 mV drop at 146 mA full load)',
      'Internal 6.1 V OVP clamp + thermal shutdown hiccup',
      'Clean +3V3_ANA filter and 3.6 V Pi-OFF Zener included',
    ],
    cons: [
      'TPS25921L is a JLCPCB Extended part (€2.80 feeder fee + €1.15 IC = €2.04/bd @ 5× vs €0.34/bd for Rev B)',
      'Single-source TI IC vs universal commodity SOT-23 Basic transistors',
    ],
    bom: [
      { designator: 'U_EF', part: 'TPS25921ADR 5V eFuse IC (Auto-Retry)', packageType: 'SOIC-8', jlcpcbClass: 'Extended', unitCostEur: 1.15 },
      { designator: 'C2a-c', part: '2× 22 µF 16V 1206 + 100 nF MLCC', packageType: '1206/0805', jlcpcbClass: 'Basic', unitCostEur: 0.11 },
      { designator: 'D_Z33', part: 'BZT52C3V6 3.6V Zener + 3.3V Filter', packageType: 'SOD-123/0805', jlcpcbClass: 'Basic', unitCostEur: 0.14 },
      { designator: 'R_ILIM,R1,D2', part: 'ILIM Resistor + 2.2 kΩ + PWR LED', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
    ],
  },
};

export interface SubsystemLoadBreakdown {
  id: string;
  label: string;
  rail5vMa: number;
  rail3v3Ma: number;
  note: string;
}

export interface PowerEvalResult {
  topologyId: PowerTopologyId;
  breakdown: SubsystemLoadBreakdown[];
  total5vMa: number;
  total3v3Ma: number;
  totalHatPowerMw: number;
  v5HatV: number;                // Delivered +5V_HAT under nominal/active conditions
  v5DropV: number;               // Voltage drop across Block 1 protection
  v3v3AnaV: number;              // Clean +3V3_ANA rail voltage
  v3v3AnaRippleMv: number;       // Residual buck ripple on +3V3_ANA (mVpp)
  hotPlugInrushA: number;        // Peak Pi header inrush current (A)
  shortCurrentMa: number;        // Current drawn from Pi +5V on HAT dead short (mA)
  passFetShortPowerW: number;    // Power dissipated in eFuse pass FET on dead short (W)
  passFetShortTjC: number;       // Junction temp of eFuse pass FET at ambientTempC (°C)
  pi5BrownoutRisk: boolean;      // True if short or inrush threatens Pi 5 PMIC reboot
  piOff3v3PeakV: number;         // +3V3 rail peak voltage when Pi is OFF + 24V field fault (9 mA)
  capLifetimeYearsAt60C: number; // Estimated bulk cap service life at 60 °C boiler room
  faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL';
  faultNote: string;
}

export function powerPerBoardCostEur(spec: PowerTopologySpec, batchSize: 2 | 5): number {
  return spec.partsCostEur + spec.jlcpcbFeederFeeEur / batchSize;
}

export function computeHatLoadBreakdown(params: PowerSimParams): SubsystemLoadBreakdown[] {
  const s01_3v3 = 1.6; // ADS1115 + Pt1000 bridge excitation (~1.6 mA avg, duty-cycled even lower)
  const s02_5v = params.pumpActive ? 22.0 : 4.0; // Pump PWM Supply Rev E oscillator + load
  const s03_3v3 = 2.8; // LM393 dual comparator + WD_OK indicator LED
  const s03_5v = 1.2; // Q12 gate pull-down when relay supply enabled
  const s04_5v = params.oneWireSensorCount * 1.5; // Powered DS18B20 conversion peak (1.5 mA/ea)
  const s04_3v3 = 0.8; // 2N7002 bus A/B pull-ups
  const s05_5v = params.relayLoadMa + (params.relayLoadMa > 0 ? 2.5 : 0); // REL1 coil/SSR + status LED
  const s05_3v3 = 1.4; // FB1 pull-up + GPIO drive
  const s06_5v = 1.5; // Block 1 PWR LED (D2) + eFuse bias
  const s06_3v3 = 0.7; // 4.7 kOhm bleeder on +3V3

  return [
    { id: '01', label: '01. Pt1000 Collector', rail5vMa: 0.8, rail3v3Ma: s01_3v3, note: 'U1 LM393DR (+5V) + 0.1% ratiometric bridge (+3V3_ANA)' },
    { id: '02', label: '02. Pump PWM Supply', rail5vMa: s02_5v, rail3v3Ma: 0, note: 'Rev E 5V->8.5V charge pump/boost' },
    { id: '03', label: '03. Hardware Watchdog', rail5vMa: s03_5v, rail3v3Ma: s03_3v3, note: 'LM393 U4A/B + Q12 gate drive' },
    { id: '04', label: '04. 1-Wire Buses', rail5vMa: s04_5v, rail3v3Ma: s04_3v3, note: `${params.oneWireSensorCount}× DS18B20 powered (1.5 mA/ea)` },
    { id: '05', label: '05. Pump Out & Relays', rail5vMa: s05_5v, rail3v3Ma: s05_3v3, note: `REL1 (${params.relayLoadMa} mA) + FB1/RB1` },
    { id: '06', label: '06. Pi Power Entry', rail5vMa: s06_5v, rail3v3Ma: s06_3v3, note: 'PWR LED D2 + 3.3V Zener bleeder' },
  ];
}

export function evaluatePowerEntry(
  topologyId: PowerTopologyId,
  params: PowerSimParams
): PowerEvalResult {
  const spec = POWER_TOPOLOGY_SPECS[topologyId];
  const breakdown = computeHatLoadBreakdown(params);

  const total5vMa = breakdown.reduce((acc, r) => acc + r.rail5vMa, 0);
  const total3v3Ma = breakdown.reduce((acc, r) => acc + r.rail3v3Ma, 0);

  const effPi5v = params.activeFault === 'pi_uvlo_465v' ? 4.65 : params.pi5vRailV;
  const effRippleMv = params.activeFault === 'buck_ripple_60mv' ? 60 : params.pi3v3RippleMv;
  const effAmbientC = params.activeFault === 'boiler_60c_10yr' ? 60 : params.ambientTempC;

  const v5DropV = (total5vMa / 1000) * spec.rSeries5vOhm;
  const v5HatV = Math.max(0, effPi5v - v5DropV);

  // Analog +3V3_ANA voltage & ripple (10 Ohm * ~4.4 mA analog load = 44 mV drop)
  const anaLoadMa = breakdown[0].rail3v3Ma + breakdown[2].rail3v3Ma;
  const v3v3AnaV = spec.has3v3AnaFilter ? params.pi3v3RailV - (anaLoadMa / 1000) * 10.0 : params.pi3v3RailV;
  const v3v3AnaRippleMv = spec.has3v3AnaFilter
    ? effRippleMv / Math.pow(10, spec.filterRejectionDb / 20)
    : effRippleMv;

  // Hot-plug inrush current into bulk caps
  const hotPlugInrushA =
    topologyId === 'gemini_rev_b_efuse'
      ? 0.12 // Soft-started cleanly by foldback eFuse!
      : topologyId === 'tps25921_efuse_ic'
      ? 0.25 // Internal dV/dt soft-start
      : topologyId === 'ptc_ferrite_filter'
      ? 2.8 // Limited mainly by 0.72 Ohm PTC + ESL
      : 4.8; // Bare 100 uF electrolytic directly across Pi pins 2/4

  // Dead short on HAT +5V rail
  const shortCurrentMa =
    spec.shortCurrentMa === null
      ? 5200 // Unprotected -> Pi 5 PMIC hits >5 A hard cutoff!
      : spec.shortCurrentMa;

  // Pass FET dissipation on dead short
  let passFetShortPowerW = 0;
  if (topologyId === 'gemini_rev_b_efuse') {
    const iShortA = shortCurrentMa / 1000;
    const vDropFet = effPi5v - iShortA * 1.8;
    passFetShortPowerW = vDropFet * iShortA;
  } else if (topologyId === 'tps25921_efuse_ic') {
    passFetShortPowerW = 0.08; // Thermal hiccup duty cycle < 3%
  } else if (topologyId === 'ptc_ferrite_filter') {
    passFetShortPowerW = 0.75; // PTC steady tripped hold power
  }

  // SOT-23 AO3401A R_thetaJA ~ 110 °C/W on 2-oz/1-oz copper pad
  const passFetShortTjC = effAmbientC + passFetShortPowerW * 110;

  const pi5BrownoutRisk =
    spec.shortCurrentMa === null ||
    (spec.tripTimeUs !== null && spec.tripTimeUs > 5000);

  // Pi-OFF +24V miswire injecting 9 mA into +3V3 via 05 FB1 / 04 1-Wire clamp diodes
  // With BZT52C3V6 + 4.7k bleeder: clamps cleanly at 3.62 V; without: lifts unpowered +3V3 rail to ~5.1 V!
  const piOff3v3PeakV = spec.has3v3BackfeedZener ? 3.62 : 5.15;

  // Bulk capacitor service life at 60 °C continuous boiler-room operation
  const capLifetimeYearsAt60C = spec.bulkCapType === 'solid_mlcc' ? 25.0 : 4.2;

  const totalHatPowerMw = effPi5v * total5vMa + params.pi3v3RailV * total3v3Ma;

  // Fault evaluation
  let faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL' = 'PASS';
  let faultNote = `Nominal: +5V_HAT = ${v5HatV.toFixed(2)} V (${total5vMa.toFixed(0)} mA) | +3V3_ANA ripple = ${v3v3AnaRippleMv.toFixed(1)} mVpp | All rails healthy.`;

  if (params.activeFault === 'none') {
    if (!spec.has3v3AnaFilter) {
      faultVerdict = 'MARGINAL';
      faultNote = `No +3V3_ANA filter — ${v3v3AnaRippleMv.toFixed(0)} mVpp Pi buck ripple enters Pt1000 ADC & Watchdog LM393 directly.`;
    } else if (v5HatV < 4.45) {
      faultVerdict = 'MARGINAL';
      faultNote = `+5V_HAT sags to ${v5HatV.toFixed(2)} V under ${total5vMa.toFixed(0)} mA load (check series resistance).`;
    }
  } else if (params.activeFault === 'hat_5v_short') {
    if (pi5BrownoutRisk) {
      faultVerdict = 'FAIL';
      faultNote =
        spec.shortCurrentMa === null
          ? `UNPROTECTED SHORT: >5 A surge crashes Raspberry Pi 5 PMIC immediately (unclean reboot / SD corruption)!`
          : `PTC LAG (${(spec.tripTimeUs! / 1000).toFixed(0)} ms @ ${(shortCurrentMa / 1000).toFixed(2)} A): browns out Raspberry Pi 5 before thermal fuse opens!`;
    } else {
      faultVerdict = 'PASS';
      faultNote =
        topologyId === 'gemini_rev_b_efuse'
          ? `Foldback eFuse clamps dead short to ${shortCurrentMa} mA in ${spec.tripTimeUs} µs (P_Q=${passFetShortPowerW.toFixed(2)} W, T_J=${passFetShortTjC.toFixed(0)} °C) — ZERO Pi 5 droop!`
          : `TPS25921 clamps short in ${spec.tripTimeUs} µs and enters thermal hiccup — ZERO Pi 5 droop!`;
    }
  } else if (params.activeFault === 'hot_plug_inrush') {
    if (hotPlugInrushA > 2.0) {
      faultVerdict = 'FAIL';
      faultNote = `Inrush spike of ${hotPlugInrushA.toFixed(1)} A into ${spec.bulkCapUf} µF bulk cap trips Pi 5 +5V brown-out detector!`;
    } else {
      faultVerdict = 'PASS';
      faultNote = `Active soft-start limits bulk cap charge ramp to ${hotPlugInrushA.toFixed(2)} A — completely invisible to Pi 5 PMIC!`;
    }
  } else if (params.activeFault === 'pi_uvlo_465v') {
    if (v5HatV < 4.25) {
      faultVerdict = 'FAIL';
      faultNote = `At 4.65 V Pi UVLO, high series drop pulls +5V_HAT down to ${v5HatV.toFixed(2)} V (below 4.3 V relay pull-in floor)!`;
    } else {
      faultVerdict = 'PASS';
      faultNote = `Even at 4.65 V Pi UVLO under ${total5vMa.toFixed(0)} mA load, +5V_HAT holds ${v5HatV.toFixed(2)} V (relay & pump doubler stay solid).`;
    }
  } else if (params.activeFault === 'pi_off_24v_backfeed') {
    if (!spec.has3v3BackfeedZener) {
      faultVerdict = 'FAIL';
      faultNote = `UNCLAMPED BACK-FEED: 9 mA from +24 V field clamp lifts unpowered Pi +3V3 rail to ${piOff3v3PeakV.toFixed(2)} V (damages Pi 5 RP1)!`;
    } else {
      faultVerdict = 'PASS';
      faultNote = `Basic BZT52C3V6 Zener absorbs 9 mA clamp current and holds unpowered Pi +3V3 strictly <= ${piOff3v3PeakV.toFixed(2)} V!`;
    }
  } else if (params.activeFault === 'buck_ripple_60mv') {
    if (!spec.has3v3AnaFilter) {
      faultVerdict = 'FAIL';
      faultNote = `Full ${v3v3AnaRippleMv.toFixed(0)} mVpp Pi 5 switching ripple hits Pt1000 bridge & LM393 comparator thresholds!`;
    } else {
      faultVerdict = 'PASS';
      faultNote = `+3V3_ANA Pi-filter (10 Ω + 10 µF + 100 nF) crushes 60 mVpp buck ripple down to ${v3v3AnaRippleMv.toFixed(1)} mVpp (-${spec.filterRejectionDb} dB)!`;
    }
  } else if (params.activeFault === 'boiler_60c_10yr') {
    if (spec.bulkCapType === 'electrolytic') {
      faultVerdict = 'FAIL';
      faultNote = `100 µF aluminum electrolytic dries out in ~${capLifetimeYearsAt60C.toFixed(1)} yr at 60 °C continuous boiler-room operation (ESR > 5 Ω)!`;
    } else {
      faultVerdict = 'PASS';
      faultNote = `Solid 2× 22 µF 16V 1206 X5R MLCC bank has zero liquid electrolyte (>25 yr service life at 60 °C, ESR < 15 mΩ)!`;
    }
  }

  return {
    topologyId,
    breakdown,
    total5vMa,
    total3v3Ma,
    totalHatPowerMw,
    v5HatV,
    v5DropV,
    v3v3AnaV,
    v3v3AnaRippleMv,
    hotPlugInrushA,
    shortCurrentMa,
    passFetShortPowerW,
    passFetShortTjC,
    pi5BrownoutRisk,
    piOff3v3PeakV,
    capLifetimeYearsAt60C,
    faultVerdict,
    faultNote,
  };
}

export interface FoldbackCurvePoint {
  vOutV: number;
  revBCurrentMa: number;
  ptcCurrentMa: number;
  revACurrentMa: number;
  revBPowerW: number;
}

/** Computes the V_OUT vs I_OUT foldback curve from 5.0 V (no load) down to 0.0 V (dead short) */
export function computeFoldbackCurve(pi5vRailV: number): FoldbackCurvePoint[] {
  const pts: FoldbackCurvePoint[] = [];
  const rEf = 1.8;
  const rOn = 0.05;
  const rS = 1.0; // kOhm
  const rFb = 10.0; // kOhm
  const vBe = 0.65;
  const alpha = rFb / (rS + rFb); // 0.9091

  // Sweep V_OUT from pi5vRailV down to 0.0 V in 0.25 V steps
  for (let i = 0; i <= 20; i++) {
    const vOutV = Number(((pi5vRailV * (20 - i)) / 20).toFixed(2));
    // Linear region (FET saturated): I_lin = (V_in - V_out) / (rEf + rOn)
    const iLinMa = ((pi5vRailV - vOutV) / (rEf + rOn)) * 1000;
    // Foldback ceiling: V_B = alpha * V_S + (1 - alpha) * V_out = V_in - vBe
    // => V_S = (V_in - vBe - (1 - alpha) * V_out) / alpha
    const vS = (pi5vRailV - vBe - (1 - alpha) * vOutV) / alpha;
    const iFoldMa = Math.max(0, ((pi5vRailV - vS) / rEf) * 1000);
    const revBCurrentMa = Math.min(iLinMa, iFoldMa);
    const revBPowerW = Math.max(0, (pi5vRailV - vOutV - (revBCurrentMa / 1000) * rEf) * (revBCurrentMa / 1000));

    // PTC surges to ~1450 mA before thermal trip
    const ptcCurrentMa = Math.min(1450, ((pi5vRailV - vOutV) / 0.72) * 1000);
    // Bare Rev A hits >2000 mA immediately (capped at 1600 for chart readability)
    const revACurrentMa = Math.min(1600, ((pi5vRailV - vOutV) / 0.08) * 1000);

    pts.push({
      vOutV,
      revBCurrentMa: Number(revBCurrentMa.toFixed(1)),
      ptcCurrentMa: Number(ptcCurrentMa.toFixed(1)),
      revACurrentMa: Number(revACurrentMa.toFixed(1)),
      revBPowerW: Number(revBPowerW.toFixed(2)),
    });
  }
  return pts;
}
