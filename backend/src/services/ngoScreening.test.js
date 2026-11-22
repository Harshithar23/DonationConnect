import test from 'node:test';
import assert from 'node:assert/strict';
import { screenNGO } from './ngoScreening.js';

test('flags missing registration certificate and address', () => {
  const result = screenNGO({ legalName: 'Example Trust', registrationNumber: 'TR-1', registeredAddress: '', documents: [], upiId: '' });
  assert.ok(result.score >= 40);
  assert.ok(result.flags.some(flag => flag.includes('certificate')));
  assert.equal(result.disposition, 'manual_review_required');
});

test('does not score NGOs for missing payment destination details', () => {
  const result = screenNGO({ legalName: 'Example Trust', registrationNumber: 'TR-1', registeredAddress: 'Main Road', documents: [{ kind: 'registration_certificate' }] });
  assert.equal(result.score, 0);
});

test('returns a score within 0-100', () => {
  const result = screenNGO({ legalName: 'Example', registrationNumber: 'x', registeredAddress: 'address', documents: [{ kind: 'registration_certificate' }], upiId: 'ngo@upi' });
  assert.ok(result.score >= 0 && result.score <= 100);
});
