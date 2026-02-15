import * as XLSX from 'xlsx';
import { MobileEquipmentLease } from '../../../types/Lease';
import { XLSXGenerationParams } from '../ToXLSXModal';
import { PaymentRow, calculateXNPV, HEADER_ROW_COUNT, buildExcelHeaderRows } from './excelHelper';
import { formatWorksheet } from './styleExcel';
import { formatCurrency2, normalizeDate } from '../../../utils/helper';
import { generatePVCalculation } from './PVCalculationSheetGenerator';

export const generateExcelFromMobileEquipmentLeases = (lease: MobileEquipmentLease, params: XLSXGenerationParams, entityName: string) => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, generateMobileEquipmentLeasePayments(lease, entityName, params.leaseLiabilityOpening, params.leaseLiabilityClosing), "Lease Payments");
  XLSX.utils.book_append_sheet(workbook, generateMobileEquipmentPVCalculation(lease, params, entityName), "PV Calculation");

  XLSX.writeFile(workbook, `${lease.description}_${lease.regoNo}.xlsx`);
};

export const generateMobileEquipmentLeasePayments = (lease: MobileEquipmentLease, entityName: string, openingDate: string, closingDate: string): XLSX.WorkSheet => {
  const rows = generateMobileEquipmentPaymentRows(lease);

  // Calculate values for header
  const originalAnnualRent = parseFloat(lease.annualRent);
  const originalMonthlyPayment = Math.round((originalAnnualRent / 12) * 100) / 100;
  const xnpv = calculateXNPV(lease, rows);

  // Create data array for worksheet with header section
  const data: any[][] = [
    ...buildExcelHeaderRows(entityName, openingDate, closingDate),
    ['Description:', lease.description],
    ['VIN/Serial No.:', lease.vinSerialNo],
    ['Rego No.:', lease.regoNo],
    ['Delivery Date:', lease.deliveryDate],
    ['Expiry Date:', lease.expiryDate],
    ['Original Annual Rent:', formatCurrency2(originalAnnualRent)],
    ['Original Monthly Payment:', formatCurrency2(originalMonthlyPayment)],
    [],
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
  // 13 metadata rows + HEADER_ROW_COUNT header rows before payment data
  formatWorksheet(worksheet, rows, 13 + HEADER_ROW_COUNT);

  return worksheet;
};

export const generateMobileEquipmentPaymentRows = (lease: MobileEquipmentLease): PaymentRow[] => {
  const rows: PaymentRow[] = [];

  const deliveryDate = normalizeDate(new Date(lease.deliveryDate));
  const expiryDate = normalizeDate(new Date(lease.expiryDate));

  const originalMonthlyPayment = Math.round((parseFloat(lease.annualRent) / 12) * 100) / 100;
  let currentAmount = originalMonthlyPayment;
  let currentDate = normalizeDate(new Date(deliveryDate));

  let paymentCounter = 1;
  let leaseYear = 1;
  let monthsInCurrentYear = 0;

  while (currentDate < expiryDate) {
    // Check if we're starting a new lease year (every 12 months)
    if (monthsInCurrentYear === 12) {
      leaseYear++;
      monthsInCurrentYear = 0;
    }

    rows.push({
      payment: paymentCounter,
      leaseYear: leaseYear,
      paymentDate: new Date(currentDate),
      amount: currentAmount,
      note: '' // No increment methods for mobile equipment
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    paymentCounter++;
    monthsInCurrentYear++;
  }

  return rows;
};

export const generateMobileEquipmentPVCalculation = (lease: MobileEquipmentLease, params: XLSXGenerationParams, entityName: string): XLSX.WorkSheet => {
  // Convert MobileEquipmentLease to PropertyLease-like structure for reusing the PV calculation logic
  const tempLease = {
    ...lease,
    type: 'Property' as const,
    propertyAddress: `${lease.description} - ${lease.regoNo}`,
    commencementDate: lease.deliveryDate,
    expiryDate: lease.expiryDate,
    options: '0',
    fixedIncrementRate: '0',
    rbaCpiRate: '0'
  };

  // Generate the standard PV calculation worksheet
  const worksheet = generatePVCalculation(tempLease, params, false, entityName);

  return worksheet;
};
