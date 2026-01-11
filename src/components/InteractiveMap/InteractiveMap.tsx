import { useLayoutEffect, useRef, useEffectEvent } from "react";
import styles from "./InteractiveMap.module.css";

export function InteractiveMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const resize = useEffectEvent(() => {
    const wrapper = wrapperRef.current!;
    const canvas = canvasRef.current!;

    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
  });

  useLayoutEffect(() => {
    resize();

    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} width={0} height={0} />
    </div>
  );
}
