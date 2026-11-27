import { computeFullHatCosts } from '../../08-FullHat/data/masterBom';

export type ClampMechanism =
  | 'rising_cage_screw'
  | 'leaf_spring_screw'
  | 'micro_screw'
  | 'push_in_spring'
  | 'crimp_housing';

export type FitStatus = 'fits' | 'tight' | 'overflow';

export interface EditionConnectorFit {
  configSummary: string;
  leftEdgeParts: string;
  frontEdgeParts: string;
  leftEdgeMm: number;
  clearancePerEndMm: number;
  fitStatus: FitStatus;
  thtPartsCount: number; // Terminal blocks only (excluding J1/JP1/H1-H4)
  costPerBoardEur: number;
  deltaVsCurrentEur: number;
}

export interface ConnectorOption {
  id: string;
  rankTag?: string;
  name: string;
  shortName: string;
  familySeries: string;
  pitchMm: number;
  mounting: 'Pluggable' | 'Fixed PCB';
  tiersAllPt1000: '2-Tier (2×8P)' | '1-Tier (16P)' | '1-Tier (12P COM)' | 'N/A (Overflow)';
  clampMechanism: ClampMechanism;
  clampLabel: string;
  usesScrews: boolean;
  screwSize: string;
  wireRangeMm2: string;
  awgRange: string;
  ferruleFriendly: 'Excellent' | 'Good' | 'Tight' | 'N/A (Crimp)';
  unplugTime: string;
  heightMm: number;
  depthMm: number;
  availabilityEu: 'Stock Everywhere' | 'Common (LCSC/TME)' | 'Specialty';
  partNumbers: {
    onewire: string;
    allPt1000: string;
  };
  onewire: EditionConnectorFit;
  allPt1000: EditionConnectorFit;
  engineeringVerdict: string;
  pros: string[];
  cons: string[];
  isCurrentOnewire?: boolean;
  isCurrentAllPt1000?: boolean;
}

export interface AuxConnectorOption {
  id: string;
  refDes: string;
  role: string;
  currentSpec: string;
  currentCostEur: number;
  altSpec: string;
  altCostEur: number;
  savingsPerBoardEur: number;
  sameFootprint: boolean;
  condition: string;
}

const BASELINE_5BD_OPTS = {
  batchSize: 5 as const,
  includeShipping: true,
  includeVat19: true,
  includeThtHardware: true,
  includeJlcpcbThtSoldering: true,
  conservative01PctFee: true,
};
const BASELINE_5BD_ONEWIRE = Number(
  computeFullHatCosts(BASELINE_5BD_OPTS, 'onewire').revBGemini.perBoardEur.toFixed(2)
);
const BASELINE_5BD_ALLPT = Number(
  computeFullHatCosts(BASELINE_5BD_OPTS, 'all_pt1000').revBGemini.perBoardEur.toFixed(2)
);

/** Mechanical budget of the 65 × 56 mm Raspberry Pi HAT Left Edge */
export const HAT_EDGE_BUDGET = {
  boardHeightMm: 56.0,
  boardWidthMm: 65.0,
  holeTopY: 3.5,
  holeBottomY: 52.5,
  holeKeepoutRadiusMm: 3.5, // M2.5 nut/standoff + pad clearance
  usableLeftEdgeStartMm: 7.0,
  usableLeftEdgeEndMm: 49.0,
  usableLeftEdgeMm: 42.0,
  usableFrontEdgeMm: 49.0,
  currentOnewireTermCostEur: 0.58, // Active BOM: J6 DG350-3.5-08P (0.40) + J2 DG350-3.5-03P (0.18); J4 2P opt. +€0.15
  currentAllPt1000TermCostEur: 1.13, // Active BOM: J6 DG350D-3.5-08P (0.95) + J2 DG350-3.5-03P (0.18); J4 2P opt. +€0.15
  /** Live-computed 5-board landed per-board cost (Tier 1+2: 3 Ext reels €8.40, REL1 SMD pop., 19% VAT, shipping, THT) from Tab 08 */
  baseline5BdLandedOnewireEur: BASELINE_5BD_ONEWIRE,
  baseline5BdLandedAllPt1000Eur: BASELINE_5BD_ALLPT,
} as const;

