// components/Dashboard.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Lease, PropertyLease, MobileEquipmentLease, OpeningBalance, Branch } from '../../types/Lease';
import { generateExcelFromLeases } from './excel/excelGenerator';
import { generateExcelFromMobileEquipmentLeases } from './excel/mobileEquipmentExcelGenerator';
import { exportPropertyLeasesToExcel, exportMobileEquipmentLeasesToExcel } from './excel/tableExporter';
import ToXLSXModal, { XLSXGenerationParams } from './ToXLSXModal';
import AddOpeningBalanceForm from './AddOpeningBalanceForm';
import './Dashboard.css';
import { formatCurrency, formatDate, getYearDiff, generateLeaseId } from '../../utils/helper';

const BRANCH_OPTIONS: Branch[] = ['PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'CORP', 'PERT-RTS', 'MACK-RTS', 'ADEL-RTS', 'PARK'];
const DEFAULT_PANEL_WIDTH = 520;
const MIN_PANEL_WIDTH = 380;
const MAX_PANEL_WIDTH = 900;

interface DashboardProps {
  propertyLeases: PropertyLease[];
  mobileEquipmentLeases: MobileEquipmentLease[];
  onUpdateLease: (lease: Lease) => void;
  onDeleteLease: (leaseId: string) => void;
  onCopyLease: (lease: Lease) => void;
  entityName: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  propertyLeases,
  mobileEquipmentLeases,
  onUpdateLease,
  onDeleteLease,
  onCopyLease,
  entityName
}) => {
  const [hoveredLease, setHoveredLease] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Measure header height so the panel sits below it
  useEffect(() => {
    const header = document.querySelector('.lease-dashboard-header') as HTMLElement;
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }
  }, []);
  const [editedLease, setEditedLease] = useState<Lease | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [editCommittedYears, setEditCommittedYears] = useState(0);
  const [monthlyRentInput, setMonthlyRentInput] = useState('');
  const [showAddOpeningBalance, setShowAddOpeningBalance] = useState(false);
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
  const [propertySearch, setPropertySearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');

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

  // Side panel resize state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth)));
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Determine which table the selected lease belongs to
  const selectedLeaseTable = selectedLeaseId
    ? propertyLeases.find(l => l.id === selectedLeaseId) ? 'property'
    : mobileEquipmentLeases.find(l => l.id === selectedLeaseId) ? 'mobile'
    : null
    : null;

  // Initialize/update editedLease when selectedLeaseId changes
  useEffect(() => {
    if (selectedLeaseId) {
      const lease = propertyLeases.find(l => l.id === selectedLeaseId)
        || mobileEquipmentLeases.find(l => l.id === selectedLeaseId);
      if (lease) {
        setEditedLease({ ...lease });
        setMonthlyRentInput(lease.annualRent ? (parseFloat(lease.annualRent) / 12).toFixed(2) : '');
        setErrors({});
      } else {
        setSelectedLeaseId(null);
        setEditedLease(null);
      }
    } else {
      setEditedLease(null);
      setErrors({});
    }
  }, [selectedLeaseId]);

  // Calculate committed years for the edit panel
  useEffect(() => {
    if (!editedLease) {
      setEditCommittedYears(0);
      return;
    }
    if (editedLease.type === 'Property') {
      const propertyLease = editedLease as PropertyLease;
      if (propertyLease.commencementDate && propertyLease.expiryDate) {
        const start = new Date(propertyLease.commencementDate);
        const end = new Date(propertyLease.expiryDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;
        const optionsYears = parseInt(propertyLease.options) || 0;
        const totalMonths = adjustedMonths + (optionsYears * 12);
        const total = Math.ceil(totalMonths / 12);
        setEditCommittedYears(total > 0 ? total : 0);
      } else {
        setEditCommittedYears(0);
      }
    } else {
      const meLease = editedLease as MobileEquipmentLease;
      if (meLease.deliveryDate && meLease.expiryDate) {
        const start = new Date(meLease.deliveryDate);
        const end = new Date(meLease.expiryDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;
        const total = Math.ceil(adjustedMonths / 12);
        setEditCommittedYears(total > 0 ? total : 0);
      } else {
        setEditCommittedYears(0);
      }
    }
  }, [editedLease]);

  // Sync monthly rent input when editedLease.annualRent changes externally
  useEffect(() => {
    if (!editedLease) return;
    const calculatedMonthly = editedLease.annualRent ? (parseFloat(editedLease.annualRent) / 12).toFixed(2) : '';
    if (Math.abs(parseFloat(calculatedMonthly || '0') - parseFloat(monthlyRentInput || '0')) > 0.001 ||
        (!editedLease.annualRent && monthlyRentInput)) {
      setMonthlyRentInput(calculatedMonthly);
    }
  }, [editedLease?.annualRent]);

  // Search helpers
  const normalizeForSearch = (value: string): string => {
    return value.replace(/,/g, '').replace(/\$/g, '').toLowerCase().trim();
  };

  const isSearchMatch = (displayText: string, search: string): boolean => {
    if (!search) return false;
    return normalizeForSearch(displayText).includes(normalizeForSearch(search));
  };

  const highlightText = (text: string, search: string): React.ReactNode => {
    if (!search || !text) return text;
    const normalizedText = normalizeForSearch(text);
    const normalizedSearch = normalizeForSearch(search);
    if (!normalizedSearch || !normalizedText.includes(normalizedSearch)) return text;

    // Find match position in the normalized string, then map back to original
    const idx = normalizedText.indexOf(normalizedSearch);
    // Count how many chars were removed (commas, $) before idx
    let origIdx = 0;
    let normCount = 0;
    while (normCount < idx && origIdx < text.length) {
      const ch = text[origIdx];
      if (ch !== ',' && ch !== '$') normCount++;
      origIdx++;
    }
    // Find end
    let origEnd = origIdx;
    let matchCount = 0;
    while (matchCount < normalizedSearch.length && origEnd < text.length) {
      const ch = text[origEnd];
      if (ch !== ',' && ch !== '$') matchCount++;
      origEnd++;
    }

    return (
      <>
        {text.slice(0, origIdx)}
        <mark className="search-highlight">{text.slice(origIdx, origEnd)}</mark>
        {text.slice(origEnd)}
      </>
    );
  };

  const leaseMatchesSearch = (lease: PropertyLease | MobileEquipmentLease, search: string): boolean => {
    if (!search) return true;
    const committedYears = calculateCommittedYears(lease);
    const monthlyRent = formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2));
    const expiryDisplay = formatDate(getEffectiveExpiryDate(lease).toISOString());

    const values: string[] = [
      lease.leaseId, lease.entity, lease.lessor, lease.branch,
      expiryDisplay, monthlyRent, `${committedYears} years`,
    ];

    if (lease.type === 'Property') {
      const p = lease as PropertyLease;
      values.push(p.propertyAddress, formatDate(p.commencementDate), `${p.options} years`);
    } else {
      const m = lease as MobileEquipmentLease;
      values.push(m.description, m.regoNo, m.vehicleType, m.engineNumber, m.vinSerialNo, formatDate(m.deliveryDate));
    }

    return values.some(v => isSearchMatch(v, search));
  };

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
      generateExcelFromLeases(lease as PropertyLease, params, entityName);
    } else {
      generateExcelFromMobileEquipmentLeases(lease as MobileEquipmentLease, params, entityName);
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

  // Row click handler
  const handleRowClick = (leaseId: string) => {
    if (selectedLeaseId === leaseId) {
      setSelectedLeaseId(null);
    } else {
      setSelectedLeaseId(leaseId);
    }
  };

  // Edit form handlers
  const handleInputChange = (field: string, value: string) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, [field]: value } as Lease);
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const handleIncrementMethodChange = (year: number, value: string) => {
    if (!editedLease) return;
    const updatedMethods = { ...editedLease.incrementMethods, [year]: value };
    const updatedLease = { ...editedLease, incrementMethods: updatedMethods };
    if (value !== 'Market') {
      const updatedOverrides = { ...editedLease.overrideAmounts };
      delete updatedOverrides[year];
      updatedLease.overrideAmounts = updatedOverrides;
    }
    setEditedLease(updatedLease as Lease);
  };

  const handleOverrideAmountChange = (year: number, value: string) => {
    if (!editedLease) return;
    const updatedOverrides = { ...editedLease.overrideAmounts, [year]: value };
    setEditedLease({ ...editedLease, overrideAmounts: updatedOverrides } as Lease);
  };

  const validateForm = (): boolean => {
    if (!editedLease) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!editedLease.lessor?.trim()) { newErrors.lessor = true; isValid = false; }
    if (!editedLease.branch?.trim()) { newErrors.branch = true; isValid = false; }
    if (!editedLease.annualRent.trim()) { newErrors.annualRent = true; isValid = false; }
    if (!editedLease.borrowingRate.trim()) { newErrors.borrowingRate = true; isValid = false; }

    if (editedLease.type === 'Property') {
      const propertyLease = editedLease as PropertyLease;
      if (!propertyLease.propertyAddress?.trim()) { newErrors.propertyAddress = true; isValid = false; }
      if (!propertyLease.commencementDate) { newErrors.commencementDate = true; isValid = false; }
      if (!propertyLease.expiryDate) { newErrors.expiryDate = true; isValid = false; }
      if (!propertyLease.options.trim()) { newErrors.options = true; isValid = false; }
      if (!propertyLease.fixedIncrementRate.trim()) { newErrors.fixedIncrementRate = true; isValid = false; }
      if (!propertyLease.rbaCpiRate.trim()) { newErrors.rbaCpiRate = true; isValid = false; }

      if (editCommittedYears >= 1) {
        for (let year = 1; year <= editCommittedYears; year++) {
          if (!propertyLease.incrementMethods[year]) {
            newErrors[`incrementMethod_${year}`] = true; isValid = false;
          }
          if (propertyLease.incrementMethods[year] === 'Market' && !propertyLease.overrideAmounts[year]?.trim()) {
            newErrors[`overrideAmount_${year}`] = true; isValid = false;
          }
        }
      }
    } else {
      const meLease = editedLease as MobileEquipmentLease;
      if (!meLease.description?.trim()) { newErrors.description = true; isValid = false; }
      if (!meLease.vinSerialNo?.trim()) { newErrors.vinSerialNo = true; isValid = false; }
      if (!meLease.regoNo?.trim()) { newErrors.regoNo = true; isValid = false; }
      if (!meLease.deliveryDate) { newErrors.deliveryDate = true; isValid = false; }
      if (!meLease.expiryDate) { newErrors.expiryDate = true; isValid = false; }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = () => {
    if (!editedLease) return;
    if (validateForm()) {
      onUpdateLease(editedLease);
      setSelectedLeaseId(null);
    }
  };

  const handleCancel = () => {
    setSelectedLeaseId(null);
  };

  const handleAddOpeningBalance = (openingBalance: OpeningBalance) => {
    if (!editedLease) return;
    const updatedBalances = [...(editedLease.openingBalances || []), openingBalance];
    setEditedLease({ ...editedLease, openingBalances: updatedBalances } as Lease);
  };

  const handleDeleteOpeningBalance = (id: string) => {
    if (!editedLease) return;
    const updatedBalances = (editedLease.openingBalances || []).filter((ob) => ob.id !== id);
    setEditedLease({ ...editedLease, openingBalances: updatedBalances } as Lease);
  };

  const renderIncrementMethodsTooltip = (lease: Lease) => {
    const committedYears = calculateCommittedYears(lease);
    if (committedYears < 1) return null;
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

  // Inline detail panel
  const renderDetailPanel = () => {
    if (!editedLease || !selectedLeaseId) return null;

    const isPropertyLease = editedLease.type === 'Property';
    const sortedBalances = [...(editedLease.openingBalances || [])].sort(
      (a, b) => new Date(a.openingDate).getTime() - new Date(b.openingDate).getTime()
    );
    const obFormatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const obFormatCurrency = (value: number): string => {
      return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
      <div
        className="lease-side-panel"
        ref={panelRef}
        style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}
      >
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
        <div className="lease-detail-header">
          <button
            className="download-btn"
            onClick={() => {
              const lease = propertyLeases.find(l => l.id === selectedLeaseId)
                || mobileEquipmentLeases.find(l => l.id === selectedLeaseId);
              if (lease) setXlsxModalLease(lease);
            }}
          >
            AASB16
          </button>
          <button className="lease-detail-close" onClick={handleCancel}>
            <CloseIcon />
          </button>
        </div>

        <div className="form-grid">
          {/* Entity */}
          <div className="form-group">
            <label className="form-label">Entity</label>
            <input type="text" className="form-input readonly-input" value={editedLease.entity} readOnly disabled />
          </div>

          {/* Lessor */}
          <div className="form-group">
            <label className="form-label">Lessor *</label>
            {errors.lessor && <span className="error-text">This field is required</span>}
            <input
              type="text"
              className={errors.lessor ? 'form-input-error' : 'form-input'}
              value={editedLease.lessor}
              onChange={(e) => handleInputChange('lessor', e.target.value)}
              placeholder="Enter lessor"
            />
          </div>

          {/* Property fields */}
          {isPropertyLease && (
            <>
              <div className="form-group">
                <label className="form-label">Property Address *</label>
                {errors.propertyAddress && <span className="error-text">This field is required</span>}
                <input
                  type="text"
                  className={errors.propertyAddress ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).propertyAddress}
                  onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                  placeholder="Enter property address"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Branch *</label>
                {errors.branch && <span className="error-text">This field is required</span>}
                <select
                  className={errors.branch ? 'form-input-error' : 'form-input'}
                  value={editedLease.branch}
                  onChange={(e) => handleInputChange('branch', e.target.value)}
                >
                  <option value="">Select branch...</option>
                  {BRANCH_OPTIONS.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Commencement Date *</label>
                {errors.commencementDate && <span className="error-text">This field is required</span>}
                <input
                  type="date"
                  className={errors.commencementDate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).commencementDate}
                  onChange={(e) => handleInputChange('commencementDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date *</label>
                {errors.expiryDate && <span className="error-text">This field is required</span>}
                <input
                  type="date"
                  className={errors.expiryDate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Options (Years) *</label>
                {errors.options && <span className="error-text">This field is required</span>}
                <input
                  type="number"
                  className={errors.options ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).options}
                  onChange={(e) => handleInputChange('options', e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
            </>
          )}

          {/* Mobile Equipment fields */}
          {!isPropertyLease && (
            <>
              <div className="form-group">
                <label className="form-label">Description *</label>
                {errors.description && <span className="error-text">This field is required</span>}
                <input
                  type="text"
                  className={errors.description ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter description"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Branch *</label>
                {errors.branch && <span className="error-text">This field is required</span>}
                <select
                  className={errors.branch ? 'form-input-error' : 'form-input'}
                  value={editedLease.branch}
                  onChange={(e) => handleInputChange('branch', e.target.value)}
                >
                  <option value="">Select branch...</option>
                  {BRANCH_OPTIONS.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type *</label>
                {errors.vehicleType && <span className="error-text">This field is required</span>}
                <select
                  className={errors.vehicleType ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).vehicleType}
                  onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                >
                  <option value="">Select vehicle type...</option>
                  <option value="Ute">Ute</option>
                  <option value="Wagon">Wagon</option>
                  <option value="Forklift">Forklift</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Engine Number *</label>
                {errors.engineNumber && <span className="error-text">This field is required</span>}
                <input
                  type="text"
                  className={errors.engineNumber ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).engineNumber}
                  onChange={(e) => handleInputChange('engineNumber', e.target.value)}
                  placeholder="Enter Engine Number"
                />
              </div>
              <div className="form-group">
                <label className="form-label">VIN/Serial No. *</label>
                {errors.vinSerialNo && <span className="error-text">This field is required</span>}
                <input
                  type="text"
                  className={errors.vinSerialNo ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).vinSerialNo}
                  onChange={(e) => handleInputChange('vinSerialNo', e.target.value)}
                  placeholder="Enter VIN/Serial No."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rego/Equipment No. *</label>
                {errors.regoNo && <span className="error-text">This field is required</span>}
                <input
                  type="text"
                  className={errors.regoNo ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).regoNo}
                  onChange={(e) => handleInputChange('regoNo', e.target.value)}
                  placeholder="Enter Rego No."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date *</label>
                {errors.deliveryDate && <span className="error-text">This field is required</span>}
                <input
                  type="date"
                  className={errors.deliveryDate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).deliveryDate}
                  onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date *</label>
                {errors.expiryDate && <span className="error-text">This field is required</span>}
                <input
                  type="date"
                  className={errors.expiryDate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as MobileEquipmentLease).expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Monthly Rent */}
          <div className="form-group">
            <label className="form-label">Monthly Rent (exc. GST) *</label>
            {errors.annualRent && <span className="error-text">This field is required</span>}
            <input
              type="number"
              className={errors.annualRent ? 'form-input-error' : 'form-input'}
              value={monthlyRentInput}
              onChange={(e) => {
                const monthlyValue = e.target.value;
                setMonthlyRentInput(monthlyValue);
                const annualValue = monthlyValue ? (parseFloat(monthlyValue) * 12).toString() : '';
                handleInputChange('annualRent', annualValue);
              }}
              onBlur={() => {
                if (monthlyRentInput) {
                  setMonthlyRentInput(parseFloat(monthlyRentInput).toFixed(2));
                }
              }}
              placeholder="0.00"
              step="0.01"
            />
          </div>

          {/* RBA CPI Rate - Property only */}
          {isPropertyLease && (
            <div className="form-group">
              <label className="form-label">RBA CPI Rate (%) *</label>
              {errors.rbaCpiRate && <span className="error-text">This field is required</span>}
              <input
                type="number"
                className={errors.rbaCpiRate ? 'form-input-error' : 'form-input'}
                value={(editedLease as PropertyLease).rbaCpiRate}
                onChange={(e) => handleInputChange('rbaCpiRate', e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>
          )}

          {/* Borrowing Rate */}
          <div className="form-group">
            <label className="form-label">Borrowing Rate (%) *</label>
            {errors.borrowingRate && <span className="error-text">This field is required</span>}
            <input
              type="number"
              className={errors.borrowingRate ? 'form-input-error' : 'form-input'}
              value={editedLease.borrowingRate}
              onChange={(e) => handleInputChange('borrowingRate', e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>

          {/* Fixed Increment Rate - Property only */}
          {isPropertyLease && (
            <div className="form-group">
              <label className="form-label">Fixed Increment Rate (%) *</label>
              {errors.fixedIncrementRate && <span className="error-text">This field is required</span>}
              <input
                type="number"
                className={errors.fixedIncrementRate ? 'form-input-error' : 'form-input'}
                value={(editedLease as PropertyLease).fixedIncrementRate}
                onChange={(e) => handleInputChange('fixedIncrementRate', e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>
          )}
        </div>

        {/* Increment Methods - Property only */}
        {isPropertyLease && editCommittedYears >= 1 && (
          <div className="increment-compact-section">
            <label className="form-label">Increment Methods</label>
            <div className="increment-compact-list">
              {Array.from({ length: editCommittedYears }, (_, i) => i + 1).map((year) => (
                <div key={year} className="increment-compact-row">
                  <span className="increment-compact-label">Yr {year}</span>
                  <select
                    value={editedLease.incrementMethods[year] || ''}
                    onChange={(e) => handleIncrementMethodChange(year, e.target.value)}
                    className={errors[`incrementMethod_${year}`] ? 'form-input-error increment-compact-select' : 'form-input increment-compact-select'}
                  >
                    <option value="">Select...</option>
                    <option value="Fixed">Fix Rate</option>
                    <option value="Market">Market</option>
                    <option value="CPI">CPI</option>
                    <option value="None">None</option>
                  </select>
                  {editedLease.incrementMethods[year] === 'Market' && (
                    <input
                      type="number"
                      className={errors[`overrideAmount_${year}`] ? 'form-input-error increment-compact-input' : 'form-input increment-compact-input'}
                      value={editedLease.overrideAmounts[year] || ''}
                      onChange={(e) => handleOverrideAmountChange(year, e.target.value)}
                      placeholder="Override $"
                      step="0.01"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opening Balances */}
        <div className="opening-balance-inline">
          <div className="opening-balance-inline-header">
            <h4>Opening Balances</h4>
            <button
              className="add-opening-balance-button"
              onClick={() => setShowAddOpeningBalance(true)}
            >
              Add
            </button>
          </div>
          {sortedBalances.length === 0 ? (
            <div className="ob-empty">No opening balances added yet.</div>
          ) : (
            <div className="ob-card-list">
              {sortedBalances.map((ob) => (
                <div key={ob.id} className="ob-card">
                  <div className="ob-card-header">
                    <span className="ob-card-date">{obFormatDate(ob.openingDate)}</span>
                    <div className="ob-card-header-right">
                      <span className="ob-card-badge">{ob.isNewLeaseExtension ? 'New / Extension' : 'Existing'}</span>
                      <button
                        className="opening-balance-delete-button"
                        onClick={() => handleDeleteOpeningBalance(ob.id)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </div>
                  <div className="ob-card-grid">
                    <div className="ob-card-field">
                      <span className="ob-card-label">Right to Use Assets</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.rightToUseAssets)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Acc. Depr ROU Assets</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.accDeprRightToUseAssets)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Liability - Current</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.leaseLiabilityCurrent)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Liability - Non-Current</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.leaseLiabilityNonCurrent)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Depreciation Expense</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.depreciationExpense)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Interest Expense Rent</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.interestExpenseRent)}</span>
                    </div>
                    <div className="ob-card-field">
                      <span className="ob-card-label">Rent Expense</span>
                      <span className="ob-card-value">{obFormatCurrency(ob.rentExpense)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>
        <div className="lease-detail-actions">
          <button className="panel-btn" onClick={() => {
            if (selectedLeaseId) {
              onDeleteLease(selectedLeaseId);
              setSelectedLeaseId(null);
            }
          }}>
            Delete
          </button>
          <div className="lease-detail-actions-right">
            <button className="panel-btn" onClick={handleCancel}>Cancel</button>
            <button className="panel-btn" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  const renderPropertyTableRows = () => {
    const rows = [];
    const filteredLeases = filterLeases(propertyLeases, propertyFilter);
    const sortedLeases = sortData(filteredLeases, propertySortConfig)
      .filter(l => leaseMatchesSearch(l, propertySearch));

    const handleMouseEnter = (lease: PropertyLease, event: React.MouseEvent<HTMLTableCellElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left,
        y: rect.bottom + 8
      });
      setHoveredLease(lease.id);
    };

    const s = propertySearch;
    const h = (text: string) => s ? highlightText(text, s) : text;

    for (let i = 0; i < Math.max(emptyRows, sortedLeases.length); i++) {
      const lease = sortedLeases[i];
      const committedYears = lease ? calculateCommittedYears(lease) : 0;

      rows.push(
        <tr
          key={lease?.id || `empty-${i}`}
          className={lease && selectedLeaseId === lease.id ? 'selected-row' : ''}
          onClick={() => lease && handleRowClick(lease.id)}
          style={lease ? { cursor: 'pointer' } : undefined}
        >
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
          <td>{lease ? h(lease.leaseId) : ''}</td>
          <td>{lease ? h(lease.entity) : ''}</td>
          <td>{lease ? h(lease.lessor) : ''}</td>
          <td>{lease ? h(lease.propertyAddress) : ''}</td>
          <td>{lease ? h(lease.branch) : ''}</td>
          <td>{lease ? h(formatDate(lease.commencementDate)) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>
            {lease ? h(formatDate(getEffectiveExpiryDate(lease).toISOString())) : ''}
          </td>
          <td>{lease ? h(`${lease.options} years`) : ''}</td>
          <td
            className={lease ? 'committed-years-cell' : ''}
            onMouseEnter={(e) => lease && handleMouseEnter(lease, e)}
            onMouseLeave={() => setHoveredLease(null)}
          >
            {lease ? h(`${committedYears} years`) : ''}
          </td>
          <td>{lease ? h(formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2))) : ''}</td>
          <td>
            {lease && (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isLeaseExpired(lease) ? '#dc3545' : (isWithinThreeMonthsOfExpiry(lease) ? '#ff9c1bff' : '#28a745'),
                  cursor: 'help',
                }}
                title={isLeaseExpired(lease) ? 'Lease expired' : 'Lease active'}
              />
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
    const sortedLeases = sortData(filteredLeases, mobileEquipmentSortConfig)
      .filter(l => leaseMatchesSearch(l, mobileSearch));

    const s = mobileSearch;
    const h = (text: string) => s ? highlightText(text, s) : text;

    for (let i = 0; i < Math.max(emptyRows, sortedLeases.length); i++) {
      const lease = sortedLeases[i];
      const leasePeriod = lease ? calculateCommittedYears(lease) : 0;
      rows.push(
        <tr
          key={lease?.id || `empty-${i}`}
          className={lease && selectedLeaseId === lease.id ? 'selected-row' : ''}
          onClick={() => lease && handleRowClick(lease.id)}
          style={lease ? { cursor: 'pointer' } : undefined}
        >
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
          <td>{lease ? h(lease.leaseId) : ''}</td>
          <td>{lease ? h(lease.entity) : ''}</td>
          <td>{lease ? h(lease.lessor) : ''}</td>
          <td>{lease ? h(lease.regoNo) : ''}</td>
          <td>{lease ? <span className="cell-clamp" title={lease.description}>{s ? highlightText(lease.description, s) : lease.description}</span> : ''}</td>
          <td>{lease ? h(lease.branch) : ''}</td>
          <td>{lease ? h(lease.vehicleType) : ''}</td>
          <td>{lease ? h(lease.engineNumber) : ''}</td>
          <td>{lease ? h(lease.vinSerialNo) : ''}</td>
          <td>{lease ? h(formatDate(lease.deliveryDate)) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>
            {lease ? h(formatDate(getEffectiveExpiryDate(lease).toISOString())) : ''}
          </td>
          <td>{lease ? h(`${leasePeriod} years`) : ''}</td>
          <td>{lease ? h(formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2))) : ''}</td>
          <td>
            {lease && (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isLeaseExpired(lease) ? '#dc3545' : '#28a745',
                  cursor: 'help',
                }}
                title={isLeaseExpired(lease) ? 'Lease expired' : 'Lease active'}
              />
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

      if (sortConfig.key === 'committedYears') {
        aValue = calculateCommittedYears(a);
        bValue = calculateCommittedYears(b);
      } else {
        aValue = a[sortConfig.key as keyof T];
        bValue = b[sortConfig.key as keyof T];
      }

      if (sortConfig.key && sortConfig.key.toLowerCase().includes('date')) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortConfig.key && ['annualRent', 'borrowingRate', 'rbaCpiRate', 'fixedIncrementRate', 'options', 'committedYears'].includes(sortConfig.key)) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key: string, isPropertyTable: boolean) => {
    const sortConfig = isPropertyTable ? propertySortConfig : mobileEquipmentSortConfig;
    const setSortConfig = isPropertyTable ? setPropertySortConfig : setMobileEquipmentSortConfig;

    if (sortConfig.key !== key) {
      setSortConfig({ key, direction: 'asc' });
    } else if (sortConfig.direction === 'asc') {
      setSortConfig({ key, direction: 'desc' });
    } else {
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
      setState(new Set());
    } else {
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
      const copiedLease: Lease = {
        ...lease,
        id: crypto.randomUUID(),
        leaseId: generateLeaseId(lease.type),
      };
      await onCopyLease(copiedLease);
    }

    setState(new Set());
  };

  const handleBatchDelete = (isPropertyTable: boolean) => {
    const selectedSet = isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;
    if (selectedSet.size === 0) return;
    setBatchDeleteContext({ isPropertyTable, count: selectedSet.size });
    setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (!batchDeleteContext) return;

    const selectedSet = batchDeleteContext.isPropertyTable ? selectedPropertyLeases : selectedMobileLeases;
    const setState = batchDeleteContext.isPropertyTable ? setSelectedPropertyLeases : setSelectedMobileLeases;

    const leaseIdsToDelete = Array.from(selectedSet);
    for (const leaseId of leaseIdsToDelete) {
      await onDeleteLease(leaseId);
    }

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
    <div className={`dashboard-split${selectedLeaseId ? ' panel-open' : ''}`}>
    <div className="dashboard-main" style={selectedLeaseId ? { marginRight: `${panelWidth}px` } : undefined}>
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
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
          />
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
                <th style={{ width: '40px', minWidth: '40px' }}></th>
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
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
          />
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
                <th style={{ width: '40px', minWidth: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {renderMobileEquipmentTableRows()}
            </tbody>
          </table>
        </div>
      </div>

      {xlsxModalLease && (
        <ToXLSXModal
          onClose={() => setXlsxModalLease(null)}
          onGenerate={(params) => handleGenerateExcel(xlsxModalLease, params)}
          openingBalances={xlsxModalLease.openingBalances}
        />
      )}

      {showAddOpeningBalance && editedLease && (
        <AddOpeningBalanceForm
          existingDates={(editedLease.openingBalances || []).map(ob => ob.openingDate)}
          onAdd={handleAddOpeningBalance}
          onClose={() => setShowAddOpeningBalance(false)}
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
    </div>

    {selectedLeaseId && renderDetailPanel()}
    </div>
  );
};

export default Dashboard;
