import { createServer } from "node:http";
export function createLocalApiServer(worker, database, frontendPort) {
  const allowedOrigins = new Set([
    `http://localhost:${frontendPort}`,
    `http://127.0.0.1:${frontendPort}`,
  ]);
  return createServer(async (incoming, outgoing) => {
    try {
      const origin = incoming.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        outgoing.writeHead(403, { "Content-Type": "application/json" });
        outgoing.end(
          JSON.stringify({ error: "Cross-origin changes are not allowed" }),
        );
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 5_100_000) {
          outgoing.writeHead(413);
          outgoing.end("Model exceeds 5 MB");
          return;
        }
        chunks.push(chunk);
      }
      const request = new Request(
        new URL(incoming.url, origin || `http://localhost:${frontendPort}`),
        {
          method: incoming.method,
          headers: new Headers(
            Object.entries(incoming.headers).flatMap(([key, value]) =>
              value == null
                ? []
                : [[key, Array.isArray(value) ? value.join(", ") : value]],
            ),
          ),
          body: ["GET", "HEAD"].includes(incoming.method)
            ? undefined
            : Buffer.concat(chunks),
        },
      );
      const response = await worker.fetch(request, {
        DB: database,
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error("Local project request failed:", error.message);
      outgoing.writeHead(500, { "Content-Type": "application/json" });
      outgoing.end(
        JSON.stringify({
          error:
            "Local project storage failed. Check the terminal for details.",
        }),
      );
    }
  });
}
