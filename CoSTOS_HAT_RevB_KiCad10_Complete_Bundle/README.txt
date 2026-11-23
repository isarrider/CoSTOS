===============================================================================
CoSTOS 1-Wire HAT — Rev B/D/E (DG350 8P Fixed Screw) Complete Engineering Bundle
Generated: 2026-11-23 | Target EDA: KiCad 10 | SPICE: ngspice 39-44+
===============================================================================

FOLDER STRUCTURE
----------------
1. kicad/   — Complete KiCad 10 Hierarchical Multi-Sheet Project (156 parts, 72 nets)
   - CoSTOS_HAT_RevB.kicad_pro          <-- OPEN THIS FILE IN KICAD 10!
   - CoSTOS_HAT_RevB.kicad_sch          Root sheet linking all 6 circuit sheets
   - 01_Pt1000_Collector.kicad_sch      Sheet 2: Pt1000 Rev D Core + J6 DG350 8P Fixed Screw (PT1 + 1W-A/B) (25 parts)
   - 02_Pump_Supply.kicad_sch           Sheet 3: Pump Supply Rev E Option 2 CMOS (15 parts)
   - 03_Hardware_Watchdog.kicad_sch     Sheet 4: Dual-Schmitt Watchdog Rev B (26 parts; Q12 DNP)
   - 04_OneWire_Buses.kicad_sch         Sheet 5: 5V 2N7002 1-Wire Buses A & B (21 parts -> J6:3-8)
   - 05_Output_Stage.kicad_sch          Sheet 6: Class-B PWM, FB1/RB1 (27 parts; J4 REL1 DNP)
   - 06_Power_Entry.kicad_sch           Sheet 7: 40-Pin Pi Header + Foldback eFuse + NT1 + FID1-3
   - CoSTOS_HAT_RevB.kicad_pcb          FULLY PLACED & 2-LAYER ROUTED 65 x 56 mm HAT (156 parts, 72 nets, split B.Cu GND/AGND pours, B.SilkS cheat-sheet)
   - CoSTOS_HAT_RevB.net                Complete S-expression netlist (156 parts, 72 nets)

2. jlcpcb/  — JLCPCB Economic PCBA Manufacturing Files
   - CoSTOS_HAT_RevB_JLCPCB_BOM.csv     Populated SMD only (139 parts, 42 reels, EUR 0 Ext fee)
   - CoSTOS_HAT_RevB_Full_Master_BOM.csv All 156 populated parts (SMD + THT) + DNP table

3. spice/   — Full-HAT Real-Silicon ngspice Verification Suite
   - CoSTOS_HAT_RevB_Full_Sim.cir       Run: ngspice -b CoSTOS_HAT_RevB_Full_Sim.cir
                                    (Also opens directly in KiCad 10 Simulator)

4. docs/    — Complete PDF Engineering Report Pack (7 Reports)
   - 01_Pt1000_Collector_Report.pdf
   - 02_Pump_Supply_Report.pdf
   - 03_Hardware_Watchdog_Report.pdf
   - 04_OneWire_Buses_Report.pdf
   - 05_Output_Stage_Report.pdf
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
2. Open kicad/CoSTOS_HAT_RevB.kicad_pro in KiCad 10.
3. Open PCB Editor (CoSTOS_HAT_RevB.kicad_pcb) — all 156 footprints, F.Cu/B.Cu copper tracks,
   vias, split B.Cu GND/AGND copper zones, NT1 star bridge, FID1-3 fiducials, and B.SilkS pinout
   cheat-sheet are already placed & routed.
4. Press B (Fill All Zones) to pour the Priority-2 AGND and Priority-1 GND B.Cu copper zones.
5. Run Inspect -> Design Rules Checker (DRC) once to confirm final zone-filled clearances, then export Gerbers + Drill + CPL.

UNPOPULATED OPTIONS (DNP / n.f. — Footprint Only, EUR 0.00 BOM Cost)
--------------------------------------------------------------------
- J4 (REL1 + Q10-Q12/D6/D7/R15/R17/R501), J3 (PUMP2), J5 (REL2), U_ID (CAT24C32 EEPROM), U10 (DS2482-800)
