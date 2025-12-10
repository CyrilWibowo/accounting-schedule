// components/Dashboard.tsx
import React, { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import { Lease, PropertyLease, MotorVehicleLease } from '../types/Lease';
import { generateExcelFromLeases } from '../utils/excelGenerator';
import { generateExcelFromMotorVehicleLeases } from '../utils/motorVehicleExcelGenerator';
import EditLeaseModal from './EditLeaseModal';
import ToXLSXModal, { XLSXGenerationParams } from './ToXLSXModal';
import './Dashboard.css';
import { formatCurrency, formatDate, getYearDiff } from '../utils/helper';

interface DashboardProps {
  propertyLeases: PropertyLease[];
  motorVehicleLeases: MotorVehicleLease[];
  onUpdateLease: (lease: Lease) => void;
  onDeleteLease: (leaseId: string) => void;
  onCopyLease: (lease: Lease) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  propertyLeases,
  motorVehicleLeases,
  onUpdateLease,
  onDeleteLease,
  onCopyLease
}) => {
  const [hoveredLease, setHoveredLease] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [xlsxModalLease, setXlsxModalLease] = useState<PropertyLease | MotorVehicleLease | null>(null);
  const emptyRows = 10;
  const [propertySortConfig, setPropertySortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [motorVehicleSortConfig, setMotorVehicleSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const calculateCommittedYears = (lease: Lease): number => {
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
      const mvLease = lease as MotorVehicleLease;
      if (mvLease.deliveryDate && mvLease.expiryDate) {
        const start = new Date(mvLease.deliveryDate);
        const end = new Date(mvLease.expiryDate);
        const yearsDiff = getYearDiff(start, end);
        return Math.floor(yearsDiff) > 0 ? Math.floor(yearsDiff) : 0;
      }
    }
    return 0;
  };

  const handleGenerateExcel = (lease: PropertyLease | MotorVehicleLease, params: XLSXGenerationParams) => {
    if (lease.type === 'Property') {
      generateExcelFromLeases(lease as PropertyLease, params);
    } else {
      generateExcelFromMotorVehicleLeases(lease as MotorVehicleLease, params);
    }
  };

  const isLeaseExpired = (lease: PropertyLease | MotorVehicleLease): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(lease.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    return expiryDate < today;
  };

  const isWithinThreeMonthsOfExpiry = (lease: PropertyLease | MotorVehicleLease): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(lease.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    const threeMonthsFromNow = new Date(today);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    return expiryDate <= threeMonthsFromNow && expiryDate >= today;
  };

  const renderIncrementMethodsTooltip = (lease: Lease) => {
    const committedYears = calculateCommittedYears(lease);
    if (committedYears < 1) return null;

    // Only show tooltip for Property leases
    if (lease.type !== 'Property') return null;

    return (
      <div
        className="tooltip"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`
        }}
      >
        <div className="tooltip-header">Increment Methods</div>
        {Array.from({ length: committedYears }, (_, i) => i + 1).map((year) => {
          const method = lease.incrementMethods[year];

          return (
            <div key={year} className="tooltip-row">
              <strong>Year {year}:</strong> {method || 'Not set'}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPropertyTableRows = () => {
    const rows = [];
    const sortedLeases = sortData(propertyLeases, propertySortConfig);

    const handleMouseEnter = (lease: PropertyLease, event: React.MouseEvent<HTMLTableCellElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left,
        y: rect.bottom + 8
      });
      setHoveredLease(lease.id);
    };

    for (let i = 0; i < Math.max(emptyRows, sortedLeases.length); i++) {
      const lease = sortedLeases[i];
      const committedYears = lease ? calculateCommittedYears(lease) : 0;

      rows.push(
        <tr key={i}>
          <td>{lease ? lease.leaseId : ''}</td>
          <td>{lease ? lease.entity : ''}</td>
          <td>{lease ? lease.lessor : ''}</td>
          <td>{lease ? lease.propertyAddress : ''}</td>
          <td>{lease ? lease.branch : ''}</td>
          <td>{lease ? formatDate(lease.commencementDate) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>
            {lease ? formatDate(lease.expiryDate) : ''}
          </td>
          <td>{lease ? `${lease.options} years` : ''}</td>
          <td
            className={lease ? 'committed-years-cell' : ''}
            onMouseEnter={(e) => lease && handleMouseEnter(lease, e)}
            onMouseLeave={() => setHoveredLease(null)}
          >
            {lease && `${committedYears} years`}
          </td>
          <td>{lease ? formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2)) : ''}</td>
          <td>
            {lease && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isLeaseExpired(lease) ? '#dc3545' : (isWithinThreeMonthsOfExpiry(lease) ? '#ff9c1bff' : '#28a745'),
                      cursor: 'help',
                      position: 'relative'
                    }}
                    title={isLeaseExpired(lease) ? 'Lease expired' : 'Lease active'}
                  />
                  <button
                    className="download-btn"
                    onClick={() => setXlsxModalLease(lease)}
                  >
                    AASB16
                  </button>
                </div>
                <button
                  className="edit-btn"
                  onClick={() => setEditingLease(lease)}
                  title="Edit lease"
                >
                  <SettingsIcon />
                </button>
              </div>
            )}
          </td>
        </tr>
      );
    }
    return rows;
  };

  const renderMotorVehicleTableRows = () => {
    const rows = [];
    const sortedLeases = sortData(motorVehicleLeases, motorVehicleSortConfig);

    for (let i = 0; i < Math.max(emptyRows, sortedLeases.length); i++) {
      const lease = sortedLeases[i];
      const leasePeriod = lease ? calculateCommittedYears(lease) : 0;
      rows.push(
        <tr key={i}>
          <td>{lease ? lease.leaseId : ''}</td>
          <td>{lease ? lease.entity : ''}</td>
          <td>{lease ? lease.lessor : ''}</td>
          <td>{lease ? lease.regoNo : ''}</td>
          <td>{lease ? lease.description : ''}</td>
          <td>{lease ? lease.branch : ''}</td>
          <td>{lease ? lease.vehicleType : ''}</td>
          <td>{lease ? lease.engineNumber : ''}</td>
          <td>{lease ? lease.vinSerialNo : ''}</td>
          <td>{lease ? formatDate(lease.deliveryDate) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>
            {lease ? formatDate(lease.expiryDate) : ''}
          </td>
          <td>{lease && `${leasePeriod} years`}</td>
          <td>{lease ? formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2)) : ''}</td>
          <td>
            {lease && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isLeaseExpired(lease) ? '#dc3545' : '#28a745',
                      cursor: 'help',
                      position: 'relative',
                    }}
                    title={isLeaseExpired(lease) ? 'Lease expired' : 'Lease active'}
                  />
                  <button
                    className="download-btn"
                    onClick={() => setXlsxModalLease(lease)}
                  >
                    AASB16
                  </button>
                </div>
                <button
                  className="edit-btn"
                  onClick={() => setEditingLease(lease)}
                  title="Edit lease"
                >
                  <SettingsIcon />
                </button>
              </div>
            )}
          </td>
        </tr>
      );
    }
    return rows;
  };

  const sortData = <T extends PropertyLease | MotorVehicleLease>(
    data: T[],
    sortConfig: { key: string | null; direction: 'asc' | 'desc' }
  ): T[] => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle special cases for calculated fields
      if (sortConfig.key === 'committedYears') {
        aValue = calculateCommittedYears(a);
        bValue = calculateCommittedYears(b);
      } else {
        aValue = a[sortConfig.key as keyof T];
        bValue = b[sortConfig.key as keyof T];
      }

      // Handle dates
      if (sortConfig.key && sortConfig.key.toLowerCase().includes('date')) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      // Handle numeric fields
      else if (sortConfig.key && ['annualRent', 'borrowingRate', 'rbaCpiRate', 'fixedIncrementRate', 'options', 'committedYears'].includes(sortConfig.key)) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      // Handle strings (alphabetical)
      else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleSort = (
    key: string,
    isPropertyTable: boolean
  ) => {
    const sortConfig = isPropertyTable ? propertySortConfig : motorVehicleSortConfig;
    const setSortConfig = isPropertyTable ? setPropertySortConfig : setMotorVehicleSortConfig;

    const direction =
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (columnKey: string, isPropertyTable: boolean) => {
    const sortConfig = isPropertyTable ? propertySortConfig : motorVehicleSortConfig;

    if (sortConfig.key !== columnKey) return null;

    return (
      <span style={{ marginLeft: '4px' }}>
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="dashboard-container">
      {hoveredLease && propertyLeases.find(l => l.id === hoveredLease) &&
        renderIncrementMethodsTooltip(propertyLeases.find(l => l.id === hoveredLease)!)}
      {hoveredLease && motorVehicleLeases.find(l => l.id === hoveredLease) &&
        renderIncrementMethodsTooltip(motorVehicleLeases.find(l => l.id === hoveredLease)!)}

      <div className="table-section">
        <h2>Property Leases</h2>
        <div className="table-wrapper">
          <table className="lease-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('leaseId', true)} style={{ cursor: 'pointer' }}>
                  ID{renderSortIndicator('leaseId', true)}
                </th>
                <th onClick={() => handleSort('entity', true)} style={{ cursor: 'pointer' }}>
                  Entity{renderSortIndicator('entity', true)}
                </th>
                <th onClick={() => handleSort('lessor', true)} style={{ cursor: 'pointer' }}>
                  Lessor{renderSortIndicator('lessor', true)}
                </th>
                <th onClick={() => handleSort('propertyAddress', true)} style={{ cursor: 'pointer' }}>
                  Property Address{renderSortIndicator('propertyAddress', true)}
                </th>
                <th onClick={() => handleSort('branch', true)} style={{ cursor: 'pointer' }}>
                  Branch{renderSortIndicator('branch', true)}
                </th>
                <th onClick={() => handleSort('commencementDate', true)} style={{ cursor: 'pointer' }}>
                  Commencement Date{renderSortIndicator('commencementDate', true)}
                </th>
                <th onClick={() => handleSort('expiryDate', true)} style={{ cursor: 'pointer' }}>
                  Expiry Date{renderSortIndicator('expiryDate', true)}
                </th>
                <th onClick={() => handleSort('options', true)} style={{ cursor: 'pointer' }}>
                  Options{renderSortIndicator('options', true)}
                </th>
                <th onClick={() => handleSort('committedYears', true)} style={{ cursor: 'pointer' }}>
                  Total Committed Years{renderSortIndicator('committedYears', true)}
                </th>
                <th onClick={() => handleSort('annualRent', true)} style={{ cursor: 'pointer' }}>
                  Monthly Rent (exc. GST){renderSortIndicator('annualRent', true)}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {renderPropertyTableRows()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-section">
        <h2>Motor Vehicle Leases</h2>
        <div className="table-wrapper">
          <table className="lease-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('leaseId', false)} style={{ cursor: 'pointer' }}>
                  ID{renderSortIndicator('leaseId', false)}
                </th>
                <th onClick={() => handleSort('entity', false)} style={{ cursor: 'pointer' }}>
                  Entity{renderSortIndicator('entity', false)}
                </th>
                <th onClick={() => handleSort('lessor', false)} style={{ cursor: 'pointer' }}>
                  Lessor{renderSortIndicator('lessor', false)}
                </th>
                <th onClick={() => handleSort('regoNo', false)} style={{ cursor: 'pointer' }}>
                  Rego No.{renderSortIndicator('regoNo', false)}
                </th>
                <th onClick={() => handleSort('description', false)} style={{ cursor: 'pointer' }}>
                  Description{renderSortIndicator('description', false)}
                </th>
                <th onClick={() => handleSort('branch', false)} style={{ cursor: 'pointer' }}>
                  Branch{renderSortIndicator('branch', false)}
                </th>
                <th onClick={() => handleSort('vehicleType', false)} style={{ cursor: 'pointer' }}>
                  Vehicle Type{renderSortIndicator('vehicleType', false)}
                </th>
                <th onClick={() => handleSort('engineNumber', false)} style={{ cursor: 'pointer' }}>
                  Engine Number{renderSortIndicator('engineNumber', false)}
                </th>
                <th onClick={() => handleSort('vinSerialNo', false)} style={{ cursor: 'pointer' }}>
                  VIN/Serial No.{renderSortIndicator('vinSerialNo', false)}
                </th>
                <th onClick={() => handleSort('deliveryDate', false)} style={{ cursor: 'pointer' }}>
                  Delivery Date{renderSortIndicator('deliveryDate', false)}
                </th>
                <th onClick={() => handleSort('expiryDate', false)} style={{ cursor: 'pointer' }}>
                  Expiry Date{renderSortIndicator('expiryDate', false)}
                </th>
                <th onClick={() => handleSort('committedYears', false)} style={{ cursor: 'pointer' }}>
                  Lease Period{renderSortIndicator('committedYears', false)}
                </th>
                <th onClick={() => handleSort('annualRent', false)} style={{ cursor: 'pointer' }}>
                  Monthly Rent (exc. GST){renderSortIndicator('annualRent', false)}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {renderMotorVehicleTableRows()}
            </tbody>
          </table>
        </div>
      </div>

      {editingLease && (
        <EditLeaseModal
          lease={editingLease}
          onClose={() => setEditingLease(null)}
          onSave={onUpdateLease}
          onDelete={onDeleteLease}
          onCopy={onCopyLease}
        />
      )}

      {xlsxModalLease && (
        <ToXLSXModal
          onClose={() => setXlsxModalLease(null)}
          onGenerate={(params) => handleGenerateExcel(xlsxModalLease, params)}
          openingBalances={xlsxModalLease.openingBalances}
        />
      )}
    </div>
  );
};

export default Dashboard;