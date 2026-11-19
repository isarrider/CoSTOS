# CoSTOS HAT

The CoSTOS HAT plugs onto the Raspberry Pi's 40-pin header and connects
it to the solar system: temperature sensors in, PWM to the pump, an
optional relay. It combines the circuits from
[Hardware needed](HARDWARE.md) on one board.

Status: **design for rev A, not yet built or tested.** Once rev A has
passed its tests, this line will say "released".

## The documents

| Document | For whom | What's in it |
|---|---|---|
| **HAT.md** (this page) | Everyone choosing a HAT | The editions side by side |
| [HAT-1wire.md](HAT-1wire.md) | Building, ordering or wiring the 1-Wire edition or 1-Wire Lite | The board as it will be built: functions, terminals, wiring, silkscreen, LEDs, Pi configuration, costs, 1-Wire Lite |
| [HAT-PT.md](HAT-PT.md) | The same for the PT edition | What differs from the 1-Wire edition: the 8 Pt1000 inputs on one LTC2983, terminals, configuration, costs |
| [HAT-development.md](HAT-development.md) | Checking, testing or changing the design | Decisions D1–D23 with their reasons, the alternatives that were dropped, the rev A prototype, bring-up and tests |

## The editions

- **1-Wire edition** ([HAT-1wire.md](HAT-1wire.md)): 1 Pt1000 input
  (collector) plus two 1-Wire buses for DS18x20 sensors. For new
  installations and anyone replacing their sensors.
- **1-Wire Lite** ([HAT-1wire.md 11](HAT-1wire.md#11-1-wire-lite)):
  the same board with fewer parts fitted: no 12 V converter, no relay
  output. The cheapest way in; solar-profile pumps only.
- **PT edition** ([HAT-PT.md](HAT-PT.md)): 8 Pt1000 inputs on one LTC2983
  plus one 1-Wire bus, for installations that keep their existing Pt1000
  sensors, as most commercial controllers use them.

All of them need a **PWM pump in the solar profile** (no signal = stop),
which is a safety requirement: [ARCHITECTURE 5.3](ARCHITECTURE.md#pump-requirement-safety).

| 1-Wire edition | 1-Wire Lite | PT edition |
|---|---|---|
| ![1-Wire edition](img/hat-mockup.svg) | ![1-Wire Lite](img/hat-lite-mockup.svg) | ![PT edition](img/hat-pt-mockup.svg) |

## Which HAT? All editions compared

Prices are estimates until a real BOM exists (cost model:
[HAT-1wire.md 8.2](HAT-1wire.md#82-what-one-controller-costs)).
🟢 good, 🟡 medium, 🔴 weak or missing.

| | **1-Wire edition** | **1-Wire Lite** | **PT edition** |
|---|---|---|---|
| **Best for** | new installations, or replacing the sensors anyway | a tight budget with a solar-profile pump | keeping the existing Pt1000 sensors (e.g. replacing a RESOL) |
| ***Sensors*** | | | |
| Pt1000 inputs | 🟡 1 (collector), 1 spare position | 🟡 1 (collector), 1 spare position | 🟢 **8** (S1–S8, LTC2983) |
| 1-Wire buses for DS18x20 | 🟢 2 | 🟢 2 | 🟡 1 |
| ***Outputs*** | | | |
| PUMP1, PWM with feedback | 🟢 12 V drive, ≈ 10.5 V at the pump | 🟡 5 V drive, ≈ 4.55 V at the pump (minimum 3.6 V) | 🟢 12 V drive |
| PWM frequency | 🟢 settable, 100–1000 Hz ([ARCHITECTURE](ARCHITECTURE.md#pwm-frequency-settable-per-output)) | 🟢 same | 🟢 same |
| REL1 (cut-off relay, valve, on/off load) | 🟢 yes | 🔴 not fitted | 🟢 yes |
| Pumps | 🟢 solar profile; heating profile with a cut-off relay | 🟡 solar profile only | 🟢 solar profile; heating profile with a cut-off relay |
| Unfitted spare positions | PT2, PUMP2, REL2, DS2482 | the same, plus REL1 and the DC/DC | PUMP2, REL2 |
| ***The same on all*** | | | |
| Transistor pump driver with watchdog gating and output readback, field-line protection, power from the Pi, PWR / WD / PUMP1 LEDs, silkscreen cheat sheet, size and tall header | 🟢 | 🟢 | 🟢 |
| ***Cost*** (incl. 19 % VAT unless noted) | | | |
| **Price for one** (smallest assembled order: 2 boards) | ≈ €75 | 🟢 **≈ €68** | 🔴 ≈ €162 |
| Assembled, per board in a group order of 5 | ≈ €22 | 🟢 ≈ €19.50 | 🔴 ≈ €65.50 |
| Build it yourself (parts from LCSC + 3 bare PCBs, LCSC shipping extra) | ≈ €33 | 🟢 ≈ €31 | 🔴 ≈ €76 |
| Parts for one board (LCSC prices, excl. VAT) | ≈ €15.20 | ≈ €13.90 | ≈ €51.40 (LTC2983 ≈ €39 of it) |
| **Against the 1-Wire edition, price for one** | — | 🟢 **saves ≈ €6** | 🔴 **≈ €87 more** |
| ***Building and status*** | | | |
| Hardest part to solder (only when building it yourself) | 🟡 MAX31865, SSOP-20 at 0.65 mm pitch | 🟡 same as the 1-Wire edition | 🔴 LTC2983, LQFP-48 at 0.5 mm pitch |
| Upgrade later | — | 🟢 to the normal build: fit the DC/DC block (U2, C3, C4, R2, R25; remove R26), change R9, D4 and R31, fit the REL1 parts | — |
| Status | 🟡 rev A, designed first | 🟡 same board as the 1-Wire edition | 🔴 planned as the second board |
