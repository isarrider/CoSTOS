// KiCad 10 Complete Hierarchical Multi-Sheet Project + All-Downloadables ZIP Bundle Generator
// Generates:
//   - CoSTOS_HAT_RevB.kicad_pro (KiCad 10 project configuration + JLCPCB 2-layer DRC rules)
//   - CoSTOS_HAT_RevB.kicad_sch (Root hierarchical sheet linking 6 per-circuit sub-sheets)
//   - 01_Pt1000_Collector.kicad_sch       (25 parts — wired Rev D ratiometric Pt1000 slicer)
//   - 02_Pump_Supply.kicad_sch            (15 parts — wired Rev E Option 2 CMOS doubler)
//   - 03_Hardware_Watchdog.kicad_sch      (26 parts — wired Rev B dual-Schmitt U4 watchdog; Q12 DNP)
//   - 04_OneWire_Buses.kicad_sch          (23 parts — wired Rev B 5V 2N7002 buses A & B)
//   - 05_Output_Stage.kicad_sch           (27 parts — wired Rev B Class-B PWM, FB1/RB1; J4 REL1 DNP)
//   - 06_Power_Entry.kicad_sch            (22 parts — wired Rev B 40-pin J1, foldback eFuse, +3V3_ANA)
//   - Complete ZIP bundle packing ALL KiCad 10 files, JLCPCB CSVs, ngspice .cir, and ALL 7 PDF reports!

import JSZip from 'jszip';
import {
  CostCalcOptions,
  HatEdition,
  MasterBomLine,
  getMasterBom,
  getMasterBomStats,
} from '../data/masterBom';
import {
  getVerifiedBoardNets,
  generateFullMasterBomCsv,
  generateJlcpcbBomCsv,
  generateKicadNetlist,
  generateKicadPcbStarter,
  generateNgspiceDeck,
} from './kicadAndSpiceExports';
import { buildFullHatCostsPdfDoc } from './exportPdfReport';
import { buildCostosPdfDoc } from '../../01-PT1000/utils/exportPdfReport';
import { DEFAULT_PARAMS as DEFAULT_PT1000_PARAMS } from '../../01-PT1000/physics/model';
import { buildOneWirePdfDoc } from '../../02-OneWire/utils/exportPdfReport';
import { DEFAULT_ONEWIRE_PARAMS } from '../../02-OneWire/physics/model';
import { buildPumpSupplyPdfDoc } from '../../03-PumpSupply/utils/exportPdfReport';
import { DEFAULT_PUMP_PARAMS } from '../../03-PumpSupply/physics/model';
import { buildWatchdogPdfDoc } from '../../04-Watchdog/utils/exportPdfReport';
import { DEFAULT_WATCHDOG_PARAMS } from '../../04-Watchdog/physics/model';
import { buildOutputStagePdfDoc } from '../../05-OutputStage/utils/exportPdfReport';
import { DEFAULT_OUTPUT_PARAMS } from '../../05-OutputStage/physics/model';
import { buildPowerEntryPdfDoc } from '../../06-PowerEntry/utils/exportPdfReport';
import { DEFAULT_POWER_PARAMS } from '../../06-PowerEntry/physics/model';

const ROOT_SCH_UUID = 'c0570500-000b-4000-8000-000000000001';
const PROJECT_NAME = 'CoSTOS_HAT_RevB';

export interface KicadSheetDescriptor {
  id: string;
  pageNumber: number;
  filename: string;
  sheetName: string;
  shortLabel: string;
  subtitle: string;
  uuid: string;
  rootBox: { x: number; y: number; w: number; h: number };
  groups: {
    title: string;
    note: string;
    refs: string[];
  }[];
}

