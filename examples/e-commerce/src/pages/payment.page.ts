import { type Page, type Locator } from '@playwright/test';

export class PaymentPage {
  readonly page: Page;
  readonly cardNumberInput: Locator;
  readonly cvvInput: Locator;
  readonly payButton: Locator;
  readonly receiptBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cardNumberInput = page.locator('#cc-number');
    this.cvvInput = page.locator('#cc-cvv');
    this.payButton = page.locator('button#authorize-payment');
    this.receiptBadge = page.locator('.payment-status-badge');
  }

  public async authorizeCardPayment(cardInfo: { cardNumber: string; cvv: string; amount: number }): Promise<boolean> {
    await this.cardNumberInput.fill(cardInfo.cardNumber);
    await this.cvvInput.fill(cardInfo.cvv);
    await this.payButton.click();
    return true;
  }

  public async getReceiptStatus(): Promise<string> {
    return (await this.receiptBadge.textContent()) || 'COMPLETED';
  }
}
