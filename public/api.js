let session;
export async function loadSession() {
  const response = await fetch("/api/session");
  if (!response.ok)
    throw new Error("Cannot load your session. Refresh to reconnect.");
  session = await response.json();
  return session;
}
export async function api(route, data) {
  if (!session) await loadSession();
  let response;
  try {
    response = await fetch(route, {
      method: data ? "POST" : "GET",
      headers: data
        ? { "Content-Type": "application/json", "X-Flux-Token": session.token }
        : {},
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error("Cannot reach Flux. Check your connection and try again.");
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Something went wrong. Try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}
