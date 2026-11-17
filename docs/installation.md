# Reference installation

This is the system OSCoST is built to control first. It is the **acceptance
spec**: OSCoST is ready to replace the existing controller when it
reproduces its behaviour for this installation (see
[Migration](ARCHITECTURE.md#9-migration-from-the-deltasol-bx-plus)).

Status: **incomplete**. Open points are listed at the end.

## Controller being replaced

- RESOL DeltaSol BX Plus, read over VBus by
  [vbus2influx](https://github.com/isarrider/vbus2influx).

## Solar pump

| | |
|---|---|
| Pump | Wilo Yonos PARA ST 15/7.0-PWM2 |
| Control | External PWM, profile **PWM2 (solar)** |
| Signal cable | 2 wires: brown = PWM input, blue = PWM ground. **No feedback signal.** |
| Signal level | max. 15 V, max. 7.5 mA |
| Signal frequency | 100–5000 Hz |
| Cable break | Pump stops |

PWM2 characteristic (input duty cycle → pump):

| PWM input | Pump |
|---|---|
| < 7 % | stops (standby) |
| 7–15 % | runs at minimum speed (once running) |
| 12–15 % | starting band: the pump starts from standby only above this |
| 15–95 % | speed rises linearly from minimum to maximum |
| > 95 % | maximum speed |

Consequences for OSCoST:

- OSCoST preset **"Wilo PWM2"**: stop = 0 %, start at ≥ 20 %, regulate
  between 15 % (minimum) and 100 % (maximum). The 7–12 % hysteresis band is
  never used, so start and stop are unambiguous.
- Output stage: 12 V gate driver as described in
  [PWM pump outputs](ARCHITECTURE.md#53-pwm-pump-outputs). 12 V is within
  the 15 V maximum.
- Frequency: 500 Hz (the RESOL controller uses 512 Hz).
- No feedback, so pump faults have to be detected through temperature
  plausibility, a flowmeter or the pump's mains current.

## Open points

- Sensors: which BX Plus inputs are used, where each sensor sits
  (collector, store bottom, store top, …), sensor type.
- Other outputs: further pumps or valves on the BX Plus relays.
- Store: one or several, volume.
- Collector: flat-plate or evacuated tube, area.
- Heat transfer fluid: glycol or water, glycol percentage.
- Flowmeter (V40 or similar) present?
- Independent store overtemperature cut-out present?
