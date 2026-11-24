// CoSTOS 1-Wire HAT — Master Consolidated Board-Wide BOM, DNP List & JLCPCB Cost Engine
// Unifies all 6 redesigned subsystems (01-06) with unique clash-free board-wide RefDes
// and deduplicated LCSC Basic/Preferred reels. Unneeded options (PUMP2, REL2, ID EEPROM,
// DS2482) remain as zero-cost unpopulated (DNP / n.f.) PCB footprints per user spec.

export type MasterBomClass = 'Basic' | 'Preferred' | 'THT';
export type HatEdition = 'onewire' | 'all_pt1000';

export interface MasterBomLine {
  id: string;
  designators: string[];     // Unique clash-free board-wide RefDes list
  subsystems: string[];      // e.g. ['01', '02', '03']
  value: string;
  partName: string;
  footprint: string;         // Standard KiCad 8/9 footprint
  shortPkg: string;          // Short package label for tables/PDF
  lcsc: string;
  bomClass: MasterBomClass;
  unitCostEur: number;
  pinsPerPart: number;       // For JLCPCB solder-joint fee calculation
  purpose: string;
}

export interface DnpFootprintItem {
  refDes: string;
  block: string;
  footprint: string;
  reason: string;
  upgradeCostEur: number;
}

export interface InterBlockNet {
  netName: string;
  source: string;
  destinations: string;
  nominalState: string;
  faultProtection: string;
}

/**
 * Deduplicated, clash-free Master BOM across ALL 6 CoSTOS HAT subsystems (Rev B/D/E).
 * Shared Basic reels are consolidated so JLCPCB loads each reel ONCE.
 * Note: Q5 (WD series-AND gate) is counted once (shared boundary between 03 Watchdog & 05 Output).
 */
