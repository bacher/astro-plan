import { useLayoutEffect, useRef, useEffectEvent, useState } from 'react';
import { usePrefersColorScheme } from 'use-prefers-color-scheme';

import styles from './InteractiveMap.module.css';
import stylesFlow from './InteractiveMap_flow.module.css';
import { useOnRender } from '../../hooks/useOnRender';
import { EARTH, G } from '../../consts/planets';
import { addPoints, rotatePoint } from './utils';
import { useMousePosition } from '../../hooks/useMousePosition';
import { useZoom } from '../../hooks/useZoom';
import { useKeydown } from '../../hooks/useKeydown';
import { DebugNodes, getDebugNode } from '../DebugNodes/DebugNodes';
import { usePersistedState } from '../../utils/usePersistedState';

type Point = {
  x: number;
  y: number;
};

type Rocket = {
  position: Point; // m
  angle: number; // rads
  speed: Point; // m/s
};

type TrajectoryPoint = {
  x: number;
  y: number;
  speed: Point;
};

const KM_TO_SCREEN_WIDTH_RATIO = 0.00000001; // ratio of 1 KM / screen width

const THRUST_TO_MOUSE_SCALER = 1 / 10_000;

type OrbitTemplate = 'custom' | 'iss';

type Phase =
  | {
      type: 'orbit-planning';
      subType:
        | 'waiting-for-cursor'
        | 'space-ship-positioning'
        | 'orbit-selection';
    }
  | {
      type: 'orbitting';
      orbit: TrajectoryPoint[];
      previousOrbits: {
        orbit: TrajectoryPoint[];
        maneuver: {
          postion: Point;
          deltaSpeed: Point;
        };
      }[];
      subType:
        | {
            type: 'orbitting';
          }
        | {
            type: 'maneuver-planning';
            deltaSpeed: Point;
            newOrbit: TrajectoryPoint[];
          };
    };

