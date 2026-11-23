# CoSTOS Raspberry Pi HAT — Hardware Engineering Status & Fabrication Guide

This directory contains the complete hardware engineering, circuit simulation (`ngspice-39`), BOM/costing, and KiCad 10 PCB export suite for the **CoSTOS Raspberry Pi 3/4/5 HAT** (`65 × 56 mm`, Rev B/D/E), supporting two production editions:

* **1-Wire HAT Edition (`onewire`)**: 1× Pt1000 + 2× protected 1-Wire buses (`1W-A` / `1W-B`) on a single 8-pin `J6` (`DG350-3.5-08P`) rising-cage terminal block.
* **All-Pt1000 HAT Edition (`all_pt1000`)**: 8× switched-mux Pt1000 channels on a single dual-tier 2×8P `J6` (`DG350D-3.5-08P`) rising-cage terminal block (`0 mm` board overhang).

---

## 1. Directory Structure

| Folder | Subsystem / Tool |
| :--- | :--- |
| `01-PT1000` | Switched-mux Pt1000 collector front-end, 2-point BIST calibration (`Q2` 1.00 kΩ / `Q3` 1.80 kΩ), RC filtering |
| `02-OneWire` | Dual protected 1-Wire buses (`1W-A` / `1W-B`), 100 Ω cable-short limiting, `D34`/`D35` VDD health LEDs |
| `03-PumpSupply` | 62 kHz CMOS Schottky Dickson charge-pump (`+V_DRV ≈ 9.1 V`) & `D33` rail LED |
| `04-Watchdog` | Hardware heartbeat watchdog (`U4` Schmitt/RC timer), Green `D3` OK & Red `D36` FAULT (`Q23` inverter) |
| `05-OutputStage` | Push-pull `0–10 V` / PWM pump driver (`J2 PUMP1`), `0–10 V` feedback divider, `D12` PWM LED |
| `06-PowerEntry` | Foldback eFuse (`+5V_HAT`), reverse/surge protection, `D2` PWR LED |
| `07-Connectors` | Rising-cage terminal blocks (`J6`, `J2`), normal 11 mm 40-pin RPi header (`J1`), DNP options (`J4`/`J3`/`J5`) |
| `08-FullHat` | Master BOM, JLCPCB Economic PCBA & Split-Order Cost Engine, KiCad 10 ZIP Bundle & PDF Report exporters |
| `09-HatSize` | Mechanical envelope, passive Raspberry Pi 5 heatsink clearance (`11.0 mm` stack), zero-overhang checks |
| `10-HatPreview` | Interactive PCB / 3D Isometric / CAD viewer with live LED simulation & 2-layer routed copper overlay |
| `11-DiscreteVsIC` | Discrete-component vs. specialized-IC trade-off & JLCPCB Basic/Extended reel optimization study |
| `12-SpiceVerification` | Full-board post-LED `ngspice-39` verification results & fault-injection telemetry |

---

## 2. Current Hardware Status (Fab-Ready)

Both HAT editions are **design-complete, SPICE-verified, and 100% placed & routed on 2 layers**:

| Metric | 1-Wire HAT Edition | All-Pt1000 HAT Edition |
| :--- | :--- | :--- |
| **Footprints Placed** | `156 / 156` (`0` courtyard overlaps) | `157 / 157` (`0` courtyard overlaps) |
| **Signal Nets Routed** | `70 / 70` (`100%`, `0` unrouted) | `78 / 78` (`100%`, `0` unrouted) |
| **Copper Tracks (`F.Cu` + `B.Cu`)** | `1,531` segments | `2,813` segments |
| **Stitched Vias (`0.55 / 0.30 mm`)** | `339` vias | `559` vias |
| **Min Copper Clearance** | `0.160 mm` (> JLCPCB `0.127 mm` spec) | `0.160 mm` (> JLCPCB `0.127 mm` spec) |
| **Geometric DRC Violations** | `0` | `0` |
| **B.Cu Pour Continuity** | `GND 67/67` · `AGND 16/16` | `GND 56/56` · `AGND 37/37` |
| **Post-LED `ngspice-39` Check** | Pass (`+5V_HAT = 4.959 V`, `+V_DRV = 9.080 V`) | Pass (`+5V_HAT = 4.969 V`, `+V_DRV = 9.104 V`) |

