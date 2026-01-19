export type Planet = {
  name: string;
  color: string;
  radius: number; // km
  semiMajorAxis: number; // AU
  eccentricity: number;
  mass: number; // kg
  revolutionPeriod: number; // days
  rotationPeriod: number; // days
  meanAnomaly: number;
};
