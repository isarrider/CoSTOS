# CoSTOS Raspberry Pi HAT — Hardware Engineering Status & Fabrication Guide

This directory contains the complete hardware engineering, circuit simulation (`ngspice-39`), BOM/costing, and KiCad 10 PCB export suite for the **CoSTOS Raspberry Pi 3/4/5 HAT** (`65 × 56 mm`, Rev B/D/E), supporting two production editions:

* **1-Wire HAT Edition (`onewire`)**: 1× Pt1000 + 2× protected 1-Wire buses (`1W-A` / `1W-B`) on a single 8-pin `J6` (`DG350-3.5-08P`) rising-cage terminal block.
* **All-Pt1000 HAT Edition (`all_pt1000`)**: 8× switched-mux Pt1000 channels on a single dual-tier 2×8P `J6` (`DG350D-3.5-08P`) rising-cage terminal block (`0 mm` board overhang).

---

## 1. Directory Structure

| Folder | Subsystem / Tool |
| :--- | :--- |
| `01-PT1000` | Switched-mux Pt1000 collector front-end, 100% Basic `C17513` 1.00 kΩ 1% bridge (`4k/1k/2k`), `C1710` 10 nF X7R ramp, `C106`/`C105` 100 nF 50 V ESD, `D8`/`D8B` 1N4148W |
| `02-OneWire` | Dual protected 1-Wire buses (`1W-A` / `1W-B`), Basic `TL431` 5.36 V clamps (`5.39 V` @ +12 V), 100 Ω limiters, `D34`/`D35` LEDs |
| `03-PumpSupply` | 57 kHz CMOS Schottky Dickson charge-pump (`C20` 1 nF X7R Basic, `R60A||B` 50 Ω Basic → `+V_DRV = 9.179 V`) & `D33` LED |
| `04-Watchdog` | Hardware heartbeat watchdog (`U4` Schmitt/RC timer + `Q15` S8550 Basic), Green `D3` OK & Red `D36` FAULT (`Q23` inverter) |
| `05-OutputStage` | S8550 Class-B PWM (`R9A+B` 200 Ω → `7.631 V` on `J2`), `R12A||B` 2.35 kΩ `FB1`, `D12` LED, populated `REL1` SMD (`123.2 mA` limit) |
| `06-PowerEntry` | Direct D18 `+5V_HAT` (`5.045 V`, `44 µF` MLCC, no eFuse), `+3V3_ANA` Pi-filter (`-36.04 dB`), `D9` Basic `TL431` 3.67 V clamp |
| `07-Connectors` | Rising-cage terminal blocks (`J6`, `J2`), normal 11 mm 40-pin RPi header (`J1`), optional THT `J4` (`REL1` SMD populated) & DNP `J3`/`J5` |
| `08-FullHat` | Master BOM, JLCPCB Economic PCBA & Split-Order Cost Engine, KiCad 10 ZIP Bundle & PDF Report exporters |
| `09-HatSize` | Mechanical envelope, passive Raspberry Pi 5 heatsink clearance (`11.0 mm` stack), zero-overhang checks |
| `10-HatPreview` | Interactive PCB / 3D Isometric / CAD viewer with live LED simulation & 2-layer routed copper overlay |
| `11-DiscreteVsIC` | Discrete-component vs. specialized-IC trade-off & JLCPCB Basic/Extended reel optimization study |
| `12-SpiceVerification` | Full-board post-LED `ngspice-39` verification results & fault-injection telemetry |

---

## 2. Current Hardware Status (Post-PR Full Verification)

Both HAT editions are **placed, 2-layer routed, pre-filled with real KiCad `B.Cu` copper zones, verified by KiCad `WriteDRCReport` (0 DRC violations, 0 unconnected pads, 0 footprint errors — without pressing `B`), 100% live-audited on JLCPCB (ZERO placeholders), and verified in `ngspice-39` with 0 warnings using the official vendor Texas Instruments `.SUBCKT LM393` macromodel and real-time unscaled Watchdog values**:

