import * as XLSX from 'xlsx';
import { PropertyLease } from '../types/Lease';
import { PaymentRow, calculateXNPV } from './excelHelper';
import { formatWorksheet } from './styleExcel';
import { formatDate, formatCurrency2 } from './helper';

export const generateLeasePayments = (lease: PropertyLease): XLSX.WorkSheet => {
  const rows = generatePaymentRows(lease);

  // Calculate values for header
  const originalAnnualRent = parseFloat(lease.annualRent);
  const originalMonthlyPayment = Math.round((originalAnnualRent / 12) * 100) / 100;
  const xnpv = calculateXNPV(lease, rows);

  // Create data array for worksheet with header section
  const data: any[][] = [
    ['Property Address:', lease.propertyAddress],
    ['Commencement Date:', formatDate(lease.commencementDate)],
    ['Expiry Date:', formatDate(lease.expiryDate)],
    ['Options:', `${lease.options} years`],
    ['Original Annual Rent:', formatCurrency2(originalAnnualRent)],
    ['Original Monthly Payment:', formatCurrency2(originalMonthlyPayment)],
    [],
    ['RBA CPI Rate:', `${lease.rbaCpiRate}%`],
    ['Fixed Increment Rate:', `${lease.fixedIncrementRate}%`],
    ['Borrowing Rate:', `${lease.borrowingRate}%`],
    ['NPV:', formatCurrency2(xnpv)],
    [],
    [],
    ['Payment', 'Lease Year', 'Payment Date', 'Amount', 'Note']
  ];

  rows.forEach((row, i) => {
    data.push([row.payment, row.leaseYear, row.paymentDate, row.amount, row.note]);
  });

  // Add total row
  data.push([]);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  data.push(['', '', 'TOTAL:', totalAmount, '']);

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  formatWorksheet(worksheet, rows);

  return worksheet;
};

export const generatePaymentRows = (lease: PropertyLease): PaymentRow[] => {
  const rows: PaymentRow[] = [];

  const commencementDate = new Date(lease.commencementDate);
  const expiryDate = new Date(lease.expiryDate);
  const optionsYears = parseInt(lease.options) || 0;

  // Calculate final date (expiry + options)
  const finalDate = new Date(expiryDate);
  finalDate.setFullYear(finalDate.getFullYear() + optionsYears);

  const originalMonthlyPayment = Math.round((parseFloat(lease.annualRent) / 12) * 100) / 100;
  let currentAmount = originalMonthlyPayment;
  let currentDate = new Date(commencementDate);

  let paymentCounter = 1;
  let leaseYear = 1;
  let monthsInCurrentYear = 0;

  // Calculate increment methods for each year
  const incrementMethods: { [year: number]: string } = {};
  Object.keys(lease.incrementMethods).forEach(yearStr => {
    incrementMethods[parseInt(yearStr)] = lease.incrementMethods[parseInt(yearStr)];
  });

  // Apply increment method for Year 1 on the first payment
  const year1Method = incrementMethods[1];
  let year1Note = '';

  if (year1Method === 'Fixed') {
    const fixedRate = parseFloat(lease.fixedIncrementRate) / 100;
    currentAmount = currentAmount * (1 + fixedRate);
    year1Note = `Fixed Increment Rate`;
  } else if (year1Method === 'CPI') {
    const cpiRate = parseFloat(lease.rbaCpiRate) / 100;
    currentAmount = currentAmount * (1 + cpiRate);
    year1Note = `RBA CPI Rate`;
  } else if (year1Method === 'Market') {
    currentAmount = parseFloat(lease.overrideAmounts[1] || '0');
    year1Note = `Market Review`;
  } else if (year1Method === 'None') {
    // No increment applied
    year1Note = `No Increment`;
  }

  while (currentDate < finalDate) {
    let note = '';

    // Check if we're starting a new lease year (every 12 months)
    if (monthsInCurrentYear === 12) {
      leaseYear++;
      monthsInCurrentYear = 0;

      // Apply increment method for this year
      const incrementMethod = incrementMethods[leaseYear];

      if (incrementMethod === 'Fixed') {
        const fixedRate = parseFloat(lease.fixedIncrementRate) / 100;
        currentAmount = currentAmount * (1 + fixedRate);
        note = `Fixed Increment Rate`;
      } else if (incrementMethod === 'CPI') {
        const cpiRate = parseFloat(lease.rbaCpiRate) / 100;
        currentAmount = currentAmount * (1 + cpiRate);
        note = `RBA CPI Rate`;
      } else if (incrementMethod === 'Market') {
        const yearNum = leaseYear;
        currentAmount = parseFloat(lease.overrideAmounts[yearNum] || '0');
        note = `Market Review`;
      } else if (incrementMethod === 'None') {
        // No increment applied
        note = `None`;
      }
    }

    // Add year 1 note only to the first payment
    if (paymentCounter === 1 && year1Note) {
      note = year1Note;
    }

    rows.push({
      payment: paymentCounter,
      leaseYear: leaseYear,
      paymentDate: new Date(currentDate),
      amount: currentAmount,
      note: note
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    paymentCounter++;
    monthsInCurrentYear++;
  }

  return rows;
};