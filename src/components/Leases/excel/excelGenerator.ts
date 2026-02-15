import * as XLSX from 'xlsx';
import { PropertyLease } from '../../../types/Lease';
import { generateLeasePayments } from './leasePaymentsSheetGenerator';
import { generatePVCalculation } from './PVCalculationSheetGenerator';
import { XLSXGenerationParams } from '../ToXLSXModal';

export const generateExcelFromLeases = (lease: PropertyLease, params: XLSXGenerationParams, entityName: string) => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, generateLeasePayments(lease, entityName, params.leaseLiabilityOpening, params.leaseLiabilityClosing), "Lease Payements");
  XLSX.utils.book_append_sheet(workbook, generatePVCalculation(lease, params, true, entityName), "PV Calculation");

  XLSX.writeFile(workbook, `${lease.propertyAddress}.xlsx`);
};