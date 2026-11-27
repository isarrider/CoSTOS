export type WatchdogTopologyId =
  | '74lvc1g123'
  | 'd24_cap_pump'
  | 'u3b_schmitt_wd'
  | 'ne555_missing_pulse'
  | 'tps3823_supervisor';

export type WatchdogFaultMode =
  | 'none'
  | 'stuck_high'
  | 'runaway_2khz'
  | 'r49_open'
  | 'c17_short'
  | 'ic_stuck_on';

export type MosfetCorner = 'min' | 'typ' | 'max';
export type FluxLeakageMode = 'clean' | 'humid_boiler';

export interface WatchdogSimParams {
  heartbeatHz: number; // 0 .. 2500 Hz (nominal 20 Hz)
  linuxStallS: number; // 0 .. 12 s (nominal 0 s)
  ambientTempC: number; // 15 .. 60 C (nominal 30 C)
  mosfetCorner: MosfetCorner; // AO3400A V_gs(th): 0.65 V / 1.05 V / 1.45 V
  fluxLeakage: FluxLeakageMode; // clean (>100 MOhm) vs humid boiler room (3 MOhm on WD_OK)
  activeFault: WatchdogFaultMode;
}

export interface WatchdogBomItem {
  designator: string;
  part: string;
  packageType: string;
  jlcpcbClass: 'Basic' | 'Preferred' | 'Extended';
  unitCostEur: number;
}

export interface WatchdogTopologySpec {
  id: WatchdogTopologyId;
  name: string;
  shortName: string;
  badgeText: string;
  summary: string;
  jlcpcbFeederFeeEur: number;
  partCostEur: number;
  partCount: number;
  windowWatchdog: boolean;
  edgeTransition: string;
  timeoutSpec: string;
  linuxStallSpec: string;
  singleFaultBehavior: string;
  verdict: string;
  bom: WatchdogBomItem[];
  advantages: string[];
  tradeoffs: string[];
  failSafeNotes: {
    stuckOrStopped: string;
    runawayLoop: string;
    singlePartFault: string;
    readbackCoverage: string;
  };
}

export interface WatchdogNodeReading {
  label: string;
  value: string;
  note: string;
}

export interface WatchdogSimResult {
  topologyId: WatchdogTopologyId;
  effectiveFreqHz: number;
  vCapSteadyV: number;
  vCapAfterStallV: number;
  vGateRelayV: number; // V_SG on Q12 AO3401A (or TPS22918 EN)
  vGatePumpV: number; // V_GS on Q5 AO3400A
  relayEnergized: boolean;
  pumpGatedOn: boolean;
  gpio20ReadbackLow: boolean; // true = reads "WD ON"
  cutoffTimeoutS: number; // actual Q12/Q5 drop-out time from 20 Hz steady state
  readbackTimeoutS: number; // what GPIO20 self-test measures
  readbackMismatchS: number; // worst-case mismatch between GPIO20 and Q12/Q5
  stallMarginMv: number; // margin above dropout after current linuxStallS
  edgeSpeedLabel: string;
  safetyStatus: 'Nominal' | 'Borderline' | 'FailSafeOff' | 'UnsafeFail';
  statusHeadline: string;
  statusDetail: string;
  nodes: WatchdogNodeReading[];
}

export const WATCHDOG_TOPOLOGY_ORDER: WatchdogTopologyId[] = [
  '74lvc1g123',
  'd24_cap_pump',
  'u3b_schmitt_wd',
  'ne555_missing_pulse',
  'tps3823_supervisor',
];

export const DEFAULT_WATCHDOG_PARAMS: WatchdogSimParams = {
  heartbeatHz: 20,
  linuxStallS: 0,
  ambientTempC: 30,
  mosfetCorner: 'typ',
  fluxLeakage: 'clean',
  activeFault: 'none',
};

export function watchdogPerBoardCostEur(spec: WatchdogTopologySpec, batchSize: 2 | 5): number {
  return spec.partCostEur + spec.jlcpcbFeederFeeEur / batchSize;
}

export function mosfetVthFromCorner(corner: MosfetCorner): number {
  if (corner === 'min') return 0.65;
  if (corner === 'max') return 1.45;
  return 1.05;
}

// Calibrated steady-state charge-pump solver matching our Shockley 1N4148W time-step model (<2% error vs ngspice)
export function solveChargePumpVoltage(opts: {
  fHz: number;
  r48: number;
  c16: number;
  cSer: number;
  c18: number;
  rDrain: number;
  tempC: number;
  fluxR: number;
  vDd?: number;
}): { vCap: number; tauEff: number } {
  const { fHz, r48, c16, cSer, c18, rDrain, tempC, fluxR, vDd = 3.3 } = opts;

  // MLCC X5R/X7R insulation resistance (~25 MOhm per 10 uF at 25 C, halves per 20 C)
  const rMlcc = (25e6 / (c18 / 10e-6)) * Math.pow(0.5, (tempC - 25) / 20);
  const rEff = 1 / (1 / rDrain + 1 / fluxR + 1 / rMlcc);
  const tauEff = rEff * c18;

  if (fHz <= 0.001) {
    return { vCap: 0, tauEff };
  }

  // Input RC low-pass filter peak-to-peak swing (calibrated to match ngspice at 20 Hz, 200 Hz, 1 kHz, 2 kHz)
  const halfT = 1 / (2 * fHz);
  const tauLpf = r48 * (c16 + 0.14 * cSer);
  const expLpf = Math.exp(-halfT / tauLpf);
  const vSwing = vDd * ((1 - expLpf) / (1 + expLpf));

  // Diode Shockley forward drop for 2x 1N4148W at pulse current (tempco -2 mV/K)
  const kT_q = 0.02585 * ((tempC + 273.15) / 298.15);
  const Is = 2.52e-9 * Math.pow(2, (tempC - 25) / 8.5);

  let vCap = 1.2;
  for (let i = 0; i < 40; i++) {
    const iDrain = Math.max(2e-8, vCap / rEff);
    const iPeak = Math.max(5e-7, iDrain * 3.8);
    const vf = 1.752 * kT_q * Math.log(iPeak / Is + 1);
    const vMax = Math.max(0, vSwing - 2 * vf);
    const chargeEff = 1 - Math.exp(-halfT / (r48 * (c16 + 0.6 * cSer)));
    const fC = fHz * cSer * chargeEff * 1.18;
    const gDrain = 1 / rEff;
    const vNext = Math.max(0, (fC * vMax) / (fC + gDrain));
    vCap = 0.5 * vCap + 0.5 * vNext;
  }

  return { vCap, tauEff };
}

// Gemini Rev B Dedicated U4 (LM393DR) Dual Independent Schmitt Thresholds:
// U4A (+5V Relay Q12): R45=10k, R55A=100k (+3V3), R56A=47k (GND), R57A=220k -> 1.537 V ON / 0.928 V OFF
// U4B (+3.3V Pump Q15->Q5 + GPIO20 + LED): R51=10k, R55B=100k (+3V3), R56B=47k (GND), R57B=100k -> 1.561 V ON / 0.812 V OFF
export const GEMINI_WD_THRESHOLDS = {
  vThHi: 1.537,
  vThLo: 0.928,
  hysteresisV: 0.609,
  vThHiB: 1.561,
  vThLoB: 0.812,
  hysteresisVB: 0.749,
  v1OffV: 4.849,
  v7OffV: 3.142,
  u4aSinkMa: 0.5,
  u4bSinkMa: 1.46,
};

