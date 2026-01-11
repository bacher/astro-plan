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
import { AU_IN_KM, PLANETS, SUN } from "../../consts/planets";
import { calculatePlanetPosition } from "../../utils/orbitMath";
import { Toolbar } from "../Toolbar/Toolbar";

const AU_TO_SCREEN_WIDTH_RATIO = 0.1; // 1 AU = 10% screen width

const SUN_VISUAL_ZOOM = 50;
const PLANET_VISUAL_ZOOM = 1000;

function formatDate(date: Date, timeSpeed: number) {
  if (timeSpeed < 86400) {
    return `${date.toISOString().substring(0, 19)}Z`; // YYYY-MM-DDTHH:MM:SSZ
  }
  return date.toISOString().substring(0, 10); // YYYY-MM-DD
}

export function InteractiveMap() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const [startTime] = useState(() => Date.now()); // in milliseconds
  const lastRealTimeRef = useRef(startTime); // in milliseconds
  const timeRef = useRef(startTime * 0.001); // in seconds
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();
  const [scale, setScale] = useState(1);
  const auScale = AU_TO_SCREEN_WIDTH_RATIO * width * scale;
  const kmScale = auScale / AU_IN_KM;
  const [timeSpeed, setTimeSpeed] = useState(432000);

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
      setScale((scale) => clamp(scale * (1 + event.deltaY * 0.001), 0.1, 10));
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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const now = Date.now();
    const realTimePassed = now - lastRealTimeRef.current;
    lastRealTimeRef.current = now;

    const timePassed = realTimePassed * timeSpeed * 0.001; // * 0.001 to convert to seconds
    timeRef.current += timePassed;
    const time = timeRef.current;

    ctx.fillStyle = colorScheme === "dark" ? "#000" : "#fff";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);

    ctx.fillStyle = SUN.color;
    ctx.arc(0, 0, SUN.radius * kmScale * SUN_VISUAL_ZOOM, 0, Math.PI * 2);
    ctx.fill();

    for (const planet of PLANETS) {
      ctx.beginPath();

      const { x, y } = calculatePlanetPosition(planet, time);

      ctx.arc(
        x * auScale,
        y * auScale,
        planet.radius * kmScale * PLANET_VISUAL_ZOOM,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = planet.color;
      ctx.fill();
    }

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
        scale={scale}
        onTimeSpeedChange={setTimeSpeed}
      />
    </div>
  );
}
