# HAT simulations

The numbers in [HAT-development.md](../../docs/HAT-development.md)
sections 2 (H3 correction), 8.2 (capacitor watchdog) and 9 (voltage
doubler) come from these files. `sh tools/sim/run.sh` re-runs the main
cases (needs `ngspice` and a C compiler).

| File | What |
|---|---|
| `models.inc` | Standard 2N3904 / 2N3906 / 1N4148 SPICE models (for MMBT3904, MMBT3906, 1N4148W), a pump-input LED and the SMBJ13A as a simple breakdown diode |
| `h3_chain.sub` | Pump driver chain H3 as built: Q4, Q6, Q7, R7, R9, R33, R35–R38, D4. Q5 (watchdog switch) is shown closed |
| `h3_chain_first_version.sub` | The first H3 version with Q7's base on PWM_OFF, which does not switch (section 2) |
| `doubler.sub` | Voltage doubler D25. Netlist names → board: Q1/Q2 = Q15/Q16, Qn/Qp = Q17/Q18, Rc1/Rc2 = R54/R55, Rb1/Rb2 = R56/R57, Ct1/Ct2 = C20/C21, Cf = C22, Co = C23, D1/D2 = D21/D22 |
| `watchdog.c` | Time-step simulation of the capacitor watchdog (D24) with a 1N4148 diode model. Arguments: heartbeat Hz, R48, C16, C17 in series with C19, C18, R49 ∥ R50, run time, stop time, stall start, stall length |

The pump input is modelled as a resistor and an LED, like the
optocoupler inside the pump: 2.2 kΩ for a normal pump, 470 Ω as a stress
case (about 10 mA).
