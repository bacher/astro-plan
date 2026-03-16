export type Planet = {
  name: string;
  color: string;
  radius: number; // m
  semiMajorAxis: number; // meters
  eccentricity: number;
  mass: number; // kg
  revolutionPeriod: number; // seconds
  rotationPeriod: number; // seconds
  meanAnomaly: number;
};
