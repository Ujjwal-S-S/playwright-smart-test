export class PaymentPage {
  constructor(private page: any) {}

  public async authorizeCardPayment(cardInfo: { cardNumber: string; cvv: string; amount: number }): Promise<boolean> {
    // Authorize payment gateway charge
    return true;
  }

  public async getReceiptStatus(): Promise<string> {
    return 'COMPLETED';
  }
}