export const CONNECTOR_OPTIONS: ConnectorOption[] = [
  {
    id: 'fixed_350_combined_screw',
    rankTag: 'Active BOM Selection (Both Boards)',
    name: '3.50 mm Fixed Rising-Cage Screw (DG350 / DG350D)',
    shortName: '3.50 mm Fixed Screw (Active)',
    familySeries: 'DG350-3.5-08P (1-Wire) / DG350D-3.5-08P or MKKDS 1.5 (All-Pt1000)',
    pitchMm: 3.5,
    mounting: 'Fixed PCB',
    tiersAllPt1000: '2-Tier (2×8P)',
    clampMechanism: 'rising_cage_screw',
    clampLabel: 'M2 Rising-Cage Screw',
    usesScrews: true,
    screwSize: 'M2.0 slotted',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '3–5 min (unscrew)',
    heightMm: 18.5,
    depthMm: 10.0,
    availabilityEu: 'Common (LCSC/TME)',
    partNumbers: {
      onewire: 'DG350-3.5-08P (J6: PT1/1W-A/1W-B) · DG350-3.5-03P (J2)',
      allPt1000: 'DG350D-3.5-08P / MKKDS 1.5/8-3.5 (J6: PT1–8) · DG350-3.5-03P (J2)',
    },
    onewire: {
      configSummary: '1× 8P fixed screw (J6: PT1+1W-A+1W-B) + 1× 3P fixed (J2)',
      leftEdgeParts: '1× 8P (28.5 mm)',
      frontEdgeParts: '1× 3P J2 (11.0 mm)',
      leftEdgeMm: 28.5,
      clearancePerEndMm: 6.75,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 0.58,
      deltaVsCurrentEur: 0.0,
    },
    allPt1000: {
      configSummary: '1× 2×8P dual-tier fixed screw (J6) + 1× 3P fixed (J2)',
      leftEdgeParts: '1× 2×8P (29.4 mm)',
      frontEdgeParts: '1× 3P J2 (11.0 mm)',
      leftEdgeMm: 29.4,
      clearancePerEndMm: 6.3,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 1.13,
      deltaVsCurrentEur: 0.0,
    },
    engineeringVerdict:
      'Active CoSTOS BOM baseline for both HAT editions. Lowest cost with full industrial M2 rising-cage screws, 0 mm edge overhang for tight DIN-rail enclosures, and only 2 THT terminal parts per board.',
    pros: [
      'Lowest cost with full M2 rising-cage clamps (€0.58 on 1-Wire, €1.13 on All-Pt1000)',
      'Zero overhang past the 65 × 56 mm HAT edge — fits tight DIN-rail or wall enclosures',
      'Only 2 THT terminal parts to solder on either board (saves €1.00 / €2.24 vs prior baseline)',
    ],
    cons: [
      'Must unscrew 11 wires (1-Wire) or 19 wires (All-Pt1000) whenever pulling the HAT out',
      'Dual-tier fixed block is 18.5 mm tall on All-Pt1000 (10.5 mm on 1-Wire)',
    ],
    isCurrentOnewire: true,
    isCurrentAllPt1000: true,
  },
  {
    id: 'pluggable_381_screw',
    rankTag: 'Best Pluggable Screw Upgrade',
    name: '3.81 mm Pluggable Rising-Cage Screw',
    shortName: '3.81 mm Pluggable Screw',
    familySeries: '2EDG / 2EDGKD + 2EDGK-3.81 (DEGSON / Kefa / Phoenix MC)',
    pitchMm: 3.81,
    mounting: 'Pluggable',
    tiersAllPt1000: '2-Tier (2×8P)',
    clampMechanism: 'rising_cage_screw',
    clampLabel: 'M2 Rising-Cage Screw',
    usesScrews: true,
    screwSize: 'M2.0 slotted/PH1',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '2 s (pull plugs)',
    heightMm: 16.2,
    depthMm: 15.5,
    availabilityEu: 'Stock Everywhere',
    partNumbers: {
      onewire: '2EDG-3.81-08P + 2EDGK-3.81-08P (J6) · 2EDG-3.81-03P + 03P (J2)',
      allPt1000: '2EDGKD-3.81-08P + 2× 2EDGK-3.81-08P (J6) · 2EDG-3.81-03P + 03P (J2)',
    },
    onewire: {
      configSummary: '1× 8P pluggable screw (J6) + 1× 3P pluggable (J2)',
      leftEdgeParts: '1× 8P (31.9 mm)',
      frontEdgeParts: '1× 3P J2 (12.8 mm)',
      leftEdgeMm: 31.9,
      clearancePerEndMm: 5.05,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 0.95,
      deltaVsCurrentEur: 0.37,
    },
    allPt1000: {
      configSummary: '1× 2×8P dual-tier header + 2× 8P screw plugs (J6) + 1× 3P (J2)',
      leftEdgeParts: '1× 2×8P (31.9 mm)',
      frontEdgeParts: '1× 3P J2 (12.8 mm)',
      leftEdgeMm: 31.9,
      clearancePerEndMm: 5.05,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 1.74,
      deltaVsCurrentEur: 0.61,
    },
    engineeringVerdict:
      'Best pluggable upgrade if you later want 2-second unplugging while keeping M2 rising-cage screws: adds +€0.37/bd (1-Wire) or +€0.61/bd (All-Pt1000) over the active DG350/DG350D fixed blocks.',
    pros: [
      'Real M2 rising-cage screws plus 2-second unplugging when servicing the Raspberry Pi',
      '3.81 mm is the highest-volume pluggable pitch in EU/Asia — replacement plugs cost €0.40 everywhere',
      'Fits both HATs cleanly in 31.9 mm (5.05 mm clearance to H1/H3)',
    ],
    cons: [
      'Costs +€0.37/bd (1-Wire) / +€0.61/bd (All-Pt1000) more than fixed DG350 / DG350D',
      'Mated dual-tier depth (~15.5 mm with plug) overhangs Left Edge by ~5 mm',
    ],
  },
  {
    id: 'pluggable_350_screw',
    rankTag: 'Compact Pluggable Screw',
    name: '3.50 mm Pluggable Rising-Cage Screw',
    shortName: '3.50 mm Pluggable Screw',
    familySeries: '15EDG / 15EDGKD + 15EDGK-3.5 (DEGSON / Phoenix MC 1.5)',
    pitchMm: 3.5,
    mounting: 'Pluggable',
    tiersAllPt1000: '2-Tier (2×8P)',
    clampMechanism: 'rising_cage_screw',
    clampLabel: 'M2 Rising-Cage Screw',
    usesScrews: true,
    screwSize: 'M2.0 slotted',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '2 s (pull plugs)',
    heightMm: 16.0,
    depthMm: 15.2,
    availabilityEu: 'Common (LCSC/TME)',
    partNumbers: {
      onewire: '15EDG-3.5-08P + 15EDGK-3.5-08P (J6) · 15EDG-3.5-03P + 03P (J2)',
      allPt1000: '15EDGKD-3.5-08P + 2× 15EDGK-3.5-08P (J6) · 15EDG-3.5-03P + 03P (J2)',
    },
    onewire: {
      configSummary: '1× 8P pluggable screw (J6) + 1× 3P pluggable (J2)',
      leftEdgeParts: '1× 8P (29.4 mm)',
      frontEdgeParts: '1× 3P J2 (11.9 mm)',
      leftEdgeMm: 29.4,
      clearancePerEndMm: 6.3,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 1.05,
      deltaVsCurrentEur: 0.47,
    },
    allPt1000: {
      configSummary: '1× 2×8P MCDN header + 2× 8P screw plugs (J6) + 1× 3P (J2)',
      leftEdgeParts: '1× 2×8P (29.4 mm)',
      frontEdgeParts: '1× 3P J2 (11.9 mm)',
      leftEdgeMm: 29.4,
      clearancePerEndMm: 6.3,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 1.85,
      deltaVsCurrentEur: 0.72,
    },
    engineeringVerdict:
      'Same 29.4 mm width as DG350D with pluggable M2 screw plugs (15EDGK) or interchangeable push-in plugs (15EDGKF). Adds +€0.47/bd (1-Wire) or +€0.72/bd (All-Pt1000) vs fixed DG350/DG350D.',
    pros: [
      'Extra 6.3 mm clearance to both H1 and H3 mounting holes',
      'Allows mixing screw plugs (15EDGK) or push-in plugs (15EDGKF) on the exact same PCB header',
    ],
    cons: [
      'Costs +€0.47–€0.72/bd more than active fixed DG350/DG350D and overhangs Left Edge by ~5 mm',
    ],
  },
  {
    id: 'current_onewire_fixed_350_sep',
    rankTag: 'Legacy 1-Wire Layout',
    name: '3.50 mm Fixed Screw — Separate 2P/3P Blocks',
    shortName: '3.50 mm Separate Fixed',
    familySeries: 'Phoenix MKDS 1.5 / DG350 separate 2P & 3P blocks',
    pitchMm: 3.5,
    mounting: 'Fixed PCB',
    tiersAllPt1000: 'N/A (Overflow)',
    clampMechanism: 'rising_cage_screw',
    clampLabel: 'M2 Rising-Cage Screw',
    usesScrews: true,
    screwSize: 'M2.0 slotted',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '3–5 min (unscrew)',
    heightMm: 10.5,
    depthMm: 8.2,
    availabilityEu: 'Stock Everywhere',
    partNumbers: {
      onewire: '1× MKDS 1.5/2-3.5 (J6) + 3× MKDS 1.5/3-3.5 (J8, J9, J2)',
      allPt1000: '8× 2P blocks = 60.8 mm — DOES NOT FIT on 42 mm Left Edge',
    },
    onewire: {
      configSummary: 'J6 (2P) + J8 (3P) + J9 (3P) separate + J2 (3P)',
      leftEdgeParts: 'J6 2P + J8 3P + J9 3P (29.5 mm)',
      frontEdgeParts: 'J2 3P (11.0 mm)',
      leftEdgeMm: 29.5,
      clearancePerEndMm: 6.25,
      fitStatus: 'fits',
      thtPartsCount: 4,
      costPerBoardEur: 1.58,
      deltaVsCurrentEur: 1.0,
    },
    allPt1000: {
      configSummary: '8× 2P separate blocks (60.8 mm) — Overflows Left Edge by +18.8 mm',
      leftEdgeParts: '8× 2P = 60.8 mm (OVERFLOW)',
      frontEdgeParts: 'Blocks J3/J4/J5 DNP zone',
      leftEdgeMm: 60.8,
      clearancePerEndMm: -9.4,
      fitStatus: 'overflow',
      thtPartsCount: 9,
      costPerBoardEur: 2.98,
      deltaVsCurrentEur: 1.85,
    },
    engineeringVerdict:
      'Previous separate-block layout replaced by the combined 8-pin DG350-3.5-08P. Costs +€1.00/bd more on 1-Wire for 4 separate THT parts and physically cannot fit 8× Pt1000.',
    pros: [
      'Physical gap between J6, J8, and J9 visually separates Pt1000, 1W-A, and 1W-B',
      'Low 10.5 mm profile fits slim Pi cases',
    ],
    cons: [
      'Costs +€1.00/bd more than the active combined 8-pin DG350-3.5-08P',
      'Impossible on 8× Pt1000 — 60.8 mm overflows the 42.0 mm Left Edge by 18.8 mm',
    ],
  },
  {
    id: 'current_allpt_pushin_350',
    rankTag: 'Tool-Free Push-In Option',
    name: '3.50 mm Pluggable Push-In Spring-Cage',
    shortName: '3.50 mm Push-In Pluggable',
    familySeries: 'Phoenix MCDN 1.5 + FMC 1.5 / DEGSON 15EDGKD + 15EDGKF',
    pitchMm: 3.5,
    mounting: 'Pluggable',
    tiersAllPt1000: '2-Tier (2×8P)',
    clampMechanism: 'push_in_spring',
    clampLabel: 'Push-In Spring Cage',
    usesScrews: false,
    screwSize: 'None (orange levers)',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '2 s (pull plugs)',
    heightMm: 16.0,
    depthMm: 15.8,
    availabilityEu: 'Common (LCSC/TME)',
    partNumbers: {
      onewire: '15EDG-3.5-08P + 15EDGKF-3.5-08P · 15EDG-3.5-03P + 03P',
      allPt1000: '15EDGKD-3.5-08P + 2× 15EDGKF-3.5-08P (J6) · MKDS 3P (J2)',
    },
    onewire: {
      configSummary: '1× 8P push-in pluggable + 1× 3P push-in pluggable',
      leftEdgeParts: '1× 8P (29.4 mm)',
      frontEdgeParts: '1× 3P J2 (11.9 mm)',
      leftEdgeMm: 29.4,
      clearancePerEndMm: 6.3,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 2.15,
      deltaVsCurrentEur: 1.57,
    },
    allPt1000: {
      configSummary: '1× 2×8P header + 2× 8P push-in spring plugs (J6) + fixed J2',
      leftEdgeParts: '1× 2×8P (29.4 mm)',
      frontEdgeParts: '1× 3P J2 (11.0 mm)',
      leftEdgeMm: 29.4,
      clearancePerEndMm: 6.3,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 3.37,
      deltaVsCurrentEur: 2.24,
    },
    engineeringVerdict:
      'Previous All-Pt1000 push-in option replaced by DG350D fixed screws. Fast tool-free wiring with ferrules, but costs +€2.24/bd more than DG350D on All-Pt1000 and has no screws.',
    pros: [
      'Zero screwdriver needed — poke ferruled wire straight in, press orange lever to release',
      'Constant spring pressure never loosens under pump vibration',
    ],
    cons: [
      'Most expensive option (+€2.24/bd on All-Pt1000 vs active DG350D fixed screw)',
      'No screws (requires ferrules or solid wire for clean one-hand insertion)',
    ],
  },
  {
    id: 'fixed_350_shared_com_12p',
    name: '3.50 mm Fixed Single-Row 12P (Shared-COM Trick)',
    shortName: '3.50 mm 12P Shared-COM',
    familySeries: 'DG350-3.5-12P (8× PT return + 4× shared PT1_V_DIV COM)',
    pitchMm: 3.5,
    mounting: 'Fixed PCB',
    tiersAllPt1000: '1-Tier (12P COM)',
    clampMechanism: 'rising_cage_screw',
    clampLabel: 'M2 Rising-Cage Screw',
    usesScrews: true,
    screwSize: 'M2.0 slotted',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Good',
    unplugTime: '3–4 min (unscrew)',
    heightMm: 10.5,
    depthMm: 8.2,
    availabilityEu: 'Common (LCSC/TME)',
    partNumbers: {
      onewire: 'Uses standard DG350-3.5-08P (8P) + DG350-3.5-03P (J2)',
      allPt1000: 'DG350-3.5-12P (42.0 mm: 8× PT + 4× dual-wire COM) + DG350-3.5-03P',
    },
    onewire: {
      configSummary: '1× 8P fixed screw (same as active DG350) + 1× 3P (J2)',
      leftEdgeParts: '1× 8P (28.5 mm)',
      frontEdgeParts: '1× 3P J2 (11.0 mm)',
      leftEdgeMm: 28.5,
      clearancePerEndMm: 6.75,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 0.58,
      deltaVsCurrentEur: 0.0,
    },
    allPt1000: {
      configSummary: '1× 12P single-row (8× PT + 4× shared COM, 2 wires/COM) + 1× 3P (J2)',
      leftEdgeParts: '1× 12P (42.0 mm — TIGHT)',
      frontEdgeParts: '1× 3P J2 (11.0 mm)',
      leftEdgeMm: 42.0,
      clearancePerEndMm: 0.0,
      fitStatus: 'tight',
      thtPartsCount: 2,
      costPerBoardEur: 0.76,
      deltaVsCurrentEur: -0.37,
    },
    engineeringVerdict:
      'Saves another €0.37/bd on All-Pt1000 by sharing 4 COM screws across 8 probes in a low 10.5 mm single row, but requires twin ferrules (2 wires per COM screw) and leaves 0 mm margin to H1/H3.',
    pros: [
      'Ultra-low 10.5 mm height and €0.76/bd on All-Pt1000 (−€0.37 vs DG350D)',
      'Real M2 rising-cage screws without needing a 2-tier housing',
    ],
    cons: [
      'Exact 42.0 mm length touches the H1/H3 mounting-hole keepout boundary (0.0 mm spare)',
      'Two probe wires share each COM screw — replacing 1 probe loosens its neighbor unless twin-ferruled',
    ],
  },
  {
    id: 'fixed_254_micro_screw',
    name: '2.54 mm Fixed Micro Screw Terminal',
    shortName: '2.54 mm Micro Screw',
    familySeries: 'KF128-2.54 / DG128-2.54 (16P single-row)',
    pitchMm: 2.54,
    mounting: 'Fixed PCB',
    tiersAllPt1000: '1-Tier (16P)',
    clampMechanism: 'micro_screw',
    clampLabel: 'M1.6 Micro Screw',
    usesScrews: true,
    screwSize: 'M1.6 tiny slotted',
    wireRangeMm2: '0.14–0.5 mm²',
    awgRange: '26–20 AWG',
    ferruleFriendly: 'Tight',
    unplugTime: '5+ min (fiddly)',
    heightMm: 9.5,
    depthMm: 6.5,
    availabilityEu: 'Stock Everywhere',
    partNumbers: {
      onewire: 'KF128-2.54-08P (21.3 mm) + KF128-2.54-03P (J2)',
      allPt1000: 'KF128-2.54-16P (41.6 mm single-row) + KF128-2.54-03P (J2)',
    },
    onewire: {
      configSummary: '1× 8P micro screw (21.3 mm) + 1× 3P (J2)',
      leftEdgeParts: '1× 8P (21.3 mm)',
      frontEdgeParts: '1× 3P J2 (8.6 mm)',
      leftEdgeMm: 21.3,
      clearancePerEndMm: 10.35,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 0.45,
      deltaVsCurrentEur: -0.13,
    },
    allPt1000: {
      configSummary: '1× 16P single-row micro screw (41.6 mm) + 1× 3P (J2)',
      leftEdgeParts: '1× 16P (41.6 mm — TIGHT)',
      frontEdgeParts: '1× 3P J2 (8.6 mm)',
      leftEdgeMm: 41.6,
      clearancePerEndMm: 0.2,
      fitStatus: 'tight',
      thtPartsCount: 2,
      costPerBoardEur: 0.8,
      deltaVsCurrentEur: -0.33,
    },
    engineeringVerdict:
      'Technically fits all 16 pins in one cheap row (€0.80/bd), but NOT recommended for solar boiler rooms: tiny M1.6 screws strip easily and reject standard 0.75 mm² solar silicone cables with ferrules.',
    pros: [
      'Very cheap (€0.45 on 1-Wire, €0.80 on All-Pt1000) and compact 9.5 mm height',
      'All 16 Pt1000 pins sit in a single horizontal row',
    ],
    cons: [
      'Max wire 0.5 mm² (20 AWG) — standard 0.75 mm² Pt1000 cable ferrules do not fit',
      'Tiny M1.6 screws strip easily and require a watchmaker screwdriver in a dark heating room',
      'Only 0.2 mm margin to H1/H3 mounting holes on All-Pt1000',
    ],
  },
  {
    id: 'fixed_508_kf301',
    name: '5.08 mm Hobbyist Green Screw (KF301)',
    shortName: '5.08 mm Green KF301',
    familySeries: 'KF301 / DG301 (Classic Arduino / Relay-Module Screw Block)',
    pitchMm: 5.08,
    mounting: 'Fixed PCB',
    tiersAllPt1000: 'N/A (Overflow)',
    clampMechanism: 'leaf_spring_screw',
    clampLabel: 'M2.5 Leaf-Spring Screw',
    usesScrews: true,
    screwSize: 'M2.5 Phillips/slotted',
    wireRangeMm2: '0.2–1.5 mm²',
    awgRange: '24–16 AWG',
    ferruleFriendly: 'Good',
    unplugTime: '3–4 min (unscrew)',
    heightMm: 10.0,
    depthMm: 7.6,
    availabilityEu: 'Stock Everywhere',
    partNumbers: {
      onewire: '1× KF301-2P + 3× KF301-3P (40.6 mm Left Edge — tight)',
      allPt1000: '16× 5.08 mm = 81.3 mm — DOES NOT FIT on 65×56 mm HAT',
    },
    onewire: {
      configSummary: 'J6 (2P) + J8 (3P) + J9 (3P) = 40.6 mm + J2 (3P) 15.2 mm',
      leftEdgeParts: '8 pins = 40.6 mm (TIGHT)',
      frontEdgeParts: 'J2 3P (15.2 mm)',
      leftEdgeMm: 40.6,
      clearancePerEndMm: 0.7,
      fitStatus: 'tight',
      thtPartsCount: 4,
      costPerBoardEur: 0.52,
      deltaVsCurrentEur: -0.06,
    },
    allPt1000: {
      configSummary: '16 pins = 81.3 mm (even 2-tier is 40.6 × 18 mm deep × 25 mm tall)',
      leftEdgeParts: '81.3 mm (OVERFLOW +39.3 mm)',
      frontEdgeParts: 'Impossible on 65×56 mm',
      leftEdgeMm: 81.3,
      clearancePerEndMm: -19.65,
      fitStatus: 'overflow',
      thtPartsCount: 9,
      costPerBoardEur: 1.08,
      deltaVsCurrentEur: -0.05,
    },
    engineeringVerdict:
      'Dirt cheap (€0.52) and big M2.5 screws on 1-Wire (barely squeezes into 40.6 mm), but uses an inferior leaf-spring clamp (twists bare strands) and physically cannot fit 8× Pt1000.',
    pros: [
      'Ultra-cheap (€0.12/block) and familiar large M2.5 screwdriver fit',
      'Barely fits 1-Wire Edition (0.7 mm clear of H1/H3)',
    ],
    cons: [
      'Cannot fit All-Pt1000 Edition (81.3 mm single-row; 2-tier 5.08 mm crushes U1/R105 zone)',
      'Leaf-spring clamp chews un-ferruled fine stranded wire compared to rising-cage clamps',
    ],
  },
  {
    id: 'fixed_350_wago_lever',
    name: '3.50 mm Fixed Push-Button Spring (WAGO 250)',
    shortName: '3.50 mm WAGO Push-Button',
    familySeries: 'WAGO 250-108 / DEGSON DG250-3.5 (45° Push-Button)',
    pitchMm: 3.5,
    mounting: 'Fixed PCB',
    tiersAllPt1000: 'N/A (Overflow)',
    clampMechanism: 'push_in_spring',
    clampLabel: '45° Push-Button Cage',
    usesScrews: false,
    screwSize: 'None (push buttons)',
    wireRangeMm2: '0.14–1.5 mm²',
    awgRange: '26–16 AWG',
    ferruleFriendly: 'Excellent',
    unplugTime: '1–2 min (buttons)',
    heightMm: 13.1,
    depthMm: 12.0,
    availabilityEu: 'Common (LCSC/TME)',
    partNumbers: {
      onewire: 'WAGO 250-108 / DG250-3.5-08P (29.5 mm) + DG250-3.5-03P (J2)',
      allPt1000: '16P = 57.5 mm — DOES NOT FIT single-row on 42 mm Left Edge',
    },
    onewire: {
      configSummary: '1× 8P 45° push-button (29.5 mm) + 1× 3P (J2)',
      leftEdgeParts: '1× 8P (29.5 mm)',
      frontEdgeParts: '1× 3P J2 (12.0 mm)',
      leftEdgeMm: 29.5,
      clearancePerEndMm: 6.25,
      fitStatus: 'fits',
      thtPartsCount: 2,
      costPerBoardEur: 1.2,
      deltaVsCurrentEur: 0.62,
    },
    allPt1000: {
      configSummary: '1× 16P = 57.5 mm — Overflows Left Edge by +15.5 mm',
      leftEdgeParts: '16P = 57.5 mm (OVERFLOW)',
      frontEdgeParts: 'No standard 2-tier 3.5 mm',
      leftEdgeMm: 57.5,
      clearancePerEndMm: -7.75,
      fitStatus: 'overflow',
      thtPartsCount: 2,
      costPerBoardEur: 2.35,
      deltaVsCurrentEur: 1.22,
    },
    engineeringVerdict:
      'Great vibration-proof fixed connector for 1-Wire Edition, but costs +€0.62/bd more than DG350, has no screws, is non-pluggable, and lacks a compact 2-tier 3.5 mm variant for 8× Pt1000.',
    pros: [
      'Fast 45° angled wire entry, zero screw torque issues on 1-Wire Edition',
      'WAGO CAGE CLAMP reliability',
    ],
    cons: [
      'No screws, non-pluggable, and +€0.62/bd pricier than DG350',
      'Cannot fit 16 Pt1000 wires on the 42.0 mm Left Edge',
    ],
  },
  {
    id: 'crimp_jst_xh_254',
    name: '2.54 mm JST-XH Crimp Wire-to-Board',
    shortName: '2.54 mm JST-XH Crimp',
    familySeries: 'JST XH (B2B-XH / B3B-XH / 2× B8B-XH)',
    pitchMm: 2.54,
    mounting: 'Pluggable',
    tiersAllPt1000: '2-Tier (2×8P)',
    clampMechanism: 'crimp_housing',
    clampLabel: 'Crimp Pin + Housing',
    usesScrews: false,
    screwSize: 'None (crimp tool)',
    wireRangeMm2: '0.08–0.33 mm²',
    awgRange: '28–22 AWG',
    ferruleFriendly: 'N/A (Crimp)',
    unplugTime: '2 s (unplug)',
    heightMm: 9.8,
    depthMm: 6.0,
    availabilityEu: 'Stock Everywhere',
    partNumbers: {
      onewire: 'B2B-XH-A + 3× B3B-XH-A + housings & crimp pins',
      allPt1000: '2× B8B-XH-A (parallel rows, 22.8 mm) + B3B-XH-A (J2)',
    },
    onewire: {
      configSummary: 'J6 (2P) + J8 (3P) + J9 (3P) + J2 (3P) JST-XH',
      leftEdgeParts: '2P+3P+3P (28.0 mm)',
      frontEdgeParts: 'J2 3P (10.0 mm)',
      leftEdgeMm: 28.0,
      clearancePerEndMm: 7.0,
      fitStatus: 'fits',
      thtPartsCount: 4,
      costPerBoardEur: 0.38,
      deltaVsCurrentEur: -0.2,
    },
    allPt1000: {
      configSummary: '2× 8P JST-XH parallel rows (22.8 mm) + 3P J2',
      leftEdgeParts: '2× 8P rows (22.8 mm)',
      frontEdgeParts: 'J2 3P (10.0 mm)',
      leftEdgeMm: 22.8,
      clearancePerEndMm: 9.6,
      fitStatus: 'fits',
      thtPartsCount: 3,
      costPerBoardEur: 0.65,
      deltaVsCurrentEur: -0.48,
    },
    engineeringVerdict:
      'Lowest BOM cost (€0.38 / €0.65), but poor for boiler-room field wiring: requires a precision JST crimper, max 22 AWG (0.33 mm²), and cannot take standard 0.5–0.75 mm² Pt1000 silicone leads.',
    pros: [
      'Lowest part cost and smallest PCB footprint',
      'Polarized pluggable housings',
    ],
    cons: [
      'Max 22 AWG (0.33 mm²) — standard 0.5–0.75 mm² solar sensor cables will not fit crimp pins',
      'Replacing a broken sensor in the boiler room requires carrying a crimper & spare pins',
    ],
  },
];