| Metric | 1-Wire HAT Edition | All-Pt1000 HAT Edition |
| :--- | :--- | :--- |
| **Footprints Placed & Routed** | `178 / 178` (`83` nets, `3,089` segs, `297` vias, `0` overlaps) | `180 / 180` (`87` nets, `3,467` segs, `343` vias, `0` overlaps) |
| **Pre-Filled `B.Cu` Copper Zones** | **Embedded** (`6` AGND + `14` GND = `20` `filled_polygon` blocks) | **Embedded** (`13` AGND + `23` GND = `36` `filled_polygon` blocks) |
| **Real KiCad `6.0.11` DRC (No Refill)** | **`0` violations · `0` unconnected pads · `0` footprint errors** | **`0` violations · `0` unconnected pads · `0` footprint errors** |
| **Audited SMD Reels (Live JLCPCB)** | `160` SMD / `33` reels (`32` Basic + `1` Pref + **`0` Ext = `€0.00`**) | `162` SMD / `32` reels (`31` Basic + `1` Pref + **`0` Ext = `€0.00`**) |
| **5× PCBA Total (Turnkey THT / DIY)** | **`€89.70` (`€17.94/bd`)** · DIY `€53.55` (`€10.71/bd`) | **`€94.79` (`€18.96/bd`)** · DIY `€57.88` (`€11.58/bd`) |
| **`ngspice-39` (Vendor TI `LM393`)** | Exit `0`, **`0` warnings** (`+5V_HAT = 5.045 V`, `+V_DRV = 9.179 V`, `PWM1 = 7.631 V`) | Exit `0`, **`0` warnings** (`+5V_HAT = 5.045 V`, `+V_DRV = 9.180 V`, `PWM1 = 7.632 V`) |
| **Populated `REL1` SMD (`D25`)** | `67.0 mA` coil · `123.2 mA` short · `5.307 V` flyback · `2.2 µV` WD cutoff | `67.0 mA` coil · `123.2 mA` short · `5.307 V` flyback · `2.2 µV` WD cutoff |
| **Watchdog SPICE (Real-Time Unscaled)** | **`16.11 s` REL (`Q12`) / `18.42 s` PUMP (`WD_OK`)** · `1 kHz` runaway `0.745 V` | **`16.11 s` REL (`Q12`) / `18.42 s` PUMP (`WD_OK`)** · `1 kHz` runaway `0.745 V` |

### Live-Audited 100% Basic SMD BOM (`€0.00` Loading Fees, Zero Placeholders)
* **Comparator**: `U1`/`U3`/`U4` use **`C7955`** (`LM393DR2G`, onsemi open-collector dual comparator, SOIC-8, **Basic**).
* **ALL 6 Subsystems (`01–06`) are 100% JLCPCB Basic/Preferred (`0` Extended SMD reels = `€0.00` loading fees!)**: Live-verified Basic swaps cut Extended SMD reels from **`12` (`€33.60`) → `0` (`€0.00`)**, saving **`€33.60/order` (`€6.72/bd` ex-VAT @ 5×)**:
  * **Subsystem 01 (`Pt1000`)**: `7× C17513` (`1.00 kΩ ±1% ±100 ppm` Basic = `4.00k / 1.00k / 2.00k`), `2× C1710` (`10 nF 50 V X7R` Basic, shared with `C9`, drift cancelled by 2-pt BIST), `C49678` (`100 nF 50 V X7R` Basic ESD/RFI shunts on EVERY Pt1000 wire: `C106` + `C105` on 1-Wire, `C106` + `C105` + `C105B–H` on All-Pt1000), and symmetric `C81598` (`1N4148W` Basic `D8` + `D8B`).
  * **Subsystems 02–06**: `S8550` (`C105432` Basic) replaces `MMBT3906`; `TL431` (`C181103` Basic) replaces `BZT52C3V6` & `BZX84C5V1`; `1 nF X7R` (`C46653` Basic) replaces `1 nF C0G`; `R105A||B`, `R60A||B`, `R9A+B`, and `R12A||B` reuse existing Basic reels (`C17901`, `C17673`).