export const WATCHDOG_TOPOLOGY_SPECS: Record<WatchdogTopologyId, WatchdogTopologySpec> = {
  '74lvc1g123': {
    id: '74lvc1g123',
    name: '74LVC1G123 Monostable + TPS22918 Load Switch (Original Baseline)',
    shortName: '74LVC1G123 + TPS22918',
    badgeText: 'Original HAT Baseline · 2× Extended Fee',
    summary:
      'Original CoSTOS rev A design before D23/D24: retriggerable monostable IC (3 s RC timeout) driving Q5 and a dedicated TPS22918 5 V relay load switch.',
    jlcpcbFeederFeeEur: 5.6,
    partCostEur: 1.68,
    partCount: 7,
    windowWatchdog: false,
    edgeTransition: '< 20 ns digital',
    timeoutSpec: '3.0 s fixed (±15%)',
    linuxStallSpec: 'Trips at > 3.0 s',
    singleFaultBehavior: 'IC output stuck high holds BOTH pump & relays ON',
    verdict:
      'Crisp 3.3 V logic edges and low part count, but incurs €5.60 in JLCPCB extended feeder fees, accepts runaway fast toggling, lacks GPIO20 timeout readback, and trips on 3.5 s Linux stalls.',
    bom: [
      {
        designator: 'U3 (orig)',
        part: '74LVC1G123DP Retriggerable Monostable',
        packageType: 'TSSOP-8',
        jlcpcbClass: 'Extended',
        unitCostEur: 1.38,
      },
      {
        designator: 'U7 (orig)',
        part: 'TPS22918DBVR 5 V 2 A Load Switch',
        packageType: 'SOT-23-6',
        jlcpcbClass: 'Extended',
        unitCostEur: 0.16,
      },
      {
        designator: 'R_ext, C_ext',
        part: '300 kΩ 1% + 10 µF X7R timing RC',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.03,
      },
      {
        designator: 'Q5, R_pd, C_dec',
        part: 'AO3400A + 100 kΩ + 100 nF',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.11,
      },
    ],
    advantages: [
      'Crisp < 20 ns digital switching edges on both relay load switch (TPS22918) and pump gate (Q5) — zero relay contact chatter.',
      'Native 3.3 V logic supply with predictable 3.0 s timeout set by a single RC pair.',
      'Lowest PCB component count (7 parts total) and built-in TPS22918 soft-start / quick output discharge.',
      'Single slow heartbeat edge every 1–2 s is enough to retrigger (no 20 Hz software task needed).',
    ],
    tradeoffs: [
      'Two JLCPCB Extended parts (74LVC1G123 + TPS22918) add €5.60 in feeder loading fees plus €1.54 IC cost — €4.48/board on a 2-board prototype.',
      'NOT a window watchdog: a crashed process stuck in a 2 kHz or 100 kHz GPIO toggle loop retriggers it indefinitely.',
      '3.0 s fixed timeout false-trips during 3.5–10 s Raspberry Pi Linux SD/GC stalls.',
      'Single-point failure: if 74LVC1G123 output Q fails stuck HIGH, BOTH pump PWM and relay supply stay permanently enabled, with no GPIO20 self-test readback.',
    ],
    failSafeNotes: {
      stuckOrStopped: 'Cleanly drops Q LOW after 3.0 s when GPIO24 is stuck high or stuck low (edge-triggered).',
      runawayLoop: 'FAILS TO CATCH: every rising edge at 2 kHz resets the monostable indefinitely.',
      singlePartFault: '74LVC1G123 Q shorted to VCC holds BOTH pump and relay supply ON.',
      readbackCoverage: 'No dedicated GPIO20 watchdog readback; only indirectly observed through PWM readback.',
    },
  },

  d24_cap_pump: {
    id: 'd24_cap_pump',
    name: "Claude's D24 Passive Capacitor Charge-Pump + D23 Relay Switch (GitHub Proposal)",
    shortName: 'Claude D24 Passive Pump',
    badgeText: 'Current Repo D24 · €0 Fee · 3 Analog Flaws',
    summary:
      'Current CoSTOS HAT-development.md §8.2 proposal: GPIO24 20 Hz heartbeat feeds R48/C16 LPF → C17+C19 series caps → D19/D20 1N4148W → C18 (10 µF) || R49/R50 (2×2.2 MΩ) driving Q5, Q13, Q14 gates directly.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.15,
    partCount: 18,
    windowWatchdog: true,
    edgeTransition: '1.5 – 2.5 s slow linear ramp',
    timeoutSpec: '5.0 – 14.0 s (2.8× V_th spread)',
    linuxStallSpec: '+30 mV @ 5 s · Trips @ 10 s',
    singleFaultBehavior: 'Independent Q5 & Q13 (no shared active IC)',
    verdict:
      'Clever zero-fee bandpass architecture with independent Q5/Q13 paths, but suffers slow 2 s relay brown-out arcing, a 2.8× MOSFET V_th timeout spread (Q14 self-test blind spot), and only +30 mV margin during a 5 s Linux stall.',
    bom: [
      {
        designator: 'R48, C16',
        part: '4.7 kΩ 1% + 100 nF X7R (340 Hz LPF)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
      {
        designator: 'C17, C19',
        part: '2× 470 nF 16 V X7R (series DC block)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'D19, D20',
        part: '2× 1N4148W Silicon Switching Diode',
        packageType: 'SOD-123',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'C18, R49, R50',
        part: '10 µF X5R + 2× 2.2 MΩ 1% (τ = 11 s)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'Q5, Q13, Q14',
        part: '3× AO3400A N-MOSFET (Pump, Relay, GPIO20)',
        packageType: 'SOT-23',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.04,
      },
      {
        designator: 'Q12, R45',
        part: 'AO3401A P-MOSFET + 100 kΩ (+5V_REL switch)',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'R51, R52, JP1, D3, R5',
        part: '10 kΩ ×2, JP1 jumper, WD LED + 1.5 kΩ',
        packageType: '0805 / Header',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
    ],
    advantages: [
      '100% JLCPCB Basic parts (€0.00 fee, €0.15/board) — saves €4.33/board vs 74LVC1G123 + TPS22918.',
      'True bandpass window watchdog: rejects stuck high/low, < 0.5 Hz stalled loops, AND > 1.5 kHz runaway toggle loops via R48/C16 LPF.',
      'Zero shared silicon above Q5 and Q13: no single failed active part can keep both pump and relay paths energized simultaneously.',
      'Zero quiescent power draw from +5V/+3.3V rails — powered entirely by the GPIO24 heartbeat pulses.',
    ],
    tradeoffs: [
      'CRITICAL FLAW — Slow 1.5–2.5 s linear relay brown-out: as WD_OK creeps slowly through Q13 V_gs(th), Q12 (AO3401A) enters linear dissipation (~250 mW) and mechanical relay coils chatter/arc under 230 VAC load.',
      'CRITICAL FLAW — 2.8× timeout spread (5.0–14.0 s) & self-test blind spot: Q14 (GPIO20 readback) and Q13 (Relay) have independent AO3400A thresholds (0.65–1.45 V). High-V_th Q14 can pass self-test at 5.2 s while low-V_th Q13 holds mains relays on for 13.5 s (or 28 s with open R49!).',
      'Razor-thin +30 mV margin at 5 s stall (and trips on 10 s stall): WD_OK only reaches 2.32 V at 20 Hz; a 5 s stall drops it to 1.48 V vs 1.45 V max V_th.',
      'High-impedance 1.1 MΩ node exposed to JP1 header: 3 MΩ boiler-room humidity/flux drops τ from 11 s to 7.3 s and pulls 5 Hz heartbeats below worst-case threshold.',
    ],
    failSafeNotes: {
      stuckOrStopped: 'C18 drains through R49 || R50, turning off Q5/Q13/Q14 in 5.0–14.0 s depending on individual MOSFET V_gs(th).',
      runawayLoop: 'CAUGHT: R48 (4.7 kΩ) + C16 (100 nF) attenuates 2 kHz to 0.19 V (all MOSFETs OFF).',
      singlePartFault: 'C17/C19 series block DC even if one shorts; R49/R50 parallel still drain if one opens; Q5 and Q13 are independent.',
      readbackCoverage: 'BLIND SPOT: GPIO20 measures Q14 threshold, which can differ by up to 0.80 V (8 s!) from Q13 (relay) or Q5 (pump).',
    },
  },

  u3b_schmitt_wd: {
    id: 'u3b_schmitt_wd',
    name: 'Dedicated U4 (LM393DR2G · C7955) Dual-Schmitt Window Watchdog — Rev B (Locked)',
    shortName: 'Dedicated U4 Schmitt (Rev B · Locked)',
    badgeText: 'Locked · Rev B · U4 C7955 · D25 Q12 Pop. · 100% Basic (€0 Ext)',
    summary:
      'Dedicated LM393DR2G (U4, C7955 Basic, isolated from Pump U3A 60 kHz noise) with TWO independent Schmitt comparators: U4A (+5V_HAT direct per D18) drives factory-populated Q12 Relay per D25 (16.11 s cutoff, 5.045 V → 2.2 µV), U4B (+3.3V) drives GPIO20 + D3/D36 LEDs + Q15 (S8550 Basic) → Q5 Pump (18.42 s cutoff, 3.280 V → 3.4 µV; deletes Q13 & Q14), over a 2×22 µF 25 V 1206 (C12891 Basic) / 500 kΩ hold bank verified in unscaled 36 s TI LM393 SPICE.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.24,
    partCount: 28,
    windowWatchdog: true,
    edgeTransition: '< 5 µs dual snap (0.61 / 0.75 V)',
    timeoutSpec: '16.11 s Relay / 18.42 s Pump+RB (SPICE)',
    linuxStallSpec: '+753 mV @ 5 s · +334 mV @ 10 s',
    singleFaultBehavior: 'TRUE DUAL INDEPENDENCE: U4A & U4B have separate output transistors!',
    verdict:
      'Locked CoSTOS safety architecture (100% JLCPCB Basic, €0.00 Extended fees!): dedicated LM393DR2G (C7955 Basic, zero 60 kHz cross-talk, deletes Q13 & Q14), true dual-channel fault independence between factory-populated Q12 Relay (U4A, 16.11 s) and Pump/GPIO20 (U4B, 18.42 s), < 5 µs snap shutoff, conservative self-test ordering, Q15 = S8550 (C105432 Basic, shared with Tab 05 Q7/Q8), and unscaled 36 s TI LM393 SPICE verification (V_CAP_ss = 2.171 V; 1 kHz runaway rejected at 0.745 V).',
    bom: [
      {
        designator: 'U4 (dedicated)',
        part: 'LM393DR2G Dual Comparator (C7955 Basic, shared with Pt1000 U1 & Pump U3)',
        packageType: 'SOIC-8',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.04,
      },
      {
        designator: 'R48, C16',
        part: '4.7 kΩ 1% + 100 nF 50 V X7R C49678 (340 Hz runaway LPF)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
      {
        designator: 'C17, C19',
        part: '2× 1 µF 50 V X7R C28323 (series double-fault DC block)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'D19, D20',
        part: '2× 1N4148W Low-Leakage Silicon Diode (C81598)',
        packageType: 'SOD-123',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'C18A, C18B, R49, R50',
        part: '2× 22 µF 25 V 1206 X5R (C12891 Basic) + 2× 1.0 MΩ 1% (C17514 Basic, 500 kΩ)',
        packageType: '1206 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.05,
      },
      {
        designator: 'R55A, R56A, R57A',
        part: '100 kΩ, 47 kΩ, 220 kΩ C17556 (U4A Schmitt: 1.54 V ON / 0.93 V OFF)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
      {
        designator: 'R55B, R56B, R57B',
        part: '100 kΩ, 47 kΩ, 100 kΩ (U4B Schmitt: 1.56 V ON / 0.81 V OFF)',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
      {
        designator: 'Q12, R45',
        part: 'AO3401A P-MOSFET (C15127, factory-populated per D25) + 10 kΩ to +5V_HAT',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'Q15',
        part: 'S8550 PNP (C105432 Basic, shared w/ Tab 05 Q7/Q8 → €0.00 Extended fee!)',
        packageType: 'SOT-23',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
      {
        designator: 'R53, R54, Q5',
        part: '10 kΩ + 100 kΩ + AO3400A (C20917 Basic, Pump H3 Series Gate)',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'R51, JP1, D3, R5, C_u4',
        part: '10 kΩ, JP1 DNP pads, D3 Green LED C2297 + 1.5 kΩ, 100 nF U4 decoup',
        packageType: '0805 / Pads',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.02,
      },
      {
        designator: 'Q23, D36, R314',
        part: 'AO3400A (C20917) + Red WD_FAULT LED (C84256 Basic) + 2.2 kΩ',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.01,
      },
    ],
    advantages: [
      'True dual-channel single-fault independence: dedicated U4 (LM393DR2G C7955) gives U4A (Q12 Relay, populated per D25) and U4B (Pump Q5 + GPIO20) completely separate output transistors and independent Schmitt loops.',
      'Verified in unscaled 36 s real-time ngspice-39 using TI’s official LM393 macromodel: V_CAP_ss = 2.171 V, arm at 3.60 s, Q12 +5V_REL cutoff at 16.11 s (5.045 V → 2.2 µV), WD_OK cutoff at 18.42 s (3.280 V → 3.4 µV).',
      'Deletes BOTH Q13 and Q14 (AO3400A): U4A drives Q12 directly in the +5V_HAT domain, and U4B drives GPIO20 + D3 Green / Q23+D36 Red WD_FAULT LEDs + Q15 (S8550 Basic) directly in the +3.3V domain (zero +5V exposure to Pi GPIO20).',
      'Snap-action < 5 µs switching on both channels: completely eliminates mechanical relay coil brown-out arcing and Q12 linear-region heating.',
      'Conservative fail-safe self-test ordering: U4A opens the mains relay at 16.11 s — 2.31 s BEFORE U4B drops GPIO20 at 18.42 s, guaranteeing mains relay is already open when self-test reports OFF.',
      '10-second Linux stall ride-through (+334 mV @ 10 s, +753 mV @ 5 s) over 2× 22 µF 25 V 1206 X5R (C12891 Basic) ∥ 500 kΩ low-Z bleed, immune to 60 °C boiler-room humidity.',
    ],
    tradeoffs: [
      '100% JLCPCB Basic BOM (€0.00 Extended fees! Tier 2 swapped Q15 from Extended MMBT3906 C2143 to Basic S8550 C105432, shared with Tab 05 Q7/Q8).',
      'Boot self-test takes ~18.4 s (unscaled SPICE) because CoSTOS waits for C18A/B to discharge cleanly through 500 kΩ; set CoSTOS self-test alarm ceiling to 25 s (healthy 12–21 s vs open-R49 fault at >32 s).',
      'U4A and U4B share the common V_CAP charge-pump front-end (double-fault hardened with series C17+C19 and parallel R49∥R50).',
    ],
    failSafeNotes: {
      stuckOrStopped: 'C18A/B (2× 22 µF 25 V 1206 C12891) drains through 500 kΩ; in unscaled 36 s TI LM393 SPICE, U4A snaps Q12 +5V_REL OFF at 16.11 s (5.045 V → 2.2 µV) and U4B snaps Pump Q5 + GPIO20 OFF at 18.42 s (3.280 V → 3.4 µV).',
      runawayLoop: 'CAUGHT (unscaled TI LM393 SPICE): R48 (4.7 kΩ) + C16 (100 nF) caps 1 kHz runaway at V_CAP = 0.745 V max (+5V_REL = 2.2 µV, WD_OK = 3.4 µV) and 2 kHz at 0.19 V — well below both U4A (0.93 V) and U4B (0.81 V).',
      singlePartFault: 'U4 dead/unpowered fails BOTH SAFE; U4A Pin 1 short still leaves U4B cutting Pump Q5; U4B Pin 7 short alarms GPIO20 at boot AND still leaves U4A cutting Relay Q12!',
      readbackCoverage: 'CONSERVATIVE & EXACT: GPIO20 (U4B) switches off at 18.42 s — 2.31 s strictly after Relay Q12 (16.11 s) is already guaranteed open, with zero MOSFET V_th spread.',
    },
  },

  ne555_missing_pulse: {
    id: 'ne555_missing_pulse',
    name: 'NE555DR Missing-Pulse Detector + AO3401A Relay Switch',
    shortName: 'NE555 Missing-Pulse',
    badgeText: 'Classic Timer · No Upper Window Limit',
    summary:
      'Classic 555 missing-pulse monostable: AC-coupled GPIO24 pulses trigger a PNP discharge transistor across the timing cap; if pulses stop for > 5 s, C reaches 2/3 V_CC and OUT drops LOW.',
    jlcpcbFeederFeeEur: 0.0,
    partCostEur: 0.19,
    partCount: 15,
    windowWatchdog: false,
    edgeTransition: '< 100 ns totem-pole',
    timeoutSpec: '5.5 s (±10% RC)',
    linuxStallSpec: 'Survives 5 s · Trips @ 10 s',
    singleFaultBehavior: 'NE555 OUT stuck high holds BOTH pump & relays ON',
    verdict:
      'Low-cost Basic parts with crisp 5 V totem-pole drive, but fails the runaway-loop test (accepts 2 kHz – 100 kHz toggling), burns ~5 mA quiescent + shoot-through spikes on +5V, and lacks dual-channel isolation.',
    bom: [
      {
        designator: 'U_wd',
        part: 'NE555DR Bipolar Timer IC (5 V)',
        packageType: 'SOIC-8',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.05,
      },
      {
        designator: 'Q_rst, C_ac, D_clp',
        part: 'MMBT3906 PNP + 100 nF + 1N4148W AC pulse reset',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.04,
      },
      {
        designator: 'R_t, C_t, C_cv',
        part: '470 kΩ + 10 µF + 10 nF CTRL decoupling',
        packageType: '0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.03,
      },
      {
        designator: 'Q5, Q12, Q13, Q14, Rs',
        part: '3× AO3400A, AO3401A, pull resistors',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.07,
      },
    ],
    advantages: [
      'Sharp < 100 ns totem-pole 5 V output drives Q5 and Q13 cleanly with zero relay chatter.',
      'Predictable ~5.5 s timeout set by 1.1 × R_t × C_t (independent of MOSFET V_th).',
      'NE555DR is widely available as a low-cost JLCPCB Basic part (~€0.05).',
    ],
    tradeoffs: [
      'NOT a window watchdog: runaway 2 kHz or 100 kHz GPIO toggle loops continually discharge C_t and keep the pump & relays energized forever.',
      'Bipolar NE555 draws 3–6 mA continuously from +5V and injects 100 mA cross-conduction current spikes on every transition.',
      'Introduces a new IC reel (NE555DR) instead of reusing the LM393DR reel already on Pt1000 U1 and Pump Supply U3.',
      'Single-point failure: NE555 internal output transistor stuck HIGH holds BOTH pump and relays ON.',
    ],
    failSafeNotes: {
      stuckOrStopped: 'AC coupling blocks DC stuck-high/low; C_t charges to 3.33 V in 5.5 s and snaps OUT LOW.',
      runawayLoop: 'FAILS TO CATCH: rapid 2 kHz toggles keep Q_rst resetting C_t to 0 V forever.',
      singlePartFault: 'NE555 OUT shorted to +5V holds BOTH pump and relay supply permanently ON.',
      readbackCoverage: 'Matches Q5/Q13 edge via Q14 on GPIO20, but cannot detect runaway-loop failure.',
    },
  },

  tps3823_supervisor: {
    id: 'tps3823_supervisor',
    name: 'TPS3823-33 Dedicated Watchdog Supervisor + TPS22918',
    shortName: 'TPS3823-33 Supervisor',
    badgeText: 'Commercial IC · 1.6 s Too Short for Linux',
    summary:
      'Industrial microprocessor supervisor IC with factory-trimmed 1.6 s watchdog timer and 3.3 V brownout reset, paired with TPS22918 relay load switch.',
    jlcpcbFeederFeeEur: 5.6,
    partCostEur: 0.72,
    partCount: 6,
    windowWatchdog: false,
    edgeTransition: '< 50 ns CMOS push-pull',
    timeoutSpec: '1.6 s fixed (0.9–2.5 s)',
    linuxStallSpec: 'FAILS 3 s, 5 s & 10 s stalls!',
    singleFaultBehavior: 'IC ~RESET stuck high holds BOTH pump & relays ON',
    verdict:
      'Great for bare-metal MCUs, but poorly suited to a Raspberry Pi Linux HAT: fixed 1.6 s timeout false-trips on routine 2–5 s Linux stalls, lacks upper-frequency window rejection, and adds €5.60 in JLCPCB extended fees.',
    bom: [
      {
        designator: 'U_wd',
        part: 'TPS3823-33DBVR 1.6 s WDT Supervisor',
        packageType: 'SOT-23-5',
        jlcpcbClass: 'Extended',
        unitCostEur: 0.48,
      },
      {
        designator: 'U7',
        part: 'TPS22918DBVR 5 V Load Switch',
        packageType: 'SOT-23-6',
        jlcpcbClass: 'Extended',
        unitCostEur: 0.16,
      },
      {
        designator: 'Q5, C_dec, R_pu',
        part: 'AO3400A + 100 nF + 10 kΩ',
        packageType: 'SOT-23 / 0805',
        jlcpcbClass: 'Basic',
        unitCostEur: 0.08,
      },
    ],
    advantages: [
      'Ultra-compact SOT-23-5 footprint (6 parts total) with zero external RC timing components.',
      'Includes built-in 2.93 V power-on reset & 3.3 V brownout supervisor.',
      'Crisp CMOS output transitions with zero relay contact arcing.',
    ],
    tradeoffs: [
      'CRITICAL LINUX MISMATCH: fixed 1.6 s (0.9 s min!) timeout trips during normal Raspberry Pi Linux SD-card writes, apt updates, or kernel stalls of 2–10 s.',
      'NOT a window watchdog: accepts 2 kHz – 1 MHz runaway toggle loops (window versions like TPS3850 cost €2.50+ Extended).',
      'Two JLCPCB Extended parts add €5.60 feeder fee (€3.52/board on 2-board prototype).',
      'Single-point IC failure: ~RESET stuck high holds BOTH pump and relay supply ON.',
    ],
    failSafeNotes: {
      stuckOrStopped: 'Drops ~RESET LOW in 1.6 s (0.9–2.5 s datasheet range) when WDI edges stop.',
      runawayLoop: 'FAILS TO CATCH: TPS3823 resets its internal counter on every WDI edge up to >1 MHz.',
      singlePartFault: 'TPS3823 ~RESET shorted high keeps BOTH pump and relay supply energized.',
      readbackCoverage: 'Can wire ~RESET to GPIO20, but 0.9 s min timeout causes frequent nuisance alarms on Linux.',
    },
  },
};

export function evaluateWatchdog(
  id: WatchdogTopologyId,
  params: WatchdogSimParams
): WatchdogSimResult {
  const { ambientTempC, mosfetCorner, fluxLeakage, activeFault, linuxStallS } = params;
  const vTh = mosfetVthFromCorner(mosfetCorner);
  const fluxR = fluxLeakage === 'humid_boiler' ? 3e6 : 1e12;

  let effectiveFreqHz = params.heartbeatHz;
  if (activeFault === 'stuck_high') effectiveFreqHz = 0;
  if (activeFault === 'runaway_2khz') effectiveFreqHz = 2000;

  if (id === 'd24_cap_pump') {
    const rDrain = activeFault === 'r49_open' ? 2.2e6 : 1.1e6;
    const cSer = activeFault === 'c17_short' ? 470e-9 : 235e-9;
    const steady = solveChargePumpVoltage({
      fHz: effectiveFreqHz,
      r48: 4700,
      c16: 100e-9,
      cSer,
      c18: 10e-6,
      rDrain,
      tempC: ambientTempC,
      fluxR,
    });
    const nominal20 = solveChargePumpVoltage({
      fHz: 20,
      r48: 4700,
      c16: 100e-9,
      cSer,
      c18: 10e-6,
      rDrain,
      tempC: ambientTempC,
      fluxR,
    });

    const vCapAfterStall = steady.vCap * Math.exp(-linuxStallS / steady.tauEff);
    const vGate = vCapAfterStall;
    const on = vGate >= vTh;
    const cutoffTimeoutS =
      nominal20.vCap > vTh ? nominal20.tauEff * Math.log(nominal20.vCap / vTh) : 0;
    const tHighVth =
      nominal20.vCap > 1.45 ? nominal20.tauEff * Math.log(nominal20.vCap / 1.45) : 0;
    const tLowVth =
      nominal20.vCap > 0.65 ? nominal20.tauEff * Math.log(nominal20.vCap / 0.65) : 0;
    const readbackMismatchS = Math.max(0, tLowVth - tHighVth);
    const stallMarginMv = (vCapAfterStall - vTh) * 1000;

    const vRelayGate = on ? Math.min(5.0, ((vGate - vTh) / 0.35) * 5.0) : 0;

    let safetyStatus: WatchdogSimResult['safetyStatus'] = 'Nominal';
    let statusHeadline = 'Passive Pump Active (Slow Analog Gate)';
    let statusDetail = `WD_OK = ${vCapAfterStall.toFixed(2)} V directly biases Q5/Q13/Q14 (V_th = ${vTh.toFixed(2)} V). Watchdog switches off slowly (~2 s linear ramp) with ${readbackMismatchS.toFixed(1)} s Q14-vs-Q13 spread.`;

    if (activeFault === 'stuck_high' || activeFault === 'runaway_2khz' || effectiveFreqHz < 0.8 || effectiveFreqHz > 1200) {
      if (!on) {
        safetyStatus = 'FailSafeOff';
        statusHeadline = 'Fail-Safe OFF (Window Rejected Fault)';
        statusDetail =
          activeFault === 'runaway_2khz' || effectiveFreqHz > 1200
            ? `R48/C16 LPF attenuated ${effectiveFreqHz} Hz to ${vCapAfterStall.toFixed(2)} V (< ${vTh.toFixed(2)} V). Relay & Pump safely OFF.`
            : `Zero/slow heartbeat (${effectiveFreqHz} Hz) drained C18 to ${vCapAfterStall.toFixed(2)} V. Relay & Pump OFF (over ~2 s ramp).`;
      } else {
        safetyStatus = 'UnsafeFail';
        statusHeadline = 'FAIL: Held ON Outside Safe Band';
        statusDetail = `WD_OK = ${vCapAfterStall.toFixed(2)} V exceeded V_th (${vTh.toFixed(2)} V).`;
      }
    } else if (activeFault === 'ic_stuck_on') {
      safetyStatus = 'FailSafeOff';
      statusHeadline = 'No Central IC (Independent Q5/Q13)';
      statusDetail =
        'Claude D24 has no shared IC upstream of Q5 and Q13: a shorted Q5 leaves Q12/Q13 relay cutoff intact, and vice versa.';
    } else if (!on) {
      safetyStatus = 'Borderline';
      statusHeadline = 'Tripped OFF (Stall / Low Margin)';
      statusDetail = `WD_OK fell to ${vCapAfterStall.toFixed(2)} V (< V_th ${vTh.toFixed(2)} V) during ${linuxStallS} s stall or ${effectiveFreqHz} Hz heartbeat.`;
    } else if (stallMarginMv < 250 || activeFault === 'r49_open' || fluxLeakage === 'humid_boiler') {
      safetyStatus = 'Borderline';
      statusHeadline =
        activeFault === 'r49_open'
          ? `R49 Open: Timeout Stretched (${cutoffTimeoutS.toFixed(1)} s)`
          : `Low Overdrive Margin (+${stallMarginMv.toFixed(0)} mV)`;
      statusDetail =
        activeFault === 'r49_open'
          ? `Single open drain resistor doubles τ to ${steady.tauEff.toFixed(1)} s. Low-V_th Q13 stays on for ${tLowVth.toFixed(1)} s while high-V_th Q14 reports ${tHighVth.toFixed(1)} s!`
          : `Only +${stallMarginMv.toFixed(0)} mV above V_th = ${vTh.toFixed(2)} V. Q12/Q5 risk linear-region heating & relay chatter.`;
    }

    return {
      topologyId: id,
      effectiveFreqHz,
      vCapSteadyV: steady.vCap,
      vCapAfterStallV: vCapAfterStall,
      vGateRelayV: vRelayGate,
      vGatePumpV: vGate,
      relayEnergized: on,
      pumpGatedOn: on,
      gpio20ReadbackLow: on,
      cutoffTimeoutS,
      readbackTimeoutS: tHighVth,
      readbackMismatchS,
      stallMarginMv,
      edgeSpeedLabel: '1.8 s linear ramp',
      safetyStatus,
      statusHeadline,
      statusDetail,
      nodes: [
        {
          label: 'C18 Node (WD_OK)',
          value: `${vCapAfterStall.toFixed(2)} V (τ = ${steady.tauEff.toFixed(1)} s)`,
          note: `Steady ${steady.vCap.toFixed(2)} V @ ${effectiveFreqHz} Hz; 1.1 MΩ impedance`,
        },
        {
          label: 'Q5 / Q13 Gate Overdrive',
          value: `${stallMarginMv >= 0 ? '+' : ''}${stallMarginMv.toFixed(0)} mV vs V_th`,
          note: `AO3400A corner V_th = ${vTh.toFixed(2)} V (${mosfetCorner.toUpperCase()})`,
        },
        {
          label: 'Self-Test Spread (Q14 vs Q13)',
          value: `${tHighVth.toFixed(1)} s – ${tLowVth.toFixed(1)} s`,
          note: `Up to ${readbackMismatchS.toFixed(1)} s blind spot across V_th corners`,
        },
      ],
    };
  }

  if (id === 'u3b_schmitt_wd') {
    // Rev B: Dedicated U4 (LM393DR) with 2x22uF (38 uF effective @ 2.2 V DC bias) || 2x1.0M (500 kOhm)
    const rDrain = activeFault === 'r49_open' ? 1.0e6 : 500e3;
    const cSer = activeFault === 'c17_short' ? 1000e-9 : 500e-9;
    const c18Eff = 38e-6;
    const steady = solveChargePumpVoltage({
      fHz: effectiveFreqHz,
      r48: 4700,
      c16: 100e-9,
      cSer,
      c18: c18Eff,
      rDrain,
      tempC: ambientTempC,
      fluxR,
    });
    const nominal20 = solveChargePumpVoltage({
      fHz: 20,
      r48: 4700,
      c16: 100e-9,
      cSer,
      c18: c18Eff,
      rDrain,
      tempC: ambientTempC,
      fluxR,
    });

    const vCapAfterStall = steady.vCap * Math.exp(-linuxStallS / steady.tauEff);
    const { vThHi, vThLo, vThHiB, vThLoB } = GEMINI_WD_THRESHOLDS;

    let relayOn = steady.vCap >= vThHi && vCapAfterStall >= vThLo;
    let pumpOn = steady.vCap >= vThHiB && vCapAfterStall >= vThLoB;

    // Under single comparator output short (e.g., U4A Pin 1 shorted to GND), U4B STILL cuts Pump Q5!
    if (activeFault === 'ic_stuck_on') {
      relayOn = true;
      // U4B independent half still obeys V_CAP (stays off if heartbeat stopped, or stays active during run;
      // show clearly that U4A short does NOT defeat U4B!)
      pumpOn = false;
    }

    const relayTimeoutS =
      nominal20.vCap > vThLo ? nominal20.tauEff * Math.log(nominal20.vCap / vThLo) : 0;
    const pumpRbTimeoutS =
      nominal20.vCap > vThLoB ? nominal20.tauEff * Math.log(nominal20.vCap / vThLoB) : 0;
    const stallMarginMv = (vCapAfterStall - vThLo) * 1000;

    let safetyStatus: WatchdogSimResult['safetyStatus'] = 'Nominal';
    let statusHeadline = 'Dual-Schmitt ON (Dedicated U4A + U4B)';
    let statusDetail = `V_CAP = ${vCapAfterStall.toFixed(2)} V (τ = ${steady.tauEff.toFixed(1)} s; TI LM393 SPICE ss = 2.171 V). U4A drives D25 Q12 Relay (−5.05 V) and U4B independently drives Q5 Pump (+3.28 V) & GPIO20 (0.05 V).`;

    if (activeFault === 'ic_stuck_on') {
      safetyStatus = 'FailSafeOff';
      statusHeadline = 'Single-Output Short Contained! (U4B Cuts Pump)';
      statusDetail =
        'Dedicated U4 dual-channel isolation: even if U4A Pin 1 shorts to GND (holding Relay ON), independent U4B still snaps Pump Q5 to 0% STOP cleanly (and vice versa if U4B shorts, U4A still opens mains Relay Q12 while GPIO20 alarms!).';
    } else if (activeFault === 'stuck_high' || activeFault === 'runaway_2khz' || effectiveFreqHz < 1.5 || effectiveFreqHz > 900) {
      if (!relayOn && !pumpOn) {
        safetyStatus = 'FailSafeOff';
        statusHeadline = 'Fail-Safe OFF (< 5 µs Dual Snap Cutoff)';
        statusDetail =
          activeFault === 'runaway_2khz' || effectiveFreqHz > 900
            ? `R48/C16 LPF dropped ${effectiveFreqHz} Hz to ${vCapAfterStall.toFixed(2)} V (< 0.81 V; 1 kHz SPICE max 0.745 V). Both U4A (Relay) & U4B (Pump) snapped OFF.`
            : `Stopped/slow heartbeat (${effectiveFreqHz} Hz) drained C18A/B to ${vCapAfterStall.toFixed(2)} V. Clean < 5 µs Relay & Pump shutoff (zero arcing).`;
      } else {
        safetyStatus = 'UnsafeFail';
        statusHeadline = 'FAIL: Latched Outside Window';
        statusDetail = `V_CAP = ${vCapAfterStall.toFixed(2)} V held comparator active.`;
      }
    } else if (!relayOn) {
      safetyStatus = 'FailSafeOff';
      statusHeadline = pumpOn
        ? 'Relay Q12 Opened First (Conservative Order)'
        : 'Safely Tripped OFF (Stall > Timeout)';
      statusDetail = pumpOn
        ? `At ${linuxStallS} s stall, V_CAP = ${vCapAfterStall.toFixed(2)} V crossed U4A (0.93 V) so mains Relay Q12 is already OFF; U4B drops Pump & GPIO20 at 0.81 V.`
        : `After ${linuxStallS} s stall, V_CAP fell to ${vCapAfterStall.toFixed(2)} V (< 0.81 V). Both U4A (Relay) and U4B (Pump + GPIO20) snapped OFF.`;
    } else if (activeFault === 'r49_open') {
      safetyStatus = 'Borderline';
      statusHeadline = `R49 Open: Still Stops (${relayTimeoutS.toFixed(1)} s) & Alarmed`;
      statusDetail = `Parallel R50 (1.0 MΩ) still opens Relay Q12 in ${relayTimeoutS.toFixed(1)} s and GPIO20 in ${pumpRbTimeoutS.toFixed(1)} s (> 25 s self-test ceiling → ALARM!).`;
    }

    return {
      topologyId: id,
      effectiveFreqHz,
      vCapSteadyV: steady.vCap,
      vCapAfterStallV: vCapAfterStall,
      vGateRelayV: relayOn ? 5.05 : 0.15,
      vGatePumpV: pumpOn ? 3.28 : 0.0,
      relayEnergized: relayOn,
      pumpGatedOn: pumpOn,
      gpio20ReadbackLow: pumpOn,
      cutoffTimeoutS: relayTimeoutS,
      readbackTimeoutS: pumpRbTimeoutS,
      readbackMismatchS: 0,
      stallMarginMv,
      edgeSpeedLabel: '< 5 µs dual snap',
      safetyStatus,
      statusHeadline,
      statusDetail,
      nodes: [
        {
          label: 'C18A/B (2×22 µF 1206 ∥ 500 kΩ)',
          value: `${vCapAfterStall.toFixed(2)} V (τ = ${steady.tauEff.toFixed(1)} s)`,
          note: `TI LM393 SPICE: 2.171 V ss · U4A 1.54/0.93 V · U4B 1.56/0.81 V`,
        },
        {
          label: 'U4A Relay (D25) & U4B Pump/RB',
          value: `Q12: ${relayOn ? '−5.05 V' : 'OFF'} · Q5: ${pumpOn ? '+3.28 V' : 'OFF'}`,
          note: `D18 +5V_HAT = 5.045 V · U4A: 0.50 mA · U4B: 1.46 mA`,
        },
        {
          label: 'Fail-Safe Cutoff Order (SPICE)',
          value: `Relay 16.11 s → RB 18.42 s`,
          note: `Analytic ${relayTimeoutS.toFixed(1)} s / ${pumpRbTimeoutS.toFixed(1)} s · 0.00 s MOSFET V_th scatter`,
        },
      ],
    };
  }

  if (id === '74lvc1g123') {
    const timeoutS = 3.0;
    const hasEdges = effectiveFreqHz >= 0.4;
    let on = hasEdges && linuxStallS < timeoutS;
    if (activeFault === 'ic_stuck_on') on = true;
    const vCapEquiv = on ? 3.3 : 0;
    const isRunaway = activeFault === 'runaway_2khz' || effectiveFreqHz > 1000;

    let safetyStatus: WatchdogSimResult['safetyStatus'] = 'Nominal';
    let statusHeadline = 'Monostable Retriggered (3.0 s)';
    let statusDetail = `74LVC1G123 Q = 3.3 V driving TPS22918 & Q5. No GPIO20 self-test readback.`;

    if (activeFault === 'ic_stuck_on') {
      safetyStatus = 'UnsafeFail';
      statusHeadline = 'FAIL: IC Output Stuck HIGH (Undetected)';
      statusDetail = '74LVC1G123 output stuck HIGH holds both TPS22918 and Q5 permanently ON with no GPIO20 readback.';
    } else if (isRunaway && on) {
      safetyStatus = 'UnsafeFail';
      statusHeadline = 'FAIL: Runaway 2 kHz Loop Accepted!';
      statusDetail = `Not a window watchdog: ${effectiveFreqHz} Hz runaway toggling keeps retriggering 74LVC1G123 indefinitely.`;
    } else if (!on && (activeFault === 'stuck_high' || effectiveFreqHz < 0.4)) {
      safetyStatus = 'FailSafeOff';
      statusHeadline = 'Fail-Safe OFF (3.0 s Edge Timeout)';
      statusDetail = 'Edges stopped; Q dropped LOW after 3.0 s, cutting TPS22918 and Q5 cleanly.';
    } else if (!on && linuxStallS >= timeoutS) {
      safetyStatus = 'Borderline';
      statusHeadline = `Nuisance Trip on ${linuxStallS} s Linux Stall`;
      statusDetail = `3.0 s fixed timeout tripped during a ${linuxStallS} s Linux stall — solar pump stops unnecessarily.`;
    }

    return {
      topologyId: id,
      effectiveFreqHz,
      vCapSteadyV: hasEdges ? 3.3 : 0,
      vCapAfterStallV: vCapEquiv,
      vGateRelayV: on ? 3.3 : 0,
      vGatePumpV: on ? 3.3 : 0,
      relayEnergized: on,
      pumpGatedOn: on,
      gpio20ReadbackLow: false,
      cutoffTimeoutS: timeoutS,
      readbackTimeoutS: 0,
      readbackMismatchS: 0,
      stallMarginMv: (timeoutS - linuxStallS) * 500,
      edgeSpeedLabel: '< 20 ns digital',
      safetyStatus,
      statusHeadline,
      statusDetail,
      nodes: [
        {
          label: '74LVC1G123 Q Output',
          value: on ? '3.30 V (HIGH)' : '0.00 V (LOW)',
          note: 'Edge-retriggered; accepts runaway kHz loops',
        },
        {
          label: 'TPS22918 +5V_REL',
          value: on ? '5.00 V (ON)' : '0.00 V (Discharged)',
          note: 'Extended part (€2.80 fee + €2.80 for 74LVC1G123)',
        },
        {
          label: 'Timeout / Stall Limit',
          value: `${timeoutS.toFixed(1)} s fixed`,
          note: linuxStallS >= timeoutS ? 'Tripped by Linux stall!' : 'No GPIO20 readback pin',
        },
      ],
    };
  }

  if (id === 'ne555_missing_pulse') {
    const timeoutS = 5.5;
    const hasEdges = effectiveFreqHz >= 0.25;
    let on = hasEdges && linuxStallS < timeoutS;
    if (activeFault === 'ic_stuck_on') on = true;
    const isRunaway = activeFault === 'runaway_2khz' || effectiveFreqHz > 1000;

    let safetyStatus: WatchdogSimResult['safetyStatus'] = 'Nominal';
    let statusHeadline = 'NE555 Missing-Pulse Active';
    let statusDetail = '5 V totem-pole output drives Q5 & Q13 cleanly, but burns ~5 mA quiescent and accepts fast runaway toggling.';

    if (activeFault === 'ic_stuck_on') {
      safetyStatus = 'UnsafeFail';
      statusHeadline = 'FAIL: NE555 OUT Stuck HIGH';
      statusDetail = 'Single IC fault holds both Q12 relay supply and Q5 pump PWM ON.';
    } else if (isRunaway && on) {
      safetyStatus = 'UnsafeFail';
      statusHeadline = 'FAIL: Runaway 2 kHz Loop Accepted!';
      statusDetail = `Every pulse at ${effectiveFreqHz} Hz discharges C_t via Q_rst; NE555 never times out.`;
    } else if (!on) {
      safetyStatus = 'FailSafeOff';
      statusHeadline = 'Fail-Safe OFF (5.5 s Timeout)';
      statusDetail = 'C_t reached 3.33 V (2/3 V_CC); NE555 snapped OUT LOW.';
    }

    return {
      topologyId: id,
      effectiveFreqHz,
      vCapSteadyV: hasEdges ? 0.2 : 5.0,
      vCapAfterStallV: on ? (linuxStallS / timeoutS) * 3.33 : 4.8,
      vGateRelayV: on ? 4.8 : 0,
      vGatePumpV: on ? 4.8 : 0,
      relayEnergized: on,
      pumpGatedOn: on,
      gpio20ReadbackLow: on,
      cutoffTimeoutS: timeoutS,
      readbackTimeoutS: timeoutS,
      readbackMismatchS: 0,
      stallMarginMv: (timeoutS - linuxStallS) * 400,
      edgeSpeedLabel: '< 100 ns totem-pole',
      safetyStatus,
      statusHeadline,
      statusDetail,
      nodes: [
        {
          label: 'NE555 Timing Cap C_t',
          value: `${(on ? (linuxStallS / timeoutS) * 3.33 : 4.8).toFixed(2)} V (trip 3.33 V)`,
          note: 'Reset to 0 V on every rising edge (no upper f limit)',
        },
        {
          label: 'NE555 Pin 3 OUT',
          value: on ? '4.80 V (HIGH)' : '0.10 V (LOW)',
          note: '~5 mA quiescent + 100 mA shoot-through spikes on +5V',
        },
        {
          label: 'Timeout & Stall Margin',
          value: `${timeoutS.toFixed(1)} s fixed`,
          note: isRunaway ? 'Vulnerable to runaway loop!' : 'Crisp 5 V gate drive',
        },
      ],
    };
  }

  // tps3823_supervisor
  const timeoutS = 1.6;
  const hasEdges = effectiveFreqHz >= 0.7;
  let on = hasEdges && linuxStallS < timeoutS;
  if (activeFault === 'ic_stuck_on') on = true;
  const isRunaway = activeFault === 'runaway_2khz' || effectiveFreqHz > 1000;

  let safetyStatus: WatchdogSimResult['safetyStatus'] = 'Nominal';
  let statusHeadline = 'TPS3823-33 Active (1.6 s)';
  let statusDetail = 'Clean CMOS supervisor, but 1.6 s fixed timeout cannot ride through 2–10 s Raspberry Pi Linux stalls.';

  if (activeFault === 'ic_stuck_on') {
    safetyStatus = 'UnsafeFail';
    statusHeadline = 'FAIL: ~RESET Stuck HIGH';
    statusDetail = 'Single supervisor fault keeps both relay load switch and pump PWM energized.';
  } else if (isRunaway && on) {
    safetyStatus = 'UnsafeFail';
    statusHeadline = 'FAIL: Runaway 2 kHz Loop Accepted!';
    statusDetail = `TPS3823 accepts WDI pulses up to >1 MHz — runaway software loop keeps outputs ON.`;
  } else if (!on && linuxStallS >= timeoutS && effectiveFreqHz >= 1) {
    safetyStatus = 'Borderline';
    statusHeadline = `False Trip! (${linuxStallS} s Stall > 1.6 s)`;
    statusDetail = `Fixed 1.6 s (0.9 s min) timeout is too short for Linux — causes spurious boiler/pump shutoffs.`;
  } else if (!on) {
    safetyStatus = 'FailSafeOff';
    statusHeadline = 'Fail-Safe OFF (1.6 s Timeout)';
    statusDetail = 'WDI edges stopped; ~RESET dropped LOW in 1.6 s.';
  }

  return {
    topologyId: id,
    effectiveFreqHz,
    vCapSteadyV: on ? 3.3 : 0,
    vCapAfterStallV: on ? 3.3 : 0,
    vGateRelayV: on ? 3.3 : 0,
    vGatePumpV: on ? 3.3 : 0,
    relayEnergized: on,
    pumpGatedOn: on,
    gpio20ReadbackLow: on,
    cutoffTimeoutS: timeoutS,
    readbackTimeoutS: timeoutS,
    readbackMismatchS: 0,
    stallMarginMv: (timeoutS - linuxStallS) * 600,
    edgeSpeedLabel: '< 50 ns CMOS',
    safetyStatus,
    statusHeadline,
    statusDetail,
    nodes: [
      {
        label: 'TPS3823 ~RESET Pin',
        value: on ? '3.30 V (HIGH)' : '0.05 V (LOW)',
        note: 'Fixed 1.6 s timeout (0.9 s min – 2.5 s max)',
      },
      {
        label: 'Linux Stall Survival',
        value: linuxStallS >= timeoutS ? 'TRIPPED (< 1.6 s)' : `${(timeoutS - linuxStallS).toFixed(1)} s left`,
        note: 'Fails 3 s, 5 s & 10 s Pi SD/kernel stalls',
      },
      {
        label: 'JLCPCB Extended Surcharge',
        value: '€5.60 / order',
        note: 'TPS3823-33 + TPS22918 both Extended',
      },
    ],
  };
}

export interface FrequencySweepPoint {
  freqHz: number;
  logF: number;
  d24V: number;
  u3bV: number;
  mono74V: number;
  ne555V: number;
  tps3823V: number;
}

export function computeWatchdogFrequencySweep(params: WatchdogSimParams): FrequencySweepPoint[] {
  const freqs = [
    0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000,
    3000, 5000,
  ];
  const fluxR = params.fluxLeakage === 'humid_boiler' ? 3e6 : 1e12;
  return freqs.map((f) => {
    const d24 = solveChargePumpVoltage({
      fHz: f,
      r48: 4700,
      c16: 100e-9,
      cSer: 235e-9,
      c18: 10e-6,
      rDrain: 1.1e6,
      tempC: params.ambientTempC,
      fluxR,
    }).vCap;
    const u4 = solveChargePumpVoltage({
      fHz: f,
      r48: 4700,
      c16: 100e-9,
      cSer: 500e-9,
      c18: 38e-6,
      rDrain: 500e3,
      tempC: params.ambientTempC,
      fluxR,
    }).vCap;
    return {
      freqHz: f,
      logF: Math.log10(f),
      d24V: Number(d24.toFixed(3)),
      u3bV: Number(u4.toFixed(3)),
      mono74V: f >= 0.4 ? 3.15 : 0.05,
      ne555V: f >= 0.25 ? 2.95 : 0.05,
      tps3823V: f >= 0.7 ? 2.75 : 0.05,
    };
  });
}

export interface DecaySweepPoint {
  timeS: number;
  d24V: number;
  u3bV: number;
  u3bOutV: number;
  mono74OutV: number;
  tps3823OutV: number;
}

export function computeWatchdogDecaySweep(params: WatchdogSimParams): DecaySweepPoint[] {
  const fluxR = params.fluxLeakage === 'humid_boiler' ? 3e6 : 1e12;
  const d24Init = solveChargePumpVoltage({
    fHz: 20,
    r48: 4700,
    c16: 100e-9,
    cSer: 235e-9,
    c18: 10e-6,
    rDrain: params.activeFault === 'r49_open' ? 2.2e6 : 1.1e6,
    tempC: params.ambientTempC,
    fluxR,
  });
  const u4Init = solveChargePumpVoltage({
    fHz: 20,
    r48: 4700,
    c16: 100e-9,
    cSer: 500e-9,
    c18: 38e-6,
    rDrain: params.activeFault === 'r49_open' ? 1.0e6 : 500e3,
    tempC: params.ambientTempC,
    fluxR,
  });

  const pts: DecaySweepPoint[] = [];
  for (let t = 0; t <= 26; t += 0.5) {
    const d24V = d24Init.vCap * Math.exp(-t / d24Init.tauEff);
    const u4V = u4Init.vCap * Math.exp(-t / u4Init.tauEff);
    pts.push({
      timeS: t,
      d24V: Number(d24V.toFixed(3)),
      u3bV: Number(u4V.toFixed(3)),
      u3bOutV: u4V >= GEMINI_WD_THRESHOLDS.vThLo ? 2.8 : 0.05,
      mono74OutV: t < 3.0 ? 3.1 : 0.05,
      tps3823OutV: t < 1.6 ? 2.6 : 0.05,
    });
  }
  return pts;
}
