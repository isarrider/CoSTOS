import {
  computeFullHatCosts,
  getMasterBomStats,
  type CostCalcOptions,
  type HatEdition,
} from '../../08-FullHat/data/masterBom';

export type AssemblyMode = 'diy_tht' | 'jlcpcb_zero_solder';
export type BatchSize = 2 | 5 | 10 | 25;
export type ArchId = 'discrete_active' | 'hybrid_pt1000_ic' | 'full_ic';

export interface ThtPartItem {
  refDes: string;
  name: string;
  side: 'TOP' | 'BOTTOM';
  pins: number;
  partCostEur: number;
  lcscNote: string;
  solderRequired: boolean;
}

export interface ArchCostBreakdown {
  id: ArchId;
  name: string;
  shortName: string;
  tagline: string;
  pcbAndSetupOrderEur: number;
  smdPartsOrderEur: number;
  extendedFeesOrderEur: number;
  extendedReelCount: number;
  thtPartsAndAssemblyOrderEur: number;
  shippingOrderEur: number;
  subtotalExVatEur: number;
  vatEur: number;
  grandTotalOrderEur: number;
  perBoardLandedEur: number;
  perBoardExVatEur: number;
  deltaVsActivePerBoardEur: number;
  smdPartCount: number;
  uniqueSmdReels: number;
  thtSolderedParts: number;
  thtPinsPerBoard: number;
  firmwareLocEstimate: string;
  gpioPinsUsed: number;
}

export interface SubsystemArchRow {
  block: string;
  discrete: {
    impl: string;
    costEur: number;
    extReels: number;
    note: string;
  };
  hybrid: {
    impl: string;
    costEur: number;
    extReels: number;
    note: string;
  };
  fullIc: {
    impl: string;
    costEur: number;
    extReels: number;
    note: string;
  };
}

export interface ComparisonCriterionRow {
  criterion: string;
  discrete: string;
  hybrid: string;
  fullIc: string;
  winner: ArchId | 'tie';
  detail: string;
}

/** Exact list of the ONLY parts not placed by JLCPCB Economic SMD — showing what requires soldering vs screw-on */
export function getThtChecklist(edition: HatEdition): ThtPartItem[] {
  const isAllPt = edition === 'all_pt1000';
  return [
    {
      refDes: 'J1',
      name: '40-Pin Normal 11.0 mm Female GPIO Header',
      side: 'BOTTOM',
      pins: 40,
      partCostEur: 0.45,
      lcscNote: 'In LCSC/JLCPCB THT library (e.g. 2×20P 2.54 mm female header, H = 8.5–11 mm)',
      solderRequired: true,
    },
    {
      refDes: 'J6',
      name: isAllPt
        ? 'DG350D-3.5-08P Dual-Tier 2×8P Fixed Screw Terminal'
        : 'DG350-3.5-08P Combined 8-Pin Fixed Screw Terminal',
      side: 'TOP',
      pins: isAllPt ? 16 : 8,
      partCostEur: isAllPt ? 0.95 : 0.40,
      lcscNote: isAllPt
        ? 'Dual-tier 3.50 mm 2×8P (check LCSC stock or use JLCPCB Global Sourcing pre-order)'
        : 'Standard 8-pin 3.50 mm fixed rising-cage screw block (widely stocked on LCSC)',
      solderRequired: true,
    },
    {
      refDes: 'J2',
      name: 'DG350-3.5-03P 3-Pin Fixed Screw Terminal (PUMP1)',
      side: 'TOP',
      pins: 3,
      partCostEur: 0.18,
      lcscNote: 'Standard 3-pin 3.50 mm fixed screw block (widely stocked on LCSC)',
      solderRequired: true,
    },
    {
      refDes: 'H1–H4',
      name: '4× M2.5 × 11 mm Nylon Standoffs + Screws',
      side: 'BOTTOM',
      pins: 0,
      partCostEur: 0.32,
      lcscNote: 'Tool-free finger-tight mechanical hardware — zero soldering required',
      solderRequired: false,
    },
    {
      refDes: 'JP1',
      name: 'Unpopulated 2-Pad Copper Tweezer Test Point',
      side: 'TOP',
      pins: 0,
      partCostEur: 0.0,
      lcscNote: 'Etched copper pads on PCB (DNP) — zero part & zero soldering required',
      solderRequired: false,
    },
  ];
}

/**
 * Computes exact JLCPCB Factory Zero-Solder (Standard PCBA + THT Wave/Hand Assembly)
 * vs DIY 3-Part THT costs for all 3 architectures across any batch size & HAT edition.
 */