* **1 Preferred Reel (`€0.00` fee)**: `C17656` (`0805W8F3903T5E`, `390 kΩ ±1% ±100 ppm/°C`, `0805`).
* **0 Extended SMD Reels (`€0.00` total SMD loading fees across BOTH editions!)**.
* **Honest Pt1000 Accuracy Error Budget (Actual 100% Basic BOM vs. Alternatives)**:
  * **Actual 100% Basic BOM (`7× C17513 1.00 kΩ ±1% Basic`)**: **`0` Extended reels (`€0.00` loading fees)** → **`~±2–4 K` raw** (ideal for roof solar collector ΔT pump start), tightening to **`~±0.4–0.6 K` year-round** after a one-time 5 s software calibration against tap water or a DS18B20 in Setup Wizard. Still **bench-unproven** on Linux GPIO timing.
  * **Optional drop-in `0.1%` upgrade (zero PCB change)**: Swap `C17513` → `C110774` (`1.00 kΩ ±0.1% ±25 ppm`, `+€2.80` Ext) for `±0.69 K` RSS out-of-the-box without calibration.
  * **Repo D25 `MAX31865` baseline**: `2–3` Extended reels (`MAX31865` + `4.30 kΩ 0.1%` + `PESD24V` = `€8.40`) → **`±0.59 K` worst-case** (bench-proven SPI IC). Validate the discrete RC ramp on a `2×` prototype before volume ordering.
* **Watchdog SPICE (Real-Time Unscaled)**: Bundled as `spice/*_Watchdog_RealTime.cir` and executed directly in `ngspice-39` with **exact BOM values (`R301=4.7 kΩ`, `C16=100 nF`, `C17=C19=1 µF`, `C18=38 µF`, `R49||R50=500 kΩ`, `Q15=S8550`, `20 Hz` heartbeat, ZERO scaling)** and the **official vendor TI `.SUBCKT LM393`**: peak `2.171 V`, arm `3.60 s`, **`16.11 s` `Q12` `+5V_REL` cutoff (`5.046 V -> 2.2 µV`) / `18.42 s` `WD_OK` cutoff (`3.280 V -> 3.4 µV`)**, and **`0.745 V` max under `1 kHz` runaway**.

