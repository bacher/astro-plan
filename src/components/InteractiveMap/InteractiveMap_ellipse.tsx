import {
  useLayoutEffect,
  useRef,
  useEffectEvent,
  useState,
  useEffect,
} from "react";
import { usePrefersColorScheme } from "use-prefers-color-scheme";
import { clamp } from "lodash-es";

import styles from "./InteractiveMap.module.css";
import { useOnRender } from "../../hooks/useOnRender";
import { Toolbar } from "../Toolbar/Toolbar";
import { EARTH, G } from "../../consts/planets";
import { addPoints, rotatePoint } from "./utils";

type Rocket = {
  position: { x: number; y: number }; // m
  angle: number; // turns
  speed: { x: number; y: number }; // m/s
}

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
  const isDarkMode = colorScheme === "dark";
  const [zoomScale, setZoomScale] = useState(1);
  const scale = KM_TO_SCREEN_WIDTH_RATIO * width * zoomScale;
  const [timeSpeed, setTimeSpeed] = useState(2*432000/5/24/60);
  const historicalRocketPositionsRef = useRef<{ lastUpdated: number, positions: { x: number; y: number }[] }>(undefined);

  const [rocket] = useState(() => {
    return {
      position: { x: -(418_200 + EARTH.radius * 1000), y: 0 },
      angle: 0,
      speed: {x: 0, y: 7_663.584}, // wiki: ~7.7km/s
    }
  });

  const resize = useEffectEvent(() => {
    const wrapper = wrapperRef.current!;
    setCanvasSize([wrapper.clientWidth, wrapper.clientHeight]);
  });

  useLayoutEffect(() => {
    resize();

    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoomScale((zoomScale) => clamp(zoomScale * (1 + event.deltaY * 0.001), 0.1, 10));
    };

    const canvas = canvasRef.current!;
    canvas.addEventListener("wheel", handleWheel);
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const [dateTime, setDateTime] = useState(() =>
    formatDate(new Date(startTime * 1000), timeSpeed)
  );
  useOnRender(
    () => {
      setDateTime(formatDate(new Date(timeRef.current * 1000), timeSpeed));
    },
    timeSpeed > 86400 ? 1000 : 250
  );

  useOnRender(() => {
    if (scale === 0) {
      return;
    };
    
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const now = Date.now();
    const realTimePassed = now - lastRealTimeRef.current;
    lastRealTimeRef.current = now;

    const timePassed = realTimePassed * timeSpeed * 0.001; // * 0.001 to convert to seconds
    timeRef.current += timePassed;
    const time = timeRef.current;

    if (timePassed > 0) {
      // UPDATE
      const ITERATIONS = 500;
      const timePassedPerStep = timePassed / ITERATIONS;
      for (let i = 0; i < ITERATIONS; i += 1) {
        updateRocketPosition(rocket, timePassedPerStep);
      }

      if (!historicalRocketPositionsRef.current) {
        historicalRocketPositionsRef.current = {
          lastUpdated: 0,
          positions: [] as { x: number; y: number }[]
        };
      }
      const cur = historicalRocketPositionsRef.current;

      cur.lastUpdated -= realTimePassed;
      if (cur.lastUpdated <= 0) {
        cur.positions.push({
          x: rocket.position.x,
          y: rocket.position.y,
        });
        cur.lastUpdated = 2000;
      }
    }

    ctx.fillStyle = colorScheme === "dark" ? "#000" : "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();

    ctx.save();
    ctx.translate(width / 4, height / 2);

    // DRAW

    ctx.moveTo(0, -height/2);
    ctx.lineTo(0, height/2);
    ctx.moveTo(-width/4, 0);
    ctx.lineTo(3*width/4, 0);
    ctx.strokeStyle = isDarkMode ? '#333' : '#bbb';
    ctx.stroke();
    ctx.beginPath();

    const cur = historicalRocketPositionsRef.current;
    if (cur) {
      let first = true;
      for (const position of cur.positions) {
        if (first) {
          ctx.moveTo(position.x * scale, position.y * scale);
          first = false;
        } else {
          ctx.lineTo(position.x * scale, position.y * scale);
        }
      }

      ctx.strokeStyle = isDarkMode ? '#444' : '#aaa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (const position of cur.positions) {
        ctx.arc(position.x * scale, position.y * scale, 4, 0, 2 * Math.PI);
        ctx.closePath();
      }
      ctx.fillStyle = isDarkMode ? '#444' : '#aaa';
      ctx.fill();
      ctx.beginPath();
    }

    // draw Earth
    ctx.arc(0, 0, EARTH.radius * 1000 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
    ctx.beginPath();

    ctx.arc(rocket.position.x * scale, rocket.position.y * scale, 4, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkMode ? '#fff' : '#000';
    ctx.fill();
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

function updateRocketPosition(rocket: Rocket, timePassed: number) {
  const directionToPlanet = Math.atan2(
    -rocket.position.y,
    -rocket.position.x
  );
  const distance = Math.sqrt(rocket.position.x ** 2 + rocket.position.y ** 2);
  const g = (G * EARTH.mass) / (distance ** 2);

  node2.innerHTML = `G: ${G}<br>mass: ${EARTH.mass}<br>
    distance: ${distance.toFixed(0)} m<br>
    g: ${g.toFixed(4)}`;

  const acceleration = rotatePoint({ x: g * timePassed, y: 0 }, directionToPlanet);
  
  rocket.position.x += (rocket.speed.x + acceleration.x / 2) * timePassed;
  rocket.position.y += (rocket.speed.y + acceleration.y / 2) * timePassed;

  rocket.speed = addPoints(
    rocket.speed,
    acceleration,
  );

  node.innerHTML = `x: ${rocket.position.x.toFixed(0)}<br>y: ${rocket.position.y.toFixed(0)}<br>
    speed (x): ${rocket.speed.x.toFixed(2)}<br>speed (y): ${rocket.speed.y.toFixed(2)}`;
}