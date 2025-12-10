import { PaymentRow } from './excelHelper';
import { normalizeDate } from './helper';

export interface CashFlowRow {
  paymentDate: Date;
  baseRent: number;
  other: string;
  parking: string;
  totalCashFlows: number;
  leaseComponent: number;
}

export interface RightOfUseAssetRow {
  date: string;
  period: number;
  assetBeginning: number;
  depreciation: number;
  assetEnding: number;
}

export interface LeaseLiabilityRow {
  period: string;
  liabilityBeginning: number;
  payment: number;
  interestExpense: number;
  liabilityEnding: number;
}

export interface LeaseLiabilitySummary {
  shortTerm: number;
  longTerm: number;
  total: number;
}

export interface LeasePaymentsDueRow {
  period: string;
  leasePayments: number;
  interest: number;
  npv: number;
}

export interface JournalRow {
  col1: string;
  col2: string;
  col3: number | string;
}

export interface BalanceSummaryRow {
  accountCode: string;
  openingBalance: number;
  movement: number;
  closingBalance: number;
}

export const calculatePresentValue = (
  cashFlows: number[],
  monthlyRate: number,
  paymentTiming: string
): number => {
  let npv = 0;

  if (paymentTiming === 'Beginning') {
    // First payment is at time 0 (not discounted)
    npv = cashFlows[0];
    // Remaining payments discounted from period 1 onwards
    for (let i = 1; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + monthlyRate, i);
    }
  } else {
    // All payments discounted from period 1 onwards
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + monthlyRate, i + 1);
    }
  }

  return Math.round(npv * 100) / 100;
};

export const generateCashFlowsOfFutureLeasePayment = (
  filteredRows: PaymentRow[],
  other: number,
  parking: number,
  allocationToLeaseComponent: number
): CashFlowRow[] => {
  return filteredRows.map(row => {
    const baseRent = row.amount;
    const totalCashFlows = baseRent + other + parking;
    const leaseComponent = totalCashFlows * allocationToLeaseComponent;

    return {
      paymentDate: new Date(row.paymentDate),
      baseRent,
      other: '-',
      parking: '-',
      totalCashFlows,
      leaseComponent
    };
  });
};

export const generateRightOfUseAsset = (
  filteredRows: PaymentRow[],
  presentValue: number,
  cashFlowRows: CashFlowRow[]
): RightOfUseAssetRow[] => {
  const rows: RightOfUseAssetRow[] = [];

  // Count non-zero base rent rows for depreciation calculation
  const nonZeroBaseRentCount = cashFlowRows.filter(cf => cf.baseRent > 0).length;

  let previousDepreciation = 0;

  filteredRows.forEach((row, index) => {
    const period = index + 1;

    // Asset Beginning: first row is present value, subsequent rows are previous asset ending
    const assetBeginning = index === 0
      ? presentValue
      : rows[index - 1].assetEnding;

    // Calculate Depreciation (negative value)
    let depreciation: number;
    if (index === 0) {
      // First row: -J10/COUNTIF($B$10:$B$179,">0")
      depreciation = (-assetBeginning / nonZeroBaseRentCount);
    } else {
      // Subsequent rows: IF(I11>=COUNTIF($B$10:$B$179,">0"),-L10,$K$10)
      if (period >= nonZeroBaseRentCount) {
        depreciation = (-rows[index - 1].assetEnding);
      } else {
        depreciation = previousDepreciation;
      }
    }

    previousDepreciation = depreciation;

    // Asset Ending: Asset Beginning + Depreciation (depreciation is negative)
    const assetEnding = assetBeginning + depreciation;

    rows.push({
      date: formatDateShort(row.paymentDate),
      period,
      assetBeginning,
      depreciation,
      assetEnding
    });
  });

  return rows;
};

