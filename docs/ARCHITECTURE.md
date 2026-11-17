# OSCoST architecture

Status: **draft for discussion**. Nothing here is implemented yet.

OSCoST is an open-source controller for solar thermal systems. It runs on a
Linux single-board computer (Raspberry Pi or Radxa Rock 5C), is written in
Rust, and is meant to **replace** a commercial controller. The reference
system is the one it replaces: a RESOL DeltaSol BX Plus that is read today by
[vbus2influx](https://github.com/isarrider/vbus2influx).

This document covers what OSCoST has to do, how the hardware and software are
split up, how safety works, and how to move from the RESOL controller to
OSCoST without risking the system.

---

## 1. Goals and non-goals

### Goals

- Take over everything the DeltaSol BX Plus does in this installation: ΔT
  pump control with speed control, store limits, collector protection
  functions and heat quantity metering.
- Be **fail-safe**. A software crash, hang, power loss or sensor fault must
  never leave a pump running or switched off in a dangerous state.
- Keep the control logic **pure and testable**: no I/O in the control code,
  so it can run against a simulator, against recorded data and in CI.
- Be **observable**: every input, decision and output is exported (Influx
  line protocol / VictoriaMetrics, MQTT, HTTP), so the existing Grafana
  dashboards keep working.
- Make the configuration **declarative** (TOML): sensors, outputs and
  functions are wired up in config, not in code.

### Non-goals (for now)

- Space-heating circuits, mixers, heat pump or boiler demand. The BX Plus
  can do these. OSCoST starts with the solar side only.
- A display and buttons on the device. The UI is a web page, plus Home
  Assistant over MQTT.
- Certification. OSCoST is a hobby project. Mains wiring is done by a
  qualified electrician, and the hardware safety devices described in
  section 4 are not optional.

---

## 2. What the controller replaces

The DeltaSol BX Plus has 8 Pt1000/Pt500/KTY sensor inputs (plus one impulse
input for a V40 flowmeter), 4 semiconductor relays for speed control, 1
potential-free relay and 2 PWM outputs (512 Hz, about 11 V, switchable to
0–10 V).

The vbus2influx data shows which of these are used here. Before
implementation starts, that list has to be written down in
[`docs/installation.md`](installation.md) (still to be written): sensor
positions (collector, store bottom, store top, return, …), which relay
drives which pump or valve, and the pump models and their PWM profiles.
This is the **acceptance spec**. OSCoST is done when it reproduces the BX
Plus behaviour for this installation.

---

## 3. System overview

```
             ┌────────────────────── Linux SBC (Pi / Rock 5C) ─────────────────────┐
             │                                                                      │
 Pt1000 ───► │  sensors task ──► ┌──────────────┐    ┌──────────────┐               │
 sensors     │  (SPI / I²C)      │ control core │──► │  safety      │──► outputs ───┼──► SSR / relay ──► pumps, valves (230 V)
             │                   │ (pure Rust)  │    │  supervisor  │    task       ├──► PWM (level-shifted) ──► HE pump
 V40 pulses ►│  pulse counter ─► └──────────────┘    └──────────────┘               │
             │                          │                    │                     │
             │                          ▼                    ▼                     │
             │                    state + events ───► telemetry: HTTP / MQTT / Influx
             │                                                                      │
             │  systemd watchdog ◄── heartbeat           hardware watchdog (/dev/watchdog)
             └──────────────────────────────────────────────────────────────────────┘
                     │
                     └── outside the SBC: independent overtemperature cut-out,
                         relay outputs default to OFF without a heartbeat
```

The control loop runs at **1 Hz**. Solar thermal systems are slow, so 1 Hz
is plenty, and a fixed rate keeps timing behaviour easy to reason about.

---

## 4. Safety

Safety comes in layers. Each layer assumes the one above it can fail.

### 4.1 Hardware layer (independent of software)

| Measure | Why |
|---|---|
| **Outputs default to OFF**: relay/SSR boards that switch off when the GPIO floats, plus pull-downs | A booting, crashed or unpowered SBC must not switch pumps on. |
| **Output enable via an external watchdog**: a charge-pump or retriggerable monostable that only enables the output stage while the SBC toggles a heartbeat GPIO | Covers a hung kernel or a GPIO stuck high, which the internal watchdog can miss. |
| **SoC hardware watchdog** (`/dev/watchdog`) | Reboots a hung system. |
| **Independent overtemperature cut-out** on the store (capillary thermostat in series with the solar pump) | Last line of defence that does not depend on OSCoST at all. Many systems already have one. Check. |
| **Manual changeover switch** RESOL ↔ OSCoST per output (during migration) | Lets you fall back to the RESOL controller in seconds. See section 8. |

### 4.2 Software layer

The **safety supervisor** is a separate module that sits between the
control core and the outputs. It can only **reduce** what the core asks for
(force OFF, cap speed). It can never switch something on. It enforces:

- **Sensor plausibility**: Pt1000 open circuit or short circuit, values
  outside the physical range, a rate of change that is too high, stale
  readings. A faulty sensor counts as *unknown*, never as "cold".
- **Store maximum** (for example 60–85 °C, configurable) and an **emergency
  store shutdown** (for example 95 °C, not configurable above a hard limit).
- **Collector emergency shutdown**: above about 130 °C the solar pump is
  forced OFF. Pumping into a stagnating collector can flash the fluid to
  steam and damage the system. This is the main case where "pump ON" is the
  dangerous state, which is why the safe state is defined per output and
  not as "everything off".
- **Output-specific safe states** from config (normally OFF).
- **Minimum on/off times** and **switching rate limits**, to protect relays
  and pumps.

If the supervisor itself panics, the process exits, the heartbeat stops and
the hardware layer turns everything off.

### 4.3 Process layer

- systemd service with `WatchdogSec=`. The main loop calls `sd_notify` only
  after a complete control cycle has succeeded (sensors read → decision →
  outputs written).
- `panic = "abort"` in release builds, so a panic in any task ends the
  process, and systemd and the watchdog take over.
- On start, outputs stay OFF until a full set of valid sensor readings is
  available.

---

## 5. Hardware

### 5.1 Temperature measurement

The existing Pt1000 sensors are reused.

- **Recommended: MAX31865** RTD-to-digital converter, one per channel, on SPI.
  It measures ratiometrically against a reference resistor (430 Ω for
  Pt100 boards, **4.3 kΩ for Pt1000**, so check the board), has built-in
  open/short fault detection, and is cheap as breakout boards. 8 channels =
  8 chip selects (GPIO chip selects or a decoder).
- Alternative: a multi-channel ADC (ADS1115/ADS1220) with a reference
  resistor divider. Fewer chips, but you have to build fault detection and
  calibration yourself.
- Collector sensor cables are long and outdoors, so add surge protection on
  that input (RESOL sells an SP10 for exactly this).
- Calibration: a per-channel offset in config, checked against the RESOL
  readings during shadow mode (section 8).

### 5.2 Switching outputs

- 230 V pumps and valves: DIN-rail **solid-state relays** (zero-crossing) or
  mechanical relay modules with suitable ratings and a fuse per output, in a
  proper enclosure. Speed control by switching mains in bursts (the way the
  BX Plus semiconductor relays do it) only applies to old standard pumps.
  Modern high-efficiency pumps are controlled over PWM instead.
- **PWM for high-efficiency pumps**: the SoC's hardware PWM through an
  opto/transistor stage to the pump's signal level (open collector, about
  10–15 V depending on the pump). Supported **PWM profiles** in config:
  *solar* (higher duty = faster, 0 % = stop) and *heating* (inverted), plus
  frequency. The RESOL controller uses 512 Hz. The pump's datasheet decides.
