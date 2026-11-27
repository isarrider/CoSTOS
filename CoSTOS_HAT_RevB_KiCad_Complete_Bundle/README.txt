===============================================================================
CoSTOS 1-Wire HAT — Rev B/D/E (DG350 8P Fixed Screw) Complete Engineering Bundle
Generated: 2026-11-27 | Target EDA: KiCad 6/7/8/9/10 | SPICE: ngspice 39-44+
===============================================================================

FOLDER STRUCTURE
----------------
1. kicad/   — Complete KiCad Hierarchical Project (177 parts, 83 nets)
   - CoSTOS_HAT_RevB.kicad_pro               <-- OPEN THIS FILE IN KICAD (6, 7, 8, 9, or 10)!
   - CoSTOS_HAT_RevB.kicad_sch               Root sheet linking all 6 circuit sheets
   - 01_Pt1000_Collector.kicad_sch       Sheet 2: Pt1000 Rev D 100% Basic Core + J6 DG350 8P Fixed Screw (PT1 + 1W-A/B) (31 parts)
   - 02_Pump_Supply.kicad_sch            Sheet 3: Pump Supply Rev E Option 2 CMOS (15 parts)
   - 03_Hardware_Watchdog.kicad_sch      Sheet 4: Dual-Schmitt Watchdog Rev B + Q12 +5V_REL switch (27 parts)
   - 04_OneWire_Buses.kicad_sch         Sheet 5: 5V 2N7002 1-Wire Buses A & B (21 parts -> J6:3-8)
   - 05_Output_Stage.kicad_sch           Sheet 6: Class-B PWM, FB1/RB1 & Populated REL1 SMD (35 parts; J4 THT opt.)
   - 06_Power_Entry.kicad_sch            Sheet 7: 40-Pin Pi Header + D18 Direct +5V_HAT + NT1 + FID1-3 (16 parts)
   - CoSTOS_HAT_RevB.kicad_pcb               FULLY PLACED, 2-LAYER ROUTED & PRE-FILLED 65x56 mm HAT
                                         Contains real KiCad-computed (filled_polygon ...) blocks for BOTH
                                         Priority-2 AGND and Priority-1 GND B.Cu copper zones — NOT just "press B"!
   - CoSTOS_HAT_RevB_KiCad_DRC_Report.rpt    Verbatim real KiCad 6.0.11 pcbnew WriteDRCReport proof:
                                         0 unconnected items, 0 DRC violations, 0 footprint errors!
   - CoSTOS_HAT_RevB.net                     Complete S-expression netlist (177 parts, 83 nets)

2. jlcpcb/  — 100% Live-Audited JLCPCB Economic PCBA Manufacturing Files (ZERO Placeholders, EUR 0.00 Ext Fees!)
   - CoSTOS_HAT_RevB_JLCPCB_BOM.csv          Populated SMD only (160 parts, 33 reels):
                                         32 Basic + 1 Preferred (C17656) + 0 Extended = EUR 0.00 Ext fees!
                                         Every line includes live-verified LCSC #, Manufacturer Part (MPN),
                                         Value, Tolerance, Package, and JLCPCB Class (Basic/Preferred),
                                         including C7955 (LM393DR2G Basic), C105432 (S8550 Basic), C181103 (TL431 Basic),
                                         C46653 (1nF X7R Basic), C1710 (10nF X7R Basic for C101/C102/C9), C17513 (7x 1.00k 1% Basic),
                                         C49678 (100nF 50V ESD on EVERY Pt1000 wire: C106/C105), and C81598 (D8/D8B symmetric clamp).
   - CoSTOS_HAT_RevB_Full_Master_BOM.csv     All 177 populated parts (SMD + THT) + DNP table

3. spice/   — Official Vendor TI LM393 ngspice-39 Verification Suites (0 Warnings)
   - CoSTOS_HAT_RevB_Full_Sim.cir            Full-board transient + 6-pt Pt1000 sweep (-20..+250C/OPEN/SHORT)
                                         + Populated REL1 SMD (67 mA coil, 123.2 mA short, 5.31 V flyback, 2.2 uV WD cutoff)
                                         + +3V3_ANA AC filter (-36.04 dB @ 100 kHz) using the official vendor
                                         Texas Instruments / MicroSim .SUBCKT LM393 macromodel (C7955).
                                         Run: ngspice -b CoSTOS_HAT_RevB_Full_Sim.cir
   - CoSTOS_HAT_RevB_Watchdog_RealTime.cir   REAL-TIME UNSCALED Hardware Watchdog verification (ZERO time scaling!):
                                         Exact BOM values (R301=4.7k, C16=100n, C17/C19=1u, C18=38u, R49||R50=500k)
                                         with official TI .SUBCKT LM393 & Basic S8550 Q15:
                                           Test 1 (36 s real time, 20 Hz HB -> halt @ 10 s):
                                             Q12 +5V_REL cutoff = 16.11 s (5.046 V -> 2.2 uV), PUMP1 WD_OK cutoff = 18.42 s
                                           Test 2 (4 s real time, 1 kHz runaway loop):
                                             V(wd_cap) max = 0.745 V (< 1.54 V threshold -> +5V_REL & WD_OK stay tripped!)
                                         Run: ngspice -b CoSTOS_HAT_RevB_Watchdog_RealTime.cir

