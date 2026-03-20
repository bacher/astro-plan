export type CelestialObject = {
  type: 'star';
  name: string;
  color: string;
  radius: number; // meters
  mass: number; // kg
};

export type Planet = Omit<CelestialObject, 'type'> & {
  type: 'planet';
  semiMajorAxis: number; // meters
  eccentricity: number;
  revolutionPeriod: number; // seconds
  rotationPeriod: number; // seconds
  meanAnomaly: number;
};
