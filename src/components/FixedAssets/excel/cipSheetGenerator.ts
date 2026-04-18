import * as XLSX from 'xlsx';
import { CIPAsset } from '../../../types/Asset';

const CATEGORY_CODE: Record<string, string> = {
  'Office Equipment': 'O',
  'Motor Vehicle': 'V',
  'Warehouse Equipment': 'W',
  'Manufacturing Equipment': 'M',
  'Equipment for Leased': 'L',
  'Software': 'S',
};

const SHORT_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const generateCIPSheet = (
  cipAssets: CIPAsset[],
  entityName: string,
  year: number,
  month: number,
): XLSX.WorkSheet => {
  const prevYear = year - 1;
  const shortMonthName = SHORT_MONTH_NAMES[month - 1];
  const lastDay = new Date(year, month, 0).getDate();
  const asAtLabel = `${lastDay} ${shortMonthName} ${String(year).slice(2)}`;
  const prevYearLabel = `31 Dec ${String(prevYear).slice(2)}`;

  const titleRows: any[][] = [
    [entityName],
    ['CIP/FIXED ASSETS DEPOSIT SUMMARY'],
    [`AS AT ${shortMonthName.toUpperCase()} ${year}`],
    [],
  ];

  const headerRow: any[] = [
    'Asset ID',
    'Asset Name',
    'Invoice',
    'Date',
    'Completed Date',
    'Completed',
    'Branch',
    'Amount',
    `Balance ${prevYearLabel}`,
    'Additions',
    'Transferred to Completed Assets',
    `Balance ${asAtLabel}`,
  ];

  const dataRows: any[][] = [];

  let grandAmount = 0;
  let grandAdditions = 0;
  let grandTransferred = 0;

  for (const cip of cipAssets) {
    const catCode = CATEGORY_CODE[cip.category] || 'X';
    const placeholderId = `${cip.branch}${catCode}XX`;
    const assetId = cip.completed === 'Y' && cip.transferredAssetId ? cip.transferredAssetId : placeholderId;

    // Invoice rows
    const invoices = cip.invoices || [];
    for (const inv of invoices) {
      const assetName = [inv.vendorName, inv.assetName || cip.description, inv.description]
        .filter(Boolean)
        .join('; ');
      const invAmount = inv.amount !== '' ? parseFloat(inv.amount) || 0 : 0;
      grandAmount += invAmount;
      grandAdditions += invAmount;
      const invBalance = invAmount;
      dataRows.push([
        assetId,
        assetName,
        inv.invoiceNo,
        inv.date,
        '',
        cip.completed === 'Y' ? 'Y' : '',
        cip.branch,
        '',
        '',
        invAmount || '',
        '',
        invBalance || '',
      ]);
    }

    // CIP summary row
    const completedDate = cip.completed === 'Y' && cip.completionDate ? cip.completionDate : '';
    const total = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    const transferred = cip.completed === 'Y' ? -total : '';
    const finalBalance = cip.completed === 'Y' ? -total : 0;

    grandTransferred += Number(transferred) || 0;

    dataRows.push([
      assetId,
      `COMPLETED ASSET - ${cip.description}`,
      '',
      '',
      completedDate,
      cip.completed === 'Y' ? 'Y' : '',
      cip.branch,
      '',
      '',
      '',
      transferred !== '' ? transferred : '',
      finalBalance !== 0 ? finalBalance : '',
    ]);

  }

  const totalRowBalance = grandAdditions + grandTransferred;

  const totalRow: any[] = [
    '',
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    grandAmount || '',
    '',
    grandAdditions || '',
    grandTransferred || '',
    totalRowBalance || '',
  ];

  const allRows = [...titleRows, headerRow, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  ws['!cols'] = [
    { wch: 14 }, // Asset ID
    { wch: 40 }, // Asset Name
    { wch: 18 }, // Invoice
    { wch: 14 }, // Date
    { wch: 16 }, // Completed Date
    { wch: 10 }, // Completed
    { wch: 10 }, // Branch
    { wch: 14 }, // Amount
    { wch: 20 }, // Balance prev year
    { wch: 14 }, // Additions
    { wch: 30 }, // Transferred to Completed Assets
    { wch: 20 }, // Balance current
  ];

  return ws;
};
