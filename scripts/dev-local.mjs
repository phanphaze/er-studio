import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    "Local database storage requires Node.js 22.13 or newer. Install a current Node.js LTS release, reopen your terminal, and run npm run dev.",
  );
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PORT must be an integer from 1 to 65535");
const local = resolve(root, ".local");
mkdirSync(local, { recursive: true });
const bundle = resolve(local, "project-api.mjs");
await build({
  entryPoints: [resolve(root, "worker/index.ts")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
});
const [{ openLocalDatabase }, { createLocalApiServer }, { default: worker }] =
  await Promise.all([
    import("./local/database.mjs"),
    import("./local/server.mjs"),
    import(pathToFileURL(bundle).href),
  ]);
const filename = resolve(local, "projects.sqlite");
const database = openLocalDatabase(filename, resolve(root, "drizzle"));
const api = createLocalApiServer(worker, database, port);
await new Promise((resolve, reject) => {
  api.once("error", reject);
  api.listen(0, "127.0.0.1", resolve);
});
console.log(`Local projects saved to ${filename}`);
const child = spawn(
  process.execPath,
  [
    resolve(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ER_LOCAL_API_URL: `http://127.0.0.1:${api.address().port}`,
    },
  },
);
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  child.kill("SIGTERM");
  api.close(() => {
    database.close();
  });
  api.closeAllConnections();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
  shutdown();
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
  shutdown();
});
