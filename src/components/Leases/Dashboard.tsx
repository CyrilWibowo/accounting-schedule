// components/Dashboard.tsx
import React, { useState, useRef, useEffect } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Lease, PropertyLease, MobileEquipmentLease } from '../../types/Lease';
import { generateExcelFromLeases } from './excel/excelGenerator';
import { generateExcelFromMobileEquipmentLeases } from './excel/mobileEquipmentExcelGenerator';
import { exportPropertyLeasesToExcel, exportMobileEquipmentLeasesToExcel } from './excel/tableExporter';
import EditLeaseModal from './EditLeaseModal';
import ToXLSXModal, { XLSXGenerationParams } from './ToXLSXModal';
import './Dashboard.css';
import { formatCurrency, formatDate, getYearDiff, generateLeaseId } from '../../utils/helper';

interface DashboardProps {
  propertyLeases: PropertyLease[];
  mobileEquipmentLeases: MobileEquipmentLease[];
  onUpdateLease: (lease: Lease) => void;
  onDeleteLease: (leaseId: string) => void;
  onCopyLease: (lease: Lease) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  propertyLeases,
  mobileEquipmentLeases,
  onUpdateLease,
  onDeleteLease,
  onCopyLease
}) => {
  const [hoveredLease, setHoveredLease] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [xlsxModalLease, setXlsxModalLease] = useState<PropertyLease | MobileEquipmentLease | null>(null);
  const emptyRows = 10;
  const [propertySortConfig, setPropertySortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [mobileEquipmentSortConfig, setMobileEquipmentSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [propertyFilter, setPropertyFilter] = useState<'All' | 'Active' | 'Non-Active'>('All');
  const [mobileEquipmentFilter, setMobileEquipmentFilter] = useState<'All' | 'Active' | 'Non-Active'>('All');

  // Multi-select state
  const [selectedPropertyLeases, setSelectedPropertyLeases] = useState<Set<string>>(new Set());
  const [selectedMobileLeases, setSelectedMobileLeases] = useState<Set<string>>(new Set());
  const propertySelectAllRef = useRef<HTMLInputElement>(null);
  const mobileSelectAllRef = useRef<HTMLInputElement>(null);

  // Batch delete confirmation
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [batchDeleteContext, setBatchDeleteContext] = useState<{
    isPropertyTable: boolean;
    count: number;
  } | null>(null);

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

  // Get effective expiry date (expiry + options years for property leases)
  const getEffectiveExpiryDate = (lease: PropertyLease | MobileEquipmentLease): Date => {
    const expiryDate = new Date(lease.expiryDate);
    if (lease.type === 'Property') {
      const options = parseInt((lease as PropertyLease).options) || 0;
      expiryDate.setFullYear(expiryDate.getFullYear() + options);
    }
    return expiryDate;
  };

  const isLeaseActive = (lease: PropertyLease | MobileEquipmentLease): boolean => {
    const currentYear = new Date().getFullYear();
    const effectiveExpiryDate = getEffectiveExpiryDate(lease);
    const expiryYear = effectiveExpiryDate.getFullYear();
    return expiryYear >= currentYear;
  };

  const filterLeases = <T extends PropertyLease | MobileEquipmentLease>(
    leases: T[],
    filter: 'All' | 'Active' | 'Non-Active'
  ): T[] => {
    if (filter === 'All') return leases;
    if (filter === 'Active') return leases.filter(lease => isLeaseActive(lease));
    return leases.filter(lease => !isLeaseActive(lease));
  };

  const handleGenerateExcel = (lease: PropertyLease | MobileEquipmentLease, params: XLSXGenerationParams) => {
    if (lease.type === 'Property') {
      generateExcelFromLeases(lease as PropertyLease, params);
    } else {
      generateExcelFromMobileEquipmentLeases(lease as MobileEquipmentLease, params);
    }
  };

  const isLeaseExpired = (lease: PropertyLease | MobileEquipmentLease): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveExpiryDate = getEffectiveExpiryDate(lease);
    effectiveExpiryDate.setHours(0, 0, 0, 0);

    return effectiveExpiryDate < today;
  };

  const isWithinThreeMonthsOfExpiry = (lease: PropertyLease | MobileEquipmentLease): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveExpiryDate = getEffectiveExpiryDate(lease);
    effectiveExpiryDate.setHours(0, 0, 0, 0);

    const threeMonthsFromNow = new Date(today);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    return effectiveExpiryDate <= threeMonthsFromNow && effectiveExpiryDate >= today;
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
    const filteredLeases = filterLeases(propertyLeases, propertyFilter);
    const sortedLeases = sortData(filteredLeases, propertySortConfig);

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
        <tr key={lease?.id || `empty-${i}`}>
          <td onClick={(e) => e.stopPropagation()}>
            {lease && (
              <input
                type="checkbox"
                className="lease-checkbox"
                checked={selectedPropertyLeases.has(lease.id)}
                onChange={() => handleToggleSelect(lease.id, true)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </td>
          <td>{lease ? lease.leaseId : ''}</td>
          <td>{lease ? lease.entity : ''}</td>
          <td>{lease ? lease.lessor : ''}</td>
          <td>{lease ? lease.propertyAddress : ''}</td>
          <td>{lease ? lease.branch : ''}</td>
          <td>{lease ? formatDate(lease.commencementDate) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>
            {lease ? formatDate(getEffectiveExpiryDate(lease).toISOString()) : ''}
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

  const renderMobileEquipmentTableRows = () => {
    const rows = [];
    const filteredLeases = filterLeases(mobileEquipmentLeases, mobileEquipmentFilter);
    const sortedLeases = sortData(filteredLeases, mobileEquipmentSortConfig);

    for (let i = 0; i < Math.max(emptyRows, sortedLeases.length); i++) {
      const lease = sortedLeases[i];
      const leasePeriod = lease ? calculateCommittedYears(lease) : 0;
      rows.push(
        <tr key={lease?.id || `empty-${i}`}>
          <td onClick={(e) => e.stopPropagation()}>
            {lease && (
              <input
                type="checkbox"
                className="lease-checkbox"
                checked={selectedMobileLeases.has(lease.id)}
                onChange={() => handleToggleSelect(lease.id, false)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </td>
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
            {lease ? formatDate(getEffectiveExpiryDate(lease).toISOString()) : ''}
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

  const sortData = <T extends PropertyLease | MobileEquipmentLease>(
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
    const sortConfig = isPropertyTable ? propertySortConfig : mobileEquipmentSortConfig;
    const setSortConfig = isPropertyTable ? setPropertySortConfig : setMobileEquipmentSortConfig;

    if (sortConfig.key !== key) {
      // New column: start with ascending
      setSortConfig({ key, direction: 'asc' });
    } else if (sortConfig.direction === 'asc') {
      // Currently ascending: switch to descending
      setSortConfig({ key, direction: 'desc' });
    } else {
      // Currently descending: clear sort
      setSortConfig({ key: null, direction: 'asc' });
    }
  };

  const renderSortIndicator = (columnKey: string, isPropertyTable: boolean) => {
    const sortConfig = isPropertyTable ? propertySortConfig : mobileEquipmentSortConfig;

    if (sortConfig.key !== columnKey) return null;

    return (
      <span style={{ marginLeft: '4px' }}>
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const isSorted = (columnKey: string, isPropertyTable: boolean) => {
    const sortConfig = isPropertyTable ? propertySortConfig : mobileEquipmentSortConfig;
    return sortConfig.key === columnKey;
  };

  // Multi-select handlers
  const handleToggleSelect = (leaseId: string, isPropertyTable: boolean) => {
    const setState = isPropertyTable ? setSelectedPropertyLeases : setSelectedMobileLeases;
    setState(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leaseId)) {
        newSet.delete(leaseId);
      } else {
        newSet.add(leaseId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isPropertyTable: boolean) => {
    const selectedSet = isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;
    const setState = isPropertyTable ? setSelectedPropertyLeases : setSelectedMobileLeases;

    const filteredLeases = isPropertyTable
      ? filterLeases(propertyLeases, propertyFilter)
      : filterLeases(mobileEquipmentLeases, mobileEquipmentFilter);

    if (selectedSet.size === filteredLeases.length && selectedSet.size > 0) {
      // All selected - deselect all
      setState(new Set());
    } else {
      // Select all visible
      setState(new Set(filteredLeases.map(l => l.id)));
    }
  };

  // Batch operations
  const handleBatchCopy = async (isPropertyTable: boolean) => {
    const selectedSet = isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;
    const setState = isPropertyTable ? setSelectedPropertyLeases : setSelectedMobileLeases;

    const leasesToCopy = isPropertyTable
      ? propertyLeases.filter(l => selectedSet.has(l.id))
      : mobileEquipmentLeases.filter(l => selectedSet.has(l.id));

    for (const lease of leasesToCopy) {
      // Create a new lease with new UUID and leaseId (like EditLeaseModal does)
      const copiedLease: Lease = {
        ...lease,
        id: crypto.randomUUID(),
        leaseId: generateLeaseId(lease.type),
      };
      await onCopyLease(copiedLease);
    }

    // Clear selection after copy
    setState(new Set());
  };

  const handleBatchDelete = (isPropertyTable: boolean) => {
    const selectedSet = isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;

    if (selectedSet.size === 0) return;

    setBatchDeleteContext({
      isPropertyTable,
      count: selectedSet.size
    });
    setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (!batchDeleteContext) return;

    const selectedSet = batchDeleteContext.isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;
    const setState = batchDeleteContext.isPropertyTable ? setSelectedPropertyLeases : setSelectedMobileLeases;

    // Capture all IDs to delete before any deletions (to avoid issues with changing props)
    const leaseIdsToDelete = Array.from(selectedSet);

    // Delete all leases sequentially (await each one)
    for (const leaseId of leaseIdsToDelete) {
      await onDeleteLease(leaseId);
    }

    // Clear selection and close dialog
    setState(new Set());
    setShowBatchDeleteConfirm(false);
    setBatchDeleteContext(null);
  };

  const handleCancelBatchDelete = () => {
    setShowBatchDeleteConfirm(false);
    setBatchDeleteContext(null);
  };

  const handleBatchExport = (isPropertyTable: boolean) => {
    const selectedSet = isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;

    if (selectedSet.size === 0) return;

    // Export selected leases to Excel as a table
    if (isPropertyTable) {
      const leasesToExport = propertyLeases.filter(l => selectedSet.has(l.id));
      const timestamp = new Date().toISOString().split('T')[0];
      exportPropertyLeasesToExcel(leasesToExport, `PropertyLeases_${timestamp}.xlsx`);
    } else {
      const leasesToExport = mobileEquipmentLeases.filter(l => selectedSet.has(l.id));
      const timestamp = new Date().toISOString().split('T')[0];
      exportMobileEquipmentLeasesToExcel(leasesToExport, `MobileEquipmentLeases_${timestamp}.xlsx`);
    }
  };

  // Update indeterminate checkbox state
  useEffect(() => {
    if (propertySelectAllRef.current) {
      const filteredCount = filterLeases(propertyLeases, propertyFilter).length;
      const selectedCount = selectedPropertyLeases.size;
      propertySelectAllRef.current.indeterminate =
        selectedCount > 0 && selectedCount < filteredCount;
    }
  }, [selectedPropertyLeases, propertyLeases, propertyFilter]);

  useEffect(() => {
    if (mobileSelectAllRef.current) {
      const filteredCount = filterLeases(mobileEquipmentLeases, mobileEquipmentFilter).length;
      const selectedCount = selectedMobileLeases.size;
      mobileSelectAllRef.current.indeterminate =
        selectedCount > 0 && selectedCount < filteredCount;
    }
  }, [selectedMobileLeases, mobileEquipmentLeases, mobileEquipmentFilter]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedPropertyLeases(new Set());
  }, [propertyFilter]);

  useEffect(() => {
    setSelectedMobileLeases(new Set());
  }, [mobileEquipmentFilter]);

  return (
    <div className="dashboard-container">
      {hoveredLease && propertyLeases.find(l => l.id === hoveredLease) &&
        renderIncrementMethodsTooltip(propertyLeases.find(l => l.id === hoveredLease)!)}
      {hoveredLease && mobileEquipmentLeases.find(l => l.id === hoveredLease) &&
        renderIncrementMethodsTooltip(mobileEquipmentLeases.find(l => l.id === hoveredLease)!)}

      <div className="table-section">
        <div className="table-header">
          <h2>Property Leases ({filterLeases(propertyLeases, propertyFilter).length})</h2>
        </div>
        <div className="selection-bar">
          <input
            type="checkbox"
            ref={propertySelectAllRef}
            className="select-all-checkbox"
            checked={selectedPropertyLeases.size > 0 && selectedPropertyLeases.size === filterLeases(propertyLeases, propertyFilter).length}
            onChange={() => handleSelectAll(true)}
            title="Select all"
          />
          {selectedPropertyLeases.size > 0 ? (
            <>
              <span className="selection-count">{selectedPropertyLeases.size} selected</span>
              <div className="selection-actions">
                <button className="action-btn action-copy" onClick={() => handleBatchCopy(true)} title="Copy">
                  <ContentCopyIcon fontSize="small" />
                </button>
                <button className="action-btn action-export" onClick={() => handleBatchExport(true)} title="Export">
                  <FileDownloadIcon fontSize="small" />
                </button>
                <button className="action-btn action-delete" onClick={() => handleBatchDelete(true)} title="Delete">
                  <DeleteIcon fontSize="small" />
                </button>
              </div>
            </>
          ) : (
            <span className="selection-hint">Select items</span>
          )}
          <select
            className="filter-dropdown"
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value as 'All' | 'Active' | 'Non-Active')}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Non-Active">Non-Active</option>
          </select>
        </div>
        <div className="table-wrapper">
          <table className="lease-table">
            <thead>
              <tr>
                <th style={{ width: '40px', minWidth: '40px' }}></th>
                <th onClick={() => handleSort('leaseId', true)} style={{ cursor: 'pointer' }} className={isSorted('leaseId', true) ? 'sorted' : ''}>
                  ID{renderSortIndicator('leaseId', true)}
                </th>
                <th onClick={() => handleSort('entity', true)} style={{ cursor: 'pointer' }} className={isSorted('entity', true) ? 'sorted' : ''}>
                  Entity{renderSortIndicator('entity', true)}
                </th>
                <th onClick={() => handleSort('lessor', true)} style={{ cursor: 'pointer' }} className={isSorted('lessor', true) ? 'sorted' : ''}>
                  Lessor{renderSortIndicator('lessor', true)}
                </th>
                <th onClick={() => handleSort('propertyAddress', true)} style={{ cursor: 'pointer' }} className={isSorted('propertyAddress', true) ? 'sorted' : ''}>
                  Property Address{renderSortIndicator('propertyAddress', true)}
                </th>
                <th onClick={() => handleSort('branch', true)} style={{ cursor: 'pointer' }} className={isSorted('branch', true) ? 'sorted' : ''}>
                  Branch{renderSortIndicator('branch', true)}
                </th>
                <th onClick={() => handleSort('commencementDate', true)} style={{ cursor: 'pointer' }} className={isSorted('commencementDate', true) ? 'sorted' : ''}>
                  Commencement Date{renderSortIndicator('commencementDate', true)}
                </th>
                <th onClick={() => handleSort('expiryDate', true)} style={{ cursor: 'pointer' }} className={isSorted('expiryDate', true) ? 'sorted' : ''}>
                  Expiry Date{renderSortIndicator('expiryDate', true)}
                </th>
                <th onClick={() => handleSort('options', true)} style={{ cursor: 'pointer' }} className={isSorted('options', true) ? 'sorted' : ''}>
                  Options{renderSortIndicator('options', true)}
                </th>
                <th onClick={() => handleSort('committedYears', true)} style={{ cursor: 'pointer' }} className={isSorted('committedYears', true) ? 'sorted' : ''}>
                  Total Committed Years{renderSortIndicator('committedYears', true)}
                </th>
                <th onClick={() => handleSort('annualRent', true)} style={{ cursor: 'pointer' }} className={isSorted('annualRent', true) ? 'sorted' : ''}>
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
        <div className="table-header">
          <h2>Mobile Equipment Leases ({filterLeases(mobileEquipmentLeases, mobileEquipmentFilter).length})</h2>
        </div>
        <div className="selection-bar">
          <input
            type="checkbox"
            ref={mobileSelectAllRef}
            className="select-all-checkbox"
            checked={selectedMobileLeases.size > 0 && selectedMobileLeases.size === filterLeases(mobileEquipmentLeases, mobileEquipmentFilter).length}
            onChange={() => handleSelectAll(false)}
            title="Select all"
          />
          {selectedMobileLeases.size > 0 ? (
            <>
              <span className="selection-count">{selectedMobileLeases.size} selected</span>
              <div className="selection-actions">
                <button className="action-btn action-copy" onClick={() => handleBatchCopy(false)} title="Copy">
                  <ContentCopyIcon fontSize="small" />
                </button>
                <button className="action-btn action-export" onClick={() => handleBatchExport(false)} title="Export">
                  <FileDownloadIcon fontSize="small" />
                </button>
                <button className="action-btn action-delete" onClick={() => handleBatchDelete(false)} title="Delete">
                  <DeleteIcon fontSize="small" />
                </button>
              </div>
            </>
          ) : (
            <span className="selection-hint">Select items</span>
          )}
          <select
            className="filter-dropdown"
            value={mobileEquipmentFilter}
            onChange={(e) => setMobileEquipmentFilter(e.target.value as 'All' | 'Active' | 'Non-Active')}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Non-Active">Non-Active</option>
          </select>
        </div>
        <div className="table-wrapper">
          <table className="lease-table">
            <thead>
              <tr>
                <th style={{ width: '40px', minWidth: '40px' }}></th>
                <th onClick={() => handleSort('leaseId', false)} style={{ cursor: 'pointer' }} className={isSorted('leaseId', false) ? 'sorted' : ''}>
                  ID{renderSortIndicator('leaseId', false)}
                </th>
                <th onClick={() => handleSort('entity', false)} style={{ cursor: 'pointer' }} className={isSorted('entity', false) ? 'sorted' : ''}>
                  Entity{renderSortIndicator('entity', false)}
                </th>
                <th onClick={() => handleSort('lessor', false)} style={{ cursor: 'pointer' }} className={isSorted('lessor', false) ? 'sorted' : ''}>
                  Lessor{renderSortIndicator('lessor', false)}
                </th>
                <th onClick={() => handleSort('regoNo', false)} style={{ cursor: 'pointer' }} className={isSorted('regoNo', false) ? 'sorted' : ''}>
                  Rego/Equipment No.{renderSortIndicator('regoNo', false)}
                </th>
                <th onClick={() => handleSort('description', false)} style={{ cursor: 'pointer' }} className={isSorted('description', false) ? 'sorted' : ''}>
                  Description{renderSortIndicator('description', false)}
                </th>
                <th onClick={() => handleSort('branch', false)} style={{ cursor: 'pointer' }} className={isSorted('branch', false) ? 'sorted' : ''}>
                  Branch{renderSortIndicator('branch', false)}
                </th>
                <th onClick={() => handleSort('vehicleType', false)} style={{ cursor: 'pointer' }} className={isSorted('vehicleType', false) ? 'sorted' : ''}>
                  Type{renderSortIndicator('vehicleType', false)}
                </th>
                <th onClick={() => handleSort('engineNumber', false)} style={{ cursor: 'pointer' }} className={isSorted('engineNumber', false) ? 'sorted' : ''}>
                  Engine Number{renderSortIndicator('engineNumber', false)}
                </th>
                <th onClick={() => handleSort('vinSerialNo', false)} style={{ cursor: 'pointer' }} className={isSorted('vinSerialNo', false) ? 'sorted' : ''}>
                  VIN/Serial No.{renderSortIndicator('vinSerialNo', false)}
                </th>
                <th onClick={() => handleSort('deliveryDate', false)} style={{ cursor: 'pointer' }} className={isSorted('deliveryDate', false) ? 'sorted' : ''}>
                  Delivery Date{renderSortIndicator('deliveryDate', false)}
                </th>
                <th onClick={() => handleSort('expiryDate', false)} style={{ cursor: 'pointer' }} className={isSorted('expiryDate', false) ? 'sorted' : ''}>
                  Expiry Date{renderSortIndicator('expiryDate', false)}
                </th>
                <th onClick={() => handleSort('committedYears', false)} style={{ cursor: 'pointer' }} className={isSorted('committedYears', false) ? 'sorted' : ''}>
                  Lease Period{renderSortIndicator('committedYears', false)}
                </th>
                <th onClick={() => handleSort('annualRent', false)} style={{ cursor: 'pointer' }} className={isSorted('annualRent', false) ? 'sorted' : ''}>
                  Monthly Rent (exc. GST){renderSortIndicator('annualRent', false)}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {renderMobileEquipmentTableRows()}
            </tbody>
          </table>
        </div>
      </div>

      {editingLease && (
        <EditLeaseModal
          lease={editingLease}
          onClose={() => setEditingLease(null)}
          onSave={onUpdateLease}
        />
      )}

      {xlsxModalLease && (
        <ToXLSXModal
          onClose={() => setXlsxModalLease(null)}
          onGenerate={(params) => handleGenerateExcel(xlsxModalLease, params)}
          openingBalances={xlsxModalLease.openingBalances}
        />
      )}

      {showBatchDeleteConfirm && batchDeleteContext && (
        <div className="confirm-overlay" onMouseDown={handleCancelBatchDelete}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete {batchDeleteContext.count} Leases?</h3>
            <p className="confirm-text">
              Are you sure you want to delete {batchDeleteContext.count} selected lease{batchDeleteContext.count > 1 ? 's' : ''}?
              This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={handleCancelBatchDelete}>
                Cancel
              </button>
              <button className="confirm-delete-button" onClick={handleConfirmBatchDelete}>
                Delete {batchDeleteContext.count} Lease{batchDeleteContext.count > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;