export function computeArchitectureComparison(
  edition: HatEdition,
  batchSize: BatchSize,
  assemblyMode: AssemblyMode
): {
  architectures: ArchCostBreakdown[];
  zeroSolderBreakdown: {
    standardPcbaUpgradeOrderEur: number;
    thtWaveSetupOrderEur: number;
    thtExtendedFeesOrderEur: number;
    thtPinAssemblyOrderEur: number;
    extraTotalExVatOrderEur: number;
    extraPerBoardInclVatEur: number;
    thtPinsPerBoard: number;
  };
} {
  const isAllPt = edition === 'all_pt1000';
  const stats = getMasterBomStats(edition);
  const opts: CostCalcOptions = {
    batchSize,
    includeShipping: true,
    includeVat19: true,
    includeThtHardware: true,
    conservative01PctFee: false,
  };
  const baseActive = computeFullHatCosts(opts, edition).revBGemini;

  const thtPinsPerBoard = isAllPt ? 40 + 16 + 3 : 40 + 8 + 3; // 59 pins (All-Pt1000) or 51 pins (1-Wire)

  // JLCPCB Standard PCBA + Factory THT Assembly adder (applied identically to all 3 architectures when Zero-Solder is selected)
  // - Standard PCBA setup (~€23.50 vs €8.80 Economic setup+stencil -> +€14.70/order)
  // - THT manual/wave soldering setup (+€3.20/order)
  // - 3 Extended part fees for J1, J6, J2 in JLCPCB THT library (3 × €2.80 = €8.40/order)
  // - Per-pin THT hand/wave soldering fee (€0.016/pin × pins × batchSize)
  const standardPcbaUpgradeOrderEur = 14.7;
  const thtWaveSetupOrderEur = 3.2;
  const thtExtendedFeesOrderEur = 3 * 2.8;
  const thtPinAssemblyOrderEur = thtPinsPerBoard * batchSize * 0.016;
  const extraTotalExVatOrderEur =
    standardPcbaUpgradeOrderEur +
    thtWaveSetupOrderEur +
    thtExtendedFeesOrderEur +
    thtPinAssemblyOrderEur;
  const extraPerBoardInclVatEur = (extraTotalExVatOrderEur * 1.19) / batchSize;

  const isZeroSolder = assemblyMode === 'jlcpcb_zero_solder';
  const pcbFab = baseActive.pcbFabOrderEur;
  const shipping = baseActive.shippingOrderEur;
  const thtPartsOrder = baseActive.thtHardwareOrderEur;

  const buildArch = (cfg: {
    id: ArchId;
    name: string;
    shortName: string;
    tagline: string;
    smdPartsPerBdEur: number;
    smdPartCount: number;
    uniqueSmdReels: number;
    smdJointsPerBd: number;
    smdExtendedReels: number;
    extraThtHardwarePerBdEur?: number;
    extraThtExtendedReels?: number;
    extraThtPins?: number;
    firmwareLocEstimate: string;
    gpioPinsUsed: number;
  }): ArchCostBreakdown => {
    const smdPartsOrderEur = cfg.smdPartsPerBdEur * batchSize;
    const smdJointsOrderEur = cfg.smdJointsPerBd * batchSize * 0.0016;
    const baseSetupAndStencil = 8.8;
    const pcbAndSetupOrderEur =
      pcbFab +
      baseSetupAndStencil +
      smdJointsOrderEur +
      (isZeroSolder ? standardPcbaUpgradeOrderEur + thtWaveSetupOrderEur : 0);

    const extraThtReels = isZeroSolder ? cfg.extraThtExtendedReels ?? 0 : 0;
    const extendedReelCount = cfg.smdExtendedReels + (isZeroSolder ? 3 + extraThtReels : 0);
    const extendedFeesOrderEur = extendedReelCount * 2.8;

    const totalThtPins = thtPinsPerBoard + (cfg.extraThtPins ?? 0);
    const thtAssemblyOrder = isZeroSolder ? totalThtPins * batchSize * 0.016 : 0;
    const thtPartsAndAssemblyOrderEur =
      thtPartsOrder + (cfg.extraThtHardwarePerBdEur ?? 0) * batchSize + thtAssemblyOrder;

    const subtotalExVatEur =
      pcbAndSetupOrderEur +
      smdPartsOrderEur +
      extendedFeesOrderEur +
      thtPartsAndAssemblyOrderEur +
      shipping;
    const vatEur = subtotalExVatEur * 0.19;
    const grandTotalOrderEur = subtotalExVatEur + vatEur;

    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      tagline: cfg.tagline,
      pcbAndSetupOrderEur,
      smdPartsOrderEur,
      extendedFeesOrderEur,
      extendedReelCount,
      thtPartsAndAssemblyOrderEur,
      shippingOrderEur: shipping,
      subtotalExVatEur,
      vatEur,
      grandTotalOrderEur,
      perBoardLandedEur: grandTotalOrderEur / batchSize,
      perBoardExVatEur: subtotalExVatEur / batchSize,
      deltaVsActivePerBoardEur: 0,
      smdPartCount: cfg.smdPartCount,
      uniqueSmdReels: cfg.uniqueSmdReels,
      thtSolderedParts: isZeroSolder ? 0 : 3 + (cfg.extraThtExtendedReels ?? 0),
      thtPinsPerBoard: totalThtPins,
      firmwareLocEstimate: cfg.firmwareLocEstimate,
      gpioPinsUsed: cfg.gpioPinsUsed,
    };
  };

  // 1. Active Build: Discrete Gemini Release (synced 100% with masterBom.ts!)
  const activeArch = buildArch({
    id: 'discrete_active',
    name: 'Our Active Build (Discrete Basic-Part HAT)',
    shortName: 'Our Discrete Build',
    tagline: isAllPt
      ? 'Switched 8× Pt1000 LM393 Ramp + Discrete Doubler, Watchdog & eFuse · €0 SMD Ext Fees'
      : 'Switched 1× Pt1000 LM393 Ramp + Discrete 5V 1-Wire, Doubler, Watchdog & eFuse · €0 SMD Ext Fees',
    smdPartsPerBdEur: stats.smdPartsPerBoardEur,
    smdPartCount: stats.smdPartCount,
    uniqueSmdReels: stats.uniqueSmdReels,
    smdJointsPerBd: stats.smdJointsPerBoard,
    smdExtendedReels: 0,
    firmwareLocEstimate: isAllPt
      ? '~110 LOC Rust (gpio_v2 8-ch mux)'
      : '~80 LOC Rust (gpio_v2 + w1-gpio)',
    gpioPinsUsed: isAllPt ? 15 : 10,
  });

  // 2. Smart Hybrid: Keeps our €0-fee Discrete Doubler/Watchdog/1-Wire/eFuse, replaces ONLY Pt1000 with MAX31865 (+ Mux on 8-ch)
  const hybridArch = buildArch({
    id: 'hybrid_pt1000_ic',
    name: isAllPt
      ? 'Smart Hybrid (1× MAX31865 + Analog Mux IC)'
      : 'Smart Hybrid (MAX31865 Pt1000 IC Only)',
    shortName: 'Smart Hybrid (Pt1000 IC)',
    tagline: isAllPt
      ? 'Swaps only Pt1000 to MAX31865 + 2× TMUX1208 mux; keeps our cheap discrete Doubler, Watchdog & eFuse'
      : 'Swaps only Pt1000 to MAX31865 SPI chip (2/3/4-wire); keeps our cheap discrete 1-Wire, Doubler, Watchdog & eFuse',
    smdPartsPerBdEur: stats.smdPartsPerBoardEur + (isAllPt ? 6.77 : 4.51),
    smdPartCount: isAllPt ? stats.smdPartCount - 28 : stats.smdPartCount - 18,
    uniqueSmdReels: isAllPt ? stats.uniqueSmdReels - 1 : stats.uniqueSmdReels - 2,
    smdJointsPerBd: isAllPt ? stats.smdJointsPerBoard - 22 : stats.smdJointsPerBoard - 16,
    smdExtendedReels: isAllPt ? 2 : 1,
    firmwareLocEstimate: isAllPt
      ? '~45 LOC (spidev + 3 mux GPIOs)'
      : '~20 LOC (standard max31865 crate)',
    gpioPinsUsed: isAllPt ? 11 : 10,
  });

  // 3. Full Dedicated-IC HAT (Every subsystem uses a dedicated silicon IC!)
  const fullIcArch = buildArch({
    id: 'full_ic',
    name: isAllPt
      ? 'Full Dedicated-IC HAT (8× MAX31865 + All ICs)'
      : 'Full Dedicated-IC HAT (MAX31865 + DS2482 + All ICs)',
    shortName: 'Full Dedicated-IC HAT',
    tagline: isAllPt
      ? '8× MAX31865 (simultaneous) + MT3608 boost + TPL5010 watchdog + TPS25921 eFuse — zero discrete analog tricks'
      : 'MAX31865 + DS2482-800 1-Wire IC + MT3608 boost + TPL5010 watchdog + TPS25921 eFuse — textbook silicon',
    smdPartsPerBdEur: isAllPt ? 42.15 : 11.45,
    smdPartCount: isAllPt ? 114 : 62,
    uniqueSmdReels: isAllPt ? 24 : 23,
    smdJointsPerBd: isAllPt ? 386 : 196,
    smdExtendedReels: 6,
    firmwareLocEstimate: isAllPt
      ? '~30 LOC (spidev + 3 CS GPIOs)'
      : '~25 LOC (max31865 + owfs/ds2482)',
    gpioPinsUsed: isAllPt ? 11 : 10,
  });

  const architectures = [activeArch, hybridArch, fullIcArch].map((a) => ({
    ...a,
    deltaVsActivePerBoardEur: +(a.perBoardLandedEur - activeArch.perBoardLandedEur).toFixed(2),
  }));

  return {
    architectures,
    zeroSolderBreakdown: {
      standardPcbaUpgradeOrderEur,
      thtWaveSetupOrderEur,
      thtExtendedFeesOrderEur,
      thtPinAssemblyOrderEur,
      extraTotalExVatOrderEur,
      extraPerBoardInclVatEur,
      thtPinsPerBoard,
    },
  };
}