export const FULL_HAT_MASTER_BOM: MasterBomLine[] = [
  // === ACTIVE ICs (1 SINGLE BASIC REEL FOR ALL 3 COMPARATORS!) ===
  {
    id: 'lm393',
    designators: ['U1', 'U3', 'U4'],
    subsystems: ['01', '02', '03'],
    value: 'LM393DR',
    partName: 'LM393DR Dual Comparator (SOIC-8)',
    footprint: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
    shortPkg: 'SOIC-8',
    lcsc: 'C7950',
    bomClass: 'Basic',
    unitCostEur: 0.08,
    pinsPerPart: 8,
    purpose: 'U1=01 Pt1000 72Hz slicer/ramp; U3=02 Pump 60kHz osc; U4=03 Dual Schmitt Watchdog',
  },

  // === MOSFETs & BJTs (5 SHARED BASIC REELS) ===
  {
    id: 'ao3400a',
    designators: ['Q1', 'Q2', 'Q3', 'Q5', 'Q18', 'Q23'],
    subsystems: ['01', '02', '03', '05'],
    value: 'AO3400A',
    partName: 'AO3400A 30V 5.7A N-MOSFET',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C20917',
    bomClass: 'Basic',
    unitCostEur: 0.035,
    pinsPerPart: 3,
    purpose: 'Q1-3=01 Pt1000 mux; Q18=02 Doubler lo-side CMOS; Q5=03/05 WD-AND; Q23=03 Red WD_FAULT LED gate (0 uA load on WD_RB)',
  },
  {
    id: 'ao3401a',
    designators: ['Q17', 'Q21'],
    subsystems: ['02', '06'],
    value: 'AO3401A',
    partName: 'AO3401A -30V -4A P-MOSFET',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C15127',
    bomClass: 'Basic',
    unitCostEur: 0.04,
    pinsPerPart: 3,
    purpose: 'Q17=02 Doubler hi-side CMOS; Q21=06 +5V foldback eFuse (Q12 +5V_REL switch DNP)',
  },
  {
    id: '2n7002',
    designators: ['Q19', 'Q20'],
    subsystems: ['04'],
    value: '2N7002',
    partName: '2N7002 60V 115mA N-MOSFET',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C8545',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 3,
    purpose: 'Q19/Q20=04 Bidirectional 3.3V<->5V level-shifters & +60V blockers for 1W-A & 1W-B',
  },
  {
    id: 'mmbt3904',
    designators: ['Q4', 'Q6'],
    subsystems: ['05'],
    value: 'MMBT3904',
    partName: 'MMBT3904 40V 200mA NPN BJT',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C20526',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 3,
    purpose: 'Q4=05 PWM switch; Q6=05 Class-B hi-EF (Q11 REL1 current limiter DNP)',
  },
  {
    id: 'mmbt3906',
    designators: ['Q7', 'Q8', 'Q15', 'Q22'],
    subsystems: ['03', '05', '06'],
    value: 'MMBT3906',
    partName: 'MMBT3906 40V 200mA PNP BJT',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C2146',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 3,
    purpose: 'Q15=03 WD->Q5; Q7/Q8=05 Class-B lo-EF/pre-drv; Q22(Q_EF2)=06 eFuse sense',
  },

  // === DIODES, CLAMPS & LEDs (6 BASIC REELS — D7 Yellow LED DNP with J4) ===
  {
    id: '1n4148w',
    designators: ['D4', 'D5', 'D17', 'D18', 'D19', 'D20', 'D23', 'D24', 'D25', 'D27', 'D28', 'D30'],
    subsystems: ['03', '04', '05'],
    value: '1N4148W',
    partName: '1N4148W 75V 150mA 4pF Fast Diode',
    footprint: 'Diode_SMD:D_SOD-123',
    shortPkg: 'SOD-123',
    lcsc: 'C81598',
    bomClass: 'Basic',
    unitCostEur: 0.008,
    pinsPerPart: 2,
    purpose: 'D19/20=03 WD pump; D23-28=04 1W gate/ESD; D4/5/17/18/30=05 J2 PWM/FB1/RB1 clamps',
  },
  {
    id: 'ss14',
    designators: ['D21', 'D22', 'D26', 'D29'],
    subsystems: ['02', '04'],
    value: 'SS14',
    partName: 'SS14 40V 1A Schottky Diode',
    footprint: 'Diode_SMD:D_SMA',
    shortPkg: 'SMA',
    lcsc: 'C2480',
    bomClass: 'Basic',
    unitCostEur: 0.025,
    pinsPerPart: 2,
    purpose: 'D21/22=02 Doubler rectifiers; D26/29=04 1W reverse-V blockers (D6 REL1 flyback DNP)',
  },
  {
    id: 'pesd24v',
    designators: ['D1'],
    subsystems: ['01'],
    value: 'PESD24VL1BA',
    partName: 'PESD24VL1BA 24V Bidir ESD TVS',
    footprint: 'Diode_SMD:D_SOD-323',
    shortPkg: 'SOD-323',
    lcsc: 'C113987',
    bomClass: 'Basic',
    unitCostEur: 0.03,
    pinsPerPart: 2,
    purpose: '01 Pt1000 J6 roof-cable kV ESD clamp (24V standoff; zero conduction on +24V miswire)',
  },
  {
    id: 'bzx84c5v1',
    designators: ['D8', 'D31', 'D32'],
    subsystems: ['01', '04'],
    value: 'BZX84C5V1',
    partName: 'BZX84C5V1 5.1V 250mW Zener',
    footprint: 'Package_TO_SOT_SMD:SOT-23',
    shortPkg: 'SOT-23',
    lcsc: 'C124375',
    bomClass: 'Basic',
    unitCostEur: 0.02,
    pinsPerPart: 3,
    purpose: 'D8=01 Pt1000 U1A+ clamp (<5 nA @ 1.3V); D31/D32=04 1W-A/B 5V_PROT clamps (protect DS18B20s on +12V DQ fault; 0 new reels)',
  },
  {
    id: 'bzt52c3v6',
    designators: ['D9'],
    subsystems: ['06'],
    value: 'BZT52C3V6',
    partName: 'BZT52C3V6 3.6V 500mW Zener',
    footprint: 'Diode_SMD:D_SOD-123',
    shortPkg: 'SOD-123',
    lcsc: 'C8062',
    bomClass: 'Basic',
    unitCostEur: 0.02,
    pinsPerPart: 2,
    purpose: '06 Pi-OFF +3V3 rail clamp (absorbs 9 mA +24V clamp back-feed <= 3.62V)',
  },
  {
    id: 'led_green',
    designators: ['D2', 'D3', 'D12', 'D33', 'D34', 'D35'],
    subsystems: ['02', '03', '04', '05', '06'],
    value: 'LED Green',
    partName: '0805 Green SMD LED (~2.0V Vf)',
    footprint: 'LED_SMD:LED_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C2297',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: 'D2=06 +5V_HAT PWR; D3=03 WD OK; D12=05 PUMP1 PWM; D33=02 +V_DRV OK; D34/35=04 1W-A/B VDD short-detect (0 new reels)',
  },
  {
    id: 'led_red',
    designators: ['D36'],
    subsystems: ['03'],
    value: 'LED Red',
    partName: '0805 Red SMD LED (~1.9V Vf)',
    footprint: 'LED_SMD:LED_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C84256',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: 'D36=03 Watchdog FAULT / Pi Halted indicator (driven via Q23 AO3400A; ON when WD_OK=0, OFF when 20Hz HB alive)',
  },

  // === PRECISION 0.1% RESISTORS (3 PREFERRED EXTENDED = €0 FEE!) ===
  {
    id: 'r_3k9_01',
    designators: ['R101'],
    subsystems: ['01'],
    value: '3.90k 0.1%',
    partName: '0805 3.90 kΩ ±0.1% 25ppm Thin-Film',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C25884',
    bomClass: 'Preferred',
    unitCostEur: 0.05,
    pinsPerPart: 2,
    purpose: '01 Pt1000 upper excitation bridge resistor (+3V3_ANA -> V_DIV)',
  },
  {
    id: 'r_1k0_01',
    designators: ['R102'],
    subsystems: ['01'],
    value: '1.00k 0.1%',
    partName: '0805 1.00 kΩ ±0.1% 25ppm Thin-Film',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C25804',
    bomClass: 'Preferred',
    unitCostEur: 0.05,
    pinsPerPart: 2,
    purpose: '01 Pt1000 lower 2-point BIST reference (~0 °C calibration)',
  },
  {
    id: 'r_1k8_01',
    designators: ['R103'],
    subsystems: ['01'],
    value: '1.80k 0.1%',
    partName: '0805 1.80 kΩ ±0.1% 25ppm Thin-Film',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C25859',
    bomClass: 'Preferred',
    unitCostEur: 0.05,
    pinsPerPart: 2,
    purpose: '01 Pt1000 upper 2-point BIST reference (~+212 °C calibration)',
  },

  // === 1206 0.5W SURGE / CURRENT-SENSE RESISTORS (5 BASIC REELS — R501 4.7R DNP with J4) ===
  {
    id: 'r_1r8_1206',
    designators: ['R601'],
    subsystems: ['06'],
    value: '1.8 Ω 0.5W',
    partName: '1206 1.8 Ω ±1% 0.5W Sense',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C25059',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: '06 +5V foldback eFuse current-sense shunt (360 mA knee -> 119 mA short)',
  },
  {
    id: 'r_47r_1206',
    designators: ['R105', 'R60'],
    subsystems: ['01', '02'],
    value: '47 Ω 0.5W',
    partName: '1206 47 Ω ±1% 0.5W Guard/Damper',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C17986',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: 'R105=01 Pt1000 PT1_B guard; R60=02 Q17 AO3401A source shoot-through damper (<44 mA pk)',
  },
  {
    id: 'r_100r_1206',
    designators: ['R401', 'R402', 'R403', 'R404'],
    subsystems: ['04'],
    value: '100 Ω 0.5W',
    partName: '1206 100 Ω ±1% 0.5W Limiter',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C17901',
    bomClass: 'Basic',
    unitCostEur: 0.012,
    pinsPerPart: 2,
    purpose: '04 1-Wire A/B per-bus VDD short limiters (47 mA) & DQ +12V surge limiters',
  },
  {
    id: 'r_220r_1206',
    designators: ['R9'],
    subsystems: ['05'],
    value: '220 Ω 0.5W',
    partName: '1206 220 Ω ±1% 0.5W Surge',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C17956',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: '05 Series PWM fault limiter OUTSIDE Q6/Q7 at J2 (35 mA GND short & +24V safe)',
  },
  {
    id: 'r_2k2_1206',
    designators: ['R12'],
    subsystems: ['05'],
    value: '2.2 kΩ 0.5W',
    partName: '1206 2.2 kΩ ±1% 0.5W Surge',
    footprint: 'Resistor_SMD:R_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C17924',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: '05 FB1 series limiter FIRST at J2 Pin 3 (survives continuous +24V @ 0.18W)',
  },

  // === 0805 1% GENERAL RESISTORS (11 CONSOLIDATED BASIC REELS) ===
  {
    id: 'r_10r_0805',
    designators: ['R602'],
    subsystems: ['06'],
    value: '10 Ω 1%',
    partName: '0805 10 Ω ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17415',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '06 +3V3 -> +3V3_ANA RC Pi-filter series resistor (f_c = 1.6 kHz, -36 dB)',
  },
  {
    id: 'r_1k_0805',
    designators: ['R603'],
    subsystems: ['06'],
    value: '1.0 kΩ 1%',
    partName: '0805 1.0 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17513',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: 'R603(R_S)=06 eFuse Q22 upper base sense leg (R17 REL1 LED resistor DNP)',
  },
  {
    id: 'r_1k5_0805',
    designators: ['R59', 'R305', 'R405'],
    subsystems: ['02', '03', '04'],
    value: '1.5 kΩ 1%',
    partName: '0805 1.5 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C22843',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: 'R59=02 U3A pull-up; R305=03 D3 WD LED; R405(R60)=04 shared 1W 3.92V gate bias',
  },
  {
    id: 'r_2k2_0805',
    designators: ['R1', 'R22', 'R37', 'R314', 'R406', 'R407'],
    subsystems: ['03', '04', '05', '06'],
    value: '2.2 kΩ 1%',
    partName: '0805 2.2 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17520',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: 'R1=06 PWR LED; R22/37=05 PUMP1 LED & Q7; R314=03 Red WD_FAULT LED (1.4mA); R406/407=04 5V 1W pull-ups',
  },
  {
    id: 'r_4k7_0805',
    designators: ['R110', 'R111', 'R301', 'R35', 'R36', 'R38', 'R410', 'R411', 'R604'],
    subsystems: ['01', '03', '04', '05', '06'],
    value: '4.7 kΩ 1%',
    partName: '0805 4.7 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17673',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '01 U1 pull-ups; 03 LPF; 04 R410/411 1W-A/B PWR LEDs (0.6mA); 05 Q8/J2 PD; 06 +3V3 Zener bleeder',
  },
  {
    id: 'r_10k_0805',
    designators: ['R104', 'R112', 'R113', 'R114', 'R61', 'R310', 'R311', 'R312', 'R408', 'R409', 'R32', 'R33', 'R605', 'R606'],
    subsystems: ['01', '02', '03', '04', '05', '06'],
    value: '10 kΩ 1%',
    partName: '0805 10 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17414',
    bomClass: 'Basic',
    unitCostEur: 0.004,
    pinsPerPart: 2,
    purpose: 'Board-wide 10k reel: 01 Q1-3/R104; 02 R61 +V_DRV LED (0.7mA); 03 U4/Q15; 04 3.3V PUs; 05 RB1/PWM; 06 eFuse',
  },
  {
    id: 'r_15k_0805',
    designators: ['R58'],
    subsystems: ['02'],
    value: '15 kΩ 1%',
    partName: '0805 15 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17471',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '02 Pump Supply U3A 60.2 kHz RC timing resistor (with C20 = 1 nF C0G)',
  },
  {
    id: 'r_22k_0805',
    designators: ['R11', 'R31'],
    subsystems: ['05'],
    value: '22 kΩ 1%',
    partName: '0805 22 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17560',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '05 R31=RB1 upper divider (2.34V @ 7.5V); R11=FB1 +3V3 pull-up',
  },
  {
    id: 'r_47k_0805',
    designators: ['R55', 'R321', 'R322'],
    subsystems: ['02', '03'],
    value: '47 kΩ 1%',
    partName: '0805 47 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17713',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '02 U3A hysteresis lower leg; 03 U4A & U4B Schmitt lower divider legs',
  },
  {
    id: 'r_100k_0805',
    designators: ['R108', 'R54', 'R56', 'R320', 'R323', 'R324', 'R313', 'R7', 'R16', 'R19'],
    subsystems: ['01', '02', '03', '05'],
    value: '100 kΩ 1%',
    partName: '0805 100 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C149504',
    bomClass: 'Basic',
    unitCostEur: 0.004,
    pinsPerPart: 2,
    purpose: '01/02/03 LM393 hysteresis dividers & Q5 PD; 05 boot-safe GPIO 18/25/5 PDs',
  },
  {
    id: 'r_150k_0805',
    designators: ['R109'],
    subsystems: ['01'],
    value: '150 kΩ 1%',
    partName: '0805 150 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17473',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '01 Pt1000 U1B positive hysteresis feedback (sets 0.44-1.57V ramp window)',
  },
  {
    id: 'r_220k_0805',
    designators: ['R325'],
    subsystems: ['03'],
    value: '220 kΩ 1%',
    partName: '0805 220 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17557',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '03 Watchdog U4A hysteresis feedback (1.54V ON / 0.93V OFF -> 15.4s relay cutoff)',
  },
  {
    id: 'r_390k_0805',
    designators: ['R106', 'R107'],
    subsystems: ['01'],
    value: '390 kΩ 1%',
    partName: '0805 390 kΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17655',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '01 Pt1000 U1B 72.2 Hz RC ramp timing & upper hysteresis leg',
  },
  {
    id: 'r_1m_0805',
    designators: ['R49', 'R50'],
    subsystems: ['03'],
    value: '1.0 MΩ 1%',
    partName: '0805 1.0 MΩ ±1% 0.125W',
    footprint: 'Resistor_SMD:R_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C17514',
    bomClass: 'Basic',
    unitCostEur: 0.005,
    pinsPerPart: 2,
    purpose: '03 Watchdog redundant parallel bleed resistors (500 kΩ -> tau = 17.4s)',
  },

  // === CAPACITORS (7 CONSOLIDATED BASIC MLCC REELS — ZERO ELECTROLYTICS!) ===
  {
    id: 'c_1n_cog',
    designators: ['C20'],
    subsystems: ['02'],
    value: '1 nF C0G',
    partName: '0805 1 nF 50V C0G/NP0 MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C1788',
    bomClass: 'Basic',
    unitCostEur: 0.01,
    pinsPerPart: 2,
    purpose: '02 Pump Supply U3A 60.2 kHz timing cap (zero temp drift)',
  },
  {
    id: 'c_10n_cog',
    designators: ['C101', 'C102', 'C9'],
    subsystems: ['01', '05'],
    value: '10 nF C0G',
    partName: '0805 10 nF 50V C0G/NP0 MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C1710',
    bomClass: 'Basic',
    unitCostEur: 0.015,
    pinsPerPart: 2,
    purpose: 'C101/102=01 Pt1000 20nF C0G ramp bank; C9=05 FB1 723Hz noise filter (reuses reel!)',
  },
  {
    id: 'c_100n_x7r',
    designators: ['C103', 'C104', 'C21', 'C16', 'C301', 'C24', 'C25', 'C26', 'C601', 'C602', 'C603'],
    subsystems: ['01', '02', '03', '04', '06'],
    value: '100 nF X7R',
    partName: '0805 100 nF 50V X7R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C49678',
    bomClass: 'Basic',
    unitCostEur: 0.008,
    pinsPerPart: 2,
    purpose: 'Board-wide 100nF bypass: U1/U3/U4 VCC, 01 EMI, 03 LPF, 04 1W rails, 06 +5V/+3V3_ANA',
  },
  {
    id: 'c_1u_x7r',
    designators: ['C17', 'C19'],
    subsystems: ['03'],
    value: '1 µF X7R',
    partName: '0805 1 µF 16V X7R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C28323',
    bomClass: 'Basic',
    unitCostEur: 0.012,
    pinsPerPart: 2,
    purpose: '03 Watchdog dual series coupling caps (double-fault DC blocking)',
  },
  {
    id: 'c_4u7_x7r',
    designators: ['C22'],
    subsystems: ['02'],
    value: '4.7 µF X7R',
    partName: '0805 4.7 µF 16V X7R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C1779',
    bomClass: 'Basic',
    unitCostEur: 0.025,
    pinsPerPart: 2,
    purpose: '02 Pump Supply flying charge-pump cap (X_c = 3.55 Ohm @ 60 kHz)',
  },
  {
    id: 'c_10u_x5r',
    designators: ['C23', 'C604'],
    subsystems: ['02', '06'],
    value: '10 µF X5R',
    partName: '0805 10 µF 16V X5R MLCC',
    footprint: 'Capacitor_SMD:C_0805_2012Metric',
    shortPkg: '0805',
    lcsc: 'C15850',
    bomClass: 'Basic',
    unitCostEur: 0.03,
    pinsPerPart: 2,
    purpose: 'C23=02 +V_DRV output reservoir; C604(C33a)=06 +3V3_ANA Pi-filter cap',
  },
  {
    id: 'c_22u_1206',
    designators: ['C18A', 'C18B', 'C2A', 'C2B'],
    subsystems: ['03', '06'],
    value: '22 µF 16V X5R',
    partName: '1206 22 µF 16V X5R MLCC (Consolidated!)',
    footprint: 'Capacitor_SMD:C_1206_3216Metric',
    shortPkg: '1206',
    lcsc: 'C12891',
    bomClass: 'Basic',
    unitCostEur: 0.05,
    pinsPerPart: 2,
    purpose: 'C18A/B=03 Watchdog 38uF hold bank (even lower DC-bias loss in 1206!); C2A/B=06 +5V_HAT bulk',
  },

  // === THT CONNECTORS & MECHANICAL HARDWARE (HAND-SOLDERED / LOCAL EU) ===
  {
    id: 'hdr_40pin',
    designators: ['J1'],
    subsystems: ['06'],
    value: '2×20 11mm Header',
    partName: '40-Pin Standard 11mm Female GPIO Header (Passive Pi)',
    footprint: 'Connector_PinSocket_2.54mm:PinSocket_2x20_P2.54mm_Vertical',
    shortPkg: 'THT 2×20',
    lcsc: 'THT-HDR40',
    bomClass: 'THT',
    unitCostEur: 0.45,
    pinsPerPart: 40,
    purpose: 'Standard 11 mm Pi 3/4/5 GPIO header (clears passive heatsink; 65×56 mm clears USB/Eth; saves €1.20 vs tall)',
  },
  {
    id: 'term_3pin',
    designators: ['J2'],
    subsystems: ['05'],
    value: 'DG350-3.5-03P',
    partName: 'Fixed 3-Pin 3.50mm Rising-Cage Screw Terminal (DG350 / MKDS 1.5)',
    footprint: 'TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-3_1x03_P3.50mm_Horizontal',
    shortPkg: 'THT 3P Screw',
    lcsc: 'THT-DG350-03',
    bomClass: 'THT',
    unitCostEur: 0.18,
    pinsPerPart: 3,
    purpose: 'J2=PUMP1 (PWM/GND/FB1); 3.50 mm M2 rising-cage fixed screw (11.0 × 8.2 mm, 0 mm overhang)',
  },
  {
    id: 'term_2pin',
    designators: ['J6'],
    subsystems: ['01', '04'],
    value: 'DG350-3.5-08P',
    partName: 'Fixed 8-Pin 3.50mm Rising-Cage Screw Terminal (DG350 / MKDS 1.5)',
    footprint: 'TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-8_1x08_P3.50mm_Horizontal',
    shortPkg: 'THT 8P Screw',
    lcsc: 'THT-DG350-08',
    bomClass: 'THT',
    unitCostEur: 0.40,
    pinsPerPart: 8,
    purpose: 'J6=Combined 8-Pin Sensor Block: PT1± (1–2), 1W-A 5V/DQ/G (3–5), 1W-B 5V/DQ/G (6–8); 28.5 mm, 0 mm overhang',
  },
  {
    id: 'jp1_hdr',
    designators: ['JP1'],
    subsystems: ['03'],
    value: '2-Pad Test Pt (DNP)',
    partName: 'Unpopulated 2-Pad Copper Tweezer Test Point (WD Bench Override)',
    footprint: 'Jumper:SolderJumper-2_P1.3mm_Open_Pad1.0x1.5mm',
    shortPkg: 'PCB Pads (DNP)',
    lcsc: 'PCB-PADS-DNP',
    bomClass: 'THT',
    unitCostEur: 0.0,
    pinsPerPart: 2,
    purpose: '03 Watchdog bench-test override pads (left OPEN in normal operation; short with tweezers only during bench tests)',
  },
  {
    id: 'tp_pads',
    designators: ['TP1', 'TP2', 'TP3', 'TP4', 'TP5'],
    subsystems: ['01', '02', '03', '06'],
    value: '1.0mm Test Pad (DNP)',
    partName: '5× Bare Copper 1.0mm Bring-Up Test Pads (+5V_HAT, +V_DRV, PT_RAMP, WD_VCAP, AGND)',
    footprint: 'TestPoint:TestPoint_Pad_D1.0mm',
    shortPkg: 'PCB Pad (DNP)',
    lcsc: 'PCB-TP-1MM',
    bomClass: 'THT',
    unitCostEur: 0.0,
    pinsPerPart: 0,
    purpose: 'TP1=+5V_HAT, TP2=+V_DRV, TP3=PT_RAMP, TP4=WD_VCAP, TP5=AGND (€0.00 bare ENIG pads for 5-min scope bring-up)',
  },
  {
    id: 'fiducials',
    designators: ['FID1', 'FID2', 'FID3'],
    subsystems: ['06'],
    value: '1.0mm Fiducial (DNP)',
    partName: '3× Asymmetric Bare Copper Optical Pick-and-Place Fiducials (1.0mm / 2.0mm mask)',
    footprint: 'Fiducial:Fiducial_1mm_Mask2mm',
    shortPkg: 'PCB Fiducial',
    lcsc: 'PCB-FID-1MM',
    bomClass: 'THT',
    unitCostEur: 0.0,
    pinsPerPart: 0,
    purpose: '3 asymmetric corner fiducial marks for JLCPCB SMT optical alignment on SOIC-8/SOT-23 packages (€0.00 bare copper)',
  },
  {
    id: 'net_tie',
    designators: ['NT1'],
    subsystems: ['06'],
    value: 'AGND-GND Star Tie',
    partName: 'Explicit KiCad Copper Star-Ground Net-Tie Bridge (AGND <-> GND at J1 Pins 9/14)',
    footprint: 'NetTie:NetTie-2_SMD_Pad0.5mm',
    shortPkg: 'PCB NetTie',
    lcsc: 'PCB-NT-STAR',
    bomClass: 'THT',
    unitCostEur: 0.0,
    pinsPerPart: 0,
    purpose: 'Enforces clean Kelvin AGND / Digital GND split during KiCad copper pour & DRC (€0.00 PCB copper bridge)',
  },
  {
    id: 'standoffs',
    designators: ['H1', 'H2', 'H3', 'H4'],
    subsystems: ['06'],
    value: 'M2.5×11mm Nylon',
    partName: '4× M2.5 11mm Nylon Standoffs + Screws (Non-Conductive, Passive Pi)',
    footprint: 'MountingHole:MountingHole_2.7mm_M2.5_Pad',
    shortPkg: 'Mech (Nylon)',
    lcsc: 'MECH-M25-NYL',
    bomClass: 'THT',
    unitCostEur: 0.08,
    pinsPerPart: 0,
    purpose: 'Non-conductive 11 mm nylon HAT mounting kit for passively cooled Pi 3/4/5 (zero short risk; saves €0.48/bd vs brass)',
  },
];

