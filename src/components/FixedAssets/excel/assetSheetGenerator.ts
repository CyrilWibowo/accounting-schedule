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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const generateCategorySheet = (
  assets: Asset[],
  category: string,
  entityName: string,
  year: number,
  month: number
): XLSX.WorkSheet => {
  const prevYear = year - 1;
  const prevYearDateStr = `${prevYear}-12-31`;
  const categoryLabel = CATEGORY_LABEL[category] || category.toUpperCase();
  const monthName = MONTH_NAMES[month - 1];
  const shortMonthName = SHORT_MONTH_NAMES[month - 1];
  const lastDay = new Date(year, month, 0).getDate();
  const asAtLabel = `${lastDay} ${shortMonthName} ${year}`;
  const reportDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Rows 0-3: title block
  const titleRows: any[][] = [
    [entityName],
    [`FIXED ASSETS REGISTER - ${categoryLabel}`],
    [`AS AT ${shortMonthName.toUpperCase()} ${year}`],
    [],
  ];

  // Months to show: January through the selected month
  const activeMonths = MONTH_NAMES.slice(0, month);

  // Column index offsets (depend only on month count)
  const writtenBackCol = 21 + month;
  const depClosingCol = 21 + month + 1;
  const wdvPrevCol = 21 + month + 2;
  const wdvCurrCol = 21 + month + 3;

  // Row 4: section header row
  const sectionHeaderRow: any[] = [
    'Asset ID', 'Asset Name', 'Asset Category', 'Location',
    'Acquisition/Completion Date', 'Transferred from Rimtec',
    'Historical Cost',
    'Method of Depreciation', 'Useful Life', 'Depreciation Rate',
    'Assets Disposal', 'Date of Disposal/Write Off', 'Proceed',
    'Gain/Loss',
    'Cost', '', '', '', '',
    'Depreciation', ...Array(2 + activeMonths.length).fill(''),
    'WDV', '',
  ];

  // Row 5: column name row
  const columnHeaderRow: any[] = [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    `Opening Balance 31 Dec ${prevYear}`,
    'Addition',
    'Disposal',
    'Transfer Completed Assets',
    `Closing Balance As at ${asAtLabel}`,
    `Opening Balance 31 Dec ${prevYear}`,
    'Current Period',
    ...activeMonths,
    'Written-Back on Disposal',
    `Closing Balance As at ${asAtLabel}`,
    `As at 31 Dec ${prevYear}`,
    `As at ${asAtLabel}`,
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
    disposalMonth?: number,   // 1–12; depreciation is 0 from this month onwards
  ): number[] => {
    const monthlyCharge = (cost * depRate) / 12;
    const deps: number[] = [];
    let wdv = isNew ? 0 : (startingWDV ?? cost);
    for (let m = 1; m <= month; m++) {
      if (disposalMonth !== undefined && m >= disposalMonth) {
        deps.push(0);
      } else if (isNew && m < acquisitionMonth) {
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

    // Disposal fields: only show if asset is disposed AND disposal date is on or before last day of report month
    const disposalVisible = !!(asset.disposed && asset.disposalDate && asset.disposalDate <= reportDateStr);
    const assetsDisposal = disposalVisible ? 'Y' : '';
    const dateOfDisposal = disposalVisible ? (asset.disposalDate || '') : '';
    const proceedValue = disposalVisible ? (asset.proceed || '') : '';

    let costOB: number | string;
    let addition: number | string;
    let costDisposal: number | string;
    let costClosing: number | string;
    let depOB: number | string;
    let wdvPrevYear: number | string;
    let monthlyDeps: number[];
    let currentPeriod: number | string;
    let writtenBack: number | string;
    let depClosing: number | string;
    let wdvYear: number | string;
    let gainLoss: number | string;

    // Determine if this asset was acquired during the reporting year (= addition)
    const acqParts = asset.acquisitionDate ? asset.acquisitionDate.split('-') : [];
    const acqYear = acqParts.length >= 1 ? parseInt(acqParts[0], 10) : null;
    const acqMonth = acqParts.length >= 2 ? parseInt(acqParts[1], 10) : 1;
    const isAddition = acqYear === year;

    const matchingOB = (asset.openingBalances || []).find(ob => ob.date === prevYearDateStr);

    if (isAddition) {
      costOB = 0;
      addition = cost;
      depOB = 0;
      wdvPrevYear = 0;

      const disposalMonth = disposalVisible && asset.disposalDate
        ? parseInt(asset.disposalDate.split('-')[1], 10)
        : undefined;

      costDisposal = disposalVisible ? -cost : 0;
      costClosing = cost + (costDisposal as number);

      monthlyDeps = calcMonthlyDep(cost, depRate, true, acqMonth, undefined, disposalMonth);
      currentPeriod = monthlyDeps.reduce((sum, d) => sum + d, 0);
      writtenBack = disposalVisible ? -((currentPeriod as number)) : 0;
      depClosing = (currentPeriod as number) + (writtenBack as number);
      wdvYear = (costClosing as number) - (depClosing as number);

      if (disposalVisible) {
        const proceed = parseFloat(asset.proceed || '0');
        gainLoss = proceed - (-(costDisposal as number) + (writtenBack as number));
      } else {
        gainLoss = '';
      }
    } else if (matchingOB) {
      costOB = cost;
      addition = 0;
      depOB = parseFloat(matchingOB.value) || 0;

      costDisposal = disposalVisible ? -(costOB as number) : 0;
      costClosing = (costOB as number) + (costDisposal as number);
      wdvPrevYear = (costOB as number) - (depOB as number);

      const disposalMonth = disposalVisible && asset.disposalDate
        ? parseInt(asset.disposalDate.split('-')[1], 10)
        : undefined;

      monthlyDeps = calcMonthlyDep(cost, depRate, false, 1, wdvPrevYear as number, disposalMonth);

      currentPeriod = monthlyDeps.reduce((sum, d) => sum + d, 0);
      writtenBack = disposalVisible ? -((depOB as number) + (currentPeriod as number)) : 0;
      depClosing = (depOB as number) + (currentPeriod as number) + (writtenBack as number);
      wdvYear = (costClosing as number) - (depClosing as number);

      if (disposalVisible) {
        const proceed = parseFloat(asset.proceed || '0');
        gainLoss = proceed - (-(costDisposal as number) + (writtenBack as number));
      } else {
        gainLoss = '';
      }
    } else {
      costOB = 'N/A';
      addition = 'N/A';
      costDisposal = 'N/A';
      costClosing = 'N/A';
      depOB = 'N/A';
      wdvPrevYear = 'N/A';
      monthlyDeps = Array(month).fill('');
      currentPeriod = 'N/A';
      writtenBack = 'N/A';
      depClosing = 'N/A';
      wdvYear = 'N/A';
      gainLoss = 'N/A';
    }

    return [
      asset.id,
      asset.description,
      asset.category,
      asset.branch,
      asset.acquisitionDate,
      '',              // Transferred from Rimtec
      cost,            // Historical Cost
      'SL',            // Method of Depreciation
      asset.usefulLife,       // Useful Life
      asset.depreciationRate, // Depreciation Rate
      assetsDisposal,         // Assets Disposal
      dateOfDisposal,         // Date of Disposal/Write Off
      proceedValue,           // Proceed
      gainLoss,        // Gain/Loss
      costOB,          // Cost: Opening Balance
      addition,        // Cost: Addition
      costDisposal,    // Cost: Disposal
      '',              // Cost: Transfer Completed Assets
      costClosing,     // Cost: Closing Balance
      depOB,           // Dep: Opening Balance
      currentPeriod,   // Dep: Current Period
      ...monthlyDeps,  // Jan–cutoff month
      writtenBack,     // Dep: Written-Back on Disposal
      depClosing,      // Dep: Closing Balance
      wdvPrevYear,     // WDV: As at 31 Dec {prevYear}
      wdvYear,         // WDV: As at {asAtLabel}
    ];
  });

  // Total row: sum numeric values across all data rows for each totalled column
  const totalledCols = [
    6, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ...Array.from({ length: month }, (_, i) => 21 + i),
    writtenBackCol, depClosingCol, wdvPrevCol, wdvCurrCol,
  ];
  const totalRow: any[] = Array(wdvCurrCol + 1).fill('');
  totalRow[0] = 'Total';
  for (const c of totalledCols) {
    let sum = 0;
    for (const row of dataRows) {
      const val = row[c];
      if (typeof val === 'number') {
        sum += val;
      } else if (typeof val === 'string' && val !== '' && val !== 'N/A') {
        const n = parseFloat(val);
        if (!isNaN(n)) sum += n;
      }
    }
    totalRow[c] = sum;
  }

  const allRows = [...titleRows, sectionHeaderRow, columnHeaderRow, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Merges
  ws['!merges'] = [
    // Vertical merges for the 14 fixed columns (rows 4–5)
    ...Array.from({ length: 14 }, (_, c) => ({ s: { r: 4, c }, e: { r: 5, c } })),
    // "Cost" spans cols 14–18 on row 4
    { s: { r: 4, c: 14 }, e: { r: 4, c: 18 } },
    // "Depreciation" spans from col 19 to depClosingCol on row 4
    { s: { r: 4, c: 19 }, e: { r: 4, c: depClosingCol } },
    // "WDV" spans wdvPrevCol to wdvCurrCol on row 4
    { s: { r: 4, c: wdvPrevCol }, e: { r: 4, c: wdvCurrCol } },
  ];

  // Column widths
  const monthColWidths = Array(month).fill({ wch: 11 });
  ws['!cols'] = [
    { wch: 12 }, // Asset ID
    { wch: 30 }, // Asset Name
    { wch: 22 }, // Asset Category
    { wch: 10 }, // Location
    { wch: 22 }, // Acquisition Date
    { wch: 22 }, // Transferred from Rimtec
    { wch: 16 }, // Historical Cost
    { wch: 22 }, // Method of Depreciation
    { wch: 12 }, // Useful Life
    { wch: 18 }, // Depreciation Rate
    { wch: 16 }, // Assets Disposal
    { wch: 24 }, // Date of Disposal/Write Off
    { wch: 14 }, // Proceed
    { wch: 12 }, // Gain/Loss
    { wch: 26 }, // Cost: OB
    { wch: 14 }, // Addition
    { wch: 12 }, // Disposal
    { wch: 26 }, // Transfer
    { wch: 26 }, // Cost: Closing Balance
    { wch: 26 }, // Dep: OB
    { wch: 16 }, // Current Period
    ...monthColWidths,
    { wch: 26 }, // Written-Back
    { wch: 26 }, // Dep: Closing Balance
    { wch: 18 }, // WDV: As at prevYear
    { wch: 18 }, // WDV: As at current
  ];

  // Number format for numeric data cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const numericCols = [
    6, 13, 14, 15, 16, 18, 19, 20,
    ...Array.from({ length: month }, (_, i) => 21 + i),
    writtenBackCol, depClosingCol, wdvPrevCol, wdvCurrCol,
  ];
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
