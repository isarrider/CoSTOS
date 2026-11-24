export type OutputTopologyId =
  | 'rev_a_tc4427_fallback'
  | 'rev_a_h3_baseline'
  | 'ucc27524_integrated'
  | 'gemini_rev_b_pushpull'
  | 'opto_pc817_isolated';

export type OutputFaultMode =
  | 'none'
  | 'pwm_gnd_short'
  | 'pwm_12v_miswire'
  | 'pwm_24v_miswire'
  | 'fb_24v_miswire'
  | 'rel_dead_short'
  | 'wd_tripped';

export type RelayLoadPreset = 'ssr_15ma' | 'coil_75ma' | 'coil_100ma';

export interface OutputSimParams {
  pwmFreqHz: number; // 100..1000 Hz (Grundfos/Wilo solar spec)
  pwmDutyPct: number; // 0..100 %
  vDrvV: number; // 5.0..12.0 V (Rev E Pump Supply = 8.5 V)
  cableLengthM: number; // 1..20 m
  pumpLoadMa: number; // 1..10 mA (typ 3 mA, max 7.5 mA)
  relayLoad: RelayLoadPreset;
  ambientTempC: number; // 0..65 degC
  activeFault: OutputFaultMode;
}

export const DEFAULT_OUTPUT_PARAMS: OutputSimParams = {
  pwmFreqHz: 500,
  pwmDutyPct: 60,
  vDrvV: 8.5,
  cableLengthM: 3,
  pumpLoadMa: 3.0,
  relayLoad: 'coil_75ma',
  ambientTempC: 50,
  activeFault: 'none',
};

export const RELAY_LOAD_PRESETS: Record<
  RelayLoadPreset,
  { label: string; currentMa: number; minPickupV: number; inductive: boolean }
> = {
  ssr_15ma: { label: 'DIN-Rail SSR (15 mA, 3–32 V)', currentMa: 15, minPickupV: 3.0, inductive: false },
  coil_75ma: { label: '5 V Relay Coil (75 mA, Omron G5LE)', currentMa: 75, minPickupV: 3.75, inductive: true },
  coil_100ma: { label: 'Heavy 5 V Relay Coil (100 mA)', currentMa: 100, minPickupV: 3.75, inductive: true },
};

export interface OutputBomItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Extended' | 'Manual';
  unitCostEur: number;
}

export interface OutputTopologySpec {
  id: OutputTopologyId;
  shortName: string;
  name: string;
  badge: string;
  recommended?: boolean;
  rSeriesOhm: number;
  esdCapPf: number;
  q7OutsideR9: boolean;
  hasShootThrough: boolean;
  readbackRatio: number; // R32 / (R31 + R32)
  hasReadbackClamp: boolean;
  fbRSeriesOhm: number;
  fbRPullupOhm: number;
  hasFbClamp: boolean;
  relayCurrentLimitMa: number | null; // null = unprotected
  flybackRatingMa: number;
  failsafeOpenOff: boolean;
  maxVoltageRatingV: number;
  jlcpcbFeederFeeEur: number;
  partsCostEur: number;
  partCount: number;
  verdict: string;
  failSafeProfile: string;
  softwareNote: string;
  pros: string[];
  cons: string[];
  bom: OutputBomItem[];
}

export const OUTPUT_TOPOLOGY_ORDER: OutputTopologyId[] = [
  'rev_a_tc4427_fallback',
  'rev_a_h3_baseline',
  'ucc27524_integrated',
  'gemini_rev_b_pushpull',
  'opto_pc817_isolated',
];

