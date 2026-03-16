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

export function formatInterval(interval: number) {
  const days = interval / (24 * 3600);
  if (days >= 1) {
    return `${days.toFixed(2)}d`;
  }
  const hours = interval / 3600;
  if (hours >= 1) {
    return `${hours.toFixed(2)}h`;
  }
  const minutes = Math.floor((interval % 3600) / 60);
  if (minutes >= 1) {
    return `${minutes.toFixed(2)}m`;
  }

  return `${interval.toFixed(2)}s`;
}