export const generateLeaseLiability = (
  filteredRows: PaymentRow[],
  presentValue: number,
  cashFlowRows: CashFlowRow[],
  borrowingRate: number,
  paymentTiming: string
): LeaseLiabilityRow[] => {
  const rows: LeaseLiabilityRow[] = [];

  filteredRows.forEach((row, index) => {
    const period = formatDateShort(row.paymentDate);

    // Liability Beginning: first row is present value, subsequent rows are previous liability ending
    const liabilityBeginning = index === 0
      ? presentValue
      : rows[index - 1].liabilityEnding;

    // Payment: Total Cash Flows from corresponding row (negative value)
    const payment = (-cashFlowRows[index].totalCashFlows);

    // Interest Expense: IF($F$4="Beginning",SUM(O10:P10)*$F$3/12,O10*$F$3/12)
    let interestExpense: number;
    if (paymentTiming === 'Beginning') {
      interestExpense = (liabilityBeginning + payment) * borrowingRate / 12;
    } else {
      interestExpense = (liabilityBeginning * borrowingRate) / 12;
    }

    // Liability Ending: Liability Beginning + Payment + Interest Expense (payment is negative)
    const liabilityEnding = liabilityBeginning + payment + interestExpense;

    rows.push({
      period,
      liabilityBeginning,
      payment,
      interestExpense,
      liabilityEnding
    });
  });

  return rows;
};

export const calculateLeaseLiabilitySummary = (
  leaseLiabilityRows: LeaseLiabilityRow[],
  allPaymentRows: PaymentRow[],
  startDate: Date,
  endDate: Date
): LeaseLiabilitySummary => {
  let shortTerm = 0;
  let longTerm = 0;

  // Filter rows within the date range
  const filteredIndices = allPaymentRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      const normalizedStart = normalizeDate(startDate);
      const normalizedEnd = normalizeDate(endDate);

      return paymentDate >= normalizedStart && paymentDate <= normalizedEnd;
    });

  // Calculate short-term: sum of payment + interest expense for the period
  filteredIndices.forEach(({ index }) => {
    const liability = leaseLiabilityRows[index];
    if (liability) {
      shortTerm += liability.payment + liability.interestExpense;
    }
  });
  shortTerm *= -1;

  // Calculate long-term: liability ending at the end date
  const endDateIndex = allPaymentRows.findIndex(row => {
    const paymentDate = new Date(row.paymentDate);
    return paymentDate.getMonth() === endDate.getMonth() &&
           paymentDate.getFullYear() === endDate.getFullYear();
  });

  if (endDateIndex !== -1 && leaseLiabilityRows[endDateIndex]) {
    longTerm = leaseLiabilityRows[endDateIndex].liabilityEnding;
  }

  return {
    shortTerm: (Math.round(shortTerm * 100) / 100),
    longTerm: Math.round(longTerm * 100) / 100,
    total: Math.round((shortTerm + longTerm) * 100) / 100
  };
};

export const calculatePVInterestAccretion = (
  leaseLiabilityRows: LeaseLiabilityRow[],
  allPaymentRows: PaymentRow[],
  startDate: Date
): number => {
  let total = 0;

  // Sum interest expense from startDate to end
  allPaymentRows.forEach((row, index) => {
    const paymentDate = normalizeDate(new Date(row.paymentDate));
    const normalizedStart = normalizeDate(startDate);
    if (paymentDate >= normalizedStart && leaseLiabilityRows[index]) {
      total += leaseLiabilityRows[index].interestExpense;
    }
  });

  return Math.round(total * 100) / 100;
};

