// Story 7-3: Folio domain functions — pure, no framework deps

type Transaction = {
  debit: string;
  credit: string;
};

/** SUM(debit) - SUM(credit). Positive = guest owes, zero/negative = settled. */
export function calculateFolioBalance(transactions: Transaction[]): number {
  let balance = 0;
  for (const t of transactions) {
    balance += parseFloat(t.debit) - parseFloat(t.credit);
  }
  return Math.round(balance * 100) / 100;
}

/** Check-out allowed when balance <= 0 */
export function canCheckOut(balance: number): boolean {
  return balance <= 0;
}

/** Calculate tax amount: amount * (taxRatePercent / 100), rounded to 2 decimal places */
export function calculateTax(
  amount: number,
  taxRatePercent: number,
): number {
  return Math.round(amount * (taxRatePercent / 100) * 100) / 100;
}
