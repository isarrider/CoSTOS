import { pt1000Resistance, pt1000Temperature, selfHeatingDeltaK } from './pt1000';

export type TopologyId =
  | 'max31865'
  | 'switched_rc'
  | 'ads1115_diff_mux'
  | 'tm7705_ratiometric'
  | 'stm32_basic_coproc'
  | 'ads124s08_idac'
  | 'mcp3424_i2c'
  | 'bridge_cs1237'
  | 'bridge_lmv358_ads1115'
  | 'pwm_dac_lm393'
  | 'ltc2983_turnkey';

export type FaultMode = 'none' | 'open' | 'short' | 'surge_24v' | 'stale';

export interface SimulationParams {
  collectorTempC: number;
  resistorTolerancePct: 0.1 | 0.5 | 1.0;
  cableResistanceOhm: number; // 2-wire round trip (20m 0.75mm^2 ~ 0.95 Ohm)
  calibrateCableAndZero: boolean; // CoSTOS per-channel calibration offset
  supplyVoltageV: number; // Pi 5V rail (4.63V UV flag .. 5.25V strong)
  ambientTempC: number; // Board ambient temp in boiler room (0..60 °C)
  gpioJitterUs: number; // Linux scheduling / IRQ latency jitter
  pollIntervalS: 1 | 3 | 5 | 10; // Collector sampling period (e.g., 3s while pump OFF)
  activeFault: FaultMode;
}

export interface BomLineItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Preferred' | 'Extended';
  unitCostEur: number;
}

export interface NodeReading {
  label: string;
  value: string;
  note?: string;
}

export interface TopologySpec {
  id: TopologyId;
  name: string;
  shortName: string;
  badgeText: string;
  summary: string;
  jlcpcbFeederFeeEur: number; // €2.80 per extended part type on JLCPCB
  partCostEur: number; // LCSC component sum for Pt1000 front-end block
  interfacePins: string;
  handSolderability: 'Fine-pitch SSOP' | 'Fine-pitch QFP / QFN' | 'SOIC / 0805 Easy';
  ratiometric: boolean;
  inputProtection: string;
  openShortDetection: string;
  resolutionK: number;
  maxRecommendedErrorK: number;
  bom: BomLineItem[];
  verdict: string;
  advantages: string[];
  tradeoffs: string[];
  configTxtDiff: string;
  softwareChanges: string;
  softwarePros: string[];
  softwareCons: string[];
  securityNotes: {
    linuxOsSecurity: string;
    electricalSafety: string;
    mitigation: string;
  };
}

export interface SimulationResult {
  topologyId: TopologyId;
  trueTempC: number;
  trueResistanceOhm: number;
  measuredTempC: number | null;
  errorK: number | null;
  worstCaseBoundK: number;
  excitationCurrentMa: number;
  selfHeatingMw: number;
  selfHeatingK: number;
  digitalReadoutLabel: string;
  digitalReadoutValue: string;
  detectedFault: 'OK' | 'OpenCircuit' | 'ShortCircuit' | 'OverVoltageClamp' | 'StaleBus' | 'MissedFault';
  safetyStatus: 'Nominal' | 'Drifting' | 'FaultCaught' | 'Unsafe';
  safetyDetail: string;
  nodes: NodeReading[];
}

export const DEFAULT_PARAMS: SimulationParams = {
  collectorTempC: 100,
  resistorTolerancePct: 0.1,
  cableResistanceOhm: 1.2,
  calibrateCableAndZero: true,
  supplyVoltageV: 5.0,
  ambientTempC: 25,
  gpioJitterUs: 40,
  pollIntervalS: 10,
  activeFault: 'none',
};