export const calculateLeasePaymentsDue = (
  leaseLiabilityRows: LeaseLiabilityRow[],
  allPaymentRows: PaymentRow[],
  closingDate: Date
): LeasePaymentsDueRow[] => {
  const rows: LeasePaymentsDueRow[] = [];

  const closingYear = closingDate.getFullYear();

  // Define year ranges
  const yearRanges = [
    { period: '< 1 Year', startYear: closingYear + 1, endYear: closingYear + 1 },
    { period: '1-2 Years', startYear: closingYear + 2, endYear: closingYear + 2 },
    { period: '2-3 Years', startYear: closingYear + 3, endYear: closingYear + 3 },
    { period: '3-4 Years', startYear: closingYear + 4, endYear: closingYear + 4 },
    { period: '4-5 Years', startYear: closingYear + 5, endYear: closingYear + 5 },
    { period: '> 5 Years', startYear: closingYear + 6, endYear: Infinity }
  ];

  yearRanges.forEach(range => {
    let leasePayments = 0;
    let interest = 0;

    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      const paymentYear = paymentDate.getFullYear();

      if (paymentYear >= range.startYear && paymentYear <= range.endYear) {
        if (leaseLiabilityRows[index]) {
          // Payments are negative, so take absolute value
          leasePayments += Math.abs(leaseLiabilityRows[index].payment);
          interest += leaseLiabilityRows[index].interestExpense;
        }
      }
    });

    const npv = leasePayments - interest;

    rows.push({
      period: range.period,
      leasePayments: Math.round(leasePayments * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      npv: Math.round(npv * 100) / 100
    });
  });

  // Calculate totals
  const totalLeasePayments = rows.reduce((sum, row) => sum + row.leasePayments, 0);
  const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0);
  const totalNPV = rows.reduce((sum, row) => sum + row.npv, 0);

  rows.push({
    period: 'Total',
    leasePayments: Math.round(totalLeasePayments * 100) / 100,
    interest: Math.round(totalInterest * 100) / 100,
    npv: Math.round(totalNPV * 100) / 100
  });

  return rows;
};

