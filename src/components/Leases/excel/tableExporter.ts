import * as XLSX from 'xlsx';
import { PropertyLease, MobileEquipmentLease } from '../../../types/Lease';
import { formatCurrency, formatDate, getYearDiff } from '../../../utils/helper';

const calculateCommittedYears = (lease: PropertyLease | MobileEquipmentLease): number => {
  if (lease.type === 'Property') {
    const propertyLease = lease as PropertyLease;
    if (propertyLease.commencementDate && propertyLease.expiryDate) {
      const start = new Date(propertyLease.commencementDate);
      const end = new Date(propertyLease.expiryDate);
      const yearsDiff = getYearDiff(start, end);
      const optionsYears = parseInt(propertyLease.options) || 0;
      const total = Math.floor(yearsDiff + optionsYears);
      return total > 0 ? total : 0;
    }
  } else {
    const meLease = lease as MobileEquipmentLease;
    if (meLease.deliveryDate && meLease.expiryDate) {
      const start = new Date(meLease.deliveryDate);
      const end = new Date(meLease.expiryDate);
      const yearsDiff = getYearDiff(start, end);
      return Math.floor(yearsDiff) > 0 ? Math.floor(yearsDiff) : 0;
    }
  }
  return 0;
};

export const exportPropertyLeasesToExcel = (leases: PropertyLease[], filename: string = 'PropertyLeases.xlsx') => {
  // Create table data
  const data = leases.map(lease => ({
    'ID': lease.leaseId,
    'Entity': lease.entity,
    'Lessor': lease.lessor,
    'Property Address': lease.propertyAddress,
    'Branch': lease.branch,
    'Commencement Date': formatDate(lease.commencementDate),
    'Expiry Date': formatDate(lease.expiryDate),
    'Options': `${lease.options} years`,
    'Total Committed Years': `${calculateCommittedYears(lease)} years`,
    'Monthly Rent (exc. GST)': formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2)),
  }));

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 10 },  // ID
    { wch: 20 },  // Entity
    { wch: 20 },  // Lessor
    { wch: 30 },  // Property Address
    { wch: 15 },  // Branch
    { wch: 18 },  // Commencement Date
    { wch: 18 },  // Expiry Date
    { wch: 12 },  // Options
    { wch: 20 },  // Total Committed Years
    { wch: 20 },  // Monthly Rent
  ];

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Property Leases');

  // Write file
  XLSX.writeFile(workbook, filename);
};

export const exportMobileEquipmentLeasesToExcel = (leases: MobileEquipmentLease[], filename: string = 'MobileEquipmentLeases.xlsx') => {
  // Create table data
  const data = leases.map(lease => ({
    'ID': lease.leaseId,
    'Entity': lease.entity,
    'Lessor': lease.lessor,
    'Rego No.': lease.regoNo,
    'Description': lease.description,
    'Branch': lease.branch,
    'Type': lease.vehicleType,
    'Engine Number': lease.engineNumber,
    'VIN/Serial No.': lease.vinSerialNo,
    'Delivery Date': formatDate(lease.deliveryDate),
    'Expiry Date': formatDate(lease.expiryDate),
    'Lease Period': `${calculateCommittedYears(lease)} years`,
    'Monthly Rent (exc. GST)': formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2)),
  }));

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 10 },  // ID
    { wch: 20 },  // Entity
    { wch: 20 },  // Lessor
    { wch: 12 },  // Rego No.
    { wch: 25 },  // Description
    { wch: 15 },  // Branch
    { wch: 15 },  // Type
    { wch: 15 },  // Engine Number
    { wch: 18 },  // VIN/Serial No.
    { wch: 18 },  // Delivery Date
    { wch: 18 },  // Expiry Date
    { wch: 12 },  // Lease Period
    { wch: 20 },  // Monthly Rent
  ];

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mobile Equipment Leases');

  // Write file
  XLSX.writeFile(workbook, filename);
};
