import React, { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Lease, PropertyLease, OpeningBalance, Branch } from '../../types/Lease';
import { generateExcelFromLeases } from './excel/excelGenerator';
import { exportPropertyLeasesToExcel } from './excel/tableExporter';
import ToXLSXModal, { XLSXGenerationParams } from './ToXLSXModal';
import AddOpeningBalanceForm from './AddOpeningBalanceForm';
import './Dashboard.css';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { formatCurrency, formatDate, getYearDiff, generateLeaseId } from '../../utils/helper';
import { View } from '../Layout/Sidebar';

const BRANCH_OPTIONS: Branch[] = ['PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'CORP', 'PERT-RTS', 'MACK-RTS', 'ADEL-RTS', 'PARK'];
const DEFAULT_PANEL_WIDTH = 520;
const MIN_PANEL_WIDTH = 380;
const MAX_PANEL_WIDTH = 900;

interface PropertyLeasesPageProps {
  propertyLeases: PropertyLease[];
  onUpdateLease: (lease: Lease) => void;
  onDeleteLease: (leaseId: string) => void;
  onCopyLease: (lease: Lease) => void;
  entityName: string;
  onAddLease: () => void;
  onOpenReport: () => void;
  isEntitySelected: boolean;
  onNavigate: (view: View) => void;
}

const PropertyLeasesPage: React.FC<PropertyLeasesPageProps> = ({
  propertyLeases,
  onUpdateLease,
  onDeleteLease,
  onCopyLease,
  entityName,
  onAddLease,
  onOpenReport,
  isEntitySelected,
  onNavigate,
}) => {
  const [hoveredLease, setHoveredLease] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [editedLease, setEditedLease] = useState<Lease | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [editCommittedYears, setEditCommittedYears] = useState(0);
  const [monthlyRentInput, setMonthlyRentInput] = useState('');
  const [showAddOpeningBalance, setShowAddOpeningBalance] = useState(false);
  const [xlsxModalLease, setXlsxModalLease] = useState<PropertyLease | null>(null);
  const emptyRows = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Non-Active'>('All');
  const [search, setSearch] = useState('');
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

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

  useEffect(() => {
    if (selectedLeaseId) {
      const lease = propertyLeases.find(l => l.id === selectedLeaseId);
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
  }, [selectedLeaseId, propertyLeases]);

  useEffect(() => {
    if (!editedLease) { setEditCommittedYears(0); return; }
    const propertyLease = editedLease as PropertyLease;
    if (propertyLease.commencementDate && propertyLease.expiryDate) {
      const start = new Date(propertyLease.commencementDate);
      const end = new Date(propertyLease.expiryDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;
      const optionsYears = parseInt(propertyLease.options) || 0;
      const totalMonths = adjustedMonths + (optionsYears * 12);
      const total = Math.ceil(totalMonths / 12);
      setEditCommittedYears(total > 0 ? total : 0);
    } else {
      setEditCommittedYears(0);
    }
  }, [editedLease]);

  useEffect(() => {
    if (!editedLease) return;
    const calculatedMonthly = editedLease.annualRent ? (parseFloat(editedLease.annualRent) / 12).toFixed(2) : '';
    if (Math.abs(parseFloat(calculatedMonthly || '0') - parseFloat(monthlyRentInput || '0')) > 0.001 ||
        (!editedLease.annualRent && monthlyRentInput)) {
      setMonthlyRentInput(calculatedMonthly);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedLease?.annualRent]);

  // Search helpers
  const normalizeForSearch = (value: string): string => value.replace(/,/g, '').replace(/\$/g, '').toLowerCase().trim();
  const isSearchMatch = (displayText: string, s: string): boolean => {
    if (!s) return false;
    return normalizeForSearch(displayText).includes(normalizeForSearch(s));
  };
  const highlightText = (text: string, s: string): React.ReactNode => {
    if (!s || !text) return text;
    const normalizedText = normalizeForSearch(text);
    const normalizedSearch = normalizeForSearch(s);
    if (!normalizedSearch || !normalizedText.includes(normalizedSearch)) return text;
    const idx = normalizedText.indexOf(normalizedSearch);
    let origIdx = 0, normCount = 0;
    while (normCount < idx && origIdx < text.length) {
      const ch = text[origIdx];
      if (ch !== ',' && ch !== '$') normCount++;
      origIdx++;
    }
    let origEnd = origIdx, matchCount = 0;
    while (matchCount < normalizedSearch.length && origEnd < text.length) {
      const ch = text[origEnd];
      if (ch !== ',' && ch !== '$') matchCount++;
      origEnd++;
    }
    return (<>{text.slice(0, origIdx)}<mark className="search-highlight">{text.slice(origIdx, origEnd)}</mark>{text.slice(origEnd)}</>);
  };

  const calculateCommittedYears = (lease: PropertyLease): number => {
    if (lease.commencementDate && lease.expiryDate) {
      const start = new Date(lease.commencementDate);
      const end = new Date(lease.expiryDate);
      const yearsDiff = getYearDiff(start, end);
      const optionsYears = parseInt(lease.options) || 0;
      const total = Math.floor(yearsDiff + optionsYears);
      return total > 0 ? total : 0;
    }
    return 0;
  };

  const getEffectiveExpiryDate = (lease: PropertyLease): Date => {
    const expiryDate = new Date(lease.expiryDate);
    const options = parseInt(lease.options) || 0;
    expiryDate.setFullYear(expiryDate.getFullYear() + options);
    return expiryDate;
  };

  const isLeaseActive = (lease: PropertyLease): boolean => {
    const currentYear = new Date().getFullYear();
    return getEffectiveExpiryDate(lease).getFullYear() >= currentYear;
  };

  const isLeaseExpired = (lease: PropertyLease): boolean => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const effective = getEffectiveExpiryDate(lease); effective.setHours(0, 0, 0, 0);
    return effective < today;
  };

  const isWithinThreeMonthsOfExpiry = (lease: PropertyLease): boolean => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const effective = getEffectiveExpiryDate(lease); effective.setHours(0, 0, 0, 0);
    const threeMonths = new Date(today); threeMonths.setMonth(threeMonths.getMonth() + 3);
    return effective <= threeMonths && effective >= today;
  };

  const filterLeases = (leases: PropertyLease[], f: 'All' | 'Active' | 'Non-Active'): PropertyLease[] => {
    if (f === 'All') return leases;
    if (f === 'Active') return leases.filter(l => isLeaseActive(l));
    return leases.filter(l => !isLeaseActive(l));
  };

  const leaseMatchesSearch = (lease: PropertyLease, s: string): boolean => {
    if (!s) return true;
    const committedYears = calculateCommittedYears(lease);
    const monthlyRent = formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2));
    const expiryDisplay = formatDate(getEffectiveExpiryDate(lease).toISOString());
    const values = [lease.leaseId, lease.entity, lease.lessor, lease.branch, expiryDisplay, monthlyRent, `${committedYears} years`, lease.propertyAddress, formatDate(lease.commencementDate), `${lease.options} years`];
    return values.some(v => isSearchMatch(v, s));
  };

  const sortData = (data: PropertyLease[], sc: { key: string | null; direction: 'asc' | 'desc' }): PropertyLease[] => {
    if (!sc.key) return data;
    return [...data].sort((a, b) => {
      let aValue: any, bValue: any;
      if (sc.key === 'committedYears') { aValue = calculateCommittedYears(a); bValue = calculateCommittedYears(b); }
      else { aValue = a[sc.key as keyof PropertyLease]; bValue = b[sc.key as keyof PropertyLease]; }
      if (sc.key && sc.key.toLowerCase().includes('date')) { aValue = new Date(aValue).getTime(); bValue = new Date(bValue).getTime(); }
      else if (sc.key && ['annualRent', 'borrowingRate', 'rbaCpiRate', 'fixedIncrementRate', 'options', 'committedYears'].includes(sc.key)) { aValue = parseFloat(aValue) || 0; bValue = parseFloat(bValue) || 0; }
      else { aValue = String(aValue || '').toLowerCase(); bValue = String(bValue || '').toLowerCase(); }
      if (aValue < bValue) return sc.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sc.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key: string) => {
    if (sortConfig.key !== key) setSortConfig({ key, direction: 'asc' });
    else if (sortConfig.direction === 'asc') setSortConfig({ key, direction: 'desc' });
    else setSortConfig({ key: null, direction: 'asc' });
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortConfig.key !== columnKey) return null;
    return <span style={{ marginLeft: '4px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };
  const isSorted = (columnKey: string) => sortConfig.key === columnKey;

  const handleRowClick = (leaseId: string) => setSelectedLeaseId(selectedLeaseId === leaseId ? null : leaseId);

  const handleInputChange = (field: string, value: string) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, [field]: value } as Lease);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const handleIncrementMethodChange = (year: number, value: string) => {
    if (!editedLease) return;
    const updatedMethods = { ...editedLease.incrementMethods, [year]: value };
    const updatedLease = { ...editedLease, incrementMethods: updatedMethods };
    if (value !== 'Market') { const updatedOverrides = { ...editedLease.overrideAmounts }; delete updatedOverrides[year]; updatedLease.overrideAmounts = updatedOverrides; }
    setEditedLease(updatedLease as Lease);
  };

  const handleOverrideAmountChange = (year: number, value: string) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, overrideAmounts: { ...editedLease.overrideAmounts, [year]: value } } as Lease);
  };

  const validateForm = (): boolean => {
    if (!editedLease) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;
    if (!editedLease.lessor?.trim()) { newErrors.lessor = true; isValid = false; }
    if (!editedLease.branch?.trim()) { newErrors.branch = true; isValid = false; }
    if (!editedLease.annualRent.trim()) { newErrors.annualRent = true; isValid = false; }
    if (!editedLease.borrowingRate.trim()) { newErrors.borrowingRate = true; isValid = false; }
    const pl = editedLease as PropertyLease;
    if (!pl.propertyAddress?.trim()) { newErrors.propertyAddress = true; isValid = false; }
    if (!pl.commencementDate) { newErrors.commencementDate = true; isValid = false; }
    if (!pl.expiryDate) { newErrors.expiryDate = true; isValid = false; }
    if (!pl.options.trim()) { newErrors.options = true; isValid = false; }
    if (!pl.fixedIncrementRate.trim()) { newErrors.fixedIncrementRate = true; isValid = false; }
    if (!pl.rbaCpiRate.trim()) { newErrors.rbaCpiRate = true; isValid = false; }
    if (editCommittedYears >= 1) {
      for (let year = 1; year <= editCommittedYears; year++) {
        if (!pl.incrementMethods[year]) { newErrors[`incrementMethod_${year}`] = true; isValid = false; }
        if (pl.incrementMethods[year] === 'Market' && !pl.overrideAmounts[year]?.trim()) { newErrors[`overrideAmount_${year}`] = true; isValid = false; }
      }
    }
    setErrors(newErrors);
    return isValid;
  };

  const handleSave = () => { if (editedLease && validateForm()) { onUpdateLease(editedLease); setSelectedLeaseId(null); } };
  const handleCancel = () => setSelectedLeaseId(null);

  const handleAddOpeningBalance = (ob: OpeningBalance) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, openingBalances: [...(editedLease.openingBalances || []), ob] } as Lease);
  };
  const handleDeleteOpeningBalance = (id: string) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, openingBalances: (editedLease.openingBalances || []).filter(ob => ob.id !== id) } as Lease);
  };

  const handleToggleSelect = (leaseId: string) => {
    setSelectedLeases(prev => { const n = new Set(prev); if (n.has(leaseId)) n.delete(leaseId); else n.add(leaseId); return n; });
  };
  const handleSelectAll = () => {
    const filtered = filterLeases(propertyLeases, filter);
    if (selectedLeases.size === filtered.length && selectedLeases.size > 0) setSelectedLeases(new Set());
    else setSelectedLeases(new Set(filtered.map(l => l.id)));
  };

  const handleBatchCopy = async () => {
    const toCopy = propertyLeases.filter(l => selectedLeases.has(l.id));
    for (const lease of toCopy) {
      const copiedLease: Lease = { ...lease, id: crypto.randomUUID(), leaseId: generateLeaseId(lease.type) };
      await onCopyLease(copiedLease);
    }
    setSelectedLeases(new Set());
  };
  const handleBatchDelete = () => { if (selectedLeases.size > 0) setShowBatchDeleteConfirm(true); };
  const handleConfirmBatchDelete = async () => {
    for (const leaseId of Array.from(selectedLeases)) await onDeleteLease(leaseId);
    setSelectedLeases(new Set());
    setShowBatchDeleteConfirm(false);
  };
  const handleBatchExport = () => {
    if (selectedLeases.size === 0) return;
    const toExport = propertyLeases.filter(l => selectedLeases.has(l.id));
    const timestamp = new Date().toISOString().split('T')[0];
    exportPropertyLeasesToExcel(toExport, `PropertyLeases_${timestamp}.xlsx`);
  };

  useEffect(() => {
    if (selectAllRef.current) {
      const filteredCount = filterLeases(propertyLeases, filter).length;
      selectAllRef.current.indeterminate = selectedLeases.size > 0 && selectedLeases.size < filteredCount;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeases, propertyLeases, filter]);

  useEffect(() => { setSelectedLeases(new Set()); }, [filter]);

  const handleGenerateExcel = (lease: PropertyLease, params: XLSXGenerationParams) => {
    generateExcelFromLeases(lease, params, entityName);
  };

  const renderIncrementMethodsTooltip = (lease: PropertyLease) => {
    const committedYears = calculateCommittedYears(lease);
    if (committedYears < 1) return null;
    return (
      <div className="tooltip" style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}>
        <div className="tooltip-header">Increment Methods</div>
        {Array.from({ length: committedYears }, (_, i) => i + 1).map(year => (
          <div key={year} className="tooltip-row"><strong>Year {year}:</strong> {lease.incrementMethods[year] || 'Not set'}</div>
        ))}
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!editedLease || !selectedLeaseId) return null;
    const sortedBalances = [...(editedLease.openingBalances || [])].sort((a, b) => new Date(a.openingDate).getTime() - new Date(b.openingDate).getTime());
    const obFormatDate = (dateString: string): string => new Date(dateString).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const obFormatCurrency = (value: number): string => value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header">
            <button className="download-btn" onClick={() => { const lease = propertyLeases.find(l => l.id === selectedLeaseId); if (lease) setXlsxModalLease(lease); }}>AASB16</button>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Entity</label><input type="text" className="form-input readonly-input" value={editedLease.entity} readOnly disabled /></div>
            <div className="form-group"><label className="form-label">Lessor *</label>{errors.lessor && <span className="error-text">This field is required</span>}<input type="text" className={errors.lessor ? 'form-input-error' : 'form-input'} value={editedLease.lessor} onChange={(e) => handleInputChange('lessor', e.target.value)} placeholder="Enter lessor" /></div>
            <div className="form-group"><label className="form-label">Property Address *</label>{errors.propertyAddress && <span className="error-text">This field is required</span>}<input type="text" className={errors.propertyAddress ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).propertyAddress} onChange={(e) => handleInputChange('propertyAddress', e.target.value)} placeholder="Enter property address" /></div>
            <div className="form-group"><label className="form-label">Branch *</label>{errors.branch && <span className="error-text">This field is required</span>}<select className={errors.branch ? 'form-input-error' : 'form-input'} value={editedLease.branch} onChange={(e) => handleInputChange('branch', e.target.value)}><option value="">Select branch...</option>{BRANCH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Commencement Date *</label>{errors.commencementDate && <span className="error-text">This field is required</span>}<input type="date" className={errors.commencementDate ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).commencementDate} onChange={(e) => handleInputChange('commencementDate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Expiry Date *</label>{errors.expiryDate && <span className="error-text">This field is required</span>}<input type="date" className={errors.expiryDate ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).expiryDate} onChange={(e) => handleInputChange('expiryDate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Options (Years) *</label>{errors.options && <span className="error-text">This field is required</span>}<input type="number" className={errors.options ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).options} onChange={(e) => handleInputChange('options', e.target.value)} placeholder="0" min="0" /></div>
            <div className="form-group"><label className="form-label">Monthly Rent (exc. GST) *</label>{errors.annualRent && <span className="error-text">This field is required</span>}<input type="number" className={errors.annualRent ? 'form-input-error' : 'form-input'} value={monthlyRentInput} onChange={(e) => { setMonthlyRentInput(e.target.value); handleInputChange('annualRent', e.target.value ? (parseFloat(e.target.value) * 12).toString() : ''); }} onBlur={() => { if (monthlyRentInput) setMonthlyRentInput(parseFloat(monthlyRentInput).toFixed(2)); }} placeholder="0.00" step="0.01" /></div>
            <div className="form-group"><label className="form-label">RBA CPI Rate (%) *</label>{errors.rbaCpiRate && <span className="error-text">This field is required</span>}<input type="number" className={errors.rbaCpiRate ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).rbaCpiRate} onChange={(e) => handleInputChange('rbaCpiRate', e.target.value)} placeholder="0.00" step="0.01" /></div>
            <div className="form-group"><label className="form-label">Borrowing Rate (%) *</label>{errors.borrowingRate && <span className="error-text">This field is required</span>}<input type="number" className={errors.borrowingRate ? 'form-input-error' : 'form-input'} value={editedLease.borrowingRate} onChange={(e) => handleInputChange('borrowingRate', e.target.value)} placeholder="0.00" step="0.01" /></div>
            <div className="form-group"><label className="form-label">Fixed Increment Rate (%) *</label>{errors.fixedIncrementRate && <span className="error-text">This field is required</span>}<input type="number" className={errors.fixedIncrementRate ? 'form-input-error' : 'form-input'} value={(editedLease as PropertyLease).fixedIncrementRate} onChange={(e) => handleInputChange('fixedIncrementRate', e.target.value)} placeholder="0.00" step="0.01" /></div>
          </div>

          {editCommittedYears >= 1 && (
            <div className="increment-compact-section">
              <label className="form-label">Increment Methods</label>
              <div className="increment-compact-list">
                {Array.from({ length: editCommittedYears }, (_, i) => i + 1).map(year => (
                  <div key={year} className="increment-compact-row">
                    <span className="increment-compact-label">Yr {year}</span>
                    <select value={editedLease.incrementMethods[year] || ''} onChange={(e) => handleIncrementMethodChange(year, e.target.value)} className={errors[`incrementMethod_${year}`] ? 'form-input-error increment-compact-select' : 'form-input increment-compact-select'}>
                      <option value="">Select...</option><option value="Fixed">Fix Rate</option><option value="Market">Market</option><option value="CPI">CPI</option><option value="None">None</option>
                    </select>
                    {editedLease.incrementMethods[year] === 'Market' && (
                      <input type="number" className={errors[`overrideAmount_${year}`] ? 'form-input-error increment-compact-input' : 'form-input increment-compact-input'} value={editedLease.overrideAmounts[year] || ''} onChange={(e) => handleOverrideAmountChange(year, e.target.value)} placeholder="Override $" step="0.01" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="opening-balance-inline">
            <div className="opening-balance-inline-header"><h4>Opening Balances</h4><button className="add-opening-balance-button" onClick={() => setShowAddOpeningBalance(true)}>Add</button></div>
            {sortedBalances.length === 0 ? <div className="ob-empty">No opening balances added yet.</div> : (
              <div className="ob-card-list">
                {sortedBalances.map(ob => (
                  <div key={ob.id} className="ob-card">
                    <div className="ob-card-header"><span className="ob-card-date">{obFormatDate(ob.openingDate)}</span><div className="ob-card-header-right"><span className="ob-card-badge">{ob.isNewLeaseExtension ? 'New / Extension' : 'Existing'}</span><button className="opening-balance-delete-button" onClick={() => handleDeleteOpeningBalance(ob.id)} title="Delete"><DeleteIcon fontSize="small" /></button></div></div>
                    <div className="ob-card-grid">
                      <div className="ob-card-field"><span className="ob-card-label">Right to Use Assets</span><span className="ob-card-value">{obFormatCurrency(ob.rightToUseAssets)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Acc. Depr ROU Assets</span><span className="ob-card-value">{obFormatCurrency(ob.accDeprRightToUseAssets)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Liability - Current</span><span className="ob-card-value">{obFormatCurrency(ob.leaseLiabilityCurrent)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Liability - Non-Current</span><span className="ob-card-value">{obFormatCurrency(ob.leaseLiabilityNonCurrent)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Depreciation Expense</span><span className="ob-card-value">{obFormatCurrency(ob.depreciationExpense)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Interest Expense Rent</span><span className="ob-card-value">{obFormatCurrency(ob.interestExpenseRent)}</span></div>
                      <div className="ob-card-field"><span className="ob-card-label">Rent Expense</span><span className="ob-card-value">{obFormatCurrency(ob.rentExpense)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="lease-detail-actions">
          <button className="panel-btn" onClick={() => { if (selectedLeaseId) { onDeleteLease(selectedLeaseId); setSelectedLeaseId(null); } }}>Delete</button>
          <div className="lease-detail-actions-right"><button className="panel-btn" onClick={handleCancel}>Cancel</button><button className="panel-btn" onClick={handleSave}>Save Changes</button></div>
        </div>
      </div>
    );
  };

  const renderTableRows = () => {
    const filteredLeases = filterLeases(propertyLeases, filter);
    const sorted = sortData(filteredLeases, sortConfig).filter(l => leaseMatchesSearch(l, search));
    const h = (text: string) => search ? highlightText(text, search) : text;
    const rows = [];

    for (let i = 0; i < Math.max(emptyRows, sorted.length); i++) {
      const lease = sorted[i];
      const committedYears = lease ? calculateCommittedYears(lease) : 0;
      rows.push(
        <tr key={lease?.id || `empty-${i}`} className={lease && selectedLeaseId === lease.id ? 'selected-row' : ''} onClick={() => lease && handleRowClick(lease.id)} style={lease ? { cursor: 'pointer' } : undefined}>
          <td onClick={(e) => e.stopPropagation()}>{lease && <input type="checkbox" className="lease-checkbox" checked={selectedLeases.has(lease.id)} onChange={() => handleToggleSelect(lease.id)} onClick={(e) => e.stopPropagation()} />}</td>
          <td>{lease ? h(lease.leaseId) : ''}</td>
          <td>{lease ? h(lease.entity) : ''}</td>
          <td>{lease ? h(lease.lessor) : ''}</td>
          <td>{lease ? h(lease.propertyAddress) : ''}</td>
          <td>{lease ? h(lease.branch) : ''}</td>
          <td>{lease ? h(formatDate(lease.commencementDate)) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>{lease ? h(formatDate(getEffectiveExpiryDate(lease).toISOString())) : ''}</td>
          <td>{lease ? h(`${lease.options} years`) : ''}</td>
          <td className={lease ? 'committed-years-cell' : ''} onMouseEnter={(e) => { if (lease) { const rect = e.currentTarget.getBoundingClientRect(); setTooltipPosition({ x: rect.left, y: rect.bottom + 8 }); setHoveredLease(lease.id); } }} onMouseLeave={() => setHoveredLease(null)}>{lease ? h(`${committedYears} years`) : ''}</td>
          <td>{lease ? h(formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2))) : ''}</td>
          <td>{lease && <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isLeaseExpired(lease) ? '#dc3545' : (isWithinThreeMonthsOfExpiry(lease) ? '#ff9c1bff' : '#28a745'), cursor: 'help' }} title={isLeaseExpired(lease) ? 'Lease expired' : 'Lease active'} />}</td>
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className={`dashboard-split${selectedLeaseId ? ' panel-open' : ''}`}>
      <div className="dashboard-main" style={selectedLeaseId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div className="dashboard-container">
          {hoveredLease && propertyLeases.find(l => l.id === hoveredLease) && renderIncrementMethodsTooltip(propertyLeases.find(l => l.id === hoveredLease)!)}

          <div className="table-section">
            <div className="page-header">
              <button className="back-button" onClick={() => onNavigate('home')} title="Back to Home"><ArrowBackIcon fontSize="small" /></button>
              <h2>Property Leases ({filterLeases(propertyLeases, filter).length})</h2>
              <div className="page-header-actions">
                <button className="entities-add-button" onClick={onAddLease} disabled={!isEntitySelected}>New Card</button>
                <button className="entities-add-button" onClick={onOpenReport} disabled={!isEntitySelected} style={{ backgroundColor: '#007bff' }}>AASB16 Report</button>
              </div>
            </div>
            <div className="selection-bar">
              <input type="checkbox" ref={selectAllRef} className="select-all-checkbox" checked={selectedLeases.size > 0 && selectedLeases.size === filterLeases(propertyLeases, filter).length} onChange={handleSelectAll} title="Select all" />
              {selectedLeases.size > 0 ? (
                <>
                  <span className="selection-count">{selectedLeases.size} selected</span>
                  <div className="selection-actions">
                    <button className="action-btn action-copy" onClick={handleBatchCopy} title="Copy"><ContentCopyIcon fontSize="small" /></button>
                    <button className="action-btn action-export" onClick={handleBatchExport} title="Export"><FileDownloadIcon fontSize="small" /></button>
                    <button className="action-btn action-delete" onClick={handleBatchDelete} title="Delete"><DeleteIcon fontSize="small" /></button>
                  </div>
                </>
              ) : <span className="selection-hint">Select items</span>}
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-dropdown" value={filter} onChange={(e) => setFilter(e.target.value as 'All' | 'Active' | 'Non-Active')}><option value="All">All</option><option value="Active">Active</option><option value="Non-Active">Non-Active</option></select>
            </div>
            <div className="table-wrapper">
              <table className="lease-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', minWidth: '40px' }}></th>
                    <th onClick={() => handleSort('leaseId')} style={{ cursor: 'pointer' }} className={isSorted('leaseId') ? 'sorted' : ''}>ID{renderSortIndicator('leaseId')}</th>
                    <th onClick={() => handleSort('entity')} style={{ cursor: 'pointer' }} className={isSorted('entity') ? 'sorted' : ''}>Entity{renderSortIndicator('entity')}</th>
                    <th onClick={() => handleSort('lessor')} style={{ cursor: 'pointer' }} className={isSorted('lessor') ? 'sorted' : ''}>Lessor{renderSortIndicator('lessor')}</th>
                    <th onClick={() => handleSort('propertyAddress')} style={{ cursor: 'pointer' }} className={isSorted('propertyAddress') ? 'sorted' : ''}>Property Address{renderSortIndicator('propertyAddress')}</th>
                    <th onClick={() => handleSort('branch')} style={{ cursor: 'pointer' }} className={isSorted('branch') ? 'sorted' : ''}>Branch{renderSortIndicator('branch')}</th>
                    <th onClick={() => handleSort('commencementDate')} style={{ cursor: 'pointer' }} className={isSorted('commencementDate') ? 'sorted' : ''}>Commencement Date{renderSortIndicator('commencementDate')}</th>
                    <th onClick={() => handleSort('expiryDate')} style={{ cursor: 'pointer' }} className={isSorted('expiryDate') ? 'sorted' : ''}>Expiry Date{renderSortIndicator('expiryDate')}</th>
                    <th onClick={() => handleSort('options')} style={{ cursor: 'pointer' }} className={isSorted('options') ? 'sorted' : ''}>Options{renderSortIndicator('options')}</th>
                    <th onClick={() => handleSort('committedYears')} style={{ cursor: 'pointer' }} className={isSorted('committedYears') ? 'sorted' : ''}>Total Committed Years{renderSortIndicator('committedYears')}</th>
                    <th onClick={() => handleSort('annualRent')} style={{ cursor: 'pointer' }} className={isSorted('annualRent') ? 'sorted' : ''}>Monthly Rent (exc. GST){renderSortIndicator('annualRent')}</th>
                    <th style={{ width: '40px', minWidth: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>{renderTableRows()}</tbody>
              </table>
            </div>
          </div>

          {xlsxModalLease && <ToXLSXModal onClose={() => setXlsxModalLease(null)} onGenerate={(params) => handleGenerateExcel(xlsxModalLease, params)} openingBalances={xlsxModalLease.openingBalances} />}
          {showAddOpeningBalance && editedLease && <AddOpeningBalanceForm existingDates={(editedLease.openingBalances || []).map(ob => ob.openingDate)} onAdd={handleAddOpeningBalance} onClose={() => setShowAddOpeningBalance(false)} />}
          {showBatchDeleteConfirm && (
            <div className="confirm-overlay" onMouseDown={() => setShowBatchDeleteConfirm(false)}>
              <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
                <h3 className="confirm-title">Delete {selectedLeases.size} Leases?</h3>
                <p className="confirm-text">Are you sure you want to delete {selectedLeases.size} selected lease{selectedLeases.size > 1 ? 's' : ''}? This action cannot be undone.</p>
                <div className="confirm-actions"><button className="confirm-cancel-button" onClick={() => setShowBatchDeleteConfirm(false)}>Cancel</button><button className="confirm-delete-button" onClick={handleConfirmBatchDelete}>Delete {selectedLeases.size} Lease{selectedLeases.size > 1 ? 's' : ''}</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedLeaseId && renderDetailPanel()}
    </div>
  );
};

export default PropertyLeasesPage;
