# OSCoST HAT: specification

Status: **draft, rev A not yet designed**. This page defines what the HAT
has to do before anything is drawn in KiCad. Decisions still open are
listed at the end; everything else is the proposal.

The HAT combines the circuits from [Hardware needed](HARDWARE.md) on one
board that plugs onto the 40-pin header. It is designed once the
stripboard versions have been tested on the real system, so that no
untested circuit goes into a manufactured board.

---

## 1. Scope

**On the HAT** (low voltage only, 3.3 V / 5 V / 12 V):

- PWM pump outputs with feedback inputs
- Pt1000 temperature inputs
- 1-Wire bus for DS18x20 sensors
- Control outputs for external relays / SSRs
- Hardware watchdog that switches all relay outputs off when the software
  stops
- Protection on every connection that leaves the board, status LEDs

**Not on the HAT, deliberately:**

- **Anything with 230 V.** The SSR or relay that switches the pump, the
  5 V power supply and the fuse sit on a DIN rail in the enclosure, wired
  by an electrician. The HAT only sends the relay a low-voltage control
  signal.
- **Powering the Pi.** The Pi gets its power from its own USB-C input
  (from the DIN-rail supply). The HAT takes 5 V and 3.3 V from the
  header. See open decision D5.

## 2. Target boards and form factor

| | |
|---|---|
| Boards | Raspberry Pi 4, Raspberry Pi 5 |
| Size | Raspberry Pi HAT: 65 × 56.5 mm, 4 × M2.5 mounting holes matching the Pi |
| Header | 40-pin female, with a stacking/extra-tall header option for the Pi 5 active cooler |
| Connectors | All field connections along one long edge, pluggable 5.08 mm terminal blocks |
| Component height | Low enough for a standard enclosure; the DC/DC module is the tallest part |
| ID EEPROM | Footprint for the Raspberry Pi HAT ID EEPROM on pins 27/28, not fitted in rev A (D6) |

## 3. Block diagram

```
                40-pin header
 ┌──────────────────┼──────────────────────────────────────────────────────┐
 │                  │                                                      │
 │  5 V ──► DC/DC 5→12 V ──► 12 V ─┐                                       │
 │                                 ▼                                       │
 │  PWM1 ─► AND ─► TC4427 ch A ─► R ─► TVS ─────────────────────► Pump 1   │ PWM / GND / FB
 │  PWM2 ─► AND ─► TC4427 ch B ─► R ─► TVS ─────────────────────► Pump 2   │ PWM / GND / FB
 │          ▲                                                              │
 │  FB1, FB2 ◄── R/C filter ◄── pull-up 3.3 V ◄─────────────────── Pumps   │
 │          │                                                              │
 │  HEARTBEAT ─► watchdog (retriggerable monostable) ─► WD_OK ─┐           │
 │                                                            ▼           │
 │  REL1..2 ─────────────────────────────► low-side MOSFETs ◄─ relay supply ├──► external SSR / relay
 │                                                                         │
 │  SPI ─► MAX31865 #1, #2 (Pt1000) ◄──────────────────────────── sensors  │
 │  I²C ─► DS2482-100 (1-Wire) ◄───────────────────────────────── DS18x20  │
 │                                                                         │
 │  LEDs: power, watchdog OK, relay 1, relay 2                             │
 └─────────────────────────────────────────────────────────────────────────┘
```

## 4. Functions

### 4.1 PWM pump outputs

- **Two outputs**, one per TC4427 channel (the second channel is free on
  the stripboard design anyway). Rev A needs one for the solar pump; the
  second is a spare for a later store-loading or heating pump (D2).
