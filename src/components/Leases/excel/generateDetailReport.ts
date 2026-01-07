import * as XLSX from 'xlsx';
import { PropertyLease, MobileEquipmentLease, Lease } from '../../../types/Lease';
import { ReportParams } from '../ReportModal';
import { generatePaymentRows } from './leasePaymentsSheetGenerator';
import { generateMobileEquipmentPaymentRows } from './mobileEquipmentExcelGenerator';
import {
  calculatePresentValue,
  generateCashFlowsOfFutureLeasePayment,
  generateRightOfUseAsset,
  generateLeaseLiability,
  generateJournalTable,
  generateBalanceSummaryTable,
  calculateLeasePaymentsDue,
  BalanceSummaryParams,
  LeasePaymentsDueRow
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
  leasePaymentsDueRows: LeasePaymentsDueRow[];
}

const getLeaseBalanceSummary = (
  lease: Lease,
  openingDate: Date,
  closingDate: Date
): LeaseBalanceSummary => {
  const isPropertyLease = lease.type === 'Property';
  const vehicleType = isPropertyLease ? undefined : (lease as MobileEquipmentLease).vehicleType;

  // Generate lease title
  // Property: "{Lessor} {Property Address}"
  // Mobile Equipment: "{Lessor} {rego no.}"
  const leaseTitle = isPropertyLease
    ? `${lease.lessor} ${(lease as PropertyLease).propertyAddress}`
    : `${lease.lessor} ${(lease as MobileEquipmentLease).regoNo}`;

  // Get payment rows based on lease type
  const allPaymentRows = isPropertyLease
    ? generatePaymentRows(lease as PropertyLease)
    : generateMobileEquipmentPaymentRows(lease as MobileEquipmentLease);

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
    openingBalances.interestExpenseRent,
    isExtension,
    lease.branch,
    isPropertyLease,
    vehicleType
  );

  // Generate balance summary table
  const balanceSummaryParams: BalanceSummaryParams = {
    presentValue,
    openingDate,
    closingDate,
    expiryDate,
    openingBalances,
    journalRows,
    isExtension,
    allPaymentRows,
    leaseLiabilityRows,
    rightOfUseAssetRows,
    branch: lease.branch,
    vehicleType
  };

  const balanceRows = generateBalanceSummaryTable(balanceSummaryParams, isPropertyLease);

  // Generate lease payments due table
  const leasePaymentsDueRows = calculateLeasePaymentsDue(
    leaseLiabilityRows,
    allPaymentRows,
    closingDate
  );

  return {
    leaseTitle,
    isPropertyLease,
    balanceRows,
    leasePaymentsDueRows
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
  mobileEquipmentLeases: MobileEquipmentLease[],
  params: ReportParams
): void => {
  const workbook = XLSX.utils.book_new();

  const openingDate = new Date(params.leaseLiabilityOpening);
  const closingDate = new Date(params.leaseLiabilityClosing);
  const openingYear = openingDate.getFullYear();

  // Filter leases that are active at the opening date
  const isLeaseActiveAtOpeningDate = (lease: Lease): boolean => {
    const expiryDate = new Date(lease.expiryDate);
    const expiryYear = expiryDate.getFullYear();
    return expiryYear >= openingYear;
  };

  // Determine which leases to include (only active leases at opening date)
  const includedPropertyLeases = params.includedLeases === 'Property' || params.includedLeases === 'All'
    ? propertyLeases.filter(isLeaseActiveAtOpeningDate)
    : [];
  const includedMobileEquipmentLeases = params.includedLeases === 'Motor' || params.includedLeases === 'All'
    ? mobileEquipmentLeases.filter(isLeaseActiveAtOpeningDate)
    : [];

  const allLeases: Lease[] = [...includedPropertyLeases, ...includedMobileEquipmentLeases];

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
    // Columns A-G: Balance summary table
    // Column H: Gap
    // Columns I-L: Lease Payments Due table
    data.push([
      '',
      '',
      `Audited Opening Balance 31/12/${lastYear}`,
      'Rent/Interest Rate Changed',
      `Adj. Opening Balance 31/12/${lastYear}`,
      `Movement FY ${thisYear}`,
      `Closing Balance ${closingDateStr}`,
      '', // Gap column H
      'Lease Payments Due', // Column I header
      'Lease Payments',     // Column J header
      'Interest',           // Column K header
      'NPV'                 // Column L header
    ]);

    // Add balance rows with corresponding Lease Payments Due rows
    // balanceRows structure: [header, row1, row2, row3, row4, row5, row6, row7]
    // Each row: [code, name, opening, rateChanged, adjOpening, movement, closing]
    // leasePaymentsDueRows: [< 1 Year, 1-2 Years, 2-3 Years, 3-4 Years, 4-5 Years, > 5 Years, Total]
    for (let i = 1; i < summary.balanceRows.length; i++) {
      const row = summary.balanceRows[i];
      const paymentDueRow = summary.leasePaymentsDueRows[i - 1]; // i-1 because balance rows have header at index 0

      data.push([
        row[0], // code
        row[1], // name
        row[2], // opening balance
        row[3], // rate changed
        row[4], // adj opening balance
        row[5], // movement
        row[6], // closing balance
        '',     // Gap column H
        paymentDueRow ? paymentDueRow.period : '',        // Period (< 1 Year, 1-2 Years, etc.)
        paymentDueRow ? paymentDueRow.leasePayments : '', // Lease Payments
        paymentDueRow ? paymentDueRow.interest : '',      // Interest
        paymentDueRow ? paymentDueRow.npv : ''            // NPV
      ]);
    }
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Apply number format to all numeric cells in columns C, D, E, F, G (indices 2-6) and J, K, L (indices 9-11)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    // Balance summary columns (C-G)
    for (let col = 2; col <= 6; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
    // Lease Payments Due columns (J-L)
    for (let col = 9; col <= 11; col++) {
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
    { wch: 25 }, // Rent/Interest Rate Changed column D
    { wch: 25 }, // Adj. Opening Balance column E
    { wch: 20 }, // Movement column F
    { wch: 25 }, // Closing Balance column G
    { wch: 3 },  // Gap column H
    { wch: 18 }, // Lease Payments Due - Period column I
    { wch: 15 }, // Lease Payments column J
    { wch: 12 }, // Interest column K
    { wch: 15 }  // NPV column L
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail Report');

  // Generate filename with closing date
  const filename = `Detail_Report_${formatDateForFilename(closingDate)}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
