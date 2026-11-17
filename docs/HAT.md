# OSCoST HAT: specification

Status: **specification agreed, rev A not yet designed**. This page
defines what the HAT has to do before anything is drawn in KiCad. The
decisions behind it are listed at the end.

The HAT combines the circuits from [Hardware needed](HARDWARE.md) on one
board that plugs onto the 40-pin header. No stripboard version is built
for the reference installation, so HAT rev A is the first hardware on the
real system: the bring-up plan (section 9) tests every block on its own,
and the pump only gets connected once its output and the watchdog have
been checked on the bench.

The HAT comes in **two editions** that share everything except the
sensor inputs:

- **1-Wire edition** (sections 1–10): 1 Pt1000 input (collector) plus two
  1-Wire buses for DS18x20 sensors. For new installations and anyone
  replacing their sensors.
- **PT edition** ([section 11](#11-pt-edition-8--pt1000)): up to 8 Pt1000
  inputs and no 1-Wire, for installations that keep their existing
  Pt1000 sensors, as most commercial controllers use them.

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
| Connectors | Field connections on the left and bottom edges, fixed 3.5 mm screw terminals (see 7) |
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
 │  GPIO 4, 17 ─► pull-ups ─► 1-Wire bus A, B ◄────────────────── DS18x20  │
 │                                                                         │
 │  LEDs: power, watchdog OK, relay 1, relay 2                             │
 └─────────────────────────────────────────────────────────────────────────┘
```

### Circuit diagrams (rev A)

Drawn from this specification as a reference for the KiCad project; the
KiCad schematic will be the reference for the board itself. Faded parts
are footprints that are not fitted in rev A. Regenerate with
`python3 tools/hw/hat_schematic.py docs/img`.

![Power input, 12 V supply and header](img/hat-sch-power.svg)

![Watchdog, PWM pump outputs and feedback inputs](img/hat-sch-pwm.svg)

![Relay supply and relay outputs](img/hat-sch-relay.svg)

![Pt1000 and 1-Wire inputs](img/hat-sch-sensors.svg)

Part choices the drawings add to the text below (all to be confirmed
when the BOM is made): ideal diode LM74700-Q1 with an N-MOSFET such as
CSD17575Q3; relay supply switch TPS22918; AND gates 74LVC1G08; relay
MOSFETs AO3400A with 1N4148W flyback diodes; ESD diodes PESD5V0 on the
sensor inputs; 100 mA polyfuse for the 1-Wire sensor supply; a 1.5 kΩ
minimum load on the 12 V output, which keeps the unregulated DC/DC below
the 13 V TVS standoff at light load.

## 4. Functions

### 4.1 PWM pump outputs

- **Two output positions**, one per TC4427 channel. **Rev A fits only
  PUMP1** (solar pump). PUMP2 (its series resistor, TVS, AND gate,
  feedback parts and terminal) stays unfitted, as a spare for a later
  store-loading or heating pump (D2).
- **Fitted in any case:** the 100 kΩ pull-down on the TC4427's channel B
  input, so the unused input is held low and never floats.
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

- One per PWM output (FB2 unfitted in rev A, with PUMP2). Same circuit as on the stripboard: 4.7 kΩ
  pull-up to 3.3 V at the terminal, 10 kΩ series resistor, 1 nF to GND at
  the GPIO.
- Optional per output in software; an unconnected input reads as
  constant high and is ignored.

### 4.3 Pt1000 inputs

- **Two MAX31865 positions** (SSOP-20, hand-solderable), each with its own
  4.3 kΩ 0.1 % reference resistor, the input filter from the datasheet and
  ESD protection on the terminal. **Rev A fits only #1 (PT1, collector).**
  #2 and its PT2 terminal stay unfitted: a second collector sensor, the
  hot flow line or precise heat metering can be added later without a new
  board.
- **The collector needs a Pt1000:** the cable to the roof usually has only
  two wires, which is exactly what a Pt1000 needs. A DS18x20 would need
  three (normal powered mode) and only goes up to 125 °C. The cable's
  resistance shows up as a small fixed offset (about 0.25 K for 20 m of
  0.75 mm²), corrected by the per-sensor calibration value.
- 2-wire connection by default; solder jumpers for 3-wire sensors.
- On SPI0, with the two hardware chip selects: CE0 (pin 24) for #1, CE1
  (pin 26) for #2.
- The `DRDY` outputs are not connected; OSCoST polls once per second.

### 4.4 1-Wire bus

- **Two independent 1-Wire buses**, driven by the kernel's `w1-gpio`
  driver: bus A on GPIO 4 (pin 7), bus B on GPIO 17 (pin 11). Up to about
  5 sensors per bus. A fault on one bus (damaged cable, short) only takes
  out the sensors on that bus.
- Per bus: 4.7 kΩ pull-up to 3.3 V, ESD protection on DQ, and a 3-way
  terminal (3V3, DQ, GND).
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

- OSCoST toggles a **heartbeat GPIO** once per successful control cycle
  (sensors read, decision made, outputs written).
- A **retriggerable monostable** (e.g. 74LVC1G123) keeps `WD_OK` high as
  long as edges keep arriving; about 2–3 s without an edge and `WD_OK`
  drops. A GPIO stuck high or stuck low counts as "no heartbeat", because
  only edges retrigger it. The 74LVC1G123 retriggers on rising edges
  only: with one toggle per 1 s control cycle a rising edge arrives every
  2 s, so the timeout is set to about 3 s.
- `WD_OK` switches the relay supply (high-side load switch) and gates the
  PWM signals (4.1).
- After power-up `WD_OK` is low until the software starts sending
  heartbeats, so nothing runs while the Pi boots.
- LED "watchdog OK". A test point and a jumper to disable the gating for
  bench tests (clearly marked, open by default).
- **Why it is worth the ~€3:** the Pi's own hardware watchdog and systemd
  catch a hung kernel or a crashed OSCoST, but not a fault in the
  switching hardware. DIN-rail SSRs typically fail short-circuited, which
  would leave the pump powered permanently. The watchdog-gated PWM is then
  a second, independent way to stop the pump (0 % = stop with a PWM2
  pump), and the feedback input shows that it happened (D8).
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
| 5 V | HAT power input (from the DIN-rail supply) | **the Pi**, DC/DC, relay supply, LEDs | Pi 4 up to 3 A, Pi 5 up to 5 A; HAT itself < 200 mA with a relay coil, < 100 mA with an SSR (per extra fitted relay output up to +100 mA) |
| 12 V | DC/DC on the HAT (1 W) | TC4427, PWM outputs | < 30 mA |
| 3.3 V | Pi header pins 1/17 | MAX31865 × 2, DS18x20 sensors, pull-ups | < 30 mA |

## 5. Pin assignment

The same on the Raspberry Pi 4 and Pi 5. Only the PWM chip and channel
numbers behind GPIO 18/19 differ, which is software configuration.

| Function | Header pin | Pi 4 | Pi 5 |
|---|---|---|---|
| 1-Wire bus A | 7 | GPIO 4 | GPIO 4 |
| 1-Wire bus B | 11 | GPIO 17 | GPIO 17 |
| I²C SDA / SCL (DS2482, only if fitted) | 3 / 5 | I2C1 | I2C1 |
| SPI MOSI / MISO / SCLK | 19 / 21 / 23 | SPI0 | SPI0 |
| SPI CE0 (MAX31865 #1) | 24 | GPIO 8 | GPIO 8 |
| SPI CE1 (MAX31865 #2, only if fitted) | 26 | GPIO 7 | GPIO 7 |
| PWM 1 | 12 | GPIO 18, PWM0 channel 0 | GPIO 18, RP1 PWM0 channel 2 |
| PWM 2 (only if fitted) | 35 | GPIO 19, PWM0 channel 1 | GPIO 19, RP1 PWM0 channel 3 |
| Feedback 1 | 16 | GPIO 23 | GPIO 23 |
| Feedback 2 (only if fitted) | 36 | GPIO 16 | GPIO 16 |
| Heartbeat | 18 | GPIO 24 | GPIO 24 |
| Relay 1 | 22 | GPIO 25 | GPIO 25 |
| Relay 2 (only if fitted) | 29 | GPIO 5 | GPIO 5 |
| ID EEPROM | 27 / 28 | ID_SD / ID_SC | ID_SD / ID_SC |
| 5 V (HAT → Pi) | 2, 4 | | |
| 3.3 V | 1, 17 | | |
| GND | 6, 9, 14, 20, 25, 30, 34, 39 | | |

The config below enables both PWM channels and all relay pins, so a later
fitted PUMP2 or REL2 needs no configuration change. Both PWM channels need a two-channel PWM overlay. Which one works on the
Pi 5 (`pwm-2chan` or two `pwm` entries) is checked during bring-up; see
also [Testing the output](HARDWARE.md#testing-the-output).

## 6. Raspberry Pi configuration

What has to be enabled on the Pi for the HAT. The OSCoST installer will
set this up; listed here so it can be checked by hand.

**`/boot/firmware/config.txt`**

```ini
# SPI0 for the two MAX31865 (CE0, CE1)
dtparam=spi=on
# Two 1-Wire buses for the DS18x20 sensors (external pull-ups on the HAT;
# no "pullup" parameter, which would mean parasite power)
dtoverlay=w1-gpio,gpiopin=4
dtoverlay=w1-gpio,gpiopin=17

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

- No I²C, unless the optional DS2482 is fitted (then `dtparam=i2c_arm=on`
  instead of the two `w1-gpio` lines).
- No overlays for the feedback inputs: they are read as GPIO edge events
  through the GPIO character device.
- With the ID EEPROM fitted later (D6), the overlays above could be
  loaded automatically.

**Also on the system side:**

- The OSCoST service user needs access to `/dev/gpiochip*`, `/dev/spidev0.*`,
  `/sys/bus/w1` and `/sys/class/pwm` (groups `gpio` and `spi` on Raspberry
  Pi OS).
- The SoC hardware watchdog is armed through systemd
  (`RuntimeWatchdogSec=` in `/etc/systemd/system.conf`), in addition to the
  HAT's own watchdog.

## 7. Field connectors

22 terminal positions don't fit along one 65 mm edge: at 5.08 mm pitch
they would need about 112 mm. So the connectors use **fixed 3.5 mm screw
terminals** on **two edges**, as in the [mockup](#mockup):

- **Bottom edge** (power and outputs): PWR, REL1, REL2, PUMP1, PUMP2 (REL2 and PUMP2 not fitted in rev A).
- **Left edge** (sensors): PT1, PT2, 1W-A, 1W-B.
- The top edge holds the 40-pin header. The right edge stays free: on the
  Pi, the USB and Ethernet sockets sit right next to it.

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
| PWR | +5V, GND | from the DIN-rail 5 V supply; powers HAT and Pi |
| PUMP1 | PWM, GND, FB | pump 1 signal cable (brown, blue, black) |
| PUMP2 | PWM, GND, FB | pump 2 signal cable (not fitted in rev A) |
| PT1 | +, − | Pt1000 sensor 1 (collector) |
| PT2 | +, − | Pt1000 sensor 2 (not fitted in rev A) |
| 1W-A, 1W-B | 3V3, DQ, GND | DS18x20 sensors |
| REL1 | +5V, OUT | SSR / relay 1 (pump mains) |
| REL2 | +5V, OUT | SSR / relay 2 (not fitted in rev A) |

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
  through-hole only for the terminals, the 40-pin header and the DC/DC.
  Parts are chosen from what the assembler stocks: for JLCPCB that means
  LCSC part numbers in the BOM, "basic" parts where possible, since every
  other part type adds a feeder fee. Packages stay hand-solderable (0805,
  SOIC, SSOP), so a board can still be repaired or built by hand.
- **Assembler:** decided on real quotes once the KiCad BOM exists: AISLER
  (boards and assembly from Germany) against JLCPCB (cheapest for small
  runs, ships from China).
- **Checks before ordering:** KiCad ERC and DRC clean, every net compared
  against the stripboard circuits, footprints of the MAX31865, DS2482 and
  DC/DC checked against their datasheets, a 1:1 paper print to check
  connector and mounting-hole positions on the real Pi.

### 8.1 Cost estimate (rev A as fitted, per board)

Single-quantity distributor prices without VAT, at the time of writing.
Only the MAX31865 price is checked (DigiKey, €8.76 for one); the rest are
estimates until the BOM exists. Unfitted positions are not counted, nor
are the Pi, the DIN-rail supply, the SSR and the sensors.

| Part | Qty | ≈ € |
|---|---|---|
| MAX31865AAP+ (Pt1000 converter) | 1 | 8.80 |
| PCB, ⅓ of an AISLER set of 3 (≈ €19) | — | 6.50 |
| B0512S-1WR3 DC/DC | 1 | 3.00 |
| 40-pin stacking header and 4 spacers | 1 | 3.00 |
| 3.5 mm fixed screw terminals (J1, J2, J4, J6, J8, J9) | 6 | 3.00 |
| Ideal diode: LM74700-Q1 + CSD17575Q3 | 2 | 2.50 |
| Resistors and capacitors, about 25 (the 0.1 % 4.3 kΩ is about €0.80 of it) | — | 2.50 |
| TC4427 | 1 | 1.30 |
| 5 A SMD fuse | 1 | 1.00 |
| TPS22918 | 1 | 0.60 |
| LEDs | 3 | 0.50 |
| 74LVC1G123 | 1 | 0.40 |
| SMBJ13A, SMBJ5.0A | 2 | 0.40 |
| PESD5V0 ESD diodes | 4 | 0.40 |
| 74LVC1G08 | 1 | 0.20 |
| 100 mA polyfuse | 1 | 0.20 |
| AO3400A, 1N4148W | 2 | 0.20 |
| **Total** | | **≈ 35** |

The watchdog with AND gate and relay supply switch is about €1.50–2 of
this (D8). Pluggable terminals would add about €4 (D10).

### 8.2 Fully assembled: rough estimate

Factory assembly adds fixed costs per order, so the price per board
depends mostly on how many boards are ordered. A rough JLCPCB estimate
for the fitted rev A (about 250 SMD joints and 60 through-hole joints
per board, about 15 part types that are not "basic"), incl. shipping and
19 % import VAT:

| Boards | ≈ € total | ≈ € per board |
|---|---|---|
| 2 (their minimum for economic assembly) | 105 | 52 |
| 5 | 165 | 33 |

Built from JLCPCB's published fees: setup fee, per-joint fees for SMD and
through-hole, a feeder fee per non-basic part type, a hand-soldering fee
per order, plus the parts at LCSC prices. AISLER's assembly price is not
estimated here; it gets quoted with the BOM.

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
5. Relay output REL1 with an LED/resistor as dummy load, with and without
   heartbeat.
6. PWM output PUMP1 into a 1 kΩ dummy load, then the real pump (as in
   [Connecting the pump](HARDWARE.md#connecting-the-pump)).
7. Pt1000 input with fixed resistors (1000 Ω = 0 °C, 1385 Ω ≈ 100 °C),
   then the real collector sensor on its 2-wire cable.
8. 1-Wire bus scan on both buses, with one, then five DS18x20 each. On
   the Pi 5, check that `w1-gpio` works reliably through the RP1 chip;
   otherwise fit the DS2482.
9. Repeat steps 3–8 on the other board (Pi 4 ↔ Pi 5).

## 10. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | 12 V (DC/DC) or 5 V driver supply? | **12 V**: the HAT is meant to run for years; the margin is worth one DC/DC module |
| D2 | One or two PWM outputs and relay outputs? | **Two positions each, one fitted**: PUMP1 and REL1 for the solar pump; PUMP2 and REL2 stay unfitted until a second pump is added |
| D3 | How many Pt1000 inputs? | **Two on the board, one fitted**: PT1 for the collector; PT2 (MAX31865 #2, its parts and terminal) stays unfitted until needed |
| D4 | DS2482 or plain `w1-gpio`? | **`w1-gpio` on two buses** (GPIO 4 and 17), sensors in powered mode, DS2482 footprint as unfitted fallback. Keeps I²C out of normal use |
| D5 | Power the Pi from the HAT? | **Yes**: one supply cable for everything, with fuse, TVS and ideal diode on the HAT (4.7) |
| D6 | Fit the HAT ID EEPROM? | **Footprint only**; fit later if automatic configuration is wanted |
| D7 | Hand assembly or factory assembly? | **Factory-assembled, delivered fully soldered**; AISLER or JLCPCB decided on quotes once the BOM exists (8.2) |
| D8 | Keep the external watchdog and PWM gating? | **Yes**: about €3 in parts for a second, independent way to stop the pump, e.g. when the SSR fails short-circuited |
| D9 | Keep the MAX31865 or measure the Pt1000 more cheaply? | **Keep the MAX31865**: timing a capacitor charge with a GPIO is too inaccurate under Linux, and a small SPI ADC saves only about €6 but loses the ±45 V input protection on the roof cable and the sensor fault detection |
| D10 | Pluggable or fixed screw terminals? | **Fixed**: about €4 per board cheaper; the HAT rarely comes off, and then the wires are unscrewed |
| D11 | VBus receiver on the HAT? | **No**: VBus is only needed while the BX Plus is still connected (shadow mode, switchable phase). The existing loose adapter plugs onto pins 1, 6 and 10 on top of the stacking header until then; after the switch-over it goes away and the UART is free |
| D12 | Offer a Pt1000-only HAT? | **Yes, as a second edition** of the same board (section 11): same outline and shared KiCad sheets for power, pump, relay and watchdog; only the sensor sheet differs. Measured with up to 8 × MAX31865 rather than one multi-channel ADC, whose input protection would need two pins per sensor and distort 2-wire readings |

---

## 11. PT edition (8 × Pt1000)

For installations that keep their Pt1000 sensors: a controller such as
the RESOL BX Plus measures every sensor as a 2-wire Pt1000, and those
sensors already sit in their sleeves with their cables in place.

Status: **specified, not scheduled.** The reference installation uses
the 1-Wire edition; the PT edition gets designed when someone needs it.
At that point, measuring with **2 × ADS124S08** instead of 8 × MAX31865
is worth evaluating: 10 channels, about €20 less per assembled board and
more room on the board, at the cost of a new analog circuit (force and
sense pin per sensor so the input protection doesn't distort the
reading, one shared 0.1 % reference resistor per chip) and a more
complex driver.

![OSCoST HAT PT edition mockup](img/hat-pt-mockup.svg)

### 11.1 What differs from the 1-Wire edition

| | 1-Wire edition | PT edition |
|---|---|---|
| Pt1000 inputs | 1 (PT1), PT2 footprint not fitted | **up to 8 (S1–S8)**, fit 2, 4 or 8 |
| 1-Wire | 2 buses (GPIO4, GPIO17) | none |
| Sensor terminals | PT1 2-way, 1W-A/1W-B 3-way | **one two-level block, 8 positions**: upper and lower level of position *n* are the two wires of sensor S*n* |
| Chip selects | CE0 (CE1 for PT2) | CE0 through a **74LVC138** 1-of-8 decoder |
| 3-wire jumpers | JP2–JP4 | none: 2-wire only (FORCE+ tied to RTDIN+, RTDIN− to FORCE−, FORCE2 to GND) |
| Everything else | power input, 12 V, PUMP1/2, REL1/2, watchdog, AND gates, feedback, header, EEPROM footprint | **identical** |

### 11.2 Pt1000 channels

Each channel is the PT1 circuit of the 1-Wire edition (section 4.3,
[circuit diagram](img/hat-sch-sensors.svg)) in its 2-wire form:
MAX31865, 4.3 kΩ 0.1 % reference resistor, 10 nF across the RTD inputs,
100 nF at VDD and DVDD, PESD5V0 ESD diode on each terminal wire. All
eight share SCLK, MOSI and MISO (SPI0); unfitted channels leave MISO
undriven.

### 11.3 Chip select through a decoder

The Pi has only two hardware chip selects. The 74LVC138 turns three GPIOs
into eight:

| Decoder pin | Connected to | Pi pin |
|---|---|---|
| A0, A1, A2 | GPIO4, GPIO17, GPIO27 (free in this edition) | 7, 11, 13 |
| /E1 (enable) | CE0 = GPIO8 | 24 |
| /E2 | GND | |
| E3 | +3V3 | |
| /Y0 … /Y7 | CS of MAX31865 S1 … S8 | |

OSCoST sets A0–A2 to the channel number, then runs the SPI transfer on
CE0: the kernel's own chip select enables the decoder, so the timing stays
exact and only the addressed chip sees it. While CE0 is idle (high) every
output is high and no chip is selected, also while the Pi boots. CE1
(GPIO7) stays free.

Raspberry Pi configuration: as in section 6, without the two
`w1-gpio` lines, and with `gpio=4,17,27=op,dl` added.

### 11.4 Software

- OSCoST **detects the fitted channels** at start: it writes and reads
  back the configuration register of each address; an unfitted channel
  answers with 0x00 or 0xFF.
- The board edition is chosen in the setup wizard (Settings → Hardware);
  sensor S*n* is channel *n*.
- Each MAX31865 runs in automatic conversion mode with the 50 Hz mains
  filter; OSCoST reads all channels once per second.

### 11.5 Space and cost

- **Space:** eight SSOP-20 chips with their reference resistors fit where
  the 1-Wire edition has PT1, PT2, the DS2482 footprint and the 1-Wire
  parts (see the mockup). Tight but plausible on one side; checked with a
  real placement in KiCad before the PT edition is committed.
- **Cost** with 8 channels, compared with the 1-Wire edition (section
  8.1): plus 7 × (MAX31865 + reference resistor + capacitors + ESD), the
  decoder and the two-level block; minus the 1-Wire parts and two
  terminals.

| | 1-Wire edition | PT edition, 8 channels |
|---|---|---|
| Parts, single quantity (DigiKey) | ≈ €35 | ≈ €105 |
| Assembled, 5 boards (JLCPCB, incl. VAT and shipping) | ≈ €33 per board | ≈ €65–70 per board |

The MAX31865 is the cost driver (€8.80 at DigiKey, about €4 at LCSC for
assembled boards). Fitting only 4 channels saves about 4 × €5 per board
when assembled.

