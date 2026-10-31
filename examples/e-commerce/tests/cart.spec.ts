import { test, expect } from '@playwright/test';
import { CartPage } from '../src/pages/cart.page.js';

test.describe('Basket & Cart Operations @basket @cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <div class="cart-item">Item 1</div>
      <div class="cart-item">Item 2</div>
      <span data-testid="cart-total">$150.00</span>
      <button data-testid="proceed-to-checkout">Proceed</button>
    `);
  });

  test('should verify items in cart and calculate total', async ({ page }) => {
    const cart = new CartPage(page);
    const total = await cart.calculateTotal();
    expect(total).toBe(150);
  });

  test('should allow proceeding to checkout from cart', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.proceedToCheckout();
  });
});