export const KICAD_SUBSHEETS: KicadSheetDescriptor[] = [
  {
    id: '01',
    pageNumber: 2,
    filename: '01_Pt1000_Collector.kicad_sch',
    sheetName: '01. Pt1000 Collector (Rev D)',
    shortLabel: '01 Pt1000',
    subtitle: 'Switched-Mux 0.1% Thin-Film Bridge + U1 LM393DR 72 Hz Ratiometric Ramp/Slicer',
    uuid: 'c0570500-0010-4000-8000-000000000001',
    rootBox: { x: 25.4, y: 30.48, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: Sensor Terminal (J6 DG350 8P / DG350D 2x8P Fixed Screw), ESD/Zener Guard & 0.1% Bridge',
        note: 'J6 fixed rising-cage screw -> D1 PESD24V + R105 47R 1206 + R101/102/103 0.1% Preferred thin-film',
        refs: ['J6', 'D1', 'R101', 'R102', 'R103', 'R104', 'R105', 'C103', 'D8'],
      },
      {
        title: 'Stage B: Grounded-Source 2-Point BIST Mux (Q1-Q3 AO3400A)',
        note: 'GPIO 27 (PT_SEL), GPIO 12 (REF_LO_SEL 1.00k), GPIO 13 (REF_HI_SEL 1.80k)',
        refs: ['Q1', 'Q2', 'Q3', 'R112', 'R113', 'R114'],
      },
      {
        title: 'Stage C: U1 LM393DR 72.2 Hz C0G Ramp, Duty-Cycle Slicer & Test Pads (TP3, TP5)',
        note: 'U1B generates 0.44-1.57 V ramp on C101/C102 (2x10nF C0G); U1A slices PT1_SENSE -> DUTY_IN (GPIO 22); TP3=PT_RAMP, TP5=AGND',
        refs: ['U1', 'C104', 'R106', 'R107', 'R108', 'R109', 'R110', 'R111', 'C101', 'C102', 'TP3', 'TP5'],
      },
    ],
  },
  {
    id: '02',
    pageNumber: 3,
    filename: '02_Pump_Supply.kicad_sch',
    sheetName: '02. Pump Supply (Rev E CMOS)',
    shortLabel: '02 Pump Supply',
    subtitle: 'U3A 60.2 kHz Osc + Option 2 Rail-to-Rail AO3401A/AO3400A + R60 47R Damper + SS14 Doubler (+8.81 V)',
    uuid: 'c0570500-0020-4000-8000-000000000001',
    rootBox: { x: 152.4, y: 30.48, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: U3A 60.2 kHz Relaxation Oscillator (U3B Tied Off)',
        note: 'R58 15k + C20 1nF C0G; R59 1.5k pull-up (<=3.5 mA LM393 sink); U3B Pin 5=+5V_HAT, Pin 6=GND',
        refs: ['U3', 'C21', 'R54', 'R55', 'R56', 'R58', 'R59', 'C20'],
      },
      {
        title: 'Stage B: Option 2 Rail-to-Rail CMOS Driver (Zero 2xVbe Loss)',
        note: 'Q17 AO3401A + Q18 AO3400A + R60 47R 1206 shoot-through damper (<44 mA pk)',
        refs: ['R60', 'Q17', 'Q18'],
      },
      {
        title: 'Stage C: SS14 Schottky Villard Charge-Pump Doubler -> +V_DRV, D33 LED & TP2',
        note: 'C22 4.7uF flying cap + D21/D22 SS14 + C23 10uF -> +9.1 V +V_DRV; R61 10k + D33 Green OK LED (~0.7 mA); TP2=+V_DRV',
        refs: ['C22', 'D21', 'D22', 'C23', 'R61', 'D33', 'TP2'],
      },
    ],
  },
  {
    id: '03',
    pageNumber: 4,
    filename: '03_Hardware_Watchdog.kicad_sch',
    sheetName: '03. Hardware Watchdog (Rev B)',
    shortLabel: '03 Watchdog',
    subtitle: 'Bandpass Charge Pump + Dedicated U4 LM393DR Dual Schmitt (15.4 s REL / 17.7 s PWM Stagger)',
    uuid: 'c0570500-0030-4000-8000-000000000001',
    rootBox: { x: 279.4, y: 30.48, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: Bandpass LPF, Double-Fault DC Block, 17.4 s Hold Bank & TP4',
        note: 'GPIO 24 (WD_HB 20 Hz) -> R301/C16 LPF -> C17/C19 1uF -> D19/D20 -> C18A/B (2x22uF 1206) || R49/R50 1M; TP4=WD_VCAP',
        refs: ['R301', 'C16', 'C17', 'C19', 'D19', 'D20', 'C18A', 'C18B', 'R49', 'R50', 'JP1', 'TP4'],
      },
      {
        title: 'Stage B: U4 LM393DR Dual Schmitt Comparators & Threshold Dividers',
        note: 'U4A (1.54V/0.91V -> 14.1-15.4 s REL cutoff) & U4B (1.35V/0.79V -> 16.8-17.7 s PWM cutoff)',
        refs: ['U4', 'C301', 'R320', 'R321', 'R325', 'R323', 'R322', 'R324', 'R310', 'R311'],
      },
      {
        title: 'Stage C: WD_OK Inverter, Green D3 OK LED & Red D36 FAULT LED (Q15, Q23, D3, D36)',
        note: 'Q15 drives WD_OK -> Q5; D3 Green=WD OK; Q23 AO3400A (0 uA gate load on WD_RB) drives R314 2.2k + Red D36=WD FAULT',
        refs: ['Q15', 'R312', 'R313', 'R305', 'D3', 'Q23', 'R314', 'D36'],
      },
    ],
  },
  {
    id: '04',
    pageNumber: 5,
    filename: '04_OneWire_Buses.kicad_sch',
    sheetName: '04. 1-Wire Buses A & B (Rev B)',
    shortLabel: '04 1-Wire',
    subtitle: 'Shared 3.92 V Gate Bias + Dual 5 V 2N7002 Bidirectional Level-Shifters + 40 V/ESD Fault Guard',
    uuid: 'c0570500-0040-4000-8000-000000000001',
    rootBox: { x: 25.4, y: 132.08, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: Shared 3.92 V Low-Vgs Gate Bias Rail (V_G_1W)',
        note: '+5V_HAT -> R405 1.5k -> D23 1N4148W to +3V3 (clamps V_G = 3.92 V) + C24 100nF bypass',
        refs: ['R405', 'D23', 'C24'],
      },
      {
        title: 'Stage B: 1-Wire Bus A (GPIO 4 -> Q19 2N7002 -> J6:3-5 + D31 Clamp + D34 VDD LED)',
        note: 'D26 SS14; D31 BZX84C5V1 clamp; R406 2.2k PU; R401/402 100R 1206; R410 4.7k + D34 Green VDD short-detect LED -> J6:3-5',
        refs: ['R408', 'Q19', 'D26', 'D31', 'R406', 'R401', 'R402', 'D24', 'D25', 'C25', 'R410', 'D34'],
      },
      {
        title: 'Stage C: 1-Wire Bus B (GPIO 17 -> Q20 2N7002 -> J6:6-8 + D32 Clamp + D35 VDD LED)',
        note: 'D29 SS14; D32 BZX84C5V1 clamp; R407 2.2k PU; R403/404 100R 1206; R411 4.7k + D35 Green VDD short-detect LED -> J6:6-8',
        refs: ['R409', 'Q20', 'D29', 'D32', 'R407', 'R403', 'R404', 'D27', 'D28', 'C26', 'R411', 'D35'],
      },
    ],
  },
  {
    id: '05',
    pageNumber: 6,
    filename: '05_Output_Stage.kicad_sch',
    sheetName: '05. Output Stage: PWM, FB1 & RB1 (J4 DNP)',
    shortLabel: '05 Output Stage',
    subtitle: 'Class-B Q6/Q7 Push-Pull Inside R9 220R + Clamped FB1/RB1 + Boot-Safe Spare Relay Pull-Downs (J4/J5 DNP)',
    uuid: 'c0570500-0050-4000-8000-000000000001',
    rootBox: { x: 152.4, y: 132.08, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: Watchdog Series-AND Gate (Q4/Q5) & Class-B Push-Pull (Q6/Q7/Q8)',
        note: 'PWM1 (GPIO 18) & WD_OK -> Q4/Q5 -> Q8 -> Q6/Q7 inside R9 220R 1206 -> J2 Pin 1 (7.21 V nom / 6.45 V UVLO)',
        refs: ['R7', 'R33', 'Q4', 'Q5', 'R35', 'R36', 'Q8', 'R37', 'Q6', 'Q7', 'D4', 'D5', 'R9', 'R38', 'R22', 'D12', 'J2'],
      },
      {
        title: 'Stage B: Pump Readback RB1 (GPIO 6) & Feedback Input FB1 (GPIO 23)',
        note: 'RB1: R31 22k / R32 10k + D18 clamp (2.25 V nom / 2.01 V UVLO); FB1: R12 2.2k 1206 first + D17/D30 + R11 + C9',
        refs: ['R31', 'R32', 'D18', 'R12', 'R11', 'C9', 'D17', 'D30'],
      },
      {
        title: 'Stage C: Boot-Safe Spare Relay Pull-Downs (R16 GPIO 25, R19 GPIO 5 | J4/J5 DNP)',
        note: 'J4 REL1 (Q10-Q12, D6, D7, R15, R17, R501) & J5 REL2 depopulated per spec; R16/R19 100k hold spare GPIOs safely low',
        refs: ['R16', 'R19'],
      },
    ],
  },
  {
    id: '06',
    pageNumber: 7,
    filename: '06_Power_Entry.kicad_sch',
    sheetName: '06. Power Entry, eFuse & Pi 40-Pin J1',
    shortLabel: '06 Power Entry',
    subtitle: 'J1 40-Pin Pi 4/5 Header + Q21/Q22 Foldback eFuse + +3V3_ANA Pi-Filter (-36 dB) + D9 Clamp + H1-H4',
    uuid: 'c0570500-0060-4000-8000-000000000001',
    rootBox: { x: 279.4, y: 132.08, w: 111.76, h: 81.28 },
    groups: [
      {
        title: 'Stage A: Raspberry Pi 40-Pin Header (J1), M2.5 Holes, Star-Ground NT1 & Optical Fiducials',
        note: 'Pins 2/4 +5V_PI, Pins 1/17 +3V3, NT1 explicit GND<->AGND copper bridge at Pins 9/14, FID1-3 asymmetric pick-and-place fiducials',
        refs: ['J1', 'H1', 'H2', 'H3', 'H4', 'NT1', 'FID1', 'FID2', 'FID3'],
      },
      {
        title: 'Stage B: High-Side Foldback eFuse (Q21/Q22 + R601 1.8R) & TP1 (+5V_HAT)',
        note: 'Normal: 4.96 V @ 46 mA; Dead-short: folds back cleanly to 136.5 mA (zero Pi brownout); C2A/B 2x22uF 1206; TP1=+5V_HAT',
        refs: ['R601', 'Q21', 'Q22', 'R603', 'R605', 'R606', 'C2A', 'C2B', 'C601', 'R1', 'D2', 'TP1'],
      },
      {
        title: 'Stage C: +3V3 Pi-OFF Clamp (D9 BZT52C3V6) & +3V3_ANA Quiet Pi-Filter',
        note: 'D9 + R604 4.7k absorb +24V clamp back-feed <= 3.62 V; R602 10R + C604 10uF + C603 100nF (-36.05 dB @ 100 kHz)',
        refs: ['C602', 'D9', 'R604', 'R602', 'C604', 'C603'],
      },
    ],
  },
];

const ALL_PT1000_SHEET_04: KicadSheetDescriptor = {
  id: '04',
  pageNumber: 5,
  filename: '04_Pt1000_Mux_Bank.kicad_sch',
  sheetName: '04. Pt1000 Mux Bank (Ch 2-8, Zero 1-Wire)',
  shortLabel: '04 Pt1000 Mux',
  subtitle: '7x Switched-Mux Pt1000 Legs (Ch 2-8) Reusing Sheet 01 U1 LM393DR, 0.1% Bridge & J6 DG350D 2x8P Fixed Screw',
  uuid: 'c0570500-0040-4000-8000-000000000001',
  rootBox: { x: 25.4, y: 132.08, w: 111.76, h: 81.28 },
  groups: [
    {
      title: 'Stage A: Upper Tier Bank A — Ch 2 (GPIO 17), Ch 3 (GPIO 16), Ch 4 (GPIO 26)',
      note: 'J6 Pins 4,6,8 -> D1B-D PESD24V + R105B-D 47R 1206 -> Q1B-D AO3400A to AGND; all Pull-DOWN at Pi boot',
      refs: ['D1B', 'R105B', 'Q1B', 'R112B', 'D1C', 'R105C', 'Q1C', 'R112C', 'D1D', 'R105D', 'Q1D', 'R112D'],
    },
    {
      title: 'Stage B: Lower Tier Bank B — Ch 5 (GPIO 19) & Ch 6 (GPIO 21)',
      note: 'J6 Pins 10,12 -> D1E/F PESD24V + R105E/F 47R 1206 -> Q1E/F AO3400A to AGND; zero new SMD reels',
      refs: ['D1E', 'R105E', 'Q1E', 'R112E', 'D1F', 'R105F', 'Q1F', 'R112F'],
    },
    {
      title: 'Stage C: Lower Tier Bank B — Ch 7 (GPIO 10) & Ch 8 (GPIO 9)',
      note: 'J6 Pins 14,16 -> D1G/H PESD24V + R105G/H 47R 1206 -> Q1G/H AO3400A (~1.4 s full 8-ch + 2-pt BIST scan)',
      refs: ['D1G', 'R105G', 'Q1G', 'R112G', 'D1H', 'R105H', 'Q1H', 'R112H'],
    },
  ],
};