/** Non-terminal connectors on BOTH boards (Nylon H1–H4, Bare JP1 Pads & Normal 11 mm J1 are ALL active defaults!) */
export const AUX_CONNECTOR_OPTIONS: AuxConnectorOption[] = [
  {
    id: 'h1_h4_standoffs',
    refDes: 'H1–H4',
    role: '4× M2.5 11 mm Mechanical HAT Standoffs (Nylon Active Default)',
    currentSpec: '4× M2.5 × 11 mm Nylon Standoff Kit (Active Default)',
    currentCostEur: 0.32,
    altSpec: 'Upgrade to 4× M2.5 × 11 mm Brass Standoff Kit',
    altCostEur: 0.8,
    savingsPerBoardEur: -0.48,
    sameFootprint: true,
    condition: 'Optional stiffer metal standoffs (+€0.48/bd); active non-conductive nylon already prevents corner shorts',
  },
  {
    id: 'jp1_jumper',
    refDes: 'JP1',
    role: 'Watchdog Bench-Test Override (2-Pad Copper Test Point Active Default)',
    currentSpec: 'Unpopulated 2-Pad Tweezer Test Point (Active Default)',
    currentCostEur: 0.0,
    altSpec: 'Upgrade to 1×2 2.54 mm Vertical Pin Header + Shunt',
    altCostEur: 0.1,
    savingsPerBoardEur: -0.1,
    sameFootprint: true,
    condition: 'Optional hands-free bench jumper (+€0.10/bd); bare copper pads are safer in service (impossible to leave capped)',
  },
  {
    id: 'j1_tall_upgrade',
    refDes: 'J1',
    role: '40-Pin GPIO Header (Normal 11 mm Active Default)',
    currentSpec: '11 mm Standard Female Header (Active Default)',
    currentCostEur: 0.45,
    altSpec: '16–17 mm Tall Stacking Header (Pi 5 Active Cooler Only)',
    altCostEur: 1.65,
    savingsPerBoardEur: -1.2,
    sameFootprint: true,
    condition: 'Normal 11 mm (€0.45) is already active in BOM — only check this if adding a tall Pi 5 blower fan later',
  },
];

