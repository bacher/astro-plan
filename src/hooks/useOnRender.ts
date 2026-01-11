import { useEffect, useEffectEvent } from "react";

export function useOnRender(callback: () => void, interval = 0) {
  const callbackWrapper = useEffectEvent(callback);

  useEffect(() => {
    let isVisible = document.visibilityState === "visible";

    function frame() {
      if (!isVisible) {
        return;
      }
      callbackWrapper();
      if (interval > 0) {
        window.setTimeout(frame, interval);
      } else {
        requestAnimationFrame(frame);
      }
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
  }, [interval]);
}
