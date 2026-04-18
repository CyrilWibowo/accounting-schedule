import * as XLSX from 'xlsx';
import { Asset, CIPAsset } from '../../../types/Asset';
import { generateCategorySheet } from './assetSheetGenerator';
import { generateCIPSheet } from './cipSheetGenerator';

const CATEGORIES: { key: string; sheetName: string }[] = [
  { key: 'Office Equipment',        sheetName: 'Office Equipment' },
  { key: 'Motor Vehicle',           sheetName: 'Motor Vehicles' },
  { key: 'Warehouse Equipment',     sheetName: 'Warehouse Equipment' },
  { key: 'Manufacturing Equipment', sheetName: 'Manufacturing Equipment' },
  { key: 'Equipment for Leased',    sheetName: 'Equipment for Leased' },
  { key: 'Software',                sheetName: 'Software' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const generateAssetsReport = (
  assets: Asset[],
  entityName: string,
  month: number,
  year: number,
  cipAssets: CIPAsset[] = [],
): void => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Reconciliation (blank)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'Reconciliation');

  // Sheet 2: Summary (blank)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'Summary');

  // Sheets 3–8: one per asset category
  CATEGORIES.forEach(({ key, sheetName }) => {
    const categoryAssets = assets.filter(a => a.category === key);
    const ws = generateCategorySheet(categoryAssets, key, entityName, year, month);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  // Sheet 9: CIP
  const cipWs = generateCIPSheet(cipAssets, entityName, year, month);
  XLSX.utils.book_append_sheet(workbook, cipWs, 'CIP');

  XLSX.writeFile(workbook, `Fixed_Assets_Report_${MONTH_NAMES[month - 1]}_${year}.xlsx`);
};