/** Builds an RFC-4180 CSV spreadsheet of the full connector comparison for Excel / LibreOffice / Google Sheets */
export function generateConnectorsComparisonCsv(): string {
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = [
    'Option',
    'Series / Family',
    'Pitch (mm)',
    'Mounting',
    'Clamp Mechanism',
    'Uses Screws',
    'Screw Size',
    'Wire Range (mm2)',
    'AWG',
    'Ferrule Fit',
    'Unplug Time',
    '1-Wire Config',
    '1-Wire Left Edge (mm)',
    '1-Wire Fit (42mm Budget)',
    '1-Wire Cost/Bd (EUR)',
    '1-Wire Delta vs Current (EUR)',
    'All-Pt1000 Config',
    'All-Pt1000 Left Edge (mm)',
    'All-Pt1000 Fit (42mm Budget)',
    'All-Pt1000 Cost/Bd (EUR)',
    'All-Pt1000 Delta vs Current (EUR)',
    'EU Availability',
    '1-Wire Part Numbers',
    'All-Pt1000 Part Numbers',
    'Engineering Verdict',
  ];

  const rows = CONNECTOR_OPTIONS.map((o) =>
    [
      o.name,
      o.familySeries,
      o.pitchMm.toFixed(2),
      o.mounting,
      o.clampLabel,
      o.usesScrews ? 'YES' : 'NO',
      o.screwSize,
      o.wireRangeMm2,
      o.awgRange,
      o.ferruleFriendly,
      o.unplugTime,
      o.onewire.configSummary,
      o.onewire.leftEdgeMm.toFixed(1),
      o.onewire.fitStatus.toUpperCase(),
      o.onewire.costPerBoardEur.toFixed(2),
      o.onewire.deltaVsCurrentEur.toFixed(2),
      o.allPt1000.configSummary,
      o.allPt1000.leftEdgeMm.toFixed(1),
      o.allPt1000.fitStatus.toUpperCase(),
      o.allPt1000.costPerBoardEur.toFixed(2),
      o.allPt1000.deltaVsCurrentEur.toFixed(2),
      o.availabilityEu,
      o.partNumbers.onewire,
      o.partNumbers.allPt1000,
      o.engineeringVerdict,
    ]
      .map(esc)
      .join(',')
  );

  const auxHeader = '\n\nAuxiliary Connectors (Both Editions)\nRefDes,Role,Current Spec,Current Cost (EUR),Cheaper Alternative,Alt Cost (EUR),Savings/Bd (EUR),Same PCB Footprint,Condition';
  const auxRows = AUX_CONNECTOR_OPTIONS.map((a) =>
    [
      a.refDes,
      a.role,
      a.currentSpec,
      a.currentCostEur.toFixed(2),
      a.altSpec,
      a.altCostEur.toFixed(2),
      (-a.savingsPerBoardEur).toFixed(2),
      a.sameFootprint ? 'YES' : 'NO',
      a.condition,
    ]
      .map(esc)
      .join(',')
  );

  return [headers.map(esc).join(','), ...rows].join('\n') + auxHeader + '\n' + auxRows.join('\n') + '\n';
}