- Optional 0–10 V output via a DAC or PWM low-pass, if a pump needs it.

### 5.3 Other inputs

- **V40 flowmeter** impulse input: GPIO with interrupt and debounce, for
  heat quantity metering.
- Optional: CS10 irradiation sensor, Grundfos Direct Sensors (digital), later.

### 5.4 SBC portability

`rppal`, used in vbus2influx, only supports the Raspberry Pi. To run on both
the Pi and the Rock 5C, the Linux backend uses generic kernel interfaces
only:

| Function | Kernel interface |
|---|---|
| GPIO | GPIO character device (`/dev/gpiochipN`, libgpiod / `gpio-cdev`) |
| SPI | `spidev` |
| PWM | sysfs PWM (`/sys/class/pwm`) |
| Watchdog | `/dev/watchdog` |

Pin and bus assignments live in a per-board config section, not in code.

---

## 6. Software

### 6.1 Workspace layout

```
oscost/
├─ crates/
│  ├─ oscost-core/       # control logic: pure, no I/O, no async, no clock (time is an input)
│  ├─ oscost-safety/     # safety supervisor: pure, can only reduce outputs
│  ├─ oscost-hal/        # traits: TemperatureInput, SwitchOutput, PwmOutput, PulseInput, Watchdog
│  ├─ oscost-hw-linux/   # HAL implementation: gpio-cdev, spidev, sysfs PWM, MAX31865 driver
│  ├─ oscost-sim/        # thermal model of collector + store, used for tests and dry runs
│  └─ oscostd/           # daemon: config, scheduler, tasks, HTTP/MQTT/Influx, systemd integration
└─ docs/
```

