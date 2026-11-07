import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

test("direct API: session/CSRF enforcement, full-download gate and private library/file access", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flux-api-"));
  process.env.FLUX_DATA_DIR = dir;
  process.env.PORT = "3099";
  const sessions = [
    [
      "guest-token",
      {
        guestId: "guest-1",
        user: null,
        csrf: "csrf-guest",
        expires: Date.now() + 600000,
      },
    ],
    [
      "user-token",
      {
        guestId: "old-guest",
        user: { id: "user-1", name: "Test user" },
        csrf: "csrf-user",
        expires: Date.now() + 600000,
      },
    ],
    [
      "other-token",
      {
        guestId: "other",
        user: { id: "user-2" },
        csrf: "csrf-other",
        expires: Date.now() + 600000,
      },
    ],
  ];
  writeFileSync(
    path.join(dir, "sessions.json"),
    JSON.stringify(
      sessions.map(([token, s]) => [
        createHash("sha256").update(token).digest("hex"),
        s,
      ]),
    ),
  );
  const guestId = randomUUID(),
    userId = randomUUID();
  const records = [
    [guestId, "guest:guest-1", "preview"],
    [userId, "user:user-1", "full"],
  ].map(([id, owner, mode]) => {
    const folder = path.join(dir, id);
    mkdirSync(folder);
    const file = path.join(folder, "fixture.mp4");
    writeFileSync(file, "test file access fixture");
    return {
      id,
      owner,
      mode,
      url: "https://youtu.be/fixture",
      title: "Access-control test fixture",
      status: "completed",
      options: { format: "mp4" },
      filePaths: [file],
      createdAt: Date.now(),
      finishedAt: Date.now(),
    };
  });
  writeFileSync(path.join(dir, "jobs.json"), JSON.stringify(records));
  const { createServer } = await import("../server.mjs");
  const server = createServer();
  await new Promise((resolve) => server.listen(3099, "127.0.0.1", resolve));
  const request = (route, token, body, csrf) =>
    fetch("http://localhost:3099" + route, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: `flux-session=${token}`,
        ...(body
          ? { "Content-Type": "application/json", "X-Flux-Token": csrf || "" }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    let res = await request("/api/jobs", "guest-token");
    const guestJobs = await res.json();
    assert.equal(guestJobs.length, 1);
    assert.equal(guestJobs[0].id, guestId);
    assert.equal(guestJobs[0].owner, undefined);
    assert.equal(guestJobs[0].filePaths, undefined);
    res = await request("/api/jobs", "other-token");
    assert.deepEqual(await res.json(), []);
    assert.equal(
      (await request(`/api/jobs/${userId}/files/0`, "guest-token")).status,
      404,
    );
    assert.equal(
      (await request(`/api/jobs/${userId}/files/0`, "other-token")).status,
      404,
    );
    assert.equal(
      (await request(`/api/jobs/${guestId}/files/0`, "user-token")).status,
      404,
    );
    res = await request(`/api/jobs/${userId}/files/0`, "user-token");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "video/mp4");
    assert.equal(
      (
        await request(
          "/api/jobs",
          "guest-token",
          {
            mode: "full",
            isLoggedIn: true,
            authorized: true,
            items: [{ url: "https://youtu.be/fixture" }],
          },
          "csrf-guest",
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/jobs",
          "guest-token",
          { mode: "preview", items: [] },
          "forged-csrf",
        )
      ).status,
      403,
    );
    res = await request(
      "/api/jobs",
      "user-token",
      { mode: "full", authorized: true, items: [] },
      "csrf-user",
    );
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Choose between/); // passed identity gate; input rejected
    assert.equal(
      (
        await request(
          `/api/jobs/${userId}/retry`,
          "other-token",
          {},
          "csrf-other",
        )
      ).status,
      404,
    );
    await request("/api/jobs/clear", "guest-token", {}, "csrf-guest");
    res = await request("/api/jobs", "user-token");
    assert.equal((await res.json()).length, 1);
    const newSession = await fetch("http://localhost:3099/api/session");
    assert.match(newSession.headers.get("set-cookie"), /HttpOnly/);
    assert.equal((await newSession.json()).user, null);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
