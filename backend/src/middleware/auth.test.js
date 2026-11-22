import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import User from '../models/User.js';
import { authenticate } from './auth.js';

test('invalidates an existing JWT when the user token version changes', async t => {
  const previousSecret = process.env.JWT_SECRET;
  const previousFindById = User.findById;
  const secret = 'test-secret-with-more-than-thirty-two-characters';
  process.env.JWT_SECRET = secret;
  const user = { _id: 'test-user', status: 'active', tokenVersion: 0 };
  User.findById = () => ({ select: async () => user });
  t.after(() => {
    User.findById = previousFindById;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const token = jwt.sign({ sub: user._id, role: 'individual', ver: 0 }, secret, { expiresIn: '1h' });
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextCalled = false;

  await authenticate(
    { headers: { authorization: `Bearer ${token}` } },
    response,
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, true);

  user.tokenVersion += 1;
  nextCalled = false;
  await authenticate(
    { headers: { authorization: `Bearer ${token}` } },
    response,
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
});
