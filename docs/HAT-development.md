# CoSTOS HAT: development

Status: **rev A prototype, not yet designed in KiCad**. This page is for
everyone who wants to know *why* the HAT is built the way it is, check
the design, test a prototype or change it. What the HAT **is** (the
design as it will be built, terminals, wiring, costs) is in the release
documents, [HAT-1wire.md](HAT-1wire.md) and [HAT-PT.md](HAT-PT.md) (the
editions compared: [HAT.md](HAT.md)); this page does not repeat them.

- [1. Decisions](#1-decisions): D1–D23, the short answer to every design
  question, referred to as "Dn" in both documents.
- [2. Pump driver chain: alternatives](#2-pump-driver-chain-alternatives-d22)
  and the rev A prototype test of the transistor chain.
- [3. 1-Wire Lite: why no dedicated board](#3-1-wire-lite-why-no-dedicated-board-d19)
- [4. PT edition: choice of measuring chip](#4-pt-edition-choice-of-measuring-chip-d13)
- [5. Assembly services compared](#5-assembly-services-compared-d7-d20)
- [6. Bring-up plan (rev A)](#6-bring-up-plan-rev-a)
- [7. Considered: Waveshare ESP32-P4-WIFI6-DEV-KIT](#7-considered-waveshare-esp32-p4-wifi6-dev-kit)
- [8. Relay supply switch and watchdog without fee parts](#8-relay-supply-switch-and-watchdog-without-fee-parts-d23)

Section numbers in the decisions (4.1, 11.1, …) refer to
[HAT-1wire.md](HAT-1wire.md) unless they name this page or the PT edition
([HAT-PT.md](HAT-PT.md)).

## 1. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | 12 V (DC/DC) or 5 V driver supply? | **12 V**: the HAT is meant to run for years; the margin is worth one DC/DC module |
| D2 | One or two PWM outputs and relay outputs? | **Two positions each, one fitted**: PUMP1 and REL1 for the solar pump; PUMP2 and REL2 stay unfitted until a second pump is added |
| D3 | How many Pt1000 inputs? | **One** (revised): PT1 for the collector. The unfitted PT2 position (second MAX31865, terminal) was dropped: it made the board, the KiCad work and the docs bigger for an option few would use, and fitting it later meant hand-soldering an SSOP-20. A second Pt1000 (e.g. a flow line that passes 125 °C) means the PT edition. Frees CE1 (GPIO7) and space on the front edge |
| D4 | DS2482 or plain `w1-gpio`? | **`w1-gpio` on two buses** (GPIO 4 and 17), sensors in powered mode, DS2482 footprint as unfitted fallback. Keeps I²C out of normal use |
| D5 | Power the Pi from the HAT? | ~~Yes~~, replaced by D18: **no**, the Pi uses its own USB-C supply |
| D6 | Fit the HAT ID EEPROM? | **Footprint only**; fit later if automatic configuration is wanted |
| D7 | Hand assembly or factory assembly? | **Factory-assembled, delivered fully soldered**; AISLER or JLCPCB decided on quotes once the BOM exists (8.2) |
| D8 | Keep the external watchdog and PWM gating? | **Yes**: about €3 in parts. Since D15 (pump permanently powered) it is the main hardware stop path; with an optional cut-off relay it is the second, independent one, e.g. when an SSR fails short-circuited |
| D9 | Keep the MAX31865 or measure the Pt1000 more cheaply? | **Keep the MAX31865**: timing a capacitor charge with a GPIO is too inaccurate under Linux, and a small SPI ADC saves only about €6 but loses the ±45 V input protection on the roof cable and the sensor fault detection |
| D10 | Pluggable or fixed screw terminals? | **Fixed**: about €4 per board cheaper; the HAT rarely comes off, and then the wires are unscrewed |
| D11 | VBus receiver on the HAT? | **No**: VBus is only needed while the BX Plus is still connected (shadow mode, switchable phase). The existing loose adapter plugs onto pins 1, 6 and 10 on top of the stacking header until then; after the switch-over it goes away and the UART is free |
| D12 | Offer a Pt1000-only HAT? | **Yes, as a second edition** of the same board ([HAT-PT.md](HAT-PT.md)): same outline and shared KiCad sheets for power, pump, relay and watchdog; only the sensor sheet differs. Measuring chip: see D13 |
| D13 | Measuring chip for the PT edition? | **One LTC2983**: 8 independent 2-wire Pt1000 inputs (18 of its 20 inputs), excitation, fault detection and linearisation built in, result in °C, buffered inputs for simple protection. Costs a little more than 2 × ADS124S08 but needs far less analog design and software, and it frees GPIO4 for a 1-Wire bus. Comparison in section 4 of this page |
| D14 | Raspberry Pi or ESP32-P4 (Waveshare ESP32-P4-WIFI6-DEV-KIT, same form factor)? | **Raspberry Pi**: more people already own one, and Linux gives more flexibility. The P4 board is a possible later port; its pin check is in section 7 of this page. On the P4, SCLK, REL1 and PWM2 would hit the RTC crystal and the audio amplifier |
| D15 | How do the Pi, the HAT and the pump get their power? | **Option A** ([ARCHITECTURE 5.6](ARCHITECTURE.md#56-230-v-side)): the Pi's own USB-C supply in a socket (most people already have one), the pump permanently on 230 V and stopped over PWM only. Cheapest, no mains wiring, no switching wear, and the pump feedback works at all times. Accepted: one stop path instead of two. REL1 stays on the board for an optional cut-off relay (option C), which heating-profile pumps always need |
| D16 | Spacer height: per board, or one for all? | **One tall height for all** (≈ 16–17 mm with a stacking header): fits the Pi 5 with active cooler or a passive heatsink, and a Pi 4; one BOM. Check that a passive heatsink stays below about 14 mm |
| D17 | Where do the field terminals go? | **Option B** (section 7): sensors and PUMP1 on the left edge, the rarely used PWR/REL1 and the unfitted positions at the front. All normally used wiring leaves on one side and the USB-C plug (D15) has the front edge to itself. Costs nothing; the left edge is then full. PT edition: S1–S8 and PUMP1 left, 1W-A at the front |
| D18 | Does the HAT need its own power input? | **No**: with option A (D15) the Pi runs from its own USB-C supply, so the PWR terminal, fuse, TVS and ideal diode were never used. Removed: about €4 and nine parts; the HAT's 5 V now sits behind the Pi's own input protection. DIN-rail builds feed the Pi through a USB-C lead (4.7). Replaces D5 |
| D19 | A separate low-cost board? | **No: 1-Wire Lite, a lighter build of the 1-Wire edition** (section 11): same board, without the 12 V DC/DC and the relay output; the pump driver runs on 5 V through R26 (0 Ω), with R9 = 100 Ω and D4 = SMBJ6.0A. Both 1-Wire buses and the PWR LED stay. Saves ≈ €4.50 in parts and ≈ €17 for one controller, as much as a dedicated Lite board would with the same parts, without a second layout, and can be upgraded. Solar-profile pumps only |
| D20 | Which parts to pick for the BOM? | **JLCPCB basic or preferred extended parts for everything ordinary** (section 5 of this page), so only the special chips pay a loading fee: about three fees per order (since D23) instead of fifteen or more, ≈ €25–30 less for a small order. Checked against the current lists before ordering. LEDs: types with a forward voltage of about 2 V (4.8) |
| D21 | How much text goes on the board? | **As much as fits** (7.1): pin names at every terminal and the signal paths (lines, arrows and small text from each terminal through its circuit to its GPIO) on the top side, a full wiring cheat sheet with the safety rules, the R25/R26 rule, LED meanings, build tick boxes and a QR code on the empty bottom side. Free at JLCPCB; text at least 1 mm high. DS18B20 wire colours are left out because they vary between makers |
| D22 | How is the pump signal driven? | **Transistor chain H3, the default** (HAT-1wire.md 4.1; alternatives in section 2 of this page): two NPN switches in series as the watchdog AND (PWM and WD_OK), a PNP to the supply, an NPN pulling the terminal low; all basic parts, ≈ €8.55 less for one than the original AND gate + TC4427, easy to explain, 40 V parts, the 600 W TVS and full pump voltage stay, and no 4.5 V minimum supply (helps the 1-Wire Lite, 11.1). Confirmed on the rev A prototype, which also carries the AND gate + TC4427 as a jumper-selected fallback; if H3 fails the tests in section 2 of this page, the released board goes back to it. Dropped: UCC27524 (enable defaults to on), two transistors with a resistor pull-down (too slow), H2 (weaker cable protection), single gate, single transistor, the Pi pin directly, level shifters. PWM range 100–1000 Hz |
| D23 | Can the relay supply switch and the watchdog be built from basic parts? | **Relay supply switch: yes**, an AO3401A P-MOSFET switched by an MMBT3904 from WD_OK (both JLCPCB basic parts) replaces the TPS22918: one loading fee less, ≈ €3 less for one controller on the 1-Wire and PT editions; it fails safe the same way. **Watchdog: keep the 74LVC1G123** for now: a 555 is an extended part too, and a transistor-only timer is unreliable with a heartbeat edge only every 2 s. Section 8 of this page |

## 2. Pump driver chain: alternatives (D22)

The chain as built is described in [HAT-1wire.md 4.1](HAT-1wire.md#41-pwm-pump-outputs)
and, step by step, in [HAT-1wire.md 11.3](HAT-1wire.md#113-the-pump-signal-step-by-step-1-wire-lite).

The chain from GPIO 18 to the terminal (step by step in
[HAT-1wire.md 11.3](HAT-1wire.md#113-the-pump-signal-step-by-step-1-wire-lite)) has four jobs: raise
3.3 V to at least 3.6 V (≈ 4.7 V wanted) at the pump, deliver its input
current (up to 7.5 mA), go to 0 V when the watchdog trips, and survive a
shorted or disturbed cable. The original design used an AND gate and a
TC4427, ≈ €8.60 per order of two boards in parts and JLCPCB fees; the
transistor chain H3 replaced it as the default. Pump voltages for the
1-Wire Lite at 3 mA; "price for one" against today.

| Option | How | Pump voltage | Watchdog / fail behaviour | Robust on the cable | Price for one | Verdict |
|---|---|---|---|---|---|---|
| A: AND gate + TC4427 (original design) | 74LVC1G08 gates the PWM with WD_OK, TC4427 drives | 🟢 ≈ 4.7 V | 🟢 AND gate forces 0 V; pull-down at boot | 🟢 TC4427 takes shorts and spikes | — | 🟡 **prototype fallback** (jumper on rev A) |
| B: one 5 V gate (74AHCT1G08), 1-Wire Lite only | TTL inputs accept 3.3 V, 5 V output, does the AND itself | 🟡 ≈ 4.1 V (R9 ≥ 220 Ω for its 25 mA limit); ≈ 3.4 V at 7.5 mA, below the minimum | 🟢 as A | 🟡 a logic gate on the field cable | ≈ −€5.40 (1-Wire Lite) | 🔴 no margin; the normal build still needs the TC4427, so two footprints |
| C: driver with enable input (UCC27524) instead of AND gate + TC4427 | WD_OK to the enable pins; pin-compatible with the TC4427 (its NC pins 1/8 are ENA/ENB) | 🟢 ≈ 4.7 V | 🔴 enable pins pulled **up** internally (200 kΩ): open = enabled, so safety depends on an external pull-down; gating and driving in one chip. Under-voltage lockout only below ≈ 3.8 V (3.5–4.1 V), so no help between 4.5 and 4 V | 🟢 like the TC4427 | ≈ −€3.60 (≈ −€1.30 per board in a group of 5) | 🔴 reviewed and dropped (below) |
| D: transistor + pull-up to 5 V | Transistor pulls down, resistor pulls up | 🔴 1 kΩ pull-up: ≈ 2 V at the pump | 🔴 inverts: Pi stopped or transistor open = **full speed** | 🟡 | ≈ −€5.50 | 🔴 unsafe fail direction |
| E: discrete push-pull | Totem pole from basic transistors, no fees | 🟢 ≈ 4.5 V | 🟡 safety logic from transistors, needs careful checking | 🟡 | ≈ −€5.00 | 🔴 5–7 parts in the safety path instead of one proven chip |
| F: Pi GPIO directly | Through a resistor | 🔴 3.3 V, below 3.6 V | 🔴 no gating | 🔴 Pi pin on the field cable | ≈ −€8.60 | 🔴 doesn't work |
| G: level-shifter chip (TXS0101 etc.) | 3.3 V → 5 V translator | 🔴 made for logic inputs, not mA loads | 🟡 | 🔴 | ≈ −€2 | 🔴 |
| **H2: three transistors instead of AND gate + TC4427** | Two NPNs in series (PWM and watchdog: "two switches in a row") drive a PNP high-side switch; pull-down and a small ESD diode at the terminal | 🟢 ≈ 4.3 V (1-Wire Lite), ≈ 7–8 V (normal) | 🟢 open parts end in 0 V; 🟡 three parts can fail short | 🟡 small ESD diode instead of the 600 W TVS | ≈ −€8.60 | 🟡 superseded by H3 |
| **H3: H2 plus an active pull-down transistor at the terminal** | As H2; a third transistor behind R9 pulls the terminal low whenever Q2 is off | 🟢 ≈ 4.55 V (1-Wire Lite), ≈ 10.5 V (normal) | 🟢 open parts end in 0 V; the new transistor fails to "stop" or "slower edge" | 🟢 the 600 W TVS stays | **≈ −€8.55** | 🟢 **default** (D22); confirmed on the rev A prototype (below) |
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
| Same 4.5 V minimum supply: no help for the 1-Wire Lite's margin (11.1 point 5) | ⚪ |
| A shared footprint for both options would double the variants (normal/1-Wire Lite × A/C) and add another either/or rule (AND gate vs its 0 Ω bypass) | 🔴 |

The benefit is almost only money, the drawbacks touch the safety concept.
If the real JLCPCB quote shows the fees matter more, the better lever is a
basic-part equivalent of the AND gate: same circuit, no fee.

**Option H in detail: two transistors instead of the TC4427.** Worked out
because it is simpler to explain and uses only basic parts (no JLCPCB fee).
The AND gate stays, so the watchdog logic is unchanged.

```
               +V_DRV (5 V 1-Wire Lite / 12 V normal)
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

| Value | 1-Wire Lite (5 V) | Normal (12 V) |
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
plus ≈ 0.3 nF of cable. With R4 = 1 kΩ that gives a time constant of ≈ 4.6 µs in the 1-Wire Lite, a
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
              +V_DRV (5 V 1-Wire Lite / 12 V normal)
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
| Pump voltage at 3 mA | ≈ 4.7 V 1-Wire Lite, ≈ 10.6 V normal | ≈ 4.3 V 1-Wire Lite, ≈ 7–8 V normal (R9/R4 divider): above the 3.6 V minimum in both |
| Falling edge | driven, ≈ 25 ns + R9 into D4 | R4 discharges cable and diode directly: ≈ 1.3 µs with ≈ 0.6 nF |
| Rising edge | through R9 into D4 | through R9 into the small diode: ≈ 0.3 µs (1-Wire Lite), ≈ 1.3 µs (normal) |
| Edge rule ≤ T/500 met up to | ≈ 1.5–2.2 kHz (D4 capacitance) | ≈ 1.5 kHz: **the 100–1000 Hz range stays** |
| Wasted current while high | ≈ 4 mA (driver) | ≈ 4.5 mA (1-Wire Lite), ≈ 8 mA (normal) in R4 |
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
≈ 50 mA (1-Wire Lite) / ≈ 25 mA (normal) a shorted cable causes, which the design
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
order (rev A) is a prototype anyway (bring-up plan, section 6). It carries
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

## 3. 1-Wire Lite: why no dedicated board (D19)

The 1-Wire Lite as built is described in [HAT-1wire.md 11](HAT-1wire.md#11-1-wire-lite).

**Why no dedicated Lite board:** the comparison that decided D19, both
Lite variants against the normal build (single-quantity parts; 🟢 good,
🟡 medium, 🔴 weak):

| | **Normal HAT** (1-Wire edition) | **HAT Lite** (own board) | **1-Wire Lite (build option)** | **Saved: Lite (own board)** | **Saved: 1-Wire Lite** |
|---|---|---|---|---|---|
| ***What's left out*** | | | | | |
| 12 V converter + its load resistor | 🟢 12 V pump signal, large margin | 🟡 5 V, small margin (≈ 4.7 V against 4 V) | 🟡 5 V via a 0 Ω link; converter can be fitted later | **€3.05** | **€3.05** |
| Relay output REL1 (switch chip, MOSFET, diode, terminal, R1 LED) | 🟢 cut-off relay (option C), heating-profile pumps, on/off loads | 🔴 none: solar-profile pumps only | 🟡 not fitted, spot stays | **€1.55** | **€1.55** |
| Second 1-Wire bus (terminal, ESD, pull-up) | 🟢 2 buses | 🟡 1 bus | 🟡 1 fitted, 1W-B can be fitted later | **€0.65** | **€0.65** |
| PWR LED | 🟢 | 🟡 none (WD shows power too) | 🟡 not fitted | **€0.15** | **€0.15** |
| 0 Ω link for 5 V | — | — | one extra part | — | **−€0.01** |
| ***Kept on all three*** | | | | | |
| MAX31865 for the collector, watchdog + PWM gating, all field-line protection, PUMP1 with feedback, WD and PUMP1 LEDs, tall header, full outline | 🟢 | 🟢 | 🟢 | — | — |
| PUMP2, REL2, DS2482 spots for later | 🟢 | 🔴 none | 🟢 | — | — |
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
second 1-Wire bus and the PWR LED were put back into the 1-Wire Lite (11.2),
so it now saves about €4.60 (≈ €4.50 since D22).

## 4. PT edition: choice of measuring chip (D13)

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
| Spare channels with 8 sensors | 🔴 0 | 🟡 2 | 🟢 6 | 🔴 none: 8 only as a series stack | 🟡 1 more sensor | 🟡 the buses take more probes |
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
| Range, accuracy | 🟢 Pt1000 beyond 200 °C, class B ±0.6 K at 60 °C | 🟢 same sensors | 🟢 same sensors | 🟢 same sensors | 🟢 same sensors | 🟡 ±0.5 K, max 125 °C (S4 can exceed it: PT edition) |
| Resolution | 15-bit, ≈ 0.03 K | 24-bit | 24-bit | 24-bit, 0.1 °C accuracy | 24-bit, 0.1 °C accuracy | DS18B20 12-bit, 0.0625 K |
| Package, space | 🔴 8 × SSOP-20, tight | 🟢 2 × TQFP-32 5×5 | 🟢 2 × QFN-32 5×5 (no hand soldering) | 🟢 1 × LQFP-48 7×7 | 🟢 1 × LQFP-48 7×7 | 🟢 roomy |
| ***Effort and risk*** | | | | | | |
| Circuit design | 🟢 low: PT1 circuit × 8 | 🔴 high: analog force/sense layout | 🔴 high: like ADS | 🟢 low–medium: datasheet circuits | 🟢 low–medium: datasheet circuits | 🟢 done: schematic drawn |
| Software | 🟢 simple, driver shared with the 1-Wire edition | 🔴 most: input and current switching, settling, linearising | 🟡 medium: the sequencer helps | 🟢 simple: write channel setup, read °C | 🟢 simple: write channel setup, read °C | 🟢 simple: kernel 1-Wire + MAX driver |
| Work at the installation | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🟢 move the existing wires | 🔴 fit 7 probes, run 2 cables, set calibration offsets |
| Charts vs. history | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟢 seamless | 🟡 small step, fixed with offsets |
| ***Verdict*** | | | | | | |
| Best for | fallback with a proven circuit, no 1-Wire | cheapest; cost-down option | spare analog inputs (other sensors) | only up to 4 independent sensors | 🟢 **PT edition: chosen** | 🟢 new installations, or when sensors get replaced anyway |

(A 1-Wire edition with a second Pt1000 for S4 was a variant here; its
PT2 position was dropped, D3.) The LTC2984 is the LTC2983 with an EEPROM for the channel setup; it
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

## 5. Assembly services compared (D7, D20)

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
chips without such an equivalent pay the fee: MAX31865, 74LVC1G123 and
B0512S (the LTC2983 of the PT edition is consigned; the pump driver and
the relay supply switch are built from basic transistors, D22, D23).
That is about three fees per
order instead of fifteen or more, roughly €25–30 less per order, which matters most for a single
controller (8.2). The same rule helps at other services: fewer special
part types means less setup everywhere.

Once the BOM exists, quotes from JLCPCB, PCBWay, NextPCB and AISLER go
into 8.2.

## 6. Bring-up plan (rev A)

1. Visual check, then resistance checks between all rails before power.
2. HAT on the Pi, Pi on its USB-C supply with a USB power meter: current
   rises by well under 200 mA, power LED on.
3. 12 V and 3.3 V present on the HAT. Measure the 5 V on the HAT
   (at C2) idle and with the Pi under load (`stress-ng` on all cores plus
   a USB drive copying): it must stay at or above 4.75 V. **1-Wire Lite:**
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
    list in section 2.

## 7. Considered: Waveshare ESP32-P4-WIFI6-DEV-KIT

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

## 8. Relay supply switch and watchdog without fee parts (D23)

After the transistor chain (D22), four part types still paid JLCPCB's
loading fee of about €2.80 per order: the MAX31865, the 74LVC1G123
watchdog, the B0512S DC/DC and the TPS22918 relay supply switch. Two of
them do simple jobs that transistors could do: the switch and the
watchdog. Prices from LCSC/JLCPCB, November 2026.

### 8.1 Relay supply switch

The job: give the relay outputs their 5 V only while `WD_OK` is high,
and switch it off when `WD_OK` is low, floating, or the Pi is off.

```
 +5V ───────┬──────────────── S ┐
            │                   Q12 AO3401A (P-MOSFET)
           R45 100 kΩ         D ├──── +5V_REL ─► REL1, REL2
            │                 G ┘
            ├───────────────────┘
            │
            C  Q13 MMBT3904 (NPN)
 WD_OK ─R46 10 kΩ─B
            E      R47 100 kΩ from B to GND
            │
           GND
```

- `WD_OK` high → Q13 conducts → the gate of Q12 is pulled to 0 V
  (V_GS = −5 V) → Q12 conducts with about 60 mΩ → the relays have power.
- `WD_OK` low or floating → Q13 is off → R45 holds the gate at 5 V →
  Q12 is off. R47 keeps Q13 off while the Pi boots.
- With a 100 mA relay coil the drop across Q12 is about 6 mV.

| | **TPS22918 (until now)** | **AO3401A + MMBT3904 (D23)** |
|---|---|---|
| JLCPCB category | 🔴 extended: loading fee ≈ €2.80 per order | 🟢 both basic: no fee |
| Part cost | 🟢 $0.14 | 🟢 ≈ $0.03 incl. three resistors |
| Off without `WD_OK` (fail-safe) | 🟢 | 🟢 |
| Soft start, output discharge | 🟢 built in | 🟡 none; harmless for a relay coil or an SSR input |
| Easy to explain | 🟡 "a load-switch chip" | 🟢 "the transistor pulls the gate down" |
| Parts on the board | 🟢 1 | 🟡 5 (two transistors, three resistors) |
| One part shorted | 🟡 relay supply always on; the GPIO-driven relay MOSFETs still decide | 🟡 same |
| **Saved, price for one** | — | 🟢 **≈ €3** (1-Wire and PT editions; the 1-Wire Lite has no relay output) |
| **Saved per board, group of 5** | — | 🟢 **≈ €0.70** |

**Decision:** adopted. Designators Q12, Q13, R45–R47; C11 and C12 stay
as input and output capacitors. U7 is gone.

### 8.2 Watchdog

The heartbeat has to come from the software, once per control cycle:
the watchdog is there to catch a program that hangs. A fast heartbeat
from the hardware PWM would not do, because the PWM keeps running when
the software hangs. So the watchdog only gets a rising edge about
every 2 s, and has to drop `WD_OK` after about 3 s without one.

| Option | JLCPCB category | Part cost | Rating | Comment |
|---|---|---|---|---|
| **A. 74LVC1G123 (retriggerable monostable)** | 🔴 extended, fee | 🟡 $1.48 | 🟢 | Made for this job; one RC sets the timeout; runs from 3.3 V |
| B. NE555 as missing-pulse detector | 🔴 extended, fee | 🟢 ≈ $0.10 | 🟡 | Saves ≈ €1.20 in parts but no fee; needs a PNP, a coupling capacitor and the 5 V rail (4.5–16 V); bipolar, draws more current |
| C. Transistors and an RC (charge pump) | 🟢 basic, no fee | 🟢 ≈ $0.05 | 🔴 | With one edge every 2 s, the capacitor must be large to hold a transistor on, and its ripple is about as large as the timeout itself: hard to set, hard to explain |

**Decision (for now):** keep the 74LVC1G123.

