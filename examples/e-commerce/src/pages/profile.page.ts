import { type Page, type Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('#profile-name');
    this.emailInput = page.locator('#profile-email');
    this.saveButton = page.locator('button#save-profile');
  }

  public async updateProfile(name: string, email: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.saveButton.click();
  }

  public async getPreferences(): Promise<Record<string, string>> {
    return { theme: 'dark' };
  }
}