export function getKicadSubsheets(edition: HatEdition = 'onewire'): KicadSheetDescriptor[] {
  if (edition === 'onewire') return KICAD_SUBSHEETS;
  return KICAD_SUBSHEETS.map((s) => (s.id === '04' ? ALL_PT1000_SHEET_04 : s));
}

export function getProjectName(edition: HatEdition = 'onewire'): string {
  return edition === 'all_pt1000' ? 'CoSTOS_HAT_AllPt1000' : PROJECT_NAME;
}

// ---- Helpers: Component lookup, Pin->Net lookup, Strict RFC-4122 Hex UUIDs ----

interface ComponentMeta {
  ref: string;
  line: MasterBomLine;
  libId: string;
}

type SymbolPinSpec = {
  pin: string;
  name: string;
  /** Pin connection tip in lib Y-up coordinates (mm, multiples of 2.54) */
  px: number;
  py: number;
  /** Direction stub goes outward from tip on sheet (mm) */
  stubDx: number;
  stubDy: number;
  labelAngle: 0 | 90 | 180 | 270;
  justify: 'left' | 'right';
};

function getLibIdForComponent(ref: string, line: MasterBomLine): string {
  if (ref === 'J1') return 'CoSTOS:Conn_Pi_2x20';
  if (ref.startsWith('TP')) return 'CoSTOS:TestPoint';
  if (ref.startsWith('FID')) return 'CoSTOS:Fiducial';
  if (ref === 'NT1') return 'CoSTOS:NetTie_2';
  if (ref.startsWith('H')) return 'CoSTOS:MountingHole_Pad';
  if (ref.startsWith('U')) return 'CoSTOS:LM393DR';
  if (ref === 'D8' || ref === 'D31' || ref === 'D32') return 'CoSTOS:D_Zener_SOT23';
  if (ref.startsWith('D')) return 'CoSTOS:D';
  if (ref.startsWith('R')) return 'CoSTOS:R';
  if (ref.startsWith('C')) return 'CoSTOS:C';
  if (ref.startsWith('Q')) {
    if (line.value.includes('AO3401')) return 'CoSTOS:Q_PMOS_GSD';
    if (line.value.includes('AO3400') || line.value.includes('2N7002')) return 'CoSTOS:Q_NMOS_GSD';
    if (line.value.includes('3906')) return 'CoSTOS:Q_PNP_BEC';
    return 'CoSTOS:Q_NPN_BEC';
  }
  if (line.pinsPerPart === 16) return 'CoSTOS:Conn_02x08_Pt1000';
  if (line.pinsPerPart === 8) return 'CoSTOS:Conn_01x08_Sensor';
  if (line.pinsPerPart === 3) return 'CoSTOS:Conn_01x03';
  return 'CoSTOS:Conn_01x02';
}

