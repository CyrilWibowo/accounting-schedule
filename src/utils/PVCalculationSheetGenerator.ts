import * as XLSX from 'xlsx';
import { PropertyLease } from '../types/Lease';
import { generatePaymentRows } from './leasePaymentsSheetGenerator';
import { XLSXGenerationParams } from '../components/ToXLSXModal';
import { formatDateToDate } from './helper';
import {
  calculatePresentValue,
  generateCashFlowsOfFutureLeasePayment,
  generateRightOfUseAsset,
  generateLeaseLiability,
  calculateLeaseLiabilitySummary,
  calculatePVInterestAccretion,
  calculateLeasePaymentsDue,
  generateJournalTable,
  generateBalanceSummaryTable,
  getNextYearEnd
} from './pvCalculationHelpers';
import { formatPVWorksheet } from './pvWorksheetFormatter';

export const generatePVCalculation = (lease: PropertyLease, params: XLSXGenerationParams, isPropertyLease: boolean): XLSX.WorkSheet => {
  // Get all payment rows from the lease payments logic
  const allPaymentRows = generatePaymentRows(lease);

  // Filter payment rows based on opening and closing dates
  const openingDate = new Date(params.leaseLiabilityOpening);
  const closingDate = new Date(params.leaseLiabilityClosing);

  // Constants from params
  const ALLOCATION_TO_LEASE_COMPONENT = params.allocationToLeaseComponent;
  const OTHER = 0;
  const PARKING = 0;
  const PAYMENT_TIMING = params.paymentTiming;

  // Get first date for the header
  const firstDate = allPaymentRows[0]?.paymentDate;
  const formattedFirstDate = firstDate ? formatDateToDate(firstDate) : '';

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

  // Calculate lease liability summaries
  const openingSummary = calculateLeaseLiabilitySummary(
    leaseLiabilityRows,
    allPaymentRows,
    openingDate,
    closingDate
  );

  const closingSummary = calculateLeaseLiabilitySummary(
    leaseLiabilityRows,
    allPaymentRows,
    closingDate,
    getNextYearEnd(closingDate)
  );

  const pvInterestAccretion = calculatePVInterestAccretion(
    leaseLiabilityRows,
    allPaymentRows,
    openingDate
  );

  // Calculate lease payments due table
  const leasePaymentsDueRows = calculateLeasePaymentsDue(
    leaseLiabilityRows,
    allPaymentRows,
    closingDate
  );

  // Generate journal table
  const expiryDate = new Date(lease.expiryDate);
  const openingBalanceLeaseLiabilityNonCurrent = typeof params.openingBalance.leaseLiabilityNonCurrent === 'number'
    ? params.openingBalance.leaseLiabilityNonCurrent
    : 0;
  const openingBalanceLeaseLiabilityCurrent = typeof params.openingBalance.leaseLiabilityCurrent === 'number'
    ? params.openingBalance.leaseLiabilityCurrent
    : 0;
  const openingBalanceAccDeprRightToUseAssets = typeof params.openingBalance.accDeprRightToUseAssets === 'number'
    ? params.openingBalance.accDeprRightToUseAssets
    : 0;
  const openingBalanceInterestExpenseRent = typeof params.openingBalance.interestExpenseRent === 'number'
    ? params.openingBalance.interestExpenseRent
    : 0;
  const journalRows = generateJournalTable(
    presentValue,
    leaseLiabilityRows,
    rightOfUseAssetRows,
    allPaymentRows,
    openingDate,
    closingDate,
    expiryDate,
    openingBalanceLeaseLiabilityNonCurrent,
    openingBalanceLeaseLiabilityCurrent,
    openingBalanceAccDeprRightToUseAssets,
    openingBalanceInterestExpenseRent
  );

  // Build the data array with header
  const data: any[][] = [
    [lease.propertyAddress],
    [`Present Value at ${formattedFirstDate}:`, presentValue],
    ['Rate:', `${lease.borrowingRate}%`],
    ['Payments made at beginning or end of period:', PAYMENT_TIMING],
    ['Allocation to Lease Component:', ALLOCATION_TO_LEASE_COMPONENT],
    [],
    ['Cash Flows of Future Lease Payment', '', '', '', '', '', '', 'Right of Use Asset', '', '', '', '', '', 'Lease Liability', '', '', '', '', '', '', ''],
    [],
    ['Payment Date', 'Base Rent', 'Other', 'Parking', 'Total Cash Flows', 'Lease Component', '', 'Date', 'Period', 'Asset - Beginning', 'Depreciation', 'Asset - Ending', '', 'Period', 'Liability - Beginning', 'Payment', 'Interest Expense', 'Liability - Ending', '', '', '']
  ];

  // Add data rows (all tables side by side)
  const maxRows = Math.max(cashFlowRows.length, rightOfUseAssetRows.length, leaseLiabilityRows.length);

  for (let i = 0; i < maxRows; i++) {
    const row: any[] = [];

    // Cash flow columns
    if (i < cashFlowRows.length) {
      const cf = cashFlowRows[i];
      row.push(cf.paymentDate, cf.baseRent, cf.other, cf.parking, cf.totalCashFlows, cf.leaseComponent);
    } else {
      row.push('', '', '', '', '', '');
    }

    // Empty column separator
    row.push('');

    // Right of use asset columns
    if (i < rightOfUseAssetRows.length) {
      const rua = rightOfUseAssetRows[i];
      row.push(rua.date, rua.period, rua.assetBeginning, rua.depreciation, rua.assetEnding);
    } else {
      row.push('', '', '', '', '');
    }

    // Empty column separator
    row.push('');

    // Lease liability columns
    if (i < leaseLiabilityRows.length) {
      const ll = leaseLiabilityRows[i];
      row.push(ll.period, ll.liabilityBeginning, ll.payment, ll.interestExpense, ll.liabilityEnding);
    } else {
      row.push('', '', '', '', '');
    }

    // Empty column separator
    row.push('');


    // Add opening summary table (first 3 rows)
    if (i === 0) {
      row.push('', 'short-term', openingSummary.shortTerm);
    } else if (i === 1) {
      row.push('', 'long-term', openingSummary.longTerm);
    } else if (i === 2) {
      row.push('Total Lease Liability at', formatDateToDate(openingDate), openingSummary.total);
    } else if (i === 3) {
      row.push('');
    } else if (i === 4) {
      row.push(`PV Interest Accretion:`, pvInterestAccretion, '');
    } else if (i === 5) {
      row.push('');
    } else if (i === 6) {
      // Start closing summary table
      row.push('', 'short-term', closingSummary.shortTerm);
    } else if (i === 7) {
      row.push('', 'long-term', closingSummary.longTerm);
    } else if (i === 8) {
      row.push('Total Lease Liability at', formatDateToDate(closingDate), closingSummary.total);
    } else if (i === 9) {
      row.push('', '', '');
    } else if (i === 10) {
      row.push('', '', '');
    } else if (i === 11) {
      // Start lease payments due table
      row.push(`Lease Payments Due ${formatDateToDate(closingDate)}`, '', '');
    } else if (i === 12) {
      row.push('', '', '');
    } else if (i === 13) {
      // Header row for lease payments due
      row.push('', 'Lease Payments', 'Interest', 'NPV');
    } else if (i === 14) {
      row.push('', '', '', '');
    } else if (i >= 15 && i < 15 + leasePaymentsDueRows.length) {
      // Data rows for lease payments due
      const dueRow = leasePaymentsDueRows[i - 15];
      row.push(dueRow.period, dueRow.leasePayments, dueRow.interest, dueRow.npv);
    } else {
      row.push('', '', '', '');
    }

    data.push(row);
  }

  // Add spacing after the main tables and before journal table

  // Add JOURNAL title
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'JOURNAL:', '', '']);

  // Add journal table (15 rows x 3 columns starting at column T)
  journalRows.forEach(journalRow => {
    // Empty cells up to column T (19 empty columns A-S)
    const row = Array(19).fill('');
    // Add journal data in columns T, U, V
    row.push(journalRow.col1, journalRow.col2, journalRow.col3);
    data.push(row);
  });

  // Generate balance summary table (8 rows x 4 columns)
  const openingBalanceRightToUseAssets = typeof params.openingBalance.rightToUseAssets === 'number'
    ? params.openingBalance.rightToUseAssets
    : 0;
  const openingBalanceDepreciationExpense = typeof params.openingBalance.depreciationExpense === 'number'
    ? params.openingBalance.depreciationExpense
    : 0;
  const openingBalanceRentExpense = typeof params.openingBalance.rentExpense === 'number'
    ? params.openingBalance.rentExpense
    : 0;

  const balanceSummaryRows = generateBalanceSummaryTable({
    presentValue,
    openingDate,
    closingDate,
    expiryDate,
    openingBalances: {
      rightToUseAssets: openingBalanceRightToUseAssets,
      accDeprRightToUseAssets: openingBalanceAccDeprRightToUseAssets,
      leaseLiabilityCurrent: openingBalanceLeaseLiabilityCurrent,
      leaseLiabilityNonCurrent: openingBalanceLeaseLiabilityNonCurrent,
      depreciationExpense: openingBalanceDepreciationExpense,
      interestExpenseRent: openingBalanceInterestExpenseRent,
      rentExpense: openingBalanceRentExpense
    },
    journalRows,
    isExtension: params.isExtension
    },
    isPropertyLease
  );

  // Add empty row before balance summary table
  data.push([]);

  // Add balance summary table (8 rows x 5 columns starting at column T)
  balanceSummaryRows.forEach(summaryRow => {
    // Empty cells up to column T (19 empty columns A-S)
    const row = Array(19).fill('');
    // Add balance summary data in columns T, U, V, W, X
    row.push(summaryRow[0], summaryRow[1], summaryRow[2], summaryRow[3], summaryRow[4]);
    data.push(row);
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Format the worksheet
  formatPVWorksheet(worksheet, cashFlowRows.length, rightOfUseAssetRows.length, leaseLiabilityRows.length, journalRows.length, balanceSummaryRows.length);

  return worksheet;
};