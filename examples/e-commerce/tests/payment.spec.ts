import { test, expect } from '@playwright/test';
import { PaymentPage } from '../src/pages/payment.page.js';

test.describe('Payment Processing Gateway @payment', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <input id="cc-number" />
      <input id="cc-cvv" />
      <button id="authorize-payment">Pay</button>
      <span class="payment-status-badge">COMPLETED</span>
    `);
  });

  test('should authorize credit card charge successfully', async ({ page }) => {
    const payment = new PaymentPage(page);
    const authorized = await payment.authorizeCardPayment({
      cardNumber: '4111111111111111',
      cvv: '123',
      amount: 135.00,
    });
    expect(authorized).toBe(true);

    const status = await payment.getReceiptStatus();
    expect(status).toBe('COMPLETED');
  });
});
