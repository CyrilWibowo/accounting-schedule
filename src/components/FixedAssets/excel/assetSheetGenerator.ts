import * as XLSX from 'xlsx';
import { Asset } from '../../../types/Asset';

const CATEGORY_LABEL: Record<string, string> = {
  'Office Equipment': 'OFFICE EQUIPMENT',
  'Motor Vehicle': 'MOTOR VEHICLES',
  'Warehouse Equipment': 'WAREHOUSE EQUIPMENT',
  'Manufacturing Equipment': 'MANUFACTURING EQUIPMENT',
  'Equipment for Leased': 'EQUIPMENT FOR LEASED',
  'Software': 'SOFTWARE',
};

export const generateCategorySheet = (
  assets: Asset[],
  category: string,
  entityName: string,
  year: number
): XLSX.WorkSheet => {
  const prevYear = year - 1;
  const prevYearDateStr = `${prevYear}-12-31`;
  const categoryLabel = CATEGORY_LABEL[category] || category.toUpperCase();

  // Rows 0-3: title block
  const titleRows: any[][] = [
    [entityName],
    [`FIXED ASSETS REGISTER - ${categoryLabel}`],
    [`AS AT 31 DECEMBER ${year}`],
    [],
  ];

  // Row 4: section header row
  const sectionHeaderRow: any[] = [
    'Asset ID', 'Asset Name', 'Asset Category', 'Location',
    'Acquisition/Completion Date', 'Transferred from Rimtec',
    'Historical Cost', 'Gain/Loss',
    'Cost', '', '', '', '',
    'Depreciation', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'WDV',
  ];

  // Row 5: column name row
  const columnHeaderRow: any[] = [
    '', '', '', '', '', '', '', '',
    `Opening Balance 31 Dec ${prevYear}`,
    'Addition',
    'Disposal',
    'Transfer Completed Assets',
    `Closing Balance 31 Dec ${year}`,
    `Opening Balance 31 Dec ${prevYear}`,
    'Current Period',
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
    'Written-Back on Disposal',
    `Closing Balance 31 Dec ${year}`,
    `As at 31 Dec ${year}`,
  ];

  // Rows 6+: asset data
  const dataRows: any[][] = assets.map(asset => {
    const cost = parseFloat(asset.cost) || 0;

    const matchingOB = (asset.openingBalances || []).find(ob => ob.date === prevYearDateStr);

    let openingBalance = 0;
    let addition = 0;

    if (matchingOB) {
      if (matchingOB.type === 'Existing') {
        openingBalance = parseFloat(matchingOB.value) || 0;
        addition = 0;
      } else {
        openingBalance = 0;
        addition = cost;
      }
    }

    const closingBalance = openingBalance + addition;

    return [
      asset.id,
      asset.description,
      asset.category,
      asset.branch,
      asset.acquisitionDate,
      '',              // Transferred from Rimtec
      cost,            // Historical Cost
      '',              // Gain/Loss
      openingBalance,
      addition,
      '',              // Disposal
      '',              // Transfer Completed Assets
      closingBalance,
      '',              // Dep: Opening Balance
      '',              // Dep: Current Period
      '', '', '', '', '', '', '', '', '', '', '', '', // Jan–Dec
      '',              // Dep: Written-Back on Disposal
      '',              // Dep: Closing Balance
      '',              // WDV: As at
    ];
  });

  const allRows = [...titleRows, sectionHeaderRow, columnHeaderRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Merges
  ws['!merges'] = [
    // Vertical merges for the 8 fixed columns (rows 4–5)
    ...Array.from({ length: 8 }, (_, c) => ({ s: { r: 4, c }, e: { r: 5, c } })),
    // "Cost" spans cols 8–12 on row 4
    { s: { r: 4, c: 8 }, e: { r: 4, c: 12 } },
    // "Depreciation" spans cols 13–28 on row 4
    { s: { r: 4, c: 13 }, e: { r: 4, c: 28 } },
    // "WDV" spans rows 4–5 on col 29
    { s: { r: 4, c: 29 }, e: { r: 5, c: 29 } },
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Asset ID
    { wch: 30 }, // Asset Name
    { wch: 22 }, // Asset Category
    { wch: 10 }, // Location
    { wch: 22 }, // Acquisition Date
    { wch: 22 }, // Transferred from Rimtec
    { wch: 16 }, // Historical Cost
    { wch: 12 }, // Gain/Loss
    { wch: 26 }, // Cost: OB
    { wch: 14 }, // Addition
    { wch: 12 }, // Disposal
    { wch: 26 }, // Transfer
    { wch: 26 }, // Cost: Closing Balance
    { wch: 26 }, // Dep: OB
    { wch: 16 }, // Current Period
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, // Jan–Apr
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, // May–Aug
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Sep–Dec
    { wch: 26 }, // Written-Back
    { wch: 26 }, // Dep: Closing Balance
    { wch: 18 }, // WDV
  ];

  // Number format for numeric data cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const numericCols = [6, 8, 9, 12]; // Historical Cost, OB, Addition, Closing Balance
  for (let r = 6; r <= range.e.r; r++) {
    for (const c of numericCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
  }

  return ws;
};
