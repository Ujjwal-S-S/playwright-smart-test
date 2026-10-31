import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../src/pages/checkout.page.js';
import { CartPage } from '../src/pages/cart.page.js';

test.describe('Checkout Workflow @checkout', () => {
  test('should apply promo discount and submit order summary', async ({ page }) => {
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page, cart);

    await checkout.fillShippingAddress({ street: '123 Test St', city: 'Playwright City' });
    const discountedTotal = await checkout.applyPromoDiscount('VIP25');
    expect(discountedTotal).toBeLessThan(150);

    const summary = await checkout.submitOrderSummary();
    expect(summary.orderId).toBe('ORD-9912');
    expect(summary.payableAmount).toBe(135.00);
  });
});
