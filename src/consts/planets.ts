import type { Planet } from "../types/types";
import { auToMeters, daysToSeconds } from "../utils/converters";

export const G = 6.674484e-11; // m^3 s^-2 kg^-1

export const SUN = {
  name: "Sun",
  color: "#ffea50",
  radius: 696_340 * 1_000, // m
};

// Real orbital parameters for planets
// Semi-major axis in AU, eccentricity, orbital period in Earth days, inclination (simplified to 0 for 2D)
export const PLANETS: Planet[] = [
  {
    name: "Mercury",
    color: "#8c7853",
    radius: 2_439.7 * 1_000, // m
    semiMajorAxis: auToMeters(0.387), // AU
    eccentricity: 0.206,
    mass: 3.302e23,
    revolutionPeriod: daysToSeconds(87.97),
    rotationPeriod: daysToSeconds(58.646),
    meanAnomaly: 0, // initial position
  },
  {
    name: "Venus",
    color: "#ffc649",
    radius: 6_051.8 * 1_000,
    semiMajorAxis: auToMeters(0.723),
    eccentricity: 0.007,
    mass: 4.868e24,
    revolutionPeriod: daysToSeconds(224.7),
    rotationPeriod: daysToSeconds(243),
    meanAnomaly: 0,
  },
  {
    name: "Earth",
    color: "#4a90e2",
    radius: 6_371 * 1_000,
    semiMajorAxis: auToMeters(1.0),
    eccentricity: 0.017,
    mass: 5.974e24,
    revolutionPeriod: daysToSeconds(365.26),
    rotationPeriod: daysToSeconds(1),
    meanAnomaly: 0,
  },
  {
    name: "Mars",
    color: "#e27b58",
    radius: 3_389.5 * 1_000,
    semiMajorAxis: auToMeters(1.524),
    eccentricity: 0.093,
    mass: 6.418e23,
    revolutionPeriod: daysToSeconds(686.98),
    rotationPeriod: daysToSeconds(1.026),
    meanAnomaly: 0,
  },
  {
    name: "Jupiter",
    color: "#c88b3a",
    radius: 71_492 * 1_000,
    semiMajorAxis: auToMeters(5.203),
    eccentricity: 0.048,
    mass: 1.899e27,
    revolutionPeriod: daysToSeconds(4332.59),
    rotationPeriod: daysToSeconds(0.41),
    meanAnomaly: 0,
  },
  {
    name: "Saturn",
    color: "#fad5a5",
    radius: 58_232 * 1_000,
    semiMajorAxis: auToMeters(9.537),
    eccentricity: 0.054,
    mass: 5.685e26,
    revolutionPeriod: daysToSeconds(10759.22),
    rotationPeriod: daysToSeconds(0.426377),
    meanAnomaly: 0,
  },
  {
    name: "Uranus",
    color: "#4fd0e7",
    radius: 25_362 * 1_000,
    semiMajorAxis: auToMeters(19.191),
    eccentricity: 0.047,
    mass: 8.682e25,
    revolutionPeriod: daysToSeconds(30688.5),
    rotationPeriod: daysToSeconds(0.718333),
    meanAnomaly: 0,
  },
  {
    name: "Neptune",
    color: "#4166f5",
    radius: 24_622 * 1_000,
    semiMajorAxis: auToMeters(30.069),
    eccentricity: 0.009,
    mass: 1.024e26,
    revolutionPeriod: daysToSeconds(60182),
    rotationPeriod: daysToSeconds(0.67125),
    meanAnomaly: 0,
  },
];

export const EARTH = PLANETS[2];