export function getSubsystemRows(edition: HatEdition): SubsystemArchRow[] {
  const isAllPt = edition === 'all_pt1000';
  return [
    {
      block: '01. Pt1000 Sensor Front-End',
      discrete: {
        impl: isAllPt
          ? '1× LM393DR + 8× AO3400A Mux + 3× 0.1% R (72 Hz Ramp)'
          : '1× LM393DR + 3× AO3400A + 3× 0.1% R (72 Hz Ramp)',
        costEur: isAllPt ? 1.18 : 0.42,
        extReels: 0,
        note: '2-wire only, ±0.4 K after Setup Wizard zeroing, ~80–110 LOC Rust gpio_v2',
      },
      hybrid: {
        impl: isAllPt
          ? '1× MAX31865AAP+ + 2× TMUX1208 8-Ch Analog Mux'
          : '1× MAX31865AAP+ RTD-to-Digital SPI IC',
        costEur: isAllPt ? 7.95 : 4.93,
        extReels: isAllPt ? 2 : 1,
        note: isAllPt
          ? 'Native SPI ADC + hardware fault flags; sequential 8-ch scan (~250 ms)'
          : 'Native 2/3/4-wire Kelvin, ±45 V fault tolerance, off-the-shelf SPI crate',
      },
      fullIc: {
        impl: isAllPt
          ? '8× MAX31865AAP+ + 74HC138 SPI CS Decoder'
          : '1× MAX31865AAP+ RTD-to-Digital SPI IC',
        costEur: isAllPt ? 39.2 : 4.93,
        extReels: isAllPt ? 2 : 1,
        note: isAllPt
          ? 'Simultaneous 8-ch read in 21 ms, ±45 V tolerance, but €38.40 in ICs alone (very tight on 65×56 mm!)'
          : 'Native 2/3/4-wire Kelvin, −200…+850 °C range, zero calibration math',
      },
    },
    {
      block: '02. Pump 10 V PWM Supply',
      discrete: {
        impl: 'LM393DR + AO3400A/3401A 62 kHz CMOS Voltage Doubler',
        costEur: 0.18,
        extReels: 0,
        note: '8.8 V clean DC, zero inductor EMI, 100% JLCPCB Basic parts',
      },
      hybrid: {
        impl: 'Same Discrete 62 kHz CMOS Doubler (kept!)',
        costEur: 0.18,
        extReels: 0,
        note: 'No reason to replace — already zero-firmware & zero-inductor',
      },
      fullIc: {
        impl: 'MT3608 Boost Regulator IC + 22 µH Shielded Inductor',
        costEur: 0.85,
        extReels: 2,
        note: 'Tighter regulated 10.0 V output, but adds 1.2 MHz switching EMI + inductor reel',
      },
    },
    {
      block: '03. Hardware Watchdog',
      discrete: {
        impl: 'LM393DR Dual Schmitt + 2× 22 µF 1206 Hold Bank',
        costEur: 0.15,
        extReels: 0,
        note: '15.4 s / 17.7 s staggered cutoff, zero firmware config, €0 Ext fee',
      },
      hybrid: {
        impl: 'Same Discrete LM393DR Watchdog (kept!)',
        costEur: 0.15,
        extReels: 0,
        note: 'Already 100% hardware-autonomous and zero-fee',
      },
      fullIc: {
        impl: 'MAX6369 / TPL5010 Dedicated Watchdog Timer IC',
        costEur: 1.15,
        extReels: 1,
        note: 'Tiny SOT-23-6, ±2% factory timeout accuracy vs ±12% ceramic cap tolerance',
      },
    },
    {
      block: isAllPt ? '04. Channels 2–8 Sensor Mux' : '04. Dual 1-Wire Buses (1W-A/B)',
      discrete: {
        impl: isAllPt
          ? '7× AO3400A + 7× 47 Ω 1206 + 7× PESD24V (reuses U1!)'
          : '2× 2N7002 5 V Level Shifter + SS14 + 100 Ω 0.5 W',
        costEur: isAllPt ? 0.52 : 0.18,
        extReels: 0,
        note: isAllPt
          ? 'Zero extra ICs; shares Tab 01 U1 & 0.1% bridge across all 8 probes'
          : '65 m reach, independent Bus A/B fault isolation, native Linux w1-gpio-pi5',
      },
      hybrid: {
        impl: isAllPt
          ? 'Covered by 2× TMUX1208 Analog Mux above'
          : 'Same Discrete 5 V 2N7002 Level Shifter (kept!)',
        costEur: isAllPt ? 0.0 : 0.18,
        extReels: 0,
        note: isAllPt
          ? 'Replaces 7 discrete MOSFET channels with 2 TSSOP-16 mux ICs'
          : 'Zero I²C bus lockup risk, works natively with Raspberry Pi kernel driver',
      },
      fullIc: {
        impl: isAllPt
          ? 'Covered by 8× MAX31865AAP+ bank above'
          : 'DS2482S-800 I²C-to-1-Wire Bridge IC (Active Pull-Up)',
        costEur: isAllPt ? 0.0 : 3.1,
        extReels: isAllPt ? 0 : 1,
        note: isAllPt
          ? 'Every channel gets its own dedicated 15-bit RTD ADC silicon'
          : '>80 m reach & zero Linux bit-bang jitter, but requires owfs/ds2482 daemon & scarce stock',
      },
    },
    {
      block: '05. Pump PWM Out & Feedback',
      discrete: {
        impl: 'AO3400A/3401A Push-Pull Driver + Q5 WD-AND + FB1 Clamp',
        costEur: 0.16,
        extReels: 0,
        note: 'All 3 architectures keep this proven discrete output stage',
      },
      hybrid: {
        impl: 'Same Discrete Output Stage (kept!)',
        costEur: 0.16,
        extReels: 0,
        note: 'Identical 7.2 V Grundfos/Wilo PWM & 75 Hz feedback clamp',
      },
      fullIc: {
        impl: 'Same Discrete Output Stage (or Gate Driver IC)',
        costEur: 0.16,
        extReels: 0,
        note: 'Discrete SOT-23 push-pull already handles 24 V miswiring cleanly',
      },
    },
    {
      block: '06. Power Entry & Foldback eFuse',
      discrete: {
        impl: 'AO3401A + MMBT3906 Current-Foldback eFuse + Pi-Filter',
        costEur: 0.11,
        extReels: 0,
        note: 'Folds dead short on +5V_HAT to 136.5 mA with zero Pi 5 reboot',
      },
      hybrid: {
        impl: 'Same Discrete Foldback eFuse (kept!)',
        costEur: 0.11,
        extReels: 0,
        note: 'Proven in ngspice; zero Extended fee',
      },
      fullIc: {
        impl: 'TPS25921L / AP2553 Integrated eFuse IC',
        costEur: 0.85,
        extReels: 1,
        note: 'Precision ±5% programmable current limit + thermal shutdown in 1 chip',
      },
    },
  ];
}

