#!/bin/sh
# Re-runs the HAT simulations behind HAT-development.md 2, 8.2 and 9.
# Needs ngspice and a C compiler. Usage: sh tools/sim/run.sh
set -e
cd "$(dirname "$0")"
OUT=$(mktemp -d)

meas() { ngspice -b "$1" 2>/dev/null | grep -E "^($2) " | awk '{printf "%s=%.3g ", $1, $3}'; echo; }

chain() { # label supply-node-line R9 Rpump subckt
cat > "$OUT/c.cir" <<EOT
* chain
.include $PWD/models.inc
.include $PWD/doubler.sub
.include $PWD/h3_chain.sub
.include $PWD/h3_chain_first_version.sub
.param R9=$3 R37=47k
$2
Vp pwm 0 PULSE(0 3.3 0 100n 100n 1m 2m)
X2 vdrv pwm term 0 $5
Rp term pin $4
Dp pin 0 DLED
.tran 1u 60m 0 1u uic
.measure tran vhigh AVG v(term) from=50.2m to=50.9m
.measure tran vlow AVG v(term) from=51.2m to=51.9m
.end
EOT
printf '%-46s' "$1"; meas "$OUT/c.cir" "vhigh|vlow"; }

echo "== H3 chain, first version against fixed (section 2)"
chain "first version, 12 V, R9 470" "Vd vdrv 0 12" 470 2.2k CHAIN1
chain "fixed, 12 V, R9 470" "Vd vdrv 0 12" 470 2.2k CHAINF
echo "== pump terminal, PWM high (section 9.2)"
for v in 5.0 4.63; do for p in 2.2k 470; do
  chain "Pi 5V only, $v V, pump $p" "Vs vdrv 0 $v" 100 $p CHAINF
  chain "doubler, $v V, pump $p" "Vs vs 0 $v
Rs vs vin 0.1
X1 vin vdrv 0 DBL" 100 $p CHAINF
done; done

echo "== capacitor watchdog (section 8.2): f Rs Cf C1 Ch Rh T stop stall0 stallLen"
cc -O2 -o "$OUT/wd" watchdog.c -lm
for f in 0.5 1 20 2000; do "$OUT/wd" $f 4.7e3 1e-7 0.235e-6 10e-6 1.1e6 40 0 0 0; done
"$OUT/wd" 20 4.7e3 1e-7 0.235e-6 10e-6 1.1e6 60 20 0 0
rm -rf "$OUT"
