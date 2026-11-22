import { expect, test } from '@playwright/test';

test('registration marks required contact fields and blocks empty submission', async ({ page }) => {
  await page.goto('/register');

  for (const name of ['name', 'email', 'phone', 'password']) {
    const field = page.locator(`input[name="${name}"]`);
    await expect(field).toHaveAttribute('required', '');
    await expect(field.locator('xpath=ancestor::label')).toContainText('*');
  }

  await page.getByRole('button', { name: /Create your account/ }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('password reset verifies an emailed OTP and accepts a matching new password', async ({ page }) => {
  let resetRequest;
  await page.route('**/api/auth/forgot-password', route => route.fulfill({
    json: { message: 'If an active account exists for this email, a verification code will be sent.' }
  }));
  await page.route('**/api/auth/reset-password', async route => {
    resetRequest = route.request().postDataJSON();
    await route.fulfill({ json: { message: 'Password updated. Please sign in.' } });
  });

  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('donor@example.test');
  await page.locator('.auth-submit').click();

  await expect(page.getByLabel('Six-digit verification code')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('If an active account exists');
  await expect(page.getByRole('button', { name: /Resend OTP in/ })).toBeDisabled();
  await page.getByLabel('Six-digit verification code').fill('123456');
  await page.locator('input[name="password"]').fill('new-donor-password');
  await page.locator('input[name="confirmPassword"]').fill('new-donor-password');
  await page.getByRole('button', { name: /Reset password/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('Password updated');
  expect(resetRequest).toEqual({
    email: 'donor@example.test',
    otp: '123456',
    password: 'new-donor-password'
  });
});

test('profile marks contact and location details required', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dc_token', 'test-token');
    localStorage.setItem('dc_user', JSON.stringify({
      name: 'Test Donor',
      email: 'donor@example.test',
      role: 'individual'
    }));
  });
  await page.route('**/api/auth/me', route => route.fulfill({
    json: {
      user: {
        name: 'Test Donor',
        email: 'donor@example.test',
        phone: '',
        profile: {}
      }
    }
  }));
  await page.goto('/profile');

  for (const label of ['Full name', 'Phone', 'Address', 'City', 'State', 'Postal code']) {
    const fieldLabel = page.locator('.surface-form label').filter({ hasText: new RegExp(`^${label}\\s*\\*$`, 'i') });
    const field = fieldLabel.locator('input');
    await expect(field).toHaveAttribute('required', '');
    await expect(fieldLabel).toContainText('*');
  }
});

test('NGO dashboard can remove a request with an active pledge', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dc_token', 'test-token');
    localStorage.setItem('dc_user', JSON.stringify({
      name: 'Community NGO',
      email: 'ngo@example.test',
      role: 'ngo'
    }));
  });
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { user: { name: 'Community NGO', email: 'ngo@example.test', role: 'ngo' } }
  }));
  await page.route('**/api/donations/mine', route => route.fulfill({ json: { donations: [] } }));
  await page.route('**/api/requests/mine', route => route.fulfill({
    json: {
      requests: [{
        _id: 'request-1',
        title: 'School supply drive',
        description: 'School supplies for local children.',
        category: 'education',
        donationType: 'goods',
        status: 'reserved'
      }]
    }
  }));
  await page.route('**/api/ngos/me', route => route.fulfill({ json: { ngo: { verificationStatus: 'approved' } } }));
  await page.route('**/api/requests/request-1', route => route.fulfill({
    json: { message: 'Request removed from listings. Donation history has been retained.' }
  }));
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/dashboard');
  await expect(page.getByText('School supply drive')).toBeVisible();
  await page.getByRole('button', { name: 'Delete request' }).click();
  await expect(page.getByText('School supply drive')).toHaveCount(0);
  await expect(page.getByText('Request removed from listings. Donation history has been retained.', { exact: true })).toBeVisible();
});

test('dashboard hides pledged activity while keeping other statuses visible', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dc_token', 'test-token');
    localStorage.setItem('dc_user', JSON.stringify({
      name: 'Community NGO',
      email: 'ngo@example.test',
      role: 'ngo'
    }));
  });
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { user: { name: 'Community NGO', email: 'ngo@example.test', role: 'ngo' } }
  }));
  await page.route('**/api/donations/mine', route => route.fulfill({
    json: {
      donations: [
        {
          _id: 'pledged-1',
          request: { title: 'school kits for 50 students' },
          type: 'goods',
          status: 'pledged',
          createdAt: '2026-10-29T00:00:00.000Z'
        },
        {
          _id: 'completed-1',
          request: { title: 'school kits for 50 students' },
          type: 'goods',
          status: 'completed',
          tracking: [{ status: 'completed' }],
          createdAt: '2026-10-29T00:00:00.000Z'
        }
      ]
    }
  }));
  await page.route('**/api/requests/mine', route => route.fulfill({ json: { requests: [] } }));
  await page.route('**/api/ngos/me', route => route.fulfill({ json: { ngo: { verificationStatus: 'approved' } } }));

  await page.goto('/dashboard');
  await expect(page.getByText('school kits for 50 students')).toHaveCount(1);
  await expect(page.getByText('completed', { exact: true })).toBeVisible();
  await expect(page.getByText('pledged', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pledged records are hidden here; donation history is retained.')).toHaveCount(0);
});

async function mockAdminApi(page) {
  let reviewDecisions = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/login') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'test-admin-token',
          user: { _id: 'admin-1', name: 'Test Admin', email: 'admin@example.test', role: 'admin' }
        })
      });
      return;
    }
    if (path === '/api/ngos/admin/review') {
      await route.fulfill({ json: { ngos: [] } });
      return;
    }
    if (path === '/api/requests/admin/review') {
      await route.fulfill({ json: { requests: [] } });
      return;
    }
    if (path === '/api/review/decision') {
      reviewDecisions += 1;
      await route.fulfill({ status: 404, json: { message: 'Not found.' } });
      return;
    }
    await route.fulfill({ status: 404, json: { message: 'Unexpected test API request.' } });
  });
  return () => reviewDecisions;
}

test('legacy email review links require an admin login and cannot decide directly', async ({ page }) => {
  const getReviewDecisionCount = await mockAdminApi(page);

  await page.goto('/email-review?token=legacy-link-token');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.locator('input[name="password"]').fill('test-password');
  await page.getByRole('button', { name: /Sign in/ }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: /Admin review desk/ })).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  expect(getReviewDecisionCount()).toBe(0);
});

test('public request listing loads and search filters results', async ({ page }) => {
  await page.route('**/api/requests', route => route.fulfill({
    json: {
      requests: [{
        _id: 'request-1',
        title: 'School supply kits',
        description: 'Provide school kits for local students.',
        category: 'education',
        donationType: 'goods',
        goodsNeeded: [{ item: 'Notebooks', quantity: 50 }],
        location: { city: 'Pune', state: 'Maharashtra' },
        status: 'approved',
        ngo: { _id: 'ngo-1', legalName: 'Community Trust' }
      }]
    }
  }));
  await page.route('**/api/ngos/public', route => route.fulfill({ json: { ngos: [] } }));

  await page.goto('/requests');
  await expect(page.getByRole('heading', { name: 'School supply kits' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search donation requests' }).fill('shelter');
  await expect(page.getByRole('heading', { name: 'School supply kits' })).toHaveCount(0);
  await expect(page.getByText('No published requests just yet.')).toBeVisible();
});