export function getComparisonCriteria(
  edition: HatEdition,
  archs: ArchCostBreakdown[],
  batchSize: BatchSize
): ComparisonCriterionRow[] {
  const isAllPt = edition === 'all_pt1000';
  const [disc, hyb, full] = archs;
  return [
    {
      criterion: `Landed Cost / Board (${batchSize}-bd order, incl. VAT & Ship)`,
      discrete: `€${disc.perBoardLandedEur.toFixed(2)}/bd`,
      hybrid: `€${hyb.perBoardLandedEur.toFixed(2)}/bd (+€${hyb.deltaVsActivePerBoardEur.toFixed(2)})`,
      fullIc: `€${full.perBoardLandedEur.toFixed(2)}/bd (+€${full.deltaVsActivePerBoardEur.toFixed(2)})`,
      winner: 'discrete_active',
      detail: isAllPt
        ? '8× MAX31865 chips alone cost €38.40 ex-VAT before VAT/assembly fees!'
        : 'Eliminating Extended feeder fees (€2.80/reel) and €4.80–€3.10 ICs cuts landed cost dramatically.',
    },
    {
      criterion: 'JLCPCB Extended Reel Fees (SMD only)',
      discrete: '0 Extended reels (€0.00)',
      hybrid: isAllPt ? '2 Extended reels (€5.60/order)' : '1 Extended reel (€2.80/order)',
      fullIc: '6 Extended reels (€16.80/order)',
      winner: 'discrete_active',
      detail: 'JLCPCB charges €2.80 per unique Extended reel regardless of batch size (hurts 2–5 board prototype runs most).',
    },
    {
      criterion: 'Pt1000 Wiring & Accuracy',
      discrete: '2-wire only · ±0.4 K (after Setup Wizard zeroing)',
      hybrid: isAllPt
        ? '2-wire muxed · ±0.35 K (cancels mux R_on via ref ch)'
        : '2 / 3 / 4-wire Kelvin · ±0.3 K (zero cable calib)',
      fullIc: 'Native 2 / 3 / 4-wire Kelvin · ±0.25 K',
      winner: 'full_ic',
      detail: 'Dedicated MAX31865 natively cancels 3/4-wire roof cable resistance & attic temperature drift.',
    },
    {
      criterion: 'Temperature Range & Scan Speed',
      discrete: isAllPt
        ? '−40…+250 °C · ~1.3–5.3 s full 8-ch + BIST sweep'
        : '−40…+250 °C · ~0.4–1.6 s (1-ch + 2-pt BIST)',
      hybrid: isAllPt
        ? '−200…+850 °C · ~250 ms sequential 8-ch scan'
        : '−200…+850 °C · 21 ms single-shot (60 Hz)',
      fullIc: '−200…+850 °C · 21 ms simultaneous',
      winner: 'full_ic',
      detail: 'Solar thermal loops move on 10–60 s timescales, so 0.4–5 s scan speed is invisible in practice.',
    },
    {
      criterion: 'Fault Diagnostics & Overvoltage Ceiling',
      discrete: 'Software Open/Short/BIST · +24 V DC + kV ESD safe',
      hybrid: 'Hardware SPI Fault Byte (0x07) · ±45 V (1-ch) / ±24 V (mux)',
      fullIc: 'Hardware SPI Fault Byte (0x07) · ±45 V native on all ch',
      winner: 'full_ic',
      detail: 'MAX31865 silicon tolerates ±45 V natively and exposes a dedicated 8-bit hardware fault register.',
    },
    {
      criterion: 'Firmware & Rust Maintenance Effort',
      discrete: disc.firmwareLocEstimate,
      hybrid: hyb.firmwareLocEstimate,
      fullIc: full.firmwareLocEstimate,
      winner: 'hybrid_pt1000_ic',
      detail: 'Discrete requires ~80–110 LOC custom gpio_v2 timing + ln() bisection; Hybrid uses standard SPI crates with zero I²C DS2482 quirks.',
    },
    {
      criterion: 'Raspberry Pi GPIO & Bus Usage',
      discrete: isAllPt
        ? '15 GPIOs total (11 for 8× Pt1000 · SPI0 & I²C1 free)'
        : '10 GPIOs total (SPI0 & I²C1 completely free)',
      hybrid: isAllPt
        ? '11 GPIOs total (SPI0 + 3 mux pins · I²C1 free)'
        : '10 GPIOs total (uses SPI0 · I²C1 free)',
      fullIc: isAllPt
        ? '11 GPIOs total (SPI0 + 3 CS pins · I²C1 free)'
        : '10 GPIOs total (uses SPI0 + I²C1 for DS2482)',
      winner: isAllPt ? 'hybrid_pt1000_ic' : 'discrete_active',
      detail: isAllPt
        ? 'On 8-channel All-Pt1000, an analog mux saves 4 Pi GPIOs over direct 8-pin discrete select.'
        : 'Discrete leaves both SPI0 and I²C1 hardware buses completely open for displays or add-ons.',
    },
    {
      criterion: 'Supply-Chain & Long-Term Part Availability',
      discrete: 'Commodity Basic jellybeans (LM393, 2N7002, AO3400A — 10+ second sources)',
      hybrid: '1–2 specialty ICs (MAX31865 / TMUX1208 — single-vendor ADI/TI)',
      fullIc: '5–6 specialty ICs (MAX31865, DS2482, TPS25921, TPL5010 — high EOL/shortage risk)',
      winner: 'discrete_active',
      detail: 'Jellybean Basic parts never go out of stock at JLCPCB; DS2482 and MAX31865 frequently hit lead-time spikes.',
    },
    {
      criterion: '65 × 56 mm HAT PCB Routing & Fit',
      discrete: `${disc.smdPartCount} SMD parts — verified 0 overlaps on 65 × 56 mm`,
      hybrid: `${hyb.smdPartCount} SMD parts — fits 65 × 56 mm comfortably`,
      fullIc: isAllPt
        ? `${full.smdPartCount} SMD parts — VERY CRAMPED (8× SSOP-20 barely fits 65 × 56 mm!)`
        : `${full.smdPartCount} SMD parts — fits 65 × 56 mm easily`,
      winner: isAllPt ? 'discrete_active' : 'tie',
      detail: isAllPt
        ? 'Placing 8× SSOP-20 MAX31865 ICs + 8× 0.1% R_ref + ESD onto a 65×56 mm HAT essentially forces an 85 mm board or 4-layer PCB.'
        : 'On the 1-Wire edition, all 3 architectures fit comfortably on a 2-layer 65×56 mm HAT.',
    },
  ];
}