export const generateJournalTable = (
  presentValue: number,
  leaseLiabilityRows: LeaseLiabilityRow[],
  rightOfUseAssetRows: RightOfUseAssetRow[],
  allPaymentRows: PaymentRow[],
  openingDate: Date,
  closingDate: Date,
  expiryDate: Date,
  openingBalanceLeaseLiabilityNonCurrent: number,
  openingBalanceLeaseLiabilityCurrent: number,
  openingBalanceAccDeprRightToUseAssets: number,
  openingBalanceInterestExpenseRent: number
): JournalRow[] => {
  const rows: JournalRow[] = [];

  const normalizedOpening = normalizeDate(openingDate);
  const normalizedClosing = normalizeDate(closingDate);
  const normalizedExpiry = normalizeDate(expiryDate);

  // Right to Use The Assets - Lease Liability - Current
  // Calculate row 4: sum of payments from the first two calendar years
  // e.g., if lease starts in May-22, sum all payments from 2022 and 2023 (up to Jan of 3rd year)
  let paymentsFirstTwoYears = 0;
  if (allPaymentRows.length > 0) {
    const firstPaymentDate = normalizeDate(new Date(allPaymentRows[0].paymentDate));
    const startYear = firstPaymentDate.getFullYear();
    // End of second year is Jan 1 of the third year (exclusive)
    const endOfSecondYear = new Date(startYear + 2, 0, 1); // Jan 1 of year+2

    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate < endOfSecondYear && leaseLiabilityRows[index]) {
        paymentsFirstTwoYears += leaseLiabilityRows[index].payment + leaseLiabilityRows[index].interestExpense;
      }
    });
  }

  // Right to Use The Assets - Lease Liability - Non Current
  // Calculate row 5: -(row3 + row4)
  const row5Value = -(presentValue + paymentsFirstTwoYears);

  // Lease Liability - Non Current
  // Calculate row 9: =IF(H129=0,0,IF($F$6>='Lease Payments'!$C$6,-$H$129,-SUM($P$10:$Q$17)))
  // If opening balance Lease Liability Non Current is 0, row9 = 0
  // Else if closing date >= expiry date, row9 = -openingBalanceLeaseLiabilityNonCurrent
  // Else row9 = -SUM(payment + interest expense) for the period after closing
  let row9Value: number;
  if (openingBalanceLeaseLiabilityNonCurrent === 0) {
    row9Value = 0;
  } else if (normalizedClosing >= normalizedExpiry) {
    row9Value = -openingBalanceLeaseLiabilityNonCurrent;
  } else {
    let openingToClosingSum = 0;
    allPaymentRows.forEach((row, index) => {
      const openingYear = normalizedOpening.getFullYear();
      const nextPeriodStart = normalizeDate(new Date(openingYear + 1, 0, 1));
      const nextPeriodEnd = normalizeDate(new Date(openingYear + 1, 11, 31));

      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate >= nextPeriodStart && paymentDate <= nextPeriodEnd && leaseLiabilityRows[index]) {
        openingToClosingSum += leaseLiabilityRows[index].payment + leaseLiabilityRows[index].interestExpense;
      }
    });
    row9Value = -openingToClosingSum;
  }

  // Lease Liability - Current
  // Calculate row 10: =IF($F$6>='Lease Payments'!$C$6,-$H$128,-SUM($P$42:$Q$53))
  // If closing date >= expiry date, row10 = -openingBalanceLeaseLiabilityCurrent
  // Else row10 = -SUM(payment + interest expense) for the period between opening and closing dates
  let row10Value: number;
  if (normalizedClosing >= normalizedExpiry) {
    row10Value = -openingBalanceLeaseLiabilityCurrent;
  } else {
    let openingToClosingTotal = 0;
    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate >= normalizedOpening && paymentDate <= normalizedClosing && leaseLiabilityRows[index]) {
        openingToClosingTotal += leaseLiabilityRows[index].payment + leaseLiabilityRows[index].interestExpense;
      }
    });
    row10Value = -openingToClosingTotal - row9Value;
  }

  // Deprication Expense
  // Calculate row 11: -Acc.Depr Right to Use the Assets
  let row11Value: number;

  // Interest Expense Rent
  // Calculate row 12: =IF($F$6>='Lease Payments'!$C$6,SUM($Q$10:$Q$53)-$H$131,SUM($Q$42:$Q$53))
  // If closing date >= expiry date: SUM(interest expense from beginning to closing) - openingBalanceInterestExpenseRent
  // Else: SUM(interest expense from opening to closing)
  let interestExpenseTotal: number;
  if (normalizedClosing >= normalizedExpiry) {
    // Sum interest expense from beginning to closing date
    let interestFromBeginningToClosing = 0;
    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate <= normalizedClosing && leaseLiabilityRows[index]) {
        interestFromBeginningToClosing += leaseLiabilityRows[index].interestExpense;
      }
    });
    interestExpenseTotal = interestFromBeginningToClosing - openingBalanceInterestExpenseRent;
  } else {
    interestExpenseTotal = 0;
    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate >= normalizedOpening && paymentDate <= normalizedClosing && leaseLiabilityRows[index]) {
        interestExpenseTotal += leaseLiabilityRows[index].interestExpense;
      }
    });
  }

  // Acc.Depr Right to Use the Assets
  // Calculate row 13: =-IF($F$6>='Lease Payments'!$C$6,-SUM($K$10:$K$53)+$H$127,SUM($K$42:$K$53))
  // If closing date >= expiry date: -(-SUM(depreciation from beginning to closing) + openingBalanceAccDeprRightToUseAssets)
  // Else: SUM(depreciation from opening to closing)
  let row13Value: number;
  if (normalizedClosing >= normalizedExpiry) {
    // Sum depreciation from beginning to closing date
    let depreciationFromBeginningToClosing = 0;
    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate <= normalizedClosing && rightOfUseAssetRows[index]) {
        depreciationFromBeginningToClosing += rightOfUseAssetRows[index].depreciation;
      }
    });
    row13Value = -(-depreciationFromBeginningToClosing + openingBalanceAccDeprRightToUseAssets);
  } else {
    let depreciationTotal = 0;
    allPaymentRows.forEach((row, index) => {
      const paymentDate = normalizeDate(new Date(row.paymentDate));
      if (paymentDate >= normalizedOpening && paymentDate <= normalizedClosing && rightOfUseAssetRows[index]) {
        depreciationTotal += rightOfUseAssetRows[index].depreciation;
      }
    });
    row13Value = -depreciationTotal;
  }
  row11Value = -row13Value;

  // Rent Expense
  // Calculate row 14: -sum of rows 9-13
  const row14Value = -(row9Value + row10Value + row11Value + interestExpenseTotal + row13Value);

  // Build the 15 rows
  rows.push({ col1: '', col2: '', col3: '' }); // Row 1
  rows.push({ col1: '', col2: '', col3: '' }); // Row 2
  rows.push({ col1: '164000', col2: 'Right to Use the Assets', col3: presentValue }); // Row 3
  rows.push({ col1: '22005', col2: '   Lease Liability - Current', col3: paymentsFirstTwoYears }); // Row 4
  rows.push({ col1: '22010', col2: '   Lease Liability - Non-Current', col3: row5Value }); // Row 5
  rows.push({ col1: '', col2: '', col3: '' }); // Row 6
  rows.push({ col1: '', col2: '', col3: '' }); // Row 7
  rows.push({ col1: '', col2: '', col3: '' }); // Row 8
  rows.push({ col1: '22010', col2: 'Lease Liability - Non-Current', col3: row9Value }); // Row 9
  rows.push({ col1: '22005', col2: 'Lease Liability - Current', col3: row10Value }); // Row 10
  rows.push({ col1: '60080', col2: 'Depreciation Expense', col3: row11Value }); // Row 11
  rows.push({ col1: '60275', col2: 'Interest Expense Rent', col3: interestExpenseTotal }); // Row 12
  rows.push({ col1: '16405', col2: '   Acc.Depr Right to Use Assets', col3: row13Value }); // Row 13
  rows.push({ col1: '60270', col2: '   Rent Expense', col3: row14Value }); // Row 14
  rows.push({ col1: '', col2: `(Journal at ${formatDateToDateShort(closingDate)})`, col3: '' }); // Row 15

  return rows;
};

