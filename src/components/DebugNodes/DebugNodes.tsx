import { memo } from 'react';

export function getDebugNode(
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
): HTMLDivElement {
  const node = document.querySelector<HTMLDivElement>(`#debug-node-${position}`);

  if (!node) {
    throw new Error(`Debug node ${position} not found`);
  }

  return node;
}

export const DebugNodes = memo(() => {
  return (
    <div>
      <div
        id="debug-node-top-left"
        style={{ position: 'absolute', top: '5px', left: '5px', width: '500px' }}
      />
      <div
        id="debug-node-top-right"
        style={{ position: 'absolute', top: '5px', right: '5px', width: '250px' }}
      />
      <div
        id="debug-node-bottom-left"
        style={{ position: 'absolute', bottom: '5px', left: '5px', width: '500px' }}
      />
      <div
        id="debug-node-bottom-right"
        style={{ position: 'absolute', bottom: '5px', right: '5px', width: '250px' }}
      />
    </div>
  );
});