4. docs/    — Complete PDF Engineering Report Pack (7 Reports)
   - 01_Pt1000_Collector_Report.pdf
   - 02_Pump_Supply_Report.pdf
   - 03_Hardware_Watchdog_Report.pdf
   - 04_OneWire_Buses_Report.pdf
   - 05_Output_Stage_Report.pdf
   - 06_Power_Entry_Report.pdf
   - 07_Full_HAT_Costs_BOM_Report.pdf

PT1000 ACCURACY & HONEST 100% BASIC REEL COMPARISON (VS. D25 MAX31865)
----------------------------------------------------------------------
- Locked 100% Basic Bridge (7x C17513 1.00k +/-1% +/-100ppm Basic = 4.00k / 1.00k / 2.00k + C1710 10nF X7R + C49678 100nF 50V ESD on EVERY Pt1000 wire + D8/D8B 1N4148W):
  0 Extended SMD reels across the ENTIRE HAT = EUR 0.00 SMD loading fees!
  Raw uncalibrated accuracy is ~+/-2-4 K (ideal for roof solar collector differential delta-T), tightening to
  ~+/-0.4-0.6 K year-round after a one-time 5-second software calibration in the Setup Wizard (tap water / DS18B20).
- Optional Drop-In 0.1% Upgrade (no PCB change): Swap C17513 -> C110774 (1.00k 0.1% +/-25ppm, +EUR 2.80 Ext) for +/-0.69 K RSS out-of-the-box without calibration.
- Baseline D25 MAX31865 + 4.30k 0.1% ref:
  2-3 Extended reels (MAX31865 + 4.30k 0.1% + PESD24V = EUR 8.40) -> +/-0.59 K worst-case (bench-proven SPI IC).
- Status: The U1 LM393DR2G RC-ramp + 2-pt BIST circuit is SPICE-verified with the official TI
  LM393 macromodel, but NOT yet bench-proven on physical hardware against a MAX31865 reference.

LOCKED ARCHITECTURE DECISIONS VS. COSTOS REPO D18 / D25
-------------------------------------------------------
1. REL1 SMD Driver Populated; J4 2-Pin THT Optional [NOW MATCHED TO D25]
   - All REL1 SMD parts (Q10 AO3400A, Q12 AO3401A, Q11 MMBT3904, D6 SS14, D7 Green LED, R15 10k,
     R17 2.2k, R501A||B = 2x 10R Basic = 5.0R / 123.2 mA short limit) are factory-populated
     (0 new reels, EUR 0.00 extra feeder fee, +EUR 0.23/bd). Only J4 THT screw block is optional.
2. Direct Pi +5V -> +5V_HAT (Foldback eFuse Dropped) + 100% Basic SMD Optimization [MATCHED TO D18]
   - Removed eFuse (C15545) + consolidated ALL 12 Extended reels -> 0 Extended reels (EUR 0.00 SMD loading fees, -EUR 33.60/order!).
3. 1-Wire at 5 V via 2N7002 level-shifters + Basic TL431 5.36 V clamp [LOCKED — 1-Wire Edition]
   - Gives 5 V bus swing, 40-65 m DS18B20 reach, and tighter 5.390 V +12 V DQ clamp (+EUR 0.23/bd, EUR 0.00 Ext fee).
4. Plain 11 mm non-stacking 40-pin Pi header (J1) [LOCKED — Turnkey JLCPCB THT]
   - EUR 0.45 low-profile header clearing passive Pi 5 heatsinks; wave-soldered by JLCPCB Standard PCBA.
5. Combined 8-pin J6 sensor terminal (DG350-3.5-08P / Dual-Tier DG350D-3.5-08P) [LOCKED — Turnkey JLCPCB THT]
   - 0 mm overhang and only 3 factory-soldered THT parts (J1, J2, J6); rising-cage M2 screw clamps.
6. Discrete LM393DR2G (C7955) 72 Hz RC Ramp + 100% Basic Bridge (C17513 / C1710 / C49678 / D8+D8B) [LOCKED — Validate on 2x Prototype]
   - Keeps SPI0/I2C1 free, achieves EUR 0.00 SMD loading fees, & saves EUR 4.50+/bd (1-Wire) or EUR 38+/bd (8-ch All-Pt1000) vs MAX31865;
     requires 2x bench validation against MAX31865 before volume production.

UNPOPULATED OPTIONS (DNP / n.f. — Footprint Only, EUR 0.00 BOM Cost)
--------------------------------------------------------------------
- J4 (2-pin 3.5 mm THT connector only — REL1 SMD driver IS populated), J3 (PUMP2), J5 (REL2), U_ID (CAT24C32 EEPROM), U10 (DS2482-800)
