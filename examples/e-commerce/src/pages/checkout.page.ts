import { CartPage } from './cart.page.js';

export class CheckoutPage {
  constructor(private page: any, private cartPage: CartPage) {}

  public async fillShippingAddress(address: { street: string; city: string }): Promise<void> {
    // Fill shipping form
  }

  public async applyPromoDiscount(code: string): Promise<number> {
    // Computes discount on top of cart total
    const total = await this.cartPage.calculateTotal();
    return total * 0.9;
  }

  public async submitOrderSummary(): Promise<{ orderId: string; payableAmount: number }> {
    return { orderId: 'ORD-9912', payableAmount: 135.00 };
  }
}
