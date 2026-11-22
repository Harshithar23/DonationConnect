import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createApiRateLimiter } from './apiRateLimit.js';

test('limits API requests while allowing health checks', async t => {
  const app = express();
  app.use('/api', createApiRateLimiter({ windowMs: 60_000, limit: 2 }));
  app.get('/api/resource', (req, res) => res.sendStatus(200));
  app.get('/api/health', (req, res) => res.sendStatus(200));
  app.post('/api/example', (req, res) => res.sendStatus(200));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${baseUrl}/api/resource`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/resource`)).status, 200);
  const limited = await fetch(`${baseUrl}/api/resource`);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.has('ratelimit-limit'));
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/example`, { method: 'POST' })).status, 429);
});
