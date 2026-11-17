# OSCoST HAT: specification

Status: **specification agreed, rev A not yet designed**. This page
defines what the HAT has to do before anything is drawn in KiCad. The
decisions behind it are listed at the end.

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
- The **5 V power input for the whole controller**: the DIN-rail supply
  feeds the HAT, and the HAT powers the Pi through the header
- Hardware watchdog that switches all relay outputs off when the software
  stops
- Protection on every connection that leaves the board, status LEDs

**Not on the HAT, deliberately:**

- **Anything with 230 V.** The SSR or relay that switches the pump, the
  5 V power supply and the fuse sit on a DIN rail in the enclosure, wired
  by an electrician. The HAT only sends the relay a low-voltage control
  signal and receives the supply's 5 V output.

## 2. Target boards and form factor

| | |
|---|---|
| Boards | Raspberry Pi 4, Raspberry Pi 5 |
| Size | Raspberry Pi HAT: 65 × 56.5 mm, 4 × M2.5 mounting holes matching the Pi |
| Header | 40-pin female, with a stacking/extra-tall header option for the Pi 5 active cooler |
| Connectors | Field connections on the left and bottom edges, pluggable 3.5 mm terminal blocks (see 7) |
| Component height | Low enough for a standard enclosure; the DC/DC module is the tallest part |
| ID EEPROM | Footprint for the Raspberry Pi HAT ID EEPROM on pins 27/28, not fitted in rev A (D6) |

### Mockup

Top view to scale. The placement shows that everything fits; the real
layout is done in KiCad.

![HAT mockup, top view](img/hat-mockup.svg)

## 3. Block diagram

```
                40-pin header
 ┌──────────────────┼──────────────────────────────────────────────────────┐
 │                  │                                                      │
 │  PWR 5 V in ─► fuse, TVS, ideal diode ─► 5 V ─► Pi (pins 2/4) + HAT     │
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

### 4.7 Power input (powers the Pi)

The DIN-rail 5 V supply connects to a terminal on the HAT. The HAT feeds
its own circuits and, through header pins 2 and 4, the Pi. The Pi's USB-C
input stays unused in operation.

**Powering through the Pi's USB-C works too.** All HAT circuits sit on the
header side of the protection, so they run from whichever supply powers
the 5 V rail: the PWR terminal, or a supply in the Pi's USB-C socket (the
HAT then draws its few hundred mA through header pins 2/4, as any HAT
does). That is the easy way on the bench; in the installation the PWR
terminal saves a separate USB-C supply. **Use one supply at a time**: the
ideal diode keeps current from flowing back into the PWR terminal, but the
Pi's USB-C input is not designed to be fed backwards from the header.

Feeding 5 V into the header **bypasses the Pi's own input protection**, so
the HAT has to provide it:

- **Fuse** at the input (5 A slow-blow or a polyfuse of similar rating).
- **TVS diode** against overvoltage spikes from the supply (e.g. SMBJ5.0A).
- **Ideal diode** (a controller with an external MOSFET, low drop at 5 A):
  protects against reversed polarity at the terminal, and prevents
  back-feeding when the Pi's USB-C is also plugged in, for example on the
  bench. A plain Schottky diode would drop too much voltage.
- **Power LED** after the protection.

Limits and settings:

- The header's 5 V connections carry about **4.5 A**. That is enough for
  the Pi, the HAT and light USB use; OSCoST needs no power-hungry USB
  devices.
- **Raspberry Pi 5:** without USB power negotiation it assumes a 3 A
  supply, limits the USB ports to 600 mA and refuses to boot from USB.
  With a 5 A supply, set `PSU_MAX_CURRENT=5000` in the bootloader EEPROM
  configuration (`sudo rpi-eeprom-config --edit`); some Pi 5 boards don't
  boot from GPIO power at all until this is set. The OSCoST install
  instructions must include this step.
- **Raspberry Pi 4:** no setting needed.
- Supply: a regulated **5.1 V** DIN-rail supply, 3 A for a Pi 4 and 5 A
  for a Pi 5, so the voltage at the Pi stays above 5 V after the
  protection circuit.

### 4.8 Power budget

| Rail | Source | Users | Estimated current |
|---|---|---|---|
| 5 V | HAT power input (from the DIN-rail supply) | **the Pi**, DC/DC, relay supply, LEDs | Pi 4 up to 3 A, Pi 5 up to 5 A; HAT itself < 300 mA with two relay coils, < 100 mA with SSRs |
| 12 V | DC/DC on the HAT (1 W) | TC4427, PWM outputs | < 30 mA |
| 3.3 V | Pi header pins 1/17 | MAX31865 × 2, DS2482, DS18x20 sensors, pull-ups | < 30 mA |

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
| 5 V (HAT → Pi) | 2, 4 | | |
| 3.3 V | 1, 17 | | |
| GND | 6, 9, 14, 20, 25, 30, 34, 39 | | |

Both PWM outputs need a two-channel PWM overlay. Which one works on the
Pi 5 (`pwm-2chan` or two `pwm` entries) is checked during bring-up; see
also [Testing the output](HARDWARE.md#testing-the-output).

## 6. Raspberry Pi configuration

What has to be enabled on the Pi for the HAT. The OSCoST installer will
set this up; listed here so it can be checked by hand.

**`/boot/firmware/config.txt`**

```ini
# SPI0 for the two MAX31865 (CE0, CE1)
dtparam=spi=on
# I2C1 for the DS2482-100
dtparam=i2c_arm=on

