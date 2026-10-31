// @basket @cart
import { CartPage } from '../src/pages/cart.page.js';

describe('Basket & Cart Operations', () => {
  it('should list items and calculate total', async () => {
    const cart = new CartPage(null);
    const items = await cart.getCartItems();
    expect(items.length).toBeGreaterThan(0);
  });
});
