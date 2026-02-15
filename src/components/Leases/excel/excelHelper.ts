import { Lease } from '../../../types/Lease';

export interface PaymentRow {
  payment: number;
  leaseYear: number;
  paymentDate: Date;
  amount: number;
  note: string;
}

export const HEADER_ROW_COUNT = 5;

const formatHeaderDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export const buildExcelHeaderRows = (entityName: string, openingDate: string, closingDate: string): any[][] => {
  return [
    [entityName, '', '', '', 'C&W Accounting'],
    ['AASB16 Report'],
    [`Period: ${formatHeaderDate(openingDate)} to ${formatHeaderDate(closingDate)}`],
    [],
    []
  ];
};

export const REPORT_HEADER_ROW_COUNT = 6;

export const buildReportHeaderRows = (
  entityName: string,
  reportType: 'Summary' | 'Detail',
  includedLeases: string,
  openingDate: string,
  closingDate: string
): any[][] => {
  return [
    [entityName, '', '', '', 'C&W Accounting'],
    [`AASB16 Report ${reportType}`],
    [`${includedLeases} Leases`],
    [`Period: ${formatHeaderDate(openingDate)} to ${formatHeaderDate(closingDate)}`],
    [],
    []
  ];
};

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