### Locked Architecture Decisions Register vs. CoSTOS Repo D18 / D25
| # | Existing Repo Decision | Locked Rev B/D/E Status | Engineering Reason & Trade-Off | Revert / Option Path |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **D25 (`REL1` fitted)** | **MATCHED TO D25** — All `REL1` SMD driver parts populated; only `J4` 2-pin THT optional | `Q10` AO3400A, `Q12` AO3401A, `Q11` MMBT3904, `D6` SS14, `D7` Green LED, `R15` `10 kΩ`, `R17` `2.2 kΩ`, `R501A||B = 2×10 Ω` (`5.0 Ω`, `123.2 mA` limit) reuse existing Basic reels (`€0.00` extra fee, `+€0.23/bd`). | Add a `€0.15` 2-pin `3.5 mm` terminal into `J4` only if relay switching is needed. |
| 2 | **D18 (no 5 V eFuse)** | **MATCHED TO D18** — Foldback eFuse dropped + 100% Basic SMD reel optimization | Direct Pi `+5V` → `+5V_HAT` (`5.045 V`) + full Basic consolidation cuts Extended SMD reels `12 → 0` (`€0.00`, **`-€33.60/order`**) with zero series voltage drop. | N/A — aligned with repo D18. |
| 3 | **3.3 V 1-Wire baseline** | **KEEP `5 V` 1-Wire** (`onewire` only) via `2N7002` + `TL431` 5.36 V + `D34/D35` | Reaches `40–65 m` DS18B20 cables without `DS2482` (`+€0.23/bd`, `€0.00` Extended fee); Basic `TL431` clamps `+12 V` faults to **`5.390 V`** (below DS18B20 `5.5 V` max!). | Omit `Q19/Q20` and connect `DQ` directly to `3.3 V` pull-up if `<10 m` bus only. |
| 4 | **D25 tall stacking header** | **KEEP plain `11 mm` female 2×20 header** (`J1`, `€0.45`, JLCPCB turnkey THT) | Clears passive Pi 5 heatsinks with `11 mm` nylon standoffs; factory wave-soldered by JLCPCB Standard PCBA. | Substitute a standard `2×20` long-pin stacking header on the same `J1` footprint. |
| 5 | **Separate sensor blocks** | **KEEP combined 8-pin `J6`** (`DG350-3.5-08P` / Dual-Tier `DG350D-3.5-08P`) | `0 mm` overhang and only `3` factory-soldered THT parts (`J1`, `J2`, `J6`) with M2 rising-cage clamps. | Re-split `J6` into separate `2P`/`3P` terminal footprints in KiCad if modular plugs are preferred. |
| 6 | **D25 `MAX31865` RTD IC** | **KEEP discrete `LM393DR2G` (`C7955`) 72 Hz RC ramp** + 100% Basic bridge (`C17513`/`C1710`/`C49678`/`D8+D8B`) | Achieves `€0.00` SMD loading fees, saves `€4.50+/bd` (`1-Wire`) or `€38+/bd` (`All-Pt1000`), keeps `SPI0/I2C1` free; `±0.5 K` calibrated (`±2–4 K` raw). | Bench-unproven on Linux GPIO timing — validate on `2×` prototype against `MAX31865`; drop-in `0.1%` `C110774` optional (`+€2.80`). |

### Included Zero-Cost DFM & Commissioning Features
* **Diagnostic LEDs**: `D2` (`+5V_HAT`), `D33` (`+V_DRV` `9.21 V`), `D34`/`D35` (`1W-A`/`1W-B` cable-short detect on 1-Wire Edition), Green `D3` (WD OK), Red `D36` (WD FAULT via zero-load `Q23` NMOS inverter), `D12` (`PUMP1` PWM), and `D7` (`REL1` energized, Green `C2297`).
* **Optical Fiducials (`FID1`–`FID3`)**: 3 asymmetric 1.0 mm bare-copper fiducials for JLCPCB SMT pick-and-place alignment.
* **Star-Ground Net-Tie (`NT1`)**: Clean 2-pad KiCad net-tie bridging Kelvin `AGND` and digital `GND` at a single controlled point near `J1` Pins 9/14.
* **Back-Side Silkscreen (`B.SilkS`)**: Mirrored field-commissioning cheat-sheet listing `J6`/`J2`/`J4` pinouts, Raspberry Pi GPIO map, `TP1`–`TP5` test points, and LED legend.

---

## 3. PCB Stackup Decision: 2-Layer (Selected for Production)

**Decision**: Stay with the verified **2-layer** stackup (`100%` routed and pre-filled on both editions, **`0` KiCad DRC violations / `0` unconnected pads / `0` footprint errors**).

*Archived reference (if ever revisiting 4-layer in a future revision)*:
* **Bare PCB (65 × 56 mm, 5 pcs minimum per design)**:
  * **2-Layer (Selected)**: `$2` (`~€1.85`) ex-VAT per design.
  * **4-Layer (Optional future upgrade)**: `$7` (`~€6.50`) ex-VAT per design (**`+€4.65` ex-VAT** per design).
