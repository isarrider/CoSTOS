# CoSTOS HAT: 1-Wire edition

Status: **design for rev A, not yet built or tested**. This page describes
the 1-Wire edition as it will be built: 1 Pt1000 input (collector) plus
two 1-Wire buses for DS18x20 sensors, in one build (D25). Which HAT to choose:
[HAT.md](HAT.md). The PT edition, which shares everything except the
sensor inputs: [HAT-PT.md](HAT-PT.md). Why it is built this way, the
dropped alternatives and the prototype tests:
[HAT-development.md](HAT-development.md); "Dn" (for example D22) refers to
a decision there. Once rev A has passed its tests, this line will say
"released".

The HAT combines the circuits from [Hardware needed](HARDWARE.md) on one
board that plugs onto the 40-pin header. No stripboard version is built
for the reference installation, so HAT rev A is the first hardware on the
real system: the [bring-up plan](HAT-development.md#6-bring-up-plan-rev-a) tests every block on its own,
and the pump only gets connected once its output and the watchdog have
been checked on the bench.

## 1. Scope

**On the HAT** (low voltage only, 3.3 V / 5 V / ≈ 7 V):

- PWM pump outputs with feedback inputs
- Pt1000 temperature inputs
- 1-Wire bus for DS18x20 sensors
- Control outputs for external relays / SSRs
- **No power input** (D18): the Pi is powered by its own USB-C supply and
  the HAT takes its few hundred mA from header pins 2/4, like any HAT
- Hardware watchdog that switches all relay outputs off when the software
  stops
- Protection on every connection that leaves the board, status LEDs

**Not on the HAT, deliberately:**

- **Anything with 230 V.** The pump's mains supply and an optional relay
  or SSR stay off the board (ARCHITECTURE 5.6). The HAT only sends a relay
  a low-voltage control signal.

## 2. Target boards and form factor

| | |
|---|---|
| Boards | Raspberry Pi 4, Raspberry Pi 5; Raspberry Pi 3 B / B+ should work (untested, see below) |
| Size | Raspberry Pi HAT: 65 × 56.5 mm, 4 × M2.5 mounting holes matching the Pi |
| Header | 40-pin female stacking header with tall spacers (≈ 16–17 mm) for every board (D16): clears the Pi 5 active cooler and most passive heatsinks, and works on a Pi 4 too |
| Connectors | Field connections on the left and bottom edges, fixed 3.5 mm screw terminals (see 7) |
| Component height | Low enough for a standard enclosure; the screw terminals are the tallest parts |
| ID EEPROM | Footprint for the Raspberry Pi HAT ID EEPROM on pins 27/28, not fitted in rev A (D6) |

### Mockup

Top view to scale. The placement shows that everything fits; the real
layout is done in KiCad.

![HAT mockup, top view](img/hat-mockup.svg)

On a Pi 5, top and side view: the HAT covers the left 65 mm, Ethernet and
USB stay free, sensors leave to the left and the pump cable to the front.
Heights are approximate and get fixed in KiCad.

![Pi 5 with the CoSTOS HAT, top and side view](img/pi-hat-assembly.svg)

A complete installation with the 1-Wire edition: 1 Pt1000 on the
collector, 7 DS18B20 on two daisy-chained buses and the PWM pump (sensor
names from the [reference installation](installation.md#sensors-and-outputs-in-use)).
The pump must have a PWM input in the solar profile
([Pump requirement](ARCHITECTURE.md#pump-requirement-safety)).

![Wiring of a complete installation, 1-Wire edition](img/wiring-1wire-edition.svg)

### Raspberry Pi 3

The Pi 3 B and B+ have the same 40-pin header, HAT size and mounting holes,
and the same PWM, SPI and 1-Wire blocks as the Pi 4, so the HAT and the
software should work unchanged. **Untested**: it gets checked in bring-up
([bring-up](HAT-development.md#6-bring-up-plan-rev-a)) if a Pi 3 is at hand. For someone with a spare Pi 3 it is the cheapest
way in: the HAT is then the only purchase.

| | Pi 3 B / B+ | Pi 4 / Pi 5 |
|---|---|---|
| 40-pin header, HAT size, mounting holes | 🟢 same | 🟢 |
| PWM (GPIO 18/19), SPI, 1-Wire, GPIO edge events | 🟢 same as the Pi 4, same overlays (6) | 🟢 |
| CPU and RAM for CoSTOS (1 Hz loop, web UI, local buffer) | 🟢 1 GB is plenty | 🟢 |
| Power | 🟡 **micro-USB**, 5.1 V 2.5 A supply, not USB-C | 🟢 USB-C |
| Ethernet | 🟡 100 Mbit (B), ≈ 300 Mbit (B+): plenty for the metrics | 🟢 Gigabit |
| Tall spacers (D16) | 🟢 fit, with more air than needed | 🟢 |
| Software | 🟢 the same 64-bit build (aarch64) | 🟢 |

Not the Pi 3 A+: it has no Ethernet, and CoSTOS uses no Wi-Fi. Older
boards (Pi 2, Pi 1 B+) have the header but too little CPU and RAM, and are
not considered.

## 3. Block diagram

```
                40-pin header
 ┌──────────────────┼──────────────────────────────────────────────────────┐
 │                  │                                                      │
 │  5 V from the Pi (pins 2/4) ─► bulk capacitor, power LED ─► HAT         │
 │  5 V ──► doubler ──► ≈ 7 V ─────┐                                       │
 │                                 ▼                                       │
 │  PWM1 ─► switches Q4·Q5 (AND WD_OK) ─► Q6 / Q7 ─► R ─► TVS ──► Pump 1   │ PWM / GND / FB
 │  PWM2 ─► same chain, not fitted ─► R ─► TVS ─────────────────► Pump 2   │ PWM / GND / FB
 │          ▲                                                              │
 │  FB1, FB2 ◄── R/C filter ◄── pull-up 3.3 V ◄─────────────────── Pumps   │
 │          │                                                              │
 │  HEARTBEAT ─► capacitor watchdog (charge pump) ────► WD_OK ─┐           │
 │                                                            ▼           │
 │  REL1..2 ─────────────────────────────► low-side MOSFETs ◄─ relay supply ├──► external SSR / relay
 │                                                                         │
 │  SPI ─► MAX31865 (Pt1000) ◄─────────────────────────────────── sensors  │
 │  GPIO 4, 17 ─► pull-ups ─► 1-Wire bus A, B ◄────────────────── DS18x20  │
 │                                                                         │
 │  LEDs: power, watchdog OK, pump 1, relay 1, relay 2                     │
 └─────────────────────────────────────────────────────────────────────────┘
```

### Circuit diagrams (rev A)

Drawn from this specification as a reference for the KiCad project; the
KiCad schematic will be the reference for the board itself. Faded parts
are footprints that are not fitted in rev A. Regenerate with
`python3 tools/hw/hat_schematic.py docs/img`.

![5 V from the Pi, pump driver supply and header](img/hat-sch-power.svg)

![Watchdog, PWM pump outputs and feedback inputs](img/hat-sch-pwm.svg)

![Relay supply and relay outputs](img/hat-sch-relay.svg)

![Pt1000 and 1-Wire inputs](img/hat-sch-sensors.svg)

Part choices the drawings add to the text below (all to be confirmed
when the BOM is made): relay supply switch AO3401A P-MOSFET turned on by an AO3400A from `WD_OK` (D23); capacitor watchdog from 1N4148W
diodes, capacitors and AO3400A (D24); pump driver from MMBT3904/MMBT3906
transistors and an AO3400A as watchdog switch (D22, D24); relay
MOSFETs AO3400A with 1N4148W flyback diodes; ESD diodes PESD5V0 on the
sensor inputs; 100 mA polyfuse for the 1-Wire sensor supply; the pump
driver supply from a voltage doubler of MMBT3904/MMBT3906 transistors,
1N4148W diodes and ceramic capacitors (D25).

## 4. Functions

### 4.1 PWM pump outputs

- **Two output positions. Rev A fits only PUMP1** (solar pump). PUMP2
  (its transistors, resistors, TVS, feedback parts and terminal) stays
  unfitted, as a spare for a later store-loading or heating pump (D2).
- **The driver is a transistor chain (H3, D22)**, from basic parts only:

  ```
              +V_DRV (≈ 7 V from the voltage doubler, D25)
                │
              ┌─┴── R36 2.2 kΩ
              ├──┤ Q6 MMBT3906 PNP "to the supply" ──► R9 ──┬───────► J2 PWM
     PWM_OFF  │                                            ├── D4 TVS
              │                                            ├──┤ Q7 MMBT3904 "pull-down"
             R35 2.7 kΩ                                    │     base from Q4's collector via R37 47 kΩ
              │                                            ├── R38 10 kΩ to GND
 PWM1 ─R33 10 kΩ─► Q4 MMBT3904  "PWM switch"               └── R31/R32 readback → GPIO 6
 WD_OK ──────────► Q5 AO3400A   "watchdog switch"
              │
             GND
  ```

  **Two switches in a row, one switch to the supply, one to ground.** Q4
  (the PWM) and Q5 (the watchdog) in series are the watchdog AND: only
  when both are on does current flow through R35: Q6 gets base current
  and switches the output to +V_DRV, and Q4's collector sits near 0 V, so
  Q7 is off. If either is off, R36 pulls PWM_OFF up to +V_DRV (Q6 off) and
  Q4's collector rises with it, so Q7 gets base current through R37 and
  pulls the terminal actively to 0 V = stop. Q7's base is taken from Q4's
  collector, not from PWM_OFF: PWM_OFF never goes lower than about 0.7 V
  below +V_DRV (Q6's base-emitter junction holds it there), so Q7 would
  never switch off. R37 is 47 kΩ so that Q7's base current, which flows
  through R36, stays too small to turn Q6 on (simulated, HAT-development.md 2). R7 (100 kΩ) holds
  PWM1 low while the Pi boots. Q7 sits behind R9, so the brief moment when
  Q6 and Q7 overlap while switching is limited by R9 like a shorted cable.
  Why this chain, what it replaced and how it is tested:
  [HAT-development.md 2](HAT-development.md#2-pump-driver-chain-alternatives-d22)
  (on the rev A prototype the original AND gate + TC4427 chain sits next
  to it as a jumper-selected fallback).
- **Driver supply +V_DRV ≈ 7 V** from a voltage doubler on the Pi's 5 V
  (D25, 4.7): the pump's input needs a high level of 4–24 V and draws a
  few mA (at most 10 mA).
- **R9 100 Ω** (at least ½ W) between the chain and the terminal, **D4
  SMBJ13A** (600 W TVS) at the terminal, R7 at the input. Simulated
  (ngspice, [HAT-development.md 9](HAT-development.md#9-one-1-wire-build-a-voltage-doubler-instead-of-the-dcdc-d25)):

  | At the pump terminal, PWM high | Pi's 5 V 5.0 V | Pi flags under-voltage (4.63 V) |
  |---|---|---|
  | Normal pump (≈ 2–3 mA) | 🟢 6.66 V | 🟢 6.00 V |
  | Stress case (≈ 10 mA) | 🟢 5.79 V | 🟢 5.23 V |
  | Shorted cable | ≈ 50 mA, R9 0.24 W | — |

  D4 only conducts far above the ≈ 7 V supply. Its capacitance (≈ 1 nF)
  together with R9 sets the edge speed (frequency, below).
- **Output readback** (any driver chain): a divider from the PWM terminal
  (behind R9) to a GPIO lets CoSTOS see what really leaves the board.
  PUMP1 on GPIO 6 (pin 31), PUMP2 on GPIO 26 (pin 37, unfitted with
  PUMP2). R31 12 kΩ and R32 8.2 kΩ to GND: ≈ 2.7 V at the GPIO when the
  terminal is high (≈ 3.2 V at most, with a strong supply and no pump),
  ≈ 0.33 mA load. If the doubler fails, the terminal only reaches about
  3.7 V, the GPIO sees ≈ 1.5 V and reads it as low: the output check
  raises an alarm.

  CoSTOS uses it twice (ARCHITECTURE 6.2, "PWM output check"):
  continuously, the line must be low when 0 % is commanded and its duty
  (measured from edge timestamps, like the feedback input) must match the
  command; and at every start, a **watchdog self-test**: PWM set high,
  heartbeat stopped, the line must drop to 0 V within about 15 s, and the
  watchdog readback (4.6) gives the exact timeout. That catches a
  shorted transistor in the chain (or, on the prototype's fallback chain,
  a stuck driver or AND gate) directly, and a silently lost watchdog
  layer before it matters. The pump runs for at most those 15 s.
- **R9 package: at least 0.5 W** (e.g. 1210 or 2010). With a shorted pump
  cable it dissipates ≈ 0.25 W for as long as
  the short lasts, more than an 0805 resistor takes.

- **Watchdog gating:** the watchdog switch Q5 sits in series with the PWM
  switch Q4, so a stopped watchdog also forces the output to 0 %. With a solar (PWM2)
  pump that means "stop", in addition to the relay cutting its mains.
  (For heating-profile pumps 0 % means full speed; there the relay is
  what stops them. The documentation for the outputs must say so.)
- Per output a 3-way terminal: **PWM, GND, FB**, in the cable's order
  (brown, blue, black).
- **Frequency settable** per output in software, default 500 Hz, checked
  range 100–1000 Hz, limited by the edge speed through R9 into D4's
  capacitance
  ([ARCHITECTURE](ARCHITECTURE.md#pwm-frequency-settable-per-output)).

### 4.2 Pump feedback inputs

- One per PWM output (FB2 unfitted in rev A, with PUMP2). Same circuit as on the stripboard: 4.7 kΩ
  pull-up to 3.3 V at the terminal, 10 kΩ series resistor, 1 nF to GND at
  the GPIO.
- **ESD diode (PESD5V0, D17) as the first part at the terminal's FB pin**,
  like on every other input: it catches static discharges from the cable
  before they reach the GPIO. In normal operation (0–3.3 V) it does
  nothing. If the PWM and FB wires are swapped, it clamps the ≈ 7 V to
  about 6 V, so only about 0.3 mA reaches the GPIO through the 10 kΩ.
- Optional per output in software; an unconnected input reads as
  constant high and is ignored.

### 4.3 Pt1000 inputs

- **One MAX31865** (SSOP-20) for PT1, the collector, with its 4.3 kΩ
  0.1 % reference resistor, the input filter from the datasheet and ESD
  protection on the terminal. There is no second Pt1000 position (D3):
  whoever needs more Pt1000 inputs, for example for a flow line that can
  pass 125 °C after a stagnation day, takes the PT edition.
- **The collector needs a Pt1000:** the cable to the roof usually has only
  two wires, which is exactly what a Pt1000 needs. A DS18x20 would need
  three (normal powered mode) and only goes up to 125 °C. The cable's
  resistance shows up as a small fixed offset (about 0.25 K for 20 m of
  0.75 mm²), corrected by the per-sensor calibration value.
- 2-wire connection by default; solder jumpers for 3-wire sensors.
- On SPI0, chip select CE0 (pin 24).
- The `DRDY` outputs are not connected; CoSTOS polls once per second.

### 4.4 1-Wire bus

- **Two independent 1-Wire buses**, driven by the kernel's `w1-gpio`
  driver: bus A on GPIO 4 (pin 7), bus B on GPIO 17 (pin 11). Up to about
  5 sensors per bus. A fault on one bus (damaged cable, short) only takes
  out the sensors on that bus.
- Per bus: 4.7 kΩ pull-up to 3.3 V on the Pi side, a **100 Ω series
  resistor** in DQ, ESD protection on DQ at the terminal, and a 3-way
  terminal (3V3, DQ, GND). The resistor limits the current into the GPIO
  if DQ touches a wrong voltage (the ESD diode clamps a 12 V fault to about
  6 V first); 22–100 Ω is the usual range and leaves the 1-Wire timing
  unchanged.
- **Sensors run in normal powered mode** (3 wires: 3V3, DQ, GND), never in
  parasite mode, which is unreliable at high temperatures and with several
  sensors converting at once.
- 3.3 V sensor supply with a polyfuse, shared by both buses.
- **Fallback: DS2482-100 footprint, not fitted.** An I²C-to-1-Wire bridge
  on I2C1 (pins 3/5) with active pull-up, for the case that long cables or
  the Pi 5's GPIO cause trouble. Fitting it (and moving the buses to it)
  needs no new board.

### 4.5 Relay / SSR control outputs

- **Two output positions, rev A fits only REL1** (solar pump mains).
  REL2 (MOSFET, flyback diode, LED, terminal) stays unfitted; its gate
  pull-down is fitted so the GPIO line is defined.
- Each is a low-side N-MOSFET switching the negative side
  of an external SSR input or relay coil; the positive side comes from
  the HAT's **relay supply** (5 V).
- The relay supply is switched by the watchdog (4.6): without a heartbeat,
  every relay output is off, whatever the GPIOs do.
- Flyback diode per output (for relay coils), gate pull-down so outputs
  are off while the Pi boots, LED per output.
- Intended load: a DIN-rail SSR with a 3–32 V DC control input
  (typically under 20 mA), or a 5 V relay coil up to about 100 mA.
- 2-way terminal per output: **+5 V (switched)** and **OUT**.

### 4.6 Hardware watchdog

**A capacitor that the software must keep charged** (D24; the full
reasoning, simulation and failure analysis are in
[HAT-development.md 8.2](HAT-development.md#82-watchdog-a-capacitor-that-the-software-must-keep-charged-d24)):

- CoSTOS toggles the **heartbeat GPIO 24** about 20 times a second, from
  a small task that only runs while the last control cycle (sensors read,
  decision made, outputs written) succeeded less than about 1 s ago.
- Each edge pumps a little charge through two small capacitors (C17,
  C19) and a diode (D19) into C18; two resistors (R49 ∥ R50) drain it
  all the time. The voltage on C18 **is** `WD_OK`. It holds the gates of
  three AO3400A: Q5 gates the pump signal (4.1), Q13 switches the relay
  supply (4.5, D23), Q14 drives the WD LED and the readback.
- Heartbeat stopped, stuck high or low, slower than about 0.5 Hz, or
  faster than about 1 kHz (filter R48/C16, a program stuck in a loop):
  C18 empties and the MOSFETs switch off within about 5–14 s. That is
  long on purpose: the watchdog only ever switches off, and nothing in a
  solar system turns dangerous within seconds, while the long time
  constant rides through Linux stalls of several seconds.
- After power-up C18 is empty until the software starts the heartbeat,
  so nothing runs while the Pi boots.
- No single failed part keeps it on: the drain resistors are two in
  parallel, the coupling capacitors two in series.
- **Readback on GPIO 20** (pin 38, through Q14, low = watchdog on): at
  every start the self-test stops the heartbeat and measures the real
  timeout (alarm outside about 3–20 s).
- LED "WD", and jumper JP1 to force `WD_OK` for bench tests (clearly
  marked, open by default).
- Built only from JLCPCB basic parts for a few cents; the 74LVC1G123 it
  replaces cost about €4 for one controller (part and loading fee).
- **Why it is worth having:** the Pi's own hardware watchdog and systemd
  catch a hung kernel or a crashed CoSTOS, but not a fault in the
  switching hardware. Where a cut-off relay or SSR is used (option C), an
  SSR that fails short-circuited would leave the pump powered; the
  watchdog-gated PWM is then a second, independent way to stop it (0 % =
  stop with a PWM2 pump), and the feedback input shows that it happened
  (D8).
- **With a permanently powered pump (D15, option A) the gated PWM is the
  only stop path**, which makes this circuit the main hardware safety
  layer rather than a backup.
- This is the "external heartbeat" layer from
  [Safety](ARCHITECTURE.md#41-hardware-layer-independent-of-software); the
  SoC watchdog and the systemd watchdog remain in addition.

### 4.7 Power: from the Pi (D18)

The HAT has **no power input**. The Pi runs from its own USB-C supply
(D15), and the HAT takes its 5 V from header pins 2/4 and its 3.3 V from
pins 1/17, like any HAT. Its 5 V therefore sits behind the Pi's own input
protection, so the HAT needs no fuse, TVS or ideal diode of its own; it
only has a bulk capacitor and a power LED on its 5 V rail.

**Pump driver supply (D25):** a voltage doubler from basic parts lifts
the 5 V to about 7 V (+V_DRV) for the pump driver chain: a
two-transistor oscillator (Q15/Q16, ≈ 15 kHz), a push-pull pair
(Q17/Q18) that switches C22, and two diodes (D21/D22) into C23. It runs
all the time, independently of the software, and draws about 10 mA. The
pump then sees about 6.7 V, against the 4 V it needs. If the oscillator
stops, +V_DRV falls to about 3.8 V and the readback reports it (4.1).
Simulated in [HAT-development.md 9](HAT-development.md#9-one-1-wire-build-a-voltage-doubler-instead-of-the-dcdc-d25).
Rev A also carries the former 12 V DC/DC (U2, not fitted) to compare.

- **Supply:** the official Raspberry Pi USB-C supply (27 W for the Pi 5,
  15 W for the Pi 4) or an equivalent; for a Pi 3 its micro-USB supply
  (5.1 V, 2.5 A). **No phone chargers or long, thin USB cables**: the
  pump signal is made from this 5 V (doubled, see below and 11.1). The Pi 5 negotiates 5 A over USB
  power delivery, so no `PSU_MAX_CURRENT` setting is needed.
- **DIN-rail builds** (ARCHITECTURE 5.6 options B/C): a 5 V DIN-rail
  supply feeds the Pi through a short USB-C lead (5.1 V, 3 A for a Pi 4,
  5 A for a Pi 5; a Pi 5 on a plain USB-C lead without power delivery
  needs `PSU_MAX_CURRENT=5000` in its bootloader configuration).

### 4.8 Status LEDs

The LEDs are CoSTOS's only local display (no screen, general rule). All
of them are driven by hardware and show the real state even if the
software is wrong; none needs an overlay or any software.

| LED | Colour | Driven by | Shows |
|---|---|---|---|
| PWR | green | 5 V rail | the HAT has power |
| WD | green | Q14, from the watchdog capacitor (`WD_OK`) | heartbeat seen, outputs enabled (4.6) |
| **PUMP1** | green | driver output (Q6) via 2.2 kΩ | what really reaches the pump: off = stop, brighter = faster |
| R1 | yellow | relay output 1 | relay or SSR switched on |
| PUMP2, R2 | | | only with the unfitted second channels |

**LED type: forward voltage ≈ 2 V** (red, yellow, orange, or the classic
yellow-green "green"), not the bright pure green with ≈ 3 V. The WD LED
runs from 3.3 V: with a 2 V LED it gets ≈ 1.3 mA, with a 3 V LED only
≈ 0.3 mA, which is barely visible. The PUMP1 LED sits on the ≈ 7 V driver
output:

| LED | Supply | Resistor | Current (Vf ≈ 2 V) |
|---|---|---|---|
| PWR | 5 V | 1 kΩ | ≈ 3 mA |
| WD | 3.3 V | 1 kΩ | ≈ 1.3 mA |
| PUMP1 | ≈ 7 V (driver output) | 2.2 kΩ | ≈ 2 mA at 100 %, times the duty cycle |
| R1 | 5 V | 1 kΩ | ≈ 3 mA |

Alarms are shown on the web page, as metrics and (optionally) over MQTT,
not on an LED. The LEDs face up; a closed enclosure needs a window or
light pipes above them.

### 4.9 Power budget

| Rail | Source | Users | Estimated current |
|---|---|---|---|
| 5 V | Pi header pins 2/4 (from the Pi's USB-C supply) | voltage doubler, relay supply, LEDs | HAT < 200 mA with a relay coil, < 100 mA with an SSR (per extra fitted relay output up to +100 mA) |
| ≈ 7 V (+V_DRV) | voltage doubler on the HAT (D25) | pump driver chain, PWM output | < 15 mA (the doubler draws ≈ 10 mA more from the 5 V) |
| 3.3 V | Pi header pins 1/17 | MAX31865, DS18x20 sensors, pull-ups | < 30 mA |

## 5. Pin assignment

The same on the Raspberry Pi 3, Pi 4 and Pi 5. Only the PWM chip and
channel numbers behind GPIO 18/19 differ, which is software configuration.

| Function | Header pin | Pi 3 / Pi 4 | Pi 5 |
|---|---|---|---|
| 1-Wire bus A | 7 | GPIO 4 | GPIO 4 |
| 1-Wire bus B | 11 | GPIO 17 | GPIO 17 |
| I²C SDA / SCL (DS2482, only if fitted) | 3 / 5 | I2C1 | I2C1 |
| SPI MOSI / MISO / SCLK | 19 / 21 / 23 | SPI0 | SPI0 |
| SPI CE0 (MAX31865) | 24 | GPIO 8 | GPIO 8 |
| PWM 1 | 12 | GPIO 18, PWM0 channel 0 | GPIO 18, RP1 PWM0 channel 2 |
| PWM 2 (only if fitted) | 35 | GPIO 19, PWM0 channel 1 | GPIO 19, RP1 PWM0 channel 3 |
| Feedback 1 | 16 | GPIO 23 | GPIO 23 |
| Feedback 2 (only if fitted) | 36 | GPIO 16 | GPIO 16 |
| PWM readback 1 | 31 | GPIO 6 | GPIO 6 |
| PWM readback 2 (only if fitted) | 37 | GPIO 26 | GPIO 26 |
| Heartbeat | 18 | GPIO 24 | GPIO 24 |
| Watchdog readback | 38 | GPIO 20 | GPIO 20 |
| Relay 1 | 22 | GPIO 25 | GPIO 25 |
| Relay 2 (only if fitted) | 29 | GPIO 5 | GPIO 5 |
| ID EEPROM | 27 / 28 | ID_SD / ID_SC | ID_SD / ID_SC |
| 5 V (Pi → HAT) | 2, 4 | | |
| 3.3 V | 1, 17 | | |
| GND | 6, 9, 14, 20, 25, 30, 34, 39 | | |

The config below enables both PWM channels and all relay pins, so a later
fitted PUMP2 or REL2 needs no configuration change. Both PWM channels need a two-channel PWM overlay. Which one works on the
Pi 5 (`pwm-2chan` or two `pwm` entries) is checked during bring-up; see
also [Testing the output](HARDWARE.md#testing-the-output).

## 6. Raspberry Pi configuration

What has to be enabled on the Pi for the HAT. The CoSTOS installer will
set this up; listed here so it can be checked by hand.

**`/boot/firmware/config.txt`**

```ini
# SPI0 for the MAX31865 (CE0)
dtparam=spi=on
# Two 1-Wire buses for the DS18x20 sensors (external pull-ups on the HAT;
# no "pullup" parameter, which would mean parasite power)
dtoverlay=w1-gpio,gpiopin=4
dtoverlay=w1-gpio,gpiopin=17

# Relay outputs and heartbeat: outputs, driven low as early as possible
gpio=24,25,5=op,dl
# PWM output readback: inputs with pull-down
gpio=6,26=ip,pd
# Watchdog readback (pulled up on the HAT, low = watchdog on)
gpio=20=ip,np

[pi3]
# Same as the Pi 4 (untested on the Pi 3)
dtoverlay=pwm-2chan,pin=18,func=2,pin2=19,func2=2
dtparam=audio=off

[pi4]
# Two hardware PWM channels on GPIO 18 / 19
dtoverlay=pwm-2chan,pin=18,func=2,pin2=19,func2=2
# The Pi 4's analog audio uses the same PWM hardware
dtparam=audio=off

[pi5]
# RP1 PWM0 channels 2 / 3 on GPIO 18 / 19 (verify during bring-up)
dtoverlay=pwm-2chan

[all]
```

**Not needed:**

- No I²C, unless the optional DS2482 is fitted (then `dtparam=i2c_arm=on`
  instead of the two `w1-gpio` lines).
- No overlays for the feedback inputs: they are read as GPIO edge events
  through the GPIO character device.
- With the ID EEPROM fitted later (D6), the overlays above could be
  loaded automatically.

**Also on the system side:**

- The CoSTOS service user needs access to `/dev/gpiochip*`, `/dev/spidev0.*`,
  `/sys/bus/w1` and `/sys/class/pwm` (groups `gpio` and `spi` on Raspberry
  Pi OS).
- The SoC hardware watchdog is armed through systemd
  (`RuntimeWatchdogSec=` in `/etc/systemd/system.conf`), in addition to the
  HAT's own watchdog.

## 7. Field connectors

22 terminal positions don't fit along one 65 mm edge: at 5.08 mm pitch
they would need about 112 mm. So the connectors use **fixed 3.5 mm screw
terminals** on **two edges**, as in the [mockup](#mockup):

- **Left edge** (everything that is normally wired, D17): PT1, 1W-A,
  1W-B, PUMP1. The PT edition: the S1–S8 block and PUMP1.
- **Front (bottom) edge** (rarely used or not fitted), from the left:
  PUMP2, REL2, REL1 (PUMP2 and REL2 not fitted in rev A; REL1
  sits right below its relay circuit). The PT edition: PUMP2, 1W-A, REL2,
  REL1. There is no power terminal (D18).
- The top edge holds the 40-pin header. The right edge stays free: on the
  Pi, the USB and Ethernet sockets sit right next to it.

**Where the field terminals go (decided: B, D17).** With the Pi powered
over USB-C (D15) the USB-C cable leaves at the front edge. Moving PUMP1 to
the left edge puts all wiring that is normally used on one side and
leaves the front to the USB-C plug and to REL1, which option A doesn't
use. (The drawing still shows the PWR terminal, dropped later by D18.) The three arrangements compared (1-Wire edition):

![Three terminal arrangements on a Pi 5](img/hat-edge-options.svg)

Fixed means one block per connector, soldered to the board, with the
cable screwed straight into it. Pluggable terminals (a soldered socket and
a removable screw plug) would let the HAT come off without undoing any
wire, but cost about €4 more per board; for a controller that stays in its
cabinet that isn't worth it (D10). To swap the Pi or the HAT, label the
wires and unscrew them.

![Pluggable versus fixed screw terminal, side view](img/terminal-types.svg)

All labelled on the silkscreen:

| Connector | Pins | Function |
|---|---|---|
| PUMP1 | PWM, GND, FB | pump 1 signal cable (brown, blue, black) |
| PUMP2 | PWM, GND, FB | pump 2 signal cable (not fitted in rev A) |
| PT1 | A, B | Pt1000 sensor 1 (collector); no polarity, wires in any order |
| 1W-A, 1W-B | 3V3, DQ, GND | DS18x20 sensors |
| REL1 | +5V, OUT | relay / SSR 1, optional: cut-off relay (option C), heating-profile pump, valve |
| REL2 | +5V, OUT | SSR / relay 2 (not fitted in rev A) |

### 7.1 Silkscreen: wiring instructions on the board (D21)

The board carries as much wiring information as fits, so it can be wired
without the docs open. Silkscreen is free on both sides at JLCPCB, so this
costs nothing. Rules: text at least 1 mm high with a 0.15 mm line (most of
it 1.2–1.4 mm), nothing printed over pads or under terminal bodies.

| Where | What is printed | Read when | Readability |
|---|---|---|---|
| Top, at each terminal | Pin name next to every pin (A/B, 3V3/DQ/GND, PWM/GND/FB, +5V/OUT), terminal name and what it is for (PT1 collector, 1W-A, PUMP1 pump) | while wiring, HAT on the Pi | 🟢 the most useful text |
| Top, signal paths | Thin lines with arrows and small text from each terminal through its circuit to the Pi: PT1 → MAX31865 → SPI, the 1-Wire buses → GPIO4/17, GPIO18 (PWM) and GPIO24 (heartbeat) → the transistor chain → PUMP1, WD_OK, ≈ 7 V from the doubler, the pump feedback → checks, the relay → REL1 (see the [mockup](#mockup)). Lines and text stay off pads and component bodies | when tracing a fault, or learning how the board works | 🟢 |
| Top, small notes | LED names, "≈ 7 V" at the doubler, outlines of unfitted parts, edition and revision | assembly, checking the LEDs | 🟢 |
| Bottom, cheat sheet | Table of all terminals with pins and use, pump wire colours (brown · blue · black), the three safety rules (heating-profile pump only with REL1 cutting its power, no 230 V on the board, pump signal ≈ 7 V for 4–24 V inputs), LED meanings, tick boxes for the pump driver supply on rev A (doubler or U2 12 V test), repository URL | before mounting, or with the HAT off | 🟡 hidden once on the Pi |
| Bottom, QR code (10 × 10 mm) | link to the repository | any time, with a phone | 🟢 |

Not printed: **DS18B20 wire colours**. They differ between makers (red /
yellow / black is common, not guaranteed), so a printed colour could lead
to wrong wiring; the pin names are safe. The pump colours are printed
because they come from the pump maker's cable (Wilo: brown PWM, blue GND,
black FB).

The top-side pin names are in the [mockup](#mockup). The bottom side,
seen from below (mirrored, so the left-edge terminals appear on the
right):

![HAT bottom side with the silkscreen cheat sheet](img/hat-bottom.svg)

The PT edition gets the same layout with its own terminal table (S1–S8 as
2-wire Pt1000, 1W-A at the front).

## 8. Manufacturing

- **Design tool:** KiCad. Project in `hardware/hat/` in this repository,
  with schematic, layout, and Gerber/BOM exports for each released
  revision.
- **Manufacturer:** AISLER (Germany). 2-layer, 1.6 mm, HASL, Budget
  service. Their price is a job fee plus a price per cm² and board; for a
  65 × 56.5 mm board (about 37 cm²) a set of 3 bare boards is about
  €19 net at the time of writing (check their current pricing).
- **Design rules:** AISLER's KiCad design rules, imported before routing.
- **Assembly: delivered fully soldered (D7).** All SMD parts on the top
  side only (one-sided assembly is the cheap option at every assembler),
  through-hole only for the terminals and the 40-pin header.
  Parts are chosen from what the assembler stocks: for JLCPCB that means
  LCSC part numbers in the BOM, "basic" parts where possible, since every
  other part type adds a feeder fee. Packages stay hand-solderable (0805,
  SOIC, SSOP), so a board can still be repaired or built by hand.
- **Assembler:** decided on real quotes once the KiCad BOM exists: AISLER
  (boards and assembly from Germany) against JLCPCB (cheapest for small
  runs, ships from China).
- **Checks before ordering:** KiCad ERC and DRC clean, every net compared
  against the stripboard circuits, footprints of the MAX31865 and DS2482
  checked against their datasheets, a 1:1 paper print to check
  connector and mounting-hole positions on the real Pi.
- **Parts rule (D20):** every ordinary part is a JLCPCB basic or preferred
  extended part, so only the MAX31865 pays a loading fee. Other
  assembly services compared:
  [HAT-development.md 5](HAT-development.md#5-assembly-services-compared-d7-d20).

### 8.1 Parts list with prices (rev A as fitted, per board)

Single-quantity prices without VAT at **LCSC**, the parts store behind
JLCPCB, November 2026, at $1 ≈ €0.87. "Checked" prices were looked up;
the others are typical LCSC prices for basic parts and get checked when
the BOM exists. Unfitted positions are not counted, nor are the Pi, its
USB-C supply, an optional relay and the sensors. (Earlier versions used
single prices from EU distributors such as DigiKey, which are two to
eight times higher for these parts.)

| Part | Qty | LCSC | ≈ € | Source |
|---|---|---|---|---|
| MAX31865AAP+ (Pt1000 converter) | 1 | $4.45 ($3.94 when JLCPCB fits it) | 3.87 | checked |
| PCB, ⅓ of an AISLER set of 3 (≈ €19), for building it yourself | — | — | 6.50 | AISLER |
| 40-pin tall female header and 4 M2.5 spacers (D16) | 1 | ≈ $1.40 | 1.25 | estimate |
| Voltage doubler (D25): MMBT3904 × 3, MMBT3906, 1N4148W × 2, 4 resistors, 4 capacitors | 12 | ≈ $0.12 | 0.10 | estimate |
| Resistors and capacitors, about 30 (incl. the 4.3 kΩ 0.1 % reference) | — | ≈ $0.60 | 0.50 | estimate |
| 3.5 mm fixed screw terminals (PT1, 1W-A, 1W-B, PUMP1, REL1), e.g. Kefa KF350 | 5 | $0.06 (2-pole) – $0.08 (3-pole) | 0.30 | checked (2-pole) |
| PESD5V0 ESD diodes (PT1 × 2, 1W-A, 1W-B, FB1) | 5 | ≈ $0.03 | 0.13 | estimate |
| LEDs (PWR, WD, PUMP1, R1) | 4 | ≈ $0.01 | 0.04 | estimate |
| SMBJ13A | 1 | ≈ $0.05 | 0.04 | estimate |
| Pump driver transistors: MMBT3904 × 2, MMBT3906, AO3400A (D22, D24) | 4 | ≈ $0.01 | 0.04 | estimate |
| Capacitor watchdog: AO3400A (Q14), 1N4148W × 2, 6 resistors and capacitors (D24) | 9 | ≈ $0.06 | 0.05 | estimate |
| 100 mA polyfuse | 1 | ≈ $0.03 | 0.03 | estimate |
| AO3400A, 1N4148W | 2 | ≈ $0.02 | 0.03 | estimate |
| Relay supply switch: AO3401A, AO3400A (D23) | 2 | ≈ $0.02 | 0.03 | estimate |
| **Total, with ⅓ of an AISLER PCB set** | | | **≈ 12.95** | |
| Total without PCB (the parts JLCPCB fits) | | | ≈ 6.50 | |

The MAX31865 is by far the most expensive part. The
terminal brand is a choice still to make: Kefa KF350 is the cheap common
one; brand-name blocks (Phoenix, Dinkle) cost several times more. The PT
edition's list is in [HAT-PT.md 5](HAT-PT.md#5-space-and-cost).

### 8.2 What one controller costs

Factory assembly has fixed costs per order, so the price depends mostly
on how many boards are ordered. **Most people want one controller**, but
JLCPCB's smallest economic assembly order is 2 boards, so "price for one"
below means the total of that smallest order; the second board is a spare
(or for a friend).

**The model** (JLCPCB, incl. shipping and 19 % import VAT; estimates until
a real quote exists):

- **Fixed part per order:** setup and stencil, a loading fee of about
  €2.80 for each part type that is not a JLCPCB basic part, the
  through-hole soldering setup and shipping: ≈ €45.60 for the 1-Wire
  edition (one such part type: the MAX31865) and ≈ €46.00 for the PT
  edition (LTC2983 handling). The relay supply switch, the watchdog and
  the pump driver supply are built from basic parts (D23–D25).
- **Variable part per board:**

  | | 1-Wire edition | PT edition |
  |---|---|---|
  | Parts at JLCPCB/LCSC prices (8.1, without PCB) | €6.00 | €42.70 (LTC2983 ≈ €39, bought at DigiKey and consigned) |
  | PCB share (JLCPCB makes 5 bare boards) | €0.40 | €0.40 |
  | Soldering per joint (SMD and through-hole) | €1.00 | €1.20 |
  | **Per board, incl. 19 % VAT** | **≈ €8.80** | **≈ €52.70** |

**What one controller costs**, by how you get the board (all incl. 19 %
VAT; 🟢 cheapest way, 🟡 middle, 🔴 most expensive):

| How you get it | What you pay for | **1-Wire edition** | **PT edition** |
|---|---|---|---|
| **Order it ready-made, just for you** | JLCPCB's smallest order: 2 assembled boards (the second is a spare), shipping included | 🔴 **≈ €63** | 🔴 **≈ €151.50** |
| **Order it ready-made with others** | a group order of 5 assembled boards, your share | 🟢 **≈ €18** | 🟢 **≈ €62** |
| **Build it yourself** | parts for one board from LCSC plus a set of 3 bare PCBs (AISLER, ≈ €19 + VAT); needs SMD soldering (fine-pitch MAX31865 / LTC2983); LCSC shipping (≈ €10–20) not included | 🟡 **≈ €30.50** | 🟡 **≈ €73.50** |

For one controller, the fixed costs dominate: €45.60 of the €63 is
setup, the one loading fee and shipping. Since D25 the 1-Wire edition
costs about as much as the former 1-Wire Lite, with the relay output and
a pump signal of ≈ 7 V instead of ≈ 4.8 V.
AISLER's assembly price is not estimated here; it gets quoted with the
BOM. Earlier estimates (with EU distributor prices, before D18 and D22)
are in the decisions.

## 9. Bring-up and testing

Every rev A board is brought up block by block before the pump is
connected, and the prototype tests the transistor driver chain against
its fallback: [HAT-development.md 6](HAT-development.md#6-bring-up-plan-rev-a)
and [2](HAT-development.md#2-pump-driver-chain-alternatives-d22).

## 10. Decisions

All design decisions D1–D25, each with its reasoning, are in
[HAT-development.md 1](HAT-development.md#1-decisions). This page states
the result; the decision number in brackets leads to the reason.

---

## 11. Safety rules and the pump signal

### 11.1 Rule: it may fail, but it may not break anything

The HAT may stop working; it must never leave the pump running against
the controller's will or damage the Pi:

1. **Every fault ends in "pump stopped".** The PWM line keeps its
   pull-down and the watchdog switch in the driver chain (4.1, 4.6). For
   **solar-profile pumps** (Wilo PWM2, Grundfos profile C) no signal or a
   low signal means stop. **Heating-profile pumps** run at full speed
   without a signal, so CoSTOS only accepts them with REL1 wired to cut
   their power (4.5); the setup wizard asks for it.
2. **Field wiring can't reach the Pi.** The MAX31865 with its ±45 V input
   protection stays on the collector input, and every terminal keeps its
   series resistors, ESD diodes, TVS diode and polyfuse. A short or a
   swapped wire damages nothing. (230 V on a low-voltage terminal is beyond
   any HAT.)
3. **No power path of its own** (D18): powered by the Pi.
4. **The weakest part fails safe.** If the voltage doubler stops, the
   driver supply falls to about 3.8 V: a solar pump stops or runs weakly,
   the output readback (4.1) and the pump feedback both report it.
5. **The pump signal follows the Pi's 5 V, doubled.** The doubler lifts
   the Pi's 5 V rail, so a sagging supply costs about twice its sag, but
   from much higher up (simulated, normal pump):

   | Point | Pi's 5 V | At the pump | Margin to the 4 V the pump needs |
   |---|---|---|---|
   | Official Raspberry Pi supply | 5.0 V | 6.66 V | 🟢 2.7 V |
   | Same, Pi under heavy load (CPU, USB devices) | 4.8 V | 6.30 V | 🟢 2.3 V |
   | Pi flags "under-voltage" itself | 4.63 V | 6.00 V | 🟢 2.0 V |
   | Weak supply | 4.5 V | 5.76 V | 🟢 1.8 V |
   | Very weak supply (the Pi itself is about to fail) | 4.2 V | 5.22 V | 🟢 1.2 V |

   The pump signal therefore outlasts the Pi. Still: **official Raspberry
   Pi supply, or one that holds 5.1 V under load; no phone chargers, no
   long USB cables.** CoSTOS watches it through the Pi's own under-voltage
   flag ("supply under-voltage" alarm,
   [ARCHITECTURE 6.2](ARCHITECTURE.md#function-checks-and-alarms)), and
   bring-up measures it ([step 3](HAT-development.md#6-bring-up-plan-rev-a)).

The cheaper 1-Wire Lite build that existed until D25 (5 V pump signal,
no relay output) is no longer needed: the doubler and REL1 cost less
than its saving. Its history: [HAT-development.md 3](HAT-development.md#3-1-wire-lite-why-no-dedicated-board-d19)
and [9](HAT-development.md#9-one-1-wire-build-a-voltage-doubler-instead-of-the-dcdc-d25).

### 11.2 The pump signal, step by step

From the Pi pin to the pump terminal, with the voltage at each step.
Regenerate with `python3 tools/hw/pwm_chain_svg.py > docs/img/hat-pwm-chain.svg`.

![PWM signal path of the 1-Wire edition](img/hat-pwm-chain.svg)

1. **Pi GPIO 18** makes the PWM in hardware (5.5): 0 V or 3.3 V, 500 Hz
   by default. Too low for the pump on its own, which needs at least 4 V.
2. **R7** (100 kΩ to GND) holds the line at 0 V while the Pi boots,
   before GPIO 18 is configured. 0 V means "pump stopped".
3. **Two switches in a row:** Q4 (the PWM switch) and Q5 (the watchdog
   switch, driven by WD_OK, 4.6). Only when both are on is the output
   switched on. If CoSTOS hangs, the watchdog opens Q5 within about 5–14 s.
4. **Q6, the switch to the supply** (a PNP transistor), connects the
   output to +V_DRV, about 7 V from the voltage doubler (D25).
5. **Q7, the switch to ground**, pulls the terminal actively to 0 V
   whenever Q6 is off, so the falling edge is as sharp as the rising one.
   Its base current comes from Q4's collector through R37 (47 kΩ), which
   is near 0 V only while Q4 and Q5 are both on.
6. **R9** (100 Ω, at least ½ W) drops only about 0.3 V at the pump's
   few mA, so the pump sees about 6.7 V. With a shorted cable (or the
   moment Q6 and Q7 overlap while switching) it limits the current to
   about 50 mA.
7. **D4** (SMBJ13A) at the terminal catches spikes coming back on the
   cable.
8. **LED D12** with R22 (2.2 kΩ) sits right at the driver output and shows
   what really leaves the board: off = stop, brighter = faster. The
   readback (R31/R32 to GPIO 6) lets CoSTOS check the same thing.

Four transistors, all basic parts, and two protection parts.
