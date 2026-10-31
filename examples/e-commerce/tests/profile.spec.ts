// @profile
import { ProfilePage } from '../src/pages/profile.page.js';

describe('User Profile Settings', () => {
  it('should read preferences', async () => {
    const profile = new ProfilePage(null);
    const prefs = await profile.getPreferences();
    expect(prefs.theme).toBe('dark');
  });
});