`oscost-core` and `oscost-safety` contain everything that decides what the
pumps do. Because they are pure functions of `(config, inputs, time,
previous state) → (outputs, new state, events)`, they can be:

- unit- and property-tested (for example "the supervisor never switches
  anything on", "the collector emergency shutdown always wins"),
- replayed against **recorded vbus2influx data** to compare decisions with
  the real RESOL relay states,
- run against `oscost-sim` in CI, including faults (sensor open circuit,
  stuck pump, overheating store).

### 6.2 Control functions (first version)

Each function is a small state machine wired to sensors and outputs in
config:

| Function | Behaviour |
|---|---|
| **ΔT control** | Pump ON when T(collector) − T(store bottom) ≥ ΔT_on (for example 6 K), OFF when ≤ ΔT_off (for example 4 K). Hysteresis plus minimum run time. |
| **Speed control** | While on, a PI controller drives the PWM duty to keep ΔT around a setpoint (for example 10 K), between min and max speed. Starts at 100 % for a short purge/kick. |
| **Store maximum** | Stops loading at T(store) ≥ T_max. Emergency stop at the hard limit (enforced by the supervisor as well). |
| **Collector emergency shutdown** | Enforced in the supervisor (section 4.2). |
| **Collector cooling / recooling** | Optional: lets the store take extra heat to keep the collector out of stagnation, and cools the store back down at night. |
| **Tube collector function** | Optional: short periodic pump runs so a sensor in an evacuated tube collector sees the real temperature. |
| **Frost protection** | Optional. Only needed without glycol. |
| **Heat quantity** | From V40 pulses (or a configured fixed flow) × ΔT(flow, return) × fluid properties (glycol percentage in config). Persisted. |
| **Multi-store priority** | Later, if the installation uses it (BX Plus supports 2–3 stores). |

### 6.3 Runtime

- `tokio`, but with one **deterministic control task** at 1 Hz. Sensor
  reading, telemetry and the HTTP/MQTT servers are separate tasks, so a slow
  network can never delay a control cycle. The control task takes the latest
  sensor snapshot, and a snapshot older than a configured limit counts as a
  sensor fault.
- **Configuration**: TOML (figment, as in vbus2influx), fully validated at
  start-up. Invalid config means the daemon refuses to start, so outputs
  stay OFF. Hot reload is not planned for the first version.
- **Persistent state** (heat quantity counters, operating hours): small file
  written atomically, at most every few minutes, to spare the SD card or eMMC.
- **Manual mode**: per output OFF / AUTO / ON (with timeout), through the API.
  The safety supervisor still applies in manual mode.

### 6.4 Interfaces

| Interface | Purpose |
|---|---|
| **HTTP** (axum) | Status page, JSON API, manual mode. Read-only without authentication. Writes need a token. |
| **Influx line protocol** | Same idea as vbus2influx, so Grafana and VictoriaMetrics keep working. Choose field names so existing dashboards need little rework. |
| **MQTT** with Home Assistant discovery | Sensors, outputs and alarms appear in HA automatically. Writes (manual mode) are optional and off by default. |
| **Prometheus `/metrics`** | Optional, cheap to add. |
| **Logs** | `tracing` to journald. Every state change and every safety intervention is logged as a structured event. |

Not planned: emulating VBus to be read by other RESOL tools.

### 6.5 Deployment

- A **native systemd service** is the primary target, not Docker. The
  watchdog integration, start ordering and direct device access are simpler
  that way, and a container runtime is one more thing that can fail.
- Cross-compiled static binaries (aarch64, armv7) built by GitHub Actions,
  plus a `.deb` package or tarball with a systemd unit.
- A Docker image can come later for the simulator and for dry runs.

---

## 7. Testing strategy

1. **Unit and property tests** on `oscost-core` and `oscost-safety`.
2. **Replay tests**: feed recorded VBus data (temperatures plus RESOL relay
   states) through the core, and report where OSCoST would have decided
   differently. This is the main tool for checking the behaviour against the
   reference controller.
3. **Simulation tests** with `oscost-sim`: sunny day, cloudy day, store
   overheating, stagnation, sensor faults, stuck pump.
4. **Hardware-in-the-loop on the bench**: SBC plus sensor boards with
   resistors (or a decade box) in place of the Pt1000 sensors, LEDs or lamps
   in place of the pumps. Test the watchdog by killing the process and
   unplugging the SBC.

---

## 8. Migration from the DeltaSol BX Plus

| Phase | What runs | Exit criteria |
|---|---|---|
| **0. Bench** | OSCoST on the bench with simulated or resistor sensors | All tests green, watchdog and output-default-OFF verified |
| **1. Shadow mode** | RESOL controls the system. OSCoST reads its **own** sensors (second set of sensors, or parallel measurement where possible) and computes decisions **without outputs connected**. vbus2influx keeps logging the RESOL side. | Weeks of data across sunny/cloudy/hot days. Temperature readings match RESOL within tolerance. Decisions match, or every difference is understood. |
| **2. Switchable** | Changeover switch per output: RESOL or OSCoST. OSCoST drives the outputs on chosen days, with RESOL one switch flip away. | Runs through hot periods (store max, collector shutdown actually triggered) without intervention |
| **3. Replacement** | OSCoST only. RESOL kept as a spare. | — |

Shadow mode needs its own temperature readings, because the Pt1000 sensors
can't be connected to two measuring devices at once without affecting both
readings. Options: extra sensors in the same sensor pockets, or use the RESOL
values over VBus for the decisions in phase 1 and only add OSCoST's own
measurement in phase 2. To be decided.

---

## 9. Milestones

1. `oscost-core` + `oscost-safety` with ΔT control, speed control, store max
   and collector emergency shutdown. Tests and a replay tool for vbus2influx
   data.
2. `oscost-sim` and simulation tests in CI.
3. HAL + Linux backend: MAX31865, GPIO outputs, PWM, watchdog. Bench setup.
4. `oscostd`: config, scheduler, systemd, HTTP status, Influx output.
5. MQTT + Home Assistant discovery, manual mode.
6. Shadow mode on the real system.
7. Heat quantity, optional functions (cooling, tube collector, frost).
8. Switch over.

---

## 10. Open questions

- **Installation details** for `docs/installation.md`: which sensors and
  relays the BX Plus uses here, which pumps (standard or high-efficiency
  with PWM, which PWM profile), single or multi-store, flat-plate or
  evacuated tube collectors, glycol or not, V40 flowmeter present or not.
- Is there already an independent store overtemperature cut-out?
- Shadow mode: second set of sensors, or use the RESOL values over VBus at
  first?
- Raspberry Pi or Rock 5C as the production board? (The design supports
  both. The answer decides the pin map and the HAT/board layout.)
- Off-the-shelf boards (MAX31865 breakouts, DIN-rail SSRs) or a custom HAT?
  Breakouts first is the faster way to the bench milestone.
- Do any values have to be compatible with existing vbus2influx dashboards
  (measurement and field names)?
