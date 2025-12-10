import * as XLSX from 'xlsx';

export const formatPVWorksheet = (
  worksheet: XLSX.WorkSheet,
  cashFlowRowCount: number,
  assetRowCount: number,
  liabilityRowCount: number,
  journalRowCount: number,
  balanceSummaryRowCount: number = 8
) => {
  // Set column widths
  worksheet['!cols'] = [
    { wch: 40 },  // Column A (Property Address / Payment Date)
    { wch: 15 },  // Column B (PV Value / Base Rent)
    { wch: 10 },  // Column C (Other)
    { wch: 10 },  // Column D (Parking)
    { wch: 15 },  // Column E (Total Cash Flows)
    { wch: 17 },  // Column F (Lease Component)
    { wch: 6 },   // Column G (Separator)
    { wch: 16 },  // Column H (Date)
    { wch: 10 },  // Column I (Period)
    { wch: 17 },  // Column J (Asset - Beginning)
    { wch: 15 },  // Column K (Depreciation)
    { wch: 17 },  // Column L (Asset - Ending)
    { wch: 6 },   // Column M (Separator)
    { wch: 12 },  // Column N (Period)
    { wch: 17 },  // Column O (Liability - Beginning)
    { wch: 15 },  // Column P (Payment)
    { wch: 17 },  // Column Q (Interest Expense)
    { wch: 17 },  // Column R (Liability - Ending)
    { wch: 20 },  // Column S (Separator)
    { wch: 27 },  // Column T (Summary labels / Journal col1)
    { wch: 30 },  // Column U (Summary values / Journal col2)
    { wch: 15 },  // Column V (Journal col3)
    { wch: 20 },  // Column W
    { wch: 20 },  // Column X
    { wch: 20 }  // Column Y
  ];

  // Format Present Value in header (row 1, column B - cell B2)
  const pvCell = XLSX.utils.encode_cell({ r: 1, c: 1 });
  if (worksheet[pvCell] && typeof worksheet[pvCell].v === 'number') {
    worksheet[pvCell].z = '#,##0.00';
  }

  const dataStartRow = 9;

  // Format dates in column A (Payment Date)
  for (let row = dataStartRow; row < dataStartRow + cashFlowRowCount; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].z = 'dd/mm/yyyy';
    }
  }

  // Format currency columns in Cash Flows table (Base Rent, Total Cash Flows, Lease Component)
  const cashFlowCurrencyColumns = [1, 4, 5]; // B, E, F
  for (let row = dataStartRow; row < dataStartRow + cashFlowRowCount; row++) {
    cashFlowCurrencyColumns.forEach(col => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '#,##0.00';
      }
    });
  }

  // Format currency columns in Right of Use Asset table
  const assetCurrencyColumns = [9, 10, 11]; // J, K, L
  for (let row = dataStartRow; row < dataStartRow + assetRowCount; row++) {
    assetCurrencyColumns.forEach(col => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '#,##0.00';
      }
    });
  }

  // Format currency columns in Lease Liability table
  const liabilityCurrencyColumns = [14, 15, 16, 17]; // O, P, Q, R
  for (let row = dataStartRow; row < dataStartRow + liabilityRowCount; row++) {
    liabilityCurrencyColumns.forEach(col => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '#,##0.00';
      }
    });
  }

  // Format currency in summary tables (columns U and V)
  const summaryCurrencyRows = [9, 10, 11, 13, 15, 16, 17]; // Rows with numeric values
  summaryCurrencyRows.forEach(row => {
    const cellAddressU = XLSX.utils.encode_cell({ r: row, c: 20 }); // Column U
    if (worksheet[cellAddressU] && typeof worksheet[cellAddressU].v === 'number') {
      worksheet[cellAddressU].z = '#,##0.00';
    }
    const cellAddressV = XLSX.utils.encode_cell({ r: row, c: 21 }); // Column V
    if (worksheet[cellAddressV] && typeof worksheet[cellAddressV].v === 'number') {
      worksheet[cellAddressV].z = '#,##0.00';
    }
  });

  // Format PV Interest Accretion value
  const pvInterestCell = XLSX.utils.encode_cell({ r: 13, c: 19 }); // Column T, row with PV Interest
  if (worksheet[pvInterestCell] && typeof worksheet[pvInterestCell].v === 'number') {
    worksheet[pvInterestCell].z = '#,##0.00';
  }

  // Format currency in Lease Payments Due table
  // Starting from row 24 (row index 23) for data rows
  const leasePaymentsDueStartRow = 24;
  for (let row = leasePaymentsDueStartRow; row < leasePaymentsDueStartRow + 7; row++) {
    // Columns U, V, W (Lease Payments, Interest, NPV)
    [20, 21, 22].forEach(col => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '#,##0.00';
      }
    });
  }

  // Format currency in Journal table (column V - col3)
  // Journal starts after main tables + 3 rows (2 spacing + 1 title)
  const journalStartRow = dataStartRow + Math.max(cashFlowRowCount, assetRowCount, liabilityRowCount) + 3;

  for (let i = 0; i < journalRowCount; i++) {
    const row = journalStartRow + i;
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 21 }); // Column V (col3)
    if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
      worksheet[cellAddress].z = '#,##0.00';
    }
  }

  // Format currency in Balance Summary table (columns V, W, X - Opening Balance, Movement, Closing Balance)
  // Balance summary starts after journal + 1 empty row
  const balanceSummaryStartRow = journalStartRow + journalRowCount - 1;

  // Skip header row (row 0), format data rows (rows 1-7)
  for (let i = 1; i < balanceSummaryRowCount; i++) {
    const row = balanceSummaryStartRow + i;
    // Columns V, W, X (Opening Balance, Movement, Closing Balance)
    [21, 22, 23].forEach(col => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '#,##0.00';
      }
    });
  }
};