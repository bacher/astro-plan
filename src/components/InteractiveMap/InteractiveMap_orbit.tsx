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
import { Toolbar } from '../Toolbar/Toolbar';
import { EARTH, G } from '../../consts/planets';
import { addPoints, rotatePoint } from './utils';
import savedTrajectory from './savedTrajectory.json';
import { useMousePosition } from '../../hooks/useMousePosition';
import { useKeydown } from '../../hooks/useKeydown';

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

export function InteractiveMap_orbit() {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mousePositionRef = useMousePosition((mousePosition) => {
    const { x, y } = convertMousePositionToWorldPosition(
      mousePosition.x,
      mousePosition.y,
    );
    const dx = x - rocket.position.x;
    const dy = y - rocket.position.y;
    rocket.angle = Math.atan2(dy, dx);
  });

  useKeydown([' ']);

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

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoomScale((zoomScale) =>
        clamp(zoomScale * (1 - event.deltaY * 0.001), 0.1, 10),
      );
    };

    const canvas = canvasRef.current!;
    canvas.addEventListener('wheel', handleWheel);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useOnRender(() => {
    if (scale === 0) {
      return;
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
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
