import { Lease } from '../types/Lease';

export interface PaymentRow {
  payment: number;
  leaseYear: number;
  paymentDate: Date;
  amount: number;
  note: string;
}

export const calculateXNPV = (lease: Lease, rows: PaymentRow[]): number => {
  const firstDate = rows[0].paymentDate;
  const rate = parseFloat(lease.borrowingRate) / 100;
  let xnpv = 0;

  rows.forEach((row, i) => {
    const daysDiff = (Date.UTC(row.paymentDate.getFullYear(), row.paymentDate.getMonth(), row.paymentDate.getDate()) -
                  Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())) /
                 (1000 * 60 * 60 * 24);
    const yearsDiff = daysDiff / 365;
    xnpv += row.amount / Math.pow(1 + rate, yearsDiff);
  });

  return xnpv
};