export interface SplitArchDesignBreakdown {
  edition: HatEdition;
  qty: number;
  barePcbsOrdered: number;
  spareBarePcbs: number;
  pcbAndSetupEur: number;
  smdPartsEur: number;
  extendedFeesEur: number;
  extendedReelCount: number;
  thtPartsAndAssemblyEur: number;
  lineSubtotalExVatEur: number;
}

export interface SplitArchCostResult {
  id: ArchId;
  shortName: string;
  tagline: string;
  oneWireQty: number;
  allPt1000Qty: number;
  totalHats: number;
  totalBarePcbs: number;
  totalSpareBarePcbs: number;
  activeDesignCount: number;
  lines: SplitArchDesignBreakdown[];
  pcbAndSetupOrderEur: number;
  smdPartsOrderEur: number;
  extendedFeesOrderEur: number;
  totalExtendedReelCount: number;
  thtPartsAndAssemblyOrderEur: number;
  combinedShippingEur: number;
  shippingSavedVsSeparateEur: number;
  subtotalExVatEur: number;
  vatEur: number;
  grandTotalOrderEur: number;
  perHatLandedEur: number;
  perHatExVatEur: number;
  deltaTotalVsDiscreteEur: number;
  deltaPerHatVsDiscreteEur: number;
}

/**
 * Compares Our Active Discrete Build vs Smart Hybrid (MAX31865 Pt1000 IC only)
 * vs Full Dedicated-IC HAT for a COMBINED JLCPCB split order of
 * (oneWireQty × 1-Wire HATs) + (allPt1000Qty × All-Pt1000 HATs) in one checkout.
 */
