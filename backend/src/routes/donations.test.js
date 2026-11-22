import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyDonationAmountSchema } from './donations.js';

test('money donation amounts accept fixed choices from ₹1,000 through ₹10,000', () => {
  for (let amount = 1000; amount <= 10000; amount += 1000) {
    assert.equal(moneyDonationAmountSchema.safeParse(amount).success, true);
  }
});

test('money donation amounts reject values outside fixed choices', () => {
  for (const amount of [1, 999, 1500, 10500, 100000]) {
    assert.equal(moneyDonationAmountSchema.safeParse(amount).success, false);
  }
});
