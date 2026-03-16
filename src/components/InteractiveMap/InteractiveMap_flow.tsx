import {
  useLayoutEffect,
  useRef,
  useEffectEvent,
  useState,
  useEffect,
} from 'react';
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
import { BoostControl } from '../BoostControl/BoostControl';

type Point = {
  x: number;
  y: number;
};

type Rocket = {
  position: Point; // m
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
        | {
            type: 'waiting-for-cursor' | 'space-ship-positioning';
          }
        | {
            type: 'orbit-selection';
            trajectory: TrajectoryPoint[] | undefined;
          };
    }
  | {
      type: 'orbit-defined';
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

export type Boost =
  | {
      type: 'manual';
    }
  | {
      type: 'predefined';
      amount: number;
    };

function getPhase(
  orbitTemplate: OrbitTemplate,
  rocket: Rocket,
  boost: Boost,
  lastMouseWorldPosition: Point | undefined,
): Phase {
  if (orbitTemplate === 'custom') {
    return {
      type: 'orbit-planning',
      subType: {
        type: lastMouseWorldPosition
          ? 'space-ship-positioning'
          : 'waiting-for-cursor',
      },
    };
  }

  const { rocket: initialRocket, orbit } = getTemplateOrbit(orbitTemplate);
  rocket.position = initialRocket.position;
  rocket.speed = initialRocket.speed;

  setTimeout(() => {
    printRocketInfo(rocket);
  }, 0);

  return {
    type: 'orbit-defined',
    orbit,
    previousOrbits: [],
    subType: {
      type: 'orbitting',
    },
  };
}

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

  const [boost, setBoost] = usePersistedState<Boost>('astro-pan:flow:boost', {
    type: 'manual',
  });

  const lastMousePositionRef = useRef<Point | undefined>(undefined);
  const lastMouseWorldPositionRef = useRef<Point | undefined>(undefined);

  const [rocket] = useState<Rocket>(() => ({
    position: { x: 0, y: 0 },
    speed: { x: 0, y: 0 },
  }));

  const [phase, setPhase] = useState<Phase>(() =>
    getPhase(orbitTemplate, rocket, boost, lastMouseWorldPositionRef.current),
  );

  const canvasPositionRef = useRef({ x: 0, y: 0 });

  useKeydown(['Alt'], ({ isPressed }) => {
    if (phase.type === 'orbit-defined') {
      if (isPressed) {
        setPhase({
          ...phase,
          subType: calcManeuverPlanning(
            rocket,
            boost,
            lastMouseWorldPositionRef.current,
          ),
        });
      } else {
        setPhase({
          ...phase,
          subType: {
            type: 'orbitting',
          },
        });
      }

      callOnMouseMoveAsync();
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
        switch (phase.subType.type) {
          case 'waiting-for-cursor':
            rocket.position = { x, y };
            setPhase({
              type: 'orbit-planning',
              subType: {
                type: 'space-ship-positioning',
              },
            });
            break;
          case 'space-ship-positioning':
            rocket.position = { x, y };
            break;
          case 'orbit-selection': {
            const dx = x - rocket.position.x;
            const dy = y - rocket.position.y;
            rocket.speed = {
              x: dx / 4000,
              y: dy / 4000,
            };

            phase.subType.trajectory = calculateTrajectory(rocket);

            printRocketInfo(rocket);
            break;
          }
        }
        break;
      case 'orbit-defined': {
        switch (phase.subType.type) {
          case 'orbitting': {
            const position = findNearestOrbitPoint(phase.orbit, { x, y });

            rocket.position = { x: position.x, y: position.y };
            rocket.speed = position.speed;

            printRocketInfo(rocket);
            break;
          }
          case 'maneuver-planning': {
            phase.subType = calcManeuverPlanning(rocket, boost, { x, y });
            break;
          }
        }
        break;
      }
    }

    printMouseInfo(phase, mouseWorldPosition);
  });

  useMousePosition(onMouseMove);

  useEffect(() => {
    if (lastMousePositionRef.current) {
      onMouseMove(lastMousePositionRef.current);
    }
  }, [scale]);

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    onMouseMove({ x: event.clientX, y: event.clientY });

    switch (phase.type) {
      case 'orbit-planning':
        switch (phase.subType.type) {
          case 'space-ship-positioning': {
            event.preventDefault();

            const trajectory =
              rocket.speed.x === 0 && rocket.speed.y === 0
                ? undefined
                : calculateTrajectory(rocket);

            setPhase({
              type: 'orbit-planning',
              subType: {
                type: 'orbit-selection',
                trajectory,
              },
            });
            break;
          }
          case 'orbit-selection':
            event.preventDefault();
            if (phase.subType.trajectory) {
              setPhase({
                type: 'orbit-defined',
                orbit: phase.subType.trajectory,
                previousOrbits: [],
                subType: {
                  type: 'orbitting',
                },
              });
              callOnMouseMoveAsync();
            }
            break;
        }
        break;
      case 'orbit-defined':
        switch (phase.subType.type) {
          case 'maneuver-planning':
            rocket.speed = addPoints(rocket.speed, phase.subType.deltaSpeed);

            setPhase({
              type: 'orbit-defined',
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
                boost,
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
    const canvas = canvasRef.current!;

    if (scale === 0 || !canvas) {
      return;
    }

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
        if (
          phase.subType.type === 'orbit-selection' &&
          phase.subType.trajectory
        ) {
          drawTrajectory(
            ctx,
            phase.subType.trajectory,
            scale,
            'solid',
            isDarkMode,
          );
        }
        break;
      case 'orbit-defined':
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

          const color = isDarkMode ? '#ff0' : '#ffA500';

          ctx.fillStyle = color;
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
          ctx.strokeStyle = color;
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

            if (boost.type === 'manual') {
              if (lastMouseWorldPositionRef.current) {
                ctx.moveTo(
                  rocket.position.x * scale,
                  rocket.position.y * scale,
                );
                ctx.lineTo(
                  lastMouseWorldPositionRef.current.x * scale,
                  lastMouseWorldPositionRef.current.y * scale,
                );
                ctx.strokeStyle = '#0f0';
                ctx.stroke();
                ctx.beginPath();
              }
            } else {
              ctx.moveTo(rocket.position.x * scale, rocket.position.y * scale);
              ctx.lineTo(
                (rocket.position.x +
                  phase.subType.deltaSpeed.x / THRUST_TO_MOUSE_SCALER) *
                  scale,
                (rocket.position.y +
                  phase.subType.deltaSpeed.y / THRUST_TO_MOUSE_SCALER) *
                  scale,
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
      phase.subType.type !== 'waiting-for-cursor'
    ) {
      // draw rocket
      const rocketX = rocket.position.x * scale;
      const rocketY = rocket.position.y * scale;

      ctx.arc(rocketX, rocketY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = isDarkMode ? '#fff' : '#000';
      ctx.fill();
      ctx.beginPath();
    }

    (window as any).customRender?.(ctx);
    ctx.beginPath();

    ctx.restore();

    drawMeasureLine(ctx, scale, height);
  });

  function callOnMouseMoveAsync() {
    const mousePosition = lastMousePositionRef.current;
    if (mousePosition) {
      // Annoying to use setTimeout, since setBoost is async
      setTimeout(() => {
        onMouseMove(mousePosition);
      }, 0);
    }
  }

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
                setPhase(
                  getPhase(
                    event.target.value as OrbitTemplate,
                    rocket,
                    boost,
                    lastMouseWorldPositionRef.current,
                  ),
                );
                callOnMouseMoveAsync();
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
          {phase.type === 'orbit-defined' &&
            phase.subType.type === 'maneuver-planning' && (
              <BoostControl
                boost={boost}
                setBoost={(updatedBoost) => {
                  setBoost(updatedBoost);
                  callOnMouseMoveAsync();
                }}
              />
            )}
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

  try {
    getDebugNode('bottom-right').innerHTML =
      `<h3>Debug info</h3>Iterations: ${i}`;
  } catch {
    // ignore
  }

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
    phase.type === 'orbit-defined' &&
    phase.subType.type === 'maneuver-planning'
  ) {
    const speed = Math.sqrt(
      phase.subType.deltaSpeed.x ** 2 + phase.subType.deltaSpeed.y ** 2,
    );
    deltaSpeedString = `<div>Delta speed: ${speed.toFixed(2)} m/s</div>`;
  }

  getDebugNode('top-left').innerHTML = `<h3>Mouse</h3>
    <div>x: ${(x / 1000).toFixed(0)} km<br>y: ${(y / 1000).toFixed(0)} km</div>
    <div>gravity: ${g.toFixed(4)} m/s<sup>2</sup></div>
    <div>Earth center:  ${(distanceToAttractorPoint / 1000).toFixed(0)} km</div>
    <div>Earth surface: ${((distanceToAttractorPoint - EARTH.radius * 1000) / 1000).toFixed(0)} km</div>
    ${deltaSpeedString}
  `;
}

function printRocketInfo(rocket: Rocket) {
  const distanceToAttractorPoint2 =
    rocket.position.x ** 2 + rocket.position.y ** 2;
  const distanceToAttractorPoint = Math.sqrt(distanceToAttractorPoint2);
  const g = (G * EARTH.mass) / distanceToAttractorPoint2;
  const rocketSpeed = Math.sqrt(rocket.speed.x ** 2 + rocket.speed.y ** 2);

  getDebugNode('bottom-left').innerHTML = `<h3>Rocket:</h3>
    <div>x: ${(rocket.position.x / 1000).toFixed(0)} km<br>y: ${(rocket.position.y / 1000).toFixed(0)} km</div>
    <div>speed: ${rocketSpeed.toFixed(1)} m/s</div>
    <div>gravity: ${g.toFixed(4)} m/s<sup>2</sup></div>
    <div>Earth center:  ${(distanceToAttractorPoint / 1000).toFixed(0)} km</div>
    <div>Earth surface: ${((distanceToAttractorPoint - EARTH.radius * 1000) / 1000).toFixed(0)} km</div>`;
}

function calcManeuverPlanning(
  rocket: Rocket,
  boost: Boost,
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

  let deltaSpeed: Point;
  if (boost.type === 'manual') {
    deltaSpeed = {
      x: dx * THRUST_TO_MOUSE_SCALER,
      y: dy * THRUST_TO_MOUSE_SCALER,
    };
  } else {
    const angle = Math.atan2(dy, dx);
    deltaSpeed = {
      x: boost.amount * Math.cos(angle),
      y: boost.amount * Math.sin(angle),
    };
  }

  const newOrbit = calculateTrajectory({
    position: rocket.position,
    speed: addPoints(rocket.speed, deltaSpeed),
  });

  return {
    type: 'maneuver-planning',
    deltaSpeed,
    newOrbit,
  };
}

function drawMeasureLine(
  ctx: CanvasRenderingContext2D,
  scale: number,
  height: number,
) {
  let measureUnit = Math.floor((100 * (1 / scale)) / 1000);
  if (measureUnit >= 10_000) {
    measureUnit = 1_000 * Math.floor(measureUnit / 1_000);
  }
  const measureUnitInPixels = Math.round(1000 * measureUnit * scale);

  ctx.save();
  ctx.translate(50, height - 50);

  ctx.moveTo(0, 5);
  ctx.lineTo(0, -5);
  ctx.moveTo(0, 0);
  ctx.lineTo(measureUnitInPixels, 0);
  ctx.moveTo(measureUnitInPixels, +5);
  ctx.lineTo(measureUnitInPixels, -5);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.beginPath();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '12px Arial';
  ctx.fillText(`${measureUnit} km`, 5 + measureUnitInPixels / 2, 0);
  ctx.restore();

  ctx.beginPath();
}

function getTemplateOrbit(orbitTemplate: Exclude<OrbitTemplate, 'custom'>): {
  rocket: Rocket;
  orbit: TrajectoryPoint[];
} {
  let rocket: Rocket;

  switch (orbitTemplate) {
    case 'iss':
      rocket = {
        position: { x: EARTH.radius * 1000 + 408_000, y: 0 },
        speed: { x: 0, y: 7680 },
      };
      break;
  }

  return {
    rocket,
    orbit: calculateTrajectory(rocket),
  };
}
