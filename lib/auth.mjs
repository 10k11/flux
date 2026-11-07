import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
export const equal = (a, b) => {
  const x = Buffer.from(String(a || "")),
    y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
};
export const ownerOf = (session) =>
  session.user ? `user:${session.user.id}` : `guest:${session.guestId}`;
export function authorizeMode(session, requested) {
  if (requested && !["full", "preview"].includes(requested))
    throw Object.assign(new Error("Choose preview or full download."), {
      status: 400,
    });
  if (requested === "full" && !session.user)
    throw Object.assign(
      new Error("Sign in with Google to download the full file."),
      { status: 401 },
    );
  return session.user && requested !== "preview" ? "full" : "preview";
}

export function createAuth({
  dataDir,
  origin,
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  oauthClient,
} = {}) {
  const secure = origin.startsWith("https:");
  const cookieName = secure ? "__Host-flux-session" : "flux-session";
  const filename = path.join(dataDir, "sessions.json");
  const sessions = new Map();
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(filename))
    for (const [key, value] of JSON.parse(readFileSync(filename, "utf8")))
      if (value.expires > Date.now()) sessions.set(key, value);
  const configured = Boolean(
    clientId &&
    clientSecret &&
    !clientId.toLowerCase().includes("your_google_client_id") &&
    !clientSecret.toLowerCase().includes("your_google_client_secret"),
  );
  const client =
    oauthClient ||
    new OAuth2Client(clientId, clientSecret, `${origin}/auth/google/callback`);
  const save = () => {
    for (const [key, value] of sessions)
      if (value.expires < Date.now()) sessions.delete(key);
    writeFileSync(filename + ".tmp", JSON.stringify([...sessions]), {
      mode: 0o600,
    });
    renameSync(filename + ".tmp", filename);
  };
  function cookie(res, token) {
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`,
    );
  }
  function issue(res, user = null) {
    const token = random();
    const session = {
      guestId: random(),
      csrf: random(),
      user,
      expires: Date.now() + 7 * 86400000,
    };
    sessions.set(hash(token), session);
    save();
    cookie(res, token);
    return { session, key: hash(token) };
  }
  function get(req, res) {
    const token = String(req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const key = token ? hash(token) : "";
    const session = sessions.get(key);
    return session && session.expires > Date.now()
      ? { session, key }
      : issue(res);
  }
  function redirect(res, location) {
    res.writeHead(303, { Location: location, "Cache-Control": "no-store" });
    res.end();
  }
  async function start(context, res) {
    if (!configured) return redirect(res, "/?auth=unconfigured");
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync();
    const state = random(),
      nonce = random();
    context.session.oauth = {
      state,
      nonce,
      codeVerifier,
      expires: Date.now() + 10 * 60000,
    };
    save();
    redirect(
      res,
      client.generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }),
    );
  }
  async function callback(context, url, res, migrateGuest) {
    const pending = context.session.oauth;
    delete context.session.oauth;
    save();
    if (
      !configured ||
      !pending ||
      pending.expires < Date.now() ||
      !equal(pending.state, url.searchParams.get("state"))
    )
      return redirect(res, "/?auth=failed");
    if (url.searchParams.has("error")) return redirect(res, "/?auth=cancelled");
    try {
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) throw new Error("Invalid callback");
      const { tokens } = await client.getToken({
        code,
        codeVerifier: pending.codeVerifier,
      });
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.email_verified ||
        !equal(payload.nonce, pending.nonce)
      )
        throw new Error("Identity not verified");
      const user = {
        id: payload.sub,
        name: payload.name || payload.email,
        email: payload.email,
        picture: payload.picture?.startsWith("https://")
          ? payload.picture
          : null,
      };
      const oldOwner = ownerOf(context.session);
      sessions.delete(context.key);
      const next = issue(res, user);
      if (oldOwner.startsWith("guest:"))
        migrateGuest(oldOwner, ownerOf(next.session));
      redirect(res, "/?auth=success");
    } catch {
      redirect(res, "/?auth=failed");
    }
  }
  function logout(context, res) {
    sessions.delete(context.key);
    return issue(res).session;
  }
  return { get, start, callback, logout, configured, save };
}
