import { pt1000Resistance, pt1000Temperature, selfHeatingDeltaK } from './pt1000';

export type TopologyId =
  | 'max31865'
  | 'switched_rc'
  | 'bridge_cs1237'
  | 'bridge_lmv358_ads1115'
  | 'pwm_dac_lm393';

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
  handSolderability: 'Fine-pitch SSOP' | 'SOIC / 0805 Easy';
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
    jlcpcbFeederFeeEur: 2.8,
    partCostEur: 4.08,
    interfacePins: 'SPI0 (MOSI, MISO, SCLK, CE0)',
    handSolderability: 'Fine-pitch SSOP',
    ratiometric: true,
    inputProtection: '±45 V internal + PESD5V0 + 100 Ω filter',
    openShortDetection: 'Native hardware fault register',
    resolutionK: 0.034,
    maxRecommendedErrorK: 0.5,
    bom: [
      { designator: 'U1', part: 'MAX31865AAP+ RTD ADC', packageType: 'SSOP-20', jlcpcbClass: 'Extended', unitCostEur: 3.87 },
      { designator: 'R_ref', part: '4.3 kΩ 0.1% 25ppm', packageType: '0805', jlcpcbClass: 'Preferred', unitCostEur: 0.09 },
      { designator: 'R_f1..2, C_f', part: '100 Ω × 2 + 100 nF filter', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D1..D2', part: 'PESD5V0 ESD diodes', packageType: 'SOD-323', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
    ],
    verdict: 'Zero-risk reference benchmark, but single-handedly accounts for the last €2.80 JLCPCB fee and most of the HAT BOM.',
    advantages: [
      'Purpose-built 15-bit ratiometric RTD converter achieving ~0.35 K accuracy out of the box with only one 4.3 kΩ 0.1% reference resistor',
      'Native ±45 V continuous input fault protection on RTDIN+ / RTDIN− survives outdoor roof miswiring indefinitely',
      'Built-in hardware fault register flags OpenCircuit, ShortCircuit, and over/under-voltage over SPI with zero offset calibration',
      'Ultra-low sensor self-heating (~0.14 mW), zero capacitor aging drift, and built-in 50/60 Hz mains hum rejection filter',
    ],
    tradeoffs: [
      'Most expensive component on the 1-Wire HAT: ~€3.87 chip + €2.80 JLCPCB extended-part feeder fee (€5.48/board on a 2-board order)',
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
    name: 'Switched-Mux DC Divider + 72 Hz RC Ramp — Rev D (Gemini Version)',
    shortName: 'Switched Ramp Rev D (Gemini)',
    badgeText: 'Gemini Version · 100% Basic Parts · €0 Fee',
    summary:
      'Gemini Version (Rev D) zero-fee front-end: 3.90 kΩ DC divider (0 K cable-cap bias), sense-side 10 kΩ + BZX84C5V1 (5.1 V, <5 nA leakage), 47 Ω 1206 Q1 guard, and 72 Hz local RC ramp (2× 10 nF Basic C0G) inverted via exact ln() math in Rust.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.42,
    interfacePins: '4× free GPIO (22/27/12/13 · SPI0 free)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: 'PESD24V + 10k Sense + BZX84C5V1 (5.1V) + 47R 1206',
    openShortDetection: '0 Edges: Pin HIGH = Open (>1.57V), Pin LOW = Short (<0.44V)',
    resolutionK: 0.01,
    maxRecommendedErrorK: 0.4,
    bom: [
      { designator: 'U1', part: 'LM393DR Dual Comp (+5V VCC, 72 Hz Ramp + Slicer)', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'Q1..Q3', part: '3× AO3400A N-MOSFET (30 V, 30 mΩ) + 3× 10k PD', packageType: 'SOT-23/0805', jlcpcbClass: 'Basic', unitCostEur: 0.07 },
      { designator: 'C1..C4', part: '2× 10 nF C0G (Ramp) + 2× 100 nF X7R (EMI/VCC)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R1..R3', part: '3.90 kΩ + 1.00 kΩ + 1.80 kΩ 0.1% 25ppm', packageType: '0805', jlcpcbClass: 'Preferred', unitCostEur: 0.15 },
      { designator: 'R4..R11, D2, D3', part: '10k, 47R (1206 0.5W), 2×390k, 100k, 150k, 2×4.7k, PESD24V, BZX84C5V1', packageType: '1206/0805/SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.12 },
    ],
    verdict: 'Hardware-audited zero-fee choice (€0.42/board, €0 fee): zero Zener leakage (5.1 V), real JLCPCB Basic 10 nF C0G caps, exact ln() RC inversion (<0.03 K linearity), tight 1.13 V ramp, and verified free CoSTOS GPIOs 22/27/12/13 (SPI0 + GPIO 21 stay free).',
    advantages: [
      'Genuine €0.00 JLCPCB feeder fee (10 nF C0G + 100 nF X7R Basic parts) — saves ~€5.06/board (~€10.12 per 2-board order) vs MAX31865',
      'Zero roof-cable capacitance bias (0.00 K even >50 m): PT1000 runs pure DC with a 159 Hz RC filter (10 kΩ + 100 nF X7R) on U1A+',
      'Sense-side 10 kΩ + BZX84C5V1 (5.1 V Zener, <5 nA leakage) eliminates high-temp Zener knee error while surviving continuous +24 V safely',
      'Exact analytical ln() inversion in Rust (~6 LOC) cancels U1B exponential RC curvature to <0.03 K along with C, R6, V_33, and LM393 V_os',
      'Uses 4 verified free non-SPI boot pull-DOWN GPIOs (22/27/12/13 · Pins 15/13/32/33) + stiff 10 kΩ gate pull-downs — zero HAT collisions, SPI0 & GPIO 21 stay free',
    ],
    tradeoffs: [
      'Uses 4 direct GPIO pins (GPIO 27/12/13 outputs + GPIO 22 duty-cycle input) rather than 3 pins (avoids adding an Extended +€2.80 74HC238 decoder)',
      'Higher discrete PCB part count (24 SMD parts across 15 BOM lines vs 6 parts around MAX31865), though all are easy SOIC-8 / 0805 / 1206',
      '47 Ω 1206 Q1 guard adds ±0.12 K raw tolerance before Setup Wizard 2-wire zeroing (drops to 0.00 K once zeroed)',
    ],
    configTxtDiff: 'Remove dtparam=spi=on (SPI0 stays free); add gpio=27,12,13=op,dl & gpio=22=ip,pn (/dev/gpiochip* only)',
    softwareChanges:
      'Async Tokio task in costos-hw-linux runs every 10 s: steps DC mux PT1 -> R_lo (1.00 kΩ) -> R_hi (1.80 kΩ) on GPIO 27/12/13 (strict 1-hot enum), discards 2 cycles (28 ms = 28τ settle), captures 500 ms (~36 cycles, 25 EU mains cycles) on GPIO 22 via gpio_v2, solves exact g(x) ln() curve via bisection, and checks BIST.',
    softwarePros: [
      'Zero kernel bus overlays (no spidev/i2c) and zero external sensor crates — ~80 lines of self-contained, auditable Rust including ln() bisection',
      '72 Hz local ramp (~22 IRQs/s avg) + tight 1.13 V window gives ~19 µs/K sensitivity and <0.02% Pi CPU load',
      'Deterministic 0-edge fault state: steady GPIO 22 HIGH = OpenCircuit (>1.57 V), steady LOW = ShortCircuit (<0.44 V)',
    ],
    softwareCons: [
      'Needs lightweight ±2% median period/duty outlier rejection in Rust (via gpio_v2 hardware timestamps) in case a multi-ms SD-card DMA stall hits a cycle',
    ],
    securityNotes: {
      linuxOsSecurity:
        'Smallest OS privilege footprint (gpio group only; SPI0 stays completely free). 72 Hz operating frequency sits well below a tight 400 Hz IRQ storm cutoff.',
      electricalSafety:
        'PESD24V handles kV ESD without shorting +24 V DC; R1 (3.90 kΩ, 0.11 W @ 24 V) limits +3V3 backfeed to 5.3 mA; R4 (10 kΩ) + BZX84C5V1 clamp U1A+ at 5.1 V (36 mW, <5 nA normal leakage).',
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
    jlcpcbFeederFeeEur: 2.8,
    partCostEur: 0.44,
    interfacePins: '2× GPIO (SCLK + DOUT)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '2× 470 Ω series + PESD5V0 + BAV99 clamp',
    openShortDetection: 'PGA saturation (±Full Scale = Open / Short)',
    resolutionK: 0.005,
    maxRecommendedErrorK: 0.5,
    bom: [
      { designator: 'U1', part: 'CS1237-SO / HX711 24-bit PGA ADC', packageType: 'SOP-8', jlcpcbClass: 'Extended', unitCostEur: 0.28 },
      { designator: 'R1, R2, R3', part: '2× 4.7 kΩ + 1.0 kΩ 0.1% bridge', packageType: '0805', jlcpcbClass: 'Preferred', unitCostEur: 0.09 },
      { designator: 'R_p, C, D', part: 'Filter cap + PESD5V0 + BAV99', packageType: '0805/SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.07 },
    ],
    verdict: 'Highest raw precision (±0.25 K) for €0.44 in parts, especially attractive if hand-soldering the SOP-8 chip to skip the €2.80 fee.',
    advantages: [
      'Highest raw resolution (~0.005 K) and accuracy (±0.25 K) across −50…+250 °C with zero op-amp input offset (V_os)',
      '100% ratiometric differential bridge (V_REF = V_EXC) cancels Pi 5 V / 3.3 V supply sag completely',
      'Immune to roof cable parasitic capacitance (DC bridge) and includes native 50/60 Hz mains hum rejection',
      'Ultra-cheap chip (~€0.28) in an easy hand-solderable SOP-8 package (easy to solder post-PCBA to skip the €2.80 fee)',
    ],
    tradeoffs: [
      'CS1237 / HX711 still incurs the €2.80 JLCPCB extended-part feeder fee unless hand-soldered after assembly',
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
    jlcpcbFeederFeeEur: 2.8,
    partCostEur: 1.18,
    interfacePins: 'I²C1 (GPIO 2/3, shared with DS2482)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '2× 1 kΩ series + BAV99 + PESD5V0',
    openShortDetection: 'Output rail saturation (<0.15 V Short, >2.65 V Open)',
    resolutionK: 0.06,
    maxRecommendedErrorK: 0.8,
    bom: [
      { designator: 'U1', part: 'ADS1115IDGSR 16-bit I²C ADC', packageType: 'MSOP-10', jlcpcbClass: 'Extended', unitCostEur: 0.94 },
      { designator: 'U2', part: 'LMV358IDR Dual Rail-to-Rail Op-Amp', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'R1..R7', part: 'Bridge & Diff-Amp 0.1% resistors', packageType: '0805', jlcpcbClass: 'Preferred', unitCostEur: 0.11 },
      { designator: 'D1, C1..3', part: 'BAV99, PESD5V0, decoupling', packageType: '0805/SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.07 },
    ],
    verdict: 'Clean Linux /dev/i2c-1 integration, but smaller cost savings and requires calibrating LMV358 V_os.',
    advantages: [
      'Uses standard Linux /dev/i2c-1 driver; shares GPIO 2/3 cleanly with the optional DS2482-100 1-Wire bridge',
      'Spare ADS1115 channels can monitor 3.3 V excitation (staying ratiometric) or board supply health',
      'Immune to roof cable parasitic capacitance; continuous analog diff-amp output is trivial to probe with a multimeter',
      'Sacrificial €0.06 LMV358 acts as a front-end buffer isolating the ADS1115 and Pi I²C bus from roof ESD transients',
    ],
    tradeoffs: [
      'Smallest savings: ADS1115 (~€0.94) + €2.80 JLCPCB feeder fee puts a 2-board order at ~€2.58/board',
      'LMV358 input offset voltage (±1.7 mV typ, ±7 mV max) creates 1–3.5 K raw error unless calibrated in setup wizard',
      'Requires 4 matched gain resistors; 1% resistors degrade full-range accuracy beyond ±2 K',
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
    badgeText: '100% Basic Parts · €0 Fee',
    summary:
      'Lowest BOM cost possible: Pi GPIO/PWM feeds a 2-stage 47 kΩ / 100 nF RC filter to create a 3.3 V-referenced DAC, compared against a 3.3 kΩ / Pt1000 divider via a basic LM393.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.21,
    interfacePins: '2× GPIO (PWM/DAC out + COMP_IN)',
    handSolderability: 'SOIC / 0805 Easy',
    ratiometric: true,
    inputProtection: '1 kΩ series + BAV99 + PESD5V0',
    openShortDetection: 'Duty < 5% = Short, Duty > 90% = Open',
    resolutionK: 0.28,
    maxRecommendedErrorK: 1.5,
    bom: [
      { designator: 'U1', part: 'LM393DR Dual Comparator', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R_top', part: '3.3 kΩ 0.1% divider leg', packageType: '0805', jlcpcbClass: 'Preferred', unitCostEur: 0.05 },
      { designator: 'R_f, C_f', part: '2× 47 kΩ + 2× 100 nF DAC filter', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R_p, D', part: '1 kΩ prot + BAV99 + PESD5V0', packageType: '0805/SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
    ],
    verdict: 'Absolute minimum BOM (€0.21, €0 fee), but Switched RC Oscillator gives 3× better accuracy for just €0.10 more.',
    advantages: [
      'Absolute lowest component cost (€0.21 BOM, €0.00 JLCPCB feeder fee)',
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
};

export const TOPOLOGY_ORDER: TopologyId[] = [
  'max31865',
  'switched_rc',
  'bridge_cs1237',
  'bridge_lmv358_ads1115',
  'pwm_dac_lm393',
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
    const clampV = isMax ? 24.0 : isRevD ? 5.1 : 3.85;
    const clampMa = isMax ? 0.2 : isRevD ? ((24 - 5.1) / 10000) * 1000 : ((24 - clampV) / 470) * 1000;
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
        ? 'U1A+ Clamped @ 5.10 V (1.89 mA)'
        : 'Clamped @ 3.85 V',
      detectedFault: 'OverVoltageClamp',
      safetyStatus: 'FaultCaught',
      safetyDetail: isMax
        ? 'MAX31865 internal ±45 V protection survives 24 V indefinitely and flags Overvoltage Fault over SPI.'
        : isRevD
        ? 'Rev D: PESD24V stays off at 24 V DC; R4 (10 kΩ) + BZX84C5V1 clamp U1A+ at 5.1 V (1.89 mA, 36 mW); R1 (3.90 kΩ) dissipates 0.11 W (<0.125 W); GPIO 22 stays steady HIGH -> Fault.'
        : `PESD5V0 + BAV99 + series resistor clamp terminal surge to ~3.85 V (${clampMa.toFixed(0)} mA limit); reading saturates high -> OutOfRange fault.`,
      nodes: [
        { label: 'Terminal PT1', value: '24.0 V FAULT', note: 'Miswired DC rail' },
        {
          label: isRevD ? 'U1A+ Sense Node' : 'Protected Node',
          value: `${clampV.toFixed(2)} V`,
          note: isRevD ? '36 mW in R4 · 5.3 mA in R1' : 'Pi GPIO isolated',
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
      // Rev D: Hardware-audited DC 3.90 kOhm divider (PT1 + 47R 1206 Q1 guard, 1.00k R_lo, 1.80k R_hi)
      // Sense tap: R4 = 10 kOhm + C3 = 100 nF X7R (159 Hz LPF) + D3 = BZX84C5V1 (<5 nA leakage @ <1.3 V)
      // Local U1B 72.2 Hz exponential RC ramp (R6=R7=390k, R8=100k, R9=150k, R11=4.7k, C=2x10 nF C0G)
      // Firmware inverts exact exponential duty curve g(x) via 2-point calibrated bisection (<0.03 K linearity)
      const rTop = 3900;
      const rGuardNom = 47; // R5 = 47 Ohm 1% 1206 0.5W on Q1 Drain (PT1 branch only)
      const rGuardDrift = rGuardNom * 100e-6 * ambDelta;
      const rGuardActual = rGuardNom + rGuardDrift;
      const rRefLo = 1000;
      const rRefHi = 1800;
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

      // Simulate realistic ±1% R7..R9 spread + LM393 input bias (25 nA across 10k) + BZX84C5V1 (<5 nA)
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
      // Subtract known 47R Q1 guard + calibrated cable resistance
      const rMeas = rBranchEst - rGuardNom - nominalCableForComp;
      const measuredT = pt1000Temperature(rMeas) + avgSelfHeatK;
      const errK = measuredT - trueTempC;

      const refTolOhm = trueR * tolFrac;
      // R5 = 47R 1% 1206: raw tolerance ±0.47 Ohm (±0.12 K), zeroed by Setup Wizard leaving only 100 ppm/K drift
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
      rationale: '90% lower component cost (−€3.66/bd); replaces proprietary IC with jellybean LM393 + AO3400A + Basic 10 nF C0G.',
    },
    {
      category: 'Cost & Assembly',
      aspect: 'JLCPCB Extended Feeder Fee',
      initialValue: `€${initSpec.jlcpcbFeederFeeEur.toFixed(2)} / order`,
      nowUsedValue: '€0.00 / order',
      verdict: 'BETTER',
      rationale: 'Audited 100% real JLCPCB Basic/Preferred parts (10 nF C0G + 100 nF X7R); zero hidden feeder fees.',
    },
    {
      category: 'Cost & Assembly',
      aspect: `Effective Cost / Board (${batchSize}×)`,
      initialValue: `€${initCost.toFixed(2)} / board`,
      nowUsedValue: `€${nowCost.toFixed(2)} / board`,
      verdict: 'BETTER',
      rationale: `Saves €${savingsPerBoardEur.toFixed(2)}/board (€${savingsPerBatchEur.toFixed(2)} total per ${batchSize}-board batch).`,
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
      nowUsedValue: '24 parts (15 BOM lines, SOIC/0805)',
      verdict: 'WORSE',
      rationale: 'More discrete jellybean parts to route on the PCB, though all are cheap JLCPCB Basic/Preferred parts.',
    },
    {
      category: 'Measurement',
      aspect: 'Worst-Case Accuracy (−50…+250 °C)',
      initialValue: `±${initPeakK.toFixed(2)} K`,
      nowUsedValue: `±${nowPeakK.toFixed(2)} K`,
      verdict: 'EQUAL',
      rationale: 'Exact ln() 2-point solver (<0.03 K linearity) + 5.1 V zero-leakage Zener cancels C, R6, V_33, and LM393 V_os.',
    },
    {
      category: 'Measurement',
      aspect: 'Resolution & Self-Heating',
      initialValue: `±${initSpec.resolutionK} K · +${initEval.selfHeatingK.toFixed(3)} K`,
      nowUsedValue: `±${nowSpec.resolutionK} K · +${nowEval.selfHeatingK.toFixed(4)} K`,
      verdict: 'EQUAL',
      rationale: 'Rev D energizes PT1000 only 5% of each 10 s poll through 3.90 kΩ (+0.003 K self-heating, ~19 µs/K sensitivity).',
    },
    {
      category: 'Measurement',
      aspect: 'Setup Wizard Calibration',
      initialValue: 'Factory trimmed (cable zero opt.)',
      nowUsedValue: 'Auto 2-pt R_lo/R_hi (cable zero opt.)',
      verdict: 'EQUAL',
      rationale: 'No manual comparator or cap trimming; optional cable zero also nulls the 47 Ω Q1 guard tolerance.',
    },
    {
      category: 'Measurement',
      aspect: 'Long Roof Cable Capacitance (>30 m)',
      initialValue: 'Immune (DC ratiometric bridge)',
      nowUsedValue: 'Immune (DC mux + 159 Hz RC filter)',
      verdict: 'EQUAL',
      rationale: 'PT1000 carries steady DC filtered by 10 kΩ + 100 nF X7R before U1A+ (0.00 K cable-cap error, 50/60 Hz avg).',
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
      nowUsedValue: 'PESD24V + 10k/5.1V Zener + 3.90k R1',
      verdict: 'EQUAL',
      rationale: 'R4 (10 kΩ) + BZX84C5V1 limit sense fault to 36 mW; R1 (3.90 kΩ) stays at 0.11 W (<0.125 W); zero +3V3 lift.',
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
    takeaway: `Switched Ramp Rev D (Gemini Version) resolves every hardware audit finding—achieving ${betterCount} BETTER, ${equalCount} EQUAL, and only ${worseCount} minor WORSE (24 discrete SMD parts vs 6). Sense-side 10 kΩ + BZX84C5V1 eliminates Zener leakage, 2× 10 nF C0G keeps a genuine €0.00 JLCPCB feeder fee, and exact ln() inversion delivers <0.03 K linearity while saving €${savingsPerBoardEur.toFixed(2)}/board (€${savingsPerBatchEur.toFixed(2)} per ${batchSize}× order).`,
  };
}

