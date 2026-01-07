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
  LeasePaymentsDueRow,
  getExpenseTypeInfo
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
  expenseCode: string;
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
  const expenseInfo = getExpenseTypeInfo(isPropertyLease, vehicleType);

  // Generate lease name
  const leaseName = isPropertyLease
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
    leaseName,
    isPropertyLease,
    expenseCode: expenseInfo.code,
    balanceRows,
    leasePaymentsDueRows
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
  { code: '60390', name: 'Vehicle Expense' },
  { code: '60150', name: 'Forklift Expense' },
  { code: '60140', name: 'Equipment Rent' }
];

// Expense account codes (for special handling in aggregation)
const EXPENSE_ACCOUNT_CODES = ['60270', '60390', '60150', '60140'];

export const generateSummaryReport = (
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

  // Store totals for each account code
  const accountTotals: { [code: string]: { opening: number; rateChanged: number; adjOpening: number; movement: number; closing: number } } = {};

  // Determine which row index to use from balance summary based on account code
  // Balance summary rows: [0]=header, [1]=16400, [2]=16405, [3]=22005, [4]=22010, [5]=60080, [6]=60275, [7]=expense
  const rowIndexMap: { [key: string]: number } = {
    '16400': 1,
    '16405': 2,
    '22005': 3,
    '22010': 4,
    '60080': 5,
    '60275': 6,
    '60270': 7,
    '60390': 7,
    '60150': 7,
    '60140': 7
  };

  // Calculate totals for each account code
  ACCOUNT_CODES.forEach((account) => {
    const balanceRowIndex = rowIndexMap[account.code];

    // Initialize totals
    let totalOpening = 0;
    let totalRateChanged = 0;
    let totalAdjOpening = 0;
    let totalMovement = 0;
    let totalClosing = 0;

    // Sum values from each lease
    leaseBalanceSummaries.forEach(summary => {
      // For expense accounts (60270, 60390, 60150, 60140), only include leases
      // whose expense code matches this account code
      if (EXPENSE_ACCOUNT_CODES.includes(account.code)) {
        if (summary.expenseCode !== account.code) {
          return;
        }
      }

      const balanceRow = summary.balanceRows[balanceRowIndex];
      if (balanceRow) {
        const opening = typeof balanceRow[2] === 'number' ? balanceRow[2] : 0;
        const rateChanged = typeof balanceRow[3] === 'number' ? balanceRow[3] : 0;
        const adjOpening = typeof balanceRow[4] === 'number' ? balanceRow[4] : 0;
        const movement = typeof balanceRow[5] === 'number' ? balanceRow[5] : 0;
        const closing = typeof balanceRow[6] === 'number' ? balanceRow[6] : 0;

        totalOpening += opening;
        totalRateChanged += rateChanged;
        totalAdjOpening += adjOpening;
        totalMovement += movement;
        totalClosing += closing;
      }
    });

    // Store totals for this account
    accountTotals[account.code] = {
      opening: totalOpening,
      rateChanged: totalRateChanged,
      adjOpening: totalAdjOpening,
      movement: totalMovement,
      closing: totalClosing
    };
  });

  // Build the data array with only the final totals journal
  const data: any[][] = [];

  // Add header row
  data.push([
    '',
    '',
    `Audited Opening Balance 31/12/${lastYear}`,
    'Rent/Interest Rate Changed',
    `Adj. Opening Balance 31/12/${lastYear}`,
    `Movement FY ${thisYear}`,
    `Closing Balance ${closingDateStr}`
  ]);

  // Add data rows for each account code
  ACCOUNT_CODES.forEach((account) => {
    const totals = accountTotals[account.code];
    data.push([
      account.code,
      account.name,
      totals.opening,
      totals.rateChanged,
      totals.adjOpening,
      totals.movement,
      totals.closing
    ]);
  });

  // Calculate sum totals for Lease Payments Due across all leases
  const leasePaymentsDueTotals: { period: string; leasePayments: number; interest: number; npv: number }[] = [];

  // Initialize totals for each period (including Total row)
  const periodNames = ['< 1 Year', '1-2 Years', '2-3 Years', '3-4 Years', '4-5 Years', '> 5 Years', 'Total'];
  periodNames.forEach(period => {
    leasePaymentsDueTotals.push({ period, leasePayments: 0, interest: 0, npv: 0 });
  });

  // Sum up lease payments due from all leases
  leaseBalanceSummaries.forEach(summary => {
    summary.leasePaymentsDueRows.forEach((row, index) => {
      if (index < leasePaymentsDueTotals.length) {
        leasePaymentsDueTotals[index].leasePayments += row.leasePayments;
        leasePaymentsDueTotals[index].interest += row.interest;
        leasePaymentsDueTotals[index].npv += row.npv;
      }
    });
  });

  // Add empty rows before Lease Payments Due section
  data.push([]);
  data.push([]);

  // Add Lease Payments Due header
  data.push(['', 'Lease Payments Due (All Leases)', '', 'Lease Payments', 'Interest', 'NPV']);

  // Add Lease Payments Due rows
  leasePaymentsDueTotals.forEach(row => {
    data.push([
      '',
      row.period,
      '',
      row.leasePayments,
      row.interest,
      row.npv
    ]);
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Apply number format to all numeric cells
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = 2; col <= 6; col++) {
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
    { wch: 25 }  // Closing Balance column G
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
