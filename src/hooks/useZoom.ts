import { clamp } from "lodash-es";
import { useEffect, useState, type RefObject } from "react";

type ZoomOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  minZoom?: number
  maxZoom?: number
}

export function useZoom({ canvasRef, minZoom = 0.1, maxZoom = 10 }: ZoomOptions) {
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoomScale((zoomScale) =>
        clamp(zoomScale * (1 - event.deltaY * 0.001), minZoom, maxZoom),
      );
    };

    const canvas = canvasRef.current!;
    canvas.addEventListener('wheel', handleWheel);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return zoomScale;
}