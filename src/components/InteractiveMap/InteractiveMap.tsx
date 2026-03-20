import {
  useLayoutEffect,
  useRef,
  useEffectEvent,
  useState,
  useEffect,
} from 'react';
import { usePrefersColorScheme } from 'use-prefers-color-scheme';
import { clamp } from 'lodash-es';

import styles from './InteractiveMap.module.css';
import { useOnRender } from '../../hooks/useOnRender';
import { G, PLANETS, SUN } from '../../consts/planets';
import { calculatePlanetPosition } from '../../utils/orbitMath';
import { Toolbar } from '../Toolbar/Toolbar';
import type { Planet } from '../../types/types';
import { addPoints, rotatePoint } from './utils';
import { AU_IN_M } from '../../utils/converters';
import { DebugNodes, getDebugNode } from '../DebugNodes/DebugNodes';

const AU_TO_SCREEN_WIDTH_RATIO = 0.2; // 1 AU = % screen width

const SUN_VISUAL_ZOOM = 30;
const PLANET_VISUAL_ZOOM = 1000;

type ScaleInfo = {
  zoomScale: number;
  m: number;
};

function formatDate(date: Date, timeSpeed: number) {
  if (timeSpeed < 86400) {
    return `${date.toISOString().substring(0, 19)}Z`; // YYYY-MM-DDTHH:MM:SSZ
  }
  return date.toISOString().substring(0, 10); // YYYY-MM-DD
}

type Rocket = {
  position: { x: number; y: number }; // m
  velocity: { x: number; y: number }; // m/s
  angle: number; // rads
};

// const INITIAL_TIME_SPEED = 432000;
const INITIAL_TIME_SPEED = 3600;

export function InteractiveMap() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const [startTime] = useState(() => Date.now()); // in milliseconds
  const lastRealTimeRef = useRef(startTime); // in milliseconds
  const time = startTime * 0.001;
  const timeRef = useRef(time); // in seconds
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [zoomScale, setZoomScale] = useState(1);
  const mScale = (AU_TO_SCREEN_WIDTH_RATIO / AU_IN_M) * width * zoomScale;
  const [timeSpeed, setTimeSpeed] = useState(INITIAL_TIME_SPEED);
  const [rocket] = useState((): Rocket => {
    const earth = PLANETS[2];
    const earthPosition = calculatePlanetPosition(earth, time);
    const orbit = 408_000;

    const orbitingEarthSpeed =
      (2 * Math.PI * (earth.radius + orbit)) / earth.rotationPeriod;

    const orbitingSunSpeed =
      (2 * Math.PI * earth.semiMajorAxis) / earth.revolutionPeriod;

    const position = addPoints(
      earthPosition,
      rotatePoint(
        {
          x: 0,
          y: earth.radius + orbit,
        },
        earthPosition.trueAnomaly,
      ),
    );

    // console.log('earth position', earthPosition);
    // console.log('initial position', position);
    // console.log('distance', {
    //   x: position.x - earthPosition.x,
    //   y: position.y - earthPosition.y,
    // });

    const orbitingEarthSpeedVector = rotatePoint(
      {
        x: 0,
        // y: orbitingEarthSpeed,
        y: 7_680,
      },
      earthPosition.trueAnomaly + Math.PI / 2,
    );

    const orbitingSunSpeedVector = rotatePoint(
      {
        x: 0,
        y: orbitingSunSpeed,
      },
      earthPosition.trueAnomaly,
    );

    return {
      position,
      velocity: addPoints(orbitingEarthSpeedVector, orbitingSunSpeedVector),
      angle: earthPosition.trueAnomaly,
    };
  });

  const scaleInfo: ScaleInfo = {
    zoomScale,
    m: mScale,
  };

  const resize = useEffectEvent(() => {
    const wrapper = wrapperRef.current!;
    setCanvasSize([wrapper.clientWidth, wrapper.clientHeight]);
  });

  useLayoutEffect(() => {
    resize();

    window.addEventListener('resize', resize, { passive: true });
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoomScale((zoomScale) =>
        clamp(zoomScale * (1 + event.deltaY * 0.001), 0.1, 10),
      );
    };

    const canvas = canvasRef.current!;
    canvas.addEventListener('wheel', handleWheel);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const now = Date.now();
    const realTimePassed = now - lastRealTimeRef.current;
    lastRealTimeRef.current = now;

    const timePassed = realTimePassed * timeSpeed * 0.001; // * 0.001 to convert to seconds
    timeRef.current += timePassed;
    const time = timeRef.current;

    updateRocketPosition(rocket, time, timePassed);

    ctx.fillStyle = colorScheme === 'dark' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);

    ctx.fillStyle = SUN.color;
    ctx.arc(0, 0, SUN.radius * mScale * SUN_VISUAL_ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();

    for (const planet of PLANETS) {
      drawOrbit(ctx, planet, scaleInfo);
    }

    for (const planet of PLANETS) {
      drawPlanet(ctx, planet, scaleInfo, time);
    }

    drawRocket(ctx, rocket, scaleInfo, isDarkMode);

    ctx.restore();

    ctx.save();
    ctx.translate(10, 10);
    drawArrow(ctx, isDarkMode);
    ctx.rotate(Math.PI / 2);
    drawArrow(ctx, isDarkMode);
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
        <Toolbar
          dateTime={dateTime}
          timeSpeed={timeSpeed}
          scale={zoomScale}
          onTimeSpeedChange={setTimeSpeed}
        />
      </div>
      <DebugNodes />
    </>
  );
}

