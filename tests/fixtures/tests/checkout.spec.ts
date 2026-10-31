import { CheckoutPage } from '../pages/checkout.page.js';

/**
 * @checkout @payment
 */
export async function testCheckout() {
  const page = new CheckoutPage();
  await page.fillShippingDetails();
}
