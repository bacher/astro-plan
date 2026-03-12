import { useEffect, useState } from "react";

// keys should not change after the hook is initialized
export function useKeydown(keys: string[], onPress?: (key: string) => void) {
  const [pressedKeys] = useState(() => new Set<string>());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keys.includes(event.key) && !pressedKeys.has(event.key)) {
        event.preventDefault();
        pressedKeys.add(event.key);
        onPress?.(event.key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keys.includes(event.key) && pressedKeys.has(event.key)) {
        pressedKeys.delete(event.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return pressedKeys;
}