import { useLayoutEffect, useRef, useEffectEvent, useState } from 'react';
import { usePrefersColorScheme } from 'use-prefers-color-scheme';

import styles from './InteractiveMap.module.css';
import { useOnRender } from '../../hooks/useOnRender';
import { Toolbar } from '../Toolbar/Toolbar';
import { EARTH, G } from '../../consts/planets';
import { addPoints, rotatePoint } from './utils';
import savedTrajectory from './savedTrajectory.json';
import { useMousePosition } from '../../hooks/useMousePosition';
import { useKeydown } from '../../hooks/useKeydown';
import { useZoom } from '../../hooks/useZoom';

type Rocket = {
  position: { x: number; y: number }; // m
  angle: number; // rads
  speed: { x: number; y: number }; // m/s
};

const THRUST_FORCE = 0.5 * 9.8; // m/s^2

const KM_TO_SCREEN_WIDTH_RATIO = 0.00000002; // ratio of 1 KM / screen width

function formatDate(date: Date, timeSpeed: number) {
  if (timeSpeed < 86400) {
    return `${date.toISOString().substring(0, 19)}Z`; // YYYY-MM-DDTHH:MM:SSZ
  }
  return date.toISOString().substring(0, 10); // YYYY-MM-DD
}

export function InteractiveMap_ellipse() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const [startTime] = useState(() => Date.now()); // in milliseconds
  const lastRealTimeRef = useRef(startTime); // in milliseconds
  const time = startTime * 0.001;
  const timeRef = useRef(time); // in seconds
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const zoomScale = useZoom({ canvasRef });
  const scale = KM_TO_SCREEN_WIDTH_RATIO * width * zoomScale;
  const [timeSpeed, setTimeSpeed] = useState(480);
  const historicalRocketPositionsRef = useRef<{
    lastUpdated: number;
    positions: { x: number; y: number }[];
  }>(undefined);

  const canvasPositionRef = useRef({ x: 0, y: 0 });

  const [rocket] = useState(() => {
    return {
      position: { x: -(418_200 + EARTH.radius * 1000), y: 0 },
      angle: 0,
      speed: { x: 0, y: 1.25 * 7_663.584 }, // wiki: ~7.7km/s
    };
  });

  function convertMousePositionToWorldPosition(x: number, y: number) {
    const canvasPosition = canvasPositionRef.current;

    const worldX = x - canvasPosition.x - width / 4;
    const worldY = y - canvasPosition.y - height / 2;

    return {
      x: worldX / scale,
      y: worldY / scale,
    };
  }

  const updateRocketAngle = useEffectEvent(
    (mousePosition: { x: number; y: number }) => {
      const { x, y } = convertMousePositionToWorldPosition(
        mousePosition.x,
        mousePosition.y,
      );
      const dx = x - rocket.position.x;
      const dy = y - rocket.position.y;
      rocket.angle = Math.atan2(dy, dx);
    },
  );

  const mousePosition = useMousePosition(updateRocketAngle);

  const pressedKeys = useKeydown([' ']);

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

  const [dateTime, setDateTime] = useState(() =>
    formatDate(new Date(startTime * 1000), timeSpeed),
  );
  useOnRender(
    () => {
      setDateTime(formatDate(new Date(timeRef.current * 1000), timeSpeed));
    },
    timeSpeed > 86400 ? 1000 : 250,
  );

  useOnRender(() => {
    if (scale === 0) {
      return;
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const now = Date.now();
    const realTimePassed = now - lastRealTimeRef.current;
    lastRealTimeRef.current = now;

    const timePassed = realTimePassed * timeSpeed * 0.001; // * 0.001 to convert to seconds
    timeRef.current += timePassed;
    // const time = timeRef.current;

    if (timePassed > 0) {
      // UPDATE
      const ITERATIONS = 25;
      const timePassedPerStep = timePassed / ITERATIONS;
      for (let i = 0; i < ITERATIONS; i += 1) {
        updateRocketPosition(rocket, timePassedPerStep, pressedKeys.has(' '));
      }
      updateRocketAngle(mousePosition);

      if (!historicalRocketPositionsRef.current) {
        historicalRocketPositionsRef.current = {
          lastUpdated: 0,
          positions: [] as { x: number; y: number }[],
        };
      }
      const cur = historicalRocketPositionsRef.current;

      cur.lastUpdated -= timePassed;
      if (cur.lastUpdated <= 0) {
        cur.positions.push({
          x: rocket.position.x,
          y: rocket.position.y,
        });
        cur.lastUpdated = 200;
      }
    }

    ctx.fillStyle = colorScheme === 'dark' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();

    ctx.save();
    ctx.translate(width / 4, height / 2);

    // DRAW

    ctx.moveTo(0, -height / 2);
    ctx.lineTo(0, height / 2);
    ctx.moveTo(-width / 4, 0);
    ctx.lineTo((3 * width) / 4, 0);
    ctx.strokeStyle = isDarkMode ? '#333' : '#bbb';
    ctx.stroke();
    ctx.beginPath();

    drawTrajectory(ctx, savedTrajectory, scale, isDarkMode, true);
    drawTrajectory(
      ctx,
      historicalRocketPositionsRef.current?.positions,
      scale,
      isDarkMode,
    );

    // draw Earth
    ctx.arc(0, 0, EARTH.radius * 1000 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
    ctx.beginPath();

    // draw rocket
    const rocketX = rocket.position.x * scale;
    const rocketY = rocket.position.y * scale;

    ctx.arc(rocketX, rocketY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
    ctx.beginPath();

    // draw rocket orientation
    ctx.moveTo(rocketX, rocketY);
    const dX = Math.cos(rocket.angle);
    const dY = Math.sin(rocket.angle);
    ctx.lineTo(rocketX + dX * 20, rocketY + dY * 20);
    ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
    ctx.stroke();
    ctx.beginPath();

    ctx.restore();
  });

  return (
    <div className={styles.root}>
      <div ref={wrapperRef} className={styles.wrapper}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={width}
          height={height}
        />
      </div>
      <Toolbar
        dateTime={dateTime}
        timeSpeed={timeSpeed}
        scale={zoomScale}
        onTimeSpeedChange={setTimeSpeed}
      />
      <button
        type="button"
        onClick={() => {
          const cur = historicalRocketPositionsRef.current;
          if (cur) {
            console.log(cur.positions);
          }
        }}
      >
        Log trajectory
      </button>
    </div>
  );
}

const node = document.createElement('div');
document.body.appendChild(node);
node.style.position = 'absolute';
node.style.bottom = '0';
node.style.left = '0';
node.style.width = '500px';

const node2 = document.createElement('div');
document.body.appendChild(node2);
node2.style.position = 'absolute';
node2.style.bottom = '0';
node2.style.right = '0';
node2.style.width = '500px';

function updateRocketPosition(
  rocket: Rocket,
  timePassed: number,
  isSpacePressed: boolean,
) {
  const directionToPlanet = Math.atan2(-rocket.position.y, -rocket.position.x);
  const distance = Math.sqrt(rocket.position.x ** 2 + rocket.position.y ** 2);
  const g = (G * EARTH.mass) / distance ** 2;

  node2.innerHTML = `G: ${G}<br>mass: ${EARTH.mass}<br>
    distance: ${distance.toFixed(0)} m<br>
    g: ${g.toFixed(4)}`;

  const gravitational_speed_change = rotatePoint(
    { x: g * timePassed, y: 0 },
    directionToPlanet,
  );

  const thrust_speed_change = isSpacePressed
    ? rotatePoint({ x: THRUST_FORCE * timePassed, y: 0 }, rocket.angle)
    : { x: 0, y: 0 };

  const speed_change = addPoints(
    gravitational_speed_change,
    thrust_speed_change,
  );

  rocket.position.x += (rocket.speed.x + speed_change.x / 2) * timePassed;
  rocket.position.y += (rocket.speed.y + speed_change.y / 2) * timePassed;

  const updatedSpeed = addPoints(rocket.speed, speed_change);

  // rocket.angle += calculateAngleChange(rocket.speed, updatedSpeed);

  rocket.speed = updatedSpeed;

  node.innerHTML = `x: ${rocket.position.x.toFixed(0)}<br>y: ${rocket.position.y.toFixed(0)}<br>
    speed (x): ${rocket.speed.x.toFixed(2)}<br>speed (y): ${rocket.speed.y.toFixed(2)}`;
}

function calculateAngleChange(
  speed: { x: number; y: number },
  updatedSpeed: { x: number; y: number },
) {
  const angle = Math.atan2(speed.y, speed.x);
  const updatedAngle = Math.atan2(updatedSpeed.y, updatedSpeed.x);
  return updatedAngle - angle;
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  trajectory: { x: number; y: number }[] | undefined,
  scale: number,
  isDarkMode: boolean,
  isInitialTrajectory = false,
) {
  if (!trajectory) {
    return;
  }

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
    const max = Math.min(40, trajectory.length);
    for (let i = 1; i <= max; i += 1) {
      const position = trajectory[trajectory.length - i];
      ctx.arc(position.x * scale, position.y * scale, 4, 0, 2 * Math.PI);
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.beginPath();
}
