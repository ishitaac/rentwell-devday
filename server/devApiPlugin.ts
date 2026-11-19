import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

/**
 * Serves /api/<name> in `pnpm dev` by loading api/<name>.ts through Vite's SSR loader
 * and calling the same web-standard GET/POST export that Vercel calls in production.
 */
export function devApiPlugin(): Plugin {
  return {
    name: "fine-print-dev-api",
    configureServer(server) {
      server.middlewares.use("/api", (req, res) => {
        handle(server, req, res).catch((error: unknown) => {
          // Log the error type only: request bodies may contain lease text.
          server.config.logger.error(`[api] ${error instanceof Error ? error.name : "error"}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: { code: "internal", message: "Server error" } }));
          }
        });
      });
    },
  };
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const name = (req.url ?? "").split("?")[0].replace(/^\/+/, "");
  if (!/^[a-z-]+$/.test(name)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<
    string,
    ((request: Request) => Response | Promise<Response>) | undefined
  >;
  const method = req.method ?? "GET";
  const handler = mod[method];
  if (!handler) {
    res.statusCode = 405;
    res.end();
    return;
  }
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  const response = await handler(
    new Request(`http://localhost/api/${name}`, { method, headers, body }),
  );
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