# Relay outputs and heartbeat: outputs, driven low as early as possible
gpio=24,25,5=op,dl

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

**Pi 5 bootloader EEPROM** (only when powered through the HAT's PWR
terminal with a 5 A supply, see 4.7):

```sh
sudo rpi-eeprom-config --edit     # add: PSU_MAX_CURRENT=5000
```

**Not needed:**

- No 1-Wire overlay: OSCoST talks to the DS2482 directly over
  `/dev/i2c-1`.
- No overlays for the feedback inputs: they are read as GPIO edge events
  through the GPIO character device.
- With the ID EEPROM fitted later (D6), the overlays above could be
  loaded automatically.

**Also on the system side:**

- The OSCoST service user needs access to `/dev/gpiochip*`, `/dev/spidev0.*`,
  `/dev/i2c-1` and `/sys/class/pwm` (groups `gpio`, `spi`, `i2c` on
  Raspberry Pi OS).
- The SoC hardware watchdog is armed through systemd
  (`RuntimeWatchdogSec=` in `/etc/systemd/system.conf`), in addition to the
  HAT's own watchdog.

## 7. Field connectors

22 terminal positions don't fit along one 65 mm edge: at 5.08 mm pitch
they would need about 112 mm. So the connectors use **3.5 mm pluggable
terminal blocks** on **two edges**, as in the [mockup](#mockup):

- **Bottom edge** (power and outputs): PWR, REL1, REL2, PUMP1, PUMP2.
- **Left edge** (sensors): PT1, PT2, 1W-A, 1W-B.
- The top edge holds the 40-pin header. The right edge stays free: on the
  Pi, the USB and Ethernet sockets sit right next to it.

All labelled on the silkscreen:

| Connector | Pins | Function |
|---|---|---|
| PWR | +5V, GND | from the DIN-rail 5 V supply; powers HAT and Pi |
| PUMP1 | PWM, GND, FB | pump 1 signal cable (brown, blue, black) |
| PUMP2 | PWM, GND, FB | pump 2 signal cable |
| PT1 | +, − | Pt1000 sensor 1 (collector) |
| PT2 | +, − | Pt1000 sensor 2 |
| 1W-A, 1W-B | 3V3, DQ, GND | DS18x20 sensors |
| REL1 | +5V, OUT | SSR / relay 1 (pump mains) |
| REL2 | +5V, OUT | SSR / relay 2 |

## 8. Manufacturing

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

## 9. Bring-up plan (rev A)

1. Visual check, then resistance checks between all rails before power.
2. Power input on its own, without the Pi: a lab supply with current
   limit at the PWR terminal; check 5 V after the ideal diode, then
   reversed polarity (nothing may conduct).
3. With the Pi, powered only through the HAT: Pi boots (Pi 5 with
   `PSU_MAX_CURRENT=5000`), 12 V and 3.3 V present. Then additionally plug
   in the Pi's USB-C: no current may flow back into the PWR terminal.
4. Watchdog: `WD_OK` low after boot, high while a test script toggles the
   heartbeat, low again 2–3 s after it stops.
5. Relay outputs with an LED/resistor as dummy load, with and without
   heartbeat.
6. PWM outputs into a 1 kΩ dummy load, then the real pump (as in
   [Connecting the pump](HARDWARE.md#connecting-the-pump)).
7. Pt1000 inputs with fixed resistors (1000 Ω = 0 °C, 1385 Ω ≈ 100 °C),
   then real sensors.
8. 1-Wire bus scan with one, then several DS18x20.
9. Repeat steps 3–8 on the other board (Pi 4 ↔ Pi 5).

## 10. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | 12 V (DC/DC) or 5 V driver supply? | **12 V**: the HAT is meant to run for years; the margin is worth one DC/DC module |
| D2 | One or two PWM outputs? | **Two**: the TC4427 has two channels anyway |
| D3 | How many Pt1000 inputs? | **Two** (collector + one spare), on the two hardware chip selects |
| D4 | DS2482 or plain `w1-gpio`? | **DS2482-100**: robust with long cables and many sensors |
| D5 | Power the Pi from the HAT? | **Yes**: one supply cable for everything, with fuse, TVS and ideal diode on the HAT (4.7) |
| D6 | Fit the HAT ID EEPROM? | **Footprint only**; fit later if automatic configuration is wanted |
| D7 | Hand assembly or AISLER assembly? | **Decide on the AISLER quote** once the BOM exists; all parts are hand-solderable |