export const TOPOLOGY_SPECS: Record<TopologyId, TopologySpec> = {
  max31865: {
    id: 'max31865',
    name: 'MAX31865AAP+ (Rev A Baseline)',
    shortName: 'MAX31865 Baseline',
    badgeText: 'Reference · Extended Fee',
    summary:
      'Dedicated 15-bit ratiometric RTD-to-digital converter on SPI0 with 4.3 kΩ 0.1% reference, built-in ±45 V protection, and hardware open/short fault flags.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 4.08,
    interfacePins: 'SPI0 (MOSI, MISO, SCLK, CE0)',
    handSolderability: 'Fine-pitch SSOP',
    ratiometric: true,
    inputProtection: '±45 V internal + PESD24V + 100 Ω filter',
    openShortDetection: 'Native hardware fault register',
    resolutionK: 0.034,
    maxRecommendedErrorK: 0.5,
    bom: [
      { designator: 'U1', part: 'MAX31865AAP+ RTD ADC', packageType: 'SSOP-20', jlcpcbClass: 'Extended', unitCostEur: 3.87 },
      { designator: 'R_ref', part: '4.3 kΩ 0.1% 25ppm Thin-Film', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.09 },
      { designator: 'R_f1..2, C_f', part: '100 Ω × 2 + 100 nF filter', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D1..D2', part: 'PESD24VL1BA 24V Roof ESD TVS', packageType: 'SOD-323', jlcpcbClass: 'Extended', unitCostEur: 0.08 },
    ],
    verdict: 'Zero-risk reference benchmark, but single-handedly adds €3.30/board in recurring silicon over Rev D with the exact same 3 Extended reels (€8.40).',
    advantages: [
      'Purpose-built 15-bit ratiometric RTD converter achieving ~0.35 K accuracy out of the box with only one 4.3 kΩ 0.1% reference resistor',
      'Native ±45 V continuous input fault protection on RTDIN+ / RTDIN− survives outdoor roof miswiring indefinitely',
      'Built-in hardware fault register flags OpenCircuit, ShortCircuit, and over/under-voltage over SPI with zero offset calibration',
      'Ultra-low sensor self-heating (~0.14 mW), zero capacitor aging drift, and built-in 50/60 Hz mains hum rejection filter',
    ],
    tradeoffs: [
      'Most expensive component on the 1-Wire HAT: €4.08 parts + €8.40 live JLCPCB Extended fees (3 reels: MAX31865 + 0.1% R_ref + PESD24V = €8.28/bd on 2×, €5.76/bd on 5×)',
      'Fine-pitch 0.65 mm SSOP-20 package makes DIY hand-soldering and field rework difficult',
      'Consumes 4 SPI0 pins on the 40-pin Raspberry Pi header for a single Pt1000 channel',
      'Single-source Analog Devices IC: PCB footprint has no pin-compatible second-source drop-in if lead times tighten',
    ],
    configTxtDiff: 'dtparam=spi=on  (Reference baseline: uses /dev/spidev0.0, spi + gpio groups)',
    softwareChanges:
      'Reference baseline in costos-hw-linux: polls MAX31865 over /dev/spidev0.0 once per sample period, reads 15-bit RTD ratio + native 8-bit fault status register, and evaluates Callendar–Van Dusen.',
    softwarePros: [
      'Simplest Rust implementation: single deterministic 2-byte SPI register read + native Open/Short/OV fault byte',
      'Zero Linux GPIO timing constraints, mux state machine, or software zero-offset calibration required',
    ],
    softwareCons: [
      'Requires dtparam=spi=on, /dev/spidev0.0 kernel binding, and spi user group membership',
      'Ties up all 4 SPI0 pins (GPIO 8/9/10/11) on the HAT for a single collector probe',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Requires spi group (/dev/spidev0.0). A compromised process in spi group can send arbitrary SPI commands to CE0/CE1, though SPI is point-to-point and cannot tamper with I²C sensors.',
      electricalSafety:
        'Highest fail-safe isolation: silicon ±45 V input tolerance and dedicated comparator fault byte (0x80/0x40/0x20) prevent silent stuck readings or 3.3 V rail back-feeding.',
      mitigation:
        'Restrict /dev/spidev0.0 access solely to the costos systemd service user; read fault register (0x07) on every single poll before trusting RTD MSB/LSB.',
    },
  },
  switched_rc: {
    id: 'switched_rc',
    name: 'Switched-Mux DC Divider + 72.2 Hz RC Ramp — Rev D (100% Basic)',
    shortName: 'Switched Ramp Rev D (100% Basic)',
    badgeText: 'Locked Rev D · 31 Parts · 0 Ext Reels',
    summary:
      'Locked Rev D (100% JLCPCB Basic SMD) front-end: single-reel 7× 1.00 kΩ ±1% Basic (C17513: 4.00 kΩ / 1.00 kΩ / 2.00 kΩ), dual-wire 100 nF 50 V Basic ESD/RFI shunt caps (C106 on J6:1 + C105 on J6:2, C49678), symmetric Basic 1N4148W clamps (D8→+3V3/TL431 D9 + D8B→AGND, C81598), Basic 2× 100 Ω 1206 parallel (50 Ω/500 mW) Q1 guard, and 72.2 Hz TI LM393DR2G (C7955) RC ramp on 2× 10 nF X7R Basic (C1710, BIST-cancelled). 0 Extended SMD reels (€0.00 loading fees across the entire HAT); ±0.4–0.6 K after 5 s software calibration (±2–4 K raw).',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.36,
    interfacePins: '4× free GPIO (22/27/12/13 · SPI0 free)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: 'C106+C105 100nF 50V + 10k Sense + D8/D8B 1N4148W + 2×100Ω 1206',
    openShortDetection: '0 Edges: Pin HIGH = Open (>1.53 V), Pin LOW = Short (<0.48 V)',
    resolutionK: 0.01,
    maxRecommendedErrorK: 0.6,
    bom: [
      { designator: 'U1', part: 'LM393DR2G (onsemi C7955, +5V_HAT, 72.2 Hz Ramp + Slicer)', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
      { designator: 'Q1..Q3, R12..14', part: '3× AO3400A N-MOSFET (C20917) + 3× 10k PD (C17414)', packageType: 'SOT-23/0805', jlcpcbClass: 'Basic', unitCostEur: 0.12 },
      { designator: 'C1..C6', part: '2× 10 nF 50 V X7R (C1710 Basic) + 4× 100 nF 50 V X7R (C49678 Basic: C103–C106)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R1A–D, R2, R3A–B', part: '7× 1.00 kΩ ±1% ±100ppm Basic Single Reel (C17513: 4k/1k/2k)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'R4, R5A–B, R6–11, D8, D8B', part: '10k, 2×100R 1206 Basic (C17901), 2×390k (C17656 Pref), 100k, 150k, 2×4.7k, 2× 1N4148W (C81598 Basic: D8+D8B)', packageType: '1206/0805/SOD', jlcpcbClass: 'Basic', unitCostEur: 0.09 },
    ],
    verdict: 'Locked 100% Basic discrete front-end (€0.36 parts BOM across 31 parts; 0 Extended SMD reels = €0.00 loading fees across the ENTIRE HAT): saves €12.12/board @ 1× and €5.40/board @ 5× vs MAX31865 (€0.36 vs €5.76 @ 5×), 0.00 K leakage, TI LM393 SPICE ramp 0.476–1.533 V, ±0.4–0.6 K after 5 s software calibration (±2–4 K raw), SPI0 free — bench-unproven on Linux GPIO timing vs MAX31865.',
    advantages: [
      '0 Extended SMD reels (€0.00 loading fees across the ENTIRE HAT) — cuts recurring BOM to €0.36/bd and saves €8.40/order + €3.72/bd vs MAX31865 (5× €0.36 vs €5.76/bd!)',
      'Zero roof-cable capacitance bias (0.00 K even >50 m): PT1000 runs pure DC with 100 nF 50 V Basic ESD/RFI shunts on BOTH wires (C106 + C105), 159 Hz RC filter on U1A+, and +3V3_ANA Pi-filter (−36.04 dB @ 100 kHz)',
      'Single-reel 7× 1.00 kΩ ±1% Basic (C17513, €0.004/ea) shares one factory lot and runs 4× cooler under +24 V fault (25.8 mW/ea); optional 0.1% C110774 upgrade is drop-in with zero PCB change',
      'Symmetric Basic 1N4148W clamps (D8→+3V3/TL431 D9 @ 3.679 V Pi-OFF + D8B→AGND @ −0.65 V) handle both +24 V DC miswire and negative ESD transients with <5 nA leakage',
      'Uses 4 verified free non-SPI boot pull-DOWN GPIOs (22/27/12/13 · Pins 15/13/32/33) + stiff 10 kΩ gate pull-downs — zero HAT collisions, SPI0 & GPIO 21 stay free',
    ],
    tradeoffs: [
      'Raw uncalibrated accuracy with 1% Basic resistors (C17513) is ~±2–4 K (fine for roof ΔT pump start); a one-time 5 s tap-water / DS18B20 software offset in Setup Wizard tightens this to ~±0.4–0.6 K year-round',
      'No active >26 V avalanche TVS clamp on roof cables (C106/C105 100 nF 50 V absorb IEC ESD & RFI like commercial Resol DeltaSol controllers; heavy lightning still needs an external DIN arrester)',
      'Bench-unproven on real Raspberry Pi Linux GPIO timing jitter vs MAX31865 (simulated with official TI .SUBCKT LM393 in ngspice-39; Pi 5 needs RP1 PIO instead of pigpio)',
      'Higher discrete PCB part count (31 SMD parts across 12 BOM lines vs 6 parts around MAX31865), though all are easy SOIC-8 / 0805 / 1206 Basic parts',
    ],
    configTxtDiff: 'Remove dtparam=spi=on (SPI0 stays free); add gpio=27,12,13=op,dl & gpio=22=ip,pn (/dev/gpiochip* only)',
    softwareChanges:
      'Async Tokio task in costos-hw-linux runs every 10 s: steps DC mux PT1 -> R_lo (1.00 kΩ) -> R_hi (2.00 kΩ) on GPIO 27/12/13 (strict 1-hot enum), discards 2 cycles (28 ms = 28τ settle), captures 500 ms (~36 cycles, 25 EU mains cycles) on GPIO 22 via gpio_v2, solves exact g(x) ln() curve via bisection, applies stored 1-pt calibration offset, and checks BIST.',
    softwarePros: [
      'Zero kernel bus overlays (no spidev/i2c) and zero external sensor crates — ~80 lines of self-contained, auditable Rust including ln() bisection',
      '72.2 Hz local ramp (~22 IRQs/s avg) + tight 0.476–1.533 V TI LM393 window gives ~19–23 µs/K sensitivity and <0.02% Pi CPU load',
      'Deterministic 0-edge fault state: steady GPIO 22 HIGH = OpenCircuit (>1.53 V), steady LOW = ShortCircuit (<0.48 V)',
    ],
    softwareCons: [
      'Bench-unproven Linux GPIO edge-timestamp jitter budget; requires ±2% median period/duty outlier rejection in Rust via gpio_v2 hardware timestamps',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Smallest OS privilege footprint (gpio group only; SPI0 stays completely free). 72.2 Hz operating frequency sits well below a tight 400 Hz IRQ storm cutoff.',
      electricalSafety:
        'Dual-wire 100 nF 50 V Basic caps (C106 on PT1_V_DIV + C105 on PT1_B_EXT) absorb ±8 kV IEC ESD to <25 V; R101A–D (4× 1.00 kΩ = 4.00 kΩ, only 25.8 mW/ea @ 24 V) limit +3V3 backfeed to 5.1 mA; R4 (10 kΩ) + symmetric Basic 1N4148W (D8 -> +3V3 clamped to 3.679 V by TL431 D9 Pi-OFF; D8B -> AGND at −0.65 V) hold U1A+ safely within −0.65 V .. +4.30 V (<5 nA normal leakage).',
      mitigation:
        'Arm GPIO 22 edge monitoring ONLY during the 1.5 s measurement window, fault if >400 edges/s arrive, discard first 2 cycles, apply ±2% median outlier rejection, and assert D(R_hi)/D(R_lo) BIST stays within ±2%.',
    },
  },
  bridge_cs1237: {
    id: 'bridge_cs1237',
    name: 'Wheatstone Bridge + CS1237 / HX711 24-bit ADC',
    shortName: 'Bridge + 24-bit ADC',
    badgeText: 'Ultra-Low IC · Extended Fee',
    summary:
      'Ratiometric 4.7 kΩ / 1 kΩ Wheatstone bridge fed directly into a 24-bit differential sigma-delta PGA ADC (CS1237 or attenuated HX711) on 2 GPIOs. Eliminates op-amps completely.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 0.65,
    interfacePins: '2× GPIO (SCLK + DOUT)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '2× 470 Ω series + PESD24V + 1N4148W clamp',
    openShortDetection: 'PGA saturation (±Full Scale = Open / Short)',
    resolutionK: 0.005,
    maxRecommendedErrorK: 0.5,
    bom: [
      { designator: 'U1', part: 'CS1237-SO / HX711 24-bit PGA ADC', packageType: 'SOP-8', jlcpcbClass: 'Extended', unitCostEur: 0.28 },
      { designator: 'R1..R3', part: 'Single-reel 1.00 kΩ 0.1% bridge (4×+1×)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.30 },
      { designator: 'R_p, C, D', part: 'Filter cap + PESD24V (Ext) + 1N4148W', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.07 },
    ],
    verdict: 'Highest raw precision (±0.25 K) for €0.65 in parts + €8.40 Extended fees (3 reels: CS1237 + 0.1% R + PESD24V), but bit-banged readout lacks CRC.',
    advantages: [
      'Highest raw resolution (~0.005 K) and accuracy (±0.25 K) across −50…+250 °C with zero op-amp input offset (V_os)',
      '100% ratiometric differential bridge (V_REF = V_EXC) cancels Pi 5 V / 3.3 V supply sag completely',
      'Immune to roof cable parasitic capacitance (DC bridge) and includes native 50/60 Hz mains hum rejection',
      'Ultra-cheap chip (~€0.28) in an easy hand-solderable SOP-8 package (easy to solder post-PCBA to save 1 Extended reel)',
    ],
    tradeoffs: [
      'Requires 3 Extended reels apples-to-apples (€8.40: CS1237 + 0.1% thin-film bridge + PESD24V roof TVS)',
      'Bit-banged 2-wire protocol has no hardware CRC—an EMI glitch during readout can corrupt a bit unless median-of-3 filtered',
      'Linux IRQ preemption >60 µs mid-read aborts conversion; requires timing check and retry',
      'HX711 Channel A fixed gain (64/128) needs bridge attenuation; CS1237 supports Gain = 1 or 2 directly',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; add gpio=8=op,dl & gpio=9=ip,np (or dtoverlay=hx711,sck=8,dout=9)',
    softwareChanges:
      'Replaces SPI driver with 2-wire bit-banged clock/data reader (or sysfs IIO read if using HX711 overlay), checks clock-pulse elapsed time to reject Linux preemptions >50 µs, inverts bridge ratio, and maps ±FS saturation to OpenCircuit / ShortCircuit.',
    softwarePros: [
      'Eliminates SPI0 driver; HX711 has an upstream Linux kernel IIO overlay (/sys/bus/iio/devices) if sysfs is preferred',
      'With 10 s polling, any bit-banged read hit by a Linux stall can be discarded and retried cleanly',
    ],
    softwareCons: [
      'CS1237 has no mainline Linux kernel driver and requires custom bit-banged init/config frames in Rust',
      'Userspace GPIO bit-banging must track pulse duration tightly so >60 µs high time does not silently reset the ADC',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Using dtoverlay=hx711 exposes a read-only kernel IIO sysfs file (/sys/bus/iio/devices/iio:device0/in_voltage0_raw), eliminating even raw GPIO write risk. Userspace CS1237 bit-banging needs gpio group without IRQ edge-storm risk.',
      electricalSafety:
        'Sacrificial €0.28 SOP-8 ADC buffers the roof probe from Pi GPIOs; a 1 kΩ series resistor on DOUT prevents a fried ADC from pulling GPIO 9 above 3.3 V. However, lacking CRC means EMI bit-flips must be caught in software.',
      mitigation:
        'Take 3 consecutive samples per 10 s poll, reject any frame whose bit-bang duration exceeded 50 µs/pulse, use median-of-3, and apply ±20 K/s rate-of-change plausibility bounds.',
    },
  },
  bridge_lmv358_ads1115: {
    id: 'bridge_lmv358_ads1115',
    name: 'Wheatstone Bridge + LMV358 + ADS1115 16-bit I²C ADC',
    shortName: 'LMV358 + I²C ADC',
    badgeText: 'Standard Analog · Extended Fee',
    summary:
      'Classic Wheatstone bridge amplified by a basic LMV358 dual op-amp (G = 3.5) into a 16-bit I²C ADC (ADS1115). Second ADC channel monitors 3.3 V bridge excitation to stay ratiometric.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 2.85,
    interfacePins: 'I²C1 (GPIO 2/3, shared with DS2482)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '2× 1 kΩ series + 1N4148W + PESD24V',
    openShortDetection: 'Output rail saturation (<0.15 V Short, >2.65 V Open)',
    resolutionK: 0.06,
    maxRecommendedErrorK: 0.8,
    bom: [
      { designator: 'U1', part: 'ADS1115IDGSR 16-bit I²C ADC (TI)', packageType: 'MSOP-10', jlcpcbClass: 'Extended', unitCostEur: 2.45 },
      { designator: 'U2', part: 'LMV358IDR Dual Rail-to-Rail Op-Amp', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'R1..R7', part: 'Bridge & Diff-Amp 0.1% Thin-Film', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.24 },
      { designator: 'D1, C1..3', part: 'PESD24V (Ext), 1N4148W, decoupling', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.10 },
    ],
    verdict: 'Clean Linux /dev/i2c-1 integration (works natively on Pi 5), same €8.40 Extended fees as Rev D, +€2.07/bd genuine TI silicon (or ~€0.70 MS1115 clone).',
    advantages: [
      'Uses standard Linux /dev/i2c-1 driver across ALL Pi generations (Pi Zero/3/4/5) with built-in 50/60 Hz mains rejection at 8 SPS',
      'Spare ADS1115 channels can monitor 3.3 V excitation (pseudo-ratiometric ratio) or board supply health',
      'Immune to roof cable parasitic capacitance; continuous analog output is trivial to probe with a multimeter',
      'Sacrificial €0.06 LMV358 acts as a front-end buffer isolating the ADS1115 and Pi I²C bus from roof ESD transients',
    ],
    tradeoffs: [
      'Higher recurring silicon cost: genuine TI ADS1115 (~€2.45; MS1115 clones ~€0.70) + €8.40 live JLCPCB fees (3 Ext reels: ADS1115 + 0.1% R + PESD24V)',
      'LMV358 input offset voltage (±1.7 mV typ, ±7 mV max) creates 1–3.5 K raw error unless calibrated (or omit LMV358 and use ADS1115 ±0.512 V differential PGA directly!)',
      'Requires matched 0.1% bridge resistors; 1% Basic thick-film resistors degrade full-range accuracy beyond ±5 K',
      'Shared I²C1 single-point-of-failure: if ESD wedges ADS1115 SDA low, it can hang the DS2482-100 1-Wire bus on the same pins',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; add dtparam=i2c_arm=on (optional dtoverlay=ads1115; uses /dev/i2c-1)',
    softwareChanges:
      'Replaces SPI driver with I2C1 client (ads1x1x crate or IIO sysfs), samples AIN0 (bridge) and AIN2 (3.3 V rail), subtracts stored V_os calibration from Setup Wizard, and checks output saturation (<0.12 V / >2.55 V) for Short / Open.',
    softwarePros: [
      'Mature Linux IIO overlay and Rust ads1x1x crate; completely immune to Linux GPIO timing jitter',
      'Shares I2C1 (GPIO 2/3) cleanly with the optional DS2482-100 1-Wire bridge already planned on the HAT',
    ],
    softwareCons: [
      'Requires adding an op-amp V_os zero-point calibration flow to the CoSTOS Setup Wizard',
      'Brings in /dev/i2c-1 and i2c group permissions even on boards that do not fit the DS2482',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Largest Linux bus attack surface: /dev/i2c-1 (i2c group) is shared with DS2482-100 (and any HAT EEPROM/RTC). Any process with i2c group access can sniff, spoof, or clock-stretch DoS all 1-Wire and Pt1000 readings at once.',
      electricalSafety:
        'Good physical isolation via LMV358, but an I²C SDA stuck-low fault on ADS1115 silently freezes DS2482 boiler ΔT sensors unless bus-recovery (9 SCL clocks) is implemented.',
      mitigation:
        'Prefer kernel dtoverlay=ads1115 (exposes IIO sysfs without raw /dev/i2c-1 write access), add 9-clock I²C bus recovery on timeout, and cross-check AIN2 against known 3.3 V bounds.',
    },
  },
  pwm_dac_lm393: {
    id: 'pwm_dac_lm393',
    name: 'PWM-DAC + Comparator Tracking ADC (LM393 Basic)',
    shortName: 'PWM-DAC + LM393',
    badgeText: 'Minimal BOM · 2 Ext Reels',
    summary:
      'Lowest BOM cost possible: Pi GPIO/PWM feeds a 2-stage 47 kΩ / 100 nF RC filter to create a 3.3 V-referenced DAC, compared against a 3.3 kΩ 0.1% / Pt1000 divider via a basic LM393.',
    jlcpcbFeederFeeEur: 5.6,
    partCostEur: 0.25,
    interfacePins: '2× GPIO (PWM/DAC out + COMP_IN)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '1 kΩ series + 1N4148W + PESD24V',
    openShortDetection: 'Duty < 5% = Short, Duty > 90% = Open',
    resolutionK: 0.28,
    maxRecommendedErrorK: 1.5,
    bom: [
      { designator: 'U1', part: 'LM393DR2G Dual Comparator (C7955)', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
      { designator: 'R_top', part: '3.3 kΩ 0.1% Thin-Film divider leg', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.06 },
      { designator: 'R_f, C_f', part: '2× 47 kΩ + 2× 100 nF DAC filter', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R_p, D', part: '1 kΩ prot + 1N4148W + PESD24V (Ext)', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.07 },
    ],
    verdict: 'Absolute minimum BOM (€0.25, 2 Ext reels = €5.60 for 0.1% R + PESD24V), but Locked Rev D gives much better accuracy without conflicting with PUMP2 PWM.',
    advantages: [
      'Absolute lowest component cost (€0.25 BOM; 2 Extended reels = €5.60 apples-to-apples, or €0 if downgraded to 1% thick-film)',
      'Minimal 6-part PCB footprint; immune to roof cable capacitance (DC steady-state comparison)',
      'Trivial single-comparator hardware with straightforward open/short duty limits',
    ],
    tradeoffs: [
      'LM393 offset (±2–5 mV), 10–11 bit PWM step size (~0.28 K/step), and GPIO R_out (~35 Ω) yield ±1.2–2.0 K error',
      'Slow SAR/tracking sweep (~0.6–1.0 s) due to 2-stage RC filter settling time',
      'Sensitive to 3.3 V rail droop from other GPIOs switching during measurement',
      'Linux sysfs /sys/class/pwm defaults to root-only on Raspberry Pi OS, requiring custom udev rules',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; CONFLICTS with pwm-2chan (must drop PUMP2 on GPIO 19 or use SW GPIO PWM)',
    softwareChanges:
      'Runs a 12–13 step SAR binary search in Rust (set PWM duty -> wait 50 ms RC settle -> read LM393 comparator GPIO) and maps duty <5% / >90% to ShortCircuit / OpenCircuit.',
    softwarePros: [
      'No SPI or I2C kernel driver required',
      'Simple binary-search loop in Rust without edge-timestamp counting',
    ],
    softwareCons: [
      'Conflicts with HAT-1wire.md §6 pwm-2chan overlay: forces giving up PUMP2 (GPIO 19) or using jittery software PWM',
      'Slow multi-step settle loop (~0.6–1.0 s) and requires software calibration for LM393 V_os and GPIO R_out',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Sysfs /sys/class/pwm/pwmchip0 normally requires root privileges unless a custom udev rule grants group write access—which can broaden attack surface if poorly scoped across pwmchip0 (exposing PUMP1 speed control too!).',
      electricalSafety:
        'Weakest silent-failure detection: a cracked RC filter capacitor or stuck comparator output can settle at 50% duty (~+40 °C plausible reading) without triggering Open/Short bounds unless periodically tested.',
      mitigation:
        'Scope udev rules strictly to the single Pt1000 PWM channel, and force 0% and 100% duty sanity assertions on every 10 s cycle to confirm the comparator flips both rails.',
    },
  },
  ads1115_diff_mux: {
    id: 'ads1115_diff_mux',
    name: 'Direct Differential ADS1115 (No Op-Amp) + Mux / Shared Bridge',
    shortName: 'Direct Diff ADS1115 + Mux',
    badgeText: 'Pi 5 I²C · 3 Ext Reels',
    summary:
      'Upgraded Claude architecture: drops LMV358 completely and feeds a shared 4.000 kΩ / Pt1000 divider straight into ADS1115 AIN0 against a 0.660 V Wheatstone reference on AIN1 (PGA ±0.512 V = 0.008 K/LSB), while AIN2 reads V_exc/2 for 100% pseudo-ratiometric rail cancellation. Scales to 8 channels via existing Basic AO3400A switches + Basic 74HC138 (or 74HC4051 on high-Z sense side).',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 2.8,
    interfacePins: 'I²C1 (GPIO 2/3) + 3× Mux GPIO (8-ch)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: 'PESD24V + 100 Ω 1206 + 1N4148W->TL431',
    openShortDetection: 'Differential rail clamp (V_diff > +480 mV Open, < −150 mV Short)',
    resolutionK: 0.008,
    maxRecommendedErrorK: 0.45,
    bom: [
      { designator: 'U1', part: 'ADS1115IDGSR 16-bit I²C ADC (TI, C37593; MS1115 clone ~€0.70)', packageType: 'MSOP-10', jlcpcbClass: 'Extended', unitCostEur: 2.45 },
      { designator: 'U2', part: '74HC138D / 74HC4051D 8-ch Mux/Decoder (Basic, 8-ch option)', packageType: 'SOIC-16', jlcpcbClass: 'Basic', unitCostEur: 0.12 },
      { designator: 'R_ref', part: 'Single-reel 1.00 kΩ 0.1% bridge (C110774: 4k + 1k ref)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.15 },
      { designator: 'D1, C, R_p', part: 'PESD24V (C69324 Ext) + 1N4148W + 100 Ω + 100 nF', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.08 },
    ],
    verdict: 'Strongest Pi 5-ready upgrade over Rev D: €0.00 extra JLCPCB feeder fees (dropping C0G cap cancels ADS1115 Ext fee), 0.008 K resolution, 50/60 Hz rejection, +€2.02/bd TI silicon (+€0.35/bd with MS1115 clone).',
    advantages: [
      'Drops the LMV358 completely — eliminates ±1.7–7 mV op-amp offset error and 4 matched gain resistors while achieving 0.008–0.012 K/LSB at PGA ±0.512 V',
      'Zero extra JLCPCB Extended feeder fees vs Locked Rev D (€8.40 total: drops C27071 C0G cap, adds ADS1115)',
      'Works natively over standard Linux I²C (/dev/i2c-1) on ALL Raspberry Pi models including Pi 5 — zero pigpio/DMA timing constraints',
      'Built-in 50/60 Hz mains rejection at 8 SPS; sharing one 4.000 kΩ top divider via AO3400A + Basic 74HC138 preserves ΔT matching across 8 channels',
    ],
    tradeoffs: [
      'Costs +€2.02/board over Locked Rev D with genuine TI ADS1115 (€2.80 vs €0.78 parts; ~+€0.35/bd if using MS1115 clone)',
      'ADS1115 has NO external VREF pin — MUST read AIN2 (V_exc/2) per scan or a 3% 3.3 V drift causes +14.9 K error',
      'Never wire a 74HC4051 in the excitation current path (Ron = 100 Ω causes +26.5 K error) — keep mux strictly on high-Z sense or use AO3400A low-side switches',
      '2-wire sensing only (no hardware 3-wire cable resistance cancellation); shares I²C1 bus if DS2482 is fitted',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; add dtparam=i2c_arm=on (standard /dev/i2c-1; Pi 5 compatible)',
    softwareChanges:
      'Reads ADS1115 AIN0−AIN1 at PGA ±0.512 V (8 SPS for 50/60 Hz notch) and AIN2 (V_exc/2) over /dev/i2c-1, computes exact pseudo-ratiometric ratio R_pt, and evaluates Callendar–Van Dusen (~40 LOC Rust/Python).',
    softwarePros: [
      '100% immune to Linux scheduling jitter and works identically on Pi Zero / 3 / 4 / 5 with mainline Linux IIO or smbus2/ads1x1x',
      'Frees 5–7 GPIOs on the 8-channel All-Pt1000 edition when paired with a Basic 74HC138 decoder',
    ],
    softwareCons: [
      'Requires 2 ADC conversions per cycle (V_diff + V_exc/2) to stay ratiometric (~250 ms/ch at 8 SPS)',
      'Requires 9-clock I²C bus recovery guard if an ESD event ever wedges SDA low',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Uses /dev/i2c-1 (or read-only IIO sysfs via dtoverlay=ads1115); avoids root pigpiod daemon completely.',
      electricalSafety:
        'PESD24V + 100 Ω 1206 + 1N4148W -> +3V3/TL431 clamps +24 V miswire safely before ADS1115 AIN0; differential saturation flags Open/Short cleanly.',
      mitigation:
        'Always verify AIN2 (V_exc/2) stays within 1.55–1.75 V on every scan to catch dead excitation rail or frozen I²C reads.',
    },
  },
  tm7705_ratiometric: {
    id: 'tm7705_ratiometric',
    name: 'TM7705 / AD7705 (16-Bit True-Ratiometric SPI ADC)',
    shortName: 'TM7705 Ratiometric SPI',
    badgeText: 'True Ratiometric · SOP-16',
    summary:
      'Hidden low-cost industrial gem: pin-compatible clone of Analog Devices AD7705 in easy SOP-16 with TRUE external differential REF+/REF− inputs wired directly across the 4.000 kΩ reference resistor. 100% hardware ratiometric, built-in PGA (1–128×), and native 50/60 Hz digital notch over standard SPI.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 1.1,
    interfacePins: 'SPI0 (MOSI, MISO, SCLK, CE0)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: 'PESD24V + 1 kΩ series + 1N4148W clamp',
    openShortDetection: '0xFFFF / 0x0000 rail saturation + DRDY timeout',
    resolutionK: 0.012,
    maxRecommendedErrorK: 0.35,
    bom: [
      { designator: 'U1', part: 'TM7705 16-bit Dual-Ch Ratiometric ADC (C197254)', packageType: 'SOP-16', jlcpcbClass: 'Extended', unitCostEur: 0.82 },
      { designator: 'Y1', part: '2.4576 MHz / 4.9152 MHz Crystal + 2× 22 pF (or Pi clock)', packageType: 'SMD-3225', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
      { designator: 'R_ref', part: 'Single-reel 1.00 kΩ 0.1% Ref (C110774: 4.000 kΩ)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.12 },
      { designator: 'D1, C, R_p', part: 'PESD24V (Ext) + 1N4148W + 100 nF decoupling', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.08 },
    ],
    verdict: 'Cheapest true hardware-ratiometric ADC (€1.10 parts + €8.40 Ext fees): beats ADS1115 on ratiometric purity and cost (+€0.32/bd over Rev D), works on Pi 5 over SPI, easy SOP-16 package.',
    advantages: [
      'True external differential REF+/REF− pins wired across R_ref deliver 100% hardware ratiometric readings in a single conversion (zero supply-drift sensitivity)',
      'Costs only ~€1.10 in parts (+€0.32/bd over Rev D) with identical €8.40 Extended fees — less than 1/3 the silicon cost of MAX31865 or TI ADS1115',
      'Easy hand-solderable 1.27 mm SOP-16 package with built-in PGA (1–128×), self-calibration, and 50/60 Hz digital notch filter',
      'Standard SPI works cleanly on Raspberry Pi Zero / 3 / 4 / 5 with zero Linux GPIO timing dependencies',
    ],
    tradeoffs: [
      'TM7705 is a Chinese second-source clone of ADI AD7705 (genuine ADI AD7705 costs ~€7); requires verifying LCSC stock before batch orders',
      'Needs a 2.4576 MHz / 4.9152 MHz clock (crystal or Pi GPCLK) and a slightly quirky SPI reset/self-cal init sequence on boot',
      'Consumes SPI0 pins (4 pins) and supports only 2 differential channels natively (needs AO3400A/74HC138 mux for 8-ch All-Pt1000)',
      '2-wire sensing unless paired with external current-source excitation; no built-in ±45 V protection like MAX31865',
    ],
    configTxtDiff: 'dtparam=spi=on  (/dev/spidev0.0; optional dtoverlay=ad770x or userspace SPI)',
    softwareChanges:
      'Sends 32-clock SPI sync + self-calibration command on startup, then polls 16-bit ratiometric CH1 conversion register at 50 Hz notch rate over /dev/spidev0.0 (~70 LOC Rust).',
    softwarePros: [
      'Zero Linux GPIO timing jitter; works identically across Pi Zero / 3 / 4 / 5',
      'Single 16-bit ratio register directly proportional to R_pt / R_ref — no second V_exc channel needed',
    ],
    softwareCons: [
      'Quirky SPI state machine: any stray SCLK pulse desyncs registers until a 32-bit 0xFF software reset is sent',
      'Needs SPI0 enabled (/dev/spidev0.0) and DRDY polling or timeout wait',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Point-to-point SPI0 (/dev/spidev0.0) — cannot hang I²C devices and avoids root GPIO DMA daemons.',
      electricalSafety:
        'Requires external PESD24V + 1 kΩ series + 1N4148W clamp because silicon pins are rated to VDD + 0.3 V.',
      mitigation:
        'Send 32-bit 0xFF SPI resync automatically if DRDY times out or readout hits 0x0000/0xFFFF, and assert BIST on CH2.',
    },
  },
  stm32_basic_coproc: {
    id: 'stm32_basic_coproc',
    name: 'STM32F103C8T6 Basic MCU Co-Processor (Oversampled 8-Ch ADC)',
    shortName: 'STM32F103 Basic Co-Proc',
    badgeText: 'JLCPCB Basic MCU · Only 2 Ext!',
    summary:
      'JLCPCB Basic-part wildcard: STM32F103C8T6 (C8734, €0 Extended fee!) uses its ratiometric 12-bit ADC (VREF = VDDA) with 256× hardware-triggered oversampling (~15.5 effective bits = 0.03 K) across up to 8–10 Pt1000 dividers directly — ZERO external mux, ZERO ADC IC, ZERO C0G cap, and ONLY 2 Extended reels (€5.60)!',
    jlcpcbFeederFeeEur: 5.6,
    partCostEur: 1.65,
    interfacePins: 'I²C1 (GPIO 2/3) + Optional 2-pin SWD Auto-Flash',
    handSolderability: 'Fine-pitch QFP / QFN',
    ratiometric: true,
    inputProtection: 'PESD24V + 1 kΩ series + 1N4148W->VDDA clamp',
    openShortDetection: 'MCU firmware open/short ADC window + CRC-8 I²C frame',
    resolutionK: 0.03,
    maxRecommendedErrorK: 0.55,
    bom: [
      { designator: 'U1', part: 'STM32F103C8T6 72 MHz ARM MCU (C8734 — JLCPCB Basic!)', packageType: 'LQFP-48', jlcpcbClass: 'Basic', unitCostEur: 1.15 },
      { designator: 'R_ref', part: 'Single-reel 1.00 kΩ 0.1% Divider(s) (C110774)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.30 },
      { designator: 'D1', part: 'PESD24VL1BA 24V Roof ESD TVS (C69324)', packageType: 'SOD-323', jlcpcbClass: 'Extended', unitCostEur: 0.04 },
      { designator: 'C, R, L', part: '100 nF bypasses, 10k NRST/BOOT0, 1N4148W clamps (Basic)', packageType: '0805/SOD', jlcpcbClass: 'Basic', unitCostEur: 0.16 },
    ],
    verdict: 'Lowest Extended reel fee of any accurate topology (€5.60 = only 2 Ext reels!) and scales cleanly to 8 Pt1000s with zero external mux + Pi 5 I²C — trade-off is maintaining & flashing secondary HAT firmware.',
    advantages: [
      'Lowest JLCPCB Extended feeder fee (€5.60 — beats even Rev D by −€2.80!) because STM32F103C8T6 (C8734) is a JLCPCB Basic Part',
      'Supports 8–10 Pt1000 channels directly on-chip with ZERO external mux IC and ZERO external ADC IC (256× oversampling + 50/60 Hz sync yields ~0.03 K)',
      '100% ratiometric (ADC VREF+ = VDDA = divider supply) and reports CRC-protected °C over I²C/UART to ANY Raspberry Pi including Pi 5',
      'Can optionally time-capture the Rev D LM393 ramp at 72 MHz (14 ns = 0.001 K) without any Pi Linux jitter',
    ],
    tradeoffs: [
      'Introduces secondary MCU firmware that must be built, versioned, and flashed at manufacturing (or auto-flashed by Pi via SWD/UART on first boot)',
      'Fine-pitch 0.5 mm LQFP-48 package is harder to hand-rework than SOIC-8; needs clean VDDA RC/ferrite filtering for low-noise ADC oversampling',
      '8 independent dividers need 8 precision top resistors (or keep AO3400A low-side mux + 1 shared 4.000 kΩ top resistor for optimal ΔT matching)',
      'Must NOT replace the analog hardware Watchdog (keep U4 firmware-free for independent safety!)',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; add dtparam=i2c_arm=on (optional SWD/UART header for Pi auto-flash)',
    softwareChanges:
      'Pi reads CRC-8 checked temperature & fault registers from HAT I²C slave (0x42) in 20 LOC; STM32 firmware runs 50 Hz-synced 256× DMA ADC oversampling + CVD math on-chip.',
    softwarePros: [
      'Trivial Pi-side driver (plain I²C register read with CRC-8) — works identically on Pi Zero / 3 / 4 / 5',
      'MCU can average over exact 20 ms EU mains cycles continuously in the background',
    ],
    softwareCons: [
      'Adds a second toolchain (Rust embedded / C STM32 firmware) plus factory or first-boot SWD flashing logistics',
      'MCU lockup requires its own IWDG hardware watchdog + Pi-controlled NRST reset line',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Clean I²C register interface; lock SWD/flash write-protect in production or gate NRST/BOOT0 safely.',
      electricalSafety:
        'Internal MCU ADC pins tolerate only VDD + 0.3 V; requires external PESD24V + 1 kΩ + 1N4148W clamps. Keep solar safety Watchdog strictly separate in analog hardware (U4).',
      mitigation:
        'Enable STM32 Independent Watchdog (IWDG), include rolling sequence counter + CRC-8 in every I²C frame so Pi detects any frozen co-processor.',
    },
  },
  ads124s08_idac: {
    id: 'ads124s08_idac',
    name: 'TI ADS124S08 (24-Bit, 12-Ch Mux + Dual IDACs · 3-Wire RTD)',
    shortName: 'TI ADS124S08 (24-bit 3W)',
    badgeText: 'Industrial Pro · 3-Wire Ready',
    summary:
      'The pro industrial sweet spot (1/6th the price of LTC2983): single-chip 24-bit ΔΣ ADC with 12-channel internal mux, PGA (1–128×), >90 dB 50/60 Hz digital filter, and dual matched programmable IDACs for TRUE 3-wire roof-cable resistance cancellation (up to 5× 3-wire or 8× 2-wire Pt1000s + optional K-type flue-gas thermocouple).',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 7.5,
    interfacePins: 'SPI0 (MOSI, MISO, SCLK, CE0)',
    handSolderability: 'Fine-pitch QFP / QFN',
    ratiometric: true,
    inputProtection: 'PESD24V + 1 kΩ series + 1N4148W clamp',
    openShortDetection: 'Built-in burn-out current sources + PGA rail & CRC-8 SPI',
    resolutionK: 0.001,
    maxRecommendedErrorK: 0.15,
    bom: [
      { designator: 'U1', part: 'ADS124S08IPBS 24-bit 12-Ch IDAC ADC (TI, C181414)', packageType: 'TQFP-32', jlcpcbClass: 'Extended', unitCostEur: 6.9 },
      { designator: 'R_ref', part: '2× 1.00 kΩ 0.1% 25ppm R_ref (C110774 = 2.000 kΩ)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.12 },
      { designator: 'D1, R_f, C_f', part: 'PESD24V (Ext) + 1 kΩ + 10 nF/100 nF diff EMI filters', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.48 },
    ],
    verdict: 'Best "CoSTOS Pro" architecture for the 8-channel All-Pt1000 Edition: delivers 95% of LTC2983 lab performance (true 3-wire cable cancellation, <0.001 K res, >90 dB hum rejection, deletes ~30 SMD parts) at 1/6th the cost (+€6.72/bd over Rev D, same €8.40 Ext fees).',
    advantages: [
      'True hardware 3-wire Pt1000 cable-resistance cancellation via dual matched IDACs (eliminates attic copper-wire temperature drift on 30–50 m roof runs)',
      'Deletes ~30 discrete SMD parts on the All-Pt1000 edition (12-ch internal mux handles 8× 2-wire or 5× 3-wire Pt1000s + optional K-type biomass flue sensor)',
      '24-bit ΔΣ with <0.001 K resolution, true hardware ratiometric REFP0/REFN0, >90 dB simultaneous 50/60 Hz rejection, and SPI CRC-8 error checking',
      'Mainline Linux kernel IIO driver (ti-ads124s08) works out-of-the-box on Pi Zero / 3 / 4 / 5 with zero extra JLCPCB feeder fees (€8.40 total)',
    ],
    tradeoffs: [
      'Adds +€6.72/board in silicon over Locked Rev D (€7.50 vs €0.78 parts) — overkill for a single-sensor 1-Wire Edition (use 4-ch ADS1220 ~€3.80 for 1–2 ch)',
      'Fine-pitch 0.8 mm TQFP-32 / 0.5 mm VQFN-32 package requires hot-air rework if ever damaged',
      'Analog pins rated to AVDD + 0.3 V (3.6 V abs max) — must keep external 1 kΩ series limiters + PESD24V + clamp diodes for roof miswiring',
      'Single-source TI part (no pin-compatible generic drop-in)',
    ],
    configTxtDiff: 'dtparam=spi=on  (dtoverlay or mainline Linux IIO ti-ads124s08 on /dev/spidev0.0)',
    softwareChanges:
      'Configures ADS124S08 mux, PGA = 2, 20 SPS simultaneous 50/60 Hz filter, and dual 500 µA IDACs over SPI with hardware CRC-8; reads 24-bit ratiometric code directly (~110 LOC Rust).',
    softwarePros: [
      'Hardware CRC-8 on every SPI frame + built-in sensor burn-out current sources catch open/short wires deterministically',
      'Frees all 11 All-Pt1000 mux GPIOs (uses only 4 SPI pins) and works natively on Pi 5',
    ],
    softwareCons: [
      'Richer register map (18 registers for IDAC routing, PGA, reference mux, and filter config) than ADS1115',
      'Needs careful 3-wire terminal pinout (3 screw poles per probe) to realize full cable cancellation',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Dedicated SPI0 device with hardware CRC-8 integrity verification on every sample; no root DMA daemon.',
      electricalSafety:
        'Protected by PESD24V + 1 kΩ series + 1N4148W clamps; internal burn-out diagnostics detect broken or shorted probes immediately.',
      mitigation:
        'Enable SPI CRC-8 and STATUS byte on every read; verify IDAC compliance voltage stays below AVDD − 0.6 V to detect high-resistance corroded roof terminals.',
    },
  },
  mcp3424_i2c: {
    id: 'mcp3424_i2c',
    name: 'Microchip MCP3424 (18-Bit 4-Ch Differential I²C ADC)',
    shortName: 'MCP3424 18-bit I²C',
    badgeText: '18-Bit SOIC-14 · Pi 5 I²C',
    summary:
      'Popular European DIY HVAC/solar ADC: 4 true differential channels in an easy hand-solderable SOIC-14 package with 18-bit ΔΣ resolution (1.95 µV/LSB at Gain = 8, 3.75 SPS) and rock-solid mainline Linux mcp3422 IIO driver. Uses CH4 on V_exc/2 to stay pseudo-ratiometric.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 3.2,
    interfacePins: 'I²C1 (GPIO 2/3, 3× diff ch + V_exc)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: 'PESD24V + 1 kΩ series + 1N4148W clamp',
    openShortDetection: '18-bit PGA rail saturation (±2.048 V / Gain)',
    resolutionK: 0.004,
    maxRecommendedErrorK: 0.4,
    bom: [
      { designator: 'U1', part: 'MCP3424-E/SL 18-bit 4-Ch I²C ADC (C31727)', packageType: 'SOIC-14', jlcpcbClass: 'Extended', unitCostEur: 2.85 },
      { designator: 'R_ref', part: 'Single-reel 1.00 kΩ 0.1% Wheatstone bridge (C110774)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.24 },
      { designator: 'D1, R_p, C', part: 'PESD24V (Ext) + 1N4148W + 100 nF decoupling', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.11 },
    ],
    verdict: 'Great easy-solder SOIC-14 alternative to ADS1115 with 4× finer raw resolution (0.004 K) and 3 differential Pt1000 channels with no external mux, at +€0.40/bd over TI ADS1115.',
    advantages: [
      '4× finer raw resolution than ADS1115 (18-bit = 0.004 K/LSB at 3.75 SPS) in an easy hand-solderable 1.27 mm SOIC-14 package',
      '4 true differential inputs handle 3× Pt1000s + 1× V_exc/2 ratio check with ZERO external mux IC (or 2× chips = 6–7 Pt1000s on I²C)',
      'Upstream Linux kernel IIO driver (mcp3422) works identically on Pi Zero / 3 / 4 / 5 with zero extra JLCPCB feeder fees (€8.40 total)',
      'Configurable I²C address pins allow stacking up to 8 chips on the same 2-wire I²C bus',
    ],
    tradeoffs: [
      'Fixed internal 2.048 V reference (no external VREF pin) — requires dedicating 1 channel to V_exc/2 for pseudo-ratiometric rail cancellation',
      'Slow conversion rate at full 18-bit (3.75 SPS = 267 ms per channel; ~2.1 s for 8 channels — fine for solar thermal, slow for fast loops)',
      'Slightly pricier than TI ADS1115 (€3.20 vs €2.80 parts) and +€2.42/board over Locked Rev D',
      '2-wire sensing only; lacks hardware 3-wire cable cancellation',
    ],
    configTxtDiff: 'Remove dtparam=spi=on; add dtparam=i2c_arm=on (optional dtoverlay=mcp342x,addr=0x68)',
    softwareChanges:
      'Reads 18-bit signed differential channels + CH4 V_exc/2 via Linux IIO sysfs (/sys/bus/iio/devices) or /dev/i2c-1 (~35 LOC Rust/Python).',
    softwarePros: [
      'Zero-dependency Linux kernel IIO sysfs readout works on Pi 5 out of the box',
      'Clean 3-byte I²C protocol with ready-bit polling and zero timing sensitivity',
    ],
    softwareCons: [
      '267 ms settle per channel at 18-bit resolution requires sequential channel stepping',
      'Shares I²C1 bus if DS2482 1-Wire bridge is installed',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Mainline kernel IIO driver exposes read-only sysfs voltage values without granting raw i2c write access.',
      electricalSafety:
        'External PESD24V + 1 kΩ + 1N4148W clamps protect differential inputs against +24 V roof miswiring.',
      mitigation:
        'Cross-check CH4 (V_exc/2) bounds on every scan and verify ready-flag clears to catch stale I²C bus states.',
    },
  },
  ltc2983_turnkey: {
    id: 'ltc2983_turnkey',
    name: 'ADI LTC2983 (20-Ch Turnkey Multi-Sensor Lab Benchmark)',
    shortName: 'ADI LTC2983 (€43.50 Lab)',
    badgeText: 'Lab Ceiling · Turnkey IC',
    summary:
      'The no-compromise lab-instrument ceiling: Analog Devices 20-channel 24-bit ΔΣ multi-sensor IC with built-in ROM linearization for 2/3/4-wire Pt1000, Pt100, thermocouples, and thermistors. Included here as the upper-bound benchmark proving why CoSTOS skips €43+ ICs on a Linux Raspberry Pi.',
    jlcpcbFeederFeeEur: 8.4,
    partCostEur: 43.5,
    interfacePins: 'SPI0 (MOSI, MISO, SCLK, CE0)',
    handSolderability: 'Fine-pitch QFP / QFN',
    ratiometric: true,
    inputProtection: 'PESD24V + 1 kΩ series + 1N4148W clamp',
    openShortDetection: 'Native per-channel fault byte (Open, Short, Hard/Soft Overrange)',
    resolutionK: 0.001,
    maxRecommendedErrorK: 0.1,
    bom: [
      { designator: 'U1', part: 'LTC2983ILX#PBF 20-Ch Multi-Sensor IC (ADI, C132502)', packageType: 'LQFP-48', jlcpcbClass: 'Extended', unitCostEur: 42.8 },
      { designator: 'R_sense', part: '2× 1.00 kΩ 0.1% 25ppm Sense Ref (C110774 = 2.000 kΩ)', packageType: '0805', jlcpcbClass: 'Extended', unitCostEur: 0.12 },
      { designator: 'D1, R_p, C', part: 'PESD24V (Ext) + 1 kΩ + 100 nF/10 µF decoupling', packageType: '0805/SOD', jlcpcbClass: 'Extended', unitCostEur: 0.58 },
    ],
    verdict: 'Hard NO for CoSTOS: costs €43.50/board in silicon alone (more than the entire rest of the HAT + Raspberry Pi combined!) to offload 3 lines of Callendar–Van Dusen math that a Pi executes in 2 µs. TI ADS124S08 achieves 95% of its accuracy for 1/6th the price.',
    advantages: [
      'Absolute gold-standard ±0.05–0.10 K accuracy with 0.001 K resolution and built-in ROM Callendar–Van Dusen + thermocouple lookup tables',
      'Supports up to 9× 2-wire, 6× 3-wire, or 4× 4-wire Pt1000s (or mixed K-type flue-gas thermocouples + thermistors) on one chip',
      'True hardware ratiometric against 1 single R_sense resistor, native 50/60 Hz simultaneous rejection, and rich per-channel fault flags',
      'Mainline Linux kernel IIO driver (ltc2983) outputs linearized °C directly over SPI on all Raspberry Pi models',
    ],
    tradeoffs: [
      'Absurd BOM cost (~€42.80 for the IC alone — 55× pricier than Locked Rev D and 6× pricier than TI ADS124S08!)',
      'Exceeds physical sensor accuracy by 10×: a Class A Pt1000 in a brass thermowell already carries ±0.35–1.0 K error regardless of ADC',
      'Fine-pitch 0.5 mm LQFP-48 package; analog inputs still max out at VDD + 0.3 V (3.6 V) and require external roof-surge protection',
      'Single-source Analog Devices IC with periodic distribution lead-time spikes',
    ],
    configTxtDiff: 'dtparam=spi=on  (mainline Linux IIO driver ltc2983 on /dev/spidev0.0)',
    softwareChanges:
      'Writes 32-bit channel assignment words to LTC2983 RAM on boot and reads directly linearized fixed-point °C + fault status byte over SPI (~50 LOC or Linux IIO sysfs).',
    softwarePros: [
      'Zero linearization math on host (chip outputs °C directly with hardware fault byte)',
      'Mature mainline Linux kernel driver supports arbitrary mixes of RTDs and thermocouples via device tree',
    ],
    softwareCons: [
      'Unnecessary complexity and cost on a quad-core Linux Pi that solves Callendar–Van Dusen in 2 µs for free',
      '20-pin analog routing on a 0.5 mm LQFP-48 increases PCB congestion near roof screw terminals',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Clean SPI0 kernel IIO driver; zero GPIO DMA daemon needed.',
      electricalSafety:
        'Analog pins are NOT ±45 V tolerant (abs max 3.6 V) — requires external PESD24V + 1 kΩ series + low-leakage clamps to survive +24 V roof miswiring.',
      mitigation:
        'Check bits [31:24] of every 32-bit conversion result (VALID=1, FAULT=0) before feeding temperature into solar pump control.',
    },
  },
};

export const TOPOLOGY_ORDER: TopologyId[] = [
  'max31865',
  'switched_rc',
  'ads1115_diff_mux',
  'tm7705_ratiometric',
  'stm32_basic_coproc',
  'ads124s08_idac',
  'mcp3424_i2c',
  'bridge_cs1237',
  'bridge_lmv358_ads1115',
  'pwm_dac_lm393',
  'ltc2983_turnkey',
];

export function perBoardCostEur(spec: TopologySpec, boardCount: number): number {
  return spec.partCostEur + spec.jlcpcbFeederFeeEur / Math.max(1, boardCount);
}

export interface ResourceFootprint {
  cpuDelta: string;
  ramDelta: string;
  detail: string;
}

export function estimateResourceFootprint(
  topologyId: TopologyId,
  pollIntervalS: number
): ResourceFootprint {
  switch (topologyId) {
    case 'max31865':
      return {
        cpuDelta: '0% delta (~0.002% of 1 core baseline)',
        ramDelta: '0 KB delta (~4 KB stack / spidev fd baseline)',
        detail: `Single 3-byte /dev/spidev0.0 ioctl (~20 µs) once every ${pollIntervalS} s; CoSTOS Rust daemon RSS remains ~5–8 MB.`,
      };
    case 'switched_rc': {
      const windowS =
        pollIntervalS >= 10
          ? 0.5
          : pollIntervalS >= 5
          ? 0.4
          : pollIntervalS >= 3
          ? 0.3
          : 0.2;
      // Rev D 72.2 Hz local RC ramp: ~144.4 edges/s during burst (500 ms = 25 EU 50 Hz cycles)
      const edgesPerPoll = Math.round(144.4 * windowS * 3);
      const avgIrqPerSec = Math.round(edgesPerPoll / pollIntervalS);
      const cpuPi4Pct = (edgesPerPoll * 5e-6 / pollIntervalS) * 100;
      const cpuPi3Pct = (edgesPerPoll * 10e-6 / pollIntervalS) * 100;
      return {
        cpuDelta: `+${cpuPi4Pct.toFixed(3)}% (Pi 4/5) to +${cpuPi3Pct.toFixed(3)}% (Pi 3) of 1 core (~${avgIrqPerSec} IRQs/s avg)`,
        ramDelta: '+24 to +40 KB (kernel gpio_v2_line_event kfifo + Tokio task)',
        detail: `Local 72 Hz RC ramp (~${edgesPerPoll} edges across PT1/R_lo/R_hi every ${pollIntervalS} s; <0.02% of 4-core Pi CPU; 500 ms window rejects 50/60 Hz hum).`,
      };
    }
    case 'bridge_cs1237': {
      const retryPct = (0.15 / Math.sqrt(pollIntervalS)).toFixed(2);
      return {
        cpuDelta: `+0.01% to +${retryPct}% of 1 core (27-bit GPIO clock bursts / ${pollIntervalS} s)`,
        ramDelta: '+4 to +16 KB (2 gpiochip handles or kernel hx711 IIO buffer)',
        detail: `Short ~150 µs bit-banged readout per ${pollIntervalS} s poll (with retry if Linux preempts mid-frame); negligible RSS footprint.`,
      };
    }
    case 'bridge_lmv358_ads1115':
      return {
        cpuDelta: `+0.004% of 1 core (~0.4 ms kernel I²C IRQ every ${pollIntervalS} s)`,
        ramDelta: '+8 to +32 KB (i2c-dev fd + ads1x1x struct; +0 KB if DS2482 active)',
        detail: `Two non-blocking I²C reads per ${pollIntervalS} s poll; shares /dev/i2c-1 kernel buffer when DS2482-100 1-Wire bridge is present.`,
      };
    case 'pwm_dac_lm393':
      return {
        cpuDelta: '+0.01% (HW PWM)  |  +1.5% to +4.0% if SW GPIO PWM (to keep PUMP2)',
        ramDelta: '+4 to +16 KB (sysfs PWM fd + comparator GPIO handle)',
        detail: `12 SAR steps yield CPU during 50 ms RC settles if using HW PWM, but SW GPIO PWM to keep PUMP2 burns ~1.5–4% of 1 core.`,
      };
    case 'ads1115_diff_mux':
      return {
        cpuDelta: `+0.004% of 1 core (~0.4 ms kernel I²C IRQ every ${pollIntervalS} s)`,
        ramDelta: '+8 to +24 KB (i2c-dev fd or ads1015 kernel IIO)',
        detail: `Two I²C reads (AIN0−AIN1 diff + AIN2 V_exc/2) per ${pollIntervalS} s poll at 8 SPS (50/60 Hz notch); 100% Pi 5 compatible.`,
      };
    case 'tm7705_ratiometric':
      return {
        cpuDelta: `+0.003% of 1 core (16-bit SPI0 read every ${pollIntervalS} s)`,
        ramDelta: '+4 to +8 KB (spidev0.0 fd)',
        detail: `Single hardware-ratiometric 16-bit SPI conversion every ${pollIntervalS} s at 50 Hz digital notch; zero Linux GPIO timing load.`,
      };
    case 'stm32_basic_coproc':
      return {
        cpuDelta: `+0.002% of 1 core (CRC-8 I²C register burst every ${pollIntervalS} s)`,
        ramDelta: '+4 to +12 KB (i2c-dev fd)',
        detail: `STM32F103 handles continuous 256× oversampling in background DMA; Pi reads pre-filtered °C + CRC-8 over I²C in <0.3 ms.`,
      };
    case 'ads124s08_idac':
      return {
        cpuDelta: `+0.003% of 1 core (24-bit SPI0 + CRC-8 read every ${pollIntervalS} s)`,
        ramDelta: '+8 to +16 KB (spidev0.0 or ti-ads124s08 kernel IIO)',
        detail: `Hardware 20 SPS simultaneous 50/60 Hz filter + dual IDACs run on-chip; Pi reads 3-byte CRC-checked ratio over SPI0.`,
      };
    case 'mcp3424_i2c':
      return {
        cpuDelta: `+0.003% of 1 core (18-bit I²C read every ${pollIntervalS} s)`,
        ramDelta: '+8 to +16 KB (mcp3422 kernel IIO sysfs)',
        detail: `3.75 SPS 18-bit conversions run autonomously on-chip; Pi polls ready bit and reads 3-byte differential + V_exc/2 frames.`,
      };
    case 'ltc2983_turnkey':
      return {
        cpuDelta: `+0.002% of 1 core (32-bit linearized °C SPI read every ${pollIntervalS} s)`,
        ramDelta: '+8 to +16 KB (ltc2983 kernel IIO)',
        detail: `On-chip ROM computes linearized °C + fault byte; Pi performs a single 4-byte SPI read every ${pollIntervalS} s.`,
      };
  }
}


/**
 * Computes physical readings, error in Kelvin, worst-case tolerance envelope,
 * and safety behavior for a given topology and environment parameter set.
 */
export function evaluateTopology(
  topologyId: TopologyId,
  params: SimulationParams
): SimulationResult {
  const trueTempC = params.collectorTempC;
  const trueR = pt1000Resistance(trueTempC);
  const tolFrac = params.resistorTolerancePct / 100;
  const ambDelta = params.ambientTempC - 25;
  const v33 = 3.3 * (params.supplyVoltageV < 4.7 ? 0.992 : 1.0); // Pi 3.3V LDO holds tight unless severe brownout
  const cableUncomp = params.calibrateCableAndZero ? 0 : params.cableResistanceOhm;

  // Handle stale bus first
  if (params.activeFault === 'stale') {
    return {
      topologyId,
      trueTempC,
      trueResistanceOhm: trueR,
      measuredTempC: null,
      errorK: null,
      worstCaseBoundK: 0,
      excitationCurrentMa: 0,
      selfHeatingMw: 0,
      selfHeatingK: 0,
      digitalReadoutLabel: topologyId === 'switched_rc' ? 'Edge Count' : 'Bus Readout',
      digitalReadoutValue: 'TIMEOUT (0 frames)',
      detectedFault: 'StaleBus',
      safetyStatus: 'FaultCaught',
      safetyDetail: 'Control loop stale watchdog catches frozen sensor reading (>3 s timeout) and forces solar pump OFF.',
      nodes: [
        { label: 'PT1 Sensor', value: `${trueR.toFixed(1)} Ω`, note: 'Physical probe intact' },
        { label: 'Interface', value: 'HUNG / NO ACK', note: 'Safe state triggered' },
      ],
    };
  }

  // Handle +24 V field wiring fault
  if (params.activeFault === 'surge_24v') {
    const isMax = topologyId === 'max31865';
    const isRevD = topologyId === 'switched_rc';
    const clampV = isMax ? 24.0 : isRevD ? 4.30 : 3.95;
    const clampMa = isMax ? 0.2 : isRevD ? ((24 - 4.3) / 10000) * 1000 : ((24 - clampV) / 1000) * 1000;
    return {
      topologyId,
      trueTempC,
      trueResistanceOhm: trueR,
      measuredTempC: null,
      errorK: null,
      worstCaseBoundK: 0,
      excitationCurrentMa: Number(clampMa.toFixed(2)),
      selfHeatingMw: 0,
      selfHeatingK: 0,
      digitalReadoutLabel: 'Clamp Status',
      digitalReadoutValue: isMax
        ? 'OV/UV Fault Bit (0x40)'
        : isRevD
        ? 'U1A+ Clamped @ 4.30 V (1.97 mA)'
        : 'Clamped @ 3.95 V (PESD24V + 1N4148W)',
      detectedFault: 'OverVoltageClamp',
      safetyStatus: 'FaultCaught',
      safetyDetail: isMax
        ? 'MAX31865 internal ±45 V protection survives 24 V indefinitely and flags Overvoltage Fault over SPI.'
        : isRevD
        ? 'Rev D (100% Basic): C106+C105 (100 nF 50 V) handle ESD/RFI while staying off at 24 V DC; R101A–D (4× 1.00 kΩ) run 4× cooler at 25.8 mW/ea; R4 (10 kΩ) + symmetric Basic 1N4148W (D8 -> +3V3/TL431 D9 Pi-OFF + D8B -> AGND) hold U1A+ at 4.30 V (38.8 mW); GPIO 22 stays steady HIGH -> Fault.'
        : `PESD24V + 1 kΩ series + 1N4148W clamp limit +24 V miswire to ~3.95 V (${clampMa.toFixed(1)} mA); ADC saturates full-scale -> OutOfRange fault.`,
      nodes: [
        { label: 'Terminal PT1', value: '24.0 V FAULT', note: 'Miswired DC rail' },
        {
          label: isRevD ? 'U1A+ Sense Node' : 'Protected Node',
          value: `${clampV.toFixed(2)} V`,
          note: isRevD ? '38.8 mW in R4 · 25.8 mW/ea R101' : 'Pi bus isolated',
        },
      ],
    };
  }

  // Open / Short physical resistances
  const effectiveR =
    params.activeFault === 'open'
      ? 1e7
      : params.activeFault === 'short'
      ? 0.05 + params.cableResistanceOhm
      : trueR + params.cableResistanceOhm;

  const nominalCableForComp = params.calibrateCableAndZero ? params.cableResistanceOhm : 0;

  switch (topologyId) {
    case 'max31865': {
      const rRef = 4300;
      const iExcMa = (2.0 / (rRef + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iExcMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '15-bit RTD Code',
          digitalReadoutValue: '0x7FFF (Fault 0x80)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'MAX31865 detects RTDIN+ > 0.85×VBIAS open-circuit condition immediately.',
          nodes: [
            { label: 'V_BIAS', value: '2.00 V', note: 'Excitation' },
            { label: 'RTDIN+ / -', value: '2.00 V / 0.00 V', note: 'Open loop' },
            { label: 'SPI Fault Reg', value: '0x80 (HIGH)', note: 'OpenCircuit' },
          ],
        };
      }
      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iExcMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '15-bit RTD Code',
          digitalReadoutValue: '0x0007 (Fault 0x20)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'MAX31865 flags RTDIN− < 0.85×VBIAS / R_meas < 20 Ω as ShortCircuit.',
          nodes: [
            { label: 'V_BIAS', value: '2.00 V', note: 'Excitation' },
            { label: 'RTDIN+ − -', value: '0.4 mV', note: 'Shorted' },
            { label: 'SPI Fault Reg', value: '0x20 (LOW)', note: 'ShortCircuit' },
          ],
        };
      }

      // Error sources: R_ref tolerance (0.1% typically, or user-chosen), R_ref 25ppm/K drift, ADC INL (~1 LSB), self-heating
      const rRefActual = rRef * (1 + 25e-6 * ambDelta);
      const ratio = (effectiveR - nominalCableForComp) / rRefActual;
      const quantizedCode = Math.round(ratio * 32768);
      const rMeas = (quantizedCode / 32768) * rRef + (params.calibrateCableAndZero ? 0 : 0);
      const measuredT = pt1000Temperature(rMeas) + selfHeatK;
      const errK = measuredT - trueTempC;

      // Worst case bound: R_ref tol + 1.5 LSB ADC + drift + self-heat
      const dRdT = 3.85;
      const rTolOhm = trueR * tolFrac;
      const worstK = (rTolOhm + 0.131 * 2 + trueR * 25e-6 * Math.abs(ambDelta)) / dRdT + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iExcMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: '15-bit RTD Code',
        digitalReadoutValue: `${quantizedCode} (0x${quantizedCode.toString(16).toUpperCase().padStart(4, '0')})`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.0 ? 'Drifting' : 'Nominal',
        safetyDetail:
          cableUncomp > 0
            ? `Uncompensated 2-wire cable (+${cableUncomp.toFixed(2)} Ω) adds +${(cableUncomp / 3.85).toFixed(2)} K offset.`
            : 'Nominal ratiometric conversion within CoSTOS specification.',
        nodes: [
          { label: 'V_BIAS', value: '2.000 V', note: 'Internal bias' },
          { label: 'V(R_pt)', value: `${((iExcMa / 1000) * effectiveR).toFixed(3)} V`, note: `${iExcMa.toFixed(2)} mA` },
          { label: 'R_meas', value: `${rMeas.toFixed(2)} Ω`, note: '15-bit ratio' },
        ],
      };
    }

    case 'switched_rc': {
      // Rev D (Tier 1+2): Single-reel 1.00 kOhm 0.1% bridge (R101A-D = 4.000 kOhm, R102 = 1.000 kOhm, R103A+B = 2.000 kOhm)
      // + R105A||B = 2x100R 1206 Basic (50 Ohm 0.5W) Q1 guard; R104 = 10 kOhm + C103 = 100 nF + D8 = 1N4148W Basic clamp
      // Local U1B 72.2 Hz exponential RC ramp (R106=R107=390k, R108=100k, R109=150k, R111=4.7k, C=2x10 nF C0G)
      // Firmware inverts exact exponential duty curve g(x) via 2-point calibrated bisection (<0.03 K linearity)
      const rTop = 4000;
      const rGuardNom = 50; // R105A||R105B = 2x100 Ohm 1% 1206 Basic (50 Ohm 0.5W) on Q1 Drain (PT1 branch only)
      const rGuardDrift = rGuardNom * 100e-6 * ambDelta;
      const rGuardActual = rGuardNom + rGuardDrift;
      const rRefLo = 1000;
      const rRefHi = 2000;
      const rDsOn = 0.03 * (1 + 0.004 * ambDelta);

      // Exact U1B hysteresis thresholds as fraction of V_33:
      const r6 = 390000;
      const r7 = 390000;
      const r8 = 100000;
      const r9 = 150000;
      const r11 = 4700;
      const cRamp = 20e-9; // 2x 10 nF 0805 C0G/NP0 (real JLCPCB Basic)

      const alphaNom = ((r8 * r9) / (r8 + r9)) / (r7 + (r8 * r9) / (r8 + r9)); // 0.13333 (0.440 V @ 3.3V)
      const r9Eff = r9 + r11;
      const rParHigh = (r7 * r9Eff) / (r7 + r9Eff);
      const betaNom = r8 / (r8 + rParHigh); // 0.47447 (1.566 V @ 3.3V)
      const kappaNom = (r6 + r11) / r6; // 1.01205

      // Simulate realistic ±1% R107..R109 spread + LM393 input bias (25 nA across 10k) + D8 1N4148W (<5 nA @ <1.3 V)
      const alphaAct = alphaNom * (1 + 0.004);
      const betaAct = betaNom * (1 - 0.004);
      const vBiasDropFrac = (25e-9 * 10000) / v33; // constant across all 3 states -> cancels in 2-pt

      const gExp = (x: number, a: number, k: number) =>
        k * Math.log((1 - a) / (1 - x)) + Math.log(x / a);

      const tChgS = (r6 + r11) * cRamp * Math.log((1 - alphaAct) / (1 - betaAct));
      const tDisS = r6 * cRamp * Math.log(betaAct / alphaAct);
      const periodRampS = tChgS + tDisS; // ~13.85 ms
      const fRamp = 1 / periodRampS; // ~72.2 Hz

      const windowS =
        params.pollIntervalS >= 10
          ? 0.5 // Exact 25 EU 50 Hz cycles / 30 US 60 Hz cycles
          : params.pollIntervalS >= 5
          ? 0.4
          : params.pollIntervalS >= 3
          ? 0.3
          : 0.2;
      const dutyCycle = windowS / params.pollIntervalS; // PT1 energized 5% at 10 s poll

      const iDcMa = (v33 / (rTop + Math.min(effectiveR, 1e6) + rGuardActual)) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iDcMa / 1000, 2) * trueR * 1000;
      const avgSelfHeatK = selfHeatingDeltaK(pMw * dutyCycle);

      const gTotalAct = gExp(betaAct, alphaAct, kappaNom);
      const actualDutyForR = (rTotalToGnd: number) => {
        const xNode = rTotalToGnd / (rTop + rTotalToGnd) - vBiasDropFrac;
        if (xNode <= alphaAct) return 0;
        if (xNode >= betaAct) return 1;
        return gExp(xNode, alphaAct, kappaNom) / gTotalAct;
      };

      const dLo = actualDutyForR(rRefLo + rDsOn);
      const dHi = actualDutyForR(rRefHi + rDsOn);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '72 Hz PWM Duty',
          digitalReadoutValue: '100% HIGH (0 Edges)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Open sensor pulls V_DIV to 3.30 V (>1.57 V ramp top) -> 0 edges & GPIO 22 steady HIGH -> OpenCircuit.',
          nodes: [
            { label: 'V_DIV(PT1)', value: `${v33.toFixed(2)} V`, note: '> 1.57 V ramp ceiling' },
            { label: 'D(R_lo / R_hi)', value: `${(dLo * 100).toFixed(1)} / ${(dHi * 100).toFixed(1)}%`, note: '72 Hz BIST alive' },
            { label: 'GPIO 22 Level', value: 'HIGH (0 edges)', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        const vShort = v33 * (rGuardActual / (rTop + rGuardActual));
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iDcMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '72 Hz PWM Duty',
          digitalReadoutValue: '0.0% LOW (0 Edges)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: `Shorted PT1 drops V_DIV to ${vShort.toFixed(3)} V (<0.44 V ramp floor) -> 0 edges & GPIO 22 steady LOW -> ShortCircuit.`,
          nodes: [
            { label: 'V_DIV(PT1)', value: `${vShort.toFixed(3)} V`, note: '< 0.44 V ramp floor' },
            { label: 'D(R_lo / R_hi)', value: `${(dLo * 100).toFixed(1)} / ${(dHi * 100).toFixed(1)}%`, note: '72 Hz BIST alive' },
            { label: 'GPIO 22 Level', value: 'LOW (0 edges)', note: 'ShortCircuit' },
          ],
        };
      }

      const dPt = actualDutyForR(effectiveR + rGuardActual + rDsOn);
      const nCycles = Math.max(8, Math.round(windowS / periodRampS));

      // Exact sensitivity dD/dR at operating point (tight 1.13 V ramp boosts sensitivity ~1.7x vs Rev C!)
      const dD_dR =
        (actualDutyForR(effectiveR + rGuardActual + rDsOn + 1) -
          actualDutyForR(effectiveR + rGuardActual + rDsOn - 1)) /
        2;

      // One-cycle edge timing jitter (rising + falling -> sqrt(2)) averaged across nCycles
      const sigmaDutyOneCycle = (Math.SQRT2 * (params.gpioJitterUs * 1e-6)) / periodRampS;
      const sigmaDutyAvg = sigmaDutyOneCycle / Math.sqrt(nCycles);
      const jitterBiasD = sigmaDutyAvg * 0.15;

      // Exact 2-point calibrated analytical ln() inversion (same 6-line algorithm as costos-hw-linux)
      const xLoNom = (rRefLo + rDsOn) / (rTop + rRefLo + rDsOn);
      const xHiNom = (rRefHi + rDsOn) / (rTop + rRefHi + rDsOn);
      const gLoNom = gExp(xLoNom, alphaNom, kappaNom);
      const gHiNom = gExp(xHiNom, alphaNom, kappaNom);
      const u = (dPt + jitterBiasD - dLo) / (dHi - dLo);
      const gTarget = gLoNom + u * (gHiNom - gLoNom);

      let lo = alphaNom + 1e-5;
      let hi = betaNom - 1e-5;
      for (let iter = 0; iter < 16; iter++) {
        const mid = 0.5 * (lo + hi);
        if (gExp(mid, alphaNom, kappaNom) < gTarget) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const xEst = 0.5 * (lo + hi);
      const rBranchEst = (rTop * xEst) / (1 - xEst) - rDsOn;
      // Subtract known 50R R105A||B Q1 guard + calibrated cable resistance
      const rMeas = rBranchEst - rGuardNom - nominalCableForComp;
      const measuredT = pt1000Temperature(rMeas) + avgSelfHeatK;
      const errK = measuredT - trueTempC;

      const refTolOhm = trueR * tolFrac;
      // R105A||B = 50R 1% 1206 Basic: raw tolerance ±0.50 Ohm (±0.13 K), zeroed by Setup Wizard leaving only 100 ppm/K drift
      const guardErrOhm = params.calibrateCableAndZero
        ? Math.abs(rGuardDrift)
        : rGuardNom * 0.01 + Math.abs(rGuardDrift);
      const jitterOhm = (1.5 * sigmaDutyAvg) / Math.max(1e-7, dD_dR);
      const worstK = (refTolOhm + guardErrOhm + jitterOhm + 0.06) / 3.85 + avgSelfHeatK;
      const usPerK = dD_dR * 3.85 * periodRampS * 1e6;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iDcMa,
        selfHeatingMw: pMw * dutyCycle,
        selfHeatingK: avgSelfHeatK,
        digitalReadoutLabel: '72 Hz PWM Duty',
        digitalReadoutValue: `${(dPt * 100).toFixed(2)}% (${fRamp.toFixed(1)} Hz)`,
        detectedFault: 'OK',
        safetyStatus: worstK > 1.2 ? 'Drifting' : 'Nominal',
        safetyDetail: `Rev D exact ln() solver: 0.00 K cable-cap & Zener error, ${usPerK.toFixed(1)} µs/K sensitivity (${nCycles} cycles / ${(windowS * 1000).toFixed(0)} ms).`,
        nodes: [
          { label: 'D(PT1)', value: `${(dPt * 100).toFixed(2)}%`, note: `${usPerK.toFixed(1)} µs/K @ 72 Hz` },
          { label: 'D(R_lo / R_hi)', value: `${(dLo * 100).toFixed(1)} / ${(dHi * 100).toFixed(1)}%`, note: 'Exact ln() 2-pt ref' },
          { label: 'Avg Power', value: `${(pMw * dutyCycle).toFixed(3)} mW`, note: `+${avgSelfHeatK.toFixed(4)} K self-heat` },
        ],
      };
    }

    case 'bridge_cs1237': {
      // Ratiometric bridge: R_top = 4.7k, R_zero = 1.0k, V_exc = 3.3V, PGA Gain = 2
      const rTop = 4700;
      const rZero = 1000;
      const vExc = v33;
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '24-bit Signed Code',
          digitalReadoutValue: '+8,388,607 (PGA Sat)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Open sensor pulls IN+ to 3.3 V -> 24-bit ADC saturates at +FS (0x7FFFFF) -> OpenCircuit.',
          nodes: [
            { label: 'V(IN+)', value: `${vExc.toFixed(2)} V`, note: 'Pulled to V_exc' },
            { label: 'V(IN−)', value: `${(vExc * rZero / (rTop + rZero)).toFixed(3)} V`, note: '1k/4.7k ref' },
            { label: 'Code', value: '0x7FFFFF', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: '24-bit Signed Code',
          digitalReadoutValue: '-8,388,608 (PGA Sat)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1 pulls V_diff to -579 mV (< -0.25 V limit) -> ShortCircuit flagged.',
          nodes: [
            { label: 'V(IN+)', value: '0.001 V', note: 'Shorted to GND' },
            { label: 'V(IN−)', value: `${(vExc * rZero / (rTop + rZero)).toFixed(3)} V`, note: '0.579 V ref' },
            { label: 'V_diff', value: '-578 mV', note: 'ShortCircuit' },
          ],
        };
      }

      const vInPlus = vExc * (effectiveR / (rTop + effectiveR));
      const vInMinus = vExc * (rZero / (rTop + rZero));
      const vDiff = vInPlus - vInMinus; // -79 mV @ -50C .. +385 mV @ +250C
      const gain = 2;
      const fsV = 0.5 * vExc; // CS1237 full-scale +/- 0.5*VREF / Gain
      const rawCode = Math.round((vDiff * gain / fsV) * 8388607);
      const fracRatio = (rawCode / 8388607) * (0.5 / gain) + rZero / (rTop + rZero);
      const rCalc = (rTop * fracRatio) / (1 - fracRatio) - nominalCableForComp;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK;
      const errK = measuredT - trueTempC;

      // Worst-case bridge resistor tolerance across 3 legs (if uncalibrated vs calibrated)
      const bridgeResErrOhm = params.calibrateCableAndZero
        ? trueR * (tolFrac * 0.65) + trueR * 25e-6 * Math.abs(ambDelta)
        : trueR * (tolFrac * 2.2);
      const worstK = bridgeResErrOhm / 3.85 + selfHeatK + 0.015;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: '24-bit Signed Code',
        digitalReadoutValue: `${rawCode.toLocaleString()} (G=2)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.0 ? 'Drifting' : 'Nominal',
        safetyDetail:
          params.pollIntervalS >= 3
            ? `100% ratiometric 24-bit PGA; ${params.pollIntervalS} s polling leaves ample headroom to retry any Linux IRQ collision.`
            : '100% ratiometric bridge into 24-bit PGA; Pi 5V rail sag cancels completely.',
        nodes: [
          { label: 'V(IN+)', value: `${vInPlus.toFixed(4)} V`, note: 'Pt1000 leg' },
          { label: 'V(IN−)', value: `${vInMinus.toFixed(4)} V`, note: '1.0 kΩ ref leg' },
          { label: 'V_diff', value: `${(vDiff * 1000).toFixed(2)} mV`, note: 'Gain = 2' },
        ],
      };
    }

    case 'bridge_lmv358_ads1115': {
      // Bridge: R_top = 3.3k, R_zero = 800 Ohm, LMV358 diff amp G = 3.5, ADS1115 Vref = 4.096V
      const rTop = 3300;
      const rZero = 800;
      const gain = 3.5;
      const vExc = v33;
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS1115 Voltage',
          digitalReadoutValue: '2.68 V (Saturated High)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'LMV358 saturates at upper output ceiling (~2.68 V > 2.55 V limit) -> OpenCircuit.',
          nodes: [
            { label: 'V_bridge+', value: `${vExc.toFixed(2)} V`, note: 'Open leg' },
            { label: 'LMV358 OUT', value: '2.68 V', note: 'Rail ceiling' },
            { label: 'Threshold', value: '> 2.55 V', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS1115 Voltage',
          digitalReadoutValue: '0.02 V (Saturated Low)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Diff amp hits lower rail (< 0.12 V threshold) -> ShortCircuit.',
          nodes: [
            { label: 'V_bridge+', value: '0.001 V', note: 'Shorted' },
            { label: 'LMV358 OUT', value: '0.020 V', note: 'Lower rail' },
            { label: 'Threshold', value: '< 0.12 V', note: 'ShortCircuit' },
          ],
        };
      }

      const vPlus = vExc * (effectiveR / (rTop + effectiveR));
      const vZero = vExc * (rZero / (rTop + rZero));
      // Typical LMV358 V_os ~ 1.7 mV (+5 uV/K drift) if not calibrated out
      const vOsRaw = 0.0017 + 5e-6 * ambDelta;
      const vOsEffective = params.calibrateCableAndZero ? 5e-6 * ambDelta : vOsRaw;
      // Add 0.25V pedestal so -50C sits comfortably above LMV358 lower rail saturation
      const vPedestal = 0.25;
      const vOut = Math.min(2.75, Math.max(0.01, vPedestal + gain * (vPlus - vZero + vOsEffective)));
      const adcStep = 4.096 / 32768;
      const adcCounts = Math.round(vOut / adcStep);
      const vMeas = adcCounts * adcStep;

      // Invert assuming nominal V_exc = vExc (ADS1115 AIN2 measures vExc)
      const vDiffMeas = (vMeas - vPedestal) / gain;
      const frac = vDiffMeas / vExc + rZero / (rTop + rZero);
      const rCalc = (rTop * frac) / (1 - frac) - nominalCableForComp;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK;
      const errK = measuredT - trueTempC;

      // Worst-case: LMV358 max Vos (5 mV if uncalibrated, 0.3 mV drift if calibrated) + 4 gain resistors + bridge
      const vOsMax = params.calibrateCableAndZero ? 0.0004 : 0.005;
      const dVdT = vExc * (rTop / Math.pow(rTop + trueR, 2)) * 3.85; // V/K at bridge
      const vOsErrorK = vOsMax / (dVdT / 1); // Wait: V_os is at op-amp input, same node as V_bridge!
      const resErrK = (trueR * tolFrac * (params.calibrateCableAndZero ? 1.1 : 3.2)) / 3.85;
      const worstK = vOsErrorK + resErrK + selfHeatK + 0.08;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'ADS1115 (16-bit)',
        digitalReadoutValue: `${adcCounts} (${vMeas.toFixed(4)} V)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.2 || worstK > 2.0 ? 'Drifting' : 'Nominal',
        safetyDetail: params.calibrateCableAndZero
          ? 'Software zero calibration removes LMV358 V_os; 0.1% resistors keep bridge gain tight.'
          : 'Uncalibrated LMV358 V_os (±1.7–5 mV) shifts temperature by ~1–3 K; calibrate in setup wizard.',
        nodes: [
          { label: 'V_bridge', value: `${((vPlus - vZero) * 1000).toFixed(1)} mV`, note: `G = ${gain}×` },
          { label: 'LMV358 OUT', value: `${vOut.toFixed(3)} V`, note: `V_os ${(vOsEffective * 1000).toFixed(2)} mV` },
          { label: 'I_pt1000', value: `${iMa.toFixed(2)} mA`, note: '3.3 kΩ upper leg' },
        ],
      };
    }

    case 'pwm_dac_lm393': {
      // Divider 3.3k + Pt1000 vs 10-bit/12-bit PWM DAC (12-bit hardware PWM at 10 kHz -> 4096 steps)
      const rTop = 3300;
      const vExc = v33;
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'SAR PWM Duty',
          digitalReadoutValue: '98.5% (>90% Open)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Divider node pulls to 3.3 V -> tracking duty > 90% -> OpenCircuit.',
          nodes: [
            { label: 'V(PT1)', value: `${vExc.toFixed(2)} V`, note: 'Open sensor' },
            { label: 'V_dac', value: '3.25 V', note: 'Duty > 90%' },
            { label: 'Fault', value: 'OpenCircuit', note: 'Safe OFF' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'SAR PWM Duty',
          digitalReadoutValue: '0.4% (<5% Short)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1 pulls divider below 0.16 V (duty < 5%) -> ShortCircuit.',
          nodes: [
            { label: 'V(PT1)', value: '0.001 V', note: 'Shorted' },
            { label: 'V_dac', value: '0.01 V', note: 'Duty < 5%' },
            { label: 'Fault', value: 'ShortCircuit', note: 'Safe OFF' },
          ],
        };
      }

      const vPt = vExc * (effectiveR / (rTop + effectiveR));
      // LM393 Vos (~2 mV typ) + GPIO output impedance droop (~0.1% of 3.3 V if uncalibrated)
      const vOs = params.calibrateCableAndZero ? 8e-6 * ambDelta : 0.002 + 8e-6 * ambDelta;
      const gpioImpedanceErrV = params.calibrateCableAndZero ? 0 : -0.0015;
      const targetDuty = Math.min(0.99, Math.max(0.01, (vPt + vOs + gpioImpedanceErrV) / vExc));
      // 11-bit at 1s poll, 12-bit at 3-5s poll, 13-bit oversampled at 10s poll
      const steps = params.pollIntervalS >= 10 ? 8192 : params.pollIntervalS >= 3 ? 4096 : 2048;
      const quantizedDuty = Math.round(targetDuty * steps) / steps;
      const rCalc = (rTop * quantizedDuty) / (1 - quantizedDuty) - nominalCableForComp;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK;
      const errK = measuredT - trueTempC;

      const dVdT = vExc * (rTop / Math.pow(rTop + trueR, 2)) * 3.85;
      const vOsBoundV = params.calibrateCableAndZero ? 0.0005 : 0.005;
      const stepBoundV = vExc / steps;
      const worstK = (vOsBoundV + stepBoundV) / dVdT + (trueR * tolFrac) / 3.85 + selfHeatK;

      const effBits = params.pollIntervalS >= 10 ? 13 : params.pollIntervalS >= 3 ? 12 : 11;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'SAR PWM Duty',
        digitalReadoutValue: `${(quantizedDuty * 100).toFixed(2)}% (${Math.round(quantizedDuty * steps)}/${steps})`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.2 || worstK > 2.0 ? 'Drifting' : 'Nominal',
        safetyDetail:
          params.pollIntervalS >= 3
            ? `${params.pollIntervalS} s polling enables ${effBits}-bit RC settling/oversampling, though LM393 offset (~2–5 mV) remains.`
            : 'Cheapest BOM (€0.21), but LM393 offset (~2–5 mV) and DAC ripple give lower margin than Switched RC.',
        nodes: [
          { label: 'V(PT1)', value: `${vPt.toFixed(4)} V`, note: '3.3 kΩ divider' },
          { label: 'V_dac', value: `${(quantizedDuty * vExc).toFixed(4)} V`, note: '2-stage RC' },
          { label: 'Step Size', value: `${(stepBoundV / dVdT).toFixed(2)} K`, note: `${effBits}-bit equiv` },
        ],
      };
    }

    case 'ads1115_diff_mux': {
      // Direct Differential ADS1115 (PGA ±0.512V = 15.625 uV/LSB) + 4.000k/1.000k Wheatstone ref + AIN2 V_exc/2 ratio
      const rTop = 4000;
      const rRefBot = 1000;
      const vExc = v33;
      const dutyCycle = 0.125; // 1-of-8 active with AO3400A + 74HC138
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000 * dutyCycle;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS1115 Diff Code',
          digitalReadoutValue: '+32767 (+0.512 V SAT)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Open PT1000 pulls AIN0 to 3.3 V -> differential PGA saturates +32767 -> OpenCircuit fault.',
          nodes: [
            { label: 'V(AIN0)', value: `${vExc.toFixed(2)} V`, note: 'Open sensor' },
            { label: 'V(AIN1)', value: '0.660 V', note: '0°C Wheatstone ref' },
            { label: 'V_diff', value: '+0.512 V SAT', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS1115 Diff Code',
          digitalReadoutValue: '-32768 (-0.512 V SAT)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1000 pulls AIN0 near 0 V (V_diff = −660 mV) -> PGA saturates −32768 -> ShortCircuit fault.',
          nodes: [
            { label: 'V(AIN0)', value: '0.001 V', note: 'Shorted' },
            { label: 'V(AIN1)', value: '0.660 V', note: '0°C Wheatstone ref' },
            { label: 'V_diff', value: '-0.512 V SAT', note: 'ShortCircuit' },
          ],
        };
      }

      const vPt = vExc * (effectiveR / (rTop + effectiveR));
      const vMid = vExc * (rRefBot / (rTop + rRefBot));
      const vDiff = vPt - vMid;
      const lsbV = 0.512 / 32768; // 15.625 uV
      const code = Math.max(-32768, Math.min(32767, Math.round(vDiff / lsbV)));
      // Pseudo-ratiometric: AIN2 reads V_exc/2 -> cancels supply voltage drift!
      const vPtMeas = vMid + code * lsbV;
      const rCalc = (rTop * vPtMeas) / Math.max(0.01, vExc - vPtMeas) - nominalCableForComp;
      // 74HC4051/AO3400A + ADS1115 INL/drift (~0.02 K typ)
      const adcDriftK = 0.0012 * ambDelta;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK + adcDriftK;
      const errK = measuredT - trueTempC;

      const dVdT = vExc * (rTop / Math.pow(rTop + trueR, 2)) * 3.85;
      const resBoundK = (trueR * tolFrac) / 3.85;
      const adcBoundK = (4 * lsbV) / dVdT + Math.abs(adcDriftK) + 0.04;
      const worstK = resBoundK + adcBoundK + cableUncomp / 3.85 + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'ADS1115 Diff (±0.512V)',
        digitalReadoutValue: `${code >= 0 ? '+' : ''}${code} (${(code * lsbV * 1000).toFixed(2)} mV)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.0 || worstK > 1.5 ? 'Drifting' : 'Nominal',
        safetyDetail:
          'Pseudo-ratiometric (AIN0−AIN1 vs AIN2 V_exc/2) cancels supply drift completely; 0.008–0.012 K/LSB at 8 SPS with 50/60 Hz notch.',
        nodes: [
          { label: 'V(AIN0)', value: `${vPt.toFixed(4)} V`, note: '4.000 kΩ top' },
          { label: 'V_diff', value: `${(vDiff * 1000).toFixed(2)} mV`, note: 'vs 0.660 V AIN1' },
          { label: 'V(AIN2)', value: `${(vExc / 2).toFixed(3)} V`, note: 'V_exc/2 ratio' },
        ],
      };
    }

    case 'tm7705_ratiometric': {
      // True hardware ratiometric 16-bit SPI ADC: REF+/REF- across 4.000 kOhm top R_ref, AIN+/AIN- across Pt1000
      const rRef = 4000;
      const vExc = v33;
      const iMa = (vExc / (rRef + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'TM7705 16-bit Ratio',
          digitalReadoutValue: '0xFFFF (Open SAT)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Open PT1000 collapses V_REF across R_ref while V_AIN rises to 3.3 V -> 0xFFFF saturation -> OpenCircuit.',
          nodes: [
            { label: 'V_REF (R_ref)', value: '0.000 V', note: 'Zero current' },
            { label: 'V_AIN (PT1)', value: `${vExc.toFixed(2)} V`, note: 'Open sensor' },
            { label: 'SPI Code', value: '0xFFFF', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'TM7705 16-bit Ratio',
          digitalReadoutValue: '0x0001 (Short SAT)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1000 drives V_AIN < 1 mV against full V_REF -> near-zero ratio -> ShortCircuit.',
          nodes: [
            { label: 'V_REF (R_ref)', value: `${vExc.toFixed(2)} V`, note: 'Full rail' },
            { label: 'V_AIN (PT1)', value: '0.001 V', note: 'Shorted' },
            { label: 'SPI Code', value: '0x0001', note: 'ShortCircuit' },
          ],
        };
      }

      // PGA Gain = 2: full scale = V_ref / 2 -> measures R_pt / R_ref directly up to 2.000 kOhm (+266 C)
      const gain = 2;
      const ratio = effectiveR / rRef; // 0.20 .. 0.485
      const code = Math.max(0, Math.min(65535, Math.round(ratio * gain * 65535)));
      const rCalc = ((code / (65535 * gain)) * rRef) - nominalCableForComp;
      const driftK = 0.001 * ambDelta;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK + driftK;
      const errK = measuredT - trueTempC;

      const worstK = (trueR * tolFrac) / 3.85 + 0.04 + Math.abs(driftK) + cableUncomp / 3.85 + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'TM7705 16-bit Ratio',
        digitalReadoutValue: `0x${code.toString(16).toUpperCase().padStart(4, '0')} (${code}/65535)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 0.9 || worstK > 1.3 ? 'Drifting' : 'Nominal',
        safetyDetail:
          '100% hardware ratiometric (REF+−REF− directly across 4.000 kΩ R_ref): immune to Pi supply sag and 50 Hz mains hum.',
        nodes: [
          { label: 'V_REF (R_ref)', value: `${(vExc * (rRef / (rRef + effectiveR))).toFixed(4)} V`, note: '4.000 kΩ' },
          { label: 'V_AIN (PT1)', value: `${(vExc * (effectiveR / (rRef + effectiveR))).toFixed(4)} V`, note: 'Gain = 2×' },
          { label: 'R_pt / R_ref', value: ratio.toFixed(5), note: 'True ratio' },
        ],
      };
    }

    case 'stm32_basic_coproc': {
      // STM32F103C8T6 (Basic C8734): 12-bit ratiometric ADC (VREF=VDDA) with 256x oversampling (~15.5 eff bits)
      const rTop = 4000;
      const vExc = v33;
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'STM32 I²C Frame',
          digitalReadoutValue: 'FAULT_OPEN (0xFFF0 · CRC OK)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'STM32 ADC reads full-scale VDDA (4095/4095) and transmits CRC-8 protected FAULT_OPEN over I²C.',
          nodes: [
            { label: 'ADC_IN0', value: `${vExc.toFixed(2)} V`, note: 'Open sensor' },
            { label: '256× Oversamp', value: '65520 / 65535', note: 'Rail high' },
            { label: 'I²C Status', value: 'FAULT_OPEN', note: 'CRC-8 OK' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'STM32 I²C Frame',
          digitalReadoutValue: 'FAULT_SHORT (0x0008 · CRC OK)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'STM32 ADC reads near-0 V and transmits CRC-8 protected FAULT_SHORT over I²C.',
          nodes: [
            { label: 'ADC_IN0', value: '0.001 V', note: 'Shorted' },
            { label: '256× Oversamp', value: '18 / 65535', note: 'Rail low' },
            { label: 'I²C Status', value: 'FAULT_SHORT', note: 'CRC-8 OK' },
          ],
        };
      }

      const ratio = effectiveR / (rTop + effectiveR);
      const effSteps = 32768; // 15-bit effective after 256x oversampling + INL floor (~1.5 LSB @ 12-bit = 0.037%FS)
      const inlRatioErr = params.calibrateCableAndZero ? 0.00012 : 0.00035;
      const quantRatio = Math.round((ratio + inlRatioErr) * effSteps) / effSteps;
      const rCalc = (rTop * quantRatio) / (1 - quantRatio) - nominalCableForComp;
      const driftK = 0.002 * ambDelta;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK + driftK;
      const errK = measuredT - trueTempC;

      const adcInlBoundK = (params.calibrateCableAndZero ? 0.14 : 0.32) + Math.abs(driftK);
      const worstK = (trueR * tolFrac) / 3.85 + adcInlBoundK + cableUncomp / 3.85 + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'STM32 I²C (15-bit OS)',
        digitalReadoutValue: `${measuredT.toFixed(2)} °C (${Math.round(quantRatio * effSteps)}/${effSteps})`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 1.0 || worstK > 1.6 ? 'Drifting' : 'Nominal',
        safetyDetail:
          '100% ratiometric (VDDA = divider supply), 256× DMA oversampling synced to 50 Hz, only 2 Extended reels (€5.60), Pi 5 I²C ready.',
        nodes: [
          { label: 'V(ADC_IN0)', value: `${(vExc * ratio).toFixed(4)} V`, note: '4.000 kΩ top' },
          { label: 'Eff. Res.', value: '15.5-bit OS', note: '256× avg' },
          { label: 'I²C Frame', value: 'CRC-8 OK', note: 'Zero Pi jitter' },
        ],
      };
    }

    case 'ads124s08_idac': {
      // TI ADS124S08: 24-bit ΔΣ + dual matched 500 uA IDACs -> TRUE 3-wire cable resistance cancellation!
      const rRef = 2000;
      const iIdacMa = 0.5; // 500 uA per IDAC -> 1.0 mA through R_ref = 2.000 V V_ref
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iIdacMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS124S08 24-bit SPI',
          digitalReadoutValue: '0x7FFFFF (Burn-out Open)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'ADS124S08 IDAC compliance rail + burn-out current sources flag OpenCircuit immediately with CRC-8.',
          nodes: [
            { label: 'IDAC1 / IDAC2', value: '0.00 mA', note: 'Compliance limit' },
            { label: '24-bit Code', value: '0x7FFFFF', note: 'OpenCircuit' },
            { label: 'SPI CRC-8', value: 'VALID', note: 'Safe OFF' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iIdacMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'ADS124S08 24-bit SPI',
          digitalReadoutValue: '0x000012 (Short Fault)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1000 yields near-0 V differential across AIN0/AIN1 -> ShortCircuit fault.',
          nodes: [
            { label: 'IDAC1 / IDAC2', value: '0.50 mA', note: 'Matched pair' },
            { label: 'V_diff (PT1)', value: '0.02 mV', note: 'Shorted' },
            { label: 'SPI CRC-8', value: 'VALID', note: 'Safe OFF' },
          ],
        };
      }

      // Dual IDACs match to ±0.15% -> cancels 99.85% of 3-wire roof cable resistance in hardware!
      const idacMismatchCableOhm = params.cableResistanceOhm * 0.0015;
      const rMeas = trueR + (params.calibrateCableAndZero ? 0 : idacMismatchCableOhm);
      const code = Math.round((rMeas / (2 * rRef)) * 8388607 * 2); // PGA = 2
      const driftK = 0.0005 * ambDelta;
      const measuredT = pt1000Temperature(rMeas) + selfHeatK + driftK;
      const errK = measuredT - trueTempC;

      const worstK = (trueR * tolFrac) / 3.85 + 0.02 + Math.abs(driftK) + idacMismatchCableOhm / 3.85 + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iIdacMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'ADS124S08 (24-bit 3W)',
        digitalReadoutValue: `0x${code.toString(16).toUpperCase().padStart(6, '0')} (CRC OK)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 0.5 || worstK > 0.8 ? 'Drifting' : 'Nominal',
        safetyDetail:
          'Dual 500 µA IDACs cancel 99.85% of 3-wire roof cable resistance in hardware; >90 dB 50/60 Hz rejection + SPI CRC-8.',
        nodes: [
          { label: 'IDAC1 / IDAC2', value: '500 µA × 2', note: '3-wire cancel' },
          { label: 'V_REF (2.0k)', value: '2.0000 V', note: 'True ratio' },
          { label: 'V(PT1000)', value: `${(iIdacMa * trueR / 1000).toFixed(4)} V`, note: '<0.001 K res' },
        ],
      };
    }

    case 'mcp3424_i2c': {
      // Microchip MCP3424: 18-bit 4-ch differential I2C ADC (Gain = 4 -> ±0.512 V, 3.906 uV/LSB) + CH4 V_exc/2
      const rTop = 4000;
      const rRefBot = 1000;
      const vExc = v33;
      const iMa = (vExc / (rTop + Math.min(effectiveR, 5000))) * 1000;
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'MCP3424 18-bit Code',
          digitalReadoutValue: '+131071 (+0.512 V SAT)',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Open PT1000 saturates 18-bit differential CH1 at +131071 -> OpenCircuit fault.',
          nodes: [
            { label: 'CH1+', value: `${vExc.toFixed(2)} V`, note: 'Open sensor' },
            { label: 'CH1−', value: '0.660 V', note: '0°C ref' },
            { label: '18-bit Code', value: '+131071 SAT', note: 'OpenCircuit' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'MCP3424 18-bit Code',
          digitalReadoutValue: '-131072 (-0.512 V SAT)',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'Shorted PT1000 saturates 18-bit differential CH1 at −131072 -> ShortCircuit fault.',
          nodes: [
            { label: 'CH1+', value: '0.001 V', note: 'Shorted' },
            { label: 'CH1−', value: '0.660 V', note: '0°C ref' },
            { label: '18-bit Code', value: '-131072 SAT', note: 'ShortCircuit' },
          ],
        };
      }

      const vPt = vExc * (effectiveR / (rTop + effectiveR));
      const vMid = vExc * (rRefBot / (rTop + rRefBot));
      const vDiff = vPt - vMid;
      const lsbV = 0.512 / 131072; // 3.90625 uV at 18-bit Gain=4
      const code = Math.max(-131072, Math.min(131071, Math.round(vDiff / lsbV)));
      const vPtMeas = vMid + code * lsbV;
      const rCalc = (rTop * vPtMeas) / Math.max(0.01, vExc - vPtMeas) - nominalCableForComp;
      const driftK = 0.001 * ambDelta;
      const measuredT = pt1000Temperature(rCalc) + selfHeatK + driftK;
      const errK = measuredT - trueTempC;

      const worstK = (trueR * tolFrac) / 3.85 + 0.03 + Math.abs(driftK) + cableUncomp / 3.85 + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'MCP3424 18-bit (G=4)',
        digitalReadoutValue: `${code >= 0 ? '+' : ''}${code} (${(code * lsbV * 1000).toFixed(2)} mV)`,
        detectedFault: 'OK',
        safetyStatus: Math.abs(errK) > 0.9 || worstK > 1.4 ? 'Drifting' : 'Nominal',
        safetyDetail:
          '18-bit differential readout (3.9 µV/LSB = 0.004 K) in easy SOIC-14; CH4 reads V_exc/2 for pseudo-ratiometric cancellation.',
        nodes: [
          { label: 'V(CH1+)', value: `${vPt.toFixed(4)} V`, note: '4.000 kΩ top' },
          { label: 'V_diff', value: `${(vDiff * 1000).toFixed(2)} mV`, note: '18-bit @ 3.75 SPS' },
          { label: 'V(CH4)', value: `${(vExc / 2).toFixed(3)} V`, note: 'V_exc/2 ratio' },
        ],
      };
    }

    case 'ltc2983_turnkey': {
      // ADI LTC2983: 20-ch turnkey 24-bit multi-sensor IC with native 3/4-wire RTD excitation & ROM CVD solver
      const iExcMa = 0.25; // 250 uA programmable excitation -> ultra-low self-heating
      const pMw = params.activeFault === 'open' ? 0 : Math.pow(iExcMa / 1000, 2) * trueR * 1000;
      const selfHeatK = selfHeatingDeltaK(pMw);

      if (params.activeFault === 'open') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: 0,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'LTC2983 Status+Temp',
          digitalReadoutValue: '0x04 HARD_OVERRANGE',
          detectedFault: 'OpenCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'LTC2983 hardware fault byte immediately flags Sensor Hard Overrange (open probe).',
          nodes: [
            { label: 'I_exc', value: '0.00 mA', note: 'Open loop' },
            { label: 'Fault Byte', value: '0x04', note: 'Hard Overrange' },
            { label: 'ROM Output', value: 'INVALID', note: 'Safe OFF' },
          ],
        };
      }

      if (params.activeFault === 'short') {
        return {
          topologyId,
          trueTempC,
          trueResistanceOhm: trueR,
          measuredTempC: null,
          errorK: null,
          worstCaseBoundK: 0,
          excitationCurrentMa: iExcMa,
          selfHeatingMw: 0,
          selfHeatingK: 0,
          digitalReadoutLabel: 'LTC2983 Status+Temp',
          digitalReadoutValue: '0x02 HARD_UNDERRANGE',
          detectedFault: 'ShortCircuit',
          safetyStatus: 'FaultCaught',
          safetyDetail: 'LTC2983 hardware fault byte flags Sensor Hard Underrange (shorted probe).',
          nodes: [
            { label: 'I_exc', value: '250 µA', note: 'Active' },
            { label: 'Fault Byte', value: '0x02', note: 'Hard Underrange' },
            { label: 'ROM Output', value: 'INVALID', note: 'Safe OFF' },
          ],
        };
      }

      // True 4-wire / 3-wire rotation cancels cable resistance to <0.001 Ohm; ROM outputs 1/1024 °C fixed-point!
      const driftK = 0.0003 * ambDelta;
      const measuredT = trueTempC + selfHeatK + driftK;
      const errK = measuredT - trueTempC;
      const fixedCode = Math.round(measuredT * 1024);
      const worstK = (trueR * tolFrac) / 3.85 + 0.015 + Math.abs(driftK) + selfHeatK;

      return {
        topologyId,
        trueTempC,
        trueResistanceOhm: trueR,
        measuredTempC: measuredT,
        errorK: errK,
        worstCaseBoundK: worstK,
        excitationCurrentMa: iExcMa,
        selfHeatingMw: pMw,
        selfHeatingK: selfHeatK,
        digitalReadoutLabel: 'LTC2983 ROM Temp',
        digitalReadoutValue: `${measuredT.toFixed(3)} °C (0x01 VALID · ${fixedCode})`,
        detectedFault: 'OK',
        safetyStatus: 'Nominal',
        safetyDetail:
          'Lab-grade ±0.05 K turnkey ROM readout (3/4-wire cable cancellation), but €43.50/board silicon is 55× pricier than Rev D.',
        nodes: [
          { label: 'I_exc (Rot.)', value: '250 µA', note: '3/4-wire cancel' },
          { label: 'R_sense', value: '2.000 kΩ', note: 'True ratio' },
          { label: 'SPI Output', value: `${measuredT.toFixed(3)} °C`, note: '1/1024 °C LSB' },
        ],
      };
    }
  }
}

export interface SweepPoint {
  tempC: number;
  resistanceOhm: number;
  errorK: number;
  upperBoundK: number;
  lowerBoundK: number;
}

export function computeErrorSweep(
  topologyId: TopologyId,
  params: SimulationParams
): SweepPoint[] {
  const points: SweepPoint[] = [];
  const sweepParams: SimulationParams = { ...params, activeFault: 'none' };
  for (let t = -50; t <= 250; t += 5) {
    const res = evaluateTopology(topologyId, { ...sweepParams, collectorTempC: t });
    const err = res.errorK ?? 0;
    points.push({
      tempC: t,
      resistanceOhm: res.trueResistanceOhm,
      errorK: err,
      upperBoundK: err + res.worstCaseBoundK,
      lowerBoundK: err - res.worstCaseBoundK,
    });
  }
  return points;
}

export type ConclusionVerdict = 'BETTER' | 'WORSE' | 'EQUAL';

export interface ConclusionRow {
  category: string;
  aspect: string;
  initialValue: string;
  nowUsedValue: string;
  verdict: ConclusionVerdict;
  rationale: string;
}

export interface ConclusionSummary {
  rows: ConclusionRow[];
  betterCount: number;
  equalCount: number;
  worseCount: number;
  savingsPerBoardEur: number;
  savingsPerBatchEur: number;
  takeaway: string;
}

export function buildBaselineConclusion(
  params: SimulationParams,
  batchSize: 2 | 5
): ConclusionSummary {
  const initSpec = TOPOLOGY_SPECS.max31865;
  const nowSpec = TOPOLOGY_SPECS.switched_rc;

  const initCost = perBoardCostEur(initSpec, batchSize);
  const nowCost = perBoardCostEur(nowSpec, batchSize);
  const savingsPerBoardEur = initCost - nowCost;
  const savingsPerBatchEur = savingsPerBoardEur * batchSize;

  const initSweep = computeErrorSweep('max31865', params);
  const nowSweep = computeErrorSweep('switched_rc', params);
  const initPeakK = initSweep.reduce(
    (acc, p) => Math.max(acc, Math.abs(p.errorK) + (p.upperBoundK - p.errorK)),
    0
  );
  const nowPeakK = nowSweep.reduce(
    (acc, p) => Math.max(acc, Math.abs(p.errorK) + (p.upperBoundK - p.errorK)),
    0
  );

  const initEval = evaluateTopology('max31865', { ...params, activeFault: 'none' });
  const nowEval = evaluateTopology('switched_rc', { ...params, activeFault: 'none' });
  const nowRes = estimateResourceFootprint('switched_rc', params.pollIntervalS);

  const rows: ConclusionRow[] = [
    {
      category: 'Cost & Assembly',
      aspect: 'Parts BOM Cost',
      initialValue: `€${initSpec.partCostEur.toFixed(2)} / board`,
      nowUsedValue: `€${nowSpec.partCostEur.toFixed(2)} / board`,
      verdict: 'BETTER',
      rationale: '91% lower silicon BOM (−€3.72/bd); replaces proprietary MAX31865 with jellybean onsemi LM393DR2G (C7955) + AO3400A + single-reel 7× 1.00 kΩ 1% Basic (C17513).',
    },
    {
      category: 'Cost & Assembly',
      aspect: 'JLCPCB Extended Feeder Fee',
      initialValue: `€${initSpec.jlcpcbFeederFeeEur.toFixed(2)} (3 Ext reels)`,
      nowUsedValue: `€${nowSpec.jlcpcbFeederFeeEur.toFixed(2)} (0 Ext reels!)`,
      verdict: 'BETTER',
      rationale: '100% Basic SMD optimization eliminated ALL Extended reels (C17513 1.00k 1%, C1710 10 nF X7R, C49678 100 nF 50 V on every wire + D8/D8B C81598 = €0.00 loading fees vs €8.40 for MAX31865).',
    },
    {
      category: 'Cost & Assembly',
      aspect: `Effective Cost / Board (${batchSize}×)`,
      initialValue: `€${initCost.toFixed(2)} / board`,
      nowUsedValue: `€${nowCost.toFixed(2)} / board`,
      verdict: savingsPerBoardEur >= 0 ? 'BETTER' : 'WORSE',
      rationale:
        savingsPerBoardEur >= 0
          ? `Saves €${savingsPerBoardEur.toFixed(2)}/board (€${savingsPerBatchEur.toFixed(2)} per ${batchSize}-board batch) right from batch qty 1.`
          : `Higher amortized Extended fees at ${batchSize}× (+€${Math.abs(savingsPerBoardEur).toFixed(2)}/bd).`,
    },
    {
      category: 'Cost & Assembly',
      aspect: 'Hand-Solderability & Repair',
      initialValue: 'Hard (SSOP-20, 0.65 mm pitch)',
      nowUsedValue: 'Easy (SOIC-8 / SOT-23 / 0805)',
      verdict: 'BETTER',
      rationale: 'Standard 1.27 mm SOIC-8, 0805 & 1206 footprints can be reworked with an ordinary soldering iron.',
    },
    {
      category: 'Cost & Assembly',
      aspect: 'Discrete PCB Part Count',
      initialValue: '6 parts (1 SSOP-20 + 5 passives)',
      nowUsedValue: '31 parts (12 BOM lines, 100% Basic)',
      verdict: 'WORSE',
      rationale: 'More discrete parts to route on the PCB (including 7× single-reel 1.00 kΩ 1% Basic + C106/C105 + D8/D8B), though zero fine-pitch SSOP packages and 0 Extended reels.',
    },
    {
      category: 'Measurement',
      aspect: 'Worst-Case Accuracy (−50…+250 °C)',
      initialValue: `±${initPeakK.toFixed(2)} K (±0.59 K budget)`,
      nowUsedValue: `±0.5 K cal (±2–4 K raw 1% Basic)`,
      verdict: 'WORSE',
      rationale: '1% Basic resistors give ~±2–4 K raw (fine for solar collector ΔT) or ~±0.4–0.6 K after a 1-time 5 s Setup Wizard calibration; bench-unproven on Linux GPIO vs MAX31865 (drop-in 0.1% C110774 available for +€2.80).',
    },
    {
      category: 'Measurement',
      aspect: 'Resolution & Self-Heating',
      initialValue: `±${initSpec.resolutionK} K · +${initEval.selfHeatingK.toFixed(3)} K`,
      nowUsedValue: `±${nowSpec.resolutionK} K · +${nowEval.selfHeatingK.toFixed(4)} K`,
      verdict: 'EQUAL',
      rationale: 'Rev D energizes PT1000 only 5% of each 10 s poll through 4.00 kΩ (+0.003 K self-heating, ~19–23 µs/K sensitivity).',
    },
    {
      category: 'Measurement',
      aspect: 'Setup Wizard Calibration',
      initialValue: 'Factory trimmed (cable zero opt.)',
      nowUsedValue: 'Auto 2-pt BIST + 5 s 1-pt offset',
      verdict: 'EQUAL',
      rationale: 'Auto 2-pt BIST cancels X7R ramp & LM393 drift; optional 5 s Setup Wizard calibration against tap water / DS18B20 nulls both 1% resistor tolerance and 2-wire cable resistance.',
    },
    {
      category: 'Measurement',
      aspect: 'Long Roof Cable Capacitance (>30 m)',
      initialValue: 'Immune (DC ratiometric bridge)',
      nowUsedValue: 'Immune (DC mux + 159 Hz RC filter)',
      verdict: 'EQUAL',
      rationale: 'PT1000 carries steady DC filtered by C106/C105 + 10 kΩ + 100 nF X7R before U1A+ (0.00 K cable-cap error, 50/60 Hz avg).',
    },
    {
      category: 'Pi Hardware',
      aspect: 'Raspberry Pi GPIO Pin Budget',
      initialValue: '4× pins (SPI0: GPIO 8/9/10/11)',
      nowUsedValue: '4× free GPIO (22/27/12/13 · SPI0 free)',
      verdict: 'EQUAL',
      rationale: 'Verified conflict-free against HAT-1wire.md §5; frees SPI0 (GPIO 7–11) + keeps GPIO 21 spare; all 4 pins are native boot pull-DOWN.',
    },
    {
      category: 'Pi Software',
      aspect: 'Linux Kernel Overlay & /dev Binding',
      initialValue: 'Needs dtparam=spi=on + spidev0.0',
      nowUsedValue: 'Zero kernel bus drivers (gpiochip*)',
      verdict: 'BETTER',
      rationale: 'Only gpio= pin modes in config.txt; immune to SPI bus driver regressions across Pi OS upgrades.',
    },
    {
      category: 'Pi Software',
      aspect: 'Rust Crates & Code Footprint',
      initialValue: 'spidev / max31865 crate (~90 LOC)',
      nowUsedValue: 'Zero external crates (~80 LOC Rust)',
      verdict: 'BETTER',
      rationale: 'One less dependency to audit/maintain; async Tokio gpio_v2 counter + 6-line exact ln() bisection solver.',
    },
    {
      category: 'Pi Software',
      aspect: `Pi CPU & RAM (${params.pollIntervalS} s Poll)`,
      initialValue: '0% delta (~0.002% CPU, 4 KB RAM)',
      nowUsedValue: `${nowRes.cpuDelta.split(' of ')[0]} (~22 IRQs/s), +24–40 KB`,
      verdict: 'EQUAL',
      rationale: '72 Hz local ramp (~22 IRQs/s, <0.02% CPU) + tight 1.13 V window resists Linux IRQ jitter cleanly.',
    },
    {
      category: 'Security & Safety',
      aspect: 'Linux OS Privilege Surface',
      initialValue: 'Requires spi group (/dev/spidev0.0)',
      nowUsedValue: 'gpio group only (1.5 s gated window)',
      verdict: 'BETTER',
      rationale: 'Eliminates SPI/I²C bus exposure; IRQ flood capped at 400 Hz and unarmed outside the 1.5 s poll.',
    },
    {
      category: 'Security & Safety',
      aspect: '+24 V Roof Miswiring Survival',
      initialValue: '±45 V silicon pins + 2× 100 Ω',
      nowUsedValue: 'C106+C105 100nF + 10k/D8+D8B + 4×1k',
      verdict: 'EQUAL',
      rationale: 'C106/C105 (100 nF 50 V) shunt IEC ESD/RFI on both wires; R101A–D run 4× cooler at 25.8 mW/ea; R4 (10 kΩ) + symmetric 1N4148W (D8→+3V3/TL431 D9 + D8B→AGND) hold U1A+ at −0.65..+4.30 V.',
    },
    {
      category: 'Security & Safety',
      aspect: 'Fault & Silent-Failure Diagnostics',
      initialValue: 'Reg 0x07 HW fault bits',
      nowUsedValue: '0-Edge HIGH/LOW + R_hi/R_lo BIST',
      verdict: 'EQUAL',
      rationale: '0 edges + pin level cleanly separates Open (HIGH) vs Short (LOW); D(R_hi)/D(R_lo) verifies U1 every poll.',
    },
  ];

  const betterCount = rows.filter((r) => r.verdict === 'BETTER').length;
  const equalCount = rows.filter((r) => r.verdict === 'EQUAL').length;
  const worseCount = rows.filter((r) => r.verdict === 'WORSE').length;

  return {
    rows,
    betterCount,
    equalCount,
    worseCount,
    savingsPerBoardEur,
    savingsPerBatchEur,
    takeaway: `Locked Rev D (100% JLCPCB Basic SMD) keeps SPI0 free, achieves €0.00 SMD loading fees (0 Extended reels across the entire HAT vs €8.40 for MAX31865), cuts recurring parts BOM to €0.36/bd vs €4.08 (beating MAX31865 by €7.92/bd at 2× and €5.40/bd at 5×!), protects every Pt1000 wire with 100 nF 50 V ESD caps + symmetric D8/D8B 1N4148W, and verifies cleanly in TI LM393 ngspice-39 (0.476–1.533 V) — scoring ${betterCount} BETTER, ${equalCount} EQUAL, and ${worseCount} WORSE. Honest trade-offs: 1% Basic resistors give ~±2–4 K raw (~±0.4–0.6 K after a 5 s Setup Wizard calibration; 0.1% C110774 drop-in upgrade optional) and Linux GPIO timing jitter remains bench-unproven until 2× prototype bring-up.`,
  };
}

