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
| [HAT-1wire.md](HAT-1wire.md) | Building, ordering or wiring the 1-Wire edition | The board as it will be built: functions, terminals, wiring, silkscreen, LEDs, Pi configuration, costs, safety rules |
| [HAT-PT.md](HAT-PT.md) | The same for the PT edition | What differs from the 1-Wire edition: the 8 Pt1000 inputs on one LTC2983, terminals, configuration, costs |
| [HAT-development.md](HAT-development.md) | Checking, testing or changing the design | Decisions D1–D25 with their reasons, the alternatives that were dropped, the simulations, the rev A prototype, bring-up and tests |

## The editions

- **1-Wire edition** ([HAT-1wire.md](HAT-1wire.md)): 1 Pt1000 input
  (collector) plus two 1-Wire buses for DS18x20 sensors. For new
  installations and anyone replacing their sensors. One build since D25
  (the cheaper 1-Wire Lite build is no longer needed: the full board now
  costs about the same).
- **PT edition** ([HAT-PT.md](HAT-PT.md)): 8 Pt1000 inputs on one LTC2983
  plus one 1-Wire bus, for installations that keep their existing Pt1000
  sensors, as most commercial controllers use them.

Both need a **PWM pump**. The solar profile (no signal = stop) is the
safe default; a heating-profile pump only with REL1 cutting its power:
[ARCHITECTURE 5.3](ARCHITECTURE.md#pump-requirement-safety).

| 1-Wire edition | PT edition |
|---|---|
| ![1-Wire edition](img/hat-mockup.svg) | ![PT edition](img/hat-pt-mockup.svg) |

## Which HAT? Both editions compared

Prices are estimates until a real BOM exists (cost model:
[HAT-1wire.md 8.2](HAT-1wire.md#82-what-one-controller-costs)).
🟢 good, 🟡 medium, 🔴 weak or missing.

| | **1-Wire edition** | **PT edition** |
|---|---|---|
| **Best for** | new installations, or replacing the sensors anyway | keeping the existing Pt1000 sensors (e.g. replacing a RESOL) |
| ***Sensors*** | | |
| Pt1000 inputs | 🟡 1 (collector) | 🟢 **8** (S1–S8, LTC2983) |
| 1-Wire buses for DS18x20 | 🟢 2 | 🟡 1 |
| ***Outputs*** | | |
| PUMP1, PWM with feedback | 🟢 ≈ 6.7 V at the pump (4 V needed), from a voltage doubler (D25) | 🟢 same |
| PWM frequency | 🟢 settable, 100–1000 Hz ([ARCHITECTURE](ARCHITECTURE.md#pwm-frequency-settable-per-output)) | 🟢 same |
| REL1 (cut-off relay, valve, on/off load) | 🟢 yes | 🟢 yes |
| Pumps | 🟢 solar profile; heating profile with REL1 cutting its power | 🟢 same |
| Unfitted spare positions | PUMP2, REL2, DS2482 | PUMP2, REL2 |
| ***The same on both*** | | |
| Transistor pump driver with capacitor watchdog and output readback, field-line protection, power from the Pi, PWR / WD / PUMP1 / R1 LEDs, silkscreen cheat sheet, size and tall header | 🟢 | 🟢 |
| ***Cost*** (incl. 19 % VAT unless noted) | | |
| **Price for one** (smallest assembled order: 2 boards) | 🟢 **≈ €63** | 🔴 ≈ €151.50 |
| Assembled, per board in a group order of 5 | 🟢 ≈ €18 | 🔴 ≈ €62 |
| Build it yourself (parts from LCSC + 3 bare PCBs, LCSC shipping extra) | 🟢 ≈ €30.50 | 🔴 ≈ €73.50 |
| Parts for one board (LCSC prices, excl. VAT) | ≈ €12.95 | ≈ €49.20 (LTC2983 ≈ €39 of it) |
| JLCPCB loading fees (non-basic parts) | 🟢 1 (MAX31865) | 🟢 1 (LTC2983 handling) |
| ***Building and status*** | | |
| Hardest part to solder (only when building it yourself) | 🟡 MAX31865, SSOP-20 at 0.65 mm pitch | 🔴 LTC2983, LQFP-48 at 0.5 mm pitch |
| Status | 🟡 rev A, designed first | 🔴 planned as the second board |