/** Unpopulated footprints kept on PCB for zero-cost future expansion (per user spec) */
export const FULL_HAT_DNP_LIST: DnpFootprintItem[] = [
  {
    refDes: 'J4, Q10–Q12, D6, D7, R15, R17, R501',
    block: '05. REL1 Channel (J4 n.f.)',
    footprint: '2-Pin 3.5mm + SOT-23/SMA/1206/0805',
    reason: 'Depopulated per user spec (not needed); GPIO 25 held safely low by populated R16 (100k) and U4A WD_REL_N stays probeable',
    upgradeCostEur: 0.55,
  },
  {
    refDes: 'J3, Q_P2x, R_P2x, D_P2x',
    block: '05. PUMP2 Channel (n.f.)',
    footprint: '3-Pin 3.5mm + SOT-23/0805/1206',
    reason: 'Single solar pump (PUMP1) is default; footprint kept for 2-collector / 2-pump systems',
    upgradeCostEur: 0.85,
  },
  {
    refDes: 'J5, Q_R2x, R_R2x, D_R2x',
    block: '05. REL2 Channel (n.f.)',
    footprint: '2-Pin 3.5mm + SOT-23/SMA/1206',
    reason: 'Backup relay 2 unpopulated; GPIO 5 pulled safely low by populated R19 (100k)',
    upgradeCostEur: 0.55,
  },
  {
    refDes: 'U_ID, R_ID1, R_ID2',
    block: '06. HAT ID EEPROM (D6 n.f.)',
    footprint: 'SOIC-8 + 2× 0805',
    reason: 'D6: config.txt overlays handle setup cleanly; fit CAT24C32 later if plug-and-play DT wanted',
    upgradeCostEur: 0.45,
  },
  {
    refDes: 'U10, C_U10',
    block: '04. DS2482-100 I²C Fallback (n.f.)',
    footprint: 'SOIC-8 + 0805',
    reason: 'Rev B 5V 2N7002 reaches 65 m directly on w1-gpio-pi5; U10 pads kept only for >80 m plants',
    upgradeCostEur: 2.15,
  },
];

