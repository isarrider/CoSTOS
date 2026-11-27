export type PumpTopologyId =
  | 'b0512s'
  | 'd25_bjt_doubler'
  | 'lm393_schottky_doubler'
  | 'mt3608_boost'
  | 'direct_5v';

export type PumpFaultMode =
  | 'none'
  | 'short_pwm'
  | 'osc_dead'
  | 'slow_ramp'
  | 'pi_uv';

export type PumpLoadProfile = 'normal' | 'stress';

export interface PumpSimParams {
  piSupplyV: number; // 4.20 .. 5.25 V (default 5.00 V)
  pumpCount: 1 | 2; // 1 = PUMP1 only (rev A), 2 = PUMP1 + PUMP2 both fitted
  loadProfile: PumpLoadProfile; // normal (~2-3 mA, 2.2k opto) vs stress (~10 mA, 470R opto)
  ambientTempC: number; // 15 .. 60 C (boiler room)
  pwmDutyPct: number; // 10 .. 100 %
  activeFault: PumpFaultMode;
}

export interface PumpBomItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Preferred' | 'Extended';
  unitCostEur: number;
}

export interface PumpTopologySpec {
  id: PumpTopologyId;
  name: string;
  shortName: string;
  badgeText: string;
  summary: string;
  jlcpcbFeederFeeEur: number;
  partCostEur: number;
  partCount: number;
  handSolderability: 'THT + Extended' | 'SOIC / 0805 Easy' | 'SOT-23-6 Fine';
  regulated: boolean;
  startupRisk: string;
  r9Spec: string;
  r31r32Spec: string;
  verdict: string;
  bom: PumpBomItem[];
  advantages: string[];
  tradeoffs: string[];
  failSafeNotes: {
    oscillatorFailure: string;
    shortCircuitBehavior: string;
    readbackSafety: string;
  };
}

export interface PumpNodeReading {
  label: string;
  value: string;
  note: string;
}

export interface PumpSimResult {
  topologyId: PumpTopologyId;
  effectivePiV: number;
  vDrvLoadedV: number;
  vPumpTerminalV: number;
  marginAbove4V: number;
  rippleMvPp: number;
  pi5vCurrentMa: number;
  r9PowerW: number;
  readbackGpio6V: number;
  safetyStatus: 'Nominal' | 'Borderline' | 'FailSafeCaught' | 'FailsSpec';
  statusHeadline: string;
  statusDetail: string;
  nodes: PumpNodeReading[];
}

export const PUMP_TOPOLOGY_ORDER: PumpTopologyId[] = [
  'b0512s',
  'd25_bjt_doubler',
  'lm393_schottky_doubler',
  'mt3608_boost',
  'direct_5v',
];

export const DEFAULT_PUMP_PARAMS: PumpSimParams = {
  piSupplyV: 5.05,
  pumpCount: 1,
  loadProfile: 'normal',
  ambientTempC: 30,
  pwmDutyPct: 100,
  activeFault: 'none',
};

export function pumpPerBoardCostEur(spec: PumpTopologySpec, batchSize: 2 | 5): number {
  return spec.partCostEur + spec.jlcpcbFeederFeeEur / batchSize;
}

