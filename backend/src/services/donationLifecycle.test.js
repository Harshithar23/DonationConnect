import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionDonation, donationTrackingStatuses } from './donationLifecycle.js';

test('goods donations advance through pickup and receipt milestones', () => {
  assert.equal(canTransitionDonation('goods', 'pledged', 'pickup_scheduled'), true);
  assert.equal(canTransitionDonation('goods', 'pickup_scheduled', 'collected'), true);
  assert.equal(canTransitionDonation('goods', 'collected', 'received'), true);
  assert.equal(canTransitionDonation('goods', 'received', 'completed'), true);
  assert.deepEqual(donationTrackingStatuses('goods', 'pledged'), ['pickup_scheduled', 'disputed', 'cancelled']);
});

test('money donation pledges cannot be marked as received through tracking updates', () => {
  assert.equal(canTransitionDonation('money', 'pledged', 'received'), false);
  assert.deepEqual(donationTrackingStatuses('money', 'pledged'), []);
});

test('terminal donation statuses cannot be reopened through tracking', () => {
  assert.equal(canTransitionDonation('goods', 'completed', 'received'), false);
  assert.equal(canTransitionDonation('goods', 'disputed', 'completed'), false);
  assert.deepEqual(donationTrackingStatuses('goods', 'cancelled'), []);
});