export function computeSplitArchitectureComparison(
  oneWireQty: number,
  allPt1000Qty: number,
  assemblyMode: AssemblyMode
): SplitArchCostResult[] {
  const isZeroSolder = assemblyMode === 'jlcpcb_zero_solder';
  const owStats = getMasterBomStats('onewire');
  const ptStats = getMasterBomStats('all_pt1000');

  const activeEditions: Array<{ edition: HatEdition; qty: number }> = [];
  if (oneWireQty > 0) activeEditions.push({ edition: 'onewire', qty: oneWireQty });
  if (allPt1000Qty > 0) activeEditions.push({ edition: 'all_pt1000', qty: allPt1000Qty });

  const archSpecs: Array<{
    id: ArchId;
    shortName: string;
    tagline: string;
    forEdition: (ed: HatEdition) => {
      smdPartsPerBdEur: number;
      smdJointsPerBd: number;
      smdExtendedReels: number;
    };
  }> = [
    {
      id: 'discrete_active',
      shortName: 'Our Discrete Build',
      tagline: '€0 SMD Extended fees on both designs · commodity Basic parts',
      forEdition: (ed) => {
        const s = ed === 'all_pt1000' ? ptStats : owStats;
        return {
          smdPartsPerBdEur: s.smdPartsPerBoardEur,
          smdJointsPerBd: s.smdJointsPerBoard,
          smdExtendedReels: 0,
        };
      },
    },
    {
      id: 'hybrid_pt1000_ic',
      shortName: 'Smart Hybrid (Pt1000 IC)',
      tagline: '1× MAX31865 on 1-Wire + 1× MAX31865 & 2× TMUX1208 on All-Pt1000',
      forEdition: (ed) => {
        const s = ed === 'all_pt1000' ? ptStats : owStats;
        const isAllPt = ed === 'all_pt1000';
        return {
          smdPartsPerBdEur: s.smdPartsPerBoardEur + (isAllPt ? 6.77 : 4.51),
          smdJointsPerBd: s.smdJointsPerBoard - (isAllPt ? 22 : 16),
          smdExtendedReels: isAllPt ? 2 : 1,
        };
      },
    },
    {
      id: 'full_ic',
      shortName: 'Full Dedicated-IC HAT',
      tagline: 'MAX31865 + DS2482 + Boost/WD/eFuse ICs (8× MAX31865 on All-Pt1000)',
      forEdition: (ed) => {
        const isAllPt = ed === 'all_pt1000';
        return {
          smdPartsPerBdEur: isAllPt ? 42.15 : 11.45,
          smdJointsPerBd: isAllPt ? 386 : 196,
          smdExtendedReels: 6,
        };
      },
    },
  ];

  const rawResults: SplitArchCostResult[] = archSpecs.map((spec) => {
    const lines: SplitArchDesignBreakdown[] = activeEditions.map(({ edition, qty }) => {
      const s = edition === 'all_pt1000' ? ptStats : owStats;
      const cfg = spec.forEdition(edition);
      const barePcbsOrdered = qty <= 5 ? 5 : qty <= 10 ? 10 : Math.ceil(qty / 5) * 5;
      const spareBarePcbs = Math.max(0, barePcbsOrdered - qty);
      const pcbFab =
        barePcbsOrdered <= 5 ? 2.0 : barePcbsOrdered <= 10 ? 4.8 : barePcbsOrdered <= 15 ? 7.2 : 9.8;
      const smdJointsEur = cfg.smdJointsPerBd * qty * 0.0016;
      const pcbAndSetupEur =
        pcbFab + 8.8 + smdJointsEur + (isZeroSolder ? 14.7 + 3.2 : 0);

      const extendedReelCount = cfg.smdExtendedReels + (isZeroSolder ? 3 : 0);
      const extendedFeesEur = extendedReelCount * 2.8;

      const smdPartsEur = cfg.smdPartsPerBdEur * qty;
      const thtPinsPerBoard = edition === 'all_pt1000' ? 40 + 16 + 3 : 40 + 8 + 3;
      const thtPartsAndAssemblyEur =
        s.thtHardwarePerBoardEur * qty + (isZeroSolder ? thtPinsPerBoard * qty * 0.016 : 0);

      const lineSubtotalExVatEur =
        pcbAndSetupEur + smdPartsEur + extendedFeesEur + thtPartsAndAssemblyEur;

      return {
        edition,
        qty,
        barePcbsOrdered,
        spareBarePcbs,
        pcbAndSetupEur,
        smdPartsEur,
        extendedFeesEur,
        extendedReelCount,
        thtPartsAndAssemblyEur,
        lineSubtotalExVatEur,
      };
    });

    const activeDesignCount = lines.length;
    const totalHats = lines.reduce((sum, l) => sum + l.qty, 0);
    const totalBarePcbs = lines.reduce((sum, l) => sum + l.barePcbsOrdered, 0);
    const totalSpareBarePcbs = lines.reduce((sum, l) => sum + l.spareBarePcbs, 0);
    const pcbAndSetupOrderEur = lines.reduce((sum, l) => sum + l.pcbAndSetupEur, 0);
    const smdPartsOrderEur = lines.reduce((sum, l) => sum + l.smdPartsEur, 0);
    const extendedFeesOrderEur = lines.reduce((sum, l) => sum + l.extendedFeesEur, 0);
    const totalExtendedReelCount = lines.reduce((sum, l) => sum + l.extendedReelCount, 0);
    const thtPartsAndAssemblyOrderEur = lines.reduce((sum, l) => sum + l.thtPartsAndAssemblyEur, 0);

    const combinedShippingEur =
      activeDesignCount === 0 ? 0 : activeDesignCount === 1 ? 14.5 : 16.5;
    const shippingSavedVsSeparateEur = activeDesignCount === 2 ? 14.5 * 2 - 16.5 : 0;

    const subtotalExVatEur =
      pcbAndSetupOrderEur +
      smdPartsOrderEur +
      extendedFeesOrderEur +
      thtPartsAndAssemblyOrderEur +
      combinedShippingEur;
    const vatEur = subtotalExVatEur * 0.19;
    const grandTotalOrderEur = subtotalExVatEur + vatEur;

    return {
      id: spec.id,
      shortName: spec.shortName,
      tagline: spec.tagline,
      oneWireQty,
      allPt1000Qty,
      totalHats,
      totalBarePcbs,
      totalSpareBarePcbs,
      activeDesignCount,
      lines,
      pcbAndSetupOrderEur,
      smdPartsOrderEur,
      extendedFeesOrderEur,
      totalExtendedReelCount,
      thtPartsAndAssemblyOrderEur,
      combinedShippingEur,
      shippingSavedVsSeparateEur,
      subtotalExVatEur,
      vatEur,
      grandTotalOrderEur,
      perHatLandedEur: totalHats > 0 ? grandTotalOrderEur / totalHats : 0,
      perHatExVatEur: totalHats > 0 ? subtotalExVatEur / totalHats : 0,
      deltaTotalVsDiscreteEur: 0,
      deltaPerHatVsDiscreteEur: 0,
    };
  });

  const baseDiscrete = rawResults[0];
  return rawResults.map((r) => ({
    ...r,
    deltaTotalVsDiscreteEur: +(r.grandTotalOrderEur - baseDiscrete.grandTotalOrderEur).toFixed(2),
    deltaPerHatVsDiscreteEur: +(r.perHatLandedEur - baseDiscrete.perHatLandedEur).toFixed(2),
  }));
}

