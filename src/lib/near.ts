// Calls back once when an element comes within about two screens of the window (AP-39): a long script's file
// previews are made as their rows come near, nearest first, not all at once when it opens. One watcher for the page.
let watcher: IntersectionObserver | undefined;
const waiting = new Map<Element, () => void>();

export function near(node: Element, onNear: () => void) {
  watcher ??= new IntersectionObserver(
    (seen) => {
      for (const entry of seen) {
        if (!entry.isIntersecting) continue;
        const call = waiting.get(entry.target);
        waiting.delete(entry.target);
        watcher!.unobserve(entry.target);
        call?.();
      }
    },
    { rootMargin: '200% 0px' },
  );
  waiting.set(node, onNear);
  watcher.observe(node);
  return {
    destroy() {
      waiting.delete(node);
      watcher?.unobserve(node);
    },
  };
}
