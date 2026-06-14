import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * Tracks a horizontal mouse drag starting at `event`, calling `onDelta` with
 * the incremental change in `clientX` for each `mousemove` until `mouseup`.
 * Used for column-resize handles and the grid/timeline splitter.
 */
export function startHorizontalDrag(
  event: ReactMouseEvent<HTMLElement>,
  onDelta: (delta: number) => void,
): void {
  event.preventDefault();
  let lastX = event.clientX;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - lastX;
    lastX = moveEvent.clientX;
    onDelta(delta);
  };
  const handleMouseUp = () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}
