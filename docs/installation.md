# Reference installation

This is the system OSCoST is built to control first. It is the **acceptance
spec**: OSCoST is ready to replace the existing controller when it
reproduces its behaviour for this installation (see
[Migration](ARCHITECTURE.md#9-migration-from-the-deltasol-bx-plus)).

Status: **incomplete**. Open points are listed at the end.

## Controller being replaced

- RESOL DeltaSol BX Plus, read over VBus by
  [vbus2influx](https://github.com/isarrider/vbus2influx).
- A **Raspberry Pi 5** already sits next to it and runs vbus2influx.
  OSCoST runs on this Pi (with the HAT), so it needs the 5 A supply
  (HDR-60-5) and `PSU_MAX_CURRENT=5000` (see [HAT.md](HAT.md)).
- **VBus connection today:** a self-built level shifter (voltage divider
  and two transistors, see the vbus2influx README) on the Pi's GPIO UART:
  VBus → RX on GPIO15 (header pin 10), read as `/dev/ttyAMA0` at 9600
  baud. vbus2influx runs in Docker, writes to VictoriaMetrics and serves
  the latest values as JSON over HTTP (`GET /`, port 11110).

## Sensors and outputs in use

From the existing Grafana dashboard on the vbus2influx data. The input
numbers are the vbus2influx field numbers (`temperature_01` …), assumed to
be BX Plus inputs S1–S8.

| Input | Name in the dashboard | Position | Role |
|---|---|---|---|
| S1 | Temp_1_Kollektor | Collector | **Control**: pump start/stop (ΔT), collector protection |
| S2 | Temp_2_Boiler_u | Store, bottom | **Control**: ΔT reference, store maximum |
| S3 | Temp_3_Boiler_o | Store, top | Display |
| S4 | Temp_4_Vorlauf | Solar flow (collector → store), at the store | Display; heat quantity once a flow value exists |
| S5 | Temp_5_Rücklauf | Solar return (store → collector), at the store | Display; heat quantity once a flow value exists |
| S6 | nach Heizung / vor Boiler | Heating circuit: after the heat generator, before the store | Measurement only |
| S7 | nach Boiler / vor Haus | Heating circuit: after the store, before the house | Measurement only |
| S8 | nach Haus / vor Heizung | Heating circuit: after the house, back to the heat generator | Measurement only |

- **All eight sensors are Pt1000, each on its own 2-wire cable.**
- **Plan for OSCoST** (decided): S1 (collector) stays Pt1000 on the
  HAT's MAX31865: only 2 wires go to the roof, and the collector gets
  hotter than a DS18x20's 125 °C. S2–S8 are replaced by **DS18B20 probes**
  (6 mm stainless, they fit the ½" sleeves), wired as **two daisy-chained
  3-wire cables** instead of one cable per sensor, because 1-Wire works
  reliably as a line, not as a star:
  - **Bus A** (HAT 1W-A, GPIO4): along the store, S2 → S3 → S4 → S5.
  - **Bus B** (HAT 1W-B, GPIO17): along the heating pipes, S6 → S7 → S8.
  - The new sensors read slightly differently from the old Pt1000s (about
    ±0.5 K, different seat in the sleeve). Per-sensor calibration offsets,
    set against the BX Plus during shadow mode, keep the long-term charts
    continuous.
- The heat generator ("Heizung") is a **heat pump** today; it was a gas
  boiler when the system was installed. S6–S8 are only measured, nothing
  acts on them.

| Output | vbus2influx field | Use |
|---|---|---|
| Relay 1 | `relay_01` | Solar pump, mains |
| PWM A | `PWM_0_10V_A` | Solar pump, speed (PWM2) |

No other relays or outputs are in use, which matches the HAT rev A
(REL1 + PUMP1).

## Solar pump

| | |
|---|---|
| Pump | **Wilo Yonos PARA ST 15/7-50/iPWM2** (from the type plate) |
| Control | External PWM, profile **PWM2 (solar)** |
| Signal cable | 3 cores: **1 brown = PWM input**, **2 blue or grey = signal ground**, **3 black = PWM output (feedback from the pump)** |
| Input signal | 100–5000 Hz (1000 Hz nominal), high level from about 4 V; max. 15 V for Yonos PARA (24 V on the newer Para series). 12 V fits both. |
| Feedback output | open collector, 75 Hz, duty cycle = pump status (see below) |
| Cable break | Pump stops (active stop mode) |

Earlier versions of this page listed a Yonos PARA ST 15/7.0-PWM2. The type
plate says **iPWM2**: the same solar profile, plus a feedback output on a
third wire.

### PWM2 input characteristic

| PWM input | Pump |
|---|---|
| < 7 % | active stop mode (also on cable break) |
| 7–15 % | minimum speed while running |
| 12–15 % | starting band: the pump starts from standby only above this |
| 15–95 % | speed rises linearly from minimum to maximum |
| > 95 % | maximum speed |

### Feedback output (black wire)

Open collector on the pump side (470 Ω in series), high level 3–25 V
supplied by the controller's pull-up, low ≤ 1 V, at most 1 mA in normal
operation. 75 Hz, duty cycle accurate to ±1 %. The duty cycle is the share
of time the line is high (an unpowered pump leaves it high: 100 %).

| Feedback duty | Meaning |
|---|---|
| 0 % | feedback interface damaged |
| 2 % | active stop mode, ready to start |
| 5–75 % | running; value is flow or power information |
| 80 % | running, but not at optimal performance (warning: motor overload, module over temperature) |
| 85 % | stopped by a temporary error (motor overload, over/under voltage, module over temperature); restarts by itself |
| 90 % | stopped by a temporary error (over current, over speed, turbine mode); restarts by itself |
| 95 % | stopped by a permanent failure (blocked rotor, driver fault, motor windings) |
| 100 % | pump has no power, or feedback interface damaged |

Source: Wilo, *Wilo-Para iPWM Communication Protocol*, technical guide V1.01.
Dry running and the deblocking routine show up as 5 % while running. Wilo
documents this table for its Para series; the Yonos PARA iPWM uses the same
VDMA 24224 interface, but **verify the values on the real pump** (2 % when
stopped, 5–75 % when running) before OSCoST relies on them.

### Consequences for OSCoST

- OSCoST preset **"Wilo PWM2"**: stop = 0 %, start at ≥ 20 %, regulate
  between 15 % (minimum) and 100 % (maximum). The 7–15 % band, where
  start/stop depends on the previous state, is never used.
- Output stage: the driver board or optocoupler module from
  [Hardware needed](HARDWARE.md#pwm-pump-output). 12 V is inside the input
  range (max. 15 V).
- Frequency: 500 Hz (the RESOL controller uses 512 Hz).
- **The feedback output gives OSCoST real pump monitoring**: confirmation
  that a stop really stopped the pump (2 %), that it runs when commanded
  (5–75 %), warnings (80 %), and errors (85–95 %), plus "no power" (100 %),
  which also detects a failed mains relay. The driver board has the input
  for it (J2 FB, see [Hardware needed](HARDWARE.md#checking-the-feedback-signal)).
- **To do on the real pump**: confirm the table with the multimeter check
  in the hardware guide (standby about 0.4 V, running in between, no
  power about 3.3 V).

## Store

**TWL Hygiene-Kombispeicher KER-2 800** (art. no. KER2.0800): one 800 l
combination store with a stainless corrugated-tube coil for fresh domestic
hot water in the centre and two smooth-tube heat-exchanger coils. Redrawn
from the manufacturer's dimension drawing; the web interface will draw the
store on its overview page from the same data (see
[ARCHITECTURE 7.1](ARCHITECTURE.md#71-pages)), generated here by
`python3 tools/docs/store_svg.py > docs/img/store-reference.svg`.

![Store of the reference installation](img/store-reference.svg)

| | |
|---|---|
| Vessel | 800 l, Ø 790 mm (without insulation), 1845 mm high incl. the top flange, on a Ø 600 × 125 mm stand ring; 231 kg empty |
| Store water | max. **95 °C**, max. 4.5 bar (test pressure 6 bar) |
| Fresh-water coil | stainless 1.4404, 5.8 m², 29.2 l, max. 10 bar / 110 °C; cold (KW) and hot water (WW) ¾" at the top |
| Upper coil | 1.8 m², 10.4 l, max. 16 bar / 110 °C, water/glycol; 1" at 1380 and 1060 mm |
| Lower coil | 2.6 m², 15.1 l, max. 16 bar / 110 °C, water/glycol; 1" at 810 and 300 mm |
| Store-water connections | 1½" at 1560, 970, 660, 170 mm (right) and 905 mm (left) |
| ½" sleeves | 1280, 455 mm (right); 1270, 560 mm (left) |

- The store's 95 °C limit bounds OSCoST's store maximum and its emergency
  store shutdown: both have to stay below 95 °C.
- **Lower coil: solar circuit**, in at 810 mm (top connection), out at
  300 mm (bottom), so S4 (solar flow) and S5 (solar return) measure the
  coil's inlet and outlet.
- **Upper coil: heat pump** heating water, in at 1060 mm (bottom
  connection), out at 1380 mm (top), on its way to the house: S6 measures
  the coil's inlet, S7 its outlet.
- **S2 (store bottom)** sits in the ½" sleeve at 560 mm (left), **S3 (store
  top)** in the ½" sleeve at 1270 mm (left).

## Collector

**2 × Solardirekt24 EUROTHERM-SOLAR-PRO 30R**: heat-pipe evacuated tube
collectors with 30 tubes each. 2 tubes are broken and removed, so 58 of 60
tubes are in place.

| | per collector | installation |
|---|---|---|
| Tubes | 30, Ø 58 mm, borosilicate glass | 58 in place |
| Gross area | 4.58 m² | 9.16 m² |
| Output (data sheet, 1000 W/m², ΔT 0 / 30 / 50 K) | 2037 / 1853 / 1682 W | about 3.9 / 3.6 / 3.3 kW with 58 tubes |
| Size (H × W × D) | 1980 × 2370 × 125 mm, 103 kg | |
| Max. working temperature | 95 °C | |
| **Stagnation temperature** | **208 °C** | |
| Connections | 22 mm copper | |
| Pressure drop | 78 Pa at 120 l/h | |

- **Heat pipes:** each tube carries its heat to a condenser in the
  manifold; the collector sensor sits in a sleeve in that manifold. The
  manifold therefore heats up without flow, so the "tube collector
  function" (short pump runs to bring heat to the sensor) is **off** in the
  BX Plus, as expected.
- **Daily pump kick:** the BX Plus runs the pump once a day for a short
  pulse so it doesn't seize. OSCoST does the same (anti-seize run,
  configurable time and duration).
- **208 °C stagnation:** far above a DS18x20's range, so S1 stays Pt1000
  (as planned), and OSCoST's collector emergency shutdown and cooling
  functions matter on hot summer days with a full store.
- A broken tube just lowers the output; a heat pipe has no fluid
  connection to the solar circuit, so there is no leak.

## Solar fluid

**SOLTHERM 5P (F)** (Alpha Thermotec): ready-mixed 1,2-propylene glycol and
demineralised water with corrosion inhibitors, frost protection to −32 °C.

| Property (20 °C) | Value |
|---|---|
| Density | 1.046 kg/l |
| Specific heat | 3.49 kJ/(kg·K) |
| Heat per litre and kelvin (ρ · c) | ≈ 3.65 kJ/(l·K), about 87 % of water (4.18) |
| Dynamic viscosity | 6.2 mPa·s |
| Boiling point at 1013 mbar | > 102 °C (higher under system pressure) |

- OSCoST's heat quantity uses this fluid (propylene glycol, −32 °C mix);
  its density and specific heat change with temperature, so the fluid
  type is a setting and the calculation uses temperature-dependent values.
- Frost protection to −32 °C: no pump runs for frost protection are
  needed.
- Maintenance from the manufacturer's instructions: check frost
  protection and pH at least once a year.

## Flow measurement

- **No pulse flowmeter** in the solar circuit, so the HAT needs no flow
  input.
- OSCoST estimates the flow from the pump speed (PWM duty) with a
  calibration table (flow at a few duty values, read once from a flow
  indicator or worked out from a measured heat output), and calculates
  the heat output from S4/S5 with it. The web interface marks these
  values as estimated.

## Overtemperature protection

- **No independent overtemperature cut-out**, and none planned. In
  practice the store doesn't reach its 95 °C limit: the household uses
  enough hot water, and during holidays part of the collector is covered.
- Protection therefore rests on OSCoST's own layers: store maximum and
  emergency store shutdown below 95 °C, collector emergency shutdown, and
  the hardware watchdog that stops the pump through both the SSR and the
  PWM (HAT D8). A mechanical cut-out can still be added to the 230 V side
  later.
- Covering the collector is the right holiday measure for heat pipes:
  evacuated tubes lose almost no heat at night, so the "store recooling
  through the collector" function of flat-plate systems would barely work
  here.

## Integrations

- VictoriaMetrics: yes (the existing instance vbus2influx writes to).
- MQTT / Home Assistant: **not used**. It stays an option in OSCoST,
  disabled by default.

## Open points

- Flow calibration: is there a float-type flow indicator to read the flow at a few pump speeds?
