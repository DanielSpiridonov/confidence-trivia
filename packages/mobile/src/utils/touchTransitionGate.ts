// Loading may finish while fingers are still on the screen. Keep the current
// native touch targets mounted until that gesture has ended before navigating.
export function createTouchTransitionGate(schedule: (callback: () => void) => void) {
  let touches = 0;
  let pending: (() => void) | null = null;
  function flush() {
    const action = pending;
    if (!action || touches > 0) return;
    schedule(() => {
      if (touches === 0 && pending === action) { pending = null; action(); }
    });
  }
  return {
    update(count: number) { touches = count; flush(); },
    run(action: () => void) { pending = action; flush(); },
    cancel() { pending = null; touches = 0; },
  };
}