export function InteractiveMap_flow() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const zoomScale = useZoom({ canvasRef, minZoom: 0.001, maxZoom: 10 });
  const scale = KM_TO_SCREEN_WIDTH_RATIO * width * zoomScale;

  const [orbitTemplate, setOrbitTemplate] = usePersistedState<OrbitTemplate>(
    'astro-pan:flow:orbitTemplate',
    'custom',
  );

  const lastMousePositionRef = useRef<Point | undefined>(undefined);
  const lastMouseWorldPositionRef = useRef<Point | undefined>(undefined);

  const [rocket] = useState<Rocket>(() => {
    return {
      position: { x: 0, y: 0 },
      angle: 0,
      speed: { x: 0, y: 0 },
    };
  });

  const [phase, setPhase] = useState<Phase>(() =>
    orbitTemplate === 'custom'
      ? {
          type: 'orbit-planning',
          subType: 'waiting-for-cursor',
        }
      : {
          type: 'orbitting',
          // TODO
          orbit: [],
          previousOrbits: [],
          subType: calcManeuverPlanning(
            rocket,
            lastMouseWorldPositionRef.current,
          ),
        },
  );

  const canvasPositionRef = useRef({ x: 0, y: 0 });

  const trajectoryRef = useRef<TrajectoryPoint[]>(undefined);

  useKeydown(['Alt'], ({ isPressed }) => {
    if (phase.type === 'orbitting') {
      if (isPressed) {
        setPhase({
          ...phase,
          subType: {
            type: 'orbitting',
          },
        });
      } else {
        setPhase({
          ...phase,
          subType: calcManeuverPlanning(
            rocket,
            lastMouseWorldPositionRef.current,
          ),
        });
      }
      const pos = lastMousePositionRef.current;
      if (pos) {
        setTimeout(() => {
          onMouseMove(pos);
        }, 0);
      }
    }
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

  const onMouseMove = useEffectEvent((mousePosition: Point) => {
    const mouseWorldPosition = convertMousePositionToWorldPosition(
      mousePosition.x,
      mousePosition.y,
    );

    lastMousePositionRef.current = mousePosition;
    lastMouseWorldPositionRef.current = mouseWorldPosition;
    const { x, y } = mouseWorldPosition;

    switch (phase.type) {
      case 'orbit-planning':
        switch (phase.subType) {
          case 'waiting-for-cursor':
            rocket.position = { x, y };
            setPhase({
              type: 'orbit-planning',
              subType: 'space-ship-positioning',
            });
            break;
          case 'space-ship-positioning':
            rocket.position = { x, y };
            break;
          case 'orbit-selection': {
            const dx = x - rocket.position.x;
            const dy = y - rocket.position.y;
            rocket.angle = Math.atan2(dy, dx);
            rocket.speed = {
              x: dx / 4000,
              y: dy / 4000,
            };

            trajectoryRef.current = calculateTrajectory(rocket);

            const rocketSpeed = Math.sqrt(
              rocket.speed.x ** 2 + rocket.speed.y ** 2,
            );

            getDebugNode('bottom-left').innerHTML = `<h3>Rocket:</h3>
              x: ${rocket.position.x.toFixed(0)} m<br>y: ${rocket.position.y.toFixed(0)} m<br>
              speed: ${rocketSpeed.toFixed(2)} m/s`;
            break;
          }
        }
        break;
      case 'orbitting': {
        switch (phase.subType.type) {
          case 'orbitting': {
            const position = findNearestOrbitPoint(phase.orbit, { x, y });

            rocket.position = { x: position.x, y: position.y };
            rocket.speed = position.speed;
            break;
          }
          case 'maneuver-planning': {
            phase.subType = calcManeuverPlanning(rocket, { x, y });
            break;
          }
        }
        break;
      }
    }

    printMouseInfo(phase, mouseWorldPosition);
  });

  useMousePosition(onMouseMove);

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    onMouseMove({ x: event.clientX, y: event.clientY });

    switch (phase.type) {
      case 'orbit-planning':
        switch (phase.subType) {
          case 'space-ship-positioning':
            event.preventDefault();
            setPhase({ type: 'orbit-planning', subType: 'orbit-selection' });
            break;
          case 'orbit-selection':
            if (trajectoryRef.current) {
              event.preventDefault();
              setPhase({
                type: 'orbitting',
                orbit: trajectoryRef.current,
                previousOrbits: [],
                subType: calcManeuverPlanning(
                  rocket,
                  lastMouseWorldPositionRef.current,
                ),
              });
            }
            break;
        }
        break;
      case 'orbitting':
        switch (phase.subType.type) {
          case 'maneuver-planning':
            rocket.speed = addPoints(rocket.speed, phase.subType.deltaSpeed);

            setPhase({
              type: 'orbitting',
              orbit: phase.subType.newOrbit,
              previousOrbits: [
                ...phase.previousOrbits,
                {
                  orbit: phase.orbit,
                  maneuver: {
                    postion: rocket.position,
                    deltaSpeed: phase.subType.deltaSpeed,
                  },
                },
              ],
              subType: calcManeuverPlanning(
                rocket,
                lastMouseWorldPositionRef.current,
              ),
            });
            break;
        }
        break;
    }
  }

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
    switch (phase.type) {
      case 'orbit-planning':
        if (trajectoryRef.current) {
          drawTrajectory(
            ctx,
            trajectoryRef.current,
            scale,
            'solid',
            isDarkMode,
          );
        }
        break;
      case 'orbitting':
        for (const { orbit, maneuver } of phase.previousOrbits) {
          drawTrajectory(ctx, orbit, scale, 'minor', isDarkMode);

          // draw maneuver point
          ctx.arc(
            maneuver.postion.x * scale,
            maneuver.postion.y * scale,
            4,
            0,
            2 * Math.PI,
          );
          ctx.fillStyle = '#ff0';
          ctx.fill();
          ctx.beginPath();

          // draw maneuver thrust vector
          ctx.moveTo(maneuver.postion.x * scale, maneuver.postion.y * scale);
          ctx.lineTo(
            (maneuver.postion.x +
              maneuver.deltaSpeed.x / THRUST_TO_MOUSE_SCALER) *
              scale,
            (maneuver.postion.y +
              maneuver.deltaSpeed.y / THRUST_TO_MOUSE_SCALER) *
              scale,
          );
          ctx.strokeStyle = '#ff0';
          ctx.stroke();
          ctx.beginPath();
        }

        drawTrajectory(ctx, phase.orbit, scale, 'solid', isDarkMode);

        switch (phase.subType.type) {
          case 'maneuver-planning':
            drawTrajectory(
              ctx,
              phase.subType.newOrbit,
              scale,
              'dashed',
              isDarkMode,
            );

            if (lastMouseWorldPositionRef.current) {
              ctx.moveTo(rocket.position.x * scale, rocket.position.y * scale);
              ctx.lineTo(
                lastMouseWorldPositionRef.current.x * scale,
                lastMouseWorldPositionRef.current.y * scale,
              );
              ctx.strokeStyle = '#0f0';
              ctx.stroke();
              ctx.beginPath();
            }

            break;
          default:
            break;
        }
        break;
    }

    if (
      phase.type !== 'orbit-planning' ||
      phase.subType !== 'waiting-for-cursor'
    ) {
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
    }

    (window as any).customRender?.(ctx);
    ctx.beginPath();

    ctx.restore();
  });

  return (
    <>
      <div className={styles.root}>
        <div className={stylesFlow.toolbar}>
          <label>
            Orbit template:{' '}
            <select
              value={orbitTemplate}
              onChange={(event) => {
                setOrbitTemplate(event.target.value as OrbitTemplate);
              }}
            >
              <option value="custom">Custom</option>
              <option value="iss">ISS</option>
            </select>
          </label>
        </div>
        <div ref={wrapperRef} className={styles.wrapper}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={width}
            height={height}
            onClick={onCanvasClick}
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
  lineStyle: 'solid' | 'dashed' | 'minor',
  isDarkMode: boolean,
) {
  const color = isDarkMode ? '#ccc' : '#333';

  let first = true;
  for (const position of trajectory) {
    if (first) {
      ctx.moveTo(position.x * scale, position.y * scale);
      first = false;
    } else {
      ctx.lineTo(position.x * scale, position.y * scale);
    }
  }

  ctx.save();

  ctx.strokeStyle = color;
  switch (lineStyle) {
    case 'dashed':
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 3;
      break;
    case 'minor':
      ctx.lineWidth = 1;
      break;
    case 'solid':
      ctx.lineWidth = 3;
      break;
  }
  ctx.stroke();

  ctx.restore();
  ctx.beginPath();
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
    {
      x: rocket.position.x,
      y: rocket.position.y,
      speed: {
        x: rocket.speed.x,
        y: rocket.speed.y,
      },
    },
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
      speed: {
        x: currentRocket.speed.x,
        y: currentRocket.speed.y,
      },
    });

    lastDistance2 = distance2;
    currentRocket = updatedRocket;
  }

  getDebugNode('bottom-right').innerHTML =
    `<h3>Debug info</h3>Iterations: ${i}`;

  return trajectory;
}