- Same circuit as the [12 V driver board](HARDWARE.md#option-1-driver-board-12-v):
  TC4427 from a 5 V → 12 V DC/DC, 470 Ω series resistor, P6KE15A-class
  TVS (SMD equivalent with the same breakdown voltage, e.g. SMBJ13A; not
  lower, since the unregulated 12 V can reach 13.5 V), 100 kΩ pull-down at
  the input (D1).
- **Watchdog gating:** each PWM signal passes an AND gate with `WD_OK`, so
  a stopped watchdog also forces the PWM to 0 %. With a solar (PWM2)
  pump that means "stop", in addition to the relay cutting its mains.
  (For heating-profile pumps 0 % means full speed; there the relay is
  what stops them. The documentation for the outputs must say so.)
- Per output a 3-way terminal: **PWM, GND, FB**, in the cable's order
  (brown, blue, black).

### 4.2 Pump feedback inputs

- Two, one per PWM output. Same circuit as on the stripboard: 4.7 kΩ
  pull-up to 3.3 V at the terminal, 10 kΩ series resistor, 1 nF to GND at
  the GPIO.
- Optional per output in software; an unconnected input reads as
  constant high and is ignored.

### 4.3 Pt1000 inputs

- **Two MAX31865** (SSOP-20, hand-solderable), each with its own 4.3 kΩ
  0.1 % reference resistor, the input filter from the datasheet and ESD
  protection on the terminal.
- 2-wire connection by default; solder jumpers for 3-wire sensors.
- On SPI0, with the two hardware chip selects: CE0 (pin 24) for #1, CE1
  (pin 26) for #2.
- The `DRDY` outputs are not connected; OSCoST polls once per second.

### 4.4 1-Wire bus

- **DS2482-100** I²C-to-1-Wire bridge on I2C1 (pins 3/5). Active pull-up
  and proper timing in hardware, so long cables and many sensors work.
- 3.3 V sensor supply with a polyfuse, ESD protection on DQ.
- Two or three 3-way terminals (VDD, DQ, GND) in parallel, so sensors
  can be wired as several short spurs.

### 4.5 Relay / SSR control outputs

- **Two outputs.** Each is a low-side N-MOSFET switching the negative side
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

- OSCoST toggles a **heartbeat GPIO** once per successful control cycle
  (sensors read, decision made, outputs written).
- A **retriggerable monostable** (e.g. 74LVC1G123) keeps `WD_OK` high as
  long as edges keep arriving; about 2–3 s without an edge and `WD_OK`
  drops. A GPIO stuck high or stuck low counts as "no heartbeat", because
  only edges retrigger it.
- `WD_OK` switches the relay supply (high-side load switch) and gates the
  PWM signals (4.1).
- After power-up `WD_OK` is low until the software starts sending
  heartbeats, so nothing runs while the Pi boots.
- LED "watchdog OK". A test point and a jumper to disable the gating for
  bench tests (clearly marked, open by default).
- This is the "external heartbeat" layer from
  [Safety](ARCHITECTURE.md#41-hardware-layer-independent-of-software); the
  SoC watchdog and the systemd watchdog remain in addition.

### 4.7 Power

| Rail | Source | Users | Estimated current |
|---|---|---|---|
| 5 V | Pi header pins 2/4 | DC/DC, relay supply, LEDs | < 300 mA with two relay coils, < 100 mA with SSRs |
| 12 V | DC/DC on the HAT (1 W) | TC4427, PWM outputs | < 30 mA |
| 3.3 V | Pi header pins 1/17 | MAX31865 × 2, DS2482, DS18x20 sensors, pull-ups | < 30 mA |

The Pi's own supply has to cover this on top of the board itself: a
5 V / 3 A supply for a Pi 4, 5 V / 5 A for a Pi 5.

## 5. Pin assignment

The same on the Raspberry Pi 4 and Pi 5. Only the PWM chip and channel
numbers behind GPIO 18/19 differ, which is software configuration.

| Function | Header pin | Pi 4 | Pi 5 |
|---|---|---|---|
| I²C SDA / SCL (DS2482) | 3 / 5 | I2C1 | I2C1 |
| SPI MOSI / MISO / SCLK | 19 / 21 / 23 | SPI0 | SPI0 |
| SPI CE0 (MAX31865 #1) | 24 | GPIO 8 | GPIO 8 |
| SPI CE1 (MAX31865 #2) | 26 | GPIO 7 | GPIO 7 |
| PWM 1 | 12 | GPIO 18, PWM0 channel 0 | GPIO 18, RP1 PWM0 channel 2 |
| PWM 2 | 35 | GPIO 19, PWM0 channel 1 | GPIO 19, RP1 PWM0 channel 3 |
| Feedback 1 | 16 | GPIO 23 | GPIO 23 |
| Feedback 2 | 36 | GPIO 16 | GPIO 16 |
| Heartbeat | 18 | GPIO 24 | GPIO 24 |
| Relay 1 | 22 | GPIO 25 | GPIO 25 |
| Relay 2 | 29 | GPIO 5 | GPIO 5 |
| ID EEPROM | 27 / 28 | ID_SD / ID_SC | ID_SD / ID_SC |
| 5 V | 2, 4 | | |
| 3.3 V | 1, 17 | | |
| GND | 6, 9, 14, 20, 25, 30, 34, 39 | | |

Both PWM outputs need a two-channel PWM overlay. Which one works on the
Pi 5 (`pwm-2chan` or two `pwm` entries) is checked during bring-up; see
also [Testing the output](HARDWARE.md#testing-the-output).

## 6. Field connectors

All along one edge, pluggable 5.08 mm terminal blocks, labelled on the
silkscreen:

| Connector | Pins | Function |
|---|---|---|
| PUMP1 | PWM, GND, FB | pump 1 signal cable (brown, blue, black) |
| PUMP2 | PWM, GND, FB | pump 2 signal cable |
| PT1 | +, − | Pt1000 sensor 1 (collector) |
| PT2 | +, − | Pt1000 sensor 2 |
| 1W-A, 1W-B (, 1W-C) | 3V3, DQ, GND | DS18x20 sensors |
| REL1 | +5V, OUT | SSR / relay 1 (pump mains) |
| REL2 | +5V, OUT | SSR / relay 2 |

## 7. Manufacturing

- **Design tool:** KiCad. Project in `hardware/hat/` in this repository,
  with schematic, layout, and Gerber/BOM exports for each released
  revision.
- **Manufacturer:** AISLER (Germany). 2-layer, 1.6 mm, HASL, Budget
  service. Their price is a job fee plus a price per cm² and board; for a
  65 × 56.5 mm board (about 37 cm²) a set of 3 bare boards is about
  €19 net at the time of writing (check their current pricing).
- **Design rules:** AISLER's KiCad design rules, imported before routing.
- **Parts:** SMD where hand-soldering is still easy (0805 passives, SOIC,
  SSOP), through-hole for connectors and the header. That keeps both paths
  open: hand assembly, or AISLER's assembly service if the price is right
  for 3 boards (D7).
- **Checks before ordering:** KiCad ERC and DRC clean, every net compared
  against the stripboard circuits, footprints of the MAX31865, DS2482 and
  DC/DC checked against their datasheets, a 1:1 paper print to check
  connector and mounting-hole positions on the real Pi.

## 8. Bring-up plan (rev A)

1. Visual check, then resistance checks between all rails before power.
2. Power from the Pi without any field devices: 5 V, 12 V, 3.3 V.
3. Watchdog: `WD_OK` low after boot, high while a test script toggles the
   heartbeat, low again 2–3 s after it stops.
4. Relay outputs with an LED/resistor as dummy load, with and without
   heartbeat.
5. PWM outputs into a 1 kΩ dummy load, then the real pump (as in
   [Connecting the pump](HARDWARE.md#connecting-the-pump)).
6. Pt1000 inputs with fixed resistors (1000 Ω = 0 °C, 1385 Ω ≈ 100 °C),
   then real sensors.
7. 1-Wire bus scan with one, then several DS18x20.
8. Repeat steps 2–7 on the other board (Pi 4 ↔ Pi 5).

## 9. Open decisions

| # | Question | Proposal |
|---|---|---|
| D1 | 12 V (DC/DC) or 5 V driver supply? | **12 V**: the HAT is meant to run for years; the margin is worth one DC/DC module |
| D2 | One or two PWM outputs? | **Two**: the TC4427 has two channels anyway, the second costs a few parts |
| D3 | How many Pt1000 inputs? | **Two** (collector + one spare). More would need more chip selects |
| D4 | DS2482 or plain `w1-gpio`? | **DS2482-100**: robust with long cables and many sensors |
| D5 | Power the Pi from the HAT (5 V terminal + ideal diode)? | **No** for rev A: the Pi keeps its USB-C supply. Back-powering needs protection, and the Pi 5 then limits USB current without extra configuration |
| D6 | Fit the HAT ID EEPROM? | Footprint only; fit later if automatic configuration on the Pi is wanted |
| D7 | Hand assembly or AISLER assembly? | Decide when the BOM exists and AISLER quotes the assembly |
