const paths = {
  download: "M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3 3-3Z",
  monitor: "M3 4h18v13H3zM8 21h8m-4-4v4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  sparkles:
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm7-2v4m-2-2h4",
  link: "m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m4 1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6",
  clipboard: "M9 4H5v17h14V4h-4M9 2h6v5H9z",
  video: "M3 5h13v14H3zM16 10l5-3v10l-5-3",
  music:
    "M9 18V5l12-2v13M9 9l12-2M5 15a4 3 0 1 0 0 6 4 3 0 0 0 0-6Zm12-2a4 3 0 1 0 0 6 4 3 0 0 0 0-6Z",
  sliders:
    "M4 3v5m0 4v9M12 3v10m0 4v4M20 3v2m0 4v12M1 8h6v4H1zM9 13h6v4H9zM17 5h6v4h-6z",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5-1h.01",
  headphones: "M3 13v-1a9 9 0 0 1 18 0v1M3 12h4v9H3zM17 12h4v9h-4z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 11v6m0-11v1",
  refresh: "M20 7a9 9 0 1 0 1 9M20 2v6h-6",
  check: "m5 12 4 4L19 6",
  x: "m6 6 12 12M18 6 6 18",
  bolt: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  play: "M8 5v14l11-7L8 5Z",
  globe:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c3 3 3 7 0 20-3-13-3-17 0-20Z",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.video}"/></svg>`;

Object.assign(paths, {
  plus: "M12 5v14M5 12h14",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5l3 2",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2",
  chevron: "m9 5 7 7-7 7",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  "arrow-up": "M6 18 18 6M6 6h12v12",
  menu: "M4 6h16M4 12h16M4 18h16",
  cloud: "M7 18H5a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 1 10H7Z",
  youtube: "M3 7q0-2 2-2h14q2 0 2 2v10q0 2-2 2H5q-2 0-2-2V7Zm7 2v6l5-3-5-3Z",
  scissors:
    "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 8l12 12M8 16 20 4",
});
export const googleIcon = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.85 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>`;
export function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  root
    .querySelectorAll(".google-icon")
    .forEach((el) => (el.innerHTML = googleIcon));
}
