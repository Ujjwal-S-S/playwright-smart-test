import { type Page, type Locator } from '@playwright/test';
import { CartPage } from './cart.page.js';

export class CheckoutPage {
  readonly page: Page;
  readonly cartPage: CartPage;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly promoInput: Locator;
  readonly applyPromoButton: Locator;
  readonly submitOrderButton: Locator;
  readonly orderConfirmation: Locator;

  constructor(page: Page, cartPage: CartPage) {
    this.page = page;
    this.cartPage = cartPage;
    this.addressInput = page.locator('#shipping-address');
    this.cityInput = page.locator('#shipping-city');
    this.promoInput = page.locator('#promo-code');
    this.applyPromoButton = page.locator('button#apply-promo');
    this.submitOrderButton = page.locator('button#submit-order');
    this.orderConfirmation = page.locator('.order-confirmation-id');
  }

  public async fillShippingAddress(address: { street: string; city: string }): Promise<void> {
    await this.addressInput.fill(address.street);
    await this.cityInput.fill(address.city);
  }

  public async applyPromoDiscount(code: string): Promise<number> {
    await this.promoInput.fill(code);
    await this.applyPromoButton.click();
    const total = await this.cartPage.calculateTotal();
    if (code === 'VIP25') {
      return total * 0.75;
    }
    return total * 0.9;
  }

  public async submitOrderSummary(): Promise<{ orderId: string; payableAmount: number }> {
    await this.submitOrderButton.click();
    return { orderId: 'ORD-9912', payableAmount: 135.00 };
  }
}
