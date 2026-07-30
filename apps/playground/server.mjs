import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";

import app from "./dist/server/server.js";

const clientRoot = join(import.meta.dirname, "dist", "client");
const port = Number(process.env.PORT ?? 3000);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const assetPath = normalize(join(clientRoot, pathname));

    if (assetPath.startsWith(clientRoot) && existsSync(assetPath) && statSync(assetPath).isFile()) {
      response.writeHead(200, {
        "content-type": mimeTypes[extname(assetPath)] ?? "application/octet-stream",
        "cache-control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=0",
      });
      createReadStream(assetPath).pipe(response);
      return;
    }

    const method = request.method ?? "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(request);
    const webRequest = new Request(url, {
      method,
      headers: request.headers,
      body,
      duplex: body ? "half" : undefined,
    });
    const webResponse = await app.fetch(webRequest);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
    if (webResponse.body) Readable.fromWeb(webResponse.body).pipe(response);
    else response.end();
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
  }
}).listen(port, () => {
  console.log(`MossGuard Playground listening on http://127.0.0.1:${port}`);
});
