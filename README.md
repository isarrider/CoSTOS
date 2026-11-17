# OSCoST

**Open Source Controller for Solar Thermal Systems**

OSCoST is an open-source controller for solar thermal systems: the box that
decides when the solar pump runs, how fast, and when it has to stop to
protect the store and the collector. It runs on a Linux single-board
computer (Raspberry Pi 4 or 5), is written in Rust, and is
configured completely through a web interface.

> **Status: planning.** There is no code yet, only the
> [architecture draft](docs/ARCHITECTURE.md). Don't use this to control a
> real system. When it is ready to be tested, this README will say so.

## Why

Commercial solar controllers work, but they are closed: you can't see why
they decided something, you can't add a function, and getting data out of
them needs reverse-engineered protocols. OSCoST is meant to be a controller
you can read, test and extend, with its data available everywhere you need
it.

The first goal is to replace a RESOL DeltaSol BX Plus in a real
installation, so that's the reference for which functions come first.

## Planned features

- **Solar control**: ΔT pump control with hysteresis, speed control for
  high-efficiency pumps (PWM), store maximum, collector emergency shutdown.
  Later: collector cooling, tube collector function, frost protection,
  heat quantity metering.
- **Sensors**: Pt1000 (via MAX31865) for hot spots like the collector, and
  DS18x20 1-Wire sensors (DS1820/DS18S20, DS18B20, DS1822) for everything
  else. Mix them freely.
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

- Raspberry Pi 4 or Raspberry Pi 5
- MAX31865 boards for Pt1000 sensors, a 4.7 kΩ pull-up for DS18x20 sensors
- Solid-state or relay outputs for pumps and valves, PWM output for
  high-efficiency pumps
- An independent overtemperature cut-out on the store. OSCoST does not
  replace that.

Mains wiring belongs in the hands of a qualified electrician.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): goals, safety concept, hardware,
  software structure, web interface, data export, testing and the
  migration plan.
- [Hardware needed](docs/HARDWARE.md): parts lists and build instructions,
  starting with the PWM pump output.
- [HAT specification](docs/HAT.md): the planned plug-on board that
  combines all of it, in two editions: 1 Pt1000 + two 1-Wire buses, or
  8 Pt1000 + one 1-Wire bus for installations that keep their existing
  sensors.
- [Reference installation](docs/installation.md): the system OSCoST is
  built to control first.

## Related

- [vbus2influx](https://github.com/isarrider/vbus2influx): reads a RESOL
  controller over VBus and pushes the data to InfluxDB/VictoriaMetrics.
  OSCoST uses the same metric names (with the prefix `oscost`), so
  dashboards carry over.

## License

[MIT](LICENSE)
