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
- Be **observable**: every input, decision and output is pushed to
  **VictoriaMetrics** once per second, and buffered locally while the
  database is unreachable, so no data is lost (section 6.5). MQTT and the
  HTTP API expose the live state too.
- Make **everything configurable in the web interface**: status, sensors,
  outputs, control functions, integrations and users. No config files to
  edit by hand. Sensors, outputs and functions are wired up in config, not
  in code, and the web interface is the editor for that config (section 7).

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
[`docs/installation.md`](installation.md) (started, still incomplete): sensor
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
             │                    state + events ───► telemetry: VictoriaMetrics / MQTT / HTTP
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
| **Manual changeover switch** RESOL ↔ OSCoST per output (during migration) | Lets you fall back to the RESOL controller in seconds. See section 9. |

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

Two sensor types are supported, and can be mixed freely: **Pt1000** (the
existing RESOL sensors) and **DS18x20** 1-Wire sensors. Both implement the
same `TemperatureInput` trait, so the control core doesn't know or care
which type a reading came from. A reading is always `Ok(°C)` or a typed
fault (`OpenCircuit`, `ShortCircuit`, `OutOfRange`, `Stale`, `CrcError`,
`Missing`, …), never a magic number.

| | Pt1000 | DS18x20 |
|---|---|---|
| Principle | Platinum resistor, 1000 Ω at 0 °C, +3.85 Ω/K | Digital sensor with its own ADC, 1-Wire bus |
| Range | −50 … +250 °C in practice (sensor and cable decide) | **−55 … +125 °C** |
| Use for | **Collector** (stagnation can exceed 200 °C), anything hot | Store, return, heating circuits, room, outdoor |
| Wiring | One input (2 wires) per sensor | Many sensors on one bus (3 wires), each with a unique 64-bit ID |
| Interface | MAX31865 per channel, on SPI | Kernel `w1` bus via GPIO, or a DS2482 I²C bridge |
| Identification | By input number | By ROM ID, found with a bus scan |

The controller enforces the range: a function role has a maximum expected
temperature (the collector up to 250 °C, for example), and the web interface
refuses to assign a sensor whose range is too small for that role. A
DS18x20 can't be the collector sensor.

#### Pt1000

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
  readings during shadow mode (section 9). With 2-wire sensors the cable
  resistance adds to the reading (roughly 0.25 K for 20 m of 0.75 mm²), and
  the offset compensates for that.
- Faults: the MAX31865 detects open and short circuits directly. Values
  outside the plausible range count as faults too.

#### DS18x20 (1-Wire)

- **Supported chips**: the whole family — DS18S20/DS1820 (9-bit, family
  code `10`), DS18B20 (9–12-bit, `28`) and DS1822 (`22`). The family code
  in the ROM ID tells the driver which chip it is talking to.
- **Bus master**, choose one per bus:
  - **Kernel `w1-gpio`** on a GPIO pin with a 4.7 kΩ pull-up (`dtoverlay=w1-gpio`
    on the Pi, the equivalent overlay on the Rock 5C). Simple, no extra
    chip. OSCoST reads `/sys/bus/w1/devices/<id>/temperature`.
  - **DS2482-100/-800** I²C-to-1-Wire bridge (1 or 8 buses). Active pull-up
    and proper timing in hardware, so it copes much better with long cables
    and many sensors. Recommended for anything beyond a few metres. OSCoST
    talks to it directly over `/dev/i2c-N`.
- **Powered mode only** (VDD connected). Parasite power is not supported:
  it is unreliable at high temperatures and with several sensors converting
  at once.
- **Timing**: a 12-bit conversion takes up to 750 ms per sensor. Sensors
  are read in a separate task with **one simultaneous conversion for all
  sensors on a bus** ("Convert T" to all, wait once, then read each), so
  the whole bus refreshes about once per second regardless of the number of
  sensors. 11-bit (0.125 K, 375 ms) is the default; that is more than
  precise enough and halves the conversion time. The control loop uses the
  latest reading, and a reading older than a few seconds counts as `Stale`.
