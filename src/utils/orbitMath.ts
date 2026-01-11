import type { Planet } from "../types/types";

const SECONDS_IN_DAY = 86400;

export function calculatePlanetPosition(
  planet: Planet,
  time: number
): { x: number; y: number } {
  const { semiMajorAxis, period } = planet;

  const meanAnomaly = (time / SECONDS_IN_DAY / period) * 2 * Math.PI;

  const x = semiMajorAxis * Math.cos(meanAnomaly);
  const y = semiMajorAxis * Math.sin(meanAnomaly);

  return { x, y };
}
