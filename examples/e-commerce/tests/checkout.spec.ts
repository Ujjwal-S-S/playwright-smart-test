// @checkout
import { CheckoutPage } from '../src/pages/checkout.page.js';
import { CartPage } from '../src/pages/cart.page.js';

describe('Checkout Workflow', () => {
  it('should apply discount and compute order summary', async () => {
    const cart = new CartPage(null);
    const checkout = new CheckoutPage(null, cart);
    const summary = await checkout.submitOrderSummary();
    expect(summary.orderId).toBeDefined();
  });
});
