import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAuth, ownerOf, authorizeMode } from "../lib/auth.mjs";
import { isPublicAddress, createEgressProxy } from "../lib/egress.mjs";
import http from "node:http";
const response = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  writeHead(status, headers) {
    this.status = status;
    Object.assign(this.headers, headers);
  },
  end() {},
});
test("server policy never accepts a forged guest full-download claim", () => {
  assert.throws(() => authorizeMode({ user: null }, "full"), { status: 401 });
  assert.equal(authorizeMode({ user: null, isLoggedIn: true }), "preview");
  assert.equal(
    authorizeMode({ user: { id: "verified-user" } }, "full"),
    "full",
  );
  assert.throws(() => authorizeMode({ user: null }, "anything"), {
    status: 400,
  });
});
test("Google callback verifies state, nonce, identity; rotates and persists session; logout revokes it", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flux-auth-"));
  let authOptions,
    verified = false;
  const client = {
    async generateCodeVerifierAsync() {
      return { codeVerifier: "verifier", codeChallenge: "challenge" };
    },
    generateAuthUrl(options) {
      authOptions = options;
      return "https://accounts.google.com/o/oauth2/v2/auth";
    },
    async getToken({ code, codeVerifier }) {
      assert.equal(code, "valid-code");
      assert.equal(codeVerifier, "verifier");
      return { tokens: { id_token: "provider-test-token" } };
    },
    async verifyIdToken({ audience }) {
      assert.equal(audience, "test-client");
      verified = true;
      return {
        getPayload: () => ({
          sub: "user-123",
          email: "person@example.test",
          email_verified: true,
          nonce: authOptions.nonce,
          name: "Test person",
        }),
      };
    },
  };
  const config = {
    dataDir: dir,
    origin: "https://flux.example",
    clientId: "test-client",
    clientSecret: "test-secret",
    oauthClient: client,
  };
  try {
    const auth = createAuth(config),
      res = response(),
      ctx = auth.get({ headers: {} }, res);
    const oldCookie = res.headers["Set-Cookie"].split(";")[0];
    assert.match(res.headers["Set-Cookie"], /HttpOnly; SameSite=Lax.*Secure/);
    assert.match(ownerOf(ctx.session), /^guest:/);
    await auth.start(ctx, response());
    let migrated;
    const callbackRes = response();
    await auth.callback(
      ctx,
      new URL(
        `https://flux.example/auth/google/callback?state=${authOptions.state}&code=valid-code`,
      ),
      callbackRes,
      (a, b) => (migrated = [a, b]),
    );
    assert.ok(verified);
    assert.equal(migrated[1], "user:user-123");
    assert.equal(callbackRes.headers.Location, "/?auth=success");
    const newCookie = callbackRes.headers["Set-Cookie"].split(";")[0];
    assert.notEqual(oldCookie, newCookie);
    const restarted = createAuth(config),
      signed = restarted.get({ headers: { cookie: newCookie } }, response());
    assert.equal(signed.session.user.id, "user-123");
    assert.equal(
      restarted.get({ headers: { cookie: oldCookie } }, response()).session
        .user,
      null,
    );
    restarted.logout(signed, response());
    assert.equal(
      restarted.get({ headers: { cookie: newCookie } }, response()).session
        .user,
      null,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("invalid callback state and cancelled login fail closed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flux-auth-"));
  try {
    const auth = createAuth({
      dataDir: dir,
      origin: "http://localhost:3000",
      clientId: "test",
      clientSecret: "test",
    });
    const ctx = auth.get({ headers: {} }, response());
    ctx.session.oauth = { state: "expected", expires: Date.now() + 10000 };
    const res = response();
    await auth.callback(
      ctx,
      new URL(
        "http://localhost:3000/auth/google/callback?state=wrong&code=forged",
      ),
      res,
      () => assert.fail(),
    );
    assert.equal(res.headers.Location, "/?auth=failed");
    assert.equal(ctx.session.user, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("egress blocks internal, metadata, loopback, IPv6 and mapped private destinations", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.2",
    "172.16.1.2",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "224.0.0.1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  const proxy = await createEgressProxy();
  try {
    const status = await new Promise((resolve, reject) => {
      http
        .get(proxy.url, { path: "http://127.0.0.1:80/private" }, (r) => {
          r.resume();
          resolve(r.statusCode);
        })
        .on("error", reject);
    });
    assert.equal(status, 403);
  } finally {
    proxy.close();
  }
});