/** Shared Inter-Block Power, Safety & Signal Rails verified across 01-06 */
export const INTER_BLOCK_NETS: InterBlockNet[] = [
  {
    netName: '+5V_PI -> +5V_HAT',
    source: 'Pi Pins 2, 4 -> 06 Q21/Q22 eFuse',
    destinations: '01 U1, 02 U3/Q17/D21, 03 U4, 04 D26/D29/R405, 06 D2',
    nominalState: '4.86 V @ ~38 mA (J4 DNP; 4.78 V w/ REL1)',
    faultProtection: '360 mA knee -> 119 mA foldback in 1.8 µs (0.57 W, zero Pi 5 reboot)',
  },
  {
    netName: '+3V3 -> +3V3_ANA',
    source: 'Pi Pins 1, 17 -> 06 D9 + R602/C604',
    destinations: '+3V3_ANA: 01 R101/R107/R110-111, 03 U4A/B ref dividers; +3V3: 04/05/06 clamps',
    nominalState: '3.26 V analog (<0.7 mVpp ripple)',
    faultProtection: '-36 dB buck ripple rejection + D9 BZT52C3V6 holds Pi-OFF <= 3.62 V',
  },
  {
    netName: '+V_DRV',
    source: '02 Pump PWM Supply (U3 + Q17 AO3401A / Q18 AO3400A + R60 47Ω + D21/D22)',
    destinations: '05 Q6/Q8/R36/D4a (Pump PWM Push-Pull Rail)',
    nominalState: '8.78 V nominal (7.16 V J2 PWM, 2.24 V RB1); 7.98 V @ 4.63 V UVLO',
    faultProtection: '62 kHz rail-to-rail CMOS pump (ngspice-39 verified); dead-osc caught by RB1',
  },
  {
    netName: 'WD_OK (~WD_PUMP_RB)',
    source: '03 Watchdog U4B -> Q15 PNP',
    destinations: '05 Q5 (AO3400A series-AND gate) + Pi GPIO 20 (WD_RB) + D3 LED',
    nominalState: '3.25 V when 20 Hz HB alive; 0.0 V > 17.7 s',
    faultProtection: 'Independent U4B comparator; cuts off >= 1 kHz runaway loops & stalls',
  },
  {
    netName: 'WD_REL_N (+5V_REL DNP)',
    source: '03 Watchdog U4A (R310/R325 populated)',
    destinations: 'DNP Q12/J4/J5 relay pads (0 mA load while J4/J5 unpopulated)',
    nominalState: 'Active-low 0.0 V when HB alive; +4.86 V > 15.4 s',
    faultProtection: 'Ready for future J4/J5 relay fitment; GPIO 25 & GPIO 5 safely pulled low (R16/R19)',
  },
  {
    netName: 'GND / AGND Star',
    source: 'Pi Pins 6, 9, 14, 20, 25, 30, 34, 39',
    destinations: 'Kelvin AGND on Pins 9/14 for 01 Pt1000; power return on Pins 6/20/30/39',
    nominalState: '0.000 V reference',
    faultProtection: 'Isolates 60 kHz doubler & pump PWM return currents from Pt1000',
  },
];

