import * as XLSX from 'xlsx';
import { Asset } from '../../../types/Asset';
import { generateCategorySheet } from './assetSheetGenerator';

const CATEGORIES: { key: string; sheetName: string }[] = [
  { key: 'Office Equipment',        sheetName: 'Office Equipment' },
  { key: 'Motor Vehicle',           sheetName: 'Motor Vehicles' },
  { key: 'Warehouse Equipment',     sheetName: 'Warehouse Equipment' },
  { key: 'Manufacturing Equipment', sheetName: 'Manufacturing Equipment' },
  { key: 'Equipment for Leased',    sheetName: 'Equipment for Leased' },
  { key: 'Software',                sheetName: 'Software' },
];

export const generateAssetsReport = (
  assets: Asset[],
  entityName: string,
  reportDate: string
): void => {
  // Parse year safely without timezone drift
  const year = parseInt(reportDate.split('-')[0], 10);
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Reconciliation (blank)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'Reconciliation');

  // Sheet 2: Summary (blank)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'Summary');

  // Sheets 3–8: one per asset category
  CATEGORIES.forEach(({ key, sheetName }) => {
    const categoryAssets = assets.filter(a => a.category === key);
    const ws = generateCategorySheet(categoryAssets, key, entityName, year);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  // Sheet 9: CIP (blank)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'CIP');

  XLSX.writeFile(workbook, `Fixed_Assets_Report_${year}.xlsx`);
};
