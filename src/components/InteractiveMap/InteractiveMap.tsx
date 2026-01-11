import { useLayoutEffect, useRef, useEffectEvent, useState } from "react";
import { usePrefersColorScheme } from "use-prefers-color-scheme";
import styles from "./InteractiveMap.module.css";
import { useOnRender } from "../../hooks/useOnRender";

export function InteractiveMap() {
  const [[width, height], setCanvasSize] = useState([0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorScheme = usePrefersColorScheme();

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

  useOnRender(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colorScheme === "dark" ? "#000" : "#fff";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);

    ctx.fillStyle = "#ffea50";
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={width}
        height={height}
      />
    </div>
  );
}