const ONEWIRE_ONLY_REFS = new Set([
  'Q19', 'Q20',
  'D23', 'D24', 'D25', 'D26', 'D27', 'D28', 'D29', 'D31', 'D32', 'D34', 'D35',
  'R401', 'R402', 'R403', 'R404', 'R405', 'R406', 'R407', 'R408', 'R409', 'R410', 'R411',
  'C24', 'C25', 'C26',
]);

/**
 * Returns the consolidated, clash-free Master BOM for the selected HAT edition.
 * - 'onewire':    1x Pt1000 + 2x 1-Wire on 1x 8P Fixed Screw (J6 DG350-3.5-08P) + 1x PUMP1 (J2 DG350-3.5-03P) -> 130 SMD (41 reels, incl. D31/D32 clamps) + 8 THT + 5 Test Pads = 143 entries
 * - 'all_pt1000': 8x Switched-Mux Pt1000 on 1x Dual-Tier 2x8P (16-Pin) Fixed Screw (J6 DG350D-3.5-08P) + 1x PUMP1 (J2 DG350-3.5-03P), Zero 1-Wire
 *   -> 135 SMD (39 reels) + 8 THT + 5 Test Pads = 148 entries!
 *   Reuses 100% of the Tab 01 Pt1000 core (U1 LM393DR + R101/R102/R103 0.1% bridge + Q2/Q3 BIST)
 *   and adds ZERO new SMD reels (drops 2N7002 & 100R 1206 reels completely!).
 */
