import { test, expect } from '@playwright/test';
import { CartPage } from '../src/pages/cart.page.js';

test.describe('Basket & Cart Operations @basket @cart', () => {
  test('should verify items in cart and calculate total', async ({ page }) => {
    const cart = new CartPage(page);
    const total = await cart.calculateTotal();
    expect(total).toBeGreaterThan(0);
  });

  test('should allow proceeding to checkout from cart', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.proceedToCheckout();
  });
});
