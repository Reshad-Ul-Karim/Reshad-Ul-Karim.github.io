// Device and preference checks, kept free of React so the loader stays tiny.
const root = document.documentElement;
const conn = navigator.connection || {};

export const media = {
  fine: () => matchMedia('(hover: hover) and (pointer: fine)').matches,
  reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  desktop: () => matchMedia('(min-width: 901px)').matches,
  lite: () => root.classList.contains('perf-lite'),
  saveData: () => !!conn.saveData || matchMedia('(prefers-reduced-data: reduce)').matches
};
