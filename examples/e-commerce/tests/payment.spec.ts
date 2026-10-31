// @payment
import { PaymentPage } from '../src/pages/payment.page.js';

describe('Payment Processing Gateway', () => {
  it('should authorize credit card charge successfully', async () => {
    const payment = new PaymentPage(null);
    const result = await payment.authorizeCardPayment({
      cardNumber: '4111111111111111',
      cvv: '123',
      amount: 135.00,
    });
    expect(result).toBe(true);
  });
});
