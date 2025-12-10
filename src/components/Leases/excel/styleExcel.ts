import * as XLSX from 'xlsx';
import { PaymentRow } from './excelHelper';

export const formatWorksheet = (worksheet: XLSX.WorkSheet, rows: PaymentRow[]) => {
  // Format dates - convert to Excel date serial number
  for (let row = 1; row <= rows.length; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 }); // Column C (Payment Date)
    if (worksheet[cellAddress]) {
      // SheetJS automatically handles Date objects, just set the format
      worksheet[cellAddress].z = 'dd/mm/yyyy'; // Date format
    }
  }

  // Format amounts as currency
  for (let row = 1; row <= rows.length + 15; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 }); // Column D (Amount)
    if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
      worksheet[cellAddress].z = '#,##0.00'; // Currency format
    }
  }

  formatPaymentTable(worksheet);
};

export const formatPaymentTable = (worksheet: XLSX.WorkSheet) => {
  // Set column widths
  worksheet['!cols'] = [
    { wch: 23 },  // Payment
    { wch: 12 },  // Lease Year
    { wch: 13 },  // Payment Date
    { wch: 12 },  // Amount
    { wch: 20 }   // Note
  ];
}