export interface BalanceSummaryParams {
  presentValue: number;
  openingDate: Date;
  closingDate: Date;
  expiryDate: Date;
  openingBalances: {
    rightToUseAssets: number;
    accDeprRightToUseAssets: number;
    leaseLiabilityCurrent: number;
    leaseLiabilityNonCurrent: number;
    depreciationExpense: number;
    interestExpenseRent: number;
    rentExpense: number;
  };
  journalRows: JournalRow[];
  isExtension: boolean;
}

/**
 * Generates an 8x4 balance summary table with account codes, opening balances,
 * movements, and closing balances.
 *
 * The table structure:
 * - Row 0: Headers
 * - Row 1: 16400 Right to Use the Assets
 * - Row 2: 16405 Acc.Depr. Right to Use the Assets
 * - Row 3: 22005 Lease Liability - Current
 * - Row 4: 22010 Lease Liability - Non Current
 * - Row 5: 60080 Depreciation Expense
 * - Row 6: 60275 Interest Expense Rent
 * - Row 7: 60270 Rent Expense
 */
export const generateBalanceSummaryTable = (params: BalanceSummaryParams, isPropertyLease: boolean): (string | number)[][] => {
  const {
    presentValue,
    openingDate,
    closingDate,
    expiryDate,
    openingBalances,
    journalRows,
    isExtension
  } = params;

  const normalizedClosing = normalizeDate(closingDate);
  const normalizedExpiry = normalizeDate(expiryDate);

  // Format date strings for headers
  const lastYear = openingDate.getFullYear() - 1;
  const thisYear = closingDate.getFullYear();
  const closingDateStr = formatDateForBalanceSummary(closingDate);

  // Extract journal row values (0-indexed)
  // Journal row 9 = index 8: Lease Liability - Non-Current
  // Journal row 10 = index 9: Lease Liability - Current
  // Journal row 11 = index 10: Depreciation Expense
  // Journal row 12 = index 11: Interest Expense Rent
  // Journal row 13 = index 12: Acc.Depr Right to Use Assets
  const journalRow4Value = typeof journalRows[3]?.col3 === 'number' ? journalRows[3].col3 : 0;
  const journalRow5Value = typeof journalRows[4]?.col3 === 'number' ? journalRows[4].col3 : 0;
  const journalRow9Value = typeof journalRows[8]?.col3 === 'number' ? journalRows[8].col3 : 0;
  const journalRow10Value = typeof journalRows[9]?.col3 === 'number' ? journalRows[9].col3 : 0;
  const journalRow11Value = typeof journalRows[10]?.col3 === 'number' ? journalRows[10].col3 : 0;
  const journalRow12Value = typeof journalRows[11]?.col3 === 'number' ? journalRows[11].col3 : 0;
  const journalRow13Value = typeof journalRows[12]?.col3 === 'number' ? journalRows[12].col3 : 0;

  // Calculate Right to Use Assets movement
  // =IF(H126=0,$F$2,IF($F$6>='Lease Payments'!$C$6,$F$2-$H$126,0))
  // If opening balance right to use assets = 0, movement = presentValue
  // Else if closing date >= expiry date, movement = presentValue - opening balance
  // Else movement = 0
  let rightToUseAssetsMovement: number;
  if (openingBalances.rightToUseAssets === 0) {
    rightToUseAssetsMovement = presentValue;
  } else if (normalizedClosing >= normalizedExpiry) {
    rightToUseAssetsMovement = presentValue - openingBalances.rightToUseAssets;
  } else {
    rightToUseAssetsMovement = 0;
  }

  // Calculate Rent Expense movement: -(sum of opening balances in column 2)
  // This is the negative sum of all opening balances


  // Build the table rows
  const rows: (string | number)[][] = [];

  // Row 0: Header row
  rows.push([
    '',
    '',
    `Opening Balance 31/12/${lastYear}`,
    `Movement FY ${thisYear}`,
    `Closing Balance ${closingDateStr}`
  ]);

  // Row 1: 16400 Right to Use the Assets
  rows.push([
    '16400',
    'Right to Use the Assets',
    openingBalances.rightToUseAssets,
    rightToUseAssetsMovement,
    openingBalances.rightToUseAssets + rightToUseAssetsMovement
  ]);

  // Row 2: 16405 Acc.Depr. Right to Use the Assets
  // Movement = journal row 13 value
  rows.push([
    '16405',
    'Acc.Depr. Right to Use the Assets',
    openingBalances.accDeprRightToUseAssets,
    -journalRow13Value,
    openingBalances.accDeprRightToUseAssets - journalRow13Value
  ]);

  // Row 3: 22005 Lease Liability - Current
  // Movement = journal row 10 value
  const row3Movement = isExtension ? journalRow10Value + journalRow4Value : journalRow10Value;
  rows.push([
    '22005',
    'Lease Liability - Current',
    openingBalances.leaseLiabilityCurrent,
    row3Movement,
    openingBalances.leaseLiabilityCurrent + row3Movement
  ]);

  // Row 4: 22010 Lease Liability - Non Current
  // Movement = journal row 9 value
  const row4Movement = isExtension ? journalRow9Value + journalRow5Value : journalRow9Value;
  rows.push([
    '22010',
    'Lease Liability - Non Current',
    openingBalances.leaseLiabilityNonCurrent,
    row4Movement,
    openingBalances.leaseLiabilityNonCurrent + row4Movement
  ]);

  // Row 5: 60080 Depreciation Expense
  // Movement = journal row 11 value
  rows.push([
    '60080',
    'Depreciation Expense',
    openingBalances.depreciationExpense,
    -journalRow11Value,
    openingBalances.depreciationExpense - journalRow11Value
  ]);

  // Row 6: 60275 Interest Expense Rent
  // Movement = journal row 12 value
  rows.push([
    '60275',
    'Interest Expense Rent',
    openingBalances.interestExpenseRent,
    journalRow12Value,
    openingBalances.interestExpenseRent + journalRow12Value
  ]);

  const rentExpenseMovement = -(
    rightToUseAssetsMovement -
    journalRow13Value +
    row3Movement +
    row4Movement -
    journalRow11Value +
    journalRow12Value
  );

  // Row 7: 60270 Rent Expense
  // Movement = -(sum of opening balances column)
  rows.push([
    isPropertyLease ? '60270' : '60390',
    isPropertyLease ? 'Rent Expense' : 'Vehicle Expense',
    openingBalances.rentExpense,
    rentExpenseMovement,
    openingBalances.rentExpense + rentExpenseMovement
  ]);

  return rows;
};

const formatDateForBalanceSummary = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export const getNextYearEnd = (date: Date): Date => {
  const nextYear = new Date(date);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  nextYear.setMonth(11); // December
  nextYear.setDate(31);
  return nextYear;
};

export const formatDateShort = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${year}`;
};

const formatDateToDateShort = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};