### Included Zero-Cost DFM & Commissioning Features
* **Diagnostic LEDs**: `D2` (`+5V_HAT`), `D33` (`+V_DRV` 9.1 V), `D34`/`D35` (`1W-A`/`1W-B` cable-short detect on 1-Wire Edition), Green `D3` (WD OK), Red `D36` (WD FAULT via zero-load `Q23` NMOS inverter), and `D12` (`PUMP1` PWM).
* **Optical Fiducials (`FID1`–`FID3`)**: 3 asymmetric 1.0 mm bare-copper fiducials for JLCPCB SMT pick-and-place alignment.
* **Star-Ground Net-Tie (`NT1`)**: Explicit KiCad 10 net-tie bridging Kelvin `AGND` and digital `GND` at a single controlled point near `J1` Pins 9/14.
* **Back-Side Silkscreen (`B.SilkS`)**: Mirrored field-commissioning cheat-sheet listing `J6`/`J2` pinouts, Raspberry Pi GPIO map, `TP1`–`TP5` test points, and LED legend.

---

## 3. PCB Stackup Decision: 2-Layer (Selected for Production)

**Decision**: Stay with the verified **2-layer** stackup (`100%` routed on both editions, `0.160 mm` min clearance, `0` geometric DRC violations, intact `GND`/`AGND` `B.Cu` pours).

*Archived reference (if ever revisiting 4-layer in a future revision)*:
* **Bare PCB (65 × 56 mm, 5 pcs minimum per design)**:
  * **2-Layer (Selected)**: `$2` (`~€1.85`) ex-VAT per design.
  * **4-Layer (Optional future upgrade)**: `$7` (`~€6.50`) ex-VAT per design (**`+€4.65` ex-VAT** per design).
* **JLCPCB Economic PCBA Fee**: **`€0.00` extra** for 4-layer (green solder mask, HASL, single-sided SMD).
* **Split Order Delta (`3× 1-Wire + 3× All-Pt1000`, 2 designs)**: **`+€9.30` ex-VAT / `+€11.07` incl. 19% VAT** total (**`+€1.85` per active HAT**).

---

## 4. Next Steps: From Export to Working Boards (~15–20 min)

### Step 1 — Download the Complete Bundle(s)
Open **Tab 08 (`08-FullHat`)**, select the target edition (`1-Wire HAT` and/or `All-Pt1000 HAT`), and click **Download Complete Bundle (.zip)**. Each ZIP contains the full KiCad 10 hierarchical project (`.kicad_pro`, root + 6 wired `.kicad_sch` sheets, placed & routed `.kicad_pcb`, `.net`), JLCPCB & Master BOM CSVs, runnable `ngspice` deck, `README.txt`, and all PDF engineering reports.

### Step 2 — KiCad 10 Pre-Fab Sign-Off (~2 min per board)
> **Pre-Fab Sign-Off Note:** Geometric copper clearances and pour continuity are verified automatically, but before uploading Gerbers to JLCPCB, open the exported `.kicad_pcb` in **KiCad 10 PCB Editor**, press **`B`** to pour the Priority-2 `AGND` and Priority-1 `GND` `B.Cu` copper zones, and run **`Inspect → Design Rules Checker (DRC)`** once to confirm final zone-filled clearances.

Then generate the JLCPCB fabrication package (Gerbers + Drill + Position/CPL):
* Easiest method: use the free **JLCPCB Fabrication Toolkit** plugin (via KiCad Plugin & Content Manager), or export manually via `File → Fabrication Outputs`.

### Step 3 — Upload & Verify in JLCPCB 3D Assembly Preview (~10 min)
1. Upload the Gerbers/Drill ZIP, `jlcpcb/*_JLCPCB_BOM.csv`, and the exported KiCad CPL (`.pos` / `.csv`) file to JLCPCB.
2. Select **Economic PCBA** (single-sided TOP SMD assembly, green solder mask, HASL) and choose 2-layer or 4-layer.
3. Confirm LCSC stock on the 3× `0.1%` `25 ppm` Preferred Extended reference resistors (`3.90 kΩ`, `1.00 kΩ`, `1.80 kΩ`). If any temporarily leaves the Preferred list, swap to any in-stock `0805` `0.1%` `25 ppm` Preferred value and update the calibration constant in software.
4. **Visually inspect JLCPCB's 3D Component Placement Preview before paying**:
   * Check Pin-1 dots on `U1`, `U3`, `U4` (`SOIC-8`).
   * Check pin alignment on `SOT-23` MOSFETs (`Q*`).
   * Check cathode stripes on all diodes and LEDs (`D1`–`D36`), as JLCPCB CPL rotation conventions occasionally require a 90°/180° click-rotate in their viewer.

