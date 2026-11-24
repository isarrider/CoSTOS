# CoSTOS

**Controller for Solar Thermal – Open Source**

CoSTOS is an open-source controller for solar thermal systems: the box that
decides when the solar pump runs, how fast, and when it has to stop to
protect the store and the collector. It runs on a Linux single-board
computer (Raspberry Pi 3, 4 or 5), is written in Rust, and is
configured completely through a web interface.

> **Status: early development.** Milestone 1 has started: the control
> core and the safety supervisor exist as tested Rust libraries, nothing
> talks to hardware yet. Don't use this to control a real system. When it
> is ready to be tested, this README will say so.

## Why

Commercial solar controllers work, but they are closed: you can't see why
they decided something, you can't add a function, and getting data out of
them needs reverse-engineered protocols. CoSTOS is meant to be a controller
you can read, test and extend, with its data available everywhere you need
it.

The first goal is to replace a RESOL DeltaSol BX Plus in a real
installation, so that's the reference for which functions come first.

## Planned features

- **Solar control**: ΔT pump control with hysteresis, speed control for
  high-efficiency pumps (PWM), store maximum, collector emergency shutdown.
  Later: collector cooling, tube collector function, frost protection,
  heat quantity metering.
- **Sensors**: Pt1000 via an LTC2983 (up to 9 sensors on one chip, so
  the Pt1000s of an existing controller can stay) or a MAX31865 (one
  sensor, e.g. the collector), and DS18x20 1-Wire sensors (DS1820/DS18S20,
  DS18B20, DS1822). Mix them freely.
- **Web interface** for everything: live status, history, manual mode, and
  all configuration, including a setup wizard that shows live readings so
  you can identify sensors and test outputs. No config files to edit.
  Status pages are readable without login, any change needs one.
- **Data**: every value pushed to VictoriaMetrics once per second, buffered
  on disk while the database is unreachable and backfilled afterwards.
  Optional (off by default): MQTT with Home Assistant discovery.
- **Safety first**: outputs off by default, hardware and software
  watchdogs, plausibility checks on every sensor, and a safety layer that
  can only switch things off, never on. See
  [Safety](docs/ARCHITECTURE.md#4-safety).

## Hardware (planned)

- Raspberry Pi 4 or Raspberry Pi 5 with its own USB-C power supply, or a
  Raspberry Pi 3 B / B+ with its micro-USB supply (should work, untested;
  [details](docs/HAT-1wire.md#raspberry-pi-3))
- The [CoSTOS HAT](docs/HAT.md) (1-Wire edition or PT edition;
  [which one?](docs/HAT.md#which-hat-both-editions-compared)), or for a bench setup: an LTC2983 or MAX31865 for Pt1000
  sensors, a 4.7 kΩ pull-up for DS18x20 sensors
- **A high-efficiency pump with a PWM input in the solar profile** (Wilo
  PWM2 / iPWM2 such as the Wilo Yonos PARA ST …/iPWM2, Grundfos profile
  C). This is a safety requirement: the pump stays permanently on 230 V
  and is started, regulated and stopped over PWM, and with the solar
  profile a missing signal means *stop*, so any failure of the Pi or the
  HAT stops the pump. A feedback output (iPWM) is recommended. Pumps with
  a heating profile or without PWM need a cut-off relay on the HAT's
  optional relay output. Details:
  [Pump requirement](docs/ARCHITECTURE.md#pump-requirement-safety)
- An independent overtemperature cut-out on the store. CoSTOS does not
  replace that.

Mains wiring belongs in the hands of a qualified electrician.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): goals, safety concept, hardware,
  software structure, web interface, data export, testing and the
  migration plan.
- [Hardware needed](docs/HARDWARE.md): parts lists and build instructions,
  starting with the PWM pump output.
- [HAT](docs/HAT.md): the plug-on board that combines all of it: the
  editions compared, and which one to choose.
  - [1-Wire edition](docs/HAT-1wire.md) (1 Pt1000 + two 1-Wire buses): the
    board as it will be built, wiring, costs.
  - [PT edition](docs/HAT-PT.md) (8 Pt1000 + one 1-Wire bus, for
    installations that keep their existing sensors).
- [HAT development](docs/HAT-development.md): why the HAT is built this
  way: decisions D1–D25, the alternatives that were dropped, the
  simulations, the rev A prototype and its bring-up and tests.
- [Reference installation](docs/installation.md): the system CoSTOS is
  built to control first.

## Code

A Cargo workspace (layout: [ARCHITECTURE 6.1](docs/ARCHITECTURE.md#61-workspace-layout)).
So far:

| Crate | What it does | Status |
|---|---|---|
| `crates/costos-core` | Control logic, `no_std`: temperature, time, sensor and duty types (the rules of ARCHITECTURE 6.1); ΔT control with the flow/return switch-off, store maximum, speed control (PI or BX-like steps), start profiles, anti-seize run and full-speed purge, and the control cycle that chains them | 🟢 milestone 1 done |
| `crates/costos-safety` | Safety supervisor, `no_std`: sensor unknown → off, collector and store emergency shutdown with hysteresis and latch, minimum off time; can only reduce the request | 🟢 milestone 1 done |
| `crates/costos-replay` | PC tool: replays recorded BX Plus days (`tests/replay`) through the control and lists where CoSTOS decides differently | 🟢 |
| `crates/costos-sim` | Thermal model of the reference solar loop and closed-loop scenario tests of the whole control chain (sunny, cloudy, stagnation, sensor faults, stuck pump, restarts) | 🟢 milestone 2 done |
| `tools/sim` | ngspice circuit simulations of the HAT, and the Python yield simulation (ARCHITECTURE 8.2) | 🟢 |

```sh
cargo test --workspace                                   # unit, property, replay and simulation tests
cargo clippy --workspace --all-targets -- -D warnings    # lints as in CI
```

CI also builds both crates for a bare-metal RISC-V target, so they stay
free of `std`.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) first, whether you are a
person or an AI assistant: the rules for the control and safety code
(`no_std`, no panics, the supervisor only reduces), comments, tests,
commits and docs.

## Related

- [vbus2influx](https://github.com/isarrider/vbus2influx): reads a RESOL
  controller over VBus and pushes the data to InfluxDB/VictoriaMetrics.
  CoSTOS uses the same metric names (with the prefix `costos`), so
  dashboards carry over.

## License

[MIT](LICENSE)
