import type { Planet } from "../types/types";

const SECONDS_IN_DAY = 86400;

// export function calculatePlanetPosition(
//   planet: Planet,
//   time: number
// ): { x: number; y: number } {
//   const { semiMajorAxis, period } = planet;

//   const meanAnomaly = (time / SECONDS_IN_DAY / period) * 2 * Math.PI;

//   const x = semiMajorAxis * Math.cos(meanAnomaly);
//   const y = semiMajorAxis * Math.sin(meanAnomaly);

//   return { x, y };
// }

// Calculate position using Kepler's equation
function solveKeplersEquation(M: number, e: number, tolerance = 1e-6) {
  // M = mean anomaly, e = eccentricity
  // Solve M = E - e*sin(E) for E (eccentric anomaly)
  let E = M; // initial guess
  let delta = 1;
  let iterations = 0;

  while (Math.abs(delta) > tolerance && iterations < 100) {
    delta = E - e * Math.sin(E) - M;
    E = E - delta / (1 - e * Math.cos(E));
    iterations++;
  }

  return E;
}

export function calculatePlanetPosition(
  planet: Planet,
  time: number
): { x: number; y: number; r: number; trueAnomaly: number } {
  // Calculate mean anomaly
  const n = (2 * Math.PI) / planet.revolutionPeriod; // mean motion
  const M = planet.meanAnomaly + n * (time / SECONDS_IN_DAY);

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKeplersEquation(M, planet.eccentricity);

  // Calculate true anomaly
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + planet.eccentricity) * Math.sin(E / 2),
      Math.sqrt(1 - planet.eccentricity) * Math.cos(E / 2)
    );

  // Calculate distance from sun
  const r = planet.semiMajorAxis * (1 - planet.eccentricity * Math.cos(E));

  // Convert to Cartesian coordinates
  const x = r * Math.cos(trueAnomaly);
  const y = r * Math.sin(trueAnomaly);

  return { x, y, r, trueAnomaly };
}
