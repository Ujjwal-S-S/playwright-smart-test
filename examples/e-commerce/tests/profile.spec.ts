import { test, expect } from '@playwright/test';
import { ProfilePage } from '../src/pages/profile.page.js';

test.describe('User Profile Settings @profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <input id="profile-name" />
      <input id="profile-email" />
      <button id="save-profile">Save</button>
    `);
  });

  test('should update profile name and email', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.updateProfile('Alice Doe', 'alice@example.com');
  });

  test('should read saved theme preference', async ({ page }) => {
    const profile = new ProfilePage(page);
    const prefs = await profile.getPreferences();
    expect(prefs.theme).toBe('dark');
  });
});
