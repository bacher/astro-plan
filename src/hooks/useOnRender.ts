import { useEffect, useEffectEvent } from "react";

export function useOnRender(callback: () => void) {
  const callbackWrapper = useEffectEvent(callback);

  useEffect(() => {
    let isVisible = document.visibilityState === "visible";

    function frame() {
      if (!isVisible) {
        return;
      }
      callbackWrapper();
      requestAnimationFrame(frame);
    }

    const handler = () => {
      isVisible = document.visibilityState === "visible";

      if (isVisible) {
        frame();
      }
    };
    window.addEventListener("visibilitychange", handler);
    frame();

    return () => {
      window.removeEventListener("visibilitychange", handler);
    };
  }, []);
}
