export function formatMoney(
    amountCents: number,
    currency: string = "USD"
  ): { amount: number; currency: string; display: string } {
    const display =
      currency === "USD"
        ? `$${(amountCents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : `៛${amountCents.toLocaleString()}`;
  
    return { amount: amountCents, currency, display };
  }