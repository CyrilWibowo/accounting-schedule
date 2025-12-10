import * as XLSX from 'xlsx';
import { PropertyLease } from '../types/Lease';
import { generateLeasePayments } from './leasePaymentsSheetGenerator';
import { generatePVCalculation } from './PVCalculationSheetGenerator';
import { XLSXGenerationParams } from '../components/ToXLSXModal';

export const generateExcelFromLeases = (lease: PropertyLease, params: XLSXGenerationParams) => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, generateLeasePayments(lease), "Lease Payements");
  XLSX.utils.book_append_sheet(workbook, generatePVCalculation(lease, params, true), "PV Calculation");

  XLSX.writeFile(workbook, `${lease.propertyAddress}.xlsx`);
};