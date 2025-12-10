import * as XLSX from 'xlsx';
import { PropertyLease, MotorVehicleLease, Lease } from '../types/Lease';
import { ReportParams } from '../components/ReportModal';
import { generatePaymentRows } from './leasePaymentsSheetGenerator';
import { generateMotorVehiclePaymentRows } from './motorVehicleExcelGenerator';
import {
  calculatePresentValue,
  generateCashFlowsOfFutureLeasePayment,
  generateRightOfUseAsset,
  generateLeaseLiability,
  generateJournalTable,
  generateBalanceSummaryTable,
  BalanceSummaryParams
} from './pvCalculationHelpers';

// Normalize date string to YYYY-MM-DD format for comparison
const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

interface LeaseBalanceSummary {
  leaseTitle: string;
  isPropertyLease: boolean;
  balanceRows: (string | number)[][];
}

const getLeaseBalanceSummary = (
  lease: Lease,
  openingDate: Date,
  closingDate: Date
): LeaseBalanceSummary => {
  const isPropertyLease = lease.type === 'Property';

  // Generate lease title
  // Property: "{Lessor} {Property Address}"
  // Motor Vehicle: "{Lessor} {rego no.}"
  const leaseTitle = isPropertyLease
    ? `${lease.lessor} ${(lease as PropertyLease).propertyAddress}`
    : `${lease.lessor} ${(lease as MotorVehicleLease).regoNo}`;

  // Get payment rows based on lease type
  const allPaymentRows = isPropertyLease
    ? generatePaymentRows(lease as PropertyLease)
    : generateMotorVehiclePaymentRows(lease as MotorVehicleLease);

  // Constants
  const ALLOCATION_TO_LEASE_COMPONENT = 1;
  const OTHER = 0;
  const PARKING = 0;
  const PAYMENT_TIMING = 'Beginning';

  // Calculate lease component values for PV calculation
  const leaseComponentValues = allPaymentRows.map(row => {
    const baseRent = row.amount;
    const totalCashFlows = baseRent + OTHER + PARKING;
    return totalCashFlows * ALLOCATION_TO_LEASE_COMPONENT;
  });

  // Calculate Present Value
  const borrowingRate = parseFloat(lease.borrowingRate) / 100;
  const monthlyRate = borrowingRate / 12;
  const presentValue = calculatePresentValue(leaseComponentValues, monthlyRate, PAYMENT_TIMING);

  // Generate cash flows table
  const cashFlowRows = generateCashFlowsOfFutureLeasePayment(
    allPaymentRows,
    OTHER,
    PARKING,
    ALLOCATION_TO_LEASE_COMPONENT
  );

  // Generate right of use asset table
  const rightOfUseAssetRows = generateRightOfUseAsset(
    allPaymentRows,
    presentValue,
    cashFlowRows
  );

  // Generate lease liability table
  const leaseLiabilityRows = generateLeaseLiability(
    allPaymentRows,
    presentValue,
    cashFlowRows,
    borrowingRate,
    PAYMENT_TIMING
  );

  // Get expiry date
  const expiryDate = new Date(lease.expiryDate);

  // Find matching opening balance
  const normalizedOpeningDate = normalizeDateString(openingDate.toISOString());
  const matchingBalance = lease.openingBalances?.find(ob =>
    normalizeDateString(ob.openingDate) === normalizedOpeningDate
  );

  const openingBalances = matchingBalance ? {
    rightToUseAssets: matchingBalance.rightToUseAssets,
    accDeprRightToUseAssets: matchingBalance.accDeprRightToUseAssets,
    leaseLiabilityCurrent: matchingBalance.leaseLiabilityCurrent,
    leaseLiabilityNonCurrent: matchingBalance.leaseLiabilityNonCurrent,
    depreciationExpense: matchingBalance.depreciationExpense,
    interestExpenseRent: matchingBalance.interestExpenseRent,
    rentExpense: matchingBalance.rentExpense
  } : {
    rightToUseAssets: 0,
    accDeprRightToUseAssets: 0,
    leaseLiabilityCurrent: 0,
    leaseLiabilityNonCurrent: 0,
    depreciationExpense: 0,
    interestExpenseRent: 0,
    rentExpense: 0
  };

  const isExtension = matchingBalance?.isNewLeaseExtension ?? false;

  // Generate journal table
  const journalRows = generateJournalTable(
    presentValue,
    leaseLiabilityRows,
    rightOfUseAssetRows,
    allPaymentRows,
    openingDate,
    closingDate,
    expiryDate,
    openingBalances.leaseLiabilityNonCurrent,
    openingBalances.leaseLiabilityCurrent,
    openingBalances.accDeprRightToUseAssets,
    openingBalances.interestExpenseRent
  );

  // Generate balance summary table
  const balanceSummaryParams: BalanceSummaryParams = {
    presentValue,
    openingDate,
    closingDate,
    expiryDate,
    openingBalances,
    journalRows,
    isExtension
  };

  const balanceRows = generateBalanceSummaryTable(balanceSummaryParams, isPropertyLease);

  return {
    leaseTitle,
    isPropertyLease,
    balanceRows
  };
};