export function getMasterBom(edition: HatEdition = 'onewire'): MasterBomLine[] {
  if (edition === 'onewire') return FULL_HAT_MASTER_BOM;

  const extraMuxChannels = ['B', 'C', 'D', 'E', 'F', 'G', 'H']; // Ch 2..8 (Ch 1 is Q1/D1/R105/R112 on Sheet 01; J6 is shared 16-pin dual-tier block)
  const out: MasterBomLine[] = [];

  for (const line of FULL_HAT_MASTER_BOM) {
    let des = line.designators.filter((r) => !ONEWIRE_ONLY_REFS.has(r));
    let subs = line.subsystems.filter((s) => s !== '04');
    let purpose = line.purpose;
    let value = line.value;
    let partName = line.partName;
    let footprint = line.footprint;
    let shortPkg = line.shortPkg;
    let lcsc = line.lcsc;
    let unitCostEur = line.unitCostEur;
    let pinsPerPart = line.pinsPerPart;

    if (line.id === 'ao3400a') {
      des = ['Q1', ...extraMuxChannels.map((c) => `Q1${c}`), 'Q2', 'Q3', 'Q5', 'Q18', 'Q23'];
      subs = ['01', '02', '03', '04', '05'];
      purpose = 'Q1+Q1B-H=8x Pt1000 grounded-source mux (all Pull-DOWN GPIOs); Q2/3=BIST; Q18=02 Doubler; Q5=03/05 WD-AND; Q23=03 Red WD_FAULT LED';
    } else if (line.id === 'pesd24v') {
      des = ['D1', ...extraMuxChannels.map((c) => `D1${c}`)];
      subs = ['01', '04'];
      purpose = 'D1=shared PT1_V_DIV ESD; D1B-H=Ch 2-8 return cable kV ESD clamps (24V standoff)';
    } else if (line.id === 'r_47r_1206') {
      des = ['R105', ...extraMuxChannels.map((c) => `R105${c}`), 'R60'];
      subs = ['01', '02', '04'];
      purpose = 'R105+R105B-H=8x Pt1000 return fault guards (0.5W); R60=02 Q17 shoot-through damper';
    } else if (line.id === 'r_10k_0805') {
      des = [
        'R104', 'R112', ...extraMuxChannels.map((c) => `R112${c}`),
        'R113', 'R114', 'R61', 'R310', 'R311', 'R312', 'R32', 'R33', 'R605', 'R606',
      ];
      subs = ['01', '02', '03', '04', '05', '06'];
      purpose = 'Board-wide 10k reel: 01/04 8x Pt1000 mux gate PDs + BIST; 02 R61 +V_DRV LED; 03 U4; 05 RB1/PWM; 06 eFuse';
    } else if (line.id === 'term_2pin') {
      des = ['J6'];
      subs = ['01', '04'];
      value = 'DG350D-3.5-08P';
      partName = 'Dual-Tier 2×8P (16-Pin) 3.50mm Fixed Rising-Cage Screw Terminal (DG350D / MKKDS 1.5)';
      footprint = 'TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKKDS-1,5-8-3,5_2x08_P3.50mm_Horizontal';
      shortPkg = 'THT 2×8P Screw';
      lcsc = 'THT-DG350D-08';
      unitCostEur = 0.95; // 1x 16-pin dual-tier fixed rising-cage screw block (DG350D-3.5-08P / MKKDS 1.5)
      pinsPerPart = 16;
      purpose = 'J6=ALL 8× Pt1000 (16 wires) in 29.4 mm! Upper Tier=PT1–4, Lower Tier=PT5–8; M2 rising-cage screws, 0 mm overhang';
    } else if (line.id === 'term_3pin') {
      purpose = 'J2=PUMP1 (PWM/GND/FB1); DG350-3.5-03P rising-cage screw (J3 PUMP2, J4 REL1 & J5 REL2 DNP on front edge)';
    } else if (line.id === '1n4148w') {
      purpose = 'D19/20=03 WD pump; D4/5/17/18/30=05 J2 PWM/FB1/RB1 clamps (Zero 1-Wire diodes)';
    } else if (line.id === 'ss14') {
      purpose = 'D21/22=02 Doubler rectifiers (Zero 1-Wire blockers; D6 REL1 flyback DNP)';
    } else if (line.id === 'led_green') {
      purpose = 'D2=06 +5V_HAT PWR; D3=03 WD OK; D12=05 PUMP1 PWM; D33=02 +V_DRV charge-pump OK (0 new reels)';
    } else if (line.id === 'r_1k5_0805') {
      purpose = 'R59=02 U3A pull-up; R305=03 D3 WD LED';
    } else if (line.id === 'r_2k2_0805') {
      purpose = 'R1=06 PWR LED; R22/37=05 PUMP1 LED & Q7 drive; R314=03 Red WD_FAULT LED';
    } else if (line.id === 'r_4k7_0805') {
      purpose = '01 U1 pull-ups; 03 LPF; 05 Q8 drive/bleed & J2 idle PD; 06 +3V3 Zener bleeder';
    } else if (line.id === 'bzx84c5v1') {
      purpose = 'D8=01 Pt1000 U1A+ sense clamp (<5 nA @ 1.3V, clamps +24V roof fault to 5.1V)';
    } else if (line.id === 'c_100n_x7r') {
      purpose = 'Board-wide 100nF bypass: U1/U3/U4 VCC, 01 EMI, 03 LPF, 06 +5V/+3V3_ANA';
    }

    if (des.length === 0) continue; // Drops 2N7002 & 100R 1206 reels completely!
    out.push({
      ...line,
      designators: des,
      subsystems: subs,
      value,
      partName,
      footprint,
      shortPkg,
      lcsc,
      unitCostEur,
      pinsPerPart,
      purpose,
    });
  }

  return out;
}

export function getDnpList(edition: HatEdition = 'onewire'): DnpFootprintItem[] {
  if (edition === 'onewire') return FULL_HAT_DNP_LIST;
  return FULL_HAT_DNP_LIST.filter((d) => !d.block.startsWith('04.'));
}

export function getInterBlockNets(edition: HatEdition = 'onewire'): InterBlockNet[] {
  if (edition === 'onewire') return INTER_BLOCK_NETS;
  return [
    {
      netName: '+5V_PI -> +5V_HAT',
      source: 'Pi Pins 2, 4 -> 06 Q21/Q22 eFuse',
      destinations: '01 U1, 02 U3/Q17/D21, 03 U4, 06 D2 (Zero 1-Wire load)',
      nominalState: '4.88 V @ ~24 mA (J4 REL1 DNP, Zero 1-Wire)',
      faultProtection: '360 mA knee -> 119 mA foldback in 1.8 µs (0.57 W, zero Pi 5 reboot)',
    },
    {
      netName: 'PT1_V_DIV (8× Mux Bus)',
      source: '01 R101 (3.90 kΩ 0.1%) from +3V3_ANA -> shared excitation rail',
      destinations: 'J6 Dual-Tier 2×8P DG350D Pins 1,3,5,7 (Upper PT1–4) & 9,11,13,15 (Lower PT5–8), R102/R103 BIST, R104 -> U1 LM393DR',
      nominalState: '0.67 mA into 1 active Pt1000 at a time (~1.4 s full 8-ch + 2-pt BIST scan)',
      faultProtection: '100% reuses Tab 01 U1 + 0.1% bridge; per-channel 47 Ω 1206 + PESD24V + D8 5.1V clamp; all 8 select GPIOs Pull-DOWN at boot',
    },
    ...INTER_BLOCK_NETS.slice(1).map((n) =>
      n.netName.startsWith('WD_REL_N')
        ? {
            ...n,
            destinations: 'DNP Q12/J4 REL1/J5 REL2 relay pads (0 mA load while unpopulated)',
            faultProtection: 'Ready for future J4 REL1 / J5 REL2 fitment; GPIO 25 & GPIO 5 safely pulled low (R16/R19)',
          }
        : n.netName.startsWith('GND / AGND')
          ? {
              ...n,
              destinations: 'Expanded full-left Kelvin AGND on Pins 9/14 for all 8 Pt1000 channels on J6 (2×8P); power return on Pins 6/20/30/39',
            }
          : n
    ),
  ];
}

export interface CostCalcOptions {
  batchSize: 2 | 5 | 10 | 25;
  includeVat19: boolean;
  includeShipping: boolean;
  includeThtHardware: boolean;
  conservative01PctFee: boolean; // If true, assumes 3x 0.1% resistors pay €2.80 Extended fee each
}

