import { icon } from "./icons.js";
import { serverNow } from "./api.js";
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function duration(n) {
  if (!Number.isFinite(n)) return "";
  n = Math.round(n);
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor((n % 3600) / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
export function size(n) {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
export function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}
export function thumbnail(item) {
  const url = safeImage(item.thumbnail);
  return `<div class="media-thumb">${url ? `<img src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icon("video")}</div>`;
}
export function emptyState(
  title = "Your library is waiting.",
  description = "Find a video or song to start building your offline collection.",
) {
  return `<div class="empty-state"><div class="empty-icon">${icon("download")}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><button class="text-button" data-new-download>New download ${icon("arrow")}</button></div>`;
}
export const isActive = (job) =>
  ["queued", "processing", "downloading"].includes(job.status);
const FAILED_HINTS = {
  "Connecting to source":
    "The link or its access may be the problem. Check the link, then retry.",
  Downloading:
    "The transfer was interrupted. Retry, or choose a lower quality.",
  "Merging and converting":
    "Conversion failed. Retry, or try a different format or quality.",
  "Creating your 50% preview":
    "The preview could not be built. Retry, or download the full file instead.",
};
// "Available until 3:40 PM" normally; a live countdown in the final hour.
// Uses the server's clock (via serverNow) so a skewed device clock is safe.
export function expiryText(expiresAt) {
  const left = expiresAt - serverNow();
  if (left <= 0) return { text: "Expired", urgent: true, expired: true };
  if (left < 3600000) {
    const m = Math.floor(left / 60000),
      s = Math.floor((left % 60000) / 1000);
    return {
      text: `Expires in ${m}:${String(s).padStart(2, "0")}`,
      urgent: true,
    };
  }
  const t = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(left > 20 * 3600000 ? { month: "short", day: "numeric" } : {}),
  }).format(expiresAt);
  return { text: `Available until ${t}`, urgent: false };
}
export function tickExpiry(root = document) {
  let expired = false;
  root.querySelectorAll("[data-expires]").forEach((el) => {
    const e = expiryText(Number(el.dataset.expires));
    el.textContent = e.text;
    el.classList.toggle("urgent", e.urgent);
    expired ||= !!e.expired;
  });
  return expired;
}
export function downloadItem(job) {
  const active = isActive(job),
    status =
      {
        queued: "Waiting to start",
        processing: job.stage || "Preparing your media",
        downloading: "Downloading",
        completed: job.mode === "preview" ? "Preview ready" : "Ready",
        failed: "Failed",
        expired: "Expired",
        cancelled: "Cancelled",
      }[job.status] || job.status;
  const date = job.createdAt
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(job.createdAt)
    : "";
  return `<article class="job-row" data-job="${escapeHtml(job.id)}">${thumbnail(job)}<div class="job-body"><h3 class="media-title">${escapeHtml(job.title)}</h3><div class="media-meta">${[
    job.platform,
    duration(job.outputDuration || job.duration),
    job.options.format.toUpperCase(),
    size(job.files?.[0]?.size),
    date,
  ]
    .filter(Boolean)
    .map((v) => `<span>${escapeHtml(v)}</span>`)
    .join(
      "",
    )}${job.mode === "preview" ? "<span>50% preview</span>" : ""}</div><div class="status-label status-${escapeHtml(job.status)}">${escapeHtml(status)}${job.status === "downloading" && Number.isFinite(job.progress) ? ` · ${job.progress}%` : ""}${job.speed ? ` · ${size(job.speed)}/s` : ""}</div>${job.status === "downloading" && Number.isFinite(job.progress) ? `<progress class="progress-track" max="100" value="${Math.min(100, Math.max(0, job.progress))}" aria-label="Download progress"></progress>` : ""}${job.status === "failed" && job.failedStep ? `<p class="job-error"><strong>Failed at: ${escapeHtml(job.failedStep)}.</strong> ${escapeHtml(FAILED_HINTS[job.failedStep] || "")}</p>` : ""}${job.error ? `<p class="job-error">${escapeHtml(job.error)}</p>` : ""}${job.status === "expired" ? '<p class="field-hint">This temporary file has expired. Generate it again to save a copy.</p>' : ""}</div><div class="job-actions">${job.status === "completed" ? (job.files || []).map((f) => `<a class="button secondary save-button" href="${escapeHtml(f.url)}" download>${icon("download")}Save file</a>`).join("") + (job.expiresAt ? `<span class="expiry-note" data-expires="${Number(job.expiresAt)}">${escapeHtml(expiryText(job.expiresAt).text)}</span>` : "") : active ? `<button class="button secondary" data-action="cancel" data-id="${escapeHtml(job.id)}">Cancel</button>` : `<button class="button secondary" data-action="retry" data-id="${escapeHtml(job.id)}">${icon("refresh")}${job.status === "expired" ? "Generate again" : "Retry"}</button>`}</div></article>`;
}
