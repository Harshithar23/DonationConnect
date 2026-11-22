import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import { createApp } from '../app.js';
import DonationRequest from '../models/DonationRequest.js';
import NGO from '../models/NGO.js';
import User from '../models/User.js';

test('NGOs and admins can remove requests while preserving linked donation history', async t => {
  const previous = {
    jwtSecret: process.env.JWT_SECRET,
    findUser: User.findById,
    findNgo: NGO.findOne,
    findRequest: DonationRequest.findById,
    updateRequest: DonationRequest.findOneAndUpdate
  };
  const secret = 'request-delete-test-secret-with-at-least-thirty-two-characters';
  process.env.JWT_SECRET = secret;

  const users = new Map([
    ['ngo-owner', { _id: 'ngo-owner', role: 'ngo', status: 'active', tokenVersion: 0 }],
    ['ngo-other', { _id: 'ngo-other', role: 'ngo', status: 'active', tokenVersion: 0 }],
    ['admin-user', { _id: 'admin-user', role: 'admin', status: 'active', tokenVersion: 0 }]
  ]);
  const requests = new Map([
    ['owner-pending', { _id: 'owner-pending', ngo: 'owner-ngo', status: 'pending' }],
    ['other-pending', { _id: 'other-pending', ngo: 'owner-ngo', status: 'pending' }],
    ['admin-pending', { _id: 'admin-pending', ngo: 'owner-ngo', status: 'pending' }],
    ['active-request', { _id: 'active-request', ngo: 'owner-ngo', status: 'approved' }],
    ['pledged-request', { _id: 'pledged-request', ngo: 'owner-ngo', status: 'approved' }],
    ['reserved-request', { _id: 'reserved-request', ngo: 'owner-ngo', status: 'reserved' }]
  ]);

  User.findById = id => ({ select: async () => users.get(id) || null });
  NGO.findOne = async ({ user }) => ({ _id: user === 'ngo-owner' ? 'owner-ngo' : 'other-ngo' });
  DonationRequest.findById = async id => requests.get(id) || null;
  DonationRequest.findOneAndUpdate = async (filter, update) => {
    const request = requests.get(filter._id);
    if (!request || request.deletedAt || (filter.status && request.status !== filter.status)) return null;
    Object.assign(request, update.$set);
    return request;
  };

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokens = Object.fromEntries([...users].map(([id]) => [
    id,
    jwt.sign({ sub: id, ver: 0 }, secret, { expiresIn: '1h' })
  ]));
  const deleteRequest = (id, user) => fetch(`${baseUrl}/api/requests/${id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${tokens[user]}` }
  });

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    User.findById = previous.findUser;
    NGO.findOne = previous.findNgo;
    DonationRequest.findById = previous.findRequest;
    DonationRequest.findOneAndUpdate = previous.updateRequest;
    if (previous.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.jwtSecret;
  });

  const ownerDelete = await deleteRequest('owner-pending', 'ngo-owner');
  assert.equal(ownerDelete.status, 200);
  assert.ok(requests.get('owner-pending').deletedAt);
  assert.equal(requests.get('owner-pending').deletedBy, 'ngo-owner');

  const nonOwnerDelete = await deleteRequest('other-pending', 'ngo-other');
  assert.equal(nonOwnerDelete.status, 403);
  assert.equal(requests.has('other-pending'), true);

  const adminDelete = await deleteRequest('admin-pending', 'admin-user');
  assert.equal(adminDelete.status, 200);
  assert.ok(requests.get('admin-pending').deletedAt);
  assert.equal(requests.get('admin-pending').deletedBy, 'admin-user');

  const activeDelete = await deleteRequest('active-request', 'ngo-owner');
  assert.equal(activeDelete.status, 200);
  assert.equal(requests.get('active-request').status, 'closed');
  assert.ok(requests.get('active-request').deletedAt);

  const pledgedDelete = await deleteRequest('pledged-request', 'ngo-owner');
  assert.equal(pledgedDelete.status, 200);
  assert.ok(requests.get('pledged-request').deletedAt);

  const reservedDelete = await deleteRequest('reserved-request', 'ngo-owner');
  assert.equal(reservedDelete.status, 200);
  assert.ok(requests.get('reserved-request').deletedAt);
  assert.equal(requests.get('reserved-request').status, 'reserved');
});
