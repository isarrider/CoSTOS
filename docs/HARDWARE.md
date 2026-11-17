# Hardware needed

This page lists the electronics OSCoST needs between the single-board
computer and the system, and how to build them. It grows as the hardware is
designed. Right now it covers:

- [PWM pump output](#pwm-pump-output): driving a high-efficiency pump's
  speed input from the Raspberry Pi.

> **Safety.** Everything on this page is low voltage (5 V and 12 V). The
> pump's 230 V supply stays where it is: on a relay that switches off when
> OSCoST stops responding (see
> [Safety](ARCHITECTURE.md#4-safety)). Leave mains wiring to a qualified
> electrician.

The stripboard circuits here are the tested basis for a single plug-on
board that combines everything: see the [HAT specification](HAT.md).

Hole positions on stripboard are given as **row letter + column number**,
as seen from the component side: `D8` is row D, column 8.

---

## PWM pump output

The pump (here a Wilo Yonos PARA ST 15/7-50/iPWM2) gets its speed as a
PWM signal: **brown = PWM input**, **blue (or grey) = signal ground**. Its
input needs a high level of about 4 V or more and takes at most 15 V and
7.5 mA, at 100–5000 Hz (Wilo's newer Para series accepts up to 24 V). The
12 V used here suits both.

A Raspberry Pi pin gives 3.3 V and very little current, so something has to
sit in between. See
[PWM pump outputs](ARCHITECTURE.md#53-pwm-pump-outputs) for the background.

iPWM pumps like this one also have a **black** wire: a **feedback output**
that reports the pump's status (stopped, running, warning, error, no power)
as a 75 Hz PWM signal. The driver board (option 1) has an input for it.
Pumps without feedback work the same way; their J2 FB terminal just stays
empty.

Three ways to do it:

| | Option 1: driver board, 12 V | Option 1 simplified: driver board, 5 V | Option 2: optocoupler module |
|---|---|---|---|
| What | TC4427 gate driver + 5→12 V DC/DC on stripboard | Same board without the DC/DC; driver runs from the Pi's 5 V | Ready-made PC817 level-shifter module |
| Soldering | Yes, about an hour | Yes, a bit less | None (screw terminals) |
| Signal at the pump | about 10.6 V (worst case 7.5 V) | about 4.7 V (worst case 4.0 V) | about 12 V, slow edges |
| Margin above the pump's ~4 V threshold | large | **small** | large |
| Isolation Pi ↔ pump wiring | No (series resistor and TVS diode) | No (series resistor and TVS diode) | Yes |
| Extra supply | None (12 V made on the board) | None | Separate 12 V supply |
| Parts cost | about €5 | about €3 | about €3–7 plus the 12 V supply |
| Pump feedback (black wire) | Yes, input on the board | Yes, input on the board | Not covered (would need a second, reversed optocoupler) |
| Recommended | **yes** | if you want the simplest board and accept the small margin | if you don't want to solder |

#### 12 V or 5 V?

Both driver boards are the same circuit; the simplified one just leaves out
the DC/DC module and runs the TC4427 from the Pi's 5 V. That saves three
parts and the module, but the pump then gets only about 4.7 V instead of
about 10.6 V, against a threshold of about 4 V:

![Comparison: 12 V board versus simplified 5 V board](img/pwm-driver-options-comparison.svg?v=5a6668610b)

- **Worst case** means the Pi's 5 V at its lower limit (4.75 V), the DC/DC
  at 11 V and the pump drawing its maximum input current (7.5 mA). Then the
  simplified board delivers exactly the threshold, with no margin left.
- **Typical** values (5.0 V, 12 V, about 3 mA) leave the simplified board
  0.7 V above the threshold. That works, but a weak 5 V supply, a long
  cable or an older pump with a higher threshold can eat it up.
- **The PWM frequency doesn't change this.** The margin is about the
  voltage level; 200 Hz or 500 Hz makes no difference with the fast TC4427.
  (Lower frequencies help only with slow optocouplers, see
  [option 2](#limits).)

---

### Option 1: driver board, 12 V

A TC4427 MOSFET driver turns the Pi's 3.3 V PWM into a clean 0/12 V signal.
A small DC/DC module makes the 12 V from the Pi's 5 V. A second, simple
circuit reads the pump's feedback output. The board needs five wires to the
Pi and up to three to the pump.

![Circuit diagram of the driver board](img/pwm-driver-schematic.svg?v=ccb3155f0f)

What each part does:

- **U1 TC4427**: two non-inverting drivers; only channel A is used. Accepts
  3.3 V logic, outputs 0 V or 12 V with very fast edges.
- **U2 B0512S-1WR3**: turns 5 V into 12 V (1 W, 84 mA max). Its
  input/output isolation is deliberately bridged, because the driver needs
  the same ground as the Pi.
- **R1 100 kΩ**: pulls the driver input low while the Pi boots and the pin
  is not yet configured. Low = 0 % = **pump stopped** (PWM2 profile).
- **R2 470 Ω**: limits the current if the pump cable is shorted. At the
  pump's few mA it drops only a few volts, so the pump still sees well over
  its 4 V minimum.
- **R3 1.5 kΩ**: the DC/DC module needs at least 10 % load (about 8 mA) to
  keep a stable output voltage; R3 provides it.
- **D1 P6KE15A**: TVS diode, clamps spikes and static discharge coming in
  over the pump cable.
- **C1, C2, C3**: decoupling for the driver and the DC/DC module.
- **R4 4.7 kΩ**: pull-up to 3.3 V for the pump's open-collector feedback
  output. When the pump's output transistor is on, it pulls the line low;
  otherwise R4 pulls it up to 3.3 V. The current (0.7 mA) stays under the
  1 mA Wilo allows.
- **R5 10 kΩ**: between the feedback line and the Pi's GPIO. If a wrong
  voltage ever reaches the black wire (a wiring mistake, a spike), R5 keeps
  the current into the GPIO small enough for the Pi's internal protection.
- **C4 1 nF**: filters short spikes picked up on the cable. With R5 it
  delays edges by about 10 µs, nothing compared with the 13 ms period of the
  75 Hz feedback signal.

Without a pump connected to J2 FB, R4 simply holds the GPIO at 3.3 V. That
is harmless; OSCoST is told per pump whether there is a feedback signal to
read and ignores the input otherwise.

#### Parts list

| Ref | Part | Notes |
|---|---|---|
| U1 | **TC4427** in DIP-8 (TC4427CPA, TC4427ACPA or TC4427EPA) | Must be TC4427 (non-inverting). TC4426 is inverting, TC4428 mixed. |
| — | DIP-8 IC socket | Recommended, so U1 can be inserted last and replaced |
| U2 | **Mornsun B0512S-1WR3** (or B0512S-1W) | SIP-4, 5 V in, 12 V out. Pin order 1 −Vin, 2 +Vin, 3 0V, 4 +Vo |
| C1 | 100 nF ceramic, ≥ 25 V, 5.08 mm pitch | |
| C2 | 2.2 µF electrolytic, ≥ 25 V | Value recommended by the DC/DC datasheet; don't go much higher |
| C3 | 4.7 µF electrolytic, ≥ 16 V | |
| R1 | 100 kΩ, 0.25 W | |
| R2 | 470 Ω, **0.5 W** or 0.6 W metal film | |
| R3 | 1.5 kΩ, 0.25 W | |
| D1 | **P6KE15A** TVS diode, unidirectional | Not the bidirectional P6KE15CA |
| R4 | 4.7 kΩ, 0.25 W | |
| R5 | 10 kΩ, 0.25 W | |
| C4 | 1 nF ceramic, ≥ 25 V | 2.54 mm pitch, or bend the leads |
| J1 | 5-pin male pin header, 2.54 mm | For jumper wires to the Pi |
| J2 | 3-pin PCB screw terminal, 5.08 mm | For the pump cable (or 2-pin + 1-pin side by side) |
| — | Stripboard, 2.54 mm, at least 20 × 13 holes | Strips must run along the 20-hole side |
| — | Solid insulated wire, about 0.5 mm | For the wire links |
| — | 5 jumper wires female–female, 10–20 cm | Pi to J1 |

Tools: soldering iron, solder, side cutters, a strip cutter (or a 3.5–4 mm
drill bit turned by hand), a multimeter.

#### Layout

Component side. The copper strips run left to right underneath.

![Stripboard layout, component side](img/pwm-driver-stripboard-top.svg?v=1996648f36)

Copper side, flipped left to right as you see it when you turn the board
over. Use this one for the cuts and to check your solder joints.

![Stripboard layout, copper side](img/pwm-driver-stripboard-copper.svg?v=aa308c08df)

The drawings are generated by
[`tools/hw/pwm_driver_layout.py`](../tools/hw/pwm_driver_layout.py), which
also checks every connection on the board against the circuit diagram.

#### Building it, step by step

Solder the flattest parts first; that way the board lies flat while you
work.

1. **Cut the board** to 20 columns × 13 rows, with the strips running
   along the 20 columns. Write `A1` on the corner that will be top left
   (component side) so you don't lose orientation.
2. **Make the five strip cuts**:
   - under U1: **E9, F9 and G9**. From the copper side (second drawing)
     they are in the middle, just right of centre.
   - next to J1: **F4 and G4**. From the copper side they are near the
     right edge.

   Twist the strip cutter or drill bit until the copper ring is gone
   completely. Check with the multimeter (continuity mode): E8–E11, F8–F11,
   G8–G11, F3–F5 and G3–G5 must **not** beep.
3. **Wire links** (insulated wire; strip only the ends):
   - **L3**: G7 → F7 (short)
   - **L2**: F6 → D6
   - **L1**: B13 → D13
   - **L4**: F14 → A14 (red in the drawing: +12 V)
   - **L5**: K18 → D18 (long)
   - **L6**: F3 → L3 (orange in the drawing: 3.3 V)
   - **L7**: G2 → H2 (short; feedback)

   The links only connect at their two ends. Where they cross other strips
   they must not touch the copper, which is why they're insulated.
4. **Resistors**:
   - **R2** 470 Ω lying flat from **E15 to I15**.
   - **R1** 100 kΩ standing upright between **D7 and E7**.
   - **R3** 1.5 kΩ standing upright between **A9 and B9**.
   - **R5** 10 kΩ lying flat from **H12 to M12**.
   - **R4** 4.7 kΩ standing upright between **L16 and M16**.
5. **IC socket for U1**: pins 1–4 in **D8, E8, F8, G8**, pins 8–5 in
   **D11, E11, F11, G11**. The notch points up (towards row A–C), pin 1 is
   at **D8**. Don't insert the chip yet.
6. **C1** 100 nF between **D12 and F12**, **C4** 1 nF between **G6 and H6**
   (no polarity).
7. **Electrolytic capacitors**, mind the polarity (the stripe on the can
   marks **minus**):
   - **C3** 4.7 µF: **+ in C6**, − in B6.
   - **C2** 2.2 µF: **+ in A7**, − in B7.
8. **D1** P6KE15A standing upright: **band (cathode) in I17**, other end in
   K17.
9. **U2** DC/DC module, standing: **pin 1 in D4**, pin 2 in C4, pin 3 in
   B4, pin 4 in A4. Pin 1 is marked on the module (dot, notch or the
   printed "1"). Check before soldering: this part is the easiest to put
   in the wrong way round.
10. **J1** pin header: **C1 = 5V, D1 = GND, E1 = PWM, F1 = 3V3, G1 = FB**.
    Label them on the board with a marker.
11. **J2** screw terminal with the openings facing outwards (right):
    **I19 = PWM (brown)**, **K19 = GND (blue)**, **M19 = FB (black)**.

#### Checks before power

Look at the copper side under a bright light for solder bridges between
neighbouring strips, especially around U1 and U2. Then, still without U1
in its socket, measure with the multimeter:

| Measure between | Expect | If not |
|---|---|---|
| J1 5V – J1 GND | no short (resistance rises as C3 charges) | bridge on rows B–D near U2 |
| A row (+12 V) – D row (GND) | about 1.5 kΩ (R3) | bridge on rows A–B |
| E8 – E11 (socket pin 2 – pin 7) | open | cut E9 incomplete |
| F8 – F11 (socket pin 3 – pin 6) | open | cut F9 incomplete. **Important**: this one shorts 12 V to GND |
| J2 PWM – socket pin 7 (E11) | 470 Ω | R2 |
| J2 GND – J1 GND | 0 Ω | L5 |
| Socket pin 4 (G8) – J1 GND | 0 Ω | L3 / L2 |
| J1 3V3 – J1 GND | no short | cut F4 incomplete |
| J1 3V3 – J2 FB | 4.7 kΩ | R4, L6 |
| J1 FB – J2 FB | 10 kΩ | R5, L7, cut G4 |
| J1 FB – J1 GND | open (C4 charges briefly) | cut G4 incomplete, C4 shorted |

#### First power-up

1. Shut down the Pi and unplug it. Connect the five jumper wires:

   | Pi pin | J1 |
   |---|---|
   | 2 (5V) | 5V |
   | 6 (GND) | GND |
   | 12 (GPIO 18) | PWM |
   | 17 (3.3 V) | 3V3 |
   | 16 (GPIO 23) | FB |

   The pins are the same on the Pi 4 and the Pi 5.

   ![Wiring: Pi, driver board, pump](img/pwm-driver-wiring.svg?v=77a6463e4f)

2. Power up the Pi. Measure the A row against the D row: **about 12 V**
   (11–13.5 V is fine; the DC/DC output is unregulated). The DC/DC module
   should stay cold. J1 FB against GND should show **3.3 V** (R4 pulls it
   up while nothing is connected to J2 FB).
3. Shut down and unplug the Pi again, then insert **U1 into its socket,
   notch up, pin 1 at D8**.

#### Testing the output

The PWM is on **pin 12 (GPIO 18)** on both the Pi 4 and the Pi 5, but the
PWM hardware behind it differs, and so does the setup.

| Board | PWM pin on the header | PWM hardware | sysfs channel |
|---|---|---|---|
| Raspberry Pi 4 and older | **pin 12** (GPIO 18) | PWM0 in the main chip | `0` |
| Raspberry Pi 5 | **pin 12** (GPIO 18) | PWM0 in the RP1 I/O chip, channel 2 | `2` |

**1. Switch the PWM output on** (once, then reboot):

- **Raspberry Pi 4 and older**: add this line to `/boot/firmware/config.txt`
  (`/boot/config.txt` on older systems):

  ```
  dtoverlay=pwm,pin=18,func=2
  ```

- **Raspberry Pi 5**: add this line to `/boot/firmware/config.txt`:

  ```
  dtoverlay=pwm
  ```

  On the Pi 5 the PWM hardware sits in the RP1 chip, and GPIO 18 is
  channel **2** of its PWM0 block, not channel 0 as on older Pis. Guides
  for older Pis often use `pwm-2chan`; that has been reported not to work
  on the Pi 5, so stick to `pwm`. After the
  reboot, `pinctrl get 18` should show `a3 … PWM0_CHAN2`.

**2. Find the PWM chip.** The Pi 4 and Pi 5 number them differently, and
the Pi 5 already has one for its fan. Run `ls /sys/class/pwm/` before and after
step 1: the `pwmchipN` that appeared is yours. (If you didn't check before:
`ls -l /sys/class/pwm/` shows which hardware each one belongs to.)

**3. Set the PWM by hand** (500 Hz = 2 000 000 ns period). Fill in your
chip and the channel from the table:

```sh
CHIP=/sys/class/pwm/pwmchip0   # from step 2
CH=0                            # Pi 4: 0, Pi 5: 2

echo $CH     | sudo tee $CHIP/export
echo 2000000 | sudo tee $CHIP/pwm$CH/period       # 500 Hz
echo 0       | sudo tee $CHIP/pwm$CH/duty_cycle   # 0 %
echo 1       | sudo tee $CHIP/pwm$CH/enable
```

To change the duty cycle later: `echo 1000000 | sudo tee
$CHIP/pwm$CH/duty_cycle` (50 %).

With the multimeter on DC volts between J2 PWM and J2 GND (the meter
averages the PWM):

| `duty_cycle` | Duty | Expect at J2 |
|---|---|---|
| `0` | 0 % | 0 V |
| `1000000` | 50 % | about 6 V |
| `2000000` | 100 % | about 12 V |

#### Connecting the pump

1. Set the duty cycle back to `0`.
2. Unplug the pump's signal cable from the RESOL controller and connect it
   to J2: **brown → PWM, blue → GND, black → FB** (pumps without feedback:
   leave FB empty).
3. The pump still gets its 230 V from the RESOL relay. For the test, set
   that relay to manual **ON** in the RESOL menu. Remember to set it back
   to **Auto** afterwards.
4. Step through the PWM2 characteristic:
   - `0` (0 %): pump stays in standby.
   - `400000` (20 %): pump starts and runs slowly.
   - `1000000` (50 %), then `2000000` (100 %): pump gets faster.
   - back to `0`: pump stops.
5. Check the feedback (iPWM pumps), see below.
6. Finally plug the signal cable back into the RESOL controller and set its
   relay back to Auto, until OSCoST takes over.

#### Checking the feedback signal

Wilo documents the meaning of the feedback duty cycle for its Para series
(see [Reference installation](installation.md#feedback-output-black-wire)):
2 % = stopped and ready, 5–75 % = running, 80 % = warning, 85–95 % =
stopped by an error, 100 % = no power. The Yonos PARA iPWM uses the same
interface standard, but its own manual doesn't list the table. This check
confirms the values before OSCoST relies on them, and also tells which way
round the signal is counted.

The direction follows from the hardware: an unpowered pump can't switch
its output transistor on, so R4 holds the line high, and Wilo calls that
100 %. So the duty cycle is the share of time the line is **high**. When
the transistor is on, the line sits at about 0.4 V (0.7 mA through the
pump's internal 470 Ω), not 0 V.

A multimeter on DC volts between **J1 FB and J1 GND** shows the average of
the 75 Hz signal, which is enough to check this:

| Pump state | Expected feedback | Multimeter (average) |
|---|---|---|
| Powered, PWM input `0` (standby) | 2 % | about **0.4 V** |
| Running, PWM input `1000000` (50 %) | somewhere in 5–75 % | **between 0.5 and 2.6 V**, changes with speed |
| No power (RESOL relay off) | 100 % | about **3.3 V** |

If the readings follow this pattern, the table applies to this pump; note
the result in [Reference installation](installation.md). If they don't,
OSCoST uses the feedback only as "signal present / absent" until the
correct table is known.

Exact duty-cycle values (to tell 85 % from 90 % from 95 %) need the
software: OSCoST measures the time between edges on the GPIO.

---

### Option 1 simplified: 5 V driver board

The same driver board without the DC/DC module: the TC4427 runs directly
from the Pi's 5 V. Read [12 V or 5 V?](#12-v-or-5-v) first; this version
has only a small voltage margin at the pump.

![Circuit diagram of the simplified 5 V driver board](img/pwm-driver-5v-schematic.svg?v=0cf8b63730)

Differences to the [12 V board](#option-1-driver-board-12-v):

- **No U2, C2, R3.** The 5 V from the Pi goes straight to the driver's VDD
  (pin 6). The TC4427 works from 4.5 V, so the Pi's 5 V is enough.
- **R2 is 100 Ω instead of 470 Ω.** At 5 V there is no room for a large
  voltage drop. 100 Ω still limits a short circuit on the pump cable to
  50 mA, which the driver handles.
- **D1 is a P6KE6.8A instead of a P6KE15A.** It must clamp just above 5 V
  to protect the driver; a 15 V diode would never conduct here.
- The feedback input (R4, R5, C4) and everything else is identical.

#### Parts list

| Ref | Part | Notes |
|---|---|---|
| U1 | **TC4427** in DIP-8 (TC4427CPA, TC4427ACPA or TC4427EPA) | Must be TC4427 (non-inverting) |
| — | DIP-8 IC socket | Recommended |
| C1 | 100 nF ceramic, ≥ 16 V, 5.08 mm pitch | |
| C3 | 4.7 µF electrolytic, ≥ 10 V | |
| R1 | 100 kΩ, 0.25 W | |
| R2 | **100 Ω, 0.5 W** | |
| R4 | 4.7 kΩ, 0.25 W | |
| R5 | 10 kΩ, 0.25 W | |
| C4 | 1 nF ceramic, ≥ 16 V | 2.54 mm pitch, or bend the leads |
| D1 | **P6KE6.8A** TVS diode, unidirectional | Not the bidirectional P6KE6.8CA |
| J1 | 5-pin male pin header, 2.54 mm | |
| J2 | 3-pin PCB screw terminal, 5.08 mm | |
| — | Stripboard, 2.54 mm, at least 20 × 11 holes | Strips along the 20-hole side |
| — | Solid insulated wire, about 0.5 mm | For the wire links |
| — | 5 jumper wires female–female, 10–20 cm | Pi to J1 |

#### Layout

Component side:

![Simplified 5 V board, component side](img/pwm-driver-5v-stripboard-top.svg?v=2470abe822)

Copper side (flipped left to right):

![Simplified 5 V board, copper side](img/pwm-driver-5v-stripboard-copper.svg?v=1a3a6a1020)

Generated and checked by the same script as the 12 V board,
[`tools/hw/pwm_driver_layout.py`](../tools/hw/pwm_driver_layout.py).

#### Building it, step by step

1. **Cut the board** to 20 columns × 11 rows (rows A–K), strips along the
   20 columns. Mark the top-left corner `A1`.
2. **Make the five strip cuts**: under U1 **C9, D9, E9**; next to J1 **D4,
   E4**. Check with the multimeter that C8–C11, D8–D11, E8–E11, D3–D5 and
   E3–E5 do **not** beep.
3. **Wire links** (insulated wire):
   - **L3**: E7 → D7 (short)
   - **L2**: D6 → B6
   - **L7**: E2 → F2 (short; feedback)
   - **L4**: D14 → A14 (+5 V to the driver)
   - **L6**: D3 → J3 (3.3 V)
   - **L5**: I18 → B18 (long)
4. **Resistors**:
   - **R2** 100 Ω lying flat from **C15 to G15**.
   - **R5** 10 kΩ lying flat from **F12 to K12**.
   - **R1** 100 kΩ standing upright between **B7 and C7**.
   - **R4** 4.7 kΩ standing upright between **J16 and K16**.
5. **IC socket for U1**: pins 1–4 in **B8, C8, D8, E8**, pins 8–5 in **B11,
   C11, D11, E11**. Notch up, pin 1 at **B8**.
6. **C1** 100 nF between **B12 and D12**; **C4** 1 nF between **E6 and F6**.
7. **C3** 4.7 µF: **+ in A5**, − (stripe) in B5.
8. **D1** P6KE6.8A standing upright: **band (cathode) in G17**, other end in
   I17.
9. **J1** pin header: **A1 = 5V, B1 = GND, C1 = PWM, D1 = 3V3, E1 = FB**.
10. **J2** screw terminal, openings to the right: **G19 = PWM (brown)**,
    **I19 = GND (blue)**, **K19 = FB (black)**.

#### Checks before power

Without U1 in its socket:

| Measure between | Expect | If not |
|---|---|---|
| J1 5V – J1 GND | no short (rises as C3 charges) | bridge on rows A–B |
| D8 – D11 (socket pin 3 – pin 6) | open | cut D9 incomplete. **Important**: this one shorts 5 V to GND |
| C8 – C11 (socket pin 2 – pin 7) | open | cut C9 incomplete |
| Socket pin 6 (D11) – J1 5V | 0 Ω | L4 |
| J2 PWM – socket pin 7 (C11) | 100 Ω | R2 |
| J2 GND – J1 GND | 0 Ω | L5 |
| Socket pin 4 (E8) – J1 GND | 0 Ω | L3 / L2 |
| J1 3V3 – J1 GND | no short | cut D4 incomplete |
| J1 3V3 – J2 FB | 4.7 kΩ | R4, L6 |
| J1 FB – J2 FB | 10 kΩ | R5, L7, cut E4 |

#### Power-up and test

1. Connect the five jumper wires exactly as for the
   [12 V board](#first-power-up) (pins 2, 6, 12, 17, 16), with the Pi shut
   down.
2. Power up the Pi. Socket pin 6 (D11) against GND: **about 5 V**. J1 FB
   against GND: **3.3 V**.
3. Shut down, insert U1 (notch up, pin 1 at B8).
4. Set up the PWM as in [Testing the output](#testing-the-output). Without
   the pump connected, J2 PWM against J2 GND should read:

   | `duty_cycle` | Duty | Expect at J2 |
   |---|---|---|
   | `0` | 0 % | 0 V |
   | `1000000` | 50 % | about 2.5 V |
   | `2000000` | 100 % | about 5 V |

5. Connect the pump and check it as in
   [Connecting the pump](#connecting-the-pump) and
   [Checking the feedback signal](#checking-the-feedback-signal).
   **Additionally**, with the pump connected and the PWM at 100 %
   (`2000000`), measure J2 PWM against J2 GND: this is the real voltage at
   the pump input under load. **It must be at least 4.2 V.** If it is
   lower, the margin is too small for reliable operation: build the 12 V
   board instead.

---

### Option 2: optocoupler module

A ready-made module with a PC817 optocoupler: the Pi switches the LED
inside the optocoupler, and the output side switches 12 V from its own
supply. No soldering, and the Pi is electrically isolated from the pump
cable. The trade-off is slow edges (see [Limits](#limits)).

#### What to buy

| Part | Notes |
|---|---|
| **PC817 isolated level-shifter module** that converts **3.3 V up to 12 V** | For example the Boardoza PC817C (2 channels, 3.3–12 V on both sides). Many cheap modules only go the other way (12 V down to 3.3 V) or need 12–24 V at the input. Read the description. |
| **12 V supply** | A small 12 V plug-in power supply, or a 5 V → 12 V DC/DC module. Only a few mA are needed. |
| Wires | 2 jumper wires to the Pi, short wires for the 12 V supply |

#### Wiring

![Wiring: Pi, optocoupler module, 12 V supply, pump](img/pwm-opto-wiring.svg?v=5d3935f619)

| From | To |
|---|---|
| Pi pin 12 (GPIO 18) | module **IN+** (also called IN, SIG) |
| Pi pin 6 (GND) | module **IN−** (also called G, GND on the input side) |
| 12 V supply + | module **V+** (also called VCC, V2) |
| 12 V supply 0 V | module **V−** (also called GND, G2 on the output side) |
| module **OUT** | pump **brown** |
| module **V−** | pump **blue** |

The Pi's GND must **not** be connected to the 12 V side; otherwise the
isolation is gone.

#### Step by step

1. **Identify the terminals.** Every module labels them a bit differently;
   the table above lists the usual names. Input side = where the Pi
   connects, output side = where the 12 V supply connects.
2. **Check that 3.3 V is enough to switch it.** Connect only the output
   side to the 12 V supply. Connect IN− to Pi GND and touch IN+ to **Pi pin 1
   (3.3 V)**: the module's indicator LED should light, and OUT should
   change. If nothing happens, the module's input resistor is sized for a
   higher voltage, and the module is not suitable.
3. **Check whether it inverts.** Measure OUT against V− with IN+ **open**
   and with IN+ on **3.3 V**:
   - 0 V when open, about 12 V on 3.3 V: **non-inverting**. Good.
   - About 12 V when open, 0 V on 3.3 V: **inverting**. OSCoST can invert
     its output in the settings, but with an inverting module the pump
     gets **100 %** whenever the Pi is off or booting. With the PWM2
     profile that means full speed instead of stop, so the pump's 230 V
     relay is then the only thing that stops it. Prefer a non-inverting
     module.
4. **Wire everything** as in the drawing, with the Pi shut down.
5. **Test** exactly as for option 1: enable PWM on GPIO 18
   ([Testing the output](#testing-the-output)), measure OUT against V−
   (0 % → 0 V, 50 % → about 6 V, 100 % → about 12 V), then
   [connect the pump](#connecting-the-pump).

#### Limits

- **Slow edges.** The PC817 needs tens of microseconds to switch, while
  Wilo specifies edges of a few microseconds. Each edge shifts the
  effective duty cycle a little. At 500 Hz (2 ms period) that is roughly
  1–2 %, which is acceptable for speed control. Use a lower PWM frequency
  for this option, for example **200 Hz** (period `5000000`), which halves
  the error and is still well inside the pump's 100–5000 Hz range.
- **No margin data.** Modules differ in input resistor, pull-up and
  optocoupler grade. Steps 2 and 3 above are the minimum check; if the
  pump behaves erratically at low duty cycles, use option 1.