export interface BuildCostResult {
  label: string;
  pcbFabOrderEur: number;
  smtSetupAndStencilEur: number;
  solderJointsOrderEur: number;
  extendedFeesOrderEur: number;
  extendedReelCount: number;
  smdPartsOrderEur: number;
  thtHardwareOrderEur: number;
  shippingOrderEur: number;
  subtotalExVatEur: number;
  vatEur: number;
  grandTotalOrderEur: number;
  perBoardEur: number;
  perBoardExVatEur: number;
  smdPartCount: number;
  uniqueSmdReels: number;
}

export function getMasterBomStats(edition: HatEdition = 'onewire') {
  const bom = getMasterBom(edition);
  const smdLines = bom.filter((l) => l.bomClass !== 'THT');
  const thtLines = bom.filter((l) => l.bomClass === 'THT');

  const smdPartCount = smdLines.reduce((s, l) => s + l.designators.length, 0);
  const thtPartCount = thtLines.reduce((s, l) => s + l.designators.length, 0);
  const smdJointsPerBoard = smdLines.reduce((s, l) => s + l.designators.length * l.pinsPerPart, 0);
  const smdPartsPerBoardEur = smdLines.reduce((s, l) => s + l.designators.length * l.unitCostEur, 0);
  const thtHardwarePerBoardEur = thtLines.reduce((s, l) => s + l.designators.length * l.unitCostEur, 0);
  const preferredLines = smdLines.filter((l) => l.bomClass === 'Preferred').length;

  return {
    smdLines,
    thtLines,
    smdPartCount,
    thtPartCount,
    smdJointsPerBoard,
    smdPartsPerBoardEur,
    thtHardwarePerBoardEur,
    uniqueSmdReels: smdLines.length,
    preferredLines,
  };
}

export function computeFullHatCosts(
  opts: CostCalcOptions,
  edition: HatEdition = 'onewire'
): {
  revAPreD25: BuildCostResult;
  revAD25Repo: BuildCostResult;
  revBGemini: BuildCostResult;
} {
  const stats = getMasterBomStats(edition);
  const n = opts.batchSize;
  const isAllPt = edition === 'all_pt1000';

  // JLCPCB 2-layer 65x56 mm HAT PCB pricing (5 pcs min order)
  const pcbFab = n <= 5 ? 2.0 : n <= 10 ? 4.8 : 9.8;
  // JLCPCB Economic PCBA single-sided setup (~€7.40) + stencil (~€1.40)
  const smtSetup = 8.8;
  const shipping = opts.includeShipping ? 14.5 : 0;
  const thtPerBoard = opts.includeThtHardware ? stats.thtHardwarePerBoardEur : 0;

  const makeResult = (cfg: {
    label: string;
    smdPartsPerBd: number;
    smdPartCount: number;
    uniqueReels: number;
    jointsPerBd: number;
    extendedReelCount: number;
    extraThtPerBd?: number;
  }): BuildCostResult => {
    const jointsEur = cfg.jointsPerBd * n * 0.0016;
    const extFees = cfg.extendedReelCount * 2.8;
    const smdOrder = cfg.smdPartsPerBd * n;
    const thtOrder = (thtPerBoard + (cfg.extraThtPerBd ?? 0)) * n;
    const subtotal = pcbFab + smtSetup + jointsEur + extFees + smdOrder + thtOrder + shipping;
    const vat = opts.includeVat19 ? subtotal * 0.19 : 0;
    const grand = subtotal + vat;

    return {
      label: cfg.label,
      pcbFabOrderEur: pcbFab,
      smtSetupAndStencilEur: smtSetup,
      solderJointsOrderEur: jointsEur,
      extendedFeesOrderEur: extFees,
      extendedReelCount: cfg.extendedReelCount,
      smdPartsOrderEur: smdOrder,
      thtHardwareOrderEur: thtOrder,
      shippingOrderEur: shipping,
      subtotalExVatEur: subtotal,
      vatEur: vat,
      grandTotalOrderEur: grand,
      perBoardEur: grand / n,
      perBoardExVatEur: subtotal / n,
      smdPartCount: cfg.smdPartCount,
      uniqueSmdReels: cfg.uniqueReels,
    };
  };

  // 1. Conventional multi-IC baseline
  const revAPreD25 = isAllPt
    ? makeResult({
        label: 'Conventional 8× MAX31865 HAT',
        smdPartsPerBd: 42.4, // 8x MAX31865 (€4.80 ea = €38.40) + 8x 4.02k 0.1% + SPI CS decoder + passives
        smdPartCount: 136,
        uniqueReels: 39,
        jointsPerBd: 424,
        extendedReelCount: 7, // MAX31865 + 4.02k 0.1% + 74HC138 + TVS + etc.
      })
    : makeResult({
        label: 'Original Rev A (Pre-D25)',
        smdPartsPerBd: 12.6,
        smdPartCount: 74,
        uniqueReels: 36,
        jointsPerBd: 210,
        extendedReelCount: 11, // €30.80 Extended fees
        extraThtPerBd: 3.1, // B0512S DC/DC module + J1 barrel/terminal
      });

  // 2. Repo Rev A D22-D25 (or 1x MAX31865 + Analog Mux alternative)
  const revAD25Repo = isAllPt
    ? makeResult({
        label: '1× MAX31865 + 8-Ch Analog Mux',
        smdPartsPerBd: 8.15, // MAX31865 (€4.80) + 4.02k 0.1% + TMUX1208/DG408 low-Ron 8-ch mux (€1.95) + passives
        smdPartCount: 108,
        uniqueReels: 35,
        jointsPerBd: 268,
        extendedReelCount: 6, // MAX31865 + 4.02k 0.1% + Analog Mux + SMBJ13A + PESD5V0 + C2 elec (€16.80)
      })
    : makeResult({
        label: 'Repo Rev A (D22-D25)',
        smdPartsPerBd: 6.45, // MAX31865 ~€4.80 + 430R 0.1% + SMBJ13A + PESD5V0 + discretes
        smdPartCount: 86,
        uniqueReels: 32,
        jointsPerBd: 226,
        extendedReelCount: 5, // MAX31865 + 430R 0.1% + SMBJ13A + PESD5V0 + C2 100uF elec (€14.00)
      });

  // 3. Redesigned Rev B/D/E (Gemini Release — 100% Basic + 3x Preferred 0.1% resistors!)
  const revBGemini = makeResult({
    label: isAllPt ? 'Rev B/D/E All-Pt1000 (8× Mux)' : 'Rev B/D/E 1-Wire (Gemini)',
    smdPartsPerBd: stats.smdPartsPerBoardEur,
    smdPartCount: stats.smdPartCount,
    uniqueReels: stats.uniqueSmdReels,
    jointsPerBd: stats.smdJointsPerBoard,
    extendedReelCount: opts.conservative01PctFee ? stats.preferredLines : 0,
  });

  return { revAPreD25, revAD25Repo, revBGemini };
}

export type SplitAssemblyMode = 'diy_tht' | 'jlcpcb_zero_solder';

export interface SplitOrderDesignLine {
  edition: HatEdition;
  label: string;
  assembledQty: number;
  barePcbsOrdered: number;
  spareBarePcbs: number;
  pcbFabEur: number;
  smtSetupEur: number;
  smtJointsEur: number;
  extendedFeesEur: number;
  smdPartsEur: number;
  thtHardwareEur: number;
  zeroSolderUpgradeEur: number;
  thtPinsPerBoard: number;
  lineSubtotalExVatEur: number;
}

