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
    'WDV', '',
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
    `As at 31 Dec ${prevYear}`,
    `As at 31 Dec ${year}`,
  ];

  // Calculates monthly depreciation for each month of the year
  // cost: full historical cost (used for monthly charge = cost * depRate / 12)
  // startingWDV: WDV at 31 Dec prior year (for existing assets); for new assets, wdv begins at 0 and becomes cost at acquisition month
  const calcMonthlyDep = (
    cost: number,
    depRate: number,
    isNew: boolean,
    acquisitionMonth: number, // 1–12
    startingWDV?: number,
  ): number[] => {
    const monthlyCharge = (cost * depRate) / 12;
    const deps: number[] = [];
    let wdv = isNew ? 0 : (startingWDV ?? cost);
    for (let m = 1; m <= 12; m++) {
      if (isNew && m < acquisitionMonth) {
        deps.push(0);
      } else {
        if (isNew && m === acquisitionMonth) wdv = cost;
        const dep = Math.min(monthlyCharge, wdv);
        deps.push(dep);
        wdv -= dep;
      }
    }
    return deps;
  };

  // Rows 6+: asset data
  const dataRows: any[][] = assets.map(asset => {
    const cost = parseFloat(asset.cost) || 0;
    const rawRate = parseFloat(asset.depreciationRate) || 0;
    const depRate = rawRate > 1 ? rawRate / 100 : rawRate; // handle "20" vs "0.20"

    const matchingOB = (asset.openingBalances || []).find(ob => ob.date === prevYearDateStr);

    let costOB: number | string;
    let addition: number | string;
    let costClosing: number | string;
    let depOB: number | string;
    let wdvPrevYear: number | string;
    let monthlyDeps: number[];
    let currentPeriod: number | string;
    let depClosing: number | string;
    let wdvYear: number | string;

    if (matchingOB) {
      const isNew = matchingOB.type === 'New';

      if (!isNew) {
        costOB = cost;
        addition = 0;
        depOB = parseFloat(matchingOB.value) || 0;
      } else {
        costOB = 0;
        addition = cost;
        depOB = 0;
      }

      costClosing = (costOB as number) + (addition as number);
      wdvPrevYear = (costOB as number) - (depOB as number);

      // For existing assets, WDV at start of year = cost - depOB; adjust the calc
      let acquisitionMonth = 1;
      if (isNew && asset.acquisitionDate) {
        const parts = asset.acquisitionDate.split('-');
        const acqYear = parseInt(parts[0], 10);
        const acqMonth = parseInt(parts[1], 10);
        // If acquired in a previous year, treat as fully existing from Jan
        acquisitionMonth = acqYear >= year ? acqMonth : 1;
      }

      monthlyDeps = calcMonthlyDep(cost, depRate, isNew, acquisitionMonth, isNew ? undefined : (wdvPrevYear as number));

      currentPeriod = monthlyDeps.reduce((sum, d) => sum + d, 0);
      const writtenBack = 0; // no disposal data
      depClosing = (depOB as number) + currentPeriod + writtenBack;
      wdvYear = (costClosing as number) - (depClosing as number);
    } else {
      costOB = 'N/A';
      addition = 'N/A';
      costClosing = 'N/A';
      depOB = 'N/A';
      wdvPrevYear = 'N/A';
      monthlyDeps = Array(12).fill('');
      currentPeriod = 'N/A';
      depClosing = 'N/A';
      wdvYear = 'N/A';
    }

    return [
      asset.id,
      asset.description,
      asset.category,
      asset.branch,
      asset.acquisitionDate,
      '',              // Transferred from Rimtec
      cost,            // Historical Cost
      '',              // Gain/Loss
      costOB,          // Cost: Opening Balance
      addition,        // Cost: Addition
      '',              // Cost: Disposal
      '',              // Cost: Transfer Completed Assets
      costClosing,     // Cost: Closing Balance
      depOB,           // Dep: Opening Balance
      currentPeriod,   // Dep: Current Period
      ...monthlyDeps,  // Jan–Dec
      0,               // Dep: Written-Back on Disposal
      depClosing,      // Dep: Closing Balance
      wdvPrevYear,     // WDV: As at 31 Dec {prevYear}
      wdvYear,         // WDV: As at 31 Dec {year}
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
    // "WDV" spans cols 29–30 on row 4
    { s: { r: 4, c: 29 }, e: { r: 4, c: 30 } },
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
    { wch: 18 }, // WDV: As at prevYear
    { wch: 18 }, // WDV: As at year
  ];

  // Number format for numeric data cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  // Historical Cost, Cost OB/Addition/Closing, Dep OB, Current Period, Jan–Dec, Written-Back, Dep Closing, WDV prev/year
  const numericCols = [6, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
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