export const OUTPUT_TOPOLOGY_SPECS: Record<OutputTopologyId, OutputTopologySpec> = {
  rev_a_tc4427_fallback: {
    id: 'rev_a_tc4427_fallback',
    shortName: 'Rev A TC4427 Fallback',
    name: 'Rev A Fallback: 74LVC1G08 AND + TC4427 Push-Pull + Unprotected Q2 Relay',
    badge: 'LEGACY FALLBACK · 4 EXT PARTS',
    rSeriesOhm: 100,
    esdCapPf: 1100, // SMBJ13A
    q7OutsideR9: false,
    hasShootThrough: false,
    readbackRatio: 8.2 / (12.0 + 8.2),
    hasReadbackClamp: false,
    fbRSeriesOhm: 10000,
    fbRPullupOhm: 4700,
    hasFbClamp: false,
    relayCurrentLimitMa: null,
    flybackRatingMa: 150,
    failsafeOpenOff: true,
    maxVoltageRatingV: 22,
    jlcpcbFeederFeeEur: 11.2, // 74LVC1G08, TC4427, SMBJ13A, PESD5V0
    partsCostEur: 1.95,
    partCount: 24,
    verdict:
      'Proven stripboard push-pull driver with fast edges, but carries €11.20 in JLCPCB Extended fees (4 Extended parts), has a 22 V abs max on TC4427, overdrives Pi 5 GPIO6 readback above 8.1 V, and lacks relay short-circuit protection.',
    failSafeProfile:
      'Open-input fail-safe via R7 (100 kΩ) + 74LVC1G08 AND. However, TC4427 output is undefined below 4.5 V UVLO, R31/R32 (12k/8.2k) exceeds 3.3 V on GPIO6 when +V_DRV > 8.1 V, and a dead short on J4 REL1 pulls >15 A from Pi +5V.',
    softwareNote:
      'Hardware PWM on GPIO18 (Pin 12), open-collector 75 Hz feedback on GPIO23 (Pin 16), readback on GPIO6 (Pin 31), relay on GPIO25 (Pin 22). Identical software contract across options.',
    pros: [
      'True push-pull IC output (TC4427) with ~25 ns unloaded edges and low output impedance',
      'Separate 74LVC1G08 AND gate makes bench probing of WD_OK gating straightforward',
      'Matches legacy DIP-8 stripboard experience in CoSTOS HARDWARE.md',
    ],
    cons: [
      '4 Extended JLCPCB parts (74LVC1G08, TC4427, SMBJ13A, PESD5V0) add €11.20 fixed feeder fees',
      'R31/R32 (12k/8.2k) drives 3.45–4.87 V into Pi 5 GPIO6 at +V_DRV = 8.5–12 V (no clamp!)',
      'Unprotected AO3400A relay output (Q2) crashes Pi 5 on J4 terminal short; D6 1N4148W is undersized for 100 mA relay coils',
      'TC4427 absolute maximum is only 22 V (vulnerable to 24 V boiler-room miswiring) and undefined < 4.5 V',
    ],
    bom: [
      { designator: 'U4', part: '74LVC1G08 Single 2-Input AND', packageType: 'SOT-23-5', jlcpcbClass: 'Extended', unitCostEur: 0.14 },
      { designator: 'U6', part: 'TC4427A Dual 1.5A MOSFET Driver', packageType: 'SOIC-8', jlcpcbClass: 'Extended', unitCostEur: 0.95 },
      { designator: 'D4', part: 'SMBJ13A 600W TVS Diode', packageType: 'SMB', jlcpcbClass: 'Extended', unitCostEur: 0.22 },
      { designator: 'D17', part: 'PESD5V0S1BA Bidirectional ESD', packageType: 'SOD-323', jlcpcbClass: 'Extended', unitCostEur: 0.18 },
      { designator: 'Q2', part: 'AO3400A 30V 5.7A N-MOSFET (REL1)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D6,D7,D12', part: '1N4148W Flyback + 0805 LEDs', packageType: 'SOD-123/0805', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'R7,R9,R11-17,R31-32', part: 'Passives + 100R 1206 + Caps', packageType: '0805/1206', jlcpcbClass: 'Basic', unitCostEur: 0.36 },
    ],
  },

  rev_a_h3_baseline: {
    id: 'rev_a_h3_baseline',
    shortName: 'Rev A H3 Baseline',
    name: 'Rev A Default (H3): Discrete NPN/PNP Chain (Q7 Outside R9) + Unprotected Q2',
    badge: 'CURRENT REV A · 6 DEFECTS',
    rSeriesOhm: 100,
    esdCapPf: 1100, // SMBJ13A
    q7OutsideR9: true,
    hasShootThrough: true,
    readbackRatio: 8.2 / (12.0 + 8.2),
    hasReadbackClamp: false,
    fbRSeriesOhm: 10000,
    fbRPullupOhm: 4700,
    hasFbClamp: false,
    relayCurrentLimitMa: null,
    flybackRatingMa: 150,
    failsafeOpenOff: true,
    maxVoltageRatingV: 40,
    jlcpcbFeederFeeEur: 5.6, // SMBJ13A + PESD5V0
    partsCostEur: 0.86,
    partCount: 28,
    verdict:
      'Eliminates U4/U6 fees, but places Q7 (MMBT3904) directly on J2 OUTSIDE R9 (instantly vaporizing Q7 on +12V/+24V miswire when OFF), suffers Q6/Q7 falling-edge shoot-through & 60°C Q6 leakage at 12 V, overdrives Pi 5 GPIO6, and leaves J4 relay un-limited.',
    failSafeProfile:
      'Q4/Q5 series AND keeps pump off when WD_OK or PWM1 is low, BUT Q7 sits unprotected on J2 (zero series R!), Q6 leaks at 12 V/60°C (V_EB = 0.48 V), R31/R32 overdrives GPIO6 above 8.1 V, and a J4 short crashes Pi +5V.',
    softwareNote:
      'Standard GPIO18 PWM1, GPIO23 FB1, GPIO6 RB1, GPIO25 REL1. Readback RB1 violates Pi 5 RP1 3.3 V GPIO ceiling at +V_DRV = 8.5 V (Rev E pump supply).',
    pros: [
      'Replaces 74LVC1G08 + TC4427 with 40 V Basic SOT-23 transistors (cuts €5.60 in feeder fees vs Fallback)',
      'Simple conceptual series-AND (Q4 + Q5) for watchdog gating',
      'Active Q7 pull-down improves falling edge vs passive H2 resistor pull-down',
    ],
    cons: [
      'CRITICAL: Q7 (MMBT3904) sits OUTSIDE R9 directly on J2 PWM — +12V/+24V touch while OFF instantly destroys Q7!',
      'Q6 PNP never fully turns off at +12V / 60°C (R36/R35/R37 divider leaves V_EB = 0.48 V) + ~85 mA falling-edge shoot-through',
      'SMBJ13A (~1.1 nF!) + PESD5V0 still add €5.60 Extended fees and slow down edges',
      'R31 (12k)/R32 (8.2k) overdrives Pi 5 GPIO6 (> 3.45 V at 8.5 V, 4.87 V at 12 V); J4 relay short crashes Pi +5V',
    ],
    bom: [
      { designator: 'Q4,Q6,Q7', part: '2x MMBT3904 + 1x MMBT3906 (H3)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'Q2,Q5', part: 'AO3400A N-MOSFET (WD Switch & REL1)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
      { designator: 'D4', part: 'SMBJ13A 600W TVS Diode', packageType: 'SMB', jlcpcbClass: 'Extended', unitCostEur: 0.22 },
      { designator: 'D17', part: 'PESD5V0S1BA ESD Diode (FB1)', packageType: 'SOD-323', jlcpcbClass: 'Extended', unitCostEur: 0.18 },
      { designator: 'D6,D7,D12', part: '1N4148W Flyback + 0805 LEDs', packageType: 'SOD-123/0805', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'R7,R9,R11-17,R31-38', part: 'Passives + 100R 1206 + Caps', packageType: '0805/1206', jlcpcbClass: 'Basic', unitCostEur: 0.26 },
    ],
  },

  ucc27524_integrated: {
    id: 'ucc27524_integrated',
    shortName: 'UCC27524 Enable IC',
    name: 'Option C: TI UCC27524 Integrated Enable Driver + SMBJ13A + PTC Relay',
    badge: 'REJECTED · UNSAFE DEFAULT',
    rSeriesOhm: 100,
    esdCapPf: 1100,
    q7OutsideR9: false,
    hasShootThrough: false,
    readbackRatio: 10.0 / (22.0 + 10.0),
    hasReadbackClamp: true,
    fbRSeriesOhm: 2200,
    fbRPullupOhm: 22000,
    hasFbClamp: true,
    relayCurrentLimitMa: 200, // PTC hold
    flybackRatingMa: 1000,
    failsafeOpenOff: false, // ENA/ENB have internal pull-ups!
    maxVoltageRatingV: 20,
    jlcpcbFeederFeeEur: 11.2, // UCC27524, SMBJ13A, PESD5V0, PTC
    partsCostEur: 2.35,
    partCount: 22,
    verdict:
      'Combines gating and 5 A push-pull driving in one SOIC-8, but violates the core CoSTOS safety invariant: ENA/ENB pins have internal pull-UPs ("missing part = pump ON"), adds €11.20 Extended fees, and tops out at 20 V abs max.',
    failSafeProfile:
      'FAIL-SAFE VIOLATION: UCC27524 ENA/ENB pins default HIGH via internal pull-up. A missing pull-down resistor + broken WD_OK trace leaves the solar pump running continuously during watchdog failure.',
    softwareNote:
      'Standard GPIO18/23/6/25 mapping. Harder to bench-audit because watchdog ANDing happens inside the driver silicon.',
    pros: [
      'Single SOIC-8 combines watchdog gating and dual-channel push-pull (supports future PUMP2 cleanly)',
      'Built-in 3.8 V UVLO holds output low during brown-out',
      'Fast ~20 ns transitions with zero external shoot-through',
    ],
    cons: [
      'SAFETY VIOLATION: ENA/ENB pins default ENABLED (internal pull-up) — violates "open/missing = stop" rule',
      '4 Extended parts (UCC27524, SMBJ13A, PESD5V0, PTC) add €11.20 JLCPCB feeder fees',
      '20 V absolute max supply rating leaves minimal margin against 24 V boiler-room miswiring',
      'Shared PTC on +5V_REL has ~1.5 A trip surge (brown-outs Pi 5 before tripping)',
    ],
    bom: [
      { designator: 'U6', part: 'UCC27524DR Dual 5A Driver w/ EN', packageType: 'SOIC-8', jlcpcbClass: 'Extended', unitCostEur: 1.25 },
      { designator: 'D4', part: 'SMBJ13A 600W TVS Diode', packageType: 'SMB', jlcpcbClass: 'Extended', unitCostEur: 0.22 },
      { designator: 'D17', part: 'PESD5V0S1BA ESD Diode', packageType: 'SOD-323', jlcpcbClass: 'Extended', unitCostEur: 0.18 },
      { designator: 'F3', part: '200mA Hold SMD PTC (REL1)', packageType: '1206', jlcpcbClass: 'Extended', unitCostEur: 0.24 },
      { designator: 'Q2,D6', part: 'AO3400A + SS14 Flyback', packageType: 'SOT-23/SMA', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
      { designator: 'R,C,LED', part: 'Passives + Readback + LEDs', packageType: '0805/1206', jlcpcbClass: 'Basic', unitCostEur: 0.38 },
    ],
  },

  gemini_rev_b_pushpull: {
    id: 'gemini_rev_b_pushpull',
    shortName: 'Rev B (Gemini Push-Pull)',
    name: 'Rev B (Gemini Version): Complementary Push-Pull Inside R9 + Active-Limited REL1/REL2',
    badge: 'RECOMMENDED · 100% BASIC (€0 FEE)',
    recommended: true,
    rSeriesOhm: 220, // 220 Ohm 1206 0.5 W OUTSIDE Q6/Q7!
    esdCapPf: 8, // 2x 1N4148W (4 pF each)
    q7OutsideR9: false,
    hasShootThrough: false, // Class-B complementary emitter-follower has natural 1.3 V deadband!
    readbackRatio: 10.0 / (22.0 + 10.0),
    hasReadbackClamp: true,
    fbRSeriesOhm: 2200,
    fbRPullupOhm: 22000,
    hasFbClamp: true,
    relayCurrentLimitMa: 138, // 0.65 V / 4.7 Ohm active foldback via MMBT3904
    flybackRatingMa: 1000, // SS14 1A 40V Schottky Basic
    failsafeOpenOff: true,
    maxVoltageRatingV: 40,
    jlcpcbFeederFeeEur: 0.0,
    partsCostEur: 0.56,
    partCount: 33,
    verdict:
      'Fixes all 6 Rev A defects with 100% JLCPCB Basic parts (€0.00 feeder fee): zero-shoot-through Class-B emitter-follower (Q6/Q7) protected INSIDE R9 (220 Ω 0.5 W), 0.24 µs edges (16× margin), Pi-5-safe clamped readback/feedback, SS14 1 A relay flyback, and 138 mA active short-proof REL1/REL2.',
    failSafeProfile:
      'Strict open-circuit = OFF across Q4 (PWM), Q5 (WD_OK), and Q8 (hard-off PNP). Class-B Q6/Q7 emitter-follower cannot shoot through by physics. R9 (220 Ω 0.5 W) sits at J2 protecting Q6/Q7 from GND shorts and +12V/+24V miswires; Q2_LIM caps J4 shorts at 138 mA without browning out Pi 5.',
    softwareNote:
      '100% drop-in compatible with CoSTOS GPIO18 (PWM1), GPIO23 (FB1), GPIO6 (RB1), GPIO25 (REL1), and GPIO5 (REL2). Zero config.txt or costos-hw-linux changes required.',
    pros: [
      '100% JLCPCB Basic BOM (€0.00 feeder fees — saves €5.60 vs Rev A H3 and €11.20 vs TC4427)',
      'ZERO shoot-through by physics (Class-B Q6 MMBT3904 + Q7 MMBT3906 emitter-follower with 1.3 V deadband) & hard-off Q8 at 60°C',
      'R9 (220 Ω 1206 0.5 W) sits OUTSIDE Q6/Q7: survives indefinite GND short (35 mA, 0.27 W) AND +12V/+24V miswires safely',
      '0.24 µs rise/fall edges (no 1.1 nF SMBJ load!) — 16× faster than Grundfos/Wilo 4.0 µs T/500 rule up to 1000+ Hz',
      'Clamped R31/R32 (22k/10k + 1N4148W) & R12/R11 (2.2k/22k + dual 1N4148W) keep Pi 5 GPIO6 & GPIO23 <= 3.60 V even at +24 V',
      'Active 138 mA current-limited REL1/REL2 (AO3400A + MMBT3904 + 4.7 Ω + SS14 1A) survives dead J4 shorts without rebooting Pi 5',
    ],
    cons: [
      'Output high sits one V_BE below +V_DRV (~7.7 V at 8.5 V Rev E; 7.0 V at 3 mA pump load — still +3.0 V above 4.0 V V_IH)',
      'Adds 5 tiny SOT-23/0805 Basic parts vs Rev A H3 (~€0.09 total part cost, €0.00 setup fee)',
      'Active pull-down hands off below ~0.65 V to R38 (4.7 kΩ) — already well below 1.0 V pump V_IL and 1.1 V opto threshold',
    ],
    bom: [
      { designator: 'Q4,Q6,Q2L', part: 'MMBT3904 NPN 40V (AND / Hi-EF / Rel-Lim)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'Q7,Q8', part: 'MMBT3906 PNP 40V (Lo-EF / Pre-Driver)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'Q5', part: '2N7002 60V N-MOSFET (WD_OK Gate)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'Q2', part: 'AO3400A 30V 5.7A N-MOSFET (REL1)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'D4a-b,D17a-b,D18', part: '1N4148W 4pF ESD/Clamp Diodes (5x)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.06 },
      { designator: 'D6', part: 'SS14 40V 1A Schottky Flyback (REL1)', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R9,R12,R2S', part: '220R, 2.2k, 4.7R 1206 0.5W Surge/Sense', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.09 },
      { designator: 'R7..R38,C9,LEDs', part: '0805 Basic Resistors, 10nF Cap & LEDs', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.21 },
    ],
  },

  opto_pc817_isolated: {
    id: 'opto_pc817_isolated',
    shortName: 'PC817C Opto-Isolated',
    name: 'Option E: PC817C Opto-Isolated PWM + Feedback + AO3400A Relay',
    badge: 'SLOW EDGES · CTR AGING',
    rSeriesOhm: 100,
    esdCapPf: 120,
    q7OutsideR9: false,
    hasShootThrough: false,
    readbackRatio: 10.0 / (22.0 + 10.0),
    hasReadbackClamp: true,
    fbRSeriesOhm: 2200,
    fbRPullupOhm: 22000,
    hasFbClamp: true,
    relayCurrentLimitMa: 138,
    flybackRatingMa: 1000,
    failsafeOpenOff: true,
    maxVoltageRatingV: 35,
    jlcpcbFeederFeeEur: 5.6, // PC817C (if SMD Extended) + extra opto
    partsCostEur: 1.35,
    partCount: 26,
    verdict:
      'Provides galvanic isolation on PWM/FB, but PC817 phototransistor fall time (~12–18 µs) violates the Grundfos/Wilo T/500 edge rule (<= 4 µs at 500 Hz) and suffers LED CTR degradation over 10+ years at 60 °C boiler-room heat.',
    failSafeProfile:
      'LED off = phototransistor off (fail-safe stop), and protects Pi against high common-mode ground loops. However, Grundfos/Wilo pumps ALREADY include an internal optocoupler on their PWM input, making a second slow opto redundant.',
    softwareNote:
      'Works on GPIO18/23/6/25, but PWM frequency must be capped <= 150 Hz to avoid duty distortion from asymmetric PC817 rise/fall times.',
    pros: [
      'Galvanic isolation (> 2.5 kV) on PWM and FB signal paths',
      'Immune to +24 V miswire reaching Raspberry Pi GPIOs',
      'Simple LED-off = pump-stop fail-safe logic',
    ],
    cons: [
      'FAILS EDGE RULE: PC817 fall time (~12–18 µs) exceeds <= 4.0 µs limit at 500 Hz (distorts low-duty solar speed)',
      'Redundant: Grundfos UPM3 and Wilo Para pumps ALREADY have internal opto-isolated PWM inputs!',
      'Optocoupler CTR degrades 30–50% over 10 years at 50–60 °C boiler-room ambient',
      'Adds €5.60 Extended assembly fees and still needs isolated or +V_DRV secondary rail',
    ],
    bom: [
      { designator: 'U11,U12', part: '2x EL817C / PC817C Phototransistor Opto', packageType: 'SOP-4', jlcpcbClass: 'Extended', unitCostEur: 0.44 },
      { designator: 'Q2,Q2L,Q5', part: 'AO3400A + MMBT3904 + 2N7002', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.12 },
      { designator: 'D6,D4a-b', part: 'SS14 Flyback + 1N4148W Clamps', packageType: 'SMA/SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.10 },
      { designator: 'R,C,LED', part: 'Passives + 100R 1206 + Caps + LEDs', packageType: '0805/1206', jlcpcbClass: 'Basic', unitCostEur: 0.69 },
    ],
  },
};

export interface OutputEvalResult {
  topologyId: OutputTopologyId;
  // PWM signal performance
  vHighNoLoadV: number;
  vHighAtPumpV: number;
  vLowAtPumpV: number;
  tRiseUs: number;
  tFallUs: number;
  edgeLimitUs: number; // T / 500
  edgeRulePass: boolean;
  shootThroughMa: number;
  q6LeakAtTempV: number;
  // Readback & Feedback
  readbackPiV: number;
  readbackSafe: boolean;
  fbVolAtPiV: number;
  // Relay performance
  relayVoutV: number;
  relayPickupMarginV: number;
  relayShortCurrentMa: number;
  q2ShortPowerW: number;
  q2ShortTjC: number;
  // Fault outcome
  faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL';
  faultPiGpioPeakV: number;
  faultPartStressNote: string;
  piBrownoutRisk: boolean;
}

export function outputPerBoardCostEur(spec: OutputTopologySpec, batchSize: 2 | 5): number {
  return spec.partsCostEur + spec.jlcpcbFeederFeeEur / batchSize;
}

export function evaluateOutputStage(
  topologyId: OutputTopologyId,
  params: OutputSimParams
): OutputEvalResult {
  const spec = OUTPUT_TOPOLOGY_SPECS[topologyId];
  const relayPreset = RELAY_LOAD_PRESETS[params.relayLoad];
  const cableCapPf = params.cableLengthM * 100; // ~100 pF/m shielded control cable
  const totalCapPf = cableCapPf + spec.esdCapPf;
  const edgeLimitUs = 1_000_000 / params.pwmFreqHz / 500; // T / 500 in us (4.0 us @ 500 Hz)

  // Effective V_BE at boiler-room ambient (-2 mV/degC from 0.68 V @ 25 degC)
  const vBeTemp = Math.max(0.45, 0.68 - (params.ambientTempC - 25) * 0.002);

  // 1. High / Low PWM voltages & Edge times
  let vHighNoLoadV = params.vDrvV;
  let vLowAtPumpV = 0.08;
  let tRiseUs = 0.2;
  let tFallUs = 0.2;
  let shootThroughMa = 0;
  let q6LeakAtTempV = 0;

  if (topologyId === 'rev_a_tc4427_fallback' || topologyId === 'ucc27524_integrated') {
    vHighNoLoadV = params.vDrvV - 0.1;
    vLowAtPumpV = 0.05;
    // Driven through R9 (100 Ohm) into SMBJ13A (~1100 pF) + cable
    const tauUs = ((spec.rSeriesOhm + 8) * totalCapPf) * 1e-6;
    tRiseUs = 0.025 + 2.2 * tauUs;
    tFallUs = 0.025 + 2.2 * tauUs;
  } else if (topologyId === 'rev_a_h3_baseline') {
    // Q6 MMBT3906 saturated PNP -> R9 100R -> J2 (with Q7 outside R9)
    vHighNoLoadV = params.vDrvV - 0.15;
    // Q6 E-B divider when Q4/Q5 OFF: R36(2.2k) / (2.2k + 2.7k + 47k) * (V_DRV - vBe)
    q6LeakAtTempV = ((params.vDrvV - vBeTemp) * 2.2) / 51.9;
    vLowAtPumpV = 0.12;
    // Rising edge: R9 (100R) into SMBJ13A + cable
    tRiseUs = 0.12 + 2.2 * (spec.rSeriesOhm * totalCapPf * 1e-6);
    // Falling edge: Q7 base current limited by R36+R35+R37 (51.9k) -> I_B ~ (V_DRV-0.7)/51.9k -> I_C_sat ~ 40 * I_B
    const ibQ7Ma = Math.max(0.05, (params.vDrvV - vBeTemp) / 51.9);
    const icQ7Ma = ibQ7Ma * 45; // worst-case h_FE at cold/low-current
    tFallUs = 0.35 + (totalCapPf * 1e-6 * params.vDrvV * 0.8) / Math.max(1, icQ7Ma);
    // Shoot-through during Q6 storage time (t_s ~ 300 ns) through R9 (100 Ohm)
    shootThroughMa = Math.round((params.vDrvV / spec.rSeriesOhm) * 1000);
  } else if (topologyId === 'gemini_rev_b_pushpull') {
    // Q8 (MMBT3906 sat 0.15V) -> Q6 (MMBT3904 emitter follower, -vBe) -> R9 (220R) -> J2
    vHighNoLoadV = Math.max(0, params.vDrvV - 0.15 - vBeTemp);
    // Q7 (MMBT3906 emitter follower) pulls down to ~vBe in <0.2us, then R38 (4.7k) settles to 0V
    vLowAtPumpV = 0.08;
    const tauUs = ((spec.rSeriesOhm + 12) * totalCapPf) * 1e-6;
    tRiseUs = 0.09 + 2.2 * tauUs;
    tFallUs = 0.12 + 2.2 * tauUs;
    shootThroughMa = 0; // Inherent 1.3 V Class-B deadband
    q6LeakAtTempV = 0; // R36 (4.7k) holds Q8 hard OFF (0.00 V)
  } else {
    // PC817C opto-isolated: slow phototransistor turn-off into 2.2 kOhm pull-down
    vHighNoLoadV = Math.max(0, params.vDrvV - 0.3);
    vLowAtPumpV = 0.15;
    tRiseUs = 4.2 + 2.2 * (spec.rSeriesOhm * totalCapPf * 1e-6);
    tFallUs = 12.8 + 2.2 * (2200 * totalCapPf * 1e-6);
  }

  const vHighAtPumpV =
    params.activeFault === 'wd_tripped'
      ? spec.failsafeOpenOff
        ? 0.0
        : Math.max(0, vHighNoLoadV - (params.pumpLoadMa / 1000) * spec.rSeriesOhm)
      : Math.max(0, vHighNoLoadV - (params.pumpLoadMa / 1000) * spec.rSeriesOhm);

  const edgeRulePass = Math.max(tRiseUs, tFallUs) <= edgeLimitUs;

  // 2. Readback RB1 (GPIO 6) & Feedback FB1 (GPIO 23)
  const rawReadbackV = vHighAtPumpV * spec.readbackRatio;
  const readbackPiV = spec.hasReadbackClamp ? Math.min(3.55, rawReadbackV) : rawReadbackV;
  const readbackSafe = rawReadbackV <= 3.35 || spec.hasReadbackClamp;

  // Pump open-collector pulls J2 FB to 0.20 V
  const fbVolAtPiV =
    topologyId === 'rev_a_tc4427_fallback' || topologyId === 'rev_a_h3_baseline'
      ? 0.2 // R11 (4.7k) is on J2 side BEFORE R12 (10k) in Rev A
      : 0.2 + ((3.3 - 0.2) * spec.fbRSeriesOhm) / (spec.fbRSeriesOhm + spec.fbRPullupOhm);

  // 3. Relay Driver (Q2 AO3400A on +5V_REL = 4.95 V)
  const vRelRail = params.activeFault === 'wd_tripped' ? 0.0 : 4.95;
  const rSenseOhm = spec.relayCurrentLimitMa ? 0.65 / (spec.relayCurrentLimitMa / 1000) : 0;
  const relayDropV = (relayPreset.currentMa / 1000) * (0.04 + rSenseOhm);
  const relayVoutV = Math.max(0, vRelRail - relayDropV);
  const relayPickupMarginV = relayVoutV - relayPreset.minPickupV;

  // Temperature-adjusted active short-circuit limit on J4 REL1
  const relayShortCurrentMa = spec.relayCurrentLimitMa
    ? Math.round((vBeTemp / rSenseOhm) * 1000)
    : 15000; // Unprotected AO3400A + AO3401A dead short (> 15 A surge!)
  const q2ShortPowerW = spec.relayCurrentLimitMa
    ? ((4.95 - vBeTemp) * relayShortCurrentMa) / 1000
    : 22.0; // Welds SOT-23 / crashes Pi
  const q2ShortTjC = Math.min(350, params.ambientTempC + q2ShortPowerW * 110);

  // 4. Fault Injection Evaluation
  let faultVerdict: 'PASS' | 'MARGINAL' | 'FAIL' = 'PASS';
  let faultPiGpioPeakV = readbackPiV;
  let faultPartStressNote = 'Nominal operation — all devices within SOA & Pi 5 GPIO limits.';
  let piBrownoutRisk = false;

  if (params.activeFault === 'none') {
    if (!edgeRulePass) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `Edge time (${Math.max(tRiseUs, tFallUs).toFixed(2)} us) exceeds Grundfos/Wilo T/500 limit (${edgeLimitUs.toFixed(2)} us @ ${params.pwmFreqHz} Hz).`;
    } else if (!readbackSafe) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `RB1 divider drives ${rawReadbackV.toFixed(2)} V (> 3.3 V!) into Pi 5 GPIO6 at +V_DRV = ${params.vDrvV.toFixed(1)} V.`;
    } else if (spec.q7OutsideR9 && q6LeakAtTempV >= vBeTemp - 0.04) {
      faultVerdict = 'MARGINAL';
      faultPartStressNote = `Q6 V_EB = ${q6LeakAtTempV.toFixed(2)} V approaches V_BE(on)=${vBeTemp.toFixed(2)} V at ${params.ambientTempC} °C — partial Q6/Q7 conduction risk!`;
    } else if (vHighAtPumpV < 4.0) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `Pump PWM V_HIGH (${vHighAtPumpV.toFixed(2)} V) drops below 4.0 V Grundfos/Wilo V_IH minimum.`;
    } else if (relayPreset.inductive && spec.flybackRatingMa < 300) {
      faultVerdict = 'MARGINAL';
      faultPartStressNote = `D6 (1N4148W, 150 mA) has thin flyback surge margin for inductive ${relayPreset.currentMa} mA relay coil (use SS14 1 A).`;
    }
  } else if (params.activeFault === 'pwm_gnd_short') {
    const iShortMa = (vHighNoLoadV / spec.rSeriesOhm) * 1000;
    const pR9W = (vHighNoLoadV * vHighNoLoadV) / spec.rSeriesOhm;
    if (pR9W <= 0.52) {
      faultVerdict = 'PASS';
      faultPartStressNote = `R9 (${spec.rSeriesOhm} Ohm 0.5 W) limits J2 GND short to ${iShortMa.toFixed(0)} mA (${pR9W.toFixed(2)} W <= 0.50 W) — indefinite survival!`;
    } else {
      faultVerdict = 'MARGINAL';
      faultPartStressNote = `R9 (${spec.rSeriesOhm} Ohm) dissipates ${pR9W.toFixed(2)} W (> 0.50 W continuous!) at ${iShortMa.toFixed(0)} mA under 100% duty short.`;
    }
  } else if (params.activeFault === 'pwm_12v_miswire') {
    faultPiGpioPeakV = spec.hasReadbackClamp ? 3.55 : 12.0 * spec.readbackRatio;
    if (spec.q7OutsideR9) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `Q7 (MMBT3904) sits OUTSIDE R9 directly on J2 — +12 V while pump OFF vaporizes Q7 (>2 A) & RB1 drives ${faultPiGpioPeakV.toFixed(2)} V into Pi GPIO6!`;
    } else if (!spec.hasReadbackClamp) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `Unclamped RB1 divider drives ${faultPiGpioPeakV.toFixed(2)} V directly into Pi 5 GPIO6 (damages RP1 silicon)!`;
    } else {
      const iFaultMa = ((12.0 - 0.7) / spec.rSeriesOhm) * 1000;
      faultVerdict = 'PASS';
      faultPartStressNote = `R9 (${spec.rSeriesOhm} Ohm) limits +12 V miswire to ${iFaultMa.toFixed(0)} mA inside Q6/Q7 SOA; D18 clamps RB1 GPIO6 to 3.55 V.`;
    }
  } else if (params.activeFault === 'pwm_24v_miswire') {
    faultPiGpioPeakV = spec.hasReadbackClamp ? 3.6 : 24.0 * spec.readbackRatio;
    if (spec.q7OutsideR9) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `CATASTROPHIC: Q7 outside R9 explodes immediately & unclamped RB1 drives ${faultPiGpioPeakV.toFixed(1)} V into Pi 5 GPIO6!`;
    } else if (spec.maxVoltageRatingV < 24 || !spec.hasReadbackClamp) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `Driver IC abs max (${spec.maxVoltageRatingV} V) / unclamped RB1 (${faultPiGpioPeakV.toFixed(1)} V) fails on +24 V boiler-room miswire!`;
    } else {
      const iFaultMa = ((24.0 - 0.7) / spec.rSeriesOhm) * 1000;
      faultVerdict = 'PASS';
      faultPartStressNote = `40 V Q6/Q7 stay within 200 mA SOA (${iFaultMa.toFixed(0)} mA via R9=${spec.rSeriesOhm} Ohm); D18 clamps Pi GPIO6 <= 3.60 V (<1 mA).`;
    }
  } else if (params.activeFault === 'fb_24v_miswire') {
    if (spec.hasFbClamp) {
      faultPiGpioPeakV = 3.6;
      const iFbMa = (24.0 - 3.9) / (spec.fbRSeriesOhm / 1000);
      const pFbW = ((24.0 - 3.9) * (24.0 - 3.9)) / spec.fbRSeriesOhm;
      faultVerdict = 'PASS';
      faultPartStressNote = `R12 (2.2k 0.5 W) limits +24 V FB fault to ${iFbMa.toFixed(1)} mA (${pFbW.toFixed(2)} W); D17a steers to +3V3 holding GPIO23 <= 3.60 V.`;
    } else {
      faultPiGpioPeakV = 6.8;
      faultVerdict = 'FAIL';
      faultPartStressNote = `PESD5V0 clamps at ~6.8 V (above 3.3 V!), back-feeding +3V3 via R11 (4.7k) and over-stressing GPIO23.`;
    }
  } else if (params.activeFault === 'rel_dead_short') {
    if (spec.relayCurrentLimitMa === null) {
      faultVerdict = 'FAIL';
      piBrownoutRisk = true;
      faultPartStressNote = `UNPROTECTED J4 SHORT: >15 A surge through Q12/Q2 immediately browns out Raspberry Pi 5 +5V rail and welds AO3400A!`;
    } else if (topologyId === 'ucc27524_integrated') {
      faultVerdict = 'MARGINAL';
      piBrownoutRisk = true;
      faultPartStressNote = `PTC requires ~1.5 A surge for ~150 ms to trip — risks Pi 5 +5V brown-out before opening.`;
    } else {
      faultVerdict = 'PASS';
      piBrownoutRisk = false;
      faultPartStressNote = `Active Q2_LIM + 4.7 Ohm folds J4 short cleanly to ${relayShortCurrentMa} mA (P_Q2=${q2ShortPowerW.toFixed(2)} W, T_J=${q2ShortTjC.toFixed(0)} °C) — zero Pi reboot!`;
    }
  } else if (params.activeFault === 'wd_tripped') {
    if (!spec.failsafeOpenOff) {
      faultVerdict = 'FAIL';
      faultPartStressNote = `FAIL-SAFE BREACH: UCC27524 internal ENA pull-up can leave pump RUNNING if WD_OK trace opens!`;
    } else {
      faultVerdict = 'PASS';
      faultPartStressNote = `WD_OK = 0 V cuts Q5 (PWM = 0.00 V) and Q12 (+5V_REL = 0.00 V) simultaneously regardless of Pi GPIO state.`;
    }
  }

  return {
    topologyId,
    vHighNoLoadV,
    vHighAtPumpV,
    vLowAtPumpV,
    tRiseUs,
    tFallUs,
    edgeLimitUs,
    edgeRulePass,
    shootThroughMa,
    q6LeakAtTempV,
    readbackPiV,
    readbackSafe,
    fbVolAtPiV,
    relayVoutV,
    relayPickupMarginV,
    relayShortCurrentMa,
    q2ShortPowerW,
    q2ShortTjC,
    faultVerdict,
    faultPiGpioPeakV,
    faultPartStressNote,
    piBrownoutRisk,
  };
}

