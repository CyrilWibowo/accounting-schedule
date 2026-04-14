import React, { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AddIcon from '@mui/icons-material/Add';
import AssessmentIcon from '@mui/icons-material/Assessment';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Lease, MobileEquipmentLease, OpeningBalance, Branch } from '../../types/Lease';
import { generateExcelFromMobileEquipmentLeases } from './excel/mobileEquipmentExcelGenerator';
import { exportMobileEquipmentLeasesToExcel } from './excel/tableExporter';
import ToXLSXModal, { XLSXGenerationParams } from './ToXLSXModal';
import AddOpeningBalanceForm from './AddOpeningBalanceForm';
import Toast, { useToast } from '../shared/Toast';
import './Dashboard.css';
import { formatCurrency, formatDate, getYearDiff, generateLeaseId } from '../../utils/helper';
import { View } from '../Layout/Sidebar';

const BRANCH_OPTIONS: Branch[] = ['PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'CORP', 'PERT-RTS', 'MACK-RTS', 'ADEL-RTS', 'PARK'];
const DEFAULT_PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 900;

interface MobileEquipmentLeasesPageProps {
  mobileEquipmentLeases: MobileEquipmentLease[];
  onUpdateLease: (lease: Lease) => void;
  onDeleteLease: (leaseId: string) => void;
  onCopyLease: (lease: Lease) => void;
  entityName: string;
  onAddLease: () => void;
  onOpenReport: () => void;
  isEntitySelected: boolean;
  onNavigate: (view: View) => void;
}

const MobileEquipmentLeasesPage: React.FC<MobileEquipmentLeasesPageProps> = ({
  mobileEquipmentLeases,
  onUpdateLease,
  onDeleteLease,
  onCopyLease,
  entityName,
  onAddLease,
  onOpenReport,
  isEntitySelected,
  onNavigate,
}) => {
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(99);
  const [editedLease, setEditedLease] = useState<Lease | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [monthlyRentInput, setMonthlyRentInput] = useState('');
  const [showAddOpeningBalance, setShowAddOpeningBalance] = useState(false);
  const [obExpanded, setObExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [xlsxModalLease, setXlsxModalLease] = useState<MobileEquipmentLease | null>(null);
  const emptyRows = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Non-Active'>('All');
  const [search, setSearch] = useState('');
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showPanelDeleteConfirm, setShowPanelDeleteConfirm] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('sidePanelWidth');
    if (saved) { const n = parseInt(saved, 10); if (!isNaN(n)) return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, n)); }
    return DEFAULT_PANEL_WIDTH;
  });
  const isResizing = useRef(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, clearToast } = useToast();

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
    if (stickyHeaderRef.current) setStickyHeaderHeight(stickyHeaderRef.current.offsetHeight);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setIsSelectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
      localStorage.setItem('sidePanelWidth', String(newWidth));
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
      const lease = mobileEquipmentLeases.find(l => l.id === selectedLeaseId);
      if (lease) {
        setEditedLease({ ...lease });
        setMonthlyRentInput(lease.annualRent ? (parseFloat(lease.annualRent) / 12).toFixed(2) : '');
        setErrors({});
        setObExpanded(false);
        setIsEditing(false);
      } else {
        setSelectedLeaseId(null);
        setEditedLease(null);
      }
    } else {
      setEditedLease(null);
      setErrors({});
      setObExpanded(false);
      setIsEditing(false);
    }
  }, [selectedLeaseId, mobileEquipmentLeases]);

  useEffect(() => {
    if (!editedLease) return;
    const calculatedMonthly = editedLease.annualRent ? (parseFloat(editedLease.annualRent) / 12).toFixed(2) : '';
    if (Math.abs(parseFloat(calculatedMonthly || '0') - parseFloat(monthlyRentInput || '0')) > 0.001 ||
        (!editedLease.annualRent && monthlyRentInput)) {
      setMonthlyRentInput(calculatedMonthly);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedLease?.annualRent]);

  const normalizeForSearch = (value: string): string => value.replace(/,/g, '').replace(/\$/g, '').toLowerCase().trim();
  const isSearchMatch = (displayText: string, s: string): boolean => { if (!s) return false; return normalizeForSearch(displayText).includes(normalizeForSearch(s)); };
  const highlightText = (text: string, s: string): React.ReactNode => {
    if (!s || !text) return text;
    const normalizedText = normalizeForSearch(text);
    const normalizedSearch = normalizeForSearch(s);
    if (!normalizedSearch || !normalizedText.includes(normalizedSearch)) return text;
    const idx = normalizedText.indexOf(normalizedSearch);
    let origIdx = 0, normCount = 0;
    while (normCount < idx && origIdx < text.length) { const ch = text[origIdx]; if (ch !== ',' && ch !== '$') normCount++; origIdx++; }
    let origEnd = origIdx, matchCount = 0;
    while (matchCount < normalizedSearch.length && origEnd < text.length) { const ch = text[origEnd]; if (ch !== ',' && ch !== '$') matchCount++; origEnd++; }
    return (<>{text.slice(0, origIdx)}<mark className="search-highlight">{text.slice(origIdx, origEnd)}</mark>{text.slice(origEnd)}</>);
  };

  const calculateCommittedYears = (lease: MobileEquipmentLease): number => {
    if (lease.deliveryDate && lease.expiryDate) {
      const start = new Date(lease.deliveryDate);
      const end = new Date(lease.expiryDate);
      const yearsDiff = getYearDiff(start, end);
      return Math.floor(yearsDiff) > 0 ? Math.floor(yearsDiff) : 0;
    }
    return 0;
  };

  const getEffectiveExpiryDate = (lease: MobileEquipmentLease): Date => new Date(lease.expiryDate);

  const isLeaseActive = (lease: MobileEquipmentLease): boolean => {
    return getEffectiveExpiryDate(lease).getFullYear() >= new Date().getFullYear();
  };

  const isLeaseExpired = (lease: MobileEquipmentLease): boolean => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const effective = getEffectiveExpiryDate(lease); effective.setHours(0, 0, 0, 0);
    return effective < today;
  };

  const isWithinThreeMonthsOfExpiry = (lease: MobileEquipmentLease): boolean => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const effective = getEffectiveExpiryDate(lease); effective.setHours(0, 0, 0, 0);
    const threeMonths = new Date(today); threeMonths.setMonth(threeMonths.getMonth() + 3);
    return effective <= threeMonths && effective >= today;
  };

  const filterLeases = (leases: MobileEquipmentLease[], f: 'All' | 'Active' | 'Non-Active'): MobileEquipmentLease[] => {
    if (f === 'All') return leases;
    if (f === 'Active') return leases.filter(l => isLeaseActive(l));
    return leases.filter(l => !isLeaseActive(l));
  };

  const leaseMatchesSearch = (lease: MobileEquipmentLease, s: string): boolean => {
    if (!s) return true;
    const leasePeriod = calculateCommittedYears(lease);
    const monthlyRent = formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2));
    const expiryDisplay = formatDate(getEffectiveExpiryDate(lease).toISOString());
    const values = [lease.leaseId, lease.entity, lease.lessor, lease.branch, expiryDisplay, monthlyRent, `${leasePeriod} years`, lease.description, lease.regoNo, lease.vehicleType, lease.engineNumber, lease.vinSerialNo, formatDate(lease.deliveryDate)];
    return values.some(v => isSearchMatch(v, s));
  };

  const sortData = (data: MobileEquipmentLease[], sc: { key: string | null; direction: 'asc' | 'desc' }): MobileEquipmentLease[] => {
    if (!sc.key) return data;
    return [...data].sort((a, b) => {
      let aValue: any, bValue: any;
      if (sc.key === 'committedYears') { aValue = calculateCommittedYears(a); bValue = calculateCommittedYears(b); }
      else { aValue = a[sc.key as keyof MobileEquipmentLease]; bValue = b[sc.key as keyof MobileEquipmentLease]; }
      if (sc.key && sc.key.toLowerCase().includes('date')) { aValue = new Date(aValue).getTime(); bValue = new Date(bValue).getTime(); }
      else if (sc.key && ['annualRent', 'borrowingRate', 'committedYears'].includes(sc.key)) { aValue = parseFloat(aValue) || 0; bValue = parseFloat(bValue) || 0; }
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
  const renderSortIndicator = (columnKey: string) => { if (sortConfig.key !== columnKey) return null; return <span style={{ marginLeft: '4px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>; };
  const isSorted = (columnKey: string) => sortConfig.key === columnKey;
  const handleRowClick = (leaseId: string) => setSelectedLeaseId(selectedLeaseId === leaseId ? null : leaseId);

  const handleInputChange = (field: string, value: string) => {
    if (!editedLease) return;
    setEditedLease({ ...editedLease, [field]: value } as Lease);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const validateForm = (): boolean => {
    if (!editedLease) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;
    if (!editedLease.lessor?.trim()) { newErrors.lessor = true; isValid = false; }
    if (!editedLease.branch?.trim()) { newErrors.branch = true; isValid = false; }
    if (!editedLease.annualRent.trim()) { newErrors.annualRent = true; isValid = false; }
    if (!editedLease.borrowingRate.trim()) { newErrors.borrowingRate = true; isValid = false; }
    const me = editedLease as MobileEquipmentLease;
    if (!me.description?.trim()) { newErrors.description = true; isValid = false; }
    if (!me.vinSerialNo?.trim()) { newErrors.vinSerialNo = true; isValid = false; }
    if (!me.regoNo?.trim()) { newErrors.regoNo = true; isValid = false; }
    if (!me.deliveryDate) { newErrors.deliveryDate = true; isValid = false; }
    if (!me.expiryDate) { newErrors.expiryDate = true; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  const handleSave = () => { if (editedLease && validateForm()) { onUpdateLease(editedLease); setIsEditing(false); showToast('Changes saved', 'edit'); } };
  const handleCancel = () => setSelectedLeaseId(null);
  const handleCancelEdit = () => {
    const original = mobileEquipmentLeases.find(l => l.id === selectedLeaseId);
    if (original) { setEditedLease({ ...original }); setMonthlyRentInput(original.annualRent ? (parseFloat(original.annualRent) / 12).toFixed(2) : ''); }
    setErrors({});
    setIsEditing(false);
  };

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
    const filtered = filterLeases(mobileEquipmentLeases, filter);
    if (selectedLeases.size === filtered.length && selectedLeases.size > 0) setSelectedLeases(new Set());
    else setSelectedLeases(new Set(filtered.map(l => l.id)));
  };

  const handleSelectByStatus = (status: 'all' | 'active' | 'expiring' | 'expired') => {
    const filtered = filterLeases(mobileEquipmentLeases, filter);
    let ids: string[];
    if (status === 'all') ids = filtered.map(l => l.id);
    else if (status === 'active') ids = filtered.filter(l => !isLeaseExpired(l) && !isWithinThreeMonthsOfExpiry(l)).map(l => l.id);
    else if (status === 'expiring') ids = filtered.filter(l => isWithinThreeMonthsOfExpiry(l)).map(l => l.id);
    else ids = filtered.filter(l => isLeaseExpired(l)).map(l => l.id);
    setSelectedLeases(new Set(ids));
    setIsSelectDropdownOpen(false);
  };

  const handleBatchCopy = async () => {
    const toCopy = mobileEquipmentLeases.filter(l => selectedLeases.has(l.id));
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
    showToast('Lease(s) deleted', 'delete');
  };
  const handleBatchExport = () => {
    if (selectedLeases.size === 0) return;
    const toExport = mobileEquipmentLeases.filter(l => selectedLeases.has(l.id));
    const timestamp = new Date().toISOString().split('T')[0];
    exportMobileEquipmentLeasesToExcel(toExport, `MobileEquipmentLeases_${timestamp}.xlsx`);
  };

  useEffect(() => {
    if (selectAllRef.current) {
      const filteredCount = filterLeases(mobileEquipmentLeases, filter).length;
      selectAllRef.current.indeterminate = selectedLeases.size > 0 && selectedLeases.size < filteredCount;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeases, mobileEquipmentLeases, filter]);

  useEffect(() => { setSelectedLeases(new Set()); }, [filter]);

  const handleGenerateExcel = (lease: MobileEquipmentLease, params: XLSXGenerationParams) => {
    generateExcelFromMobileEquipmentLeases(lease, params, entityName);
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
            <button className="lease-detail-edit-toggle" title={isEditing ? 'Switch to view mode' : 'Edit'} onClick={() => { setIsEditing(e => !e); setErrors({}); }}>
              {isEditing ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
              <span>{isEditing ? 'View' : 'Edit'}</span>
            </button>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <button
                className="panel-btn"
                style={{ width: '100%', backgroundColor: '#28a745', borderColor: '#28a745', color: 'white' }}
                onClick={() => {
                  const lease = mobileEquipmentLeases.find(l => l.id === selectedLeaseId);
                  if (lease) setXlsxModalLease(lease);
                }}
              >
                AASB16
              </button>
            </div>
            <div className="form-group"><label className="form-label">Entity</label><input type="text" className="form-input readonly-input" value={editedLease.entity} readOnly disabled /></div>
            <div className="form-group"><label className="form-label">Lessor *</label>{errors.lessor && <span className="error-text">This field is required</span>}{isEditing ? <input type="text" className={errors.lessor ? 'form-input-error' : 'form-input'} value={editedLease.lessor} onChange={(e) => handleInputChange('lessor', e.target.value)} placeholder="Enter lessor" /> : <input type="text" className="form-input readonly-input" value={editedLease.lessor} readOnly />}</div>
            <div className="form-group"><label className="form-label">Description *</label>{errors.description && <span className="error-text">This field is required</span>}{isEditing ? <input type="text" className={errors.description ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Enter description" /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).description} readOnly />}</div>
            <div className="form-group"><label className="form-label">Branch *</label>{errors.branch && <span className="error-text">This field is required</span>}{isEditing ? <select className={errors.branch ? 'form-input-error' : 'form-input'} value={editedLease.branch} onChange={(e) => handleInputChange('branch', e.target.value)}><option value="">Select branch...</option>{BRANCH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}</select> : <input type="text" className="form-input readonly-input" value={editedLease.branch} readOnly />}</div>
            <div className="form-group"><label className="form-label">Type *</label>{errors.vehicleType && <span className="error-text">This field is required</span>}{isEditing ? <select className={errors.vehicleType ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).vehicleType} onChange={(e) => handleInputChange('vehicleType', e.target.value)}><option value="">Select vehicle type...</option><option value="Ute">Ute</option><option value="Wagon">Wagon</option><option value="Forklift">Forklift</option><option value="Other">Other</option></select> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).vehicleType} readOnly />}</div>
            <div className="form-group"><label className="form-label">Engine Number *</label>{errors.engineNumber && <span className="error-text">This field is required</span>}{isEditing ? <input type="text" className={errors.engineNumber ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).engineNumber} onChange={(e) => handleInputChange('engineNumber', e.target.value)} placeholder="Enter Engine Number" /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).engineNumber} readOnly />}</div>
            <div className="form-group"><label className="form-label">VIN/Serial No. *</label>{errors.vinSerialNo && <span className="error-text">This field is required</span>}{isEditing ? <input type="text" className={errors.vinSerialNo ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).vinSerialNo} onChange={(e) => handleInputChange('vinSerialNo', e.target.value)} placeholder="Enter VIN/Serial No." /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).vinSerialNo} readOnly />}</div>
            <div className="form-group"><label className="form-label">Rego/Equipment No. *</label>{errors.regoNo && <span className="error-text">This field is required</span>}{isEditing ? <input type="text" className={errors.regoNo ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).regoNo} onChange={(e) => handleInputChange('regoNo', e.target.value)} placeholder="Enter Rego No." /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).regoNo} readOnly />}</div>
            <div className="form-group"><label className="form-label">Delivery Date *</label>{errors.deliveryDate && <span className="error-text">This field is required</span>}{isEditing ? <input type="date" className={errors.deliveryDate ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).deliveryDate} onChange={(e) => handleInputChange('deliveryDate', e.target.value)} /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).deliveryDate ? formatDate((editedLease as MobileEquipmentLease).deliveryDate) : ''} readOnly />}</div>
            <div className="form-group"><label className="form-label">Expiry Date *</label>{errors.expiryDate && <span className="error-text">This field is required</span>}{isEditing ? <input type="date" className={errors.expiryDate ? 'form-input-error' : 'form-input'} value={(editedLease as MobileEquipmentLease).expiryDate} onChange={(e) => handleInputChange('expiryDate', e.target.value)} /> : <input type="text" className="form-input readonly-input" value={(editedLease as MobileEquipmentLease).expiryDate ? formatDate((editedLease as MobileEquipmentLease).expiryDate) : ''} readOnly />}</div>
            <div className="form-group"><label className="form-label">Monthly Rent (exc. GST) *</label>{errors.annualRent && <span className="error-text">This field is required</span>}{isEditing ? <input type="number" className={errors.annualRent ? 'form-input-error' : 'form-input'} value={monthlyRentInput} onChange={(e) => { setMonthlyRentInput(e.target.value); handleInputChange('annualRent', e.target.value ? (parseFloat(e.target.value) * 12).toString() : ''); }} onBlur={() => { if (monthlyRentInput) setMonthlyRentInput(parseFloat(monthlyRentInput).toFixed(2)); }} placeholder="0.00" step="0.01" /> : <input type="text" className="form-input readonly-input" value={monthlyRentInput ? formatCurrency(parseFloat(monthlyRentInput).toFixed(2)) : ''} readOnly />}</div>
            <div className="form-group"><label className="form-label">Borrowing Rate (%) *</label>{errors.borrowingRate && <span className="error-text">This field is required</span>}{isEditing ? <input type="number" className={errors.borrowingRate ? 'form-input-error' : 'form-input'} value={editedLease.borrowingRate} onChange={(e) => handleInputChange('borrowingRate', e.target.value)} placeholder="0.00" step="0.01" /> : <input type="text" className="form-input readonly-input" value={editedLease.borrowingRate ? `${parseFloat(editedLease.borrowingRate).toFixed(2)}%` : ''} readOnly />}</div>
          </div>

          <div className="asset-ob-section">
            <div className="asset-ob-header">
              <button className="ob-toggle-btn" onClick={() => setObExpanded(e => !e)}>
                {obExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                <span className="asset-ob-title">Opening Balances{sortedBalances.length > 0 ? ` (${sortedBalances.length})` : ''}</span>
              </button>
              {obExpanded && isEditing && <button className="asset-ob-add-btn" onClick={() => setShowAddOpeningBalance(true)}>+ Add</button>}
            </div>
            {obExpanded && sortedBalances.length === 0 && <p className="asset-ob-empty">No opening balances added yet.</p>}
            {obExpanded && sortedBalances.map(ob => (
              <div key={ob.id} className="asset-ob-card">
                <div className="asset-ob-card-header">
                  <span className={`asset-ob-type-badge ${ob.isNewLeaseExtension ? 'asset-ob-type-new' : 'asset-ob-type-existing'}`}>
                    {ob.isNewLeaseExtension ? 'New / Extension' : 'Existing'}
                  </span>
                  {isEditing && <button className="asset-ob-delete-btn" onClick={() => handleDeleteOpeningBalance(ob.id)} title="Delete">×</button>}
                </div>
                <div className="asset-ob-card-body">
                  <div className="asset-ob-field"><label>Date</label><input type="text" className="readonly-input" value={obFormatDate(ob.openingDate)} readOnly /></div>
                  <div className="asset-ob-field"><label>Right to Use Assets</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.rightToUseAssets)} readOnly /></div>
                  <div className="asset-ob-field"><label>Acc. Depr ROU Assets</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.accDeprRightToUseAssets)} readOnly /></div>
                  <div className="asset-ob-field"><label>Liability - Current</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.leaseLiabilityCurrent)} readOnly /></div>
                  <div className="asset-ob-field"><label>Liability - Non-Current</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.leaseLiabilityNonCurrent)} readOnly /></div>
                  <div className="asset-ob-field"><label>Depreciation Expense</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.depreciationExpense)} readOnly /></div>
                  <div className="asset-ob-field"><label>Interest Expense Rent</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.interestExpenseRent)} readOnly /></div>
                  <div className="asset-ob-field"><label>Rent Expense</label><input type="text" className="readonly-input" value={obFormatCurrency(ob.rentExpense)} readOnly /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {isEditing && (
          <div className="lease-detail-actions">
            <button className="panel-btn" onClick={() => setShowPanelDeleteConfirm(true)}>Delete</button>
            <div className="lease-detail-actions-right">
              <button className="panel-btn" onClick={handleCancelEdit}>Cancel</button>
              <button className="panel-btn" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTableRows = () => {
    const filteredLeases = filterLeases(mobileEquipmentLeases, filter);
    const sorted = sortData(filteredLeases, sortConfig).filter(l => leaseMatchesSearch(l, search));
    const h = (text: string) => search ? highlightText(text, search) : text;
    const rows = [];

    for (let i = 0; i < Math.max(emptyRows, sorted.length); i++) {
      const lease = sorted[i];
      const leasePeriod = lease ? calculateCommittedYears(lease) : 0;
      rows.push(
        <tr key={lease?.id || `empty-${i}`} className={lease && selectedLeaseId === lease.id ? 'selected-row' : ''} onClick={() => lease && handleRowClick(lease.id)} style={lease ? { cursor: 'pointer' } : undefined}>
          <td onClick={(e) => e.stopPropagation()}>{lease && <input type="checkbox" className="lease-checkbox" checked={selectedLeases.has(lease.id)} onChange={() => handleToggleSelect(lease.id)} onClick={(e) => e.stopPropagation()} />}</td>
          <td>{lease ? h(lease.leaseId) : ''}</td>
          <td>{lease ? h(lease.entity) : ''}</td>
          <td>{lease ? h(lease.lessor) : ''}</td>
          <td>{lease ? h(lease.regoNo) : ''}</td>
          <td>{lease ? <span className="cell-clamp" title={lease.description}>{search ? highlightText(lease.description, search) : lease.description}</span> : ''}</td>
          <td>{lease ? h(lease.branch) : ''}</td>
          <td>{lease ? h(lease.vehicleType) : ''}</td>
          <td>{lease ? h(lease.engineNumber) : ''}</td>
          <td>{lease ? h(lease.vinSerialNo) : ''}</td>
          <td>{lease ? h(formatDate(lease.deliveryDate)) : ''}</td>
          <td style={{ color: lease && isLeaseExpired(lease) ? '#dc3545' : '#212529' }}>{lease ? h(formatDate(getEffectiveExpiryDate(lease).toISOString())) : ''}</td>
          <td>{lease ? h(`${leasePeriod} years`) : ''}</td>
          <td>{lease ? h(formatCurrency((parseFloat(lease.annualRent) / 12).toFixed(2))) : ''}</td>
          <td>{lease && <span className={`status-badge ${isLeaseExpired(lease) ? 'status-expired' : isWithinThreeMonthsOfExpiry(lease) ? 'status-expiring' : 'status-active'}`}>{isLeaseExpired(lease) ? 'Expired' : isWithinThreeMonthsOfExpiry(lease) ? 'Expiring' : 'Active'}</span>}</td>
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className={`dashboard-split${selectedLeaseId ? ' panel-open' : ''}`} style={{ height: 'calc(100vh - 56px)', minHeight: 0, overflow: 'hidden' }}>
      <div className="dashboard-main" style={selectedLeaseId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div ref={stickyHeaderRef} style={{ background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ flex: 1 }} />
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#333' }}>Mobile Equipment Leases ({filterLeases(mobileEquipmentLeases, filter).length})</h2>
            <div style={{ flex: 1 }} />
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', minHeight: '44px', paddingRight: '8px', gap: '6px' }}>
            <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input type="checkbox" ref={selectAllRef} className="select-all-checkbox" checked={selectedLeases.size > 0 && selectedLeases.size === filterLeases(mobileEquipmentLeases, filter).length} onChange={handleSelectAll} title="Select all" />
            </div>
            <div ref={selectDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setIsSelectDropdownOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', borderRadius: '3px' }}>
                <KeyboardArrowDownIcon style={{ fontSize: 16 }} />
              </button>
              {isSelectDropdownOpen && (
                <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '150px', overflow: 'hidden' }}>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('all')}>All</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('active')}>Active</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('expiring')}>Expiring</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('expired')}>Expired</button>
                </div>
              )}
            </div>
            {selectedLeases.size > 0 && (
              <>
                <button className="action-btn action-copy" onClick={handleBatchCopy} title="Copy"><ContentCopyIcon fontSize="small" /></button>
                <button className="action-btn action-export" onClick={handleBatchExport} title="Export"><FileDownloadIcon fontSize="small" /></button>
                <button className="action-btn action-delete" onClick={handleBatchDelete} title="Delete"><DeleteIcon fontSize="small" /></button>
                <span className="selection-count">{selectedLeases.size} selected</span>
              </>
            )}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ pointerEvents: 'auto', width: '420px', padding: '7px 14px', fontSize: '14px', border: '1px solid #d0d0d0', borderRadius: '4px', background: 'white', outline: 'none', color: '#495057' }}
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'All' | 'Active' | 'Non-Active')} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #d0d0d0', borderRadius: '4px', background: 'white', color: '#495057', cursor: 'pointer', outline: 'none', minWidth: '120px' }}>
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Non-Active">Non-Active</option>
            </select>
            <div ref={actionsMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsActionsMenuOpen(v => !v)}
                style={{ width: 32, height: 32, border: '1px solid #d0d0d0', borderRadius: '4px', background: isActionsMenuOpen ? '#e9ecef' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#495057', fontSize: '18px', lineHeight: 1 }}
                title="More actions"
              >⋮</button>
              {isActionsMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '160px', overflow: 'hidden' }}>
                  <button className="dropdown-menu-item" onClick={() => { onAddLease(); setIsActionsMenuOpen(false); }} disabled={!isEntitySelected}>
                    <AddIcon fontSize="small" /><span>New Card</span>
                  </button>
                  <button className="dropdown-menu-item" onClick={() => { onOpenReport(); setIsActionsMenuOpen(false); }} disabled={!isEntitySelected}>
                    <AssessmentIcon fontSize="small" /><span>AASB16 Report</span>
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
        <div className="dashboard-container" style={{ padding: 0, maxWidth: 'none', margin: 0 }}>
          <div className="table-section" style={{ margin: 0 }}>
            <div className="table-wrapper" style={{ borderRadius: 0, boxShadow: 'none', overflowY: 'auto', height: `calc(100vh - ${headerHeight}px - ${stickyHeaderHeight}px)` }}>
              <table className="lease-table">
                <colgroup>
                  <col style={{ width: 40, minWidth: 40, maxWidth: 40 }} />
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ width: 40, minWidth: 40, maxWidth: 40 }}></th>
                    <th onClick={() => handleSort('leaseId')} style={{ cursor: 'pointer' }} className={isSorted('leaseId') ? 'sorted' : ''}>ID{renderSortIndicator('leaseId')}</th>
                    <th onClick={() => handleSort('entity')} style={{ cursor: 'pointer' }} className={isSorted('entity') ? 'sorted' : ''}>Entity{renderSortIndicator('entity')}</th>
                    <th onClick={() => handleSort('lessor')} style={{ cursor: 'pointer' }} className={isSorted('lessor') ? 'sorted' : ''}>Lessor{renderSortIndicator('lessor')}</th>
                    <th onClick={() => handleSort('regoNo')} style={{ cursor: 'pointer' }} className={isSorted('regoNo') ? 'sorted' : ''}>Rego/Equipment No.{renderSortIndicator('regoNo')}</th>
                    <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }} className={isSorted('description') ? 'sorted' : ''}>Description{renderSortIndicator('description')}</th>
                    <th onClick={() => handleSort('branch')} style={{ cursor: 'pointer' }} className={isSorted('branch') ? 'sorted' : ''}>Branch{renderSortIndicator('branch')}</th>
                    <th onClick={() => handleSort('vehicleType')} style={{ cursor: 'pointer' }} className={isSorted('vehicleType') ? 'sorted' : ''}>Type{renderSortIndicator('vehicleType')}</th>
                    <th onClick={() => handleSort('engineNumber')} style={{ cursor: 'pointer' }} className={isSorted('engineNumber') ? 'sorted' : ''}>Engine Number{renderSortIndicator('engineNumber')}</th>
                    <th onClick={() => handleSort('vinSerialNo')} style={{ cursor: 'pointer' }} className={isSorted('vinSerialNo') ? 'sorted' : ''}>VIN/Serial No.{renderSortIndicator('vinSerialNo')}</th>
                    <th onClick={() => handleSort('deliveryDate')} style={{ cursor: 'pointer' }} className={isSorted('deliveryDate') ? 'sorted' : ''}>Delivery Date{renderSortIndicator('deliveryDate')}</th>
                    <th onClick={() => handleSort('expiryDate')} style={{ cursor: 'pointer' }} className={isSorted('expiryDate') ? 'sorted' : ''}>Expiry Date{renderSortIndicator('expiryDate')}</th>
                    <th onClick={() => handleSort('committedYears')} style={{ cursor: 'pointer' }} className={isSorted('committedYears') ? 'sorted' : ''}>Lease Period{renderSortIndicator('committedYears')}</th>
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
          {showPanelDeleteConfirm && editedLease && (
            <div className="confirm-overlay" onMouseDown={() => setShowPanelDeleteConfirm(false)}>
              <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
                <h3 className="confirm-title">Delete Lease?</h3>
                <p className="confirm-text">Are you sure you want to delete "{editedLease.lessor}"? This action cannot be undone.</p>
                <div className="confirm-actions"><button className="confirm-cancel-button" onClick={() => setShowPanelDeleteConfirm(false)}>Cancel</button><button className="confirm-delete-button" onClick={() => { if (selectedLeaseId) { onDeleteLease(selectedLeaseId); setSelectedLeaseId(null); setShowPanelDeleteConfirm(false); showToast('Lease deleted', 'delete'); } }}>Delete</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedLeaseId && renderDetailPanel()}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
};

export default MobileEquipmentLeasesPage;
