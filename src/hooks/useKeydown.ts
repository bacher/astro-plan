import { useEffect, useEffectEvent, useState } from "react";

const DO_NOT_PREVENT_KEYS = ['Alt', 'Control', 'Shift', 'Meta'];

type UpdateParams = { key: string, isPressed: boolean, event: KeyboardEvent }

// keys should not change after the hook is initialized
export function useKeydown(keys: string[], onUpdate?: (params: UpdateParams) => void) {
  const [pressedKeys] = useState(() => new Set<string>());

  const onUpdateEvent = useEffectEvent((params: UpdateParams) => {
    onUpdate?.(params)
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keys.includes(event.key)) {
        if (DO_NOT_PREVENT_KEYS.includes(event.key)) {
          event.preventDefault();
        }
        pressedKeys.add(event.key);
        onUpdateEvent({ key: event.key, isPressed: true, event });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keys.includes(event.key)) {
        pressedKeys.delete(event.key);
        onUpdateEvent({ key: event.key, isPressed: false, event });
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