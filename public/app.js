import { platformPaths } from "./platform-icons.js";
import { icon, hydrateIcons } from "./icons.js";
import { api, loadSession } from "./api.js";
import {
  escapeHtml as esc,
  duration,
  thumbnail,
  safeImage,
  emptyState,
  downloadItem,
  isActive,
} from "./components.js";
const $ = (id) => document.getElementById(id);
const state = {
  mode: "single",
  format: "mp4",
  items: [],
  selected: new Set(),
  jobs: [],
  filter: "all",
  busy: false,
  view: "studio",
  session: null,
};
let generation = 0,
  toastTimer,
  refreshing = false,
  previousJobs = "";
hydrateIcons();
const makeLightTheme = (
  accent,
  hover,
  tint,
  canvas,
  sidebar,
  text,
  muted,
  border,
  surface = "#ffffff",
  displayFont = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  radius = "22px",
) => ({
  accent,
  hover,
  tint,
  canvas,
  sidebar,
  text,
  muted,
  border,
  surface,
  displayFont,
  radius,
  controlRadius: "12px",
  contrast: "#ffffff",
  button: accent,
  buttonHover: hover,
  shadow:
    "0 14px 38px rgba(40, 25, 25, 0.075), 0 2px 6px rgba(40, 25, 25, 0.035)",
});
const sourceThemes = {
  youtube: makeLightTheme(
    "#bd242c",
    "#991b22",
    "#fee8e8",
    "#fff7f6",
    "#f5e9e7",
    "#271819",
    "#725c5d",
    "rgba(95, 35, 36, .13)",
  ),
  tiktok: {
    accent: "#61ded0",
    hover: "#83eee0",
    tint: "rgba(55, 191, 178, .16)",
    canvas: "#111217",
    sidebar: "#15161c",
    surface: "#1b1c23",
    text: "#f4f3f6",
    muted: "#b0aeb9",
    border: "rgba(255,255,255,.09)",
    displayFont: "Arial, Inter, sans-serif",
    radius: "12px",
    controlRadius: "9px",
    contrast: "#ffffff",
    button: "#087c73",
    buttonHover: "#09675f",
    shadow: "0 18px 45px rgba(0,0,0,.3)",
  },
  instagram: makeLightTheme(
    "#a43778",
    "#81265d",
    "#f6e5f1",
    "#fbf6fa",
    "#f4eaf3",
    "#2c1b28",
    "#705c6b",
    "rgba(83, 38, 70, .14)",
    "#fffefe",
    "Georgia, 'Times New Roman', serif",
    "26px",
  ),
  x: {
    accent: "#f2f2f4",
    hover: "#ffffff",
    tint: "rgba(255,255,255,.1)",
    canvas: "#101114",
    sidebar: "#15161a",
    surface: "#1b1c20",
    text: "#f3f3f5",
    muted: "#b0b0b6",
    border: "rgba(255,255,255,.1)",
    displayFont: "Arial, Inter, sans-serif",
    radius: "14px",
    controlRadius: "8px",
    contrast: "#18181b",
    button: "#eeeeef",
    buttonHover: "#ffffff",
    shadow: "0 18px 44px rgba(0,0,0,.32)",
  },
  soundcloud: makeLightTheme(
    "#b24b10",
    "#873707",
    "#ffeadb",
    "#fff8f2",
    "#f5ece3",
    "#2e2118",
    "#746052",
    "rgba(93, 56, 28, .14)",
    "#fffefd",
    "Inter, sans-serif",
    "18px",
  ),
  pinterest: makeLightTheme(
    "#b42035",
    "#901729",
    "#fde9eb",
    "#fff7f7",
    "#f5e9e9",
    "#2a171b",
    "#725b5e",
    "rgba(99, 37, 43, .14)",
    "#ffffff",
    "Georgia, 'Times New Roman', serif",
    "26px",
  ),
  vimeo: makeLightTheme(
    "#087c85",
    "#06636b",
    "#e4f4f4",
    "#f5fafa",
    "#eaf1ef",
    "#182525",
    "#596c6c",
    "rgba(36, 79, 78, .14)",
  ),
  dailymotion: makeLightTheme(
    "#365cbe",
    "#284695",
    "#e9efff",
    "#f6f8ff",
    "#ebeff8",
    "#192139",
    "#5e6881",
    "rgba(42, 62, 117, .14)",
  ),
  twitch: makeLightTheme(
    "#6841b3",
    "#50318e",
    "#f0eafa",
    "#f8f6fc",
    "#eee9f5",
    "#261c37",
    "#695f77",
    "rgba(65, 43, 105, .14)",
  ),
  radiojavan: makeLightTheme(
    "#a93035",
    "#84272c",
    "#fce9e9",
    "#fcf7f6",
    "#f3e9e6",
    "#2b1b19",
    "#705b57",
    "rgba(89, 42, 39, .14)",
  ),
  reddit: makeLightTheme(
    "#b4451c",
    "#8f3415",
    "#ffede3",
    "#fff8f4",
    "#f5ebe5",
    "#2d211b",
    "#726057",
    "rgba(95, 53, 32, .14)",
  ),
  facebook: makeLightTheme(
    "#285cad",
    "#204785",
    "#e8effb",
    "#f6f8fc",
    "#e9edf4",
    "#1a2434",
    "#5d6878",
    "rgba(38, 61, 99, .14)",
  ),
  bilibili: makeLightTheme(
    "#2675ac",
    "#1e5e8b",
    "#e7f2f9",
    "#f4f9fc",
    "#e7eff3",
    "#192733",
    "#586c77",
    "rgba(35, 73, 96, .14)",
  ),
  archive: makeLightTheme(
    "#655096",
    "#514077",
    "#f0ebf8",
    "#f8f6fc",
    "#eeeaf3",
    "#241d30",
    "#665e73",
    "rgba(65, 50, 91, .14)",
  ),
  wikimedia: makeLightTheme(
    "#476a8d",
    "#385673",
    "#eaf0f6",
    "#f6f8fa",
    "#e9edf0",
    "#1e2933",
    "#5c6870",
    "rgba(45, 66, 85, .14)",
  ),
};
const sourceDomains = [
  ["youtube", ["youtube.com", "youtu.be", "youtube-nocookie.com"]],
  ["tiktok", ["tiktok.com"]],
  ["instagram", ["instagram.com"]],
  ["x", ["x.com", "twitter.com"]],
  ["soundcloud", ["soundcloud.com"]],
  ["pinterest", ["pinterest.com", "pin.it"]],
  ["vimeo", ["vimeo.com"]],
  ["dailymotion", ["dailymotion.com", "dai.ly"]],
  ["twitch", ["twitch.tv"]],
  ["radiojavan", ["radiojavan.com", "rj.app"]],
  ["reddit", ["reddit.com", "redd.it"]],
  ["facebook", ["facebook.com", "fb.watch"]],
  ["bilibili", ["bilibili.com", "b23.tv"]],
  ["archive", ["archive.org"]],
  ["wikimedia", ["wikimedia.org"]],
];
function platformForUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return (
      sourceDomains.find(([, hosts]) =>
        hosts.some(
          (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
        ),
      )?.[0] || null
    );
  } catch {
    return null;
  }
}
let themeAnimation;
const sourceNames = Object.fromEntries(
  sourceDomains.map(([id, hosts]) => [
    id,
    {
      youtube: "YouTube",
      tiktok: "TikTok",
      instagram: "Instagram",
      x: "X / Twitter",
      soundcloud: "SoundCloud",
      pinterest: "Pinterest",
      vimeo: "Vimeo",
      dailymotion: "Dailymotion",
      twitch: "Twitch",
      radiojavan: "RadioJavan",
      reddit: "Reddit",
      facebook: "Facebook",
      bilibili: "Bilibili",
      archive: "Archive.org",
      wikimedia: "Wikimedia",
    }[id],
  ]),
);
function platformMark(platform) {
  if (platform === "radiojavan")
    return '<img src="/radiojavan.png" alt="" width="32" height="32">';
  const name = sourceNames[platform];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${platformPaths[name] || platformPaths.YouTube}"/></svg>`;
}
let revealAnimations = [];
function showThemeFlash() {
  const flash = $("theme-flash");
  flash.hidden = false;
  flash.classList.remove("is-visible");
  themeAnimation?.cancel();
  revealAnimations.forEach((animation) => animation.cancel());
  revealAnimations = [];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flash.hidden = true;
    return;
  }
  for (const element of [$("sidebar"), document.querySelector(".app-shell")]) {
    revealAnimations.push(
      element.animate(
        [{ clipPath: "inset(100% 0 0)" }, { clipPath: "inset(0)" }],
        { duration: 760, easing: "cubic-bezier(.2,.76,.32,1)", fill: "both" },
      ),
    );
  }
  themeAnimation = flash.animate(
    [
      { clipPath: "inset(100% 0 0)", opacity: 0 },
      { clipPath: "inset(35% 0 0)", opacity: 1, offset: 0.34 },
      { clipPath: "inset(0)", opacity: 0.96, offset: 0.69 },
      { clipPath: "inset(0)", opacity: 0 },
    ],
    { duration: 760, easing: "cubic-bezier(.2,.76,.32,1)", fill: "forwards" },
  );
  themeAnimation.onfinish = () => {
    flash.hidden = true;
    themeAnimation = null;
    revealAnimations.forEach((animation) => animation.cancel());
    revealAnimations = [];
  };
}
function updatePlatformTheme() {
  const urls =
    state.mode === "single"
      ? [$("media-url").value.trim()]
      : state.mode === "batch"
        ? $("media-url")
            .value.split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean)
        : [];
  const sources = urls.map(platformForUrl);
  const platform =
    sources.length && sources.every((source) => source && source === sources[0])
      ? sources[0]
      : null;
  const prior = document.body.dataset.source || "default";
  const theme = sourceThemes[platform];
  const defaults = {
    accent: "#22242a",
    hover: "#111215",
    tint: "#ebebee",
    canvas: "#f7f7f5",
    sidebar: "#f2f2ef",
    surface: "#ffffff",
    text: "#191919",
    muted: "#686868",
    border: "rgba(20,20,25,.09)",
    displayFont:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    radius: "24px",
    controlRadius: "12px",
    contrast: "#ffffff",
    button: "#22242a",
    buttonHover: "#111215",
    shadow: "0 8px 30px rgba(25,25,35,.045), 0 1px 3px rgba(25,25,35,.025)",
  };
  const value = theme || defaults;
  document.body.dataset.source = platform || "default";
  document.body.dataset.themeMode = ["x", "tiktok"].includes(platform)
    ? "dark"
    : "light";
  for (const [key, cssName] of Object.entries({
    accent: "--accent",
    hover: "--accent-hover",
    tint: "--tint",
    canvas: "--canvas",
    sidebar: "--sidebar-surface",
    surface: "--surface",
    text: "--text",
    muted: "--muted",
    border: "--border",
    displayFont: "--display-font",
    radius: "--panel-radius",
    controlRadius: "--control-radius",
    contrast: "--primary-contrast",
    button: "--button-accent",
    buttonHover: "--button-accent-hover",
    shadow: "--shadow",
  }))
    document.body.style.setProperty(cssName, value[key]);
  document.body.querySelectorAll(".eyebrow").forEach((el) => {
    if (el.closest(".page-heading")) el.textContent = "FLUX WORKSPACE";
  });
  document
    .querySelectorAll(".platform-brand")
    .forEach((el) =>
      el.classList.toggle(
        "is-current-source",
        el.dataset.platform === platform,
      ),
    );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", value.canvas);
  if (platform && prior !== platform) showThemeFlash();
}

updatePlatformTheme();
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
}
function message(text, error = false) {
  $("source-message").textContent = text;
  $("source-message").hidden = !text;
  $("source-message").classList.toggle("error", error);
  $("media-url").setAttribute("aria-invalid", String(error));
}
function openAuth() {
  const configured = state.session?.googleConfigured;
  $("auth-config-note").hidden = !!configured;
  $("google-continue").hidden = !configured;
  $("auth-dialog").showModal();
}
function renderAccount() {
  const user = state.session?.user;
  $("account-label").textContent = user
    ? user.name?.split(" ")[0] || "Your account"
    : "Sign in with Google";
  const holder = $("account-button").firstElementChild;
  holder.className = user ? "avatar" : "google-icon";
  holder.innerHTML = user
    ? safeImage(user.picture)
      ? `<img src="${safeImage(user.picture)}" alt="">`
      : icon("user")
    : "";
  if (!user) hydrateIcons($("account-button"));
  $("account-button").setAttribute("aria-expanded", "false");
  $("sidebar-name").textContent = user?.name || "Guest workspace";
  $("sidebar-account-note").textContent = user
    ? "Your personal library"
    : "Sign in for fast & full downloads";
  $("account-name").textContent = user?.name || "";
  $("account-email").textContent = user?.email || "";
  $("preview-note").hidden = !!user;
  $("full-download").hidden = !!user;
  document
    .querySelectorAll(".retention-hours")
    .forEach((el) => (el.textContent = state.session?.retentionHours || 24));
  updateDownload();
}
async function refreshSession() {
  state.session = await loadSession();
  renderAccount();
}
function accountClick() {
  if (!state.session?.user) return openAuth();
  const menu = $("account-menu");
  menu.hidden = !menu.hidden;
  $("account-button").setAttribute("aria-expanded", String(!menu.hidden));
  if (!menu.hidden) menu.querySelector("button").focus();
}
$("account-button").onclick = accountClick;
$("sidebar-account").onclick = () => {
  setDrawer(false);
  accountClick();
};
$("auth-later").onclick = () => $("auth-dialog").close();
$("sign-out").onclick = async () => {
  try {
    await api("/api/logout", {});
    $("account-menu").hidden = true;
    await refreshSession();
    state.jobs = [];
    previousJobs = "";
    renderJobs();
    await refreshJobs();
    toast("You are now in a guest workspace.");
  } catch (e) {
    toast(e.message);
  }
};
document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".account-wrap") &&
    !e.target.closest("#sidebar-account")
  ) {
    $("account-menu").hidden = true;
    $("account-button").setAttribute("aria-expanded", "false");
  }
});
function setDrawer(open) {
  $("sidebar").classList.toggle("open", open);
  if (innerWidth <= 800) $("sidebar").inert = !open;
  $("drawer-backdrop").hidden = !open;
  $("menu-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("sidebar").querySelector(".nav-item.active").focus();
}
$("menu-toggle").onclick = () =>
  setDrawer(!$("sidebar").classList.contains("open"));
$("drawer-backdrop").onclick = () => {
  setDrawer(false);
  $("menu-toggle").focus();
};
function showView(view, focus = false) {
  if (!["studio", "queue", "history"].includes(view)) view = "studio";
  state.view = view;
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== `view-${view}`));
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
    if (el.dataset.view === view) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("page-label").textContent = {
    studio: "New download",
    queue: "My downloads",
    history: "History",
  }[view];
  history.replaceState(null, "", `#${view}`);
  setDrawer(false);
  $("account-menu").hidden = true;
  window.scrollTo({ top: 0, behavior: "instant" });
  if (focus) $("main").focus();
}
document
  .querySelectorAll("[data-view]")
  .forEach((el) => (el.onclick = () => showView(el.dataset.view, true)));
$("view-all").onclick = () => showView("queue", true);
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
function resetResults() {
  generation++;
  state.items = [];
  state.selected.clear();
  $("results").hidden = true;
  $("preferences").hidden = true;
  message("");
  $("clear-input").hidden = !$("media-url").value;
  updatePlatformTheme();
  updateDownload();
}
function setMode(mode) {
  state.mode = mode;
  resetResults();
  $("media-url").value = "";
  updatePlatformTheme();
  $("clear-input").hidden = true;
  $("media-url").rows = mode === "batch" ? 3 : 1;
  document.querySelectorAll("[data-mode]").forEach((el) => {
    const active = el.dataset.mode === mode;
    el.classList.toggle("active", active);
    el.setAttribute("aria-selected", String(active));
    el.tabIndex = active ? 0 : -1;
  });
  $("source-panel").setAttribute("aria-labelledby", `tab-${mode}`);
  $("input-label").textContent = {
    single: "What would you like to save?",
    batch: "A few good finds? Add them here.",
    search: "Find something worth keeping.",
  }[mode];
  $("media-url").placeholder = {
    single: "Paste a video or music link…",
    batch: "Paste one link per line (up to 20)…",
    search: "Search YouTube by title, artist, or channel…",
  }[mode];
  $("source-help").textContent = {
    single: "A public video, track, or playlist link.",
    batch: "Up to 20 public links, one per line.",
    search: "Choose a matching YouTube result before downloading.",
  }[mode];
  $("playlist-label").hidden = mode !== "single";
  $("paste-button").hidden = mode === "search";
  $("media-url").focus();
}
document.querySelectorAll("[data-mode]").forEach((el) => {
  el.onclick = () => setMode(el.dataset.mode);
  el.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const tabs = [...document.querySelectorAll("[data-mode]")];
      let i = tabs.indexOf(el);
      i =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? tabs.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      setMode(tabs[i].dataset.mode);
      tabs[i].focus();
    }
  };
});
function isPlaylistUrl(val) {
  try {
    const u = new URL(val.trim());
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      if (u.pathname.includes("/playlist")) return true;
      if (u.searchParams.has("list") && !u.searchParams.has("v")) return true;
    }
    if (host.includes("soundcloud.com") && u.pathname.includes("/sets/"))
      return true;
  } catch {}
  return false;
}
function syncPlaylistToggle(val) {
  if (isPlaylistUrl(val)) {
    $("playlist-toggle").checked = true;
  }
}
$("media-url").oninput = () => {
  syncPlaylistToggle($("media-url").value);
  resetResults();
};
$("playlist-toggle").onchange = resetResults;
$("clear-input").onclick = () => {
  $("media-url").value = "";
  resetResults();
  $("media-url").focus();
};
$("media-url").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey && state.mode !== "batch") {
    e.preventDefault();
    $("inspect-form").requestSubmit();
  }
};
$("paste-button").onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    $("media-url").value = text;
    syncPlaylistToggle(text);
    resetResults();
    $("media-url").focus();
  } catch {
    message("Paste with Ctrl+V or Command+V. Clipboard access is unavailable.");
    $("media-url").focus();
  }
};
function updateQuality() {
  if (state.format === "mp3") {
    $("quality-label").textContent = "Audio conversion";
    $("quality").innerHTML = ["192", "128", "256", "320"]
      .map((v) => `<option value="${v}">${v} kbps MP3</option>`)
      .join("");
    $("quality-hint").textContent =
      "Output bitrate. Source audio quality sets the limit.";
  } else {
    const selected = [...state.selected].map((i) => state.items[i]);
    const heights = [...new Set(selected.flatMap((i) => i.heights || []))].sort(
      (a, b) => b - a,
    );
    $("quality-label").textContent = "Video quality";
    $("quality").innerHTML =
      '<option value="best">Best available source</option>' +
      heights.map((h) => `<option value="${h}">Up to ${h}p</option>`).join("");
    $("quality-hint").textContent = heights.length
      ? "Resolutions detected in your selection. No upscaling."
      : "Source formats will be resolved before processing.";
  }
}
function setFormat(format) {
  state.format = format;
  document.querySelectorAll("[data-format]").forEach((el) => {
    const active = el.dataset.format === format;
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", String(active));
  });
  $("subtitles").disabled = format === "mp3";
  updateQuality();
  updateDownload();
}
document
  .querySelectorAll("[data-format]")
  .forEach((el) => (el.onclick = () => setFormat(el.dataset.format)));
function updateDownload() {
  const n = state.selected.size;
  $("download-button").disabled =
    !n || state.busy || !$("permission").checked || !state.session;
  $("download-label").textContent = state.busy
    ? "Please wait…"
    : state.session?.user
      ? n > 1
        ? `Download ${n} files`
        : `Download ${state.format.toUpperCase()}`
      : n > 1
        ? `Download ${n} previews`
        : "Download preview";
}
$("permission").onchange = updateDownload;
function renderResults(title, type) {
  const box = $("results");
  box.hidden = false;
  box.innerHTML = `<div class="results-header"><h3>${esc(title)}</h3>${state.items.length > 1 ? '<button class="text-button" id="select-all">Select all</button>' : ""}</div><div class="result-selection">${state.items
    .map(
      (item, i) =>
        `<label class="result-item"><input type="checkbox" data-select="${i}" ${state.selected.has(i) ? "checked" : ""} aria-label="Select ${esc(item.title)}">${thumbnail(item)}<div class="result-details"><div class="media-title">${esc(item.title)}</div><div class="media-meta">${[
          item.platform,
          item.creator,
          duration(item.duration),
          item.heights?.length ? `Up to ${item.heights[0]}p` : null,
        ]
          .filter(Boolean)
          .map((v) => `<span>${esc(v)}</span>`)
          .join("")}</div></div></label>`,
    )
    .join(
      "",
    )}</div><p class="result-note">${type === "search" ? "Check the title and creator, then select a result." : type === "playlist" ? "Select the items you want. Preview eligibility is checked for each item." : "Source found. Choose how you would like to save it."}</p>`;
  const selectionChanged = () => {
    const onlyAudio =
      state.selected.size > 0 &&
      [...state.selected].every((i) => state.items[i].audioOnly);
    document.querySelector('[data-format="mp4"]').disabled = onlyAudio;
    if (onlyAudio) setFormat("mp3");
    else updateQuality();
    $("preferences").hidden = !state.selected.size;
    updateDownload();
  };
  box.querySelectorAll("[data-select]").forEach(
    (el) =>
      (el.onchange = () => {
        const i = Number(el.dataset.select);
        el.checked ? state.selected.add(i) : state.selected.delete(i);
        selectionChanged();
      }),
  );
  if ($("select-all"))
    $("select-all").onclick = () => {
      state.selected = new Set(
        state.selected.size === state.items.length
          ? []
          : state.items.map((_, i) => i),
      );
      renderResults(title, type);
    };
  selectionChanged();
  fixImages(box);
}
$("inspect-form").onsubmit = async (e) => {
  e.preventDefault();
  if (state.busy) return;
  const text = $("media-url").value.trim();
  if (!text) return;
  if (state.mode !== "search") {
    try {
      for (const value of text.split(/\r?\n/).filter(Boolean)) {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      }
    } catch {
      message(
        "That does not look like a full URL. Paste a link starting with https://.",
        true,
      );
      return;
    }
  }
  resetResults();
  const ticket = generation;
  state.busy = true;
  updateDownload();
  $("inspect-button").disabled = true;
  $("inspect-button").innerHTML = "Finding media…" + icon("refresh");
  $("inspect-button").classList.add("spinning");
  $("lookup-skeleton").hidden = false;
  $("source-panel").setAttribute("aria-busy", "true");
  message("Finding your media…");
  try {
    let data;
    if (state.mode === "batch") {
      const urls = [
        ...new Set(
          text
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      if (urls.length > 20) throw new Error("Use up to 20 links per batch.");
      const items = [],
        errors = [];
      for (let i = 0; i < urls.length; i++) {
        if (ticket !== generation) return;
        message(`Checking link ${i + 1} of ${urls.length}…`);
        try {
          const r = await api("/api/inspect", { url: urls[i] });
          if (r.type === "media") items.push(r);
          else
            errors.push(
              `Link ${i + 1}: use Paste a link for playlists or Spotify matches.`,
            );
        } catch (error) {
          errors.push(`Link ${i + 1}: ${error.message}`);
        }
      }
      if (ticket !== generation) return;
      if (!items.length) throw new Error(errors.join(" "));
      data = {
        type: "batch",
        title: `${items.length} sources found`,
        entries: items,
      };
      message(errors.join(" "), !!errors.length);
    } else {
      data = await api(
        "/api/inspect",
        state.mode === "search"
          ? { search: text }
          : {
              url: text,
              playlist: $("playlist-toggle").checked || isPlaylistUrl(text),
            },
      );
      if (ticket !== generation) return;
      message("");
    }
    if (data.type === "spotify") {
      $("results").hidden = false;
      $("results").innerHTML =
        `<div class="results-header"><h3>${esc(data.title)}</h3></div><p class="result-note">Spotify audio cannot be downloaded here. Search for a matching recording on YouTube.</p><button class="button secondary" id="spotify-search">Find YouTube matches ${icon("search")}</button>`;
      $("spotify-search").onclick = () => {
        setMode("search");
        $("media-url").value = data.search;
        setFormat("mp3");
        $("inspect-form").requestSubmit();
      };
      return;
    }
    state.items = (data.entries || [data]).filter((i) => i.url);
    state.selected = new Set(
      data.type === "search" ? [] : state.items.map((_, i) => i),
    );
    if (!state.items.length)
      throw new Error("No downloadable media was found at this source.");
    renderResults(
      data.type === "media"
        ? "Your media is here"
        : data.title || "Choose your media",
      data.type,
    );
  } catch (error) {
    if (ticket === generation) message(error.message, true);
  } finally {
    state.busy = false;
    updateDownload();
    $("inspect-button").disabled = false;
    $("inspect-button").innerHTML = "Find media" + icon("arrow");
    $("inspect-button").classList.remove("spinning");
    $("lookup-skeleton").hidden = true;
    $("source-panel").removeAttribute("aria-busy");
  }
};
async function createDownload() {
  if (!state.selected.size || state.busy || !$("permission").checked) return;
  state.busy = true;
  updateDownload();
  try {
    await api("/api/jobs", {
      items: [...state.selected].map((i) => ({ url: state.items[i].url })),
      mode: state.session.user ? "full" : "preview",
      authorized: true,
      options: {
        format: state.format,
        quality: state.format === "mp4" ? $("quality").value : "best",
        bitrate: state.format === "mp3" ? $("quality").value : "192",
        subtitles: state.format === "mp4" && $("subtitles").checked,
        language: $("language").value,
      },
    });
    toast("Added to your downloads.");
    resetResults();
    await refreshJobs();
    showView("queue", true);
  } catch (error) {
    if (error.status === 401) {
      await refreshSession();
      openAuth();
    } else message(error.message, true);
  } finally {
    state.busy = false;
    updateDownload();
  }
}
$("download-button").onclick = createDownload;
$("full-download").onclick = openAuth;
function fixImages(root) {
  root.querySelectorAll("img").forEach(
    (img) =>
      (img.onerror = () => {
        img.parentElement.innerHTML = icon("video");
      }),
  );
}
function bindJobs(root) {
  root.querySelectorAll("[data-new-download]").forEach(
    (el) =>
      (el.onclick = () => {
        showView("studio");
        $("media-url").focus();
      }),
  );
  root.querySelectorAll("[data-action]").forEach(
    (el) =>
      (el.onclick = async () => {
        el.disabled = true;
        try {
          await api(`/api/jobs/${el.dataset.id}/${el.dataset.action}`, {});
          await refreshJobs();
        } catch (error) {
          toast(error.message);
          el.disabled = false;
        }
      }),
  );
  fixImages(root);
}
function renderJobs() {
  const count = state.jobs.filter(isActive).length;
  $("nav-count").textContent = count;
  $("nav-count").hidden = !count;
  $("recent-jobs").innerHTML = state.jobs.length
    ? state.jobs.slice(0, 3).map(downloadItem).join("")
    : emptyState();
  const filtered = state.jobs.filter(
    (j) =>
      state.filter === "all" ||
      (state.filter === "active"
        ? isActive(j)
        : state.filter === "failed"
          ? ["failed", "cancelled", "expired"].includes(j.status)
          : j.status === state.filter),
  );
  $("all-jobs").innerHTML = filtered.length
    ? filtered.map(downloadItem).join("")
    : emptyState(
        state.filter === "all"
          ? "Your library is waiting."
          : "Nothing in this view yet.",
      );
  const finished = state.jobs.filter((j) => !isActive(j));
  $("history-jobs").innerHTML = finished.length
    ? finished.map(downloadItem).join("")
    : emptyState("A fresh start.", "Your finished downloads will appear here.");
  $("clear-history").disabled = !finished.length;
  for (const id of ["recent-jobs", "all-jobs", "history-jobs"]) bindJobs($(id));
}
async function refreshJobs() {
  if (refreshing || !state.session) return;
  refreshing = true;
  try {
    const jobs = await api("/api/jobs");
    const serialized = JSON.stringify(jobs);
    if (serialized !== previousJobs) {
      const before = new Map(state.jobs.map((j) => [j.id, j.status]));
      state.jobs = jobs;
      previousJobs = serialized;
      const focus = document.activeElement?.dataset;
      const focusedJob = focus?.id,
        focusedAction = focus?.action;
      renderJobs();
      if (focusedJob)
        document
          .querySelector(
            `#view-${state.view} [data-id="${CSS.escape(focusedJob)}"][data-action="${focusedAction}"]`,
          )
          ?.focus();
      const changed = jobs.find(
        (j) =>
          before.has(j.id) &&
          before.get(j.id) !== j.status &&
          ["completed", "failed"].includes(j.status),
      );
      if (changed)
        toast(
          changed.status === "completed"
            ? "Your media is ready to save."
            : "A download failed. Open your library for details.",
        );
    }
    $("connection-message").hidden = true;
  } catch (error) {
    $("connection-message").textContent = error.message;
    $("connection-message").hidden = false;
  } finally {
    refreshing = false;
  }
}
document.querySelectorAll("[data-filter]").forEach(
  (el) =>
    (el.onclick = () => {
      state.filter = el.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((x) => {
        x.classList.toggle("active", x === el);
        x.setAttribute("aria-pressed", String(x === el));
      });
      renderJobs();
    }),
);
$("clear-history").onclick = () => $("confirm-dialog").showModal();
$("cancel-clear").onclick = () => $("confirm-dialog").close();
$("confirm-clear").onclick = async () => {
  $("confirm-clear").disabled = true;
  try {
    await api("/api/jobs/clear", {});
    $("confirm-dialog").close();
    await refreshJobs();
    toast("Finished downloads cleared.");
  } catch (error) {
    toast(error.message);
  } finally {
    $("confirm-clear").disabled = false;
  }
};
async function loadPlatforms() {
  try {
    const sites = await api("/api/platforms");
    $("supported-grid").innerHTML = sites
      .map(
        (site) =>
          `<div class="platform-brand" title="${esc(site.description)}"><span class="platform-brand-icon">${platformPaths[site.name] ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${platformPaths[site.name]}"/></svg>` : '<img src="/radiojavan.png" alt="" width="24" height="24">'}</span><span>${esc(site.name)}</span></div>`,
      )
      .join("");
  } catch (error) {
    $("supported-grid").textContent = error.message;
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!$("account-menu").hidden) {
      $("account-menu").hidden = true;
      $("account-button").setAttribute("aria-expanded", "false");
      $("account-button").focus();
    }
    if ($("sidebar").classList.contains("open")) {
      setDrawer(false);
      $("menu-toggle").focus();
    }
  }
  if (e.key === "Tab" && $("sidebar").classList.contains("open")) {
    const focusable = [...$("sidebar").querySelectorAll("a,button")];
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (
    e.key === "/" &&
    !document.querySelector("dialog[open]") &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")
  ) {
    e.preventDefault();
    showView("studio");
    $("media-url").focus();
  }
});
document.querySelectorAll(".floating-app").forEach((el) => {
  el.addEventListener("click", () => {
    const name = el.dataset.name || "media";
    toast(`Drop your ${name} link here!`);
    const input = $("media-url");
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});
const params = new URLSearchParams(location.search),
  authResult = params.get("auth");
if (authResult) {
  history.replaceState(null, "", location.pathname + location.hash);
  if (authResult === "success") toast("Welcome to your space.");
  else
    toast(
      {
        cancelled: "Sign-in was cancelled. You can still save a preview.",
        failed: "Sign-in could not be completed. Please try again.",
        unconfigured: "Google sign-in has not been configured on this server.",
      }[authResult] || "Please try signing in again.",
    );
}
showView(location.hash.slice(1) || "studio");
renderJobs();
refreshSession()
  .then(() => Promise.all([refreshJobs(), loadPlatforms()]))
  .catch((error) => {
    $("connection-message").textContent = error.message;
    $("connection-message").hidden = false;
  });
setInterval(() => {
  if (!document.hidden) refreshJobs();
}, 2000);
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) {
    try {
      await refreshSession();
      await refreshJobs();
    } catch (error) {
      toast(error.message);
    }
  }
});

window.addEventListener("resize", () => {
  $("sidebar").inert =
    innerWidth <= 800 && !$("sidebar").classList.contains("open");
});
setInterval(() => {
  if (!document.hidden) refreshSession().catch(() => {});
}, 60000);