- **Faults** specific to 1-Wire, all treated as sensor faults:
  - CRC error on the scratchpad (one retry, then fault).
  - Sensor missing from the bus (cable, connector).
  - **85.0 °C power-on value**: the DS18x20 reports exactly 85 °C if it was
    reset and never converted (typically a power glitch). OSCoST checks the
    scratchpad state and treats this reading as a fault instead of a real
    85 °C. This matters, because 85 °C is a realistic store temperature.
  - −127 °C / all bits set: bus read failure.
- Clone chips are common and sometimes behave differently (conversion
  time, power-on value). The bus scan shows the chip type, and the driver
  is tested against a few known clones.

### 5.2 Switching outputs

- 230 V pumps and valves: DIN-rail **solid-state relays** (zero-crossing) or
  mechanical relay modules with suitable ratings and a fuse per output, in a
  proper enclosure. Speed control by switching mains in bursts (the way the
  BX Plus semiconductor relays do it) only applies to old standard pumps.
  Modern high-efficiency pumps are controlled over PWM instead.
- **PWM for high-efficiency pumps**: see 5.3.
- Optional 0–10 V output via a DAC or PWM low-pass, if a pump needs it.

### 5.3 PWM pump outputs

High-efficiency circulators (Grundfos UPM3, Wilo Yonos PARA / Para iPWM and
similar) get mains power **and** a low-voltage PWM signal that sets the
speed. Most also send a PWM feedback signal back.

#### What the pump expects

| | Grundfos UPM3 | Wilo Yonos PARA / Para iPWM |
|---|---|---|
| Input | Optocoupler in the pump, driven by the controller | Same |
| High level | 4–24 V, < 10 mA | 4–15 V (Yonos PARA), up to 24 V on newer iPWM pumps; about 3.5–10 mA |
| Low level | < 1 V | ≤ 1 V |
| Frequency | 100–4000 Hz | 100–5000 Hz (1000 Hz nominal); some variants 100–1000 Hz |
| Edges | | rise/fall time ≤ T/500 (2 µs at 1 kHz) |
| Cable | | max. 3 m |
| Feedback | open collector, 75 Hz, duty encodes power or alarm | iPWM models: open collector on the black wire, 75 Hz, duty encodes status, flow/power, warnings and errors |

So the controller has to **drive** the input: actively source a few mA at
roughly 10–12 V, with clean, fast edges. A 3.3 V GPIO can do neither. The
pump's input is already isolated inside the pump, so the signal ground can
be shared with the controller.

#### Profiles

The duty cycle means opposite things depending on the profile set on the
pump:

- **Solar** (Grundfos *profile C*, Wilo *PWM2*): low duty = stop, higher
  duty = faster. **No signal or a broken cable = pump stops.**
- **Heating** (Grundfos *profile A*, Wilo *PWM1*): inverted. Low duty = full
  speed, high duty = stop. **No signal = full speed.**

Profiles are data in the config: breakpoints (stop below x %, min speed at
y %, max speed at z %, hysteresis band) with built-in presets for the common
pumps, plus inversion and frequency. Default frequency 500 Hz (inside every
range above, slow enough for clean edges over 3 m of cable). The pump
itself must be set to the matching profile; the setup wizard asks for it and
the feedback signal can confirm the pump reacts.

#### Output circuit (per pump)

