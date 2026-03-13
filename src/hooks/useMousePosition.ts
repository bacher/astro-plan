import { useEffect, useEffectEvent, useState } from 'react';

type MousePosition = {
  x: number;
  y: number;
};

export function useMousePosition(onMousePositionChange?: (position: MousePosition) => void): MousePosition {
  const [mousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  const onMousePositionChangeEvent = useEffectEvent((pos: MousePosition) =>
    onMousePositionChange?.(pos)
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      mousePosition.x = event.clientX;
      mousePosition.y = event.clientY;
      onMousePositionChangeEvent(mousePosition);
    };

    window.addEventListener('mousemove', onMouseMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return mousePosition;
}