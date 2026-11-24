# Instructions for AI assistants

Before you change anything in this repository, read
[CONTRIBUTING.md](CONTRIBUTING.md). It holds the rules that protect the pump
and the collector (`costos-core` and `costos-safety` stay `no_std`, no
panics, the safety supervisor only ever reduces, a sensor fault means pump
off, the replay days stay unchanged) and how to work here: elaborate
comments, tests written from the specification, one commit per topic, never
rewriting pushed history, and docs updated in the same push.

The design and the reasons behind it are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); what is still open is in its
section 10.2. Hardware decisions are in
[docs/HAT-development.md](docs/HAT-development.md).
