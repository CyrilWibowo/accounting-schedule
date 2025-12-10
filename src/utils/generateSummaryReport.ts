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
  leaseName: string;
  isPropertyLease: boolean;
  balanceRows: (string | number)[][];
}

const getLeaseBalanceSummary = (
  lease: Lease,
  openingDate: Date,
  closingDate: Date
): LeaseBalanceSummary => {
  const isPropertyLease = lease.type === 'Property';

  // Generate lease name
  const leaseName = isPropertyLease
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
    leaseName,
    isPropertyLease,
    balanceRows
  };
};

// Account codes and their names
const ACCOUNT_CODES = [
  { code: '16400', name: 'Right to Use the Assets' },
  { code: '16405', name: 'Acc.Depr. Right to Use the Assets' },
  { code: '22005', name: 'Lease Liability - Current' },
  { code: '22010', name: 'Lease Liability - Non Current' },
  { code: '60080', name: 'Depreciation Expense' },
  { code: '60275', name: 'Interest Expense Rent' },
  { code: '60270', name: 'Rent Expense' },
  { code: '60390', name: 'Vehicle Expense' }
];

export const generateSummaryReport = (
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
  const data: any[][] = [];

  // Store totals for each account code for the summary section
  const accountTotals: { [code: string]: { opening: number; movement: number; closing: number } } = {};

  // Determine which row index to use from balance summary based on account code
  // Balance summary rows: [0]=header, [1]=16400, [2]=16405, [3]=22005, [4]=22010, [5]=60080, [6]=60275, [7]=60270/60390
  const rowIndexMap: { [key: string]: number } = {
    '16400': 1,
    '16405': 2,
    '22005': 3,
    '22010': 4,
    '60080': 5,
    '60275': 6,
    '60270': 7,
    '60390': 7
  };

  // Process each account code as a separate table section
  ACCOUNT_CODES.forEach((account, accountIndex) => {
    // Add spacing between tables (except for first table)
    if (accountIndex > 0) {
      data.push([]);
    }

    // Add code and name header
    data.push([account.code, account.name]);

    // Add column headers
    data.push([
      '',
      `Opening Balance 31/12/${lastYear}`,
      `Movement FY ${thisYear}`,
      `Closing Balance ${closingDateStr}`
    ]);

    const balanceRowIndex = rowIndexMap[account.code];

    // Initialize totals
    let totalOpening = 0;
    let totalMovement = 0;
    let totalClosing = 0;

    // Add data rows for each lease
    leaseBalanceSummaries.forEach(summary => {
      // Skip rent expense for motor vehicles or vehicle expense for property
      if (account.code === '60270' && !summary.isPropertyLease) {
        // Add empty row for rent expense when it's a motor vehicle lease
        data.push([summary.leaseName, 0, 0, 0]);
        return;
      }
      if (account.code === '60390' && summary.isPropertyLease) {
        // Add empty row for vehicle expense when it's a property lease
        data.push([summary.leaseName, 0, 0, 0]);
        return;
      }

      const balanceRow = summary.balanceRows[balanceRowIndex];
      if (balanceRow) {
        const opening = typeof balanceRow[2] === 'number' ? balanceRow[2] : 0;
        const movement = typeof balanceRow[3] === 'number' ? balanceRow[3] : 0;
        const closing = typeof balanceRow[4] === 'number' ? balanceRow[4] : 0;

        data.push([
          summary.leaseName,
          opening,
          movement,
          closing
        ]);

        totalOpening += opening;
        totalMovement += movement;
        totalClosing += closing;
      }
    });

    // Store totals for this account
    accountTotals[account.code] = {
      opening: totalOpening,
      movement: totalMovement,
      closing: totalClosing
    };

    // Add totals row
    data.push([
      'Total',
      totalOpening,
      totalMovement,
      totalClosing
    ]);
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Add summary section on the right (starting at column F, index 5)
  const summaryStartCol = 5;

  // Add summary header row
  const summaryHeaderRow = 0;
  worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow, c: summaryStartCol })] = { t: 's', v: '' };
  worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow, c: summaryStartCol + 1 })] = { t: 's', v: '' };
  worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow, c: summaryStartCol + 2 })] = { t: 's', v: `Opening Balance 31/12/${lastYear}` };
  worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow, c: summaryStartCol + 3 })] = { t: 's', v: `Movement FY ${thisYear}` };
  worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow, c: summaryStartCol + 4 })] = { t: 's', v: `Closing Balance ${closingDateStr}` };

  // Add summary data rows for each account code
  ACCOUNT_CODES.forEach((account, index) => {
    const row = index + 1; // Start from row 1 (after header)
    const totals = accountTotals[account.code];

    worksheet[XLSX.utils.encode_cell({ r: row, c: summaryStartCol })] = { t: 's', v: account.code };
    worksheet[XLSX.utils.encode_cell({ r: row, c: summaryStartCol + 1 })] = { t: 's', v: account.name };
    worksheet[XLSX.utils.encode_cell({ r: row, c: summaryStartCol + 2 })] = { t: 'n', v: totals.opening, z: '#,##0.00' };
    worksheet[XLSX.utils.encode_cell({ r: row, c: summaryStartCol + 3 })] = { t: 'n', v: totals.movement, z: '#,##0.00' };
    worksheet[XLSX.utils.encode_cell({ r: row, c: summaryStartCol + 4 })] = { t: 'n', v: totals.closing, z: '#,##0.00' };
  });

  // Update the range to include the summary section
  const currentRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  currentRange.e.c = Math.max(currentRange.e.c, summaryStartCol + 4);
  worksheet['!ref'] = XLSX.utils.encode_range(currentRange);

  // Apply number format to all numeric cells in the main table (columns B, C, D)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = 1; col <= 3; col++) { // Columns B, C, D (1, 2, 3)
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 16 }, // Lease name column
    { wch: 25 }, // Opening Balance
    { wch: 20 }, // Movement
    { wch: 25 }, // Closing Balance
    { wch: 3 },  // Gap column E
    { wch: 8 },  // Summary Code column F
    { wch: 30 }, // Summary Name column G
    { wch: 25 }, // Summary Opening Balance column H
    { wch: 20 }, // Summary Movement column I
    { wch: 25 }  // Summary Closing Balance column J
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary Report');

  // Generate filename with closing date
  const filename = `Summary_Report_${formatDateForFilename(closingDate)}.xlsx`;
  XLSX.writeFile(workbook, filename);
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
