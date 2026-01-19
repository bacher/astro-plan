export function rotatePoint(point: { x: number; y: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function addPoints(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
) {
  return {
    x: point1.x + point2.x,
    y: point1.y + point2.y,
  };
}