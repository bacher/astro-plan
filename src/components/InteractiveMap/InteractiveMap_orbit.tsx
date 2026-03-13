import { useLayoutEffect, useRef, useEffectEvent, useState } from 'react';
import { usePrefersColorScheme } from 'use-prefers-color-scheme';

import styles from './InteractiveMap.module.css';
import { useOnRender } from '../../hooks/useOnRender';
import { EARTH, G } from '../../consts/planets';
import { addPoints, rotatePoint } from './utils';
import { useMousePosition } from '../../hooks/useMousePosition';
import { useZoom } from '../../hooks/useZoom';
import { useKeydown } from '../../hooks/useKeydown';
import { DebugNodes, getDebugNode } from '../DebugNodes/DebugNodes';

type Rocket = {
  position: { x: number; y: number }; // m
  angle: number; // rads
  speed: { x: number; y: number }; // m/s
};

type TrajectoryPoint = {
  x: number;
  y: number;
  color: string;
};

const KM_TO_SCREEN_WIDTH_RATIO = 0.00000001; // ratio of 1 KM / screen width

export function InteractiveMap_orbit() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const zoomScale = useZoom({ canvasRef, minZoom: 0.001, maxZoom: 10 });
  const scale = KM_TO_SCREEN_WIDTH_RATIO * width * zoomScale;

  const stopRef = useRef(false);
  useKeydown([' '], () => {
    stopRef.current = !stopRef.current;
  });

  const canvasPositionRef = useRef({ x: 0, y: 0 });

  const trajectoryRef = useRef<TrajectoryPoint[]>(undefined);

  const [rocket] = useState<Rocket>(() => {
    return {
      position: { x: 20_000_000, y: 9_000_000 },
      angle: 0,
      speed: { x: 0, y: 0 },
    };
  });

  function convertMousePositionToWorldPosition(x: number, y: number) {
    const canvasPosition = canvasPositionRef.current;

    const worldX = x - canvasPosition.x - width / 2;
    const worldY = y - canvasPosition.y - height / 2;

    return {
      x: worldX / scale,
      y: worldY / scale,
    };
  }

  useMousePosition((mousePosition) => {
    const { x, y } = convertMousePositionToWorldPosition(
      mousePosition.x,
      mousePosition.y,
    );

    if (stopRef.current) {
      return;
    }

    const dx = x - rocket.position.x;
    const dy = y - rocket.position.y;
    rocket.angle = Math.atan2(dy, dx);
    rocket.speed = {
      x: dx / 4000,
      y: dy / 4000,
    };

    trajectoryRef.current = calculateTrajectory(rocket);

    const distanceToAttractorPoint2 = x ** 2 + y ** 2;
    const distanceToAttractorPoint = Math.sqrt(distanceToAttractorPoint2);

    const g = (G * EARTH.mass) / distanceToAttractorPoint2;
    getDebugNode('top-left').innerHTML = `<h3>Mouse</h3>
    x: ${x.toFixed(0)} m<br>y: ${y.toFixed(0)} m<br>
    gravity: ${g.toFixed(4)} m/s<sup>2</sup><br>
    Earth center:  ${distanceToAttractorPoint.toFixed(0)} m<br>
    Earth surface: ${(distanceToAttractorPoint - EARTH.radius * 1000).toFixed(0)} m`;

    const rocketSpeed = Math.sqrt(rocket.speed.x ** 2 + rocket.speed.y ** 2);

    getDebugNode('bottom-left').innerHTML = `<h3>Rocket position:</h3>
    x: ${rocket.position.x.toFixed(0)} m<br>y: ${rocket.position.y.toFixed(0)} m<br>
    speed: ${rocketSpeed.toFixed(2)} m/s`;
  });

  const resize = useEffectEvent(() => {
    const wrapper = wrapperRef.current!;
    setCanvasSize([wrapper.clientWidth, wrapper.clientHeight]);
    const { left, top } = canvasRef.current!.getBoundingClientRect();
    canvasPositionRef.current = { x: left, y: top };
  });

  useLayoutEffect(() => {
    resize();

    window.addEventListener('resize', resize, { passive: true });
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  useOnRender(() => {
    if (scale === 0) {
      return;
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = colorScheme === 'dark' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();

    ctx.save();
    ctx.translate(width / 2, height / 2);

    // draw Earth
    ctx.arc(0, 0, EARTH.radius * 1000 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
    ctx.beginPath();

    // draw trajectory
    if (trajectoryRef.current) {
      drawTrajectory(ctx, trajectoryRef.current, scale, isDarkMode);
    }

    // draw rocket
    const rocketX = rocket.position.x * scale;
    const rocketY = rocket.position.y * scale;

    ctx.arc(rocketX, rocketY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
    ctx.beginPath();

    // draw rocket orientation
    // ctx.moveTo(rocketX, rocketY);
    // const dX = Math.cos(rocket.angle);
    // const dY = Math.sin(rocket.angle);
    // ctx.lineTo(rocketX + dX * 20, rocketY + dY * 20);
    // ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
    // ctx.stroke();
    // ctx.beginPath();

    (window as any).customRender?.(ctx);
    ctx.beginPath();

    ctx.restore();
  });

  return (
    <>
      <div className={styles.root}>
        <div ref={wrapperRef} className={styles.wrapper}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={width}
            height={height}
          />
        </div>
      </div>
      <DebugNodes />
    </>
  );
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  trajectory: TrajectoryPoint[],
  scale: number,
  isDarkMode: boolean,
  isInitialTrajectory = false,
) {
  const color = isInitialTrajectory
    ? isDarkMode
      ? '#997234'
      : '#997234'
    : isDarkMode
      ? '#444'
      : '#aaa';

  let first = true;
  for (const position of trajectory) {
    if (first) {
      ctx.moveTo(position.x * scale, position.y * scale);
      first = false;
    } else {
      ctx.lineTo(position.x * scale, position.y * scale);
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();

  if (!isInitialTrajectory) {
    for (let i = 1; i < trajectory.length; i += 1) {
      const point = trajectory[i];
      ctx.arc(point.x * scale, point.y * scale, 4, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fillStyle = point.color;
      ctx.fill();
      ctx.beginPath();
    }
  }
}

type UpdateRocketPositionResult =
  | {
      type: 'stop';
    }
  | {
      type: 'continue';
      rocket: Rocket;
    };

function updateRocketPosition(rocket: Rocket): UpdateRocketPositionResult {
  const directionToPlanet = Math.atan2(-rocket.position.y, -rocket.position.x);
  const distance = Math.sqrt(rocket.position.x ** 2 + rocket.position.y ** 2);
  const g = (G * EARTH.mass) / distance ** 2;

  // with higher gravity force, the simulation should run slower
  const timePassed = Math.max(0.05, 2 / g);

  if (!Number.isFinite(timePassed)) {
    return {
      type: 'stop',
    };
  }

  const speed_change = rotatePoint(
    { x: g * timePassed, y: 0 },
    directionToPlanet,
  );
  const x =
    rocket.position.x + (rocket.speed.x + speed_change.x / 2) * timePassed;

  if (Number.isNaN(x)) {
    debugger;
  }

  return {
    type: 'continue',
    rocket: {
      position: {
        x,
        y:
          rocket.position.y +
          (rocket.speed.y + speed_change.y / 2) * timePassed,
      },
      speed: addPoints(rocket.speed, speed_change),
      angle: rocket.angle,
    },
  };
}

function calculateTrajectory(rocket: Rocket): TrajectoryPoint[] {
  const trajectory: TrajectoryPoint[] = [
    // start position
    { x: rocket.position.x, y: rocket.position.y, color: '#333333' },
  ];

  let phase: 'out' | 'in' = 'out';
  let currentRocket = rocket;
  let lastDistance2 = 0;

  const iterations = 50_000;
  let phaseLimit = 25_000;
  let phaseChangedCount = 0;
  let i;

  for (i = 0; i < iterations && phaseLimit > 0; i += 1, phaseLimit -= 1) {
    const updatedRocketResults = updateRocketPosition(currentRocket);
    if (updatedRocketResults.type === 'stop') {
      break;
    }

    const { rocket: updatedRocket } = updatedRocketResults;

    const distance2 =
      (rocket.position.x - updatedRocket.position.x) ** 2 +
      (rocket.position.y - updatedRocket.position.y) ** 2;

    const distanceIncreased = distance2 > lastDistance2;

    if (distanceIncreased && phase === 'in') {
      phase = 'out';
      phaseChangedCount += 1;
      // resetting the phase limit when the phase changes

      phaseLimit = 25_000;
    } else if (!distanceIncreased && phase === 'out') {
      phase = 'in';
      phaseChangedCount += 1;
      // resetting the phase limit when the phase changes
      phaseLimit = 25_000;
    }

    if (phaseChangedCount > 1 && distance2 < 1_000_000_000_000) {
      break;
    }

    trajectory.push({
      x: currentRocket.position.x,
      y: currentRocket.position.y,
      color: distanceIncreased ? '#dd3333' : '#339933',
    });

    lastDistance2 = distance2;
    currentRocket = updatedRocket;
  }

  getDebugNode('bottom-right').innerHTML =
    `<h3>Debug info</h3>Iterations: ${i}`;

  return trajectory;
}