### Step 4 — Source the 3 DIY THT Parts + Standoffs *(skip if ordering JLCPCB Zero-Solder THT)*
Per assembled HAT:
* `J1`: Standard normal-height (`11.0 mm` stack) 40-pin female Raspberry Pi GPIO header.
* `J6`: `DG350-3.5-08P` (1-Wire Edition) or `DG350D-3.5-08P` Dual-Tier 2×8P (All-Pt1000 Edition).
* `J2`: `DG350-3.5-03P` 3-pin rising-cage screw terminal (`PUMP1`).
* Hardware: 4× `M2.5` `11.0 mm` **nylon** (non-conductive) standoffs + screws.
* Leave `JP1` as a bare 2-pad tweezer test point (DNP) and keep `J4`/`J3`/`J5`/`U_ID` unpopulated.

---

## 5. First-Power Bench Bring-Up Checklist (Before Connecting Boiler / Pump)

Power the HAT on a bare Raspberry Pi via USB-C and verify these four steps in order:

1. **Rails & Diagnostic LEDs**:
   * Confirm Green `D2` (`+5V_HAT`), `D33` (`+V_DRV`), and `D34`/`D35` (1-Wire Edition) light cleanly.
   * Probe test pads: `TP1 (+5V_HAT) = 4.78–5.00 V`, `TP2 (+V_DRV) = 8.6–9.2 V`, `+3V3_ANA = 3.25–3.30 V`, `TP5 = AGND`.
2. **Foldback eFuse Short-Circuit Test**:
   * Briefly short `+5V_HAT` (`TP1`) to `GND` through a multimeter on current range — confirm current folds back safely to `~120–137 mA` with **zero Raspberry Pi reboot** and instant self-recovery upon release.
   * *(1-Wire Edition)* Briefly short `1W-A VDD` to `GND` on `J6` — confirm `D34` goes dark while `D35` stays lit and `+5V_HAT` remains `> 4.8 V`.
3. **Hardware Watchdog & Fault LED Test**:
   * Drive a `20 Hz` square wave on `GPIO 24` (`WD_HB`) — confirm Green `D3` turns ON, Red `D36` turns OFF, and `Q5` enables `PUMP1`.
   * Stop the `20 Hz` heartbeat — confirm watchdog trips after `~14–17 s`, Green `D3` turns OFF, Red `D36` lights cleanly, `GPIO 25` (`WD_RB`) drops LOW, and `PUMP1` is forced safe.
4. **Pt1000 BIST & Accuracy Check**:
   * Run 2-point BIST calibration (`Q2` `1.00 kΩ` reference & `Q3` `1.80 kΩ` reference).
   * Connect a precision `1.000 kΩ` test resistor across `J6` `PT1+`/`PT1-` (and each mux channel on All-Pt1000) and verify `0.00 °C` reading.

---

## 6. Next Phase Roadmap — Raspberry Pi Software / CoSTOS HAL Driver

Once boards are ordered or on the bench, the next engineering phase is implementing the Raspberry Pi CoSTOS HAT driver matching this exact GPIO map:

* **Switched-Mux Pt1000 Acquisition & 2-Point BIST Calibration**: Drive `GPIO 17` (`DUTY`), `GPIO 27` (`PT_SEL`), `GPIO 22` (`REF_LO`), `GPIO 23` (`REF_HI`), plus the 3 mux select lines on the All-Pt1000 Edition.
* **Hardware Watchdog Heartbeat Daemon**: Generate the `20 Hz` pulse on `GPIO 24` (`WD_HB`) and monitor `GPIO 25` (`WD_RB`) for fault confirmation.
* **1-Wire Dual-Bus Reader** *(1-Wire Edition)*: Kernel `w1-gpio` overlays on `GPIO 4` (`1W-A`) and `GPIO 26` (`1W-B`).
* **Pump Control & Feedback Loop**: Hardware PWM on `GPIO 18` (`PWM1`), `0–10 V` feedback reading on `GPIO 6` (`FB1`), and readback supervision on `GPIO 12` (`RB1`).