* **JLCPCB Economic PCBA Fee**: **`€0.00` extra** for 4-layer (green solder mask, HASL, single-sided SMD).
* **Split Order Delta (`3× 1-Wire + 3× All-Pt1000`, 2 designs)**: **`+€9.30` ex-VAT / `+€11.07` incl. 19% VAT** total (**`+€1.85` per active HAT**).

---

## 4. Next Steps: From Export to Working Boards (~15 min)

### Step 1 — Download the Complete Bundle(s)
Open **Tab 08 (`08-FullHat`)**, select the target edition (`1-Wire HAT` and/or `All-Pt1000 HAT`), and click **Download Complete Bundle (.zip)**. Each ZIP contains the full KiCad project (`.kicad_pro`, root + 6 wired `.kicad_sch` sheets, placed/routed/pre-filled `.kicad_pcb`, **verbatim KiCad DRC report `*_KiCad_DRC_Report.rpt`**, `.net`), live-audited JLCPCB & Master BOM CSVs, full-board `ngspice` deck + **real-time unscaled Watchdog `*_Watchdog_RealTime.cir`**, `README.txt`, and all PDF engineering reports.

### Step 2 — Generate Gerbers / Drill / CPL in KiCad (~2 min per board)
> **Pre-Filled & DRC-Verified:** Both exported `.kicad_pcb` files already contain exact `B.Cu` `AGND` & `GND` `(filled_polygon ...)` copper pours generated by KiCad `pcbnew.ZONE_FILLER` and verified with KiCad `WriteDRCReport` (**`0` DRC violations · `0` unconnected pads · `0` footprint errors** — without pressing `B`).

Generate the JLCPCB fabrication package (Gerbers + Drill + Position/CPL):
* Easiest method: use the free **JLCPCB Fabrication Toolkit** plugin (via KiCad Plugin & Content Manager), or export manually via `File → Fabrication Outputs`.

### Step 3 — Upload & Verify in JLCPCB 3D Assembly Preview (~10 min)
1. Upload the Gerbers/Drill ZIP, `jlcpcb/*_JLCPCB_BOM.csv` (100% live-verified LCSC C-numbers, MPNs, tolerances, and classes — zero placeholders), and the exported KiCad CPL (`.pos` / `.csv`) file to JLCPCB.
2. Select **Standard PCBA (Zero-Solder Turnkey THT)** so JLCPCB factory wave-solders `J1`, `J6`, and `J2` (or Economic PCBA for SMD-only), and verify the `32`/`31` Basic + `1` Preferred (`C17656`) + **`0` Extended (`€0.00`)** SMD reel classification.
3. **Visually inspect JLCPCB's 3D Component Placement Preview before paying**:
   * Check Pin-1 dots on `U1`, `U3`, `U4` (`SOIC-8`, `C7955`).
   * Check pin alignment on `SOT-23` MOSFETs (`Q*`), `S8550` (`Q7/Q8/Q15`), and `TL431` (`D9/D31/D32`).
   * Check cathode stripes on all diodes and LEDs (`D1`–`D36`), as JLCPCB CPL rotation conventions occasionally require a 90°/180° click-rotate in their viewer.

### Step 4 — Turnkey THT Parts (`J1`, `J6`, `J2`) + Nylon Standoffs
Factory-soldered by JLCPCB Standard PCBA (no hand-soldering required for `J1`, `J6`, `J2`):
* `J1`: Standard normal-height (`11.0 mm` stack) 40-pin female Raspberry Pi GPIO header.
* `J6`: `DG350-3.5-08P` (1-Wire Edition) or `DG350D-3.5-08P` Dual-Tier 2×8P (All-Pt1000 Edition).
* `J2`: `DG350-3.5-03P` 3-pin rising-cage screw terminal (`PUMP1`).
* *(Optional)* `J4`: 2-pin `3.5 mm` screw terminal (`+€0.15`) — all `REL1` SMD driver parts (`Q10–Q12`, `D6`, `D7`, `R501A/B`) are already factory-populated per D25!
* Hardware: 4× `M2.5` `11.0 mm` **nylon** (non-conductive) standoffs + screws (tool-free finger-tight).
* Leave `JP1` as a bare 2-pad tweezer test point (DNP) and keep `J3`/`J5`/`U_ID` unpopulated.