function getSymbolPins(libId: string): SymbolPinSpec[] {
  switch (libId) {
    case 'CoSTOS:R':
    case 'CoSTOS:C':
      return [
        { pin: '1', name: '1', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: '2', px: 5.08, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:D':
      return [
        { pin: '1', name: 'K', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'A', px: 5.08, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:D_Zener_SOT23':
      return [
        { pin: '1', name: 'A', px: -5.08, py: 2.54, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'NC', px: -5.08, py: -2.54, stubDx: 0, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '3', name: 'K', px: 5.08, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Q_NMOS_GSD':
      return [
        { pin: '1', name: 'G', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '3', name: 'D', px: 5.08, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '2', name: 'S', px: 5.08, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Q_PMOS_GSD':
      return [
        { pin: '1', name: 'G', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'S', px: 5.08, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '3', name: 'D', px: 5.08, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Q_NPN_BEC':
      return [
        { pin: '1', name: 'B', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '3', name: 'C', px: 5.08, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '2', name: 'E', px: 5.08, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Q_PNP_BEC':
      return [
        { pin: '1', name: 'B', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'E', px: 5.08, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '3', name: 'C', px: 5.08, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:LM393DR':
      return [
        { pin: '3', name: 'IN1+', px: -12.7, py: 7.62, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'IN1-', px: -12.7, py: 2.54, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '5', name: 'IN2+', px: -12.7, py: -2.54, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '6', name: 'IN2-', px: -12.7, py: -7.62, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '1', name: 'OUT1', px: 12.7, py: 5.08, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '7', name: 'OUT2', px: 12.7, py: -5.08, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '8', name: 'V+', px: 0, py: 12.7, stubDx: 0, stubDy: -3.81, labelAngle: 90, justify: 'left' },
        { pin: '4', name: 'GND', px: 0, py: -12.7, stubDx: 0, stubDy: 3.81, labelAngle: 270, justify: 'left' },
      ];
    case 'CoSTOS:Conn_01x02':
      return [
        { pin: '1', name: 'Pin_1', px: 7.62, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '2', name: 'Pin_2', px: 7.62, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Conn_01x03':
      return [
        { pin: '1', name: 'Pin_1', px: 7.62, py: 2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '2', name: 'Pin_2', px: 7.62, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
        { pin: '3', name: 'Pin_3', px: 7.62, py: -2.54, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Conn_01x08_Sensor': {
      // Combined 8-Pin DG350-3.5-08P Fixed Screw Block: PT1± (1-2), 1W-A 5V/DQ/G (3-5), 1W-B 5V/DQ/G (6-8)
      const names = ['PT1+', 'PT1-', '1WA_5V', '1WA_DQ', '1WA_GND', '1WB_5V', '1WB_DQ', '1WB_GND'];
      return names.map((name, row) => ({
        pin: String(row + 1),
        name,
        px: 7.62,
        py: +(8.89 - row * 2.54).toFixed(2),
        stubDx: 7.62,
        stubDy: 0,
        labelAngle: 0,
        justify: 'left' as const,
      }));
    }
    case 'CoSTOS:Conn_02x08_Pt1000': {
      // Top Plug Bank A (Pins 1..8: PT1+..PT4-) on left, Bottom Plug Bank B (Pins 9..16: PT5+..PT8-) on right
      const specs: SymbolPinSpec[] = [];
      for (let row = 0; row < 8; row++) {
        const py = +(8.89 - row * 2.54).toFixed(2);
        const chA = Math.floor(row / 2) + 1;
        const chB = chA + 4;
        const pol = row % 2 === 0 ? '+' : '-';
        specs.push({
          pin: String(row + 1),
          name: `PT${chA}${pol}`,
          px: -10.16,
          py,
          stubDx: -7.62,
          stubDy: 0,
          labelAngle: 180,
          justify: 'right',
        });
        specs.push({
          pin: String(row + 9),
          name: `PT${chB}${pol}`,
          px: 10.16,
          py,
          stubDx: 7.62,
          stubDy: 0,
          labelAngle: 0,
          justify: 'left',
        });
      }
      return specs;
    }
    case 'CoSTOS:MountingHole_Pad':
    case 'CoSTOS:TestPoint':
      return [
        { pin: '1', name: '1', px: 5.08, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Fiducial':
      return [];
    case 'CoSTOS:NetTie_2':
      return [
        { pin: '1', name: 'GND', px: -5.08, py: 0, stubDx: -5.08, stubDy: 0, labelAngle: 180, justify: 'right' },
        { pin: '2', name: 'AGND', px: 5.08, py: 0, stubDx: 5.08, stubDy: 0, labelAngle: 0, justify: 'left' },
      ];
    case 'CoSTOS:Conn_Pi_2x20': {
      const specs: SymbolPinSpec[] = [];
      for (let row = 0; row < 20; row++) {
        const py = +(24.13 - row * 2.54).toFixed(2); // top=24.13 down to -24.13 in Y-up
        const oddPin = String(row * 2 + 1);
        const evenPin = String(row * 2 + 2);
        specs.push({
          pin: oddPin,
          name: `P${oddPin}`,
          px: -12.7,
          py,
          stubDx: -7.62,
          stubDy: 0,
          labelAngle: 180,
          justify: 'right',
        });
        specs.push({
          pin: evenPin,
          name: `P${evenPin}`,
          px: 12.7,
          py,
          stubDx: 7.62,
          stubDy: 0,
          labelAngle: 0,
          justify: 'left',
        });
      }
      return specs;
    }
    default:
      return [];
  }
}

function buildLibSymbolSexpr(libId: string): string {
  const shortName = libId.split(':')[1];
  const pins = getSymbolPins(libId);

  const pinTypeFor = (lib: string, pName: string): string => {
    if (pName === 'V+' || pName === 'GND') return 'power_in';
    if (pName === 'OUT1' || pName === 'OUT2') return 'open_collector';
    if (pName.startsWith('IN')) return 'input';
    if (pName === 'NC') return 'no_connect';
    return 'passive';
  };

  let graphic = '';
  let refPos = '(at 0 5.08 0)';
  let valPos = '(at 0 -5.08 0)';

  if (libId === 'CoSTOS:R') {
    graphic = `      (rectangle (start -2.54 1.016) (end 2.54 -1.016) (stroke (width 0.254) (type default)) (fill (type none)))`;
    refPos = '(at 0 2.54 0)';
    valPos = '(at 0 -2.54 0)';
  } else if (libId === 'CoSTOS:C') {
    graphic =
      `      (polyline (pts (xy -0.762 2.032) (xy -0.762 -2.032)) (stroke (width 0.3048) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy 0.762 2.032) (xy 0.762 -2.032)) (stroke (width 0.3048) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy -2.54 0) (xy -0.762 0)) (stroke (width 0.1524) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy 0.762 0) (xy 2.54 0)) (stroke (width 0.1524) (type default)) (fill (type none)))`;
    refPos = '(at 0 3.556 0)';
    valPos = '(at 0 -3.556 0)';
  } else if (libId === 'CoSTOS:D') {
    graphic =
      `      (polyline (pts (xy -1.27 1.27) (xy -1.27 -1.27)) (stroke (width 0.254) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy 1.27 1.27) (xy 1.27 -1.27) (xy -1.27 0) (xy 1.27 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy -2.54 0) (xy 2.54 0)) (stroke (width 0.1524) (type default)) (fill (type none)))`;
    refPos = '(at 0 2.794 0)';
    valPos = '(at 0 -2.794 0)';
  } else if (libId === 'CoSTOS:D_Zener_SOT23') {
    graphic =
      `      (rectangle (start -2.54 3.81) (end 2.54 -3.81) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at 0 5.334 0)';
    valPos = '(at 0 -5.334 0)';
  } else if (libId.startsWith('CoSTOS:Q_')) {
    graphic =
      `      (circle (center 0.508 0) (radius 3.048) (stroke (width 0.254) (type default)) (fill (type background)))\n` +
      `      (polyline (pts (xy -0.762 1.778) (xy -0.762 -1.778)) (stroke (width 0.3048) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy -2.54 0) (xy -0.762 0)) (stroke (width 0.1524) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy -0.762 1.016) (xy 2.54 2.54)) (stroke (width 0.1524) (type default)) (fill (type none)))\n` +
      `      (polyline (pts (xy -0.762 -1.016) (xy 2.54 -2.54)) (stroke (width 0.1524) (type default)) (fill (type none)))`;
    refPos = '(at 0 4.572 0)';
    valPos = '(at 0 -4.572 0)';
  } else if (libId === 'CoSTOS:LM393DR') {
    graphic = `      (rectangle (start -10.16 10.16) (end 10.16 -10.16) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at -6.35 12.7 0)';
    valPos = '(at 6.35 -12.7 0)';
  } else if (libId === 'CoSTOS:Conn_01x02' || libId === 'CoSTOS:Conn_01x03') {
    graphic = `      (rectangle (start -2.54 3.81) (end 5.08 -3.81) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at 1.27 5.334 0)';
    valPos = '(at 1.27 -5.334 0)';
  } else if (libId === 'CoSTOS:MountingHole_Pad') {
    graphic =
      `      (circle (center 0 0) (radius 1.905) (stroke (width 0.254) (type default)) (fill (type background)))\n` +
      `      (circle (center 0 0) (radius 0.889) (stroke (width 0.254) (type default)) (fill (type none)))`;
    refPos = '(at 0 3.302 0)';
    valPos = '(at 0 -3.302 0)';
  } else if (libId === 'CoSTOS:TestPoint') {
    graphic =
      `      (circle (center 0 0) (radius 1.27) (stroke (width 0.254) (type default)) (fill (type background)))\n` +
      `      (polyline (pts (xy 1.27 0) (xy 2.54 0)) (stroke (width 0.1524) (type default)) (fill (type none)))`;
    refPos = '(at 0 2.794 0)';
    valPos = '(at 0 -2.794 0)';
  } else if (libId === 'CoSTOS:Fiducial') {
    graphic =
      `      (circle (center 0 0) (radius 1.27) (stroke (width 0.254) (type default)) (fill (type none)))\n` +
      `      (circle (center 0 0) (radius 0.508) (stroke (width 0.254) (type default)) (fill (type outline)))`;
    refPos = '(at 0 2.794 0)';
    valPos = '(at 0 -2.794 0)';
  } else if (libId === 'CoSTOS:NetTie_2') {
    graphic =
      `      (circle (center 0 0) (radius 1.524) (stroke (width 0.254) (type default)) (fill (type background)))\n` +
      `      (polyline (pts (xy -2.54 0) (xy 2.54 0)) (stroke (width 0.3048) (type default)) (fill (type none)))`;
    refPos = '(at 0 2.794 0)';
    valPos = '(at 0 -2.794 0)';
  } else if (libId === 'CoSTOS:Conn_01x08_Sensor') {
    graphic = `      (rectangle (start -5.08 11.43) (end 5.08 -11.43) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at 0 13.97 0)';
    valPos = '(at 0 -13.97 0)';
  } else if (libId === 'CoSTOS:Conn_02x08_Pt1000') {
    graphic = `      (rectangle (start -7.62 11.43) (end 7.62 -11.43) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at 0 13.97 0)';
    valPos = '(at 0 -13.97 0)';
  } else if (libId === 'CoSTOS:Conn_Pi_2x20') {
    graphic = `      (rectangle (start -10.16 26.67) (end 10.16 -26.67) (stroke (width 0.254) (type default)) (fill (type background)))`;
    refPos = '(at 0 29.21 0)';
    valPos = '(at 0 -29.21 0)';
  }

  const showPinNames =
    libId === 'CoSTOS:LM393DR' ||
    libId === 'CoSTOS:Conn_Pi_2x20' ||
    libId === 'CoSTOS:Conn_02x08_Pt1000' ||
    libId === 'CoSTOS:Conn_01x08_Sensor' ||
    libId === 'CoSTOS:Conn_01x02' ||
    libId === 'CoSTOS:Conn_01x03' ||
    libId.startsWith('CoSTOS:Q_') ||
    libId === 'CoSTOS:D_Zener_SOT23';

  const pinLines = pins
    .map((p) => {
      // Pin points INWARD toward body from (px, py)
      let angle = 0;
      if (p.px < 0) angle = 0;
      else if (p.px > 0) angle = 180;
      else if (p.py > 0) angle = 270;
      else angle = 90;
      const len = 2.54;
      const pType = pinTypeFor(libId, p.name);
      return `      (pin ${pType} line (at ${p.px} ${p.py} ${angle}) (length ${len}) (name "${p.name}" (effects (font (size 0.9 0.9)))) (number "${p.pin}" (effects (font (size 0.9 0.9)))))`;
    })
    .join('\n');

  const refPrefix = shortName.startsWith('TestPoint')
    ? 'TP'
    : shortName.startsWith('Fiducial')
      ? 'FID'
      : shortName.startsWith('NetTie')
        ? 'NT'
        : shortName.startsWith('R')
          ? 'R'
          : shortName.startsWith('C') && !shortName.startsWith('Conn')
            ? 'C'
            : shortName.startsWith('D')
              ? 'D'
              : shortName.startsWith('Q')
                ? 'Q'
                : shortName.startsWith('LM')
                  ? 'U'
                  : shortName.startsWith('Mounting')
                    ? 'H'
                    : 'J';

  return `    (symbol "${libId}"
      (pin_names (offset 0.508)${showPinNames ? '' : ' (hide yes)'})
      (exclude_from_sim no)
      (in_bom yes)
      (on_board yes)
      (property "Reference" "${refPrefix}" ${refPos} (effects (font (size 1.27 1.27))))
      (property "Value" "${shortName}" ${valPos} (effects (font (size 1.27 1.27))))
      (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))
      (property "Datasheet" "~" (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))
      (symbol "${shortName}_0_1"
${graphic}
      )
      (symbol "${shortName}_1_1"
${pinLines}
      )
    )`;
}

function buildComponentLookup(edition: HatEdition = 'onewire'): Map<string, ComponentMeta> {
  const map = new Map<string, ComponentMeta>();
  for (const line of getMasterBom(edition)) {
    for (const ref of line.designators) {
      map.set(ref, { ref, line, libId: getLibIdForComponent(ref, line) });
    }
  }
  return map;
}

function buildPinNetLookup(edition: HatEdition = 'onewire'): Map<string, string> {
  const map = new Map<string, string>();
  for (const net of getVerifiedBoardNets(edition)) {
    for (const [ref, pin] of net.nodes) {
      map.set(`${ref}:${pin}`, net.name);
    }
  }
  return map;
}

/** Determine which nets span >1 subsheet (must be global_label) vs local to 1 subsheet */
function buildGlobalNetSet(edition: HatEdition = 'onewire'): Set<string> {
  const refToSheet = new Map<string, string>();
  for (const sheet of getKicadSubsheets(edition)) {
    for (const g of sheet.groups) {
      for (const r of g.refs) refToSheet.set(r, sheet.id);
    }
  }
  const globals = new Set<string>(['GND', 'AGND', '+5V_PI', '+5V_HAT', '+V_DRV', '+3V3', '+3V3_ANA']);
  for (const net of getVerifiedBoardNets(edition)) {
    const sheets = new Set<string>();
    for (const [ref] of net.nodes) {
      const s = refToSheet.get(ref);
      if (s) sheets.add(s);
    }
    if (sheets.size > 1) globals.add(net.name);
  }
  return globals;
}

function makeUuidFactory(sheetNumericId: number) {
  let seq = 1;
  const block = sheetNumericId.toString(16).padStart(4, '0');
  return () => {
    const s = (seq++).toString(16).padStart(12, '0');
    return `c0570500-${block}-4000-8000-${s}`;
  };
}

function esc(str: string): string {
  return str
    .replace(/Ω/g, 'Ohm')
    .replace(/µ/g, 'u')
    .replace(/μ/g, 'u')
    .replace(/×/g, 'x')
    .replace(/±/g, '+/-')
    .replace(/°/g, 'deg')
    .replace(/"/g, "'");
}

/** Snap to exact 1.27 mm KiCad schematic grid */
function snap(mm: number): number {
  return +(Math.round(mm / 1.27) * 1.27).toFixed(2);
}

/** Generate one complete, wired, KiCad 10-native sub-sheet (.kicad_sch) */
export function generateKicadSubsheet(sheetId: string, edition: HatEdition = 'onewire'): string {
  const sheet = getKicadSubsheets(edition).find((s) => s.id === sheetId);
  if (!sheet) throw new Error(`Unknown KiCad subsheet: ${sheetId}`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const compMap = buildComponentLookup(edition);
  const pinNetMap = buildPinNetLookup(edition);
  const globalNets = buildGlobalNetSet(edition);
  const nextUuid = makeUuidFactory(0x100 + sheet.pageNumber * 0x10);

  // Collect all unique libIds needed on this sheet
  const usedLibIds = new Set<string>();
  for (const g of sheet.groups) {
    for (const ref of g.refs) {
      const meta = compMap.get(ref);
      if (!meta) throw new Error(`Ref ${ref} missing from Master BOM (${edition})`);
      usedLibIds.add(meta.libId);
    }
  }
  const libSymbolsBlock = [...usedLibIds].map(buildLibSymbolSexpr).join('\n');

  const graphicsOut: string[] = [];
  const symbolsOut: string[] = [];
  const wiresOut: string[] = [];
  const labelsOut: string[] = [];
  const noConnectsOut: string[] = [];

  // Sheet header banner text
  graphicsOut.push(
    `  (text "${esc(sheet.sheetName)} - ${esc(sheet.subtitle)}" (exclude_from_sim no) (at 17.78 15.24 0) (effects (font (size 2.0 2.0) bold) (justify left top)) (uuid "${nextUuid()}"))`
  );

  // Layout groups cleanly vertically across the A3 sheet (420 x 297 mm, usable X: 17.78..401.32, Y: 22.86..266.7)
  let curBandY = 22.86;
  const bandX = 17.78;
  const bandW = 383.54;

  const projName = getProjectName(edition);

  for (const group of sheet.groups) {
    const hasJ1 = group.refs.includes('J1');
    const hasJ6Large = group.refs.includes('J6');
    const hasIc = group.refs.some((r) => r.startsWith('U'));

    // Compute clean grid positions inside this group band
    const placements: { ref: string; x: number; y: number }[] = [];
    let bandH = 66.04;

    if (hasJ1) {
      // Special clean layout for Sheet 06 Stage A: J1 tall 40-pin header on left + H1..H4 stacked cleanly on right
      bandH = 71.12;
      placements.push({ ref: 'J1', x: snap(bandX + 55.88), y: snap(curBandY + 40.64) });
      const others = group.refs.filter((r) => r !== 'J1');
      others.forEach((ref, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        placements.push({
          ref,
          x: snap(bandX + 165.1 + col * 60.96),
          y: snap(curBandY + 25.4 + row * 22.86),
        });
      });
    } else if (hasJ6Large) {
      // Special clean layout for Sheet 01 Stage A: 8-pin DG350 / 16-pin DG350D J6 on left + 8 passives in 4x2 grid on right
      bandH = 58.42;
      placements.push({ ref: 'J6', x: snap(bandX + 48.26), y: snap(curBandY + 33.02) });
      const others = group.refs.filter((r) => r !== 'J6');
      others.forEach((ref, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        placements.push({
          ref,
          x: snap(bandX + 127.0 + col * 66.04),
          y: snap(curBandY + 22.86 + row * 20.32),
        });
      });
    } else {
      // Clean A3-fitting component grid (up to 6 cols = ~64 mm cell width — plenty of room for stubs + labels)
      const cols =
        group.refs.length <= 4
          ? group.refs.length
          : group.refs.length <= 10
            ? 5
            : 6;
      const cellW = snap(bandW / Math.max(cols, 1));
      const rowStep = hasIc ? 27.94 : 19.05;
      const rows = Math.ceil(group.refs.length / cols);
      bandH = snap(15.24 + rows * rowStep + 5.08);

      group.refs.forEach((ref, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = snap(bandX + col * cellW + cellW * 0.5);
        const cy = snap(curBandY + 19.05 + row * rowStep + (ref.startsWith('U') ? 3.81 : 0));
        placements.push({ ref, x: cx, y: cy });
      });
    }

    // Group box + title + note
    const boxY2 = snap(curBandY + bandH);
    graphicsOut.push(
      `  (rectangle (start ${bandX} ${curBandY}) (end ${snap(bandX + bandW)} ${boxY2}) (stroke (width 0.254) (type dash)) (fill (type none)) (uuid "${nextUuid()}"))`,
      `  (text "${esc(group.title)}" (exclude_from_sim no) (at ${snap(bandX + 2.54)} ${snap(curBandY + 2.54)} 0) (effects (font (size 1.6 1.6) bold) (justify left top)) (uuid "${nextUuid()}"))`,
      `  (text "${esc(group.note)}" (exclude_from_sim no) (at ${snap(bandX + 2.54)} ${snap(curBandY + 6.35)} 0) (effects (font (size 1.15 1.15)) (justify left top)) (uuid "${nextUuid()}"))`
    );

    // Emit placed symbol instances + exact pin wires + net labels / no-connects
    for (const pl of placements) {
      const meta = compMap.get(pl.ref)!;
      const symUuid = nextUuid();
      const pins = getSymbolPins(meta.libId);
      const pinUuids = pins.map((p) => `    (pin "${p.pin}" (uuid "${nextUuid()}"))`).join('\n');

      const refYOffset =
        meta.libId === 'CoSTOS:Conn_Pi_2x20'
          ? -29.21
          : meta.libId === 'CoSTOS:Conn_02x08_Pt1000' || meta.libId === 'CoSTOS:Conn_01x08_Sensor'
            ? -13.97
            : meta.libId === 'CoSTOS:LM393DR'
              ? -13.97
              : -5.08;
      const valYOffset =
        meta.libId === 'CoSTOS:Conn_Pi_2x20'
          ? 29.21
          : meta.libId === 'CoSTOS:Conn_02x08_Pt1000' || meta.libId === 'CoSTOS:Conn_01x08_Sensor'
            ? 13.97
            : meta.libId === 'CoSTOS:LM393DR'
              ? 13.97
              : 5.08;

      symbolsOut.push(`  (symbol
    (lib_id "${meta.libId}")
    (at ${pl.x} ${pl.y} 0)
    (unit 1)
    (exclude_from_sim no)
    (in_bom yes)
    (on_board yes)
    (dnp no)
    (fields_autoplaced yes)
    (uuid "${symUuid}")
    (property "Reference" "${pl.ref}" (at ${pl.x} ${snap(pl.y + refYOffset)} 0) (effects (font (size 1.27 1.27) bold)))
    (property "Value" "${esc(meta.line.value)}" (at ${pl.x} ${snap(pl.y + valYOffset)} 0) (effects (font (size 1.15 1.15))))
    (property "Footprint" "${esc(meta.line.footprint)}" (at ${pl.x} ${pl.y} 0) (effects (font (size 1.27 1.27)) (hide yes)))
    (property "Datasheet" "~" (at ${pl.x} ${pl.y} 0) (effects (font (size 1.27 1.27)) (hide yes)))
    (property "LCSC" "${esc(meta.line.lcsc)}" (at ${pl.x} ${pl.y} 0) (effects (font (size 1.0 1.0)) (hide yes)))
    (property "JLCPCB_Class" "${esc(meta.line.bomClass)}" (at ${pl.x} ${pl.y} 0) (effects (font (size 1.0 1.0)) (hide yes)))
${pinUuids}
    (instances
      (project "${projName}"
        (path "/${ROOT_SCH_UUID}/${sheet.uuid}"
          (reference "${pl.ref}")
          (unit 1)
        )
      )
    )
  )`);

      // Connect every single pin on exact KiCad sheet coordinates (sheetX = sx + px, sheetY = sy - py)!
      for (const p of pins) {
        const pinX = +(pl.x + p.px).toFixed(2);
        const pinY = +(pl.y - p.py).toFixed(2);
        const netName = pinNetMap.get(`${pl.ref}:${p.pin}`);

        if (!netName) {
          noConnectsOut.push(`  (no_connect (at ${pinX} ${pinY}) (uuid "${nextUuid()}"))`);
          continue;
        }

        const endX = +(pinX + p.stubDx).toFixed(2);
        const endY = +(pinY + p.stubDy).toFixed(2);

        wiresOut.push(
          `  (wire (pts (xy ${pinX} ${pinY}) (xy ${endX} ${endY})) (stroke (width 0) (type default)) (uuid "${nextUuid()}"))`
        );

        const isGlobal = globalNets.has(netName);
        const fontSize =
          meta.libId === 'CoSTOS:Conn_Pi_2x20' ||
          meta.libId === 'CoSTOS:Conn_02x08_Pt1000' ||
          meta.libId === 'CoSTOS:Conn_01x08_Sensor'
            ? 0.95
            : 1.1;
        if (isGlobal) {
          labelsOut.push(
            `  (global_label "${esc(netName)}" (shape bidirectional) (at ${endX} ${endY} ${p.labelAngle}) (fields_autoplaced yes) (effects (font (size ${fontSize} ${fontSize})) (justify ${p.justify})) (uuid "${nextUuid()}"))`
          );
        } else {
          labelsOut.push(
            `  (label "${esc(netName)}" (at ${endX} ${endY} ${p.labelAngle}) (fields_autoplaced yes) (effects (font (size ${fontSize} ${fontSize})) (justify ${p.justify})) (uuid "${nextUuid()}"))`
          );
        }
      }
    }

    curBandY = snap(boxY2 + 5.08);
  }

  const subsheetFileUuid = `c0570500-00f${sheet.id[1]}-4000-8000-000000000001`;
  return `(kicad_sch
  (version 20250114)
  (generator "eeschema")
  (generator_version "10.0")
  (uuid "${subsheetFileUuid}")
  (paper "A3")
  (title_block
    (title "${esc(sheet.sheetName)}")
    (date "${dateStr}")
    (rev "Rev B/D/E")
    (company "CoSTOS Solar Thermal Controller (github.com/isarrider/CoSTOS)")
    (comment 1 "${esc(sheet.subtitle)}")
    (comment 2 "100% JLCPCB Basic + 3x Preferred 0.1% resistors | KiCad 10 Hierarchical Sheet ${sheet.pageNumber} of 7")
  )
  (lib_symbols
${libSymbolsBlock}
  )
${graphicsOut.join('\n')}
${wiresOut.join('\n')}
${labelsOut.join('\n')}
${noConnectsOut.join('\n')}
${symbolsOut.join('\n')}
  (sheet_instances
    (path "/${ROOT_SCH_UUID}/${sheet.uuid}"
      (page "${sheet.pageNumber}")
    )
  )
  (embedded_fonts no)
)
`;
}

/** Generate the Root Hierarchical KiCad 10 Schematic linking all 6 sub-sheets */
export function generateKicadRootSchematic(edition: HatEdition = 'onewire'): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const nextUuid = makeUuidFactory(0x000c);
  const subsheets = getKicadSubsheets(edition);
  const projName = getProjectName(edition);
  const stats = getMasterBomStats(edition);
  const totalParts = stats.smdPartCount + stats.thtPartCount;
  const netCount = getVerifiedBoardNets(edition).length;
  const isAllPt = edition === 'all_pt1000';

  const sheetBlocks = subsheets.map((s) => {
    const partCount = s.groups.reduce((acc, g) => acc + g.refs.length, 0);
    return `  (sheet
    (at ${s.rootBox.x} ${s.rootBox.y})
    (size ${s.rootBox.w} ${s.rootBox.h})
    (fields_autoplaced yes)
    (stroke (width 0.254) (type solid))
    (fill (color 248 250 252 1.0))
    (uuid "${s.uuid}")
    (property "Sheetname" "${esc(s.sheetName)}" (at ${s.rootBox.x} ${+(s.rootBox.y - 2.0).toFixed(2)} 0) (effects (font (size 1.6 1.6) bold) (justify left bottom)))
    (property "Sheetfile" "${s.filename}" (at ${s.rootBox.x} ${+(s.rootBox.y + s.rootBox.h + 2.0).toFixed(2)} 0) (effects (font (size 1.27 1.27)) (justify left top)))
    (instances
      (project "${projName}"
        (path "/${ROOT_SCH_UUID}"
          (page "${s.pageNumber}")
        )
      )
    )
  )
  (text "${esc(s.subtitle)}" (exclude_from_sim no) (at ${+(s.rootBox.x + 3.81).toFixed(2)} ${+(s.rootBox.y + 6.35).toFixed(2)} 0) (effects (font (size 1.15 1.15)) (justify left top)) (uuid "${nextUuid()}"))
  (text "Populated parts on sheet: ${partCount} (Double-click box in KiCad 10 to open circuit)" (exclude_from_sim no) (at ${+(s.rootBox.x + 3.81).toFixed(2)} ${+(s.rootBox.y + 15.24).toFixed(2)} 0) (effects (font (size 1.15 1.15) bold) (justify left top)) (uuid "${nextUuid()}"))`;
  }).join('\n');

  const keyNets = isAllPt
    ? ['+5V_PI', '+5V_HAT', '+V_DRV', '+3V3', '+3V3_ANA', 'GND', 'AGND', 'PT1_V_DIV', 'PT_SEL1..8', 'WD_OK', 'DUTY_IN', 'PWM1', 'FB1', 'RB1']
    : ['+5V_PI', '+5V_HAT', '+V_DRV', '+3V3', '+3V3_ANA', 'GND', 'AGND', 'WD_OK', 'DUTY_IN', 'PWM1', 'FB1', 'RB1', '1W_A_PI', '1W_B_PI'];

  const editionTitle = isAllPt
    ? 'CoSTOS All-Pt1000 HAT (8x Switched-Mux, DG350D 2x8P Fixed Screw, Zero 1-Wire)'
    : 'CoSTOS 1-Wire HAT (Rev B/D/E — DG350 8P Fixed Screw)';
  const dnpSummary = isAllPt
    ? 'J4 REL1 | J3 PUMP2 | J5 REL2 | U_ID CAT24C32 EEPROM'
    : 'J4 REL1 | J3 PUMP2 | J5 REL2 | U_ID CAT24C32 EEPROM | U10 DS2482-800';

  const railSummary =
    `  (text "${editionTitle} - Root Hierarchical Schematic (6 Per-Circuit Sub-Sheets | ${totalParts} Parts | ${netCount} Nets)" (exclude_from_sim no) (at 25.4 16.51 0) (effects (font (size 2.1 2.1) bold) (justify left top)) (uuid "${nextUuid()}"))\n` +
    `  (text "Shared Inter-Sheet Global Rails & Signals: ${keyNets.join(' | ')}" (exclude_from_sim no) (at 25.4 231.14 0) (effects (font (size 1.35 1.35)) (justify left top)) (uuid "${nextUuid()}"))\n` +
    `  (text "DNP (Unpopulated PCB Footprints Only): ${dnpSummary}" (exclude_from_sim no) (at 25.4 238.76 0) (effects (font (size 1.35 1.35)) (justify left top)) (uuid "${nextUuid()}"))\n` +
    `  (text "Workflow: Open ${projName}.kicad_pro in KiCad 10 -> double-click any sheet -> press F8 in PCB Editor to sync all ${totalParts} footprints into ${projName}.kicad_pcb." (exclude_from_sim no) (at 25.4 246.38 0) (effects (font (size 1.35 1.35) bold) (justify left top)) (uuid "${nextUuid()}"))`;

  return `(kicad_sch
  (version 20250114)
  (generator "eeschema")
  (generator_version "10.0")
  (uuid "${ROOT_SCH_UUID}")
  (paper "A3")
  (title_block
    (title "${editionTitle} - Root Hierarchical Schematic")
    (date "${dateStr}")
    (rev "Rev B/D/E")
    (company "CoSTOS Solar Thermal Controller (github.com/isarrider/CoSTOS)")
    (comment 1 "6 separate wired circuit sheets (${totalParts} populated parts, ${netCount} nets) - 100% ngspice-39 verified")
    (comment 2 "100% JLCPCB Basic + 3x Preferred 0.1% resistors (${stats.uniqueSmdReels} reels, EUR 0 Extended Fees) | DNP: ${dnpSummary.replace(/ \| /g, ', ')}")
  )
  (lib_symbols)
${railSummary}
${sheetBlocks}
  (sheet_instances
    (path "/"
      (page "1")
    )
  )
  (embedded_fonts no)
)
`;
}

/** Generate valid KiCad 10 Project File with JLCPCB 2-layer rules */
export function generateKicadProjectFile(edition: HatEdition = 'onewire'): string {
  const projName = getProjectName(edition);
  const subsheets = getKicadSubsheets(edition);
  const stats = getMasterBomStats(edition);
  const totalParts = stats.smdPartCount + stats.thtPartCount;
  const isAllPt = edition === 'all_pt1000';

  const pro = {
    board: {
      design_settings: {
        defaults: {
          board_outline_line_width: 0.15,
          copper_line_width: 0.25,
          copper_text_size_h: 1.5,
          copper_text_size_v: 1.5,
          copper_text_thickness: 0.3,
          silk_line_width: 0.15,
          silk_text_size_h: 1.0,
          silk_text_size_v: 1.0,
          silk_text_thickness: 0.15,
        },
        rules: {
          min_clearance: 0.2,
          min_copper_edge_clearance: 0.3,
          min_hole_clearance: 0.25,
          min_hole_to_hole: 0.5,
          min_silk_clearance: 0.15,
          min_through_hole_diameter: 0.3,
          min_track_width: 0.2,
          min_via_annular_width: 0.13,
          min_via_diameter: 0.45,
          solder_mask_clearance: 0.05,
        },
      },
      layer_presets: [],
    },
    meta: {
      filename: `${projName}.kicad_pro`,
      version: 1,
    },
    net_settings: {
      classes: [
        {
          bus_width: 12,
          clearance: 0.2,
          diff_pair_gap: 0.25,
          diff_pair_via_gap: 0.25,
          diff_pair_width: 0.2,
          name: 'Default',
          pcb_color: 'rgba(0, 0, 0, 0.000)',
          schematic_color: 'rgba(0, 0, 0, 0.000)',
          track_width: 0.25,
          via_diameter: 0.6,
          via_drill: 0.3,
        },
        {
          bus_width: 12,
          clearance: 0.25,
          diff_pair_gap: 0.25,
          diff_pair_via_gap: 0.25,
          diff_pair_width: 0.2,
          name: 'Power',
          pcb_color: 'rgba(220, 38, 38, 0.850)',
          schematic_color: 'rgba(220, 38, 38, 0.850)',
          track_width: 0.6,
          via_diameter: 0.8,
          via_drill: 0.4,
        },
      ],
      netclass_patterns: [
        { netclass: 'Power', pattern: '+5V*' },
        { netclass: 'Power', pattern: '+3V3*' },
        { netclass: 'Power', pattern: '+V_DRV' },
        { netclass: 'Power', pattern: 'GND' },
        { netclass: 'Power', pattern: 'AGND' },
      ],
    },
    schematic: {
      drawing: {
        default_line_thickness: 6.0,
        default_text_size: 50.0,
        pin_symbol_size: 25.0,
      },
      legacy_lib_dir: '',
      legacy_lib_list: [],
      meta: {
        version: 1,
      },
    },
    sheets: [
      [ROOT_SCH_UUID, 'Root'],
      ...subsheets.map((s) => [s.uuid, s.sheetName]),
    ],
    text_variables: {
      BOARD_REV: isAllPt
        ? 'Rev B/D/E All-Pt1000 (8x Mux, DG350D 2x8P Fixed Screw)'
        : 'Rev B/D/E 1-Wire (DG350 8P Fixed Screw)',
      PARTS_COUNT: `${totalParts} (${stats.smdPartCount} SMD / ${stats.uniqueSmdReels} Reels + ${stats.thtPartCount} THT)`,
      DNP_LIST: isAllPt
        ? 'J4 REL1, J3 PUMP2, J5 REL2, U_ID EEPROM'
        : 'J4 REL1, J3 PUMP2, J5 REL2, U_ID EEPROM, U10 DS2482',
    },
  };
  return JSON.stringify(pro, null, 2) + '\n';
}

/** Generate bundle README.txt */
export function generateBundleReadme(edition: HatEdition = 'onewire'): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const projName = getProjectName(edition);
  const stats = getMasterBomStats(edition);
  const totalParts = stats.smdPartCount + stats.thtPartCount;
  const netCount = getVerifiedBoardNets(edition).length;
  const isAllPt = edition === 'all_pt1000';
  const sheet04Line = isAllPt
    ? `   - 04_Pt1000_Mux_Bank.kicad_sch       Sheet 5: 7x Switched-Mux Pt1000 Legs Ch 2-8 (28 SMD parts, zero new reels)`
    : `   - 04_OneWire_Buses.kicad_sch         Sheet 5: 5V 2N7002 1-Wire Buses A & B (21 parts -> J6:3-8)`;
  const doc04Line = isAllPt ? '' : `   - 04_OneWire_Buses_Report.pdf\n`;

  return `===============================================================================
${isAllPt ? 'CoSTOS All-Pt1000 HAT (8x Switched-Mux, DG350D 2x8P Fixed Screw, Zero 1-Wire)' : 'CoSTOS 1-Wire HAT — Rev B/D/E (DG350 8P Fixed Screw)'} Complete Engineering Bundle
Generated: ${dateStr} | Target EDA: KiCad 10 | SPICE: ngspice 39-44+
===============================================================================

FOLDER STRUCTURE
----------------
1. kicad/   — Complete KiCad 10 Hierarchical Multi-Sheet Project (${totalParts} parts, ${netCount} nets)
   - ${projName}.kicad_pro          <-- OPEN THIS FILE IN KICAD 10!
   - ${projName}.kicad_sch          Root sheet linking all 6 circuit sheets
   - 01_Pt1000_Collector.kicad_sch      Sheet 2: Pt1000 Rev D Core + J6 ${isAllPt ? 'DG350D 2x8P Fixed Screw (16-Pin, PT1-8)' : 'DG350 8P Fixed Screw (PT1 + 1W-A/B)'} (25 parts)
   - 02_Pump_Supply.kicad_sch           Sheet 3: Pump Supply Rev E Option 2 CMOS (15 parts)
   - 03_Hardware_Watchdog.kicad_sch     Sheet 4: Dual-Schmitt Watchdog Rev B (26 parts; Q12 DNP)
${sheet04Line}
   - 05_Output_Stage.kicad_sch          Sheet 6: Class-B PWM, FB1/RB1 (27 parts; J4 REL1 DNP)
   - 06_Power_Entry.kicad_sch           Sheet 7: 40-Pin Pi Header + Foldback eFuse + NT1 + FID1-3
   - ${projName}.kicad_pcb          FULLY PLACED & 2-LAYER ROUTED 65 x 56 mm HAT (${totalParts} parts, ${netCount} nets, split B.Cu GND/AGND pours, B.SilkS cheat-sheet)
   - ${projName}.net                Complete S-expression netlist (${totalParts} parts, ${netCount} nets)

2. jlcpcb/  — JLCPCB Economic PCBA Manufacturing Files
   - ${projName}_JLCPCB_BOM.csv     Populated SMD only (${stats.smdPartCount} parts, ${stats.uniqueSmdReels} reels, EUR 0 Ext fee)
   - ${projName}_Full_Master_BOM.csv All ${totalParts} populated parts (SMD + THT) + DNP table

3. spice/   — Full-HAT Real-Silicon ngspice Verification Suite
   - ${projName}_Full_Sim.cir       Run: ngspice -b ${projName}_Full_Sim.cir
                                    (Also opens directly in KiCad 10 Simulator)

4. docs/    — Complete PDF Engineering Report Pack (${isAllPt ? '6' : '7'} Reports)
   - 01_Pt1000_Collector_Report.pdf
   - 02_Pump_Supply_Report.pdf
   - 03_Hardware_Watchdog_Report.pdf
${doc04Line}   - 05_Output_Stage_Report.pdf
   - 06_Power_Entry_Report.pdf
   - 07_Full_HAT_Costs_BOM_Report.pdf

QUICK START IN KICAD 10 — PRE-FAB SIGN-OFF NOTE
--------------------------------------------------
Pre-Fab Sign-Off Note: Geometric copper clearances and pour continuity are verified
automatically, but before uploading Gerbers to JLCPCB, open the exported .kicad_pcb in
KiCad 10 PCB Editor, press B to pour the Priority-2 AGND and Priority-1 GND B.Cu copper
zones, and run Inspect -> Design Rules Checker (DRC) once to confirm final zone-filled
clearances.

Step-by-step:
1. Extract this ZIP to a local folder.
2. Open kicad/${projName}.kicad_pro in KiCad 10.
3. Open PCB Editor (${projName}.kicad_pcb) — all ${totalParts} footprints, F.Cu/B.Cu copper tracks,
   vias, split B.Cu GND/AGND copper zones, NT1 star bridge, FID1-3 fiducials, and B.SilkS pinout
   cheat-sheet are already placed & routed.
4. Press B (Fill All Zones) to pour the Priority-2 AGND and Priority-1 GND B.Cu copper zones.
5. Run Inspect -> Design Rules Checker (DRC) once to confirm final zone-filled clearances, then export Gerbers + Drill + CPL.

UNPOPULATED OPTIONS (DNP / n.f. — Footprint Only, EUR 0.00 BOM Cost)
--------------------------------------------------------------------
- ${isAllPt ? 'J4 (REL1 + Q10-Q12/D6/D7/R15/R17/R501), J3 (PUMP2), J5 (REL2), U_ID (CAT24C32 EEPROM)' : 'J4 (REL1 + Q10-Q12/D6/D7/R15/R17/R501), J3 (PUMP2), J5 (REL2), U_ID (CAT24C32 EEPROM), U10 (DS2482-800)'}
`;
}

/** Build the complete ZIP archive containing ALL KiCad 10 sheets, PCB, netlist, CSVs, SPICE, and PDFs */
export async function buildCompleteBundleZip(
  opts: CostCalcOptions,
  edition: HatEdition = 'onewire'
): Promise<Blob> {
  const zip = new JSZip();
  const projName = getProjectName(edition);
  const subsheets = getKicadSubsheets(edition);
  const isAllPt = edition === 'all_pt1000';
  const root = zip.folder(`${projName}_KiCad10_Complete_Bundle`)!;

  // 1. README
  root.file('README.txt', generateBundleReadme(edition));

  // 2. Complete KiCad 10 Hierarchical Project
  const kicad = root.folder('kicad')!;
  kicad.file(`${projName}.kicad_pro`, generateKicadProjectFile(edition));
  kicad.file(`${projName}.kicad_sch`, generateKicadRootSchematic(edition));
  for (const sheet of subsheets) {
    kicad.file(sheet.filename, generateKicadSubsheet(sheet.id, edition));
  }
  kicad.file(`${projName}.kicad_pcb`, generateKicadPcbStarter(edition));
  kicad.file(`${projName}.net`, generateKicadNetlist(edition));

  // 3. JLCPCB & Master BOM CSVs
  const jlcpcb = root.folder('jlcpcb')!;
  jlcpcb.file(`${projName}_JLCPCB_BOM.csv`, generateJlcpcbBomCsv(edition));
  jlcpcb.file(`${projName}_Full_Master_BOM.csv`, generateFullMasterBomCsv(edition));

  // 4. Runnable ngspice Deck
  const spice = root.folder('spice')!;
  spice.file(`${projName}_Full_Sim.cir`, generateNgspiceDeck(edition));

  // 5. PDF Engineering Reports (binary ArrayBuffers)
  const docs = root.folder('docs')!;
  const subBatch: 2 | 5 = opts.batchSize === 2 ? 2 : 5;

  const pdfJobs: { name: string; build: () => ReturnType<typeof buildFullHatCostsPdfDoc> }[] = [
    {
      name: '01_Pt1000_Collector_Report.pdf',
      build: () => buildCostosPdfDoc('pwm_dac_lm393', DEFAULT_PT1000_PARAMS, subBatch),
    },
    {
      name: '02_Pump_Supply_Report.pdf',
      build: () => buildPumpSupplyPdfDoc('lm393_schottky_doubler', DEFAULT_PUMP_PARAMS, subBatch),
    },
    {
      name: '03_Hardware_Watchdog_Report.pdf',
      build: () => buildWatchdogPdfDoc('u3b_schmitt_wd', DEFAULT_WATCHDOG_PARAMS, subBatch),
    },
    ...(isAllPt
      ? []
      : [
          {
            name: '04_OneWire_Buses_Report.pdf',
            build: () => buildOneWirePdfDoc('gemini_rev_b_2n7002', DEFAULT_ONEWIRE_PARAMS, subBatch),
          },
        ]),
    {
      name: '05_Output_Stage_Report.pdf',
      build: () => buildOutputStagePdfDoc('gemini_rev_b_pushpull', DEFAULT_OUTPUT_PARAMS, subBatch),
    },
    {
      name: '06_Power_Entry_Report.pdf',
      build: () => buildPowerEntryPdfDoc('gemini_rev_b_efuse', DEFAULT_POWER_PARAMS, subBatch),
    },
    {
      name: '07_Full_HAT_Costs_BOM_Report.pdf',
      build: () => buildFullHatCostsPdfDoc(opts, edition),
    },
  ];

  for (const job of pdfJobs) {
    const pdfDoc = job.build();
    const arrayBuf = pdfDoc.output('arraybuffer');
    docs.file(job.name, arrayBuf);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Triggers a browser download for a Blob (e.g. ZIP bundle) */
export function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