function drawArrow(ctx: CanvasRenderingContext2D, isDarkMode: boolean) {
  ctx.moveTo(0, 0);
  ctx.lineTo(50, 0);
  ctx.lineTo(45, 5);
  ctx.moveTo(50, 0);
  ctx.lineTo(45, -5);
  ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
  ctx.stroke();
  ctx.beginPath();
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  scaleInfo: ScaleInfo,
) {
  const a = planet.semiMajorAxis * scaleInfo.m;
  const b = a * Math.sqrt(1 - planet.eccentricity ** 2);
  const c = a * planet.eccentricity; // distance from center to focus

  ctx.ellipse(-c, 0, a, b, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = `${planet.color}33`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  scaleInfo: ScaleInfo,
  time: number,
) {
  const { x, y } = calculatePlanetPosition(planet, time);

  ctx.arc(
    x * scaleInfo.m,
    y * scaleInfo.m,
    planet.radius * scaleInfo.m * PLANET_VISUAL_ZOOM,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = planet.color;
  ctx.fill();
  ctx.beginPath();
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  rocket: Rocket,
  scaleInfo: ScaleInfo,
  isDarkMode: boolean,
) {
  ctx.arc(
    rocket.position.x * scaleInfo.m,
    rocket.position.y * scaleInfo.m,
    5,
    0,
    2 * Math.PI,
  );
  ctx.fillStyle = isDarkMode ? '#fff' : '#000';
  ctx.fill();
  ctx.beginPath();

  ctx.moveTo(rocket.position.x * scaleInfo.m, rocket.position.y * scaleInfo.m);
  ctx.lineTo(
    rocket.position.x * scaleInfo.m + Math.cos(rocket.angle) * 20,
    rocket.position.y * scaleInfo.m + Math.sin(rocket.angle) * 20,
  );
  ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
  ctx.stroke();
  ctx.beginPath();
}

function updateRocketPosition(
  rocket: Rocket,
  time: number,
  timePassed: number, // in seconds
) {
  let velocityChange = { x: 0, y: 0 };

  for (const object of [SUN, ...PLANETS]) {
    const { x, y } =
      object.type === 'star'
        ? { x: 0, y: 0 }
        : calculatePlanetPosition(object, time);

    const directionToObject = Math.atan2(
      y - rocket.position.y,
      x - rocket.position.x,
    );

    const distance = Math.sqrt(
      (rocket.position.x - x) ** 2 + (rocket.position.y - y) ** 2,
    );

    const g = (G * object.mass) / distance ** 2;
    velocityChange = addPoints(
      velocityChange,
      rotatePoint({ x: g * timePassed, y: 0 }, directionToObject),
    );

    if (object.name === 'Earth') {
      const distanceToEarthCenter =
        (Math.sqrt(
          (rocket.position.x - x) ** 2 + (rocket.position.y - y) ** 2,
        ) -
          object.radius) /
        1000;

      getDebugNode('bottom-right').innerHTML =
        `<div>to Earth: ${distanceToEarthCenter.toFixed(0)} km</div>`;
    }
  }

  rocket.position.x += (rocket.velocity.x + velocityChange.x / 2) * timePassed;
  rocket.position.y += (rocket.velocity.y + velocityChange.y / 2) * timePassed;

  rocket.velocity = addPoints(rocket.velocity, velocityChange);
}