---

## 5. First-Power Bench Bring-Up Checklist (Before Connecting Boiler / Pump)

Power the HAT on a bare Raspberry Pi via USB-C and verify these four steps in order:

1. **Rails & Diagnostic LEDs**:
   * Confirm Green `D2` (`+5V_HAT`), `D33` (`+V_DRV`), and `D34`/`D35` (1-Wire Edition) light cleanly.
   * Probe test pads: `TP1 (+5V_HAT) = 4.95–5.10 V` (direct D18 rail), `TP2 (+V_DRV) = 9.05–9.30 V`, `+3V3_ANA = 3.25–3.30 V`, `TP5 = AGND`.
2. **Populated `REL1` SMD & 1-Wire Short Protection Check**:
   * Drive `GPIO 25` HIGH while watchdog heartbeat is active — confirm Green `D7` lights (`~1.1 mA`) and `J4` pads show `~5.0 V` (`+5V_REL` to `REL1_OUT`). Briefly short `J4` Pin 1–2 through an ammeter and verify `Q11 + R501A||B` limits current cleanly to `~123 mA`.
   * *(1-Wire Edition)* Briefly short `1W-A VDD` to `GND` on `J6` — confirm `D34` goes dark while `D35` stays lit and `+5V_HAT` remains `> 4.9 V`.
3. **Hardware Watchdog & Fault LED Test**:
   * Drive a `20 Hz` square wave on `GPIO 24` (`WD_HB`) — confirm Green `D3` turns ON, Red `D36` turns OFF, `Q12` energizes `+5V_REL`, and `Q5` enables `PUMP1`.
   * Stop the `20 Hz` heartbeat — confirm `Q12` drops `+5V_REL` & `D7` after `~16.1 s`, then Green `D3` turns OFF, Red `D36` lights cleanly, `GPIO 20` (`WD_RB`) goes HIGH, and `PUMP1` is forced safe after `~18.4 s`.
4. **Pt1000 BIST & Accuracy Check**:
   * Run 2-point BIST + 5 s 1-pt calibration (`Q2` `1.00 kΩ` `R102` & `Q3` `2.00 kΩ` `R103A+B` from single-reel Basic `C17513`).
   * Connect a precision `1.000 kΩ` test resistor across `J6` `PT1+`/`PT1-` (and each mux channel on All-Pt1000) and verify `0.00 °C` reading against a `MAX31865` reference on the `2×` prototype.

---

## 6. Next Phase Roadmap — Raspberry Pi Software / CoSTOS HAL Driver

Once boards are ordered or on the bench, the next engineering phase is implementing the Raspberry Pi CoSTOS HAT driver matching this exact GPIO map:

* **Switched-Mux Pt1000 Acquisition & 2-Point BIST Calibration**: Drive `GPIO 17` (`DUTY`), `GPIO 27` (`PT_SEL`), `GPIO 22` (`REF_LO`), `GPIO 23` (`REF_HI`), plus the 3 mux select lines on the All-Pt1000 Edition.
* **Hardware Watchdog Heartbeat Daemon**: Generate the `20 Hz` pulse on `GPIO 24` (`WD_HB`) and monitor `GPIO 25` (`WD_RB`) for fault confirmation.
* **1-Wire Dual-Bus Reader** *(1-Wire Edition)*: Kernel `w1-gpio` overlays on `GPIO 4` (`1W-A`) and `GPIO 26` (`1W-B`).
* **Pump Control & Feedback Loop**: Hardware PWM on `GPIO 18` (`PWM1`), `0–10 V` feedback reading on `GPIO 6` (`FB1`), and readback supervision on `GPIO 12` (`RB1`).