Build instructions, parts lists and layouts for the practical options (a
TC4427 driver board at 12 V, the same board simplified to run from the
Pi's 5 V, or a ready-made optocoupler module) are in
[Hardware needed](HARDWARE.md#pwm-pump-output).

```
 3.3 V GPIO (HW PWM) ──► gate driver (e.g. MCP1402/TC4427, 12 V supply) ──► 100 Ω ──┬──► pump PWM in (brown)
                                                                                    TVS
 GND ───────────────────────────────────────────────────────────────────────────────┴──► signal GND (blue)
```

- **Hardware PWM** only, never software PWM: the timing must not depend on
  the Linux scheduler. Pi 4 and older: GPIO 18 (header pin 12), PWM0
  channel 0. Pi 5: GPIO 18 too, but the PWM is in the RP1 chip, channel 2.
  Rock 5C: header pin 13 (PWM14_M1), since its pin 12 has no PWM. The pin,
  PWM chip and channel are part of the per-board config.
- **Driver**: a small low-side MOSFET gate driver IC as level shifter. It
  accepts 3.3 V logic, outputs 0/12 V push-pull with edges far below a
  microsecond, and sources plenty of current. A plain transistor with a
  pull-up resistor also works but has slow, weak rising edges.
- **12 V supply**: a small isolated 5 V → 12 V DC/DC module, or one 12 V
  supply for the whole controller with a buck converter for the SBC.
- **Protection**: series resistor (current limit if the cable is shorted)
  and a TVS diode at the connector against ESD and induced spikes.
- Parts cost: a few euros per channel.
- Optional galvanic isolation (digital isolator before the driver) if the
  signal cable runs far or near mains; not required, because the pump input
  is isolated already.

#### Feedback input (per pump)

```
 pump PWM out (black, open collector) ──► 1 kΩ ──┬──► GPIO (input, edge events)
                                       10 kΩ to 3.3 V, clamp diodes / TVS
```

- Pull-up to 3.3 V on the controller side, so the pump's open collector
  pulls it low. Series resistor and clamping protect the GPIO.
- Read with GPIO edge events, which the kernel timestamps; at 75 Hz that
  measures the duty cycle to well under 1 %.
- Decoded per pump type. For the Grundfos UPM3: 95 % = standby (stopped by
  the PWM signal), 90 % = alarm, blocked, 85 % = alarm, electrical error,
  75 % = warning, 0–70 % = power consumption (1 W per %).
- This is how OSCoST detects a **stuck or failed pump** (alarm, or no power
  draw while it should run) and confirms that a commanded stop really
  stopped the pump.
- The feedback input is **optional per output** in the config (none /
  Wilo iPWM / Grundfos). With nothing connected, the board's pull-up holds
  the GPIO high, which would read as a constant 100 %; with feedback set
  to *none*, OSCoST ignores the input.
- **Pumps without feedback** (for example the Wilo Yonos PARA PWM with
  the 2-wire cable: only PWM in and ground) need another way to check
  the pump: a plausibility check on the temperatures (the collector should
  cool down and the store flow should warm up once the pump runs), the
  flowmeter if there is one, or measuring the pump's mains current. The
  feedback input stays optional per output.

#### Mains switching and safety

- The pump's mains supply still goes through a relay or SSR that is part of
  the safe-by-default output stage (section 4.1): if the heartbeat stops,
  the pump loses power, whatever the PWM output is doing. This matters
  because the **hardware PWM keeps running at its last duty cycle when the
  software crashes**, and with a heating profile a dead signal even means
  full speed.
- Speed and normal stops are done over PWM. The mains relay is the enable
  and the safety cut-off, switched rarely: high-efficiency pumps have a high
  inrush current and limited mains switching cycles (Wilo for example
  specifies a relay rated ≥ 8 A and at most 100 mains switchings per day for
  its Stratos PARA). OSCoST rate-limits mains switching per output.
- With a solar profile, a broken signal cable stops the pump, which is the
  safe direction for the collector circuit. With a heating profile, it runs
  at full speed; the relay is what stops it.

#### 0–10 V pumps

Some pumps take 0–10 V instead of PWM. Optional: an I²C DAC (e.g. MCP4725)
plus an op-amp with gain 3, or the PWM output through an RC filter and
op-amp. Not planned for the first hardware version.

### 5.4 Other inputs

- **V40 flowmeter** impulse input: GPIO with interrupt and debounce, for
  heat quantity metering.
- Optional: CS10 irradiation sensor, Grundfos Direct Sensors (digital), later.

### 5.5 SBC portability

`rppal`, used in vbus2influx, only supports the Raspberry Pi. To run on both
the Pi and the Rock 5C, the Linux backend uses generic kernel interfaces
only:

| Function | Kernel interface |
|---|---|
| GPIO | GPIO character device (`/dev/gpiochipN`, libgpiod / `gpio-cdev`) |
| SPI | `spidev` |
| I²C (DS2482) | `/dev/i2c-N` |
| 1-Wire (kernel master) | `/sys/bus/w1/` (`w1-gpio` + `w1_therm`) |
| PWM | sysfs PWM (`/sys/class/pwm`) |
| PWM feedback | GPIO edge events with kernel timestamps |
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
│  ├─ oscost-hw-linux/   # HAL implementation: gpio-cdev, spidev, i2c, sysfs PWM, w1; MAX31865, DS18x20, DS2482 drivers
│  ├─ oscost-sim/        # thermal model of collector + store, used for tests and dry runs
│  ├─ oscost-config/     # config schema, validation, migrations between schema versions, revision store
│  ├─ oscost-web/        # web interface: server-rendered pages (maud), htmx handlers, SSE streams
│  └─ oscostd/           # daemon: scheduler, tasks, HTTP API, MQTT, VictoriaMetrics push + buffer, systemd
├─ assets/               # vendored htmx, htmx SSE extension, uPlot, CSS, icons (embedded in the binary)
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
- **Configuration** is owned by the daemon and edited only through the web
  interface or its API (section 7). It is stored as a versioned document in
  `/var/lib/oscost/` (readable for backups, not meant for hand editing),
  fully validated before it is applied, and applied **live** at a control
  cycle boundary, without a restart. An invalid or missing config at start-up
  means outputs stay OFF and the web interface opens the setup wizard.
- **Persistent state** (heat quantity counters, operating hours): small file
  written atomically, at most every few minutes, to spare the SD card or eMMC.
- **Manual mode**: per output OFF / AUTO / ON (with timeout), through the API.
  The safety supervisor still applies in manual mode.

### 6.4 Interfaces

| Interface | Purpose |
|---|---|
| **Web interface + HTTP API** (axum) | Status, configuration, manual mode, history, events. See section 7. |
| **VictoriaMetrics** | All values pushed every second, with a local buffer for outages. See section 6.5. |
| **MQTT** with Home Assistant discovery | Sensors, outputs and alarms appear in HA automatically. Writes (manual mode) are optional and off by default. |
| **Logs** | `tracing` to journald. Every state change and every safety intervention is logged as a structured event. |

Not planned: emulating VBus to be read by other RESOL tools.

### 6.5 VictoriaMetrics push and buffering

VictoriaMetrics is the only time-series target. No InfluxDB support.

- **Every control cycle (1 Hz)** produces one sample set: all temperatures,
  output states and speeds, ΔT, heat output, heat quantity counters, active
  functions, sensor fault and safety intervention flags. Each sample carries
  the timestamp of the control cycle, not the time it was sent.
- **Protocol**: VictoriaMetrics' Prometheus import endpoint
  (`/api/v1/import/prometheus`), text format with explicit millisecond
  timestamps, optional basic auth or bearer token. One request per second in
  normal operation.
- **Metric names follow the vbus2influx scheme with the prefix `oscost`.**
  vbus2influx writes Influx line protocol with measurement `vbus2influx`
  and fields like `temperature_01`, without tags, which VictoriaMetrics
  stores as series named `vbus2influx_temperature_01` with no labels.
  OSCoST writes the same field names, without labels, under its own
  prefix: `oscost_temperature_01`.
  - Every sensor gets a **VBus channel number** in the web interface, so
    the collector sensor that was `S1` on the RESOL becomes
    `oscost_temperature_01`. Same for `relay_01` … `relay_05` (speed in %),
    `PWM_0_10V_A`/`_B`, `flow_rate_*`, `irradiation_10`, `pressure_*`.
    Units stay the same (°C, %).
  - Values the RESOL never had (ΔT, heat output, active function, fault and
    safety flags, buffer state) get new names under the same prefix, for
    example `oscost_delta_t`, `oscost_sensor_fault_01`.
  - A sensor with a fault is **not written** for that second (a gap in the
    chart), instead of writing a fake value.
  - The prefix is fixed at `oscost`, also after OSCoST has replaced the
    RESOL controller. That way vbus2influx and OSCoST never write to the
    same series, shadow mode needs no special setup, and the RESOL history
    stays under `vbus2influx_*`. Existing dashboards only need the prefix
    in their queries changed. To show old and new data in one chart, query
    both, for example `oscost_temperature_01 or vbus2influx_temperature_01`.
- **Buffering**: a sender task reads from a queue, so a slow or unreachable
  database never affects the control loop.
  - Samples go into an in-memory queue first. If a push fails, the queue
    keeps growing, and its content is written to disk in compressed (zstd)
    segments of about one minute in `/var/lib/oscost/buffer/`. This keeps SD
    card or eMMC writes low and survives a restart or power loss (at most the
    last minute is lost).
  - Size limit is configurable (for example 500 MB). At 1 Hz with about 30
    values that is weeks of outage. When full, the oldest segments are
    dropped and an event is logged.
  - When VictoriaMetrics is back, the current samples are sent first, so live
    dashboards recover immediately, then the backlog is sent oldest first in
    batches, rate-limited so it doesn't overload the database or the network.
    VictoriaMetrics accepts backfilled samples, so the gap fills in.
  - A segment is only deleted after VictoriaMetrics has confirmed it (HTTP
    2xx). A crash during sending means a few samples are sent twice, which
    VictoriaMetrics deduplicates (same series and timestamp).
- **Clock**: timestamps need correct time. A Raspberry Pi has no RTC and
  boots with a wrong clock until NTP syncs. Until the system clock is
  synchronised, samples are buffered with monotonic timestamps and converted
  once the clock is synced. Control itself doesn't depend on wall-clock time.
- **Status** in the web interface: connected / buffering, buffer size and
  age of the oldest buffered sample, last error. Long outages and a full
  buffer create an event (and an MQTT alarm).

### 6.6 Deployment

- A **native systemd service** is the primary target, not Docker. The
  watchdog integration, start ordering and direct device access are simpler
  that way, and a container runtime is one more thing that can fail.
- Cross-compiled static binaries (aarch64, armv7) built by GitHub Actions,
  plus a `.deb` package or tarball with a systemd unit.
- A Docker image can come later for the simulator and for dry runs.

---

## 7. Web interface

The web interface is the only user interface. It shows the live state of the
system and is where **everything** is configured: from first setup (which
sensor is on which input) to control parameters and integrations. Nobody
should ever need to edit a file or open a shell to run OSCoST.

### 7.1 Pages

| Page | Content |
|---|---|
| **Overview** | System diagram (collector, pipes, store, pumps) with live temperatures, pump state and speed, ΔT, current heat output. Active alarms and safety interventions on top. Updates live. |
| **History** | Charts of temperatures, pump speed and heat quantity, queried from VictoriaMetrics (its Prometheus query API), so any time range is available. If VictoriaMetrics is unreachable, the last 24 h are shown from memory. |
| **Manual mode** | Per output OFF / AUTO / ON / speed %, with a mandatory timeout after which it returns to AUTO. Clearly shows that the safety limits still apply. |
| **Events** | Log of state changes, sensor faults, safety interventions and config changes (who, when, what). |
| **Settings → Hardware** | Board, Pt1000 inputs and 1-Wire buses with a **bus scan** (lists every DS18x20 found with ROM ID, chip type and live reading; new or missing sensors are highlighted), per sensor: name, VBus channel number, calibration offset, live reading; outputs (relay/SSR/PWM, PWM profile and frequency, **test button**), flowmeter. |
| **Settings → System** | Hydraulic layout (which sensor is collector/store bottom/store top, which output is the solar pump) and the control functions with their parameters (ΔT on/off, setpoint, store max, optional functions). Each parameter has a short explanation, unit, allowed range and default. |
| **Settings → Integrations** | VictoriaMetrics (URL, auth, buffer size), MQTT + Home Assistant discovery, with a "test connection" button. |
| **Settings → Users & access** | Users, passwords, API tokens. |
| **Settings → Backup** | Download/upload the whole config, list of config revisions with diff and one-click rollback. |
| **About / Diagnostics** | Version, uptime, watchdog state, board temperature, update check. |

### 7.2 Setup wizard

On first start (or after a factory reset) there is no valid config, so all
outputs stay OFF and the interface opens a wizard:

1. Create the admin user.
2. Choose the board (Pi / Rock 5C) and the sensor/output hardware.
3. **Assign sensors**: every Pt1000 input and every DS18x20 found by the
   bus scan shows its live temperature, so you can identify each sensor by
   its reading (or by warming it in your hand: the one that rises is
   highlighted) instead of guessing ROM IDs. Each sensor gets a name, a
   role and its VBus channel number.
4. **Assign and test outputs**: switch each output on for a few seconds and
   check that the right pump or valve runs. PWM pumps: test a few speeds.
5. Choose a system layout (single store first; templates for more later)
   and review the default parameters.
6. Summary, then activate. Only now does automatic control start.

### 7.3 How config changes are applied

Config changes can switch pumps, so they are applied carefully:

- **Validation** happens in `oscost-config`, the same code the daemon uses.
  The API returns errors per field, and the interface shows them next to the
  field. Cross-field rules are validated too (ΔT_off < ΔT_on, every function
  has its sensors assigned, no output used twice).
- **Hard safety limits are not configurable.** Collector emergency shutdown
  and the absolute store limit can be set lower, never above the compiled-in
  maximum.
- **Draft → review → apply.** Edits are collected in a draft. Before applying,
  the interface shows a diff against the active config. Applying is atomic and
  takes effect at the next control cycle.
- **Hardware changes** (sensor/output assignment, PWM profile) put the
  affected outputs into OFF while they are applied, and are flagged in the
  review step.
- **Revisions**: every applied config is kept as a numbered revision with
  author, time and an optional comment. Any revision can be restored.
- **Concurrent edits**: each change carries the revision it was based on. If
  someone else applied a change in the meantime, the interface asks to
  reload instead of silently overwriting it.

### 7.4 Technology

The interface is **server-rendered HTML with htmx**. There is no separate
frontend app and no JavaScript build: `cargo build` produces the complete
program, web interface included.

- **Rendering**: pages and page fragments are rendered in Rust with
  [maud](https://maud.lambda.xyz/) (HTML as a Rust macro, checked at compile
  time, so a broken template is a compile error, not a runtime error). They
  live in `oscost-web` and are served by axum.
- **htmx** turns forms and buttons into partial page updates: a changed
  field is validated by the server as you type, and only the affected part of
  the page is replaced. Every page also works as a plain HTML form without
  JavaScript, just less smoothly.
- **Live updates**: Server-Sent Events, via the htmx SSE extension. The
  overview receives updated HTML fragments (temperatures, pump states, the
  system diagram) once per control cycle. The setup wizard streams live
  sensor readings the same way.
- **System diagram**: an SVG rendered by the server. Values and states are
  elements in the SVG that the SSE stream replaces.
- **Charts**: [uPlot](https://github.com/leeoniya/uPlot), a small and fast
  time-series library, and the only real piece of JavaScript. The history
  page gives it data from VictoriaMetrics, fetched through the daemon.
- **Forms built from the config definitions**: parameter names, units,
  ranges, defaults and help texts are defined once in Rust (`oscost-config`).
  `oscost-web` builds the settings forms from these definitions and shows
  the validation errors that `oscost-config` returns, next to the field.
  Interface and controller can't disagree about valid values, because it's
  the same code. A new parameter appears in the interface without
  hand-written form code.
- **Assets** (htmx, its SSE extension, uPlot, CSS, icons) are **vendored**
  into `assets/` with pinned versions and checksums, and embedded in the
  binary. No CDN, so the interface works with no internet connection, and
  there are no npm dependencies to keep updated.
- **CSS**: one small hand-written stylesheet with a mobile-first layout,
  since the interface is often used on a phone next to the store. No CSS
  framework that needs a build step.
- **JSON API**: the same daemon also offers a JSON API (documented as
  OpenAPI) for Home Assistant, scripts and future apps. The web pages don't
  depend on it; they talk HTML to the server. Both use the same validation
  and access rules.

### 7.5 Access and security

The interface can switch pumps, so changes need login:

- **Without login**: the status pages (overview, history, events) are
  visible to everyone who can reach the device, **read-only**. Nothing can be
  changed, not even manual mode. Settings pages are not shown (they contain
  credentials such as the VictoriaMetrics and MQTT passwords).
- **With login**: everything else (manual mode, all settings, users,
  backup). One role (admin) is enough; several admin users are possible, so
  the event log shows who changed what.
- Passwords stored as Argon2 hashes, session cookies (`HttpOnly`,
  `SameSite=Strict`), CSRF protection on all writes, rate-limited login.
- API tokens per integration, revocable. Read-only API endpoints, like the
  status pages, need no token.
- HTTP by default in the local network, with optional built-in TLS (own
  certificate or self-signed). Not meant to be exposed to the internet
  directly; use a VPN or reverse proxy for remote access.
- A **local recovery** path (for example a reset command on the device)
  for a lost admin password.

---

## 8. Testing strategy

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

## 9. Migration from the DeltaSol BX Plus

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

## 10. Milestones

1. `oscost-core` + `oscost-safety` with ΔT control, speed control, store max
   and collector emergency shutdown. Tests and a replay tool for vbus2influx
   data.
2. `oscost-sim` and simulation tests in CI.
3. HAL + Linux backend: MAX31865, GPIO outputs, PWM, watchdog. Bench setup.
4. `oscostd` + `oscost-config`: scheduler, systemd, config store with
   revisions, JSON API, VictoriaMetrics push with buffering.
5. Web interface: overview, setup wizard, all settings pages, users/login,
   manual mode.
6. MQTT + Home Assistant discovery.
7. Shadow mode on the real system.
8. Heat quantity, optional functions (cooling, tube collector, frost).
9. Switch over.

---

## 11. Open questions

- **Installation details** for `docs/installation.md`: which sensors and
  relays the BX Plus uses here, other pumps or valves besides the solar
  pump, single or multi-store, flat-plate or
  evacuated tube collectors, glycol or not, V40 flowmeter present or not.
- Is there already an independent store overtemperature cut-out?
- Shadow mode: second set of sensors, or use the RESOL values over VBus at
  first?
- Raspberry Pi or Rock 5C as the production board? (The design supports
  both. The answer decides the pin map and the HAT/board layout.)
- Off-the-shelf boards (MAX31865 breakouts, DIN-rail SSRs) or a custom HAT?
  Breakouts first is the faster way to the bench milestone.
- 1-Wire master: kernel `w1-gpio` or DS2482? Depends on cable lengths and
  how many DS18x20 sensors are planned.