export interface SplitOrderResult {
  oneWireQty: number;
  allPt1000Qty: number;
  totalAssembledHats: number;
  totalBarePcbs: number;
  totalSpareBarePcbs: number;
  activeDesignCount: number;
  assemblyMode: SplitAssemblyMode;
  lines: SplitOrderDesignLine[];
  pcbFabOrderEur: number;
  smtSetupOrderEur: number;
  smtJointsOrderEur: number;
  extendedFeesOrderEur: number;
  smdPartsOrderEur: number;
  thtHardwareOrderEur: number;
  zeroSolderOrderEur: number;
  combinedShippingEur: number;
  shippingSavedVsSeparateEur: number;
  subtotalExVatEur: number;
  vatEur: number;
  grandTotalOrderEur: number;
  perHatLandedEur: number;
  perHatExVatEur: number;
}

/**
 * Computes combined JLCPCB shopping-cart pricing when ordering TWO separate PCB designs together
 * (e.g., 3x 1-Wire HATs + 3x All-Pt1000 HATs = 6 assembled HATs in one shipment).
 *
 * JLCPCB rules modeled accurately:
 * - Each active PCB design (qty > 0) requires min 5 bare PCBs (€2.00) + 1x PCBA setup/stencil (€8.80 Economic).
 * - Minimum SMT assembly qty per active design is 2 boards (unused bare PCBs ship as free spares).
 * - Combined EU tracked shipping is paid ONCE (~€16.50 for 2 small 5-PCB packs vs 2 x €14.50 = €29.00 separately).
 * - For 100% Zero-Solder Turnkey, Standard PCBA upgrade (+€14.70) + THT wave setup (+€3.20) + 3x THT Extended reels (+€8.40)
 *   = +€26.30 fixed per active design + €0.016/THT pin.
 */
export function computeSplitOrderCosts(
  oneWireQty: number,
  allPt1000Qty: number,
  opts: Omit<CostCalcOptions, 'batchSize'>,
  assemblyMode: SplitAssemblyMode = 'diy_tht'
): SplitOrderResult {
  const isZeroSolder = assemblyMode === 'jlcpcb_zero_solder';

  const buildLine = (edition: HatEdition, qty: number): SplitOrderDesignLine | null => {
    if (qty <= 0) return null;
    const stats = getMasterBomStats(edition);
    const barePcbsOrdered = qty <= 5 ? 5 : qty <= 10 ? 10 : Math.ceil(qty / 5) * 5;
    const spareBarePcbs = Math.max(0, barePcbsOrdered - qty);
    const pcbFabEur =
      barePcbsOrdered <= 5 ? 2.0 : barePcbsOrdered <= 10 ? 4.8 : barePcbsOrdered <= 15 ? 7.2 : 9.8;
    const smtSetupEur = 8.8;
    const smtJointsEur = stats.smdJointsPerBoard * qty * 0.0016;
    const extendedFeesEur = (opts.conservative01PctFee ? stats.preferredLines : 0) * 2.8;
    const smdPartsEur = stats.smdPartsPerBoardEur * qty;
    const thtHardwareEur = opts.includeThtHardware ? stats.thtHardwarePerBoardEur * qty : 0;
    const thtPinsPerBoard = edition === 'all_pt1000' ? 40 + 16 + 3 : 40 + 8 + 3; // 59 or 51 pins
    const zeroSolderUpgradeEur = isZeroSolder
      ? 14.7 + 3.2 + 3 * 2.8 + thtPinsPerBoard * qty * 0.016
      : 0;

    const lineSubtotalExVatEur =
      pcbFabEur +
      smtSetupEur +
      smtJointsEur +
      extendedFeesEur +
      smdPartsEur +
      thtHardwareEur +
      zeroSolderUpgradeEur;

    return {
      edition,
      label: edition === 'all_pt1000' ? 'All-Pt1000 HAT (8× Pt1000 · 2×8P)' : '1-Wire HAT (1× Pt1000 + 2× 1-Wire · 8P)',
      assembledQty: qty,
      barePcbsOrdered,
      spareBarePcbs,
      pcbFabEur,
      smtSetupEur,
      smtJointsEur,
      extendedFeesEur,
      smdPartsEur,
      thtHardwareEur,
      zeroSolderUpgradeEur,
      thtPinsPerBoard,
      lineSubtotalExVatEur,
    };
  };

  const lines = [buildLine('onewire', oneWireQty), buildLine('all_pt1000', allPt1000Qty)].filter(
    (l): l is SplitOrderDesignLine => l !== null
  );

  const activeDesignCount = lines.length;
  const totalAssembledHats = lines.reduce((s, l) => s + l.assembledQty, 0);
  const totalBarePcbs = lines.reduce((s, l) => s + l.barePcbsOrdered, 0);
  const totalSpareBarePcbs = lines.reduce((s, l) => s + l.spareBarePcbs, 0);
  const pcbFabOrderEur = lines.reduce((s, l) => s + l.pcbFabEur, 0);
  const smtSetupOrderEur = lines.reduce((s, l) => s + l.smtSetupEur, 0);
  const smtJointsOrderEur = lines.reduce((s, l) => s + l.smtJointsEur, 0);
  const extendedFeesOrderEur = lines.reduce((s, l) => s + l.extendedFeesEur, 0);
  const smdPartsOrderEur = lines.reduce((s, l) => s + l.smdPartsEur, 0);
  const thtHardwareOrderEur = lines.reduce((s, l) => s + l.thtHardwareEur, 0);
  const zeroSolderOrderEur = lines.reduce((s, l) => s + l.zeroSolderUpgradeEur, 0);

  const combinedShippingEur = !opts.includeShipping
    ? 0
    : activeDesignCount === 0
      ? 0
      : activeDesignCount === 1
        ? 14.5
        : 16.5;
  const shippingSavedVsSeparateEur =
    opts.includeShipping && activeDesignCount === 2 ? 14.5 * 2 - 16.5 : 0;

  const subtotalExVatEur =
    pcbFabOrderEur +
    smtSetupOrderEur +
    smtJointsOrderEur +
    extendedFeesOrderEur +
    smdPartsOrderEur +
    thtHardwareOrderEur +
    zeroSolderOrderEur +
    combinedShippingEur;

  const vatEur = opts.includeVat19 ? subtotalExVatEur * 0.19 : 0;
  const grandTotalOrderEur = subtotalExVatEur + vatEur;

  return {
    oneWireQty,
    allPt1000Qty,
    totalAssembledHats,
    totalBarePcbs,
    totalSpareBarePcbs,
    activeDesignCount,
    assemblyMode,
    lines,
    pcbFabOrderEur,
    smtSetupOrderEur,
    smtJointsOrderEur,
    extendedFeesOrderEur,
    smdPartsOrderEur,
    thtHardwareOrderEur,
    zeroSolderOrderEur,
    combinedShippingEur,
    shippingSavedVsSeparateEur,
    subtotalExVatEur,
    vatEur,
    grandTotalOrderEur,
    perHatLandedEur: totalAssembledHats > 0 ? grandTotalOrderEur / totalAssembledHats : 0,
    perHatExVatEur: totalAssembledHats > 0 ? subtotalExVatEur / totalAssembledHats : 0,
  };
}
