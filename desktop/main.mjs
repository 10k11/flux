// Electron shell for Flux. It runs the regular Flux server on a loopback port
// and shows it in a window. The server code itself is unchanged.
import { app, BrowserWindow, dialog, shell } from "electron";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureYtDlp } from "./ytdlp.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PREFERRED_PORT = 38417; // fixed so the page origin (and its saved settings) stays stable

if (!app.requestSingleInstanceLock()) app.quit();

function freePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(freePort(0)));
    probe.listen(port, "127.0.0.1", () => {
      const { port: got } = probe.address();
      probe.close(() => resolve(got));
    });
  });
}

let server;
let win;

async function start() {
  const userData = app.getPath("userData");
  const port = await freePort(PREFERRED_PORT);
  Object.assign(process.env, {
    FLUX_LOCAL_MODE: "1",
    HOST: "127.0.0.1",
    PORT: String(port),
    FLUX_ORIGIN: `http://localhost:${port}`,
    FLUX_DATA_DIR: path.join(userData, "data"),
    YTDLP_PATH: await ensureYtDlp(path.join(userData, "bin")),
    FFMPEG_PATH: require("ffmpeg-static"),
    FFPROBE_PATH: require("ffprobe-static").path,
  });
  const { createServer } = await import(
    pathToFileURL(path.join(here, "app-server", "server.mjs")).href
  );
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const windowOptions = {
    width: 1240,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    title: "Flux",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
  if (process.platform === "linux") {
    windowOptions.icon = path.join(here, "build", "icon.png");
  }
  win = new BrowserWindow(windowOptions);
  const origin = `http://localhost:${port}`;
  // Only the local Flux page may load in the window; everything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  await win.loadURL(origin);
}

app.whenReady().then(() =>
  start().catch((error) => {
    dialog.showErrorBox(
      "Flux could not start",
      `${error.message}\n\nThe first launch needs an internet connection to fetch yt-dlp.`,
    );
    app.quit();
  }),
);
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => server?.close());
