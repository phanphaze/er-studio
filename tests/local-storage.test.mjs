import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { openLocalDatabase } from '../scripts/local/database.mjs';
import { createLocalApiServer } from '../scripts/local/server.mjs';
import worker from '../worker/index';
import { seedGraph } from '../src/store/seed';
it('persists projects across SQLite restarts through the HTTP API and rejects stale writes', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'er-local-'));
  const filename = resolve(directory, 'projects.sqlite');
  let db = openLocalDatabase(filename, resolve('drizzle'));
  let server;
  try {
    server = createLocalApiServer(worker, db, 3000);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${server.address().port}/api/projects`;
    const options = graph => ({ method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify({ graph }) });
    const created = await fetch(url, options(seedGraph));
    expect(created.status).toBe(201);
    const record = await created.json();
    const update = { ...options({ ...seedGraph, name: 'Saved locally' }), method: 'PUT', body: JSON.stringify({ graph: { ...seedGraph, name: 'Saved locally' }, revision: record.revision }) };
    expect((await fetch(`${url}/${record.id}`, update)).status).toBe(200);
    expect((await fetch(`${url}/${record.id}`, update)).status).toBe(409);
    expect((await fetch(url, { ...options(seedGraph), headers: { 'Content-Type': 'application/json', origin: 'https://untrusted.example' } })).status).toBe(403);
    await new Promise(r => server.close(r)); server = null;
    db.close(); db = openLocalDatabase(filename, resolve('drizzle'));
    const reopened = await worker.fetch(new Request(`http://localhost/api/projects/${record.id}`), { DB: db });
    expect((await reopened.json()).graph.name).toBe('Saved locally');
    const list = await worker.fetch(new Request('http://localhost/api/projects'), { DB: db });
    expect(await list.json()).toHaveLength(1);
  } finally {
    if (server) await new Promise(r => server.close(r));
    db.close(); rmSync(directory, { recursive: true, force: true });
  }
});
