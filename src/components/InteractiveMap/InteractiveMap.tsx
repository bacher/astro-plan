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

const AU_TO_SCREEN_WIDTH_RATIO = 0.1; // 1 AU = 10% screen width

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
};

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
  const [timeSpeed, setTimeSpeed] = useState(432000);
  const [rocket] = useState<Rocket>(() => {
    const earth = PLANETS[2];
    const earthPosition = calculatePlanetPosition(earth, time);

    const rotationSpeed = (2 * Math.PI * earth.radius) / earth.rotationPeriod;

    const orbitalSpeed =
      (2 * Math.PI * earth.semiMajorAxis) / earth.revolutionPeriod;

    const rocketPosition = {
      position: addPoints(
        {
          x: earthPosition.x,
          y: earthPosition.y,
        },
        rotatePoint(
          {
            x: 0,
            y: earth.radius,
          },
          earthPosition.trueAnomaly,
        ),
      ),
      velocity: rotatePoint(
        {
          x: 100,
          y: orbitalSpeed + rotationSpeed,
        },
        earthPosition.trueAnomaly,
      ),
    };

    return rocketPosition;
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
    </div>
  );
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
}

function updateRocketPosition(
  rocket: Rocket,
  time: number,
  timePassed: number, // in seconds
) {
  rocket.position.x += rocket.velocity.x * timePassed;
  rocket.position.y += rocket.velocity.y * timePassed;

  for (const planet of PLANETS) {
    const { x, y } = calculatePlanetPosition(planet, time);
    const directionToPlanet = Math.atan2(
      y - rocket.position.y,
      x - rocket.position.x,
    );

    const distance = Math.sqrt(
      (rocket.position.x - x) ** 2 + (rocket.position.y - y) ** 2,
    );

    const g = (G * planet.mass) / distance ** 2;
    rocket.velocity = addPoints(
      rocket.velocity,
      rotatePoint({ x: g * timePassed, y: 0 }, directionToPlanet),
    );

    if (planet.name === 'Earth') {
      // console.log("Velocity:", rocket.velocity.x, rocket.velocity.y);
    }
  }
}