export interface FreqSweepPoint {
  freqHz: number;
  limitUs: number;
  revBEdgeUs: number;
  revAH3EdgeUs: number;
  tc4427EdgeUs: number;
  pc817EdgeUs: number;
}

export function computeOutputFreqSweep(params: OutputSimParams): FreqSweepPoint[] {
  const freqs = [100, 150, 200, 300, 400, 500, 600, 750, 900, 1000, 1200];
  return freqs.map((freqHz) => {
    const p: OutputSimParams = { ...params, pwmFreqHz: freqHz, activeFault: 'none' };
    const revB = evaluateOutputStage('gemini_rev_b_pushpull', p);
    const revA = evaluateOutputStage('rev_a_h3_baseline', p);
    const tc = evaluateOutputStage('rev_a_tc4427_fallback', p);
    const opto = evaluateOutputStage('opto_pc817_isolated', p);
    return {
      freqHz,
      limitUs: Number(revB.edgeLimitUs.toFixed(2)),
      revBEdgeUs: Number(Math.max(revB.tRiseUs, revB.tFallUs).toFixed(2)),
      revAH3EdgeUs: Number(Math.max(revA.tRiseUs, revA.tFallUs).toFixed(2)),
      tc4427EdgeUs: Number(Math.max(tc.tRiseUs, tc.tFallUs).toFixed(2)),
      pc817EdgeUs: Number(Math.min(18, Math.max(opto.tRiseUs, opto.tFallUs)).toFixed(2)),
    };
  });
}
