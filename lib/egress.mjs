import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export function isPublicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress())
      ip = ip.toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
async function resolvePublic(host) {
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Non-public address blocked");
  return addresses[0];
}
// All extractor HTTP traffic goes through this loopback-only proxy. Every new
// connection (including redirects) resolves and pins a public destination IP.
export async function createEgressProxy() {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url);
      if (
        url.protocol !== "http:" ||
        (url.port && url.port !== "80") ||
        url.username ||
        url.password
      )
        throw new Error("Blocked");
      const target = await resolvePublic(url.hostname);
      const headers = { ...req.headers, host: url.host };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = http.request(
        {
          host: target.address,
          family: target.family,
          port: 80,
          path: url.pathname + url.search,
          method: req.method,
          headers,
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    } catch {
      res.writeHead(403);
      res.end("Destination blocked");
    }
  });
  server.on("connect", async (req, socket, head) => {
    try {
      const url = new URL("https://" + req.url);
      if (url.port && url.port !== "443") throw new Error("Blocked");
      const target = await resolvePublic(url.hostname);
      const upstream = net.connect(
        { host: target.address, family: target.family, port: 443 },
        () => {
          socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head.length) upstream.write(head);
          socket.pipe(upstream);
          upstream.pipe(socket);
        },
      );
      upstream.setTimeout(60000, () => upstream.destroy());
      upstream.on("error", () => socket.destroy());
      socket.on("error", () => upstream.destroy());
      socket.on("close", () => upstream.destroy());
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
    s.on("error", () => {});
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  server.unref();
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close() {
      for (const s of sockets) s.destroy();
      server.close();
    },
  };
}