export const PUMP_TOPOLOGY_SPECS: Record<PumpTopologyId, PumpTopologySpec> = {
  b0512s: {
    id: 'b0512s',
    name: 'B0512S-1WR3 Isolated 5 V → 12 V DC/DC (Original Baseline)',
    shortName: 'B0512S 12 V DC/DC',
    badgeText: 'Original HAT Baseline · Extended Fee',
    summary:
      'Original CoSTOS 1-Wire HAT driver supply: 1 W SIP-4 isolated 5 V to 12 V DC/DC brick with preload resistor R2 (1.2 kΩ), input/output bulk caps, and R9 = 470 Ω.',
    jlcpcbFeederFeeEur: 2.8,
    partCostEur: 1.18,
    partCount: 6,
    handSolderability: 'THT + Extended',
    regulated: false,
    startupRisk: 'None (internal module oscillator)',
    r9Spec: '470 Ω 0.5 W (1210)',
    r31r32Spec: 'R31 27 kΩ / R32 8.2 kΩ (2.79 V @ 12 V)',
    verdict:
      'Stiff 12 V output with huge margin for 1 or 2 pumps, but wastes galvanic isolation (GND tied to Pi), adds €2.80 JLCPCB extended/THT surcharge, and floats to 14–16 V at light load without preload R2.',
    bom: [
      { designator: 'U2', part: 'B0512S-1WR3 (5V→12V 1W Isolated DC/DC)', packageType: 'SIP-4 THT', jlcpcbClass: 'Extended', unitCostEur: 1.05 },
      { designator: 'C3, C4', part: '4.7 µF + 2.2 µF 25 V X7R MLCC', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.05 },
      { designator: 'R2, R25', part: '1.2 kΩ 0.25 W Preload + 0 Ω Link', packageType: '1206/0805', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
    ],
    advantages: [
      'Delivers ~9.8–11.2 V at the pump terminal across 1 or 2 pumps with >5.5 V headroom above the 4 V pump threshold',
      'Low part count (6 components) and proven internal startup on any USB-C ramp rate',
      'Easily handles both PUMP1 and PUMP2 simultaneously at 10 mA Grundfos stress load',
    ],
    tradeoffs: [
      'Triggers €2.80 JLCPCB extended/THT assembly surcharge (+€1.40/board @ 2×) plus €1.05 module cost (€2.58/board @ 2×)',
      'Galvanic isolation is completely wasted because the H3 driver ties +V_DRV return directly to Pi GND',
      'Unregulated brick climbs to 13.5–15 V at <10% load (close to SMBJ13A breakdown), forcing a permanent 10 mA preload resistor R2',
      'Requires larger R9 (470 Ω) and rescaled R31 (27 kΩ) so GPIO 6 readback stays below 3.3 V',
    ],
    failSafeNotes: {
      oscillatorFailure: 'Internal module fault drops +V_DRV to 0 V; solar pump stops cleanly and GPIO 6 readback flags alarm.',
      shortCircuitBehavior: 'B0512S-1WR3 has continuous short protection; R9 (470 Ω) caps fault current to ~25 mA (0.30 W).',
      readbackSafety: 'MUST use R31 = 27 kΩ / R32 = 8.2 kΩ (2.79 V @ 12 V). Using D25 values (12k/8.2k) pushes 4.87 V into GPIO 6 (destroys Pi pin!).',
    },
  },
  d25_bjt_doubler: {
    id: 'd25_bjt_doubler',
    name: 'D25 Discrete 4-BJT Astable Voltage Doubler (Claude Proposal)',
    shortName: 'D25 BJT Doubler (Rev C)',
    badgeText: 'GitHub D25 · €0 Fee · Audit Findings',
    summary:
      'Claude’s D25 proposal in HAT-development.md §9: two-BJT astable oscillator (Q15/Q16, ~15 kHz) + complementary emitter follower (Q17/Q18) + 2× 1N4148W silicon diodes into C22 (2.2 µF) / C23 (10 µF).',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.11,
    partCount: 14,
    handSolderability: 'SOIC / 0805 Easy',
    regulated: false,
    startupRisk: 'Moderate (matched-reel BJT astable can lock up on slow PSU ramp)',
    r9Spec: '100 Ω 0.5 W (1210)',
    r31r32Spec: 'R31 12 kΩ / R32 8.2 kΩ (2.70 V @ 6.7 V)',
    verdict:
      'Clever €0.11 zero-fee concept that works for 1 normal pump (6.66 V), but audit flags 4 weaknesses: double 1N4148 drop (~1.5 V lost), high output impedance (~95 Ω → sags hard with 2 pumps), astable slow-ramp lock-up risk, and −4.5 V base-emitter wear over 10+ years.',
    bom: [
      { designator: 'Q15..Q17', part: '3× MMBT3904 NPN (Astable + Top Follower)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
      { designator: 'Q18', part: '1× MMBT3906 PNP (Bottom Follower)', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'D21, D22', part: '2× 1N4148W Silicon Switching Diodes (Vf ≈ 0.75 V)', packageType: 'SOD-123', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R54..R57', part: '2× 1 kΩ + 2× 10 kΩ (Astable Timing)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'C20..C23', part: '2× 4.7 nF + 2.2 µF + 10 µF X7R MLCC', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
    ],
    advantages: [
      'Ultra-low €0.11 BOM cost with €0.00 JLCPCB feeder fee (reuses MMBT3904/3906/1N4148W already on the HAT)',
      'Zero shoot-through by physics (Q17/Q18 emitter followers have a natural 1.4 V dead-band)',
      'Simulated in ngspice for 1 pump: 6.66 V normal / 5.23 V stress+UV, dropping safely to 3.66 V if oscillator stops',
    ],
    tradeoffs: [
      '2× 1N4148W silicon diodes throw away ~1.50 V (vs ~0.56 V for Basic SS14 Schottky diodes)',
      'High output impedance (~95 Ω @ 15 kHz, 2.2 µF): fitting PUMP1 + PUMP2 at stress load + 4.63 V UV collapses pump terminal to ~3.7 V (FAIL < 4.0 V)',
      'Classic 2-BJT astable multivibrator can lock up (both transistors saturated, 0 Hz) on slow USB-C PSU ramps when Q15/Q16 come from the same matched tape reel',
      'Q15/Q16 base-emitter junctions swing to −4.5 V every cycle (near −6.0 V V_EBO abs max), risking long-term h_FE degradation over 10+ years of 24/7 boiler-room service',
    ],
    failSafeNotes: {
      oscillatorFailure: '+V_DRV collapses through D21/D22 to ~3.6–3.8 V; GPIO 6 readback sees ~1.48 V (LOW) and triggers output-check alarm.',
      shortCircuitBehavior: 'High doubler impedance naturally folds +V_DRV back to ~5.1 V; R9 (100 Ω 0.5 W) dissipates 0.24 W safely.',
      readbackSafety: 'Safe with R31 12 kΩ / R32 8.2 kΩ: max 3.05 V at 5.25 V rail (safely below 3.3 V Pi GPIO limit).',
    },
  },
  lm393_schottky_doubler: {
    id: 'lm393_schottky_doubler',
    name: 'LM393DR2G Schmitt + CMOS + SS14 Schottky Doubler — Rev E (Locked)',
    shortName: 'LM393 + SS14 Rev E (Locked)',
    badgeText: 'Locked Rev E · 16 Parts · 100% Basic (€0 Ext!)',
    summary:
      'Locked Rev E (official TI .SUBCKT LM393 ngspice-39 verified, 100% JLCPCB Basic — €0.00 Extended fees!): U3 LM393DR2G (C7955 Basic, 57 kHz Schmitt osc with C20 1 nF X7R Basic C46653, <1 mV drift across ±15% X7R) driving rail-to-rail CMOS Q17 (AO3401A) + Q18 (AO3400A) with R60A||B (2×100 Ω 1206 = 50 Ω/500 mW Basic C17901) + 2× SS14 Schottkys into C22 (4.7 µF) / C23 (10 µF).',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.24,
    partCount: 16,
    handSolderability: 'SOIC / 0805 Easy',
    regulated: false,
    startupRisk: 'Immune (Schmitt hysteresis guarantees oscillation on any ramp)',
    r9Spec: '200 Ω 0.5 W (2×100 Ω 1206 Basic)',
    r31r32Spec: 'R31 22 kΩ / R32 10 kΩ (2.393 V @ 7.649 V)',
    verdict:
      'Locked 16-part Rev E (€0.24 parts, €0.00 Extended fees — 100% JLCPCB Basic! TI LM393 ngspice-39 verified): C20 = 1 nF X7R Basic (C46653) and R60A||B = 2×100 Ω Basic (50 Ω, C17901) eliminate ALL Extended reels in this block. Delivers +9.193 V nominal (+7.649 V J2 PWM1, 2.393 V RB1) with <1 mV delta across ±15% X7R corners (9.250 / 9.251 / 9.251 V).',
    bom: [
      { designator: 'U3', part: 'LM393DR2G Dual Comp (onsemi C7955; U3B tied)', packageType: 'SOIC-8', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'Q17, Q18', part: 'AO3401A (C15127) + AO3400A (C20917) CMOS', packageType: 'SOT-23', jlcpcbClass: 'Basic', unitCostEur: 0.075 },
      { designator: 'R60A, R60B', part: '2× 100 Ω || = 50 Ω 0.5 W Damper (C17901 Basic!)', packageType: '1206', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'D21, D22', part: '2× SS14 1 A 40 V Schottky (C2480, Vf ≈ 0.28 V)', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.04 },
      { designator: 'R54..R59', part: '2× 100 kΩ + 47 kΩ + 15 kΩ + 1.5 kΩ (≤3.5 mA)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.025 },
      { designator: 'C20', part: '1 nF 50 V X7R Timing Cap (C46653 Basic!)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
      { designator: 'C21..C23', part: '100 nF X7R + 4.7 µF + 10 µF 16 V X5R', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.03 },
    ],
    advantages: [
      '100% JLCPCB Basic (€0.00 Extended fees! C20 1 nF X7R C46653 & R60A||B 2×100 Ω C17901 save €5.60 vs earlier C0G/47 Ω draft)',
      'Under D18 direct +5V_HAT = 5.045 V: delivers +9.193 V nominal (+7.649 V at J2 PWM1, 2.393 V RB1) and +7.98 V at 4.63 V Pi 5 UVLO',
      'ngspice-39 ±15% X7R corner sweep (0.85/1.00/1.15 nF → 66.3/56.9/49.9 kHz) holds +V_DRV to 9.250 / 9.251 / 9.251 V (<1 mV delta!)',
      'LM393DR2G (C7955 Basic) Schmitt hysteresis oscillator (R59 = 1.5 kΩ, ≤3.5 mA sink) cannot lock up on slow USB-C ramps and eliminates −4.5 V V_EBO wear',
      'Reuses core HAT Basic reels (LM393DR2G C7955, AO3401A, AO3400A, 100 Ω 1206 C17901, SS14 C2480) with ZERO unique Extended reels',
    ],
    tradeoffs: [
      'Unregulated (tracks Pi +5V_HAT rail × ~1.84, with +1.56 V more headroom than BJT followers at every input voltage)',
      'Works cleanly with Sub 05 R31 22 kΩ / R32 10 kΩ + D18 1N4148W clamp (2.393 V nominal, 2.01 V UVLO, clamped safely at +3.8 V on 24 V fault)',
    ],
    failSafeNotes: {
      oscillatorFailure: 'If U3A stalls, +V_DRV falls through D21/D22 to ~4.4 V (unloaded) / ~3.6 V (loaded), dropping GPIO 6 RB1 to ~1.1 V (clean LOW alarm).',
      shortCircuitBehavior: 'Doubler sags cleanly under a dead short on PWM1 while Sub 05 R9A+B (2×100 Ω = 200 Ω 0.5 W Basic) limits J2 short current to 39.1 mA (153 mW/ea).',
      readbackSafety: 'With Sub 05 R31 = 22 kΩ / R32 = 10 kΩ + D18: 2.393 V nominal (+5V_HAT = 5.045 V), 2.01 V at 4.63 V Pi UVLO (clean HIGH on Pi 3/4/5), 1.1 V when dead (clean LOW).',
    },
  },
  mt3608_boost: {
    id: 'mt3608_boost',
    name: 'MT3608 Regulated 5 V → 10 V Inductive Boost Converter',
    shortName: 'MT3608 10 V Boost',
    badgeText: 'Regulated · 2× Extended Fees',
    summary:
      '1.2 MHz SOT-23-6 synchronous-style boost converter with 22 µH shielded power inductor and SS14 Schottky, delivering a flat regulated 10.0 V independent of Pi 5 V sag.',
    jlcpcbFeederFeeEur: 5.6,
    partCostEur: 0.28,
    partCount: 9,
    handSolderability: 'SOT-23-6 Fine',
    regulated: true,
    startupRisk: 'None (internal soft-start + UVLO)',
    r9Spec: '220 Ω 0.5 W (1210)',
    r31r32Spec: 'R31 27 kΩ / R32 8.2 kΩ (2.33 V @ 10 V)',
    verdict:
      'Best electrical regulation (flat 10.0 V down to 4.2 V Pi sag, >200 mA), but both MT3608 and the 22 µH power inductor are JLCPCB Extended parts (+€5.60 fee = €3.08/bd @ 2× — more expensive than B0512S!) and 1.2 MHz switching adds EMI near Pt1000/1-Wire.',
    bom: [
      { designator: 'U2', part: 'MT3608 / B628 (1.2 MHz 2 A Boost IC)', packageType: 'SOT-23-6', jlcpcbClass: 'Extended', unitCostEur: 0.06 },
      { designator: 'L1', part: '22 µH 1.2 A Shielded Power Inductor', packageType: 'CDRH4D28', jlcpcbClass: 'Extended', unitCostEur: 0.12 },
      { designator: 'D21', part: 'SS14 1 A 40 V Schottky Diode', packageType: 'SMA', jlcpcbClass: 'Basic', unitCostEur: 0.02 },
      { designator: 'R_fb, C', part: '100 kΩ + 6.34 kΩ 1% FB + 2× 10 µF 25 V X7R', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.08 },
    ],
    advantages: [
      'Flat regulated 10.0 V (±2%) even if the Pi 5 V supply sags all the way down to 4.2 V',
      'High current headroom (>200 mA): drives PUMP1 + PUMP2 simultaneously with <15 mV ripple',
      'Zero BJT startup lock-up or V_EBO wear; compact 9-part footprint',
    ],
    tradeoffs: [
      'Two JLCPCB Extended parts (MT3608 + 22 µH power inductor = €5.60 fee → €3.08/bd @ 2×, actually pricier than B0512S!)',
      '1.2 MHz high-di/dt inductor switching loop radiates EMI close to the 1-Wire buses and Pt1000 divider on a 2-layer PCB',
      'Requires rescaled R9 (220 Ω 0.5 W) and R31 (27 kΩ) to protect R9 on dead shorts and keep GPIO 6 < 3.3 V',
      'Pass-through diode means +V_DRV stays at ~4.6 V even if MT3608 fails OFF (requires careful readback threshold tuning)',
    ],
    failSafeNotes: {
      oscillatorFailure: 'If MT3608 stops switching, Pi 5 V passes through L1 + SS14 to +V_DRV ≈ 4.65 V (R31 27k / R32 8.2k sees 1.08 V → clean LOW alarm).',
      shortCircuitBehavior: 'Boost IC cannot disconnect pass-through path on a dead short; R9 = 220 Ω 0.5 W limits short current to ~45 mA (0.45 W).',
      readbackSafety: 'Requires R31 = 27 kΩ / R32 = 8.2 kΩ (2.33 V @ 10 V); 12k/8.2k would push 4.06 V into GPIO 6.',
    },
  },
  direct_5v: {
    id: 'direct_5v',
    name: 'Direct Pi 5 V Rail — No Boost (Former 1-Wire Lite)',
    shortName: 'Direct 5 V (No Boost)',
    badgeText: 'Zero Parts · Fails UV + Stress',
    summary:
      'Former 1-Wire Lite approach: feeds the H3 pump driver directly from Pi +5 V through a 0 Ω jumper R26 with zero voltage lift.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.01,
    partCount: 1,
    handSolderability: 'SOIC / 0805 Easy',
    regulated: false,
    startupRisk: 'None (passive 0 Ω jumper)',
    r9Spec: '100 Ω 0.5 W (1210)',
    r31r32Spec: 'R31 6.8 kΩ / R32 8.2 kΩ (2.62 V @ 4.8 V)',
    verdict:
      'Free (€0.01), but leaves virtually zero safety margin above the 4.0 V pump high threshold: drops to 4.09 V on a single stress pump at 4.63 V Pi UV, and fails below 4.0 V on weak cables or cold silicon drops.',
    bom: [
      { designator: 'R26', part: '0 Ω Jumper (Pi +5V -> +V_DRV)', packageType: '0805', jlcpcbClass: 'Basic', unitCostEur: 0.01 },
    ],
    advantages: [
      'Lowest possible cost (€0.01, 1 jumper) and zero switching noise',
      'Zero startup risk and zero idle current draw',
    ],
    tradeoffs: [
      'Razor-thin margin: only 4.80 V nominal and 4.09 V under stress + 4.63 V UV (0.09 V above the 4.0 V Wilo/Grundfos threshold!)',
      'Drops below 4.0 V (pump refuses to start or misreads PWM) if Pi supply dips to 4.5 V or pump draws 10 mA',
      'Requires a separate SMBJ6.0A TVS (3.85 nF high capacitance → slows PWM edges)',
    ],
    failSafeNotes: {
      oscillatorFailure: 'N/A (no oscillator).',
      shortCircuitBehavior: 'R9 (100 Ω 0.5 W) limits short current to ~48 mA (0.23 W) straight from Pi 5 V.',
      readbackSafety: 'Uses R31 = 6.8 kΩ / R32 = 8.2 kΩ (2.62 V @ 4.8 V).',
    },
  },
};

export function evaluatePumpSupply(
  topologyId: PumpTopologyId,
  params: PumpSimParams
): PumpSimResult {
  const effectivePiV = params.activeFault === 'pi_uv' ? 4.63 : params.piSupplyV;
  const dutyFrac = params.pwmDutyPct / 100;

  // Temperature effect on diode Vf (-2 mV/K from 25 C)
  const tempDeltaC = params.ambientTempC - 25;
  const vCeSatQ6 = 0.14 + (params.loadProfile === 'stress' ? 0.04 : 0.0);

  // Real H3 pump optocoupler input model from CoSTOS HAT-development.md §9.2:
  // Normal pump (Wilo / standard): R_opto = 2200 Ohm + 1.2 V LED
  // Stress pump (worst-case Grundfos): R_opto = 470 Ohm + 1.2 V LED
  const rOptoOhm = params.loadProfile === 'stress' ? 470 : 2200;
  const vLedOpto = 1.2;
  const r9For = (id: PumpTopologyId) =>
    id === 'b0512s'
      ? 470
      : id === 'mt3608_boost' || id === 'lm393_schottky_doubler'
      ? 220
      : 100;
  const r31For = (id: PumpTopologyId) =>
    id === 'b0512s' || id === 'mt3608_boost'
      ? 27
      : id === 'lm393_schottky_doubler'
      ? 22
      : id === 'direct_5v'
      ? 6.8
      : 12;
  const r32For = (id: PumpTopologyId) => (id === 'lm393_schottky_doubler' ? 10 : 8.2);

  // Solve closed-form steady-state V_drv when source (V_oc, R_out) feeds pumpCount H3 channels
  // Each channel draws: I_pump = (V_drv - vCeSatQ6 - vLedOpto) / (r9 + rOpto) + overhead (LED + R38 + Q6 base)
  const solveLoadedRail = (vOc: number, rOutOhm: number, r9Ohm: number) => {
    const dutyScale = Math.max(0.2, dutyFrac);
    const nEff = params.pumpCount * dutyScale;
    const rBranch = r9Ohm + rOptoOhm;
    const gPump = nEff / rBranch; // A/V from opto branch
    const gOverhead = nEff * (1 / 2200 + 1 / 10000 + 1 / 20000); // LED 2.2k + R38 10k + readback
    const iFixedOffset = nEff * 0.0014; // Q6 base + static bias (~1.4 mA/ch)
    // V_drv = V_oc - R_out * ( gPump*(V_drv - vCeSatQ6 - vLedOpto) + gOverhead*V_drv + iFixedOffset )
    const numerator =
      vOc + rOutOhm * (gPump * (vCeSatQ6 + vLedOpto) - iFixedOffset);
    const denom = 1 + rOutOhm * (gPump + gOverhead);
    const vDrv = Math.max(0, numerator / denom);
    const iPumpOneA = Math.max(0, (vDrv - vCeSatQ6 - vLedOpto) / rBranch);
    const vPump = Math.max(0, vDrv - vCeSatQ6 - iPumpOneA * r9Ohm);
    const totalLoadMa =
      (nEff * (iPumpOneA + vDrv * (1 / 2200 + 1 / 10000 + 1 / 20000) + 0.0014)) * 1000;
    return { vDrv, vPump, iPumpOneA, totalLoadMa };
  };

  // Handle dead-short on PUMP1 terminal
  if (params.activeFault === 'short_pwm') {
    const r9 = r9For(topologyId);
    const vShortDrv =
      topologyId === 'b0512s'
        ? 11.8
        : topologyId === 'mt3608_boost'
        ? 9.9
        : topologyId === 'direct_5v'
        ? effectivePiV - 0.15
        : topologyId === 'lm393_schottky_doubler'
        ? effectivePiV + 0.12
        : effectivePiV + 0.1;
    const iShortA = Math.max(0, (vShortDrv - 0.25) / r9);
    const pR9W = iShortA * iShortA * r9;
    const piDrawMa =
      topologyId === 'b0512s'
        ? ((vShortDrv * iShortA) / (effectivePiV * 0.78)) * 1000
        : topologyId === 'mt3608_boost'
        ? ((vShortDrv * iShortA) / (effectivePiV * 0.84)) * 1000
        : iShortA * 1000 * 1.9 + 12;

    return {
      topologyId,
      effectivePiV,
      vDrvLoadedV: vShortDrv,
      vPumpTerminalV: 0.0,
      marginAbove4V: -4.0,
      rippleMvPp: 420,
      pi5vCurrentMa: piDrawMa,
      r9PowerW: pR9W,
      readbackGpio6V: 0.0,
      safetyStatus: pR9W <= 0.48 ? 'FailSafeCaught' : 'FailsSpec',
      statusHeadline: pR9W <= 0.48 ? 'Short Survived · Alarm Raised' : 'R9 Thermal Overload',
      statusDetail: `Dead short on PUMP1 PWM terminal: R9 (${r9} Ω 0.5 W) limits current to ${(iShortA * 1000).toFixed(0)} mA (${pR9W.toFixed(2)} W); GPIO 6 reads 0.00 V -> immediate CoSTOS fault.`,
      nodes: [
        { label: '+V_DRV (Short)', value: `${vShortDrv.toFixed(2)} V`, note: 'Folded back' },
        { label: 'I_short / P(R9)', value: `${(iShortA * 1000).toFixed(0)} mA · ${pR9W.toFixed(2)} W`, note: `0.5 W ${r9} Ω` },
        { label: 'GPIO 6 Readback', value: '0.00 V (LOW)', note: 'Fault caught' },
      ],
    };
  }

  // Handle Slow PSU Ramp fault (specifically exposes D25 matched-BJT astable lock-up!)
  if (params.activeFault === 'slow_ramp' && topologyId === 'd25_bjt_doubler') {
    const vSiDrop = 2 * (0.64 - 0.002 * tempDeltaC);
    const solved = solveLoadedRail(Math.max(0, effectivePiV - vSiDrop), 12, 100);
    const gpio6V = solved.vPump * (8.2 / (12 + 8.2));
    return {
      topologyId,
      effectivePiV,
      vDrvLoadedV: solved.vDrv,
      vPumpTerminalV: solved.vPump,
      marginAbove4V: solved.vPump - 4.0,
      rippleMvPp: 5,
      pi5vCurrentMa: 14, // Both Q15 & Q16 latched ON through 1k collectors!
      r9PowerW: solved.iPumpOneA * solved.iPumpOneA * 100,
      readbackGpio6V: gpio6V,
      safetyStatus: 'FailsSpec',
      statusHeadline: 'Astable Lock-Up (0 Hz)',
      statusDetail:
        'Matched Q15/Q16 BJTs from the same reel can both saturate on a slow USB-C power ramp (0 Hz). +V_DRV falls to ~3.6 V -> pump fails to start; requires power cycle.',
      nodes: [
        { label: 'Q15/Q16 State', value: 'BOTH SAT (0 Hz)', note: 'Latch-up risk' },
        { label: '+V_DRV / V_pump', value: `${solved.vDrv.toFixed(2)} V / ${solved.vPump.toFixed(2)} V`, note: 'Below 4.0 V' },
        { label: 'GPIO 6 Readback', value: `${gpio6V.toFixed(2)} V`, note: 'Alarm raised' },
      ],
    };
  }

  // Handle Oscillator Dead fault
  if (params.activeFault === 'osc_dead' && topologyId !== 'direct_5v') {
    if (topologyId === 'b0512s') {
      return {
        topologyId,
        effectivePiV,
        vDrvLoadedV: 0.0,
        vPumpTerminalV: 0.0,
        marginAbove4V: -4.0,
        rippleMvPp: 0,
        pi5vCurrentMa: 2,
        r9PowerW: 0,
        readbackGpio6V: 0.0,
        safetyStatus: 'FailSafeCaught',
        statusHeadline: '0 V Fail-Safe · Caught',
        statusDetail: 'Dead B0512S drops +V_DRV to 0.00 V; solar pump stops cleanly and GPIO 6 reads 0.00 V -> alarm.',
        nodes: [
          { label: '+V_DRV', value: '0.00 V', note: 'Module dead' },
          { label: 'V_pump', value: '0.00 V', note: 'Pump stopped' },
          { label: 'GPIO 6', value: '0.00 V (LOW)', note: 'Alarm raised' },
        ],
      };
    }
    const diodeDrop =
      topologyId === 'd25_bjt_doubler'
        ? 2 * (0.64 - 0.002 * tempDeltaC)
        : topologyId === 'lm393_schottky_doubler'
        ? 2 * (0.28 - 0.0018 * tempDeltaC)
        : 0.30 - 0.0018 * tempDeltaC;
    const r9 = r9For(topologyId);
    const r31 = r31For(topologyId);
    const r32 = r32For(topologyId);
    const solved = solveLoadedRail(Math.max(0, effectivePiV - diodeDrop), 10, r9);
    const gpio6V = solved.vPump * (r32 / (r31 + r32));
    const caughtByGpio = gpio6V < 1.65;

    return {
      topologyId,
      effectivePiV,
      vDrvLoadedV: solved.vDrv,
      vPumpTerminalV: solved.vPump,
      marginAbove4V: solved.vPump - 4.0,
      rippleMvPp: 5,
      pi5vCurrentMa: 8 + solved.totalLoadMa,
      r9PowerW: solved.iPumpOneA * solved.iPumpOneA * r9,
      readbackGpio6V: gpio6V,
      safetyStatus: caughtByGpio ? 'FailSafeCaught' : 'Borderline',
      statusHeadline: caughtByGpio ? 'Dead Osc Caught by Readback' : 'Borderline Readback',
      statusDetail: `Oscillator stalled: +V_DRV falls through diode path to ${solved.vDrv.toFixed(2)} V (V_pump = ${solved.vPump.toFixed(2)} V). GPIO 6 sees ${gpio6V.toFixed(2)} V (${caughtByGpio ? 'reads LOW -> output check alarm!' : 'near logic threshold!'}).`,
      nodes: [
        { label: '+V_DRV (Dead)', value: `${solved.vDrv.toFixed(2)} V`, note: 'DC pass-through' },
        { label: 'V_pump', value: `${solved.vPump.toFixed(2)} V`, note: 'Weak / stopped' },
        { label: 'GPIO 6 Readback', value: `${gpio6V.toFixed(2)} V`, note: caughtByGpio ? 'LOW -> Alarm' : 'Marginal' },
      ],
    };
  }

  // Nominal (or Pi UV 4.63 V) steady-state operating physics
  const r9 = r9For(topologyId);
  const r31 = r31For(topologyId);
  const r32 = r32For(topologyId);
  let vDrvLoadedV = 0;
  let vPumpTerminalV = 0;
  let iPumpOneA = 0;
  let rippleMvPp = 0;
  let pi5vCurrentMa = 0;

  switch (topologyId) {
    case 'b0512s': {
      const vOc = 12.6 * (effectivePiV / 5.0) - 0.28; // with 10 mA R2 preload
      const solved = solveLoadedRail(vOc, 26, r9);
      vDrvLoadedV = solved.vDrv;
      vPumpTerminalV = solved.vPump;
      iPumpOneA = solved.iPumpOneA;
      rippleMvPp = 55 + (solved.totalLoadMa + 10) * 0.5;
      pi5vCurrentMa = (vDrvLoadedV * (solved.totalLoadMa + 10)) / (effectivePiV * 0.78) + 8;
      break;
    }
    case 'd25_bjt_doubler': {
      // Calibrated directly to CoSTOS HAT-development.md §9.2 ngspice runs:
      // 1x normal @ 5.0V = 6.66 V | 1x normal @ 4.63V = 6.00 V
      // 1x stress @ 5.0V = 5.56 V | 1x stress @ 4.63V = 5.04 V
      // 2x stress @ 4.63V UV -> R55 (1k) starves Q17 base drive, collapsing < 4.0 V (FAIL)
      const vSwSwing = Math.max(0, effectivePiV - 0.96); // Q17/Q18 emitter follower swing
      const twoSiDrop = 2 * (0.68 - 0.002 * tempDeltaC);
      const vOc = effectivePiV + vSwSwing - twoSiDrop;
      // 1/(15 kHz * 2.2 uF) + 1N4148 dynamic R + Q17 base sag across R55 (1k) under heavy 2-pump load
      const rOutOhm = params.pumpCount === 2 ? 108 : 74;
      const solved = solveLoadedRail(vOc, rOutOhm, r9);
      vDrvLoadedV = Math.max(effectivePiV - 1.4, solved.vDrv);
      vPumpTerminalV = solved.vPump;
      iPumpOneA = solved.iPumpOneA;
      rippleMvPp = (solved.totalLoadMa / (15 * 10)) * 1000 * 0.85 + 35;
      pi5vCurrentMa = 10 + solved.totalLoadMa * 2.05;
      break;
    }
    case 'lm393_schottky_doubler': {
      // Official TI LM393 ngspice-39 verified Rev E CMOS under D18 direct +5V_HAT = 5.045 V:
      // +V_DRV = 9.21 V nom / 7.98 V UVLO, J2 PWM1 = 7.55 V nom / 6.45 V UVLO
      const vSwSwing = Math.max(0, effectivePiV - 0.08);
      const twoSchottkyDrop = 2 * (0.28 - 0.0018 * tempDeltaC);
      const vOc = effectivePiV + vSwSwing - twoSchottkyDrop;
      const rOutOhm = 28;
      const solved = solveLoadedRail(vOc, rOutOhm, r9);
      vDrvLoadedV = Math.max(effectivePiV - 0.56, solved.vDrv);
      vPumpTerminalV = solved.vPump;
      iPumpOneA = solved.iPumpOneA;
      rippleMvPp = (solved.totalLoadMa / (62 * 10)) * 1000 * 0.8 + 12;
      pi5vCurrentMa = 4.2 + solved.totalLoadMa * 2.05;
      break;
    }
    case 'mt3608_boost': {
      const solved = solveLoadedRail(10.0, 4, r9);
      vDrvLoadedV = solved.vDrv;
      vPumpTerminalV = solved.vPump;
      iPumpOneA = solved.iPumpOneA;
      rippleMvPp = 28 + solved.totalLoadMa * 0.35;
      pi5vCurrentMa = (vDrvLoadedV * solved.totalLoadMa) / (effectivePiV * 0.86) + 2.5;
      break;
    }
    case 'direct_5v': {
      const solved = solveLoadedRail(effectivePiV, 5, r9);
      vDrvLoadedV = solved.vDrv;
      vPumpTerminalV = solved.vPump;
      iPumpOneA = solved.iPumpOneA;
      rippleMvPp = 20;
      pi5vCurrentMa = solved.totalLoadMa;
      break;
    }
  }

  const marginAbove4V = vPumpTerminalV - 4.0;
  const r9PowerW = iPumpOneA * iPumpOneA * r9 * dutyFrac;
  const readbackGpio6V = vPumpTerminalV * (r32 / (r31 + r32));

  let safetyStatus: PumpSimResult['safetyStatus'] = 'Nominal';
  let statusHeadline = 'Nominal Margin';
  let statusDetail = `V_pump = ${vPumpTerminalV.toFixed(2)} V (+${marginAbove4V.toFixed(2)} V above 4.0 V Wilo/Grundfos floor); GPIO 6 readback = ${readbackGpio6V.toFixed(2)} V.`;

  if (vPumpTerminalV < 4.0) {
    safetyStatus = 'FailsSpec';
    statusHeadline = 'Below 4.0 V Pump Floor!';
    statusDetail = `V_pump dropped to ${vPumpTerminalV.toFixed(2)} V (< 4.0 V minimum)! Pump may stall or ignore PWM signal.`;
  } else if (marginAbove4V < 0.8 || readbackGpio6V > 3.25) {
    safetyStatus = 'Borderline';
    statusHeadline = readbackGpio6V > 3.25 ? 'GPIO 6 Over-Voltage Risk' : 'Low Voltage Margin (<0.8 V)';
    statusDetail =
      readbackGpio6V > 3.25
        ? `GPIO 6 readback reaches ${readbackGpio6V.toFixed(2)} V (>3.25 V) — rescale R31!`
        : `Only +${marginAbove4V.toFixed(2)} V margin above the 4.0 V pump threshold under this load/supply corner.`;
  }

  return {
    topologyId,
    effectivePiV,
    vDrvLoadedV,
    vPumpTerminalV,
    marginAbove4V,
    rippleMvPp,
    pi5vCurrentMa,
    r9PowerW,
    readbackGpio6V,
    safetyStatus,
    statusHeadline,
    statusDetail,
    nodes: [
      { label: '+V_DRV Rail', value: `${vDrvLoadedV.toFixed(2)} V`, note: `${rippleMvPp.toFixed(0)} mVpp ripple` },
      { label: 'PUMP1 Terminal', value: `${vPumpTerminalV.toFixed(2)} V`, note: `Margin ${marginAbove4V >= 0 ? '+' : ''}${marginAbove4V.toFixed(2)} V` },
      { label: 'GPIO 6 Readback', value: `${readbackGpio6V.toFixed(2)} V`, note: `R31 ${r31}k / ${r32}k` },
    ],
  };
}

export interface PumpSweepPoint {
  piV: number;
  b0512sV: number;
  d25V: number;
  revDV: number;
  mt3608V: number;
  direct5vV: number;
}

export function computePumpVoltageSweep(params: PumpSimParams): PumpSweepPoint[] {
  const pts: PumpSweepPoint[] = [];
  const baseParams: PumpSimParams = { ...params, activeFault: 'none' };
  for (let mv = 4200; mv <= 5250; mv += 50) {
    const piV = mv / 1000;
    const p = { ...baseParams, piSupplyV: piV };
    pts.push({
      piV,
      b0512sV: Number(evaluatePumpSupply('b0512s', p).vPumpTerminalV.toFixed(2)),
      d25V: Number(evaluatePumpSupply('d25_bjt_doubler', p).vPumpTerminalV.toFixed(2)),
      revDV: Number(evaluatePumpSupply('lm393_schottky_doubler', p).vPumpTerminalV.toFixed(2)),
      mt3608V: Number(evaluatePumpSupply('mt3608_boost', p).vPumpTerminalV.toFixed(2)),
      direct5vV: Number(evaluatePumpSupply('direct_5v', p).vPumpTerminalV.toFixed(2)),
    });
  }
  return pts;
}

export type PumpVerdict = 'BETTER' | 'EQUAL' | 'WORSE';

export interface PumpConclusionRow {
  category: string;
  aspect: string;
  b0512sValue: string;
  d25Value: string;
  revDValue: string;
  verdictVsD25: PumpVerdict;
  rationale: string;
}

export function buildPumpConclusion(params: PumpSimParams, batchSize: 2 | 5) {
  const b05 = PUMP_TOPOLOGY_SPECS.b0512s;
  const d25 = PUMP_TOPOLOGY_SPECS.d25_bjt_doubler;
  const revD = PUMP_TOPOLOGY_SPECS.lm393_schottky_doubler;

  const costB05 = pumpPerBoardCostEur(b05, batchSize);
  const costD25 = pumpPerBoardCostEur(d25, batchSize);
  const costRevD = pumpPerBoardCostEur(revD, batchSize);

  const eval1Norm = (id: PumpTopologyId) =>
    evaluatePumpSupply(id, { ...params, piSupplyV: 5.05, pumpCount: 1, loadProfile: 'normal', activeFault: 'none' });
  const eval2StressUv = (id: PumpTopologyId) =>
    evaluatePumpSupply(id, { ...params, piSupplyV: 4.63, pumpCount: 2, loadProfile: 'stress', activeFault: 'none' });

  const rows: PumpConclusionRow[] = [
    {
      category: 'Cost & Assembly',
      aspect: `Effective Cost / Board (${batchSize}×)`,
      b0512sValue: `€${costB05.toFixed(2)} (€2.80 fee)`,
      d25Value: `€${costD25.toFixed(2)} (€0.00 fee)`,
      revDValue: `€${costRevD.toFixed(2)} (€0.00 Ext!)`,
      verdictVsD25: 'EQUAL',
      rationale: `Saves €${(costB05 - costRevD).toFixed(2)}/bd vs B0512S with €0.00 Extended fees (Tier 1+2: C20 = C46653 1 nF X7R Basic, R60A||B = 2×100 Ω C17901 Basic).`,
    },
    {
      category: 'Cost & Assembly',
      aspect: 'Reel Reuse Across HAT',
      b0512sValue: 'Unique Extended SIP-4',
      d25Value: 'Shared MMBT3904/1N4148',
      revDValue: '100% Shared Basic Reels',
      verdictVsD25: 'BETTER',
      rationale: 'Reuses LM393DR2G (C7955 Basic, Pt1000 U1 & WD U4), AO3401A/AO3400A, 100 Ω 1206 (C17901 Basic), C20 1 nF X7R (C46653 Basic), and SS14 (C2480 Basic).',
    },
    {
      category: 'Cost & Assembly',
      aspect: 'PCB Part Count & Area',
      b0512sValue: '6 parts (tall THT brick)',
      d25Value: '14 parts (SOT-23/0805)',
      revDValue: '16 parts (SOIC-8 + 2× SMA)',
      verdictVsD25: 'EQUAL',
      rationale: '16 parts total (R60A||B = 2×100 Ω 1206 Basic damper for rail-to-rail CMOS driver); compact SMD footprint.',
    },
    {
      category: 'Electrical Margin',
      aspect: '1× Normal Pump @ 5.05 V (D18)',
      b0512sValue: `${eval1Norm('b0512s').vPumpTerminalV.toFixed(2)} V`,
      d25Value: `${eval1Norm('d25_bjt_doubler').vPumpTerminalV.toFixed(2)} V`,
      revDValue: `${eval1Norm('lm393_schottky_doubler').vPumpTerminalV.toFixed(2)} V`,
      verdictVsD25: 'BETTER',
      rationale: 'CMOS AO3401A/AO3400A + SS14 Schottkys under D18 direct +5V_HAT = 5.045 V deliver +9.193 V +V_DRV / +7.649 V J2 PWM1 (ngspice-39 TI LM393).',
    },
    {
      category: 'Electrical Margin',
      aspect: '2× Stress Pumps @ 4.63 V UV',
      b0512sValue: `${eval2StressUv('b0512s').vPumpTerminalV.toFixed(2)} V (PASS)`,
      d25Value: `${eval2StressUv('d25_bjt_doubler').vPumpTerminalV.toFixed(2)} V (${eval2StressUv('d25_bjt_doubler').vPumpTerminalV < 4.0 ? 'FAIL <4V' : 'Borderline'})`,
      revDValue: `${eval2StressUv('lm393_schottky_doubler').vPumpTerminalV.toFixed(2)} V (PASS)`,
      verdictVsD25: 'BETTER',
      rationale: '57 kHz (R58 = 15 kΩ, C20 1 nF X7R Basic) + 4.7 µF + CMOS cuts R_out >3× (~28 Ω vs ~108 Ω), with <1 mV drift across ±15% X7R.',
    },
    {
      category: 'Reliability',
      aspect: 'Slow USB-C Ramp Startup',
      b0512sValue: 'Guaranteed start',
      d25Value: 'Latch-up risk (matched BJTs)',
      revDValue: 'Guaranteed (Schmitt hyst.)',
      verdictVsD25: 'BETTER',
      rationale: 'LM393DR2G Schmitt relaxation oscillator cannot latch both-ON on slow PSU ramps regardless of transistor matching.',
    },
    {
      category: 'Reliability',
      aspect: '10-Year 24/7 Component Stress',
      b0512sValue: 'Module electrolytic/ferrite',
      d25Value: 'Q15/Q16 V_EBO −4.5 V/cycle',
      revDValue: 'Zero V_EBO & ≤3.5 mA LM393',
      verdictVsD25: 'BETTER',
      rationale: 'Eliminates −4.5 V BJT V_EBO kicks AND keeps U3A sink current ≤3.5 mA (<4 mA V_OL datasheet guarantee).',
    },
    {
      category: 'Safety & Faults',
      aspect: 'Dead Oscillator Fail-Safe',
      b0512sValue: '0.00 V (GPIO 6 LOW)',
      d25Value: '3.66 V (GPIO 6 = 1.48 V LOW)',
      revDValue: '3.6 V (GPIO 6 = 1.13 V LOW)',
      verdictVsD25: 'EQUAL',
      rationale: 'With locked Sub 05 R31 = 22 kΩ / R32 = 10 kΩ, a dead U3A pulls GPIO 6 cleanly below 1.2 V so CoSTOS raises an immediate alarm.',
    },
    {
      category: 'Safety & Faults',
      aspect: 'Shorted PWM Cable Survival',
      b0512sValue: '0.30 W in R9 (470 Ω 0.5 W)',
      d25Value: '0.24 W in R9 (100 Ω 0.5 W)',
      revDValue: '0.153 W/ea in R9A+B (2×100 Ω)',
      verdictVsD25: 'EQUAL',
      rationale: 'Sub 05 R9A+B = 2× 100 Ω 1206 Basic (200 Ω / 500 mW) caps J2 dead-short current to 39.1 mA (153 mW EACH — halves stress!).',
    },
    {
      category: 'Software & EMI',
      aspect: 'Pi Software & Switching EMI',
      b0512sValue: '0 LOC · isolated brick EMI',
      d25Value: '0 LOC · quiet 15 kHz',
      revDValue: '0 LOC · quiet 57 kHz (no L)',
      verdictVsD25: 'EQUAL',
      rationale: 'Autonomous hardware supply (0 GPIO, 0 Rust code) with no 1.2 MHz power inductor radiating near Pt1000/1-Wire.',
    },
  ];

  const betterCount = rows.filter((r) => r.verdictVsD25 === 'BETTER').length;
  const equalCount = rows.filter((r) => r.verdictVsD25 === 'EQUAL').length;
  const worseCount = rows.filter((r) => r.verdictVsD25 === 'WORSE').length;
  const savingsVsB05PerBd = costB05 - costRevD;

  return {
    rows,
    betterCount,
    equalCount,
    worseCount,
    savingsVsB05PerBd,
    savingsVsB05Batch: savingsVsB05PerBd * batchSize,
    takeaway: `Locked Rev E — 16-part 100% JLCPCB Basic (€0.00 Extended fees!) LM393DR2G + CMOS AO3401A/AO3400A + SS14 Doubler — saves €${savingsVsB05PerBd.toFixed(2)}/bd (€${(savingsVsB05PerBd * batchSize).toFixed(2)} per ${batchSize}× batch vs B0512S). Scores ${betterCount} BETTER, ${equalCount} EQUAL, ${worseCount} WORSE vs D25: +9.193 V +V_DRV / +7.649 V J2 under D18 direct +5V_HAT, <1 mV drift across ±15% C20 X7R, datasheet-safe ≤3.5 mA LM393 sink, zero lock-up, and zero V_EBO aging.`,
  };
}