const formatDateForHeader = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const formatDateForFilename = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

export const generateDetailReport = (
  propertyLeases: PropertyLease[],
  motorVehicleLeases: MotorVehicleLease[],
  params: ReportParams
): void => {
  const workbook = XLSX.utils.book_new();

  const openingDate = new Date(params.leaseLiabilityOpening);
  const closingDate = new Date(params.leaseLiabilityClosing);

  // Determine which leases to include
  const includedPropertyLeases = params.includedLeases === 'Property' || params.includedLeases === 'All'
    ? propertyLeases
    : [];
  const includedMotorLeases = params.includedLeases === 'Motor' || params.includedLeases === 'All'
    ? motorVehicleLeases
    : [];

  const allLeases: Lease[] = [...includedPropertyLeases, ...includedMotorLeases];

  // Get balance summaries for all leases
  const leaseBalanceSummaries = allLeases.map(lease =>
    getLeaseBalanceSummary(lease, openingDate, closingDate)
  );

  // Format date strings for headers
  const lastYear = openingDate.getFullYear() - 1;
  const thisYear = closingDate.getFullYear();
  const closingDateStr = formatDateForHeader(closingDate);

  // Build the data array
  const data: (string | number)[][] = [];

  // Process each lease
  leaseBalanceSummaries.forEach((summary, leaseIndex) => {
    // Add spacing between leases (except for first lease)
    if (leaseIndex > 0) {
      data.push([]);
      data.push([]);
    }

    // Add lease title
    data.push([summary.leaseTitle]);

    // Add empty row after title
    data.push([]);

    // Add column headers (matching the balance summary format)
    data.push([
      '',
      '',
      `Opening Balance 31/12/${lastYear}`,
      `Movement FY ${thisYear}`,
      `Closing Balance ${closingDateStr}`
    ]);

    // Add balance rows (skip the header row from balanceRows which is index 0)
    // balanceRows structure: [header, row1, row2, row3, row4, row5, row6, row7]
    // Each row: [code, name, opening, movement, closing]
    for (let i = 1; i < summary.balanceRows.length; i++) {
      const row = summary.balanceRows[i];
      data.push([
        row[0], // code
        row[1], // name
        row[2], // opening balance
        row[3], // movement
        row[4]  // closing balance
      ]);
    }
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Apply number format to all numeric cells in columns C, D, E (indices 2, 3, 4)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = 2; col <= 4; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // Code column A
    { wch: 35 }, // Name column B
    { wch: 25 }, // Opening Balance column C
    { wch: 20 }, // Movement column D
    { wch: 25 }  // Closing Balance column E
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail Report');

  // Generate filename with closing date
  const filename = `Detail_Report_${formatDateForFilename(closingDate)}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
