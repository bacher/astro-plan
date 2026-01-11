import type { Planet } from "../types/types";

export const AU_IN_KM = 1.496e8; // km

export const SUN = {
  name: "Sun",
  color: "#ffea50",
  radius: 696_340, // km
};

// Real orbital parameters for planets
// Semi-major axis in AU, eccentricity, orbital period in Earth days, inclination (simplified to 0 for 2D)
export const PLANETS: Planet[] = [
  {
    name: "Mercury",
    color: "#8c7853",
    radius: 2_439.7, // km
    semiMajorAxis: 0.387, // AU
    // eccentricity: 0.206,
    eccentricity: 0.5,
    period: 87.97, // days
    meanAnomaly: 0, // initial position
  },
  {
    name: "Venus",
    color: "#ffc649",
    radius: 6_051.8,
    semiMajorAxis: 0.723,
    eccentricity: 0.007,
    period: 224.7,
    meanAnomaly: 0,
  },
  {
    name: "Earth",
    color: "#4a90e2",
    radius: 6_371,
    semiMajorAxis: 1.0,
    eccentricity: 0.017,
    period: 365.26,
    meanAnomaly: 0,
  },
  {
    name: "Mars",
    color: "#e27b58",
    radius: 3_389.5,
    semiMajorAxis: 1.524,
    eccentricity: 0.093,
    period: 686.98,
    meanAnomaly: 0,
  },
  {
    name: "Jupiter",
    color: "#c88b3a",
    radius: 71_492,
    semiMajorAxis: 5.203,
    eccentricity: 0.048,
    period: 4332.59,
    meanAnomaly: 0,
  },
  {
    name: "Saturn",
    color: "#fad5a5",
    radius: 58_232,
    semiMajorAxis: 9.537,
    eccentricity: 0.054,
    period: 10759.22,
    meanAnomaly: 0,
  },
  {
    name: "Uranus",
    color: "#4fd0e7",
    radius: 25_362,
    semiMajorAxis: 19.191,
    eccentricity: 0.047,
    period: 30688.5,
    meanAnomaly: 0,
  },
  {
    name: "Neptune",
    color: "#4166f5",
    radius: 24_622,
    semiMajorAxis: 30.069,
    eccentricity: 0.009,
    period: 60182,
    meanAnomaly: 0,
  },
];