function findNearestOrbitPoint(
  points: TrajectoryPoint[],
  { x, y }: Point,
): TrajectoryPoint {
  let minDistance = Infinity;
  let minDistancePoint = points[0];

  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < minDistance) {
      minDistance = distance;
      minDistancePoint = point;
    }
  }

  return minDistancePoint;
}

function printMouseInfo(phase: Phase, { x, y }: Point) {
  const distanceToAttractorPoint2 = x ** 2 + y ** 2;
  const distanceToAttractorPoint = Math.sqrt(distanceToAttractorPoint2);

  const g = (G * EARTH.mass) / distanceToAttractorPoint2;

  let deltaSpeedString = '';
  if (
    phase.type === 'orbitting' &&
    phase.subType.type === 'maneuver-planning'
  ) {
    const speed = Math.sqrt(
      phase.subType.deltaSpeed.x ** 2 + phase.subType.deltaSpeed.y ** 2,
    );
    deltaSpeedString = `<div>Delta speed: ${speed.toFixed(2)} m/s</div>`;
  }

  getDebugNode('top-left').innerHTML = `<h3>Mouse</h3>
    <div>x: ${x.toFixed(0)} m<br>y: ${y.toFixed(0)} m</div>
    <div>gravity: ${g.toFixed(4)} m/s<sup>2</sup></div>
    <div>Earth center:  ${distanceToAttractorPoint.toFixed(0)} m</div>
    <div>Earth surface: ${(distanceToAttractorPoint - EARTH.radius * 1000).toFixed(0)} m</div>
    ${deltaSpeedString}
  `;
}

function calcManeuverPlanning(
  rocket: Rocket,
  worldMousePosition: Point | undefined,
): Extract<Phase['subType'], { type: 'maneuver-planning' }> {
  if (!worldMousePosition) {
    return {
      type: 'maneuver-planning',
      deltaSpeed: { x: 0, y: 0 },
      newOrbit: [],
    };
  }

  const dx = worldMousePosition.x - rocket.position.x;
  const dy = worldMousePosition.y - rocket.position.y;

  const deltaSpeed = {
    x: dx * THRUST_TO_MOUSE_SCALER,
    y: dy * THRUST_TO_MOUSE_SCALER,
  };
  const newOrbit = calculateTrajectory({
    position: rocket.position,
    speed: addPoints(rocket.speed, deltaSpeed),
    angle: rocket.angle,
  });

  return {
    type: 'maneuver-planning',
    deltaSpeed,
    newOrbit,
  };
}
