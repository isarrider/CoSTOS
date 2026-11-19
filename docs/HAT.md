# CoSTOS HAT: specification

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
sensor inputs, plus a cheaper **Lite build** of the first
([section 12](#12-lite-build-decided-d19)):

- **1-Wire edition** (sections 1–10): 1 Pt1000 input (collector) plus two
  1-Wire buses for DS18x20 sensors. For new installations and anyone
  replacing their sensors.
- **PT edition** ([section 11](#11-pt-edition-8--pt1000)): 8 Pt1000
  inputs on one LTC2983 plus one 1-Wire bus, for installations that keep
  their existing Pt1000 sensors, as most commercial controllers use them,
  and still want to add DS18x20 sensors.

### Which HAT? All editions compared

One table for choosing. Details: 1-Wire edition sections 1–10, Lite build
[12](#12-lite-build-decided-d19), PT edition [11](#11-pt-edition-8--pt1000),
costs [8.2](#82-fully-assembled-rough-estimate). Prices are estimates
until a real BOM exists. 🟢 good, 🟡 medium, 🔴 weak or missing.

| | **1-Wire edition** | **1-Wire, Lite build** | **PT edition** |
|---|---|---|---|
| **Best for** | new installations, or replacing the sensors anyway | a tight budget with a solar-profile pump | keeping the existing Pt1000 sensors (e.g. replacing a RESOL) |
| ***Sensors*** | | | |
| Pt1000 inputs | 🟡 1 (collector), 1 spare position | 🟡 1 (collector), 1 spare position | 🟢 **8** (S1–S8, LTC2983) |
| 1-Wire buses for DS18x20 | 🟢 2 | 🟢 2 | 🟡 1 |
| ***Outputs*** | | | |
| PUMP1, PWM with feedback | 🟢 12 V drive, ≈ 10.6 V at the pump | 🟡 5 V drive, ≈ 4.7 V at the pump (threshold ~4 V) | 🟢 12 V drive |
| PWM frequency | 🟢 settable, 100–1000 Hz ([ARCHITECTURE](ARCHITECTURE.md#pwm-frequency-settable-per-output)) | 🟢 same | 🟢 same |
| REL1 (cut-off relay, valve, on/off load) | 🟢 yes | 🔴 not fitted | 🟢 yes |
| Pumps | 🟢 solar profile; heating profile with a cut-off relay | 🟡 solar profile only | 🟢 solar profile; heating profile with a cut-off relay |
| Unfitted spare positions | PT2, PUMP2, REL2, DS2482 | the same, plus REL1 and the DC/DC | PUMP2, REL2 |
| ***The same on all*** | | | |
| Watchdog with PWM gating, field-line protection, power from the Pi, PWR / WD / PUMP1 LEDs, silkscreen cheat sheet, size and tall header | 🟢 | 🟢 | 🟢 |
| ***Cost*** (incl. 19 % VAT unless noted) | | | |
| **Price for one** (smallest assembled order: 2 boards) | ≈ €81 | 🟢 **≈ €64** | 🔴 ≈ €149 |
| Assembled, per board in a group order of 5 | ≈ €24 | 🟢 ≈ €17.50 | 🔴 ≈ €58 |
| Build it yourself (parts + 3 bare PCBs) | ≈ €49 | 🟢 ≈ €43 | 🔴 ≈ €90 |
| Parts for one board (excl. VAT) | ≈ €28.60 | ≈ €24.10 | ≈ €63.60 (LTC2983 ≈ €39 of it) |
| **Against the 1-Wire edition, price for one** | — | 🟢 **saves ≈ €17** | 🔴 **≈ €68 more** |
| ***Building and status*** | | | |
| Hardest part to solder (only when building it yourself) | 🟡 MAX31865, SSOP-20 at 0.65 mm pitch | 🟡 same as the 1-Wire edition | 🔴 LTC2983, LQFP-48 at 0.5 mm pitch |
| Upgrade later | — | 🟢 to the normal build: fit the DC/DC block (U2, C3, C4, R2, R25; remove R26), change R9 and D4, fit the REL1 parts | — |
| Status | 🟡 rev A, designed first | 🟡 same board as the 1-Wire edition | 🔴 planned as the second board |

---

## 1. Scope

**On the HAT** (low voltage only, 3.3 V / 5 V / 12 V):

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
| Component height | Low enough for a standard enclosure; the DC/DC module is the tallest part |
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

### 2.1 Considered: Waveshare ESP32-P4-WIFI6-DEV-KIT

The Waveshare ESP32-P4-WIFI6-DEV-KIT has the Pi form factor and a
40-pin header, so a microcontroller version could in principle use the
same HAT. The pin maps were checked against each other (header
silkscreen and the board schematic, November 2026):

- 5 V, 3.3 V and GND are on the same pins as on the Pi.
- The board's 3.3 V buck (MP1658, 3 A) has plenty of headroom; the HAT
  needs under 50 mA.
- The USB inputs appear to be ORed through a P-MOSFET and a Schottky
  diode. Same rule as on the Pi: one supply at a time.
- I²C (pins 3/5, GPIO7/8) is shared with the on-board audio codec. It
  only matters if the DS2482 is ever fitted.

Three HAT signals land on pins the P4 board uses itself:

| HAT signal | Pi header pin | P4 GPIO there | Used on the P4 board for | Free P4 pin instead |
|---|---|---|---|---|
| SCLK | 23 | GPIO0 | 32.768 kHz crystal (via R29, 0 Ω) | 37 (GPIO47) |
| REL1 | 22 | GPIO1 | 32.768 kHz crystal (via R33, 0 Ω) | 31 (GPIO26) |
| PWM2 (unfitted) | 35 | GPIO53 | audio amplifier enable (via R73, 0 Ω) | 33 (GPIO48) |

There are two ways to fit the HAT to the P4:

- **Move the three signals.** The HAT then no longer works on a Pi,
  because the Pi's SPI clock is fixed to pin 23.
- **Remove R29/R33 on every P4 board.** This costs the board's RTC
  crystal, and PWM2 still has to move.

**Decision D14: CoSTOS stays on the Raspberry Pi.** More people already
own one, and Linux gives more flexibility for the web interface,
VictoriaMetrics buffering, updates and add-ons. The P4 stays a possible
later port. If it is ever done, the "move the three signals" variant
above is the starting point. The full cost and capability comparison of the Pi
against the ESP32-S3, RP2350 and ESP32-P4, and the P4 boards considered,
are in [ARCHITECTURE 13](ARCHITECTURE.md#13-platform-comparison-pi-or-microcontroller).

### Raspberry Pi 3

The Pi 3 B and B+ have the same 40-pin header, HAT size and mounting holes,
and the same PWM, SPI and 1-Wire blocks as the Pi 4, so the HAT and the
software should work unchanged. **Untested**: it gets checked in bring-up
(9) if a Pi 3 is at hand. For someone with a spare Pi 3 it is the cheapest
way in: with the Lite build, the HAT is then the only purchase.

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
 │  5 V ──► DC/DC 5→12 V ──► 12 V ─┐                                       │
 │                                 ▼                                       │
 │  PWM1 ─► switches Q4·Q5 (AND WD_OK) ─► Q6 / Q7 ─► R ─► TVS ──► Pump 1   │ PWM / GND / FB
 │  PWM2 ─► same chain, not fitted ─► R ─► TVS ─────────────────► Pump 2   │ PWM / GND / FB
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
 │  LEDs: power, watchdog OK, pump 1, relay 1, relay 2                     │
 └─────────────────────────────────────────────────────────────────────────┘
```

### Circuit diagrams (rev A)

Drawn from this specification as a reference for the KiCad project; the
KiCad schematic will be the reference for the board itself. Faded parts
are footprints that are not fitted in rev A. Regenerate with
`python3 tools/hw/hat_schematic.py docs/img`.

![5 V from the Pi, 12 V supply and header](img/hat-sch-power.svg)

![Watchdog, PWM pump outputs and feedback inputs](img/hat-sch-pwm.svg)

![Relay supply and relay outputs](img/hat-sch-relay.svg)

![Pt1000 and 1-Wire inputs](img/hat-sch-sensors.svg)

Part choices the drawings add to the text below (all to be confirmed
when the BOM is made): relay supply switch TPS22918; pump driver from MMBT3904/MMBT3906
transistors (D22); relay
MOSFETs AO3400A with 1N4148W flyback diodes; ESD diodes PESD5V0 on the
sensor inputs; 100 mA polyfuse for the 1-Wire sensor supply; a 1.5 kΩ
minimum load on the 12 V output, which keeps the unregulated DC/DC below
the 13 V TVS standoff at light load.

## 4. Functions

### 4.1 PWM pump outputs

- **Two output positions. Rev A fits only PUMP1** (solar pump). PUMP2
  (its transistors, resistors, TVS, feedback parts and terminal) stays
  unfitted, as a spare for a later store-loading or heating pump (D2).
- **The driver is a transistor chain (H3, D22)**, from basic parts only:

  ```
              +V_DRV (12 V normal / 5 V Lite)
                │
              ┌─┴── R36 2.2 kΩ
              ├──┤ Q6 MMBT3906 PNP "to the supply" ──► R9 ──┬───────► J2 PWM
     PWM_OFF  │                                            ├── D4 TVS
              │                                            ├──┤ Q7 MMBT3904 "pull-down"
             R35 2.7 kΩ                                    │     base from PWM_OFF via R37 10 kΩ
              │                                            ├── R38 10 kΩ to GND
 PWM1 ─R33 10 kΩ─► Q4 MMBT3904  "PWM switch"               └── R31/R32 readback → GPIO 6
 WD_OK ─R34 10 kΩ─► Q5 MMBT3904 "watchdog switch"
              │
             GND
  ```

  **Two switches in a row, one switch to the supply, one to ground.** Q4
  (the PWM) and Q5 (the watchdog) in series are the watchdog AND: only
  when both are on is node PWM_OFF pulled low, Q6 switches the output to
  +V_DRV and Q7 is off. If either is off, R36 pulls PWM_OFF high, Q6 turns
  off and Q7 pulls the terminal actively to 0 V = stop. R7 (100 kΩ) holds
  PWM1 low while the Pi boots. Q7 sits behind R9, so the brief moment when
  Q6 and Q7 overlap while switching is limited by R9 like a shorted cable.
  Why this chain and what it replaced: alternatives table below; the
  original AND gate + TC4427 chain stays on the rev A prototype as a
  jumper-selected fallback until the tests below confirm H3.
- P6KE15A-class TVS at the terminal (SMD equivalent with the same
  breakdown voltage, SMBJ13A; not lower, since the unregulated 12 V can
  reach 13.5 V), R9 470 Ω, R7 at the input (D1); Lite values below.
- **R9 and D4 depend on the build**, like R25/R26, because the pump's
  input draws current (about 3 mA, up to 7.5 mA) and R9 takes voltage
  away before the signal reaches the pump:

  | | Normal build (12 V driver) | Lite build (5 V driver) |
  |---|---|---|
  | R9 | 470 Ω | **100 Ω** |
  | Lost across R9 at 3 mA | 1.4 V | 0.3 V |
  | At the pump (needs ≥ 3.6 V at 3 mA, ~4 V to be safe) | ≈ 10.6 V | ≈ 4.7 V |
  | Current into a shorted cable | ≈ 25 mA | ≈ 50 mA |
  | D4 (TVS) | SMBJ13A: conducts just above the 12 V rail | **SMBJ6.0A**: conducts just above 5 V; a 13 V diode would never protect a 5 V driver |

  With 470 Ω on a 5 V driver the pump would see only ≈ 3.6 V, its bare
  minimum. Same values as the stripboard driver boards in HARDWARE.md (470 Ω
  / 15 V TVS on the 12 V board, 100 Ω / 6.8 V TVS on the 5 V board). With
  the transistor chain the output sits ≈ 0.15 V below +V_DRV, so the pump
  sees ≈ 10.5 V (normal) and ≈ 4.55 V (Lite).
- **Output readback** (any driver chain): a divider from the PWM terminal
  (behind R9) to a GPIO lets CoSTOS see what really leaves the board.
  PUMP1 on GPIO 6 (pin 31), PUMP2 on GPIO 26 (pin 37, unfitted with
  PUMP2). R31 (top, build-dependent like R9) and R32 8.2 kΩ to GND:

  | | Normal (12 V) | Lite (5 V) |
  |---|---|---|
  | R31 | 27 kΩ | 6.8 kΩ |
  | At the GPIO when high | ≈ 2.8 V (≈ 3.1 V at 13.5 V) | ≈ 2.7 V |
  | Load on the output | ≈ 0.34 mA | ≈ 0.33 mA |

  CoSTOS uses it twice (ARCHITECTURE 6.2, "PWM output check"):
  continuously, the line must be low when 0 % is commanded and its duty
  (measured from edge timestamps, like the feedback input) must match the
  command; and at every start, a **watchdog self-test**: PWM set high,
  heartbeat stopped, the line must drop to 0 V within about 3 s. That
  catches a shorted transistor in the chain (or, on the prototype's
  fallback chain, a stuck driver or AND gate) directly, and a silently lost watchdog layer before it matters. The
  pump runs for at most those 3 s.
- **R9 package: at least 0.5 W** (e.g. 1210 or 2010). With a shorted pump
  cable it dissipates ≈ 0.3 W (normal) or ≈ 0.25 W (Lite) for as long as
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

#### Driver chain: alternatives considered (D22)

The chain from GPIO 18 to the terminal (step by step in
[12.3](#123-the-pump-signal-step-by-step-lite-build)) has four jobs: raise
3.3 V to at least 3.6 V (≈ 4.7 V wanted) at the pump, deliver its input
current (up to 7.5 mA), go to 0 V when the watchdog trips, and survive a
shorted or disturbed cable. The original design used an AND gate and a
TC4427, ≈ €8.60 per order of two boards in parts and JLCPCB fees; the
transistor chain H3 replaced it as the default. Pump voltages for the
Lite build at 3 mA; "price for one" against today.

| Option | How | Pump voltage | Watchdog / fail behaviour | Robust on the cable | Price for one | Verdict |
|---|---|---|---|---|---|---|
| A: AND gate + TC4427 (original design) | 74LVC1G08 gates the PWM with WD_OK, TC4427 drives | 🟢 ≈ 4.7 V | 🟢 AND gate forces 0 V; pull-down at boot | 🟢 TC4427 takes shorts and spikes | — | 🟡 **prototype fallback** (jumper on rev A) |
| B: one 5 V gate (74AHCT1G08), Lite only | TTL inputs accept 3.3 V, 5 V output, does the AND itself | 🟡 ≈ 4.1 V (R9 ≥ 220 Ω for its 25 mA limit); ≈ 3.4 V at 7.5 mA, below the minimum | 🟢 as A | 🟡 a logic gate on the field cable | ≈ −€5.40 (Lite) | 🔴 no margin; the normal build still needs the TC4427, so two footprints |
| C: driver with enable input (UCC27524) instead of AND gate + TC4427 | WD_OK to the enable pins; pin-compatible with the TC4427 (its NC pins 1/8 are ENA/ENB) | 🟢 ≈ 4.7 V | 🔴 enable pins pulled **up** internally (200 kΩ): open = enabled, so safety depends on an external pull-down; gating and driving in one chip. Under-voltage lockout only below ≈ 3.8 V (3.5–4.1 V), so no help between 4.5 and 4 V | 🟢 like the TC4427 | ≈ −€3.60 (≈ −€1.30 per board in a group of 5) | 🔴 reviewed and dropped (below) |
| D: transistor + pull-up to 5 V | Transistor pulls down, resistor pulls up | 🔴 1 kΩ pull-up: ≈ 2 V at the pump | 🔴 inverts: Pi stopped or transistor open = **full speed** | 🟡 | ≈ −€5.50 | 🔴 unsafe fail direction |
| E: discrete push-pull | Totem pole from basic transistors, no fees | 🟢 ≈ 4.5 V | 🟡 safety logic from transistors, needs careful checking | 🟡 | ≈ −€5.00 | 🔴 5–7 parts in the safety path instead of one proven chip |
| F: Pi GPIO directly | Through a resistor | 🔴 3.3 V, below 3.6 V | 🔴 no gating | 🔴 Pi pin on the field cable | ≈ −€8.60 | 🔴 doesn't work |
| G: level-shifter chip (TXS0101 etc.) | 3.3 V → 5 V translator | 🔴 made for logic inputs, not mA loads | 🟡 | 🔴 | ≈ −€2 | 🔴 |
| **H2: three transistors instead of AND gate + TC4427** | Two NPNs in series (PWM and watchdog: "two switches in a row") drive a PNP high-side switch; pull-down and a small ESD diode at the terminal | 🟢 ≈ 4.3 V (Lite), ≈ 7–8 V (normal) | 🟢 open parts end in 0 V; 🟡 three parts can fail short | 🟡 small ESD diode instead of the 600 W TVS | ≈ −€8.60 | 🟡 superseded by H3 |
| **H3: H2 plus an active pull-down transistor at the terminal** | As H2; a third transistor behind R9 pulls the terminal low whenever Q2 is off | 🟢 ≈ 4.55 V (Lite), ≈ 10.5 V (normal) | 🟢 open parts end in 0 V; the new transistor fails to "stop" or "slower edge" | 🟢 the 600 W TVS stays | **≈ −€8.55** | 🟢 **default** (D22); confirmed on the rev A prototype (below) |
| H: two transistors instead of the TC4427 (AND gate stays) | NPN pulls the base of a PNP high-side switch down; a resistor pulls the output low | 🟢 ≈ 4.6 V | 🟢 non-inverting, open parts end in 0 V; two parts instead of one can fail "stuck high" | 🟡 relies on D4 and R9; 40 V transistors | ≈ −€5.30 | 🔴 the resistor pull-down is too slow against D4's capacitance; a fix needs a third transistor (below) |

**Option C in detail, and why it was dropped.** Checked against TI's
UCC27524 datasheet:

| Benefit | Weight |
|---|---|
| One JLCPCB fee fewer: ≈ −€3.60 for one, ≈ −€1.30 per board in a group of 5 | 🟡 small |
| One chip fewer in the chain | 🟢 small |
| A later PUMP2 needs no second AND gate (ENB gates channel B) | 🟡 only if PUMP2 is fitted |
| Outputs held low when the supply collapses below ≈ 3.8 V (TC4427: undefined below 4.5 V) | 🟡 between 4.5 and 3.8 V both behave the same |
| Stronger, faster output (5 A peak) | ⚪ irrelevant at the pump's few mA |

| Drawback | Weight |
|---|---|
| Enable pins default to **enabled** (internal pull-up): against the rule "anything missing = stop". Needs an external pull-down; one fault (pull-down missing or WD_OK broken) is still safe, both together are not | 🔴 |
| Watchdog gating and driving in one chip: less easy to test and explain than a separate gate whose output can be measured on its own | 🟡 |
| SMD only: the stripboard boards (HARDWARE.md) use the TC4427 in DIP-8, so HAT and stripboards would no longer share driver, tests and experience | 🟡 |
| New, less proven part in this project; new bring-up tests and documentation | 🟡 |
| Same 4.5 V minimum supply: no help for the Lite build's margin (12.1 point 5) | ⚪ |
| A shared footprint for both options would double the variants (normal/Lite × A/C) and add another either/or rule (AND gate vs its 0 Ω bypass) | 🔴 |

The benefit is almost only money, the drawbacks touch the safety concept.
If the real JLCPCB quote shows the fees matter more, the better lever is a
basic-part equivalent of the AND gate: same circuit, no fee.

**Option H in detail: two transistors instead of the TC4427.** Worked out
because it is simpler to explain and uses only basic parts (no JLCPCB fee).
The AND gate stays, so the watchdog logic is unchanged.

```
               +V_DRV (5 V Lite / 12 V normal)
                 │
               ┌─┴── R3 2.2 kΩ (holds Q2 off)
               │  ┌── emitter
               ├──┤ Q2 MMBT3906 (PNP)
        R2     │  └── collector ──┬──► R9 → D4 → J2 PWM
        2.7 kΩ │                  │
               │                R4 pull-down
 AND ─R1 10 kΩ─► Q1 MMBT3904 (NPN)│
               │                 GND
              GND
```

| Value | Lite (5 V) | Normal (12 V) |
|---|---|---|
| Q1 base current (R1, from 3.3 V) | 0.26 mA | 0.26 mA |
| Q2 base current (R2, minus 0.3 mA in R3) | ≈ 1.2 mA | ≈ 3.8 mA |
| Q2 load while high: pump (≤ 7.5 mA) + R4 + PUMP1 LED | ≈ 14 mA | ≈ 24 mA |
| Q2 saturated? (forced gain ≤ 12, MMBT3906 h_FE ≥ 60) | 🟢 yes | 🟢 yes |
| Output high / at the pump (3 mA through R9) | ≈ 4.85 V / ≈ 4.55 V | ≈ 11.9 V / ≈ 10.5 V |
| Shorted cable: Q2 current | ≈ 55 mA, ≈ 0.05 W in Q2 | ≈ 37 mA |
| Parts against the TC4427 | Q1, Q2, R1–R4 (6) instead of TC4427, C7, C8, R8 (4) | same |
| Price for one | ≈ −€5.30 (TC4427 and its fee gone) | same |

What speaks for it: everything is a basic part; it is easy to explain
("one transistor switches the other"); open parts end in 0 V = stop; the
transistors are rated 40 V, against the TC4427's 22 V absolute maximum,
so overvoltage from the cable has more headroom. Both a small-signal
transistor and a small driver IC have very low failure rates; in the field
the risk is overvoltage on the cable, which favours the 40 V parts.

What sinks it, in this simple form: **the falling edge.** Only R4 pulls the
line low, and it has to discharge the TVS diode D4 through R9. D4 is not a
small part electrically: an SMBJ6.0A has about 3.85 nF of junction
capacitance (at 0 V; less with voltage applied), the SMBJ13A about 1 nF,
plus ≈ 0.3 nF of cable. With R4 = 1 kΩ that gives a time constant of ≈ 4.6 µs in the Lite build, a
10–90 % edge of ≈ 10 µs, against the edge rule of ≤ T/500 (4 µs at
500 Hz, ARCHITECTURE 5.3). A smaller R4 wastes current (470 Ω: 10 mA at
5 V, 25 mA and 0.3 W at 12 V) and is still borderline. Pulling the line
low actively needs a third transistor (a push-pull output), with care
against both output transistors conducting at once during switching:
then it is about eight parts, no longer simpler than one TC4427.

**Result for H:** in this form the TC4427 is the simpler solution: one
part with a real push-pull output, both edges driven in ≈ 25 ns.

**Option H2: three transistors replace AND gate and TC4427 (candidate).**
H fails only on the falling edge, and that can be fixed without a third
output transistor: move the pull-down to the terminal side and use a
small protection diode. The watchdog AND moves into transistors as well,
so the whole pump chain needs no part with a JLCPCB fee.

```
              +V_DRV (5 V Lite / 12 V normal)
                │
              ┌─┴── R3 2.2 kΩ (holds Q2 off)
              ├──┤ Q2 MMBT3906 PNP ──► R9 ──┬──► J2 PWM
              │                             ├── R4 1 kΩ to GND (at the terminal)
             R2 2.7 kΩ                      └── D4: small ESD/TVS diode to GND
              │
 PWM1 ─R1a 10 kΩ─► Q1a MMBT3904   "PWM switch"
              │
 WD_OK ─R1b 10 kΩ─► Q1b MMBT3904  "watchdog switch"
              │
             GND
```

Q2 switches the output to the supply only when **both** Q1a (the PWM) and
Q1b (the watchdog) are on: an AND made of two switches in a row. R7 stays
as the boot pull-down on PWM1.

| | AND gate + TC4427 (rev A design) | H2 |
|---|---|---|
| Parts in the chain | U4, U6, C7, C8, R8 (5) | Q1a, Q1b, Q2, R1a, R1b, R2, R3, R4 (8) |
| Parts with a JLCPCB fee | 2 | **0** (all basic) |
| **Price for one** | — | **≈ −€8.60** (≈ 10 % of €90, ≈ 12 % of €73) |
| Group order of 5 | — | ≈ −€2.60 per board |
| Pump voltage at 3 mA | ≈ 4.7 V Lite, ≈ 10.6 V normal | ≈ 4.3 V Lite, ≈ 7–8 V normal (R9/R4 divider): above the 3.6 V minimum in both |
| Falling edge | driven, ≈ 25 ns + R9 into D4 | R4 discharges cable and diode directly: ≈ 1.3 µs with ≈ 0.6 nF |
| Rising edge | through R9 into D4 | through R9 into the small diode: ≈ 0.3 µs (Lite), ≈ 1.3 µs (normal) |
| Edge rule ≤ T/500 met up to | ≈ 1.5–2.2 kHz (D4 capacitance) | ≈ 1.5 kHz: **the 100–1000 Hz range stays** |
| Wasted current while high | ≈ 4 mA (driver) | ≈ 4.5 mA (Lite), ≈ 8 mA (normal) in R4 |
| Overvoltage rating of the active parts | 22 V (TC4427 abs. max) | 40 V (transistors) |
| Cable protection | 600 W TVS (SMBJ) | small ESD/TVS diode, a few hundred pF: enough for static and switching spikes on a 3 m cable, less margin for large surges |
| Single faults ending in "full speed" | AND gate output stuck high, TC4427 output stage short | Q2 short; Q1a short (while the watchdog is OK). Q1b short silently removes the watchdog layer |
| Proven in this project | stripboard boards, measurements | new |

Why it is attractive: cheapest (no fee in the pump chain), easy to
explain ("two switches in a row, then one switch to the supply"), 40 V
parts. Why it is not decided: it changes driver, watchdog gating and
cable protection at once, all in the safety path, and the smaller
protection diode is the open question for a boiler room, where the pump's
signal cable often runs next to its 230 V cable.

**Option H3: H2 plus an active pull-down (the default).** Nearly
all of H2's weak points come from the resistor that pulls the line low.
A third transistor at the terminal does that job actively:

```
              +V_DRV (5 V / 12 V)
                │
              ┌─┴── R36 2.2 kΩ
              ├──┤ Q6 MMBT3906 PNP ──► R9 ──┬──────────────► J2 PWM
       node PWM_OFF │                             ├── D4 SMBJ (600 W TVS), as today
              │                             ├──┤ Q7 MMBT3904 NPN "pull-down switch"
              │                             │     base from node PWM_OFF via R37 10 kΩ
             R35 2.7 kΩ                      └── R38 10 kΩ to GND (keeps the line defined)
              │
 PWM1 ─R33 10 kΩ─► Q4 MMBT3904   "PWM switch"
 WD_OK ─R34 10 kΩ─► Q5 MMBT3904  "watchdog switch"
              │
             GND
```

Both switches on: node PWM_OFF goes low, Q6 switches the output to the supply,
Q7 has no base current and is off. Either switch off: R36 pulls node PWM_OFF
high, Q6 turns off and Q7 turns on and pulls the terminal actively to 0 V.

| | H2 | **H3** |
|---|---|---|
| Falling edge | R4 discharges cable and diode: ≈ 1.3 µs | Q7 discharges them directly: well under 1 µs |
| Cable protection | small ESD diode (open question) | **the 600 W SMBJ TVS stays**: the fall is active, the rise through R9 is the same as with the TC4427 |
| Pump voltage at 3 mA | ≈ 4.3 V / ≈ 7–8 V (R9/R4 divider) | ≈ 4.55 V / ≈ 10.5 V (no divider) |
| Wasted current while high | ≈ 4.5 / 8 mA | ≈ 0.5 / 1.2 mA (R38 10 kΩ) |
| Frequency range | 100–1000 Hz | 100–1000 Hz (the rise through R9 into the TVS sets it, as with the TC4427) |
| Parts with a JLCPCB fee | 0 | 0 |
| Price for one vs AND gate + TC4427 | ≈ −€8.60 | ≈ −€8.55 (one transistor and one resistor more) |

**Shoot-through:** while switching, Q6 and Q7 can both be on for about a
microsecond (a saturated transistor needs that long to switch off).
Because Q7 sits behind R9, that current is limited by R9 to the same
≈ 50 mA (Lite) / ≈ 25 mA (normal) a shorted cable causes, which the design
already takes; at 1000 Hz it is a few µs per period and no heat to speak
of.

**Fail behaviour, part by part:**

| Part | Breaks open | Breaks short |
|---|---|---|
| Q4 (PWM switch) | 🟢 stop | 🔴 follows only the watchdog: full speed while CoSTOS runs (caught by the output readback, 4.1) |
| Q5 (watchdog switch) | 🟢 stop | 🟡 works, but the watchdog layer is silently gone (caught by the readback self-test at start) |
| Q6 (to the supply) | 🟢 stop | 🔴 stuck high: full speed (caught by the readback and the pump feedback) |
| Q7 (pull-down) | 🟡 slower falling edge through R38; pump still runs and stops | 🟢 output stuck at 0 V = stop; R9 limits the current |

The dangerous and the silent faults exist in the AND gate + TC4427 chain
too, inside the chips; the readback (4.1) catches them in either chain.

**Possible later:** "digital" transistors with built-in resistors (e.g.
DTC114 / DTA114) or dual transistors in one package would cut the parts
from nine to about five; only worth it if JLCPCB has them as basic parts,
checked with the BOM.

**4 kHz is not possible with H2 or H3 either:** the edge rule needs ≤ 0.5 µs at
4 kHz; R4 would have to be ≈ 300 Ω (≈ 40 mA and 0.5 W at 12 V). No listed
pump needs more than 1 kHz, so the range stays 100–1000 Hz.

**Test on the rev A prototype, not on a stripboard.** The first assembled
order (rev A) is a prototype anyway (bring-up plan, section 9). It carries
**both chains** (H3 and, as the fallback, AND gate + TC4427), populated by
JLCPCB, selected by solder jumpers (prototype only; the released board
keeps one chain and no jumpers):

1. Both chains on the same board, switched by jumper, measured with the
   same pump and cable: high level at J2 and at the pump (3 mA and with
   the pump's maximum current), rise and fall time at 1000 Hz.
2. Watchdog: with H3, the output must go to 0 V within ≈ 3 s after the
   heartbeat stops, measured at J2 and seen by the output readback.
3. Fail behaviour by hand: lift R33, R34, R35, R37 one at a time (output
   must stay at 0 V); lift Q7 (output still stops, slower falling edge);
   short Q4, Q5, Q7 (document the effect; the readback must report Q4 and
   the self-test Q5).
4. Shoot-through: current from +V_DRV during switching at 1000 Hz, and
   the temperature of Q6, Q7 and R9 after an hour.
5. Bursts: switch the pump's 230 V (and a nearby contactor or the boiler)
   on and off many times with the signal cable laid next to the mains
   cable; the PWM output and the pump must not react, and nothing may fail.
6. ESD with the HAT powered: discharges to the J2 terminals (by hand from
   a charged body, or with an ESD gun if one can be borrowed).

H3 is the default; if it fails these tests, the released board goes back
to the AND gate + TC4427. The extra cost of carrying both on the prototype
(two more fees for one order) is less than a second prototype order.

### 4.2 Pump feedback inputs

- One per PWM output (FB2 unfitted in rev A, with PUMP2). Same circuit as on the stripboard: 4.7 kΩ
  pull-up to 3.3 V at the terminal, 10 kΩ series resistor, 1 nF to GND at
  the GPIO.
- **ESD diode (PESD5V0, D17) as the first part at the terminal's FB pin**,
  like on every other input: it catches static discharges from the cable
  before they reach the GPIO. In normal operation (0–3.3 V) it does
  nothing. If the PWM and FB wires are swapped, it clamps the 12 V to
  about 6 V, so only about 0.3 mA reaches the GPIO through the 10 kΩ.
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

- CoSTOS toggles a **heartbeat GPIO** once per successful control cycle
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

- **Supply:** the official Raspberry Pi USB-C supply (27 W for the Pi 5,
  15 W for the Pi 4) or an equivalent; for a Pi 3 its micro-USB supply
  (5.1 V, 2.5 A). **No phone chargers or long, thin USB cables**: the
  Lite build's pump driver runs on this 5 V and has only about 0.5 V of
  margin (12.1, point 5). The Pi 5 negotiates 5 A over USB
  power delivery, so no `PSU_MAX_CURRENT` setting is needed.
- **DIN-rail builds** (ARCHITECTURE 5.6 options B/C): a 5 V DIN-rail
  supply feeds the Pi through a short USB-C lead (5.1 V, 3 A for a Pi 4,
  5 A for a Pi 5; a Pi 5 on a plain USB-C lead without power delivery
  needs `PSU_MAX_CURRENT=5000` in its bootloader configuration).
- **Earlier design** (rev A drafts before D18): a PWR terminal with fuse,
  TVS and an LM74700 ideal diode powered the Pi through the header. It was
  dropped because option A never uses it; it saved about €4 and nine parts.

### 4.8 Status LEDs

The LEDs are CoSTOS's only local display (no screen, general rule). All
of them are driven by hardware and show the real state even if the
software is wrong; none needs an overlay or any software.

| LED | Colour | Driven by | Shows |
|---|---|---|---|
| PWR | green | 5 V rail | the HAT has power |
| WD | green | watchdog output WD_OK | heartbeat seen, outputs enabled (4.6) |
| **PUMP1** | green | driver output (Q6) via 2.2 kΩ | what really reaches the pump: off = stop, brighter = faster |
| R1 | yellow | relay output 1 | relay or SSR switched on |
| PUMP2, R2 | | | only with the unfitted second channels |

**LED type: forward voltage ≈ 2 V** (red, yellow, orange, or the classic
yellow-green "green"), not the bright pure green with ≈ 3 V. The WD LED
runs from 3.3 V: with a 2 V LED it gets ≈ 1.3 mA, with a 3 V LED only
≈ 0.3 mA, which is barely visible. The PUMP1 resistor is 2.2 kΩ so the LED
stays visible in the Lite build too (5 V driver):

| LED | Supply | Resistor | Current (Vf ≈ 2 V) |
|---|---|---|---|
| PWR | 5 V | 1 kΩ | ≈ 3 mA |
| WD | 3.3 V | 1 kΩ | ≈ 1.3 mA |
| PUMP1 | 12 V (normal) / ≈ 4.9 V (Lite) | 2.2 kΩ | ≈ 4.5 mA / ≈ 1.3 mA at 100 %, times the duty cycle |
| R1 | 5 V | 1 kΩ | ≈ 3 mA |

Alarms are shown on the web page, as metrics and (optionally) over MQTT,
not on an LED. The LEDs face up; a closed enclosure needs a window or
light pipes above them.

### 4.9 Power budget

| Rail | Source | Users | Estimated current |
|---|---|---|---|
| 5 V | Pi header pins 2/4 (from the Pi's USB-C supply) | DC/DC, relay supply, LEDs | HAT < 200 mA with a relay coil, < 100 mA with an SSR (per extra fitted relay output up to +100 mA) |
| 12 V | DC/DC on the HAT (1 W) | pump driver chain, PWM output | < 30 mA |
| 3.3 V | Pi header pins 1/17 | MAX31865 × 2, DS18x20 sensors, pull-ups | < 30 mA |

## 5. Pin assignment

The same on the Raspberry Pi 3, Pi 4 and Pi 5. Only the PWM chip and
channel numbers behind GPIO 18/19 differ, which is software configuration.

| Function | Header pin | Pi 3 / Pi 4 | Pi 5 |
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
| PWM readback 1 | 31 | GPIO 6 | GPIO 6 |
| PWM readback 2 (only if fitted) | 37 | GPIO 26 | GPIO 26 |
| Heartbeat | 18 | GPIO 24 | GPIO 24 |
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
# SPI0 for the two MAX31865 (CE0, CE1)
dtparam=spi=on
# Two 1-Wire buses for the DS18x20 sensors (external pull-ups on the HAT;
# no "pullup" parameter, which would mean parasite power)
dtoverlay=w1-gpio,gpiopin=4
dtoverlay=w1-gpio,gpiopin=17

# Relay outputs and heartbeat: outputs, driven low as early as possible
gpio=24,25,5=op,dl
# PWM output readback: inputs with pull-down
gpio=6,26=ip,pd

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
- **Front (bottom) edge** (rarely used or not fitted): REL1, REL2, PT2,
  PUMP2 (REL2, PT2 and PUMP2 not fitted in rev A). The PT edition: REL1,
  REL2, 1W-A, PUMP2. There is no power terminal (D18).
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
| PT2 | A, B | Pt1000 sensor 2 (not fitted in rev A) |
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
| Top, small notes | LED names, "12 V" at R25 and "5 V (Lite)" at R26, both values at R9 and D4, outlines of unfitted parts, edition and revision | assembly, checking the LEDs | 🟢 |
| Bottom, cheat sheet | Table of all terminals with pins and use, pump wire colours (brown · blue · black), the three safety rules (solar-profile pump only, no 230 V on the board, never R25 and R26 together), LED meanings, tick boxes for normal or Lite build, repository URL | before mounting, or with the HAT off | 🟡 hidden once on the Pi |
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
are the Pi, its USB-C supply, an optional relay and the sensors.

| Part | Qty | ≈ € |
|---|---|---|
| MAX31865AAP+ (Pt1000 converter) | 1 | 8.80 |
| PCB, ⅓ of an AISLER set of 3 (≈ €19) | — | 6.50 |
| B0512S-1WR3 DC/DC | 1 | 3.00 |
| 40-pin stacking header and 4 spacers | 1 | 3.00 |
| 3.5 mm fixed screw terminals (PT1, 1W-A, 1W-B, PUMP1, REL1) | 5 | 2.50 |
| Resistors and capacitors, about 25 (the 0.1 % 4.3 kΩ is about €0.80 of it) | — | 2.50 |
| TPS22918 | 1 | 0.60 |
| LEDs (PWR, WD, PUMP1, R1) | 4 | 0.65 |
| 74LVC1G123 | 1 | 0.40 |
| SMBJ13A | 1 | 0.20 |
| PESD5V0 ESD diodes (PT1 × 2, 1W-A, 1W-B, FB1) | 5 | 0.50 |
| Pump driver transistors: MMBT3904 × 3, MMBT3906 × 1 (D22) | 4 | 0.08 |
| 100 mA polyfuse | 1 | 0.20 |
| AO3400A, 1N4148W | 2 | 0.20 |
| **Total** | | **≈ 28.60** |

Without the power input (D18); with it the list came to ≈ €34. With the
original AND gate + TC4427 driver instead of the transistor chain (D22)
it was ≈ €30. The watchdog with AND gate and relay supply switch is about €1.50–2 of
this (D8). Pluggable terminals would add about €4 (D10). The PT edition's
list is in [11.5](#115-space-and-cost).

### 8.2 Fully assembled: rough estimate

Factory assembly has fixed costs per order, so the price depends mostly
on how many boards are ordered. **Most people want one controller**, but
JLCPCB's smallest economic assembly order is 2 boards, so "price for one"
below means the total of that smallest order; the second board is a spare
(or for a friend).

Rough JLCPCB estimates, incl. shipping and 19 % import VAT, built from
their published fees (setup fee, per-joint fees for SMD and through-hole,
a feeder fee of about €2.80 per non-basic part type, a hand-soldering fee
per order) plus the parts at LCSC prices. Model: a **fixed part per
order** (≈ €54.40 for the normal build, ≈ €48.40 for the Lite build with
two non-basic part types fewer) plus a **variable part per board**
(≈ €13.30 normal, ≈ €7.80 Lite, ≈ €47.30 PT edition with the consigned
LTC2983). Without the power input (D18) and with the transistor driver
chain (D22), which each removed two non-basic part types.

**What one controller costs**, by how you get the board (estimates, all
incl. 19 % VAT; 🟢 cheapest way, 🟡 middle, 🔴 most expensive):

| How you get it | What you pay for | **1-Wire edition** | **1-Wire, Lite build** | **Lite saves** | **PT edition** |
|---|---|---|---|---|---|
| **Order it ready-made, just for you** | JLCPCB's smallest order: 2 assembled boards (the second is a spare), shipping included | 🔴 **≈ €81** | 🔴 **≈ €64** | ≈ €17 | 🔴 **≈ €149** |
| **Order it ready-made with others** | a group order of 5 assembled boards, your share | 🟢 **≈ €24** | 🟢 **≈ €17.50** | ≈ €6.50 | 🟢 **≈ €58** |
| **Build it yourself** | parts for one board plus a set of 3 bare PCBs (AISLER, ≈ €19); needs SMD soldering (fine-pitch MAX31865 / LTC2983); parts shipping not included | 🟡 **≈ €49** | 🟡 **≈ €43** | ≈ €5.50 | 🟡 **≈ €90** |

The parts lists (8.1, 11.5, 12.2) show **≈ €28.60 / €24.10 / €63.60**: that is
the parts for one board excluding VAT, with one third of the PCB set, so
it fits a group build, not someone building a single board.

Before D18 the normal build came to ≈ €105 for 2 and ≈ €165 for 5; with
the original AND gate + TC4427 driver (before D22) ≈ €90 for 2, ≈ €27 per
board for 5 (Lite ≈ €73 / ≈ €20, PT ≈ €158 / ≈ €61). For one controller,
the fixed costs dominate: that is why the Lite build, with two non-basic
part types fewer, saves more per order (≈ €17) than its parts suggest
(≈ €4.50). AISLER's assembly price is not estimated
here; it gets quoted with the BOM.

### 8.3 Assembly services compared

The estimates in 8.2 use JLCPCB. Other services, as published in
November 2026 (fees and promotions change often; real quotes with the
BOM decide, D7). 🟢 good for one CoSTOS board, 🟡 possible, 🔴 weak.

| Service | Smallest assembled order | Fixed costs for a small order | Where | Fit for one CoSTOS board |
|---|---|---|---|---|
| **JLCPCB** (Economic PCBA) | 🟡 2 boards | setup $8.18, **$3.07 per extended part type** (basic and "preferred extended" parts: none) | China | 🟢 cheapest per board today (8.2); one-sided only, which suits the HAT; LTC2983 usually consigned |
| **PCBWay** | 🟢 1 board | assembly from about $29 plus parts; passives bought with overage (min. 50 pieces) | China | 🟡 true single board; the overage on cheap passives costs little |
| **NextPCB** | 🟢 1 board | promotions for 1–10 boards: up to $200 off the SMT cost, minimum SMT cost $50 | China | 🟡 could be the cheapest single board while the promotion runs |
| **Seeed Fusion** | 🟢 1 board assembled (5 bare boards made) | setup from $25; parts from its Open Parts Library | China | 🔴 limited parts library; the MAX31865 / LTC2983 may not be in it |
| **AISLER** | 🟡 boards in sets of 3 | boards + stencil + parts + assembly fee, priced per project | Germany / EU | 🟡 no import VAT and customs handling, EU-sourced LTC2983; quote with the BOM |
| **Eurocircuits** | 🟢 1–5 boards (PCB proto) | per project; stencil included | Germany, Hungary | 🔴 usually the most expensive; best for fast EU turnaround |

**JLCPCB part categories.** The category of a part decides whether an
order pays a loading fee for it, per part *type* (not per piece):

| Category | What it is | Fee per part type (Economic PCBA) |
|---|---|---|
| **Basic** | a couple of thousand common parts, permanently loaded on the pick-and-place machines | 🟢 none |
| **Preferred extended** | popular parts that are not permanently loaded but treated like basic ones (many were basic before) | 🟢 none |
| **Extended** | everything else; a feeder is loaded just for this order | 🔴 ≈ $3 ($3.07) |

The fee is why a $0.015 capacitor that is "extended" effectively costs
$3.015 on a small order. Two catches: it applies to **Economic** PCBA only
(Standard PCBA charges about $1.53 for every part type, basic or not),
and parts move between categories, so the BOM is checked against the
current lists just before ordering.

**Design rule (D20):** in KiCad, every ordinary part (resistors,
capacitors, AO3400A, 1N4148W, LEDs, TVS and ESD diodes, terminals) is
chosen from JLCPCB's basic or preferred extended parts. Only the special
chips without such an equivalent pay the fee: MAX31865, 74LVC1G123,
B0512S and TPS22918 (the LTC2983 of the PT edition is consigned; the pump
driver is built from basic transistors, D22). That is about four fees per
order instead of fifteen or more, roughly €25–30 less per order, which matters most for a single
controller (8.2). The same rule helps at other services: fewer special
part types means less setup everywhere.

Once the BOM exists, quotes from JLCPCB, PCBWay, NextPCB and AISLER go
into 8.2.

## 9. Bring-up plan (rev A)

1. Visual check, then resistance checks between all rails before power.
2. HAT on the Pi, Pi on its USB-C supply with a USB power meter: current
   rises by well under 200 mA, power LED on.
3. 12 V and 3.3 V present on the HAT. Measure the 5 V on the HAT
   (at C2) idle and with the Pi under load (`stress-ng` on all cores plus
   a USB drive copying): it must stay at or above 4.75 V. **Lite build:**
   also measure the PWM high level at J2 (pump connected, 100 % duty),
   and the rise and fall times at J2 at 1000 Hz (must be ≤ 2 µs, both
   builds),
   idle and under load; it must stay above 4.5 V. Check that the Pi
   reports no under-voltage (`vcgencmd get_throttled` returns `0x0`).
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
9. Repeat steps 3–8 on the other board (Pi 4 ↔ Pi 5), and on a Pi 3 B / B+
   if one is at hand.
10. Pump driver chains (D22): test the transistor chain H3 (the default)
    against the fallback AND gate + TC4427 chain by jumper, as in the test
    list in 4.1.

## 10. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | 12 V (DC/DC) or 5 V driver supply? | **12 V**: the HAT is meant to run for years; the margin is worth one DC/DC module |
| D2 | One or two PWM outputs and relay outputs? | **Two positions each, one fitted**: PUMP1 and REL1 for the solar pump; PUMP2 and REL2 stay unfitted until a second pump is added |
| D3 | How many Pt1000 inputs? | **Two on the board, one fitted**: PT1 for the collector; PT2 (MAX31865 #2, its parts and terminal) stays unfitted until needed |
| D4 | DS2482 or plain `w1-gpio`? | **`w1-gpio` on two buses** (GPIO 4 and 17), sensors in powered mode, DS2482 footprint as unfitted fallback. Keeps I²C out of normal use |
| D5 | Power the Pi from the HAT? | ~~Yes~~, replaced by D18: **no**, the Pi uses its own USB-C supply |
| D6 | Fit the HAT ID EEPROM? | **Footprint only**; fit later if automatic configuration is wanted |
| D7 | Hand assembly or factory assembly? | **Factory-assembled, delivered fully soldered**; AISLER or JLCPCB decided on quotes once the BOM exists (8.2) |
| D8 | Keep the external watchdog and PWM gating? | **Yes**: about €3 in parts. Since D15 (pump permanently powered) it is the main hardware stop path; with an optional cut-off relay it is the second, independent one, e.g. when an SSR fails short-circuited |
| D9 | Keep the MAX31865 or measure the Pt1000 more cheaply? | **Keep the MAX31865**: timing a capacitor charge with a GPIO is too inaccurate under Linux, and a small SPI ADC saves only about €6 but loses the ±45 V input protection on the roof cable and the sensor fault detection |
| D10 | Pluggable or fixed screw terminals? | **Fixed**: about €4 per board cheaper; the HAT rarely comes off, and then the wires are unscrewed |
| D11 | VBus receiver on the HAT? | **No**: VBus is only needed while the BX Plus is still connected (shadow mode, switchable phase). The existing loose adapter plugs onto pins 1, 6 and 10 on top of the stacking header until then; after the switch-over it goes away and the UART is free |
| D12 | Offer a Pt1000-only HAT? | **Yes, as a second edition** of the same board (section 11): same outline and shared KiCad sheets for power, pump, relay and watchdog; only the sensor sheet differs. Measuring chip: see D13 |
| D13 | Measuring chip for the PT edition? | **One LTC2983**: 8 independent 2-wire Pt1000 inputs (18 of its 20 inputs), excitation, fault detection and linearisation built in, result in °C, buffered inputs for simple protection. Costs a little more than 2 × ADS124S08 but needs far less analog design and software, and it frees GPIO4 for a 1-Wire bus. Comparison in 11.6 |
| D14 | Raspberry Pi or ESP32-P4 (Waveshare ESP32-P4-WIFI6-DEV-KIT, same form factor)? | **Raspberry Pi**: more people already own one, and Linux gives more flexibility. The P4 board is a possible later port; its pin check is in 2.1. On the P4, SCLK, REL1 and PWM2 would hit the RTC crystal and the audio amplifier |
| D15 | How do the Pi, the HAT and the pump get their power? | **Option A** ([ARCHITECTURE 5.6](ARCHITECTURE.md#56-230-v-side)): the Pi's own USB-C supply in a socket (most people already have one), the pump permanently on 230 V and stopped over PWM only. Cheapest, no mains wiring, no switching wear, and the pump feedback works at all times. Accepted: one stop path instead of two. REL1 stays on the board for an optional cut-off relay (option C), which heating-profile pumps always need |
| D16 | Spacer height: per board, or one for all? | **One tall height for all** (≈ 16–17 mm with a stacking header): fits the Pi 5 with active cooler or a passive heatsink, and a Pi 4; one BOM. Check that a passive heatsink stays below about 14 mm |
| D17 | Where do the field terminals go? | **Option B** (section 7): sensors and PUMP1 on the left edge, the rarely used PWR/REL1 and the unfitted positions at the front. All normally used wiring leaves on one side and the USB-C plug (D15) has the front edge to itself. Costs nothing; the left edge is then full. PT edition: S1–S8 and PUMP1 left, 1W-A at the front |
| D18 | Does the HAT need its own power input? | **No**: with option A (D15) the Pi runs from its own USB-C supply, so the PWR terminal, fuse, TVS and ideal diode were never used. Removed: about €4 and nine parts; the HAT's 5 V now sits behind the Pi's own input protection. DIN-rail builds feed the Pi through a USB-C lead (4.7). Replaces D5 |
| D19 | A separate low-cost board? | **No: a Lite build of the 1-Wire edition** (section 12): same board, without the 12 V DC/DC and the relay output; the pump driver runs on 5 V through R26 (0 Ω), with R9 = 100 Ω and D4 = SMBJ6.0A. Both 1-Wire buses and the PWR LED stay. Saves ≈ €4.50 in parts and ≈ €17 for one controller, as much as a dedicated Lite board would with the same parts, without a second layout, and can be upgraded. Solar-profile pumps only |
| D20 | Which parts to pick for the BOM? | **JLCPCB basic or preferred extended parts for everything ordinary** (8.3), so only the special chips pay a loading fee: about four fees per order (since D22) instead of fifteen or more, ≈ €25–30 less for a small order. Checked against the current lists before ordering. LEDs: types with a forward voltage of about 2 V (4.8) |
| D21 | How much text goes on the board? | **As much as fits** (7.1): pin names at every terminal on the top side, a full wiring cheat sheet with the safety rules, the R25/R26 rule, LED meanings, build tick boxes and a QR code on the empty bottom side. Free at JLCPCB; text at least 1 mm high. DS18B20 wire colours are left out because they vary between makers |
| D22 | How is the pump signal driven? | **Transistor chain H3, the default** (4.1): two NPN switches in series as the watchdog AND (PWM and WD_OK), a PNP to the supply, an NPN pulling the terminal low; all basic parts, ≈ €8.55 less for one than the original AND gate + TC4427, easy to explain, 40 V parts, the 600 W TVS and full pump voltage stay, and no 4.5 V minimum supply (helps the Lite build, 12.1). Confirmed on the rev A prototype, which also carries the AND gate + TC4427 as a jumper-selected fallback; if H3 fails the tests in 4.1, the released board goes back to it. Dropped: UCC27524 (enable defaults to on), two transistors with a resistor pull-down (too slow), H2 (weaker cable protection), single gate, single transistor, the Pi pin directly, level shifters. PWM range 100–1000 Hz |

---

## 11. PT edition (8 × Pt1000)

For installations that keep their Pt1000 sensors: a controller such as
the RESOL BX Plus measures every sensor as a 2-wire Pt1000, and those
sensors already sit in their sleeves with their cables in place. One
1-Wire bus stays on the board, so DS18x20 sensors can still be added.

Status: **planned as the second board**, after the 1-Wire edition. The
reference installation plans to use it (see
[installation.md](installation.md#sensors-and-outputs-in-use)).

![CoSTOS HAT PT edition mockup](img/hat-pt-mockup.svg)

### 11.1 What differs from the 1-Wire edition

| | 1-Wire edition | PT edition |
|---|---|---|
| Pt1000 inputs | 1 (PT1, MAX31865), PT2 footprint not fitted | **8 (S1–S8) on one LTC2983**, each wired independently |
| 1-Wire | 2 buses (GPIO4, GPIO17) | **1 bus (1W-A, GPIO4)**: same circuit (4.7 kΩ pull-up, 100 Ω series resistor, ESD diode, polyfuse) |
| Sensor terminals | PT1 2-way, 1W-A and 1W-B 3-way, all on the left edge | **one two-level block, 8 positions** (upper and lower level of position *n* are the two wires of sensor S*n*) on the left edge, plus 1W-A 3-way at the front |
| SPI | CE0 (CE1 for PT2) | CE0 for the LTC2983 |
| Extra GPIOs | | LTC2983 /RESET on GPIO22 (pin 15), INTERRUPT (conversion done) on GPIO27 (pin 13) |
| Everything else | 12 V, PUMP1/2 (transistor chain), REL1/2, watchdog, feedback, readback, header, EEPROM footprint | **identical** |

### 11.2 Pt1000 inputs (LTC2983)

- **One LTC2983** (LQFP-48, 7 × 7 mm) on 3.3 V, so its SPI levels match
  the Pi. Decoupling and reference capacitors as in the datasheet.
- **Shared sense resistor:** one 2 kΩ 0.1 %, low-drift resistor on CH1/CH2
  serves all eight sensors; the measurement is ratiometric against it.
- **Each sensor independent:** in the datasheet's standard 2-wire
  configuration every RTD uses two inputs, so S1–S8 use 16 of the
  remaining 18 inputs (2 spare). A broken cable or sensor only loses that
  sensor. The "18 RTDs in a series stack" trick from Analog Devices'
  design note is deliberately **not** used: there a single broken cable
  stops the current for every sensor.
- **Excitation current** chosen for Pt1000 per the datasheet (around
  100 µA), so the voltages stay well inside the input range up to the
  collector's 208 °C stagnation temperature.
- **Protection:** the inputs are buffered (high impedance), so each
  terminal wire gets a series resistor and an ESD diode without
  distorting the reading.
- **Built in:** Pt1000 linearisation, result in °C, and fault reporting per
  sensor (open, short, out of range).

### 11.3 Raspberry Pi configuration

As in section 6, with these differences:

```ini
dtparam=spi=on
dtoverlay=w1-gpio,gpiopin=4
# no second w1-gpio line (GPIO17 is unused on the PT edition)
gpio=24,25,5=op,dl
# PWM output readback: inputs with pull-down
gpio=6,26=ip,pd
gpio=22=op,dh   # LTC2983 /RESET released
gpio=27=ip,pu   # LTC2983 INTERRUPT (conversion done)
```

### 11.4 Software

- The board edition is chosen in the setup wizard (Settings → Hardware);
  sensor S*n* is LTC2983 channel pair *n*, the 1-Wire probes are assigned
  by their ROM ID as on the 1-Wire edition.
- At start CoSTOS writes the channel assignment words (sensor type
  PT-1000, 2-wire, shared sense resistor, excitation current) and the
  sense resistor value; nothing needs to be stored on the chip, so the
  LTC2984's EEPROM brings no benefit.
- Once per second: start a multi-channel conversion, wait for INTERRUPT,
  read the eight results in °C with their fault bits. Faults map onto
  the same sensor-fault handling and glitch counters as every other
  sensor (ARCHITECTURE section 5.1).

### 11.5 Space and cost

- **Space:** one 7 × 7 mm chip, the sense resistor, 16 protection
  resistors and ESD diodes fit comfortably where the 1-Wire edition has
  PT1, PT2, the DS2482 footprint and the second 1-Wire bus (see the
  mockup).
- **Cost** (estimates, comparison in 11.6, assembly model in 8.2):
  **≈ €149 for one** (smallest assembled order, 2 boards), about €58 per
  board in a batch of 5, about **€63.60 in single-quantity parts** (without
  the power input, D18, with the transistor driver chain, D22):

| Part | Qty | ≈ € |
|---|---|---|
| LTC2983 (8 × Pt1000; DigiKey $39.06 for one) | 1 | 39.00 |
| PCB, ⅓ of an AISLER set of 3 (≈ €19) | — | 6.50 |
| 3.5 mm fixed screw terminals: two-level 8-position block, REL1, PUMP1, 1W-A | 4 | 4.00 |
| Resistors and capacitors, about 45 (incl. the 2 kΩ 0.1 % sense resistor and 16 protection resistors) | — | 3.80 |
| B0512S-1WR3 DC/DC | 1 | 3.00 |
| 40-pin stacking header and 4 spacers | 1 | 3.00 |
| PESD5V0 ESD diodes (16 Pt1000 wires, 1-Wire, FB1) | 18 | 1.80 |
| TPS22918 | 1 | 0.60 |
| LEDs (PWR, WD, PUMP1, R1) | 4 | 0.65 |
| 74LVC1G123 | 1 | 0.40 |
| SMBJ13A | 1 | 0.20 |
| Pump driver transistors: MMBT3904 × 3, MMBT3906 × 1 (D22) | 4 | 0.08 |
| 100 mA polyfuse | 1 | 0.20 |
| AO3400A, 1N4148W | 2 | 0.20 |
| **Total** | | **≈ 63.60** |

  The LTC2983 is more than half of it; everything apart from the
  converter chip costs about €5 more than on the 1-Wire edition
  (section 8.1), for the bigger terminal block and the protection of the
  16 sensor wires.
- **Sourcing:** LCSC rarely has the LTC2983 in stock. For JLCPCB assembly
  the chips are bought at DigiKey (≈ €39) and consigned to JLCPCB, or
  AISLER assembles with EU-sourced parts.

### 11.6 Choice of measuring chip

Chips that measure several Pt1000s, compared for 8 two-wire sensors; the
last column is the 1-Wire edition with new DS18B20 probes, for comparison
with keeping the existing Pt1000 sensors. **Decided: LTC2983 (D13).** The
other options stay documented as alternatives.

Prices are single quantity at the time of writing; totals are estimates
until a real BOM exists, and LCSC stock changes daily. The totals were
made with the power input, since dropped (D18): subtract about €4 from
every column for parts, about €5 per board at 5 boards and about €15 for
the smallest order of 2 (8.2). 🟢 good,
🟡 medium, 🔴 weak.

| | **8 × MAX31865** | **2 × ADS124S08** | **2 × AD7124-8** | **1 × LTC2986** | **1 × LTC2983** (chosen) | **1-Wire edition:** 1 × MAX31865 + 7 × DS18B20 |
|---|---|---|---|---|---|---|
| ***Channels*** | | | | | | |
| Independent 2-wire Pt1000s per chip | 1 | 5 (force + sense pin each) | 7 (16 analog pins) | 🔴 4 (10 inputs, 2 per sensor + sense resistor) | 🟢 9 (20 inputs) | collector: 1; DS18B20: one chip per probe |
| Spare channels with 8 sensors | 🔴 0 | 🟡 2 | 🟢 6 | 🔴 none: 8 only as a series stack | 🟡 1 more sensor | 🟢 PT2 footprint; the buses take more probes |
| 1-Wire bus on the same board | 🔴 no: GPIO4/17 drive the chip-select decoder | 🟢 possible | 🟢 possible | 🟢 possible | 🟢 **yes, 1W-A** | 🟢 2 buses |
| ***Cost*** | | | | | | |
| Chips, LCSC | 🟡 8 × $4.27 = $34 | 🟢 2 × $6.46 = $13 | 🟢 2 × $10.47 = $21 | 🔴 $53 | 🟡 $39 | 🟢 $4.27 |
| Chips, DigiKey / Farnell EU | 🔴 8 × €8.76 = €70 | 🟢 2 × €9.94 = €20 | 🟢 ≈ €20–25 | 🟡 €34–42 | 🟡 ≈ €37–42 | 🟢 €8.76 |
| Extra parts on the board | 8 reference resistors 0.1 %, 16 ESD, decoder ≈ €8 | 2 reference resistors, 16 R + clamps + ESD ≈ €3 | like ADS ≈ €3 | 1 sense resistor, protection R ≈ €2 | 1 sense resistor, 16 protection R + ESD, 1-Wire parts ≈ €3 | pull-ups, ESD, polyfuse ≈ €1 |
| Sensor section, assembled | 🟡 ≈ €40 | 🟢 ≈ €15 | 🟢 ≈ €22 | 🔴 ≈ €50 | 🟡 ≈ €39 | 🟢 ≈ €6 |
| Rest of the board, assembled | ≈ €28 | ≈ €28 | ≈ €28 | ≈ €28 | ≈ €28 | ≈ €27 |
| New sensors and cable | 🟢 none | 🟢 none | 🟢 none | 🟢 none | 🟢 none | 🔴 7 DS18B20 probes + 2 cables ≈ €60–80 |
| **Total, assembled (5 boards, JLCPCB, incl. VAT and shipping)** | 🟡 **≈ €68** | 🟢 **≈ €43** | 🟢 **≈ €50** | 🔴 **≈ €78** | 🟡 **≈ €67** | 🟡 **≈ €33 + €60–80 = €93–113** |
| **Price for one: smallest assembled order (2 boards, JLCPCB)** | 🟡 **≈ €175** | 🟢 **≈ €125** | 🟢 **≈ €139** | 🔴 **≈ €195** | 🟡 **≈ €173** | 🟡 **≈ €105 + €60–80 = €165–185** |
| **Total, single-quantity parts (DigiKey, excl. VAT)** | 🔴 **≈ €103** | 🟢 **≈ €48** | 🟢 **≈ €50** | 🟡 **≈ €61–69** | 🟡 **≈ €69** | 🟡 **≈ €35 + €60–80 = €95–115** |
| Stock for assembly | 🟡 varies | 🟢 good (≈ 1,700 at LCSC) | 🔴 thin, one variant out | 🔴 thin | 🟡 thin at LCSC; buy at DigiKey and consign | 🟡 MAX varies; probes bought separately (fakes are common) |
| ***Function*** | | | | | | |
| Input protection | 🟢 ±45 V built in | 🟡 external parts, needs care | 🟡 external parts, needs care | 🟢 external, easy (buffered inputs) | 🟢 external, easy (buffered inputs) | 🟢 MAX ±45 V; 1-Wire ESD + polyfuse |
| Open / short detection | 🟢 fault register | 🟡 burnout current + software | 🟢 burnout + diagnostics built in | 🟢 built in, per sensor type | 🟢 built in, per sensor type | 🟡 CRC, missing probe; a short takes down its whole bus |
| Output | ratio, converted to °C in software | raw ADC codes, software does all | raw ADC codes, software does all | 🟢 °C directly, linearised | 🟢 °C directly, linearised | 🟢 DS18B20 gives °C directly |
| Range, accuracy | 🟢 Pt1000 beyond 200 °C, class B ±0.6 K at 60 °C | 🟢 same sensors | 🟢 same sensors | 🟢 same sensors | 🟢 same sensors | 🟡 ±0.5 K, max 125 °C (S4 can exceed it: fit PT2) |
| Resolution | 15-bit, ≈ 0.03 K | 24-bit | 24-bit | 24-bit, 0.1 °C accuracy | 24-bit, 0.1 °C accuracy | DS18B20 12-bit, 0.0625 K |
| Package, space | 🔴 8 × SSOP-20, tight | 🟢 2 × TQFP-32 5×5 | 🟢 2 × QFN-32 5×5 (no hand soldering) | 🟢 1 × LQFP-48 7×7 | 🟢 1 × LQFP-48 7×7 | 🟢 roomy |
| ***Effort and risk*** | | | | | | |
| Circuit design | 🟢 low: PT1 circuit × 8 | 🔴 high: analog force/sense layout | 🔴 high: like ADS | 🟢 low–medium: datasheet circuits | 🟢 low–medium: datasheet circuits | 🟢 done: schematic drawn |
| Software | 🟢 simple, driver shared with the 1-Wire edition | 🔴 most: input and current switching, settling, linearising | 🟡 medium: the sequencer helps | 🟢 simple: write channel setup, read °C | 🟢 simple: write channel setup, read °C | 🟢 simple: kernel 1-Wire + MAX driver |
| Work at the installation | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🔴 fit 7 probes, run 2 cables, set calibration offsets |
| Charts vs. history | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟡 small step, fixed with offsets |
| ***Verdict*** | | | | | | |
| Best for | fallback with a proven circuit, no 1-Wire | cheapest; cost-down option | spare analog inputs (other sensors) | only up to 4 independent sensors | 🟢 **PT edition: chosen** | 🟢 new installations, or when sensors get replaced anyway |

Variant not shown as a column: the 1-Wire edition with PT2 fitted, so S4
stays Pt1000 (2 Pt1000 + 6 DS18B20): about €5 more assembled, one probe
less. The LTC2984 is the LTC2983 with an EEPROM for the channel setup; it
costs more (≈ $71 at LCSC) and CoSTOS doesn't need it.

**Also considered: a DiSoCon2-style divider front-end** (each Pt1000 in a
divider with a 0.1 % resistor, op-amp buffer, ADS1115; see
[ARCHITECTURE 12](ARCHITECTURE.md#12-related-projects)). For 8 sensors:
2 × ADS1115 ≈ €5–7, 8 precision resistors ≈ €1–2, 2 quad op-amps
≈ €1–3, reference ≈ €1, protection ≈ €2, so ≈ €10–15 instead of ≈ €42
for the LTC2983 section: **about €30 less per PT board** (≈ €40–45
instead of ≈ €69). On the 1-Wire edition it would save only about €5 on
the single Pt1000 (D9). Not taken, because it gives up:

- open/short **fault detection** (a broken sensor just reads extreme),
- **input protection** for the roof cable,
- **drift-free accuracy**: the ADS1115 measures against its internal
  reference, so supply and reference drift go into the reading unless a
  spare channel measures the excitation and the code works ratiometrically,
- **simple software**: divider maths, calibration and Callendar–Van Dusen
  in our code instead of °C over SPI.

Solar control would cope with ±0.5–1 K, but for a controller meant to run
10+ years the €30 is worth it.

---

## 12. Lite build (decided, D19)

The cheapest way to a CoSTOS controller: **the same 1-Wire edition
board with fewer parts fitted**, not a separate board. It saves about
**€4.50 per board** in parts (≈ €17 for one controller), can be upgraded to the full build by soldering the
missing parts on, and needs no second layout. A dedicated Lite board was
drawn first and dropped: it saved no more money (unfitted footprints cost
nothing, and it would have had the same outline), but it needed its own
layout, parts list, tests and documentation, and had no upgrade path.

![CoSTOS HAT, Lite build, top view](img/hat-lite-mockup.svg)

**Why no dedicated Lite board:** the comparison that decided D19, both
Lite variants against the normal build (single-quantity parts; 🟢 good,
🟡 medium, 🔴 weak):

| | **Normal HAT** (1-Wire edition) | **HAT Lite** (own board) | **Lite as build option** | **Saved: Lite (own board)** | **Saved: Lite build option** |
|---|---|---|---|---|---|
| ***What's left out*** | | | | | |
| 12 V converter + its load resistor | 🟢 12 V pump signal, large margin | 🟡 5 V, small margin (≈ 4.7 V against 4 V) | 🟡 5 V via a 0 Ω link; converter can be fitted later | **€3.05** | **€3.05** |
| Relay output REL1 (switch chip, MOSFET, diode, terminal, R1 LED) | 🟢 cut-off relay (option C), heating-profile pumps, on/off loads | 🔴 none: solar-profile pumps only | 🟡 not fitted, spot stays | **€1.55** | **€1.55** |
| Second 1-Wire bus (terminal, ESD, pull-up) | 🟢 2 buses | 🟡 1 bus | 🟡 1 fitted, 1W-B can be fitted later | **€0.65** | **€0.65** |
| PWR LED | 🟢 | 🟡 none (WD shows power too) | 🟡 not fitted | **€0.15** | **€0.15** |
| 0 Ω link for 5 V | — | — | one extra part | — | **−€0.01** |
| ***Kept on all three*** | | | | | |
| MAX31865 for the collector, watchdog + PWM gating, all field-line protection, PUMP1 with feedback, WD and PUMP1 LEDs, tall header, full outline | 🟢 | 🟢 | 🟢 | — | — |
| PT2, PUMP2, REL2, DS2482 spots for later | 🟢 | 🔴 none | 🟢 | — | — |
| ***Totals*** | | | | | |
| Parts, single quantity | ≈ €30 | ≈ €24.60 | ≈ €24.60 | **≈ €5.40** | **≈ €5.39** |
| **Price for one** (smallest assembled order: 2 boards, 8.2) | ≈ €90 | ≈ €71 | ≈ €71 | **≈ €19** | **≈ €19** |
| Assembled, per board in a batch of 5 | ≈ €27 | ≈ €19.50 | ≈ €19.50 | **≈ €7.50** | **≈ €7.50** |
| Extra design work | — | 🔴 second board, layout, parts list, tests, docs | 🟢 one extra part and a second parts list | — | — |
| Upgrade later to the full HAT | — | 🔴 buy a new board | 🟢 solder the missing parts on | — | — |

Both savings columns come out the same: the saving comes only from parts
that are not fitted, empty footprints cost nothing, and a dedicated board
would have the same outline. The dedicated board would only add a second
design to maintain and remove the upgrade path. After this comparison the
second 1-Wire bus and the PWR LED were put back into the Lite build (12.2),
so it now saves about €4.60 (≈ €4.50 since D22).

### 12.1 Rule: it may fail, but it may not break anything

The Lite build may stop working; it must never leave the pump running or
damage the Pi:

1. **Every fault ends in "pump stopped".** The PWM line keeps its
   pull-down and the watchdog switch in the driver chain (4.1, 4.6), and the Lite build only
   supports **solar-profile pumps** (Wilo PWM2, Grundfos profile C), where
   no signal or a low signal means stop. The setup wizard refuses a
   heating profile on a Lite build.
2. **Field wiring can't reach the Pi.** The MAX31865 with its ±45 V input
   protection stays on the collector input, and every terminal keeps its
   series resistors, ESD diodes, TVS diode and polyfuse. A short or a
   swapped wire damages nothing. (230 V on a low-voltage terminal is beyond
   any HAT.)
3. **No power path of its own** (D18): powered by the Pi.
4. **The weakest part fails safe.** The pump driver runs on 5 V instead of
   12 V, so the pump sees about 4.7 V against its ~4 V threshold
   ([HARDWARE.md](HARDWARE.md#12-v-or-5-v)), **with R9 = 100 Ω and D4 =
   SMBJ6.0A** (4.1); with the normal build's 470 Ω it would be only ≈ 3.6 V. If that isn't enough (long
   cable, a pump with a higher threshold), the pump simply doesn't start,
   and the feedback input reports it.
5. **The pump signal follows the Pi's 5 V, so the supply must be a proper
   one.** In the Lite build the driver runs directly on the Pi's 5 V rail
   (R26), which sits a little below the supply's label. The transistor
   chain (D22) has no minimum supply of its own: the pump gets the rail
   minus ≈ 0.15 V (Q6) and ≈ 0.3 V (R9), against its 3.6 V minimum:

   | Point | Pi's 5 V | At the pump | Margin to 3.6 V |
   |---|---|---|---|
   | Official Raspberry Pi supply | ≈ 5.0 V | ≈ 4.55 V | 🟢 ≈ 0.95 V |
   | Same, Pi under heavy load (CPU, USB devices) | ≈ 4.8 V | ≈ 4.35 V | 🟢 ≈ 0.75 V |
   | Pi flags "under-voltage" itself | ≈ 4.63 V | ≈ 4.2 V | 🟡 ≈ 0.6 V |
   | Weak supply | 4.5 V | ≈ 4.05 V | 🟡 ≈ 0.45 V |
   | Pump stops responding | ≈ 4.05 V | 3.6 V | 🔴 0 |

   (The original TC4427 driver needed 4.5 V for itself, which left only
   ≈ 0.3 V under load; the transistor chain removed that limit.) A weak
   supply (phone charger, thin or long USB cable) can still sag far
   enough: then the pump sees a signal below its threshold and, with a
   solar-profile pump, **stays stopped**. Nothing breaks, but the
   pump silently doesn't run on a sunny day. So:

   - **Lite build: official Raspberry Pi supply, or one that holds
     5.1 V under load. No phone chargers, no long USB cables.** The normal
     build is far less sensitive (its 12 V comes from an isolated DC/DC),
     but the same advice applies.
   - **CoSTOS watches it:** the Pi's own under-voltage flag raises the
     "supply under-voltage" alarm
     ([ARCHITECTURE 6.2](ARCHITECTURE.md#function-checks-and-alarms)),
     with an e-mail if notifications are on.
   - **The pump feedback is the second check:** a pump that gets a run
     command but reports stand-by raises the feedback mismatch alarm
     (ARCHITECTURE 6.5).
   - **Bring-up measures it** (9, step 3): the 5 V on the HAT and the PWM
     high level at the pump, idle and under load.

### 12.2 Normal build against Lite build

Single-quantity parts; "saved" is what the Lite build saves on that row.
🟢 good, 🟡 medium, 🔴 weak.

| | **Normal build** | **Lite build** | **Saved** |
|---|---|---|---|
| ***Left out in the Lite build*** | | | |
| 12 V DC/DC block: U2 with its input and output capacitors C3, C4, minimum load R2; R25 | 🟢 pump signal ≈ 10.6 V, large margin | 🟡 R26 (0 Ω) fitted instead: driver on 5 V, ≈ 4.7 V at the pump | **€3.08** |
| Relay output REL1: TPS22918, AO3400A, 1N4148W, terminal, R1 LED | 🟢 cut-off relay (ARCHITECTURE 5.6 option C), heating-profile pumps, on/off loads | 🔴 none: solar-profile pumps only | **€1.55** |
| R26 (0 Ω) | not fitted | fitted | **−€0.01** |
| R9 series resistor, D4 TVS (4.1) | 470 Ω, SMBJ13A | **100 Ω, SMBJ6.0A** | — |
| R31 readback divider (4.1) | 27 kΩ | **6.8 kΩ** | — |
| ***The same in both*** | | | |
| MAX31865 (collector), both 1-Wire buses, watchdog + PWM gating, field-line protection, PUMP1 with feedback, PWR, WD and PUMP1 LEDs, tall header, outline | 🟢 | 🟢 | — |
| Unfitted spots for PT2, PUMP2, REL2, DS2482 | 🟢 | 🟢 | — |
| ***Totals*** | | | |
| Parts, single quantity | ≈ €28.60 | ≈ €24.10 | **≈ €4.50** |
| **Price for one** (smallest assembled order: 2 boards, 8.2) | ≈ €81 | ≈ €64 | **≈ €17** |
| Assembled, per board in a batch of 5 | ≈ €24 | ≈ €17.50 | **≈ €6.50** |
| Upgrade | — | 🟢 solder on the DC/DC block (U2, C3, C4, R2, R25; remove R26), change R9 to 470 Ω, D4 to SMBJ13A and R31 to 27 kΩ, and fit the REL1 parts | — |

The two 0 Ω positions R25 and R26 must **never be fitted together**: that
would short the 12 V and 5 V rails. The silkscreen marks them "12 V" and
"5 V (Lite)", and marks R9 "470 / Lite 100" and D4 "13A / Lite 6.0A".


### 12.3 The pump signal, step by step (Lite build)

From the Pi pin to the pump terminal, with the voltage at each step.
Regenerate with `python3 tools/hw/pwm_chain_svg.py > docs/img/hat-lite-pwm-chain.svg`.

![PWM signal path of the Lite build](img/hat-lite-pwm-chain.svg)

1. **Pi GPIO 18** makes the PWM in hardware (5.5): 0 V or 3.3 V, 500 Hz
   by default. Too low for the pump on its own, which needs at least
   3.6 V at 3 mA.
2. **R7** (100 kΩ to GND) holds the line at 0 V while the Pi boots,
   before GPIO 18 is configured. 0 V means "pump stopped".
3. **Two switches in a row:** Q4 (the PWM switch) and Q5 (the watchdog
   switch, driven by WD_OK, 4.6). Only when both are on is the output
   switched on. If CoSTOS hangs, the watchdog opens Q5 after about 3 s.
4. **Q6, the switch to the supply** (a PNP transistor), connects the
   output to the Pi's 5 V (through R26): ≈ 4.85 V.
5. **Q7, the switch to ground**, pulls the terminal actively to 0 V
   whenever Q6 is off, so the falling edge is as sharp as the rising one.
6. **R9** (100 Ω, at least ½ W) drops only about 0.3 V at the pump's
   ~3 mA, so the pump sees about 4.55 V. With a shorted cable (or the
   moment Q6 and Q7 overlap while switching) it limits the current to
   about 50 mA.
7. **D4** (SMBJ6.0A) at the terminal catches spikes coming back on the
   cable.
8. **LED D12** with R22 (2.2 kΩ) sits right at the driver output and shows
   what really leaves the board: off = stop, brighter = faster. The
   readback (R31/R32 to GPIO 6) lets CoSTOS check the same thing.

Four transistors, all basic parts, and two protection parts. The normal
build has the same chain on 12 V, with R9 = 470 Ω and D4 = SMBJ13A (4.1).
