/**
 * IEC 60751 Callendar–Van Dusen equations for Pt1000 (alpha = 0.00385055 / K).
 */

const R0 = 1000.0;
const A = 3.9083e-3;
const B = -5.775e-7;
const C = -4.183e-12; // Used only for T < 0 °C

export function pt1000Resistance(tempC: number): number {
  if (tempC >= 0) {
    return R0 * (1 + A * tempC + B * tempC * tempC);
  }
  return R0 * (1 + A * tempC + B * tempC * tempC + C * (tempC - 100) * Math.pow(tempC, 3));
}

export function pt1000Temperature(resistanceOhm: number): number {
  if (!Number.isFinite(resistanceOhm) || resistanceOhm <= 0) {
    return -273.15;
  }
  if (resistanceOhm >= R0) {
    const discriminant = A * A - 4 * B * (1 - resistanceOhm / R0);
    if (discriminant < 0) {
      return 850;
    }
    return (-A + Math.sqrt(discriminant)) / (2 * B);
  }

  // Newton-Raphson for T < 0 °C
  let t = (resistanceOhm - R0) / (R0 * A);
  for (let i = 0; i < 6; i++) {
    const r = pt1000Resistance(t);
    const drdt =
      R0 * (A + 2 * B * t + C * (4 * Math.pow(t, 3) - 300 * t * t));
    t = t - (r - resistanceOhm) / drdt;
  }
  return t;
}

/**
 * Thermal dissipation constant of a typical collector Pt1000 probe in a brass/stainless
 * thermowell pocket (~15 mW/K in still fluid/paste, worse ~6 mW/K in dry air).
 */
export function selfHeatingDeltaK(powerMw: number, dissipationMwPerK = 15): number {
  return powerMw / dissipationMwPerK;
}
