import assert from 'node:assert/strict';
import test from 'node:test';
import { canAdminReviewRequest } from './requestLifecycle.js';

test('allows initial admin decisions and closing an approved request', () => {
  assert.equal(canAdminReviewRequest('pending', 'approved'), true);
  assert.equal(canAdminReviewRequest('pending', 'rejected'), true);
  assert.equal(canAdminReviewRequest('pending', 'closed'), true);
  assert.equal(canAdminReviewRequest('approved', 'closed'), true);
});

test('prevents reopening or changing terminal request states', () => {
  for (const status of ['rejected', 'closed', 'fulfilled', 'reserved']) {
    assert.equal(canAdminReviewRequest(status, 'approved'), false);
  }
  assert.equal(canAdminReviewRequest('approved', 'rejected'), false);
});
