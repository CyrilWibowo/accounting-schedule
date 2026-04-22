import React, { useState, useRef, useEffect, useCallback } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { Asset, CIPAsset, CIPInvoice, AssetCategory, AssetBranch } from '../../types/Asset';
import { loadEntityCIPAssets, addEntityCIPAsset, updateEntityCIPAsset, deleteEntityCIPAsset, addEntityAsset, deleteEntityAsset, loadEntityAssets } from '../../utils/dataStorage';
import AddCIPModal from './AddCIPModal';
import AddCIPInvoiceModal from './AddCIPInvoiceModal';
import Toast, { useToast } from '../shared/Toast';
import AdvancedFilterPanel, { AdvancedFilters, FilterFieldDef, buildEmptyFilters, hasActiveFilters } from '../shared/AdvancedFilterPanel';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
import './FixedAssetsRegister.css';

const CATEGORIES: AssetCategory[] = ['Office Equipment', 'Motor Vehicle', 'Warehouse Equipment', 'Manufacturing Equipment', 'Equipment for Leased', 'Software'];
const BRANCHES: AssetBranch[] = ['CORP', 'PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'PARK'];

const CIP_FILTER_FIELDS: FilterFieldDef[] = [
  { type: 'checkbox', key: 'category', label: 'Category', options: [...CATEGORIES] },
  { type: 'checkbox', key: 'branch', label: 'Branch', options: [...BRANCHES] },
  { type: 'number-range', key: 'amount', label: 'Amount' },
  { type: 'number-range', key: 'usefulLife', label: 'Useful Life (years)' },
  { type: 'date-range', key: 'date', label: 'Invoice Date' },
  { type: 'date-range', key: 'completionDate', label: 'Completion Date' },
];

const CATEGORY_CODE: Record<string, string> = {
  'Office Equipment': 'O',
  'Motor Vehicle': 'V',
  'Warehouse Equipment': 'W',
  'Manufacturing Equipment': 'M',
  'Equipment for Leased': 'L',
  'Software': 'S',
};

const generateAssetId = (branch: AssetBranch, category: AssetCategory, existingIds: string[]): string => {
  const catCode = CATEGORY_CODE[category] || 'X';
  const prefix = `${branch}${catCode}`;
  let max = 0;
  for (const id of existingIds) {
    if (id.startsWith(prefix)) {
      const num = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};

interface CIPScheduleProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
  jumpToCIPId?: string | null;
  onJumpHandled?: () => void;
  onNavigateToAsset?: (assetId: string) => void;
}

const COLUMNS = [
  'CIP Code',
  'Branch',
  'Asset Name',
  'Category',
  'Budget',
  'Total',
  'Variance',
  'Completed',
  'Completion Date',
  'Completed ID',
];

const EMPTY_ROW_COUNT = 15;

const COLUMN_SORT_KEYS: Record<string, string | null> = {
  'CIP Code': 'id',
  'Branch': 'branch',
  'Asset Name': 'description',
  'Category': 'category',
  'Budget': 'budget',
  'Total': 'total',
  'Variance': null,
  'Completed': 'completed',
  'Completion Date': 'completionDate',
  'Completed ID': 'transferredAssetId',
};
const DEFAULT_PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 900;

const CIPSchedule: React.FC<CIPScheduleProps> = ({ onNavigate, selectedEntity, jumpToCIPId, onJumpHandled, onNavigateToAsset }) => {
  const [search, setSearch] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [cipAssets, setCIPAssets] = useState<CIPAsset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showPanelDeleteConfirm, setShowPanelDeleteConfirm] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAddInvoiceModalOpen, setIsAddInvoiceModalOpen] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState<CIPInvoice | null>(null);
  const [invoiceErrors, setInvoiceErrors] = useState<{ [key: string]: boolean }>({});
  const [showInvoiceDeleteConfirm, setShowInvoiceDeleteConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(() => buildEmptyFilters(CIP_FILTER_FIELDS));
  const advancedFilterRef = useRef<HTMLDivElement>(null);
  const [entityAssetIds, setEntityAssetIds] = useState<Set<string>>(new Set());
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [checkboxColWidth, setCheckboxColWidth] = useState(40);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const checkboxColRef = useRef<HTMLTableCellElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<CIPAsset | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('sidePanelWidth');
    if (saved) { const n = parseInt(saved, 10); if (!isNaN(n)) return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, n)); }
    return DEFAULT_PANEL_WIDTH;
  });
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, clearToast } = useToast();

  const normalizeForSearch = (text: string) => String(text).toLowerCase().replace(/\s+/g, ' ').trim();

  const matchesCIPSearch = (asset: CIPAsset): boolean => {
    if (!search) return true;
    const term = normalizeForSearch(search);
    return [asset.id, asset.description, asset.category, asset.branch, asset.transferredAssetId]
      .some(f => normalizeForSearch(f || '').includes(term));
  };

  const highlightText = (text: string): React.ReactNode => {
    if (!search || !text) return text;
    const norm = normalizeForSearch(text);
    const normSearch = normalizeForSearch(search);
    if (!normSearch || !norm.includes(normSearch)) return text;
    const idx = norm.indexOf(normSearch);
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ backgroundColor: '#fff3cd', padding: 0 }}>{text.slice(idx, idx + normSearch.length)}</mark>
        {text.slice(idx + normSearch.length)}
      </>
    );
  };

  const sortCIPData = (data: CIPAsset[]): CIPAsset[] => {
    if (!sortConfig.key) return data;
    const key = sortConfig.key;
    return [...data].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      if (key === 'total') {
        aVal = (a.invoices || []).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
        bVal = (b.invoices || []).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      } else if (key === 'budget') {
        aVal = Number(a.budget) || 0;
        bVal = Number(b.budget) || 0;
      } else if (key === 'completionDate') {
        aVal = new Date(String(a.completionDate || '')).getTime() || 0;
        bVal = new Date(String(b.completionDate || '')).getTime() || 0;
      } else {
        aVal = String(a[key as keyof CIPAsset] ?? '').toLowerCase();
        bVal = String(b[key as keyof CIPAsset] ?? '').toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  };

  const renderSortIndicator = (key: string) =>
    sortConfig.key === key ? <span style={{ marginLeft: 4 }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span> : null;

  const filteredAssets = sortCIPData(cipAssets.filter(asset => {
    if (statusFilter === 'completed' && asset.completed !== 'Y') return false;
    if (statusFilter === 'in-progress' && asset.completed === 'Y') return false;
    if (!matchesCIPSearch(asset)) return false;
    const af = advancedFilters;
    if (af.checkboxes.category?.length > 0 && !af.checkboxes.category.includes(asset.category)) return false;
    if (af.checkboxes.branch?.length > 0 && !af.checkboxes.branch.includes(asset.branch)) return false;
    if (af.checkboxes.completed?.length > 0 && !af.checkboxes.completed.includes(asset.completed)) return false;
    const amount = parseFloat(asset.amount || '');
    if (af.numberRanges.amount?.min !== '' && !isNaN(amount) && amount < parseFloat(af.numberRanges.amount.min)) return false;
    if (af.numberRanges.amount?.max !== '' && !isNaN(amount) && amount > parseFloat(af.numberRanges.amount.max)) return false;
    const ul = parseFloat(asset.usefulLife || '');
    if (af.numberRanges.usefulLife?.min !== '' && !isNaN(ul) && ul < parseFloat(af.numberRanges.usefulLife.min)) return false;
    if (af.numberRanges.usefulLife?.max !== '' && !isNaN(ul) && ul > parseFloat(af.numberRanges.usefulLife.max)) return false;
    if (af.dateRanges.date?.earliest && (asset.date || '') < af.dateRanges.date.earliest) return false;
    if (af.dateRanges.date?.latest && (asset.date || '') > af.dateRanges.date.latest) return false;
    if (af.dateRanges.completionDate?.earliest && (asset.completionDate || '') < af.dateRanges.completionDate.earliest) return false;
    if (af.dateRanges.completionDate?.latest && (asset.completionDate || '') > af.dateRanges.completionDate.latest) return false;
    return true;
  }));

  const emptyRowsNeeded = Math.max(0, EMPTY_ROW_COUNT - filteredAssets.length);

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

  useEffect(() => {
    if (checkboxColRef.current) setCheckboxColWidth(checkboxColRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    if (stickyHeaderRef.current) setStickyHeaderHeight(stickyHeaderRef.current.offsetHeight);
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
    if (selectedEntity) {
      loadEntityCIPAssets(selectedEntity.id).then(setCIPAssets);
      loadEntityAssets(selectedEntity.id).then(assets => setEntityAssetIds(new Set(assets.map(a => a.id))));
    } else {
      setCIPAssets([]);
      setEntityAssetIds(new Set());
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (jumpToCIPId && cipAssets.length > 0) {
      const asset = cipAssets.find(a => a.id === jumpToCIPId);
      if (asset) {
        setSelectedAssetId(jumpToCIPId);
        setExpandedRows(new Set([jumpToCIPId]));
        onJumpHandled?.();
      }
    }
  }, [jumpToCIPId, cipAssets]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = cipAssets.find(a => a.id === selectedAssetId);
      if (asset) {
        setEditedAsset({ ...asset });
        setErrors({});
        setIsEditing(false);
      } else {
        setSelectedAssetId(null);
        setEditedAsset(null);
      }
    } else {
      setEditedAsset(null);
      setErrors({});
      setIsEditing(false);
    }
  }, [selectedAssetId, cipAssets]);

  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = filteredAssets.length > 0 && selectedAssets.size === filteredAssets.length;
      const someSelected = selectedAssets.size > 0 && selectedAssets.size < filteredAssets.length;
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedAssets, filteredAssets.length]);

  const handleSelectAll = () => {
    if (selectedAssets.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const handleSelectByStatus = (status: string) => {
    if (status === 'all') {
      const allFiltered = filteredAssets.length > 0 && filteredAssets.every(a => selectedAssets.has(a.id));
      setSelectedAssets(allFiltered ? new Set() : new Set(filteredAssets.map(a => a.id)));
    } else if (status === 'completed') {
      setSelectedAssets(new Set(filteredAssets.filter(a => a.completed === 'Y').map(a => a.id)));
    } else if (status === 'in-progress') {
      setSelectedAssets(new Set(filteredAssets.filter(a => a.completed !== 'Y').map(a => a.id)));
    }
    setIsSelectDropdownOpen(false);
  };

  const handleToggleAsset = (assetId: string) => {
    const newSet = new Set(selectedAssets);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedAssets(newSet);
  };

  const handleToggleExpand = (assetId: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setExpandedRows(newSet);
  };

  const handleRowClick = (assetId: string) => {
    setSelectedAssetId(selectedAssetId === assetId ? null : assetId);
    setEditedInvoice(null);
    setInvoiceErrors({});
  };

  const handleAddCIPAsset = async (cipAsset: CIPAsset) => {
    if (!selectedEntity) return;
    const updated = await addEntityCIPAsset(selectedEntity.id, cipAsset);
    setCIPAssets(updated);
    setIsAddModalOpen(false);
    showToast('CIP created', 'success');
  };

  const handleBatchDelete = () => {
    if (selectedAssets.size > 0) setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (!selectedEntity) return;
    let current = cipAssets;
    const idsToDelete = Array.from(selectedAssets);
    for (let i = 0; i < idsToDelete.length; i++) {
      current = await deleteEntityCIPAsset(selectedEntity.id, idsToDelete[i]);
    }
    setCIPAssets(current);
    setSelectedAssets(new Set());
    setShowBatchDeleteConfirm(false);
    showToast('CIP asset(s) deleted', 'delete');
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, [field]: value } as CIPAsset);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const validateForm = (): boolean => {
    if (!editedAsset) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!editedAsset.description.trim()) { newErrors.description = true; isValid = false; }
    if (!editedAsset.category) { newErrors.category = true; isValid = false; }
    if (!editedAsset.branch) { newErrors.branch = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!editedAsset || !selectedEntity || !validateForm()) return;
    const updated = await updateEntityCIPAsset(selectedEntity.id, editedAsset);
    setCIPAssets(updated);
    setSelectedAssetId(null);
    showToast('Changes saved', 'edit');
  };

  const handleTransfer = async () => {
    if (!editedAsset || !selectedEntity) return;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!editedAsset.description.trim()) { newErrors.description = true; isValid = false; }
    if (!editedAsset.category) { newErrors.category = true; isValid = false; }
    if (!editedAsset.branch) { newErrors.branch = true; isValid = false; }
    if (!editedAsset.completionDate) { newErrors.completionDate = true; isValid = false; }
    if (!editedAsset.usefulLife?.trim()) { newErrors.usefulLife = true; isValid = false; }

    setErrors(newErrors);
    if (!isValid) return;

    const invoices = editedAsset.invoices || [];
    const totalCost = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    const usefulLifeNum = Number(editedAsset.usefulLife) || 1;
    const depRate = (1 / usefulLifeNum).toFixed(2);
    const liveAssets = await loadEntityAssets(selectedEntity.id);
    const liveIds = liveAssets.map(a => a.id);
    const newAssetId = generateAssetId(editedAsset.branch as AssetBranch, editedAsset.category as AssetCategory, liveIds);

    const newAsset: Asset = {
      id: newAssetId,
      assetType: 'Regular',
      description: editedAsset.description,
      category: editedAsset.category,
      branch: editedAsset.branch,
      cost: totalCost.toString(),
      vendorName: 'CIP COMPLETED ASSET',
      invoice: 'N/A',
      acquisitionDate: editedAsset.completionDate || '',
      usefulLife: editedAsset.usefulLife,
      depreciationRate: depRate,
      tagNo: 'N/A',
      serialNo: 'N/A',
      sourceCIPId: editedAsset.id,
    };

    await addEntityAsset(selectedEntity.id, newAsset);
    setEntityAssetIds(prev => { const next = new Set(Array.from(prev)); next.add(newAssetId); return next; });

    const transferredCIP = { ...editedAsset, completed: 'Y' as const, transferredAssetId: newAssetId };
    const updated = await updateEntityCIPAsset(selectedEntity.id, transferredCIP);
    setCIPAssets(updated);
    setSelectedAssetId(null);
    showToast('Asset transferred', 'success');
  };

  const handleRevert = async () => {
    if (!editedAsset || !selectedEntity) return;
    if (editedAsset.transferredAssetId) {
      await deleteEntityAsset(selectedEntity.id, editedAsset.transferredAssetId);
    }
    const revertedCIP = { ...editedAsset, completed: 'N' as const, completionDate: '', usefulLife: '', transferredAssetId: undefined };
    const updated = await updateEntityCIPAsset(selectedEntity.id, revertedCIP);
    setCIPAssets(updated);
    setEditedAsset(revertedCIP);
    showToast('Completion reverted', 'delete');
  };

  const handleAddInvoice = async (invoice: CIPInvoice) => {
    if (!editedAsset || !selectedEntity) return;
    const updatedAsset = { ...editedAsset, invoices: [...(editedAsset.invoices || []), invoice] };
    const updated = await updateEntityCIPAsset(selectedEntity.id, updatedAsset);
    setCIPAssets(updated);
    setIsAddInvoiceModalOpen(false);
    showToast('Invoice added', 'success');
  };

  const handleInvoiceInputChange = (field: keyof CIPInvoice, value: string) => {
    if (!editedInvoice) return;
    setEditedInvoice({ ...editedInvoice, [field]: value });
    if (invoiceErrors[field]) setInvoiceErrors({ ...invoiceErrors, [field]: false });
  };

  const validateInvoiceForm = (): boolean => {
    if (!editedInvoice) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;
    if (!editedInvoice.assetName?.trim()) { newErrors.assetName = true; isValid = false; }
    if (!editedInvoice.description.trim()) { newErrors.description = true; isValid = false; }
    if (!editedInvoice.vendorName.trim()) { newErrors.vendorName = true; isValid = false; }
    if (!editedInvoice.invoiceNo.trim()) { newErrors.invoiceNo = true; isValid = false; }
    if (!editedInvoice.date) { newErrors.date = true; isValid = false; }
    if (!editedInvoice.amount.trim()) { newErrors.amount = true; isValid = false; }
    setInvoiceErrors(newErrors);
    return isValid;
  };

  const handleSaveInvoice = async () => {
    if (!editedInvoice || !editedAsset || !selectedEntity || !validateInvoiceForm()) return;
    const updatedInvoices = (editedAsset.invoices || []).map(inv => inv.id === editedInvoice.id ? editedInvoice : inv);
    const updatedAsset = { ...editedAsset, invoices: updatedInvoices };
    const updated = await updateEntityCIPAsset(selectedEntity.id, updatedAsset);
    setCIPAssets(updated);
    setEditedInvoice(null);
    setInvoiceErrors({});
    showToast('Changes saved', 'edit');
  };

  const handleDeleteInvoice = async () => {
    if (!editedInvoice || !editedAsset || !selectedEntity) return;
    const updatedInvoices = (editedAsset.invoices || []).filter(inv => inv.id !== editedInvoice.id);
    const updatedAsset = { ...editedAsset, invoices: updatedInvoices };
    const updated = await updateEntityCIPAsset(selectedEntity.id, updatedAsset);
    setCIPAssets(updated);
    setEditedInvoice(null);
    setShowInvoiceDeleteConfirm(false);
    showToast('Invoice deleted', 'delete');
  };

  const handleCancelInvoice = () => {
    setEditedInvoice(null);
    setInvoiceErrors({});
    setSelectedAssetId(null);
  };

  const handleCancel = () => {
    setSelectedAssetId(null);
    setEditedInvoice(null);
    setInvoiceErrors({});
  };

  const handleDeleteFromPanel = () => {
    setShowPanelDeleteConfirm(true);
  };

  const handleConfirmPanelDelete = async () => {
    if (!selectedAssetId || !selectedEntity) return;
    const updated = await deleteEntityCIPAsset(selectedEntity.id, selectedAssetId);
    setCIPAssets(updated);
    setSelectedAssetId(null);
    setShowPanelDeleteConfirm(false);
    showToast('CIP asset deleted', 'delete');
  };

  const renderDetailPanel = () => {
    if (!editedAsset || !selectedAssetId) return null;

    if (editedInvoice) {
      return (
        <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
          <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
          <div className="side-panel-content">
            <div className="lease-detail-header" style={{ justifyContent: 'flex-end' }}>
              <button className="lease-detail-close" onClick={handleCancelInvoice}><CloseIcon /></button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Invoice ID</label>
                <input type="text" className="readonly-input" value={editedInvoice.id} readOnly />
              </div>
              <div className="form-group">
                <label>Asset Name *</label>
                {invoiceErrors.assetName && <span className="error-text">Required</span>}
                <input
                  type="text"
                  className={invoiceErrors.assetName ? 'error' : ''}
                  value={editedInvoice.assetName || ''}
                  onChange={(e) => handleInvoiceInputChange('assetName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                {invoiceErrors.description && <span className="error-text">Required</span>}
                <input
                  type="text"
                  className={invoiceErrors.description ? 'error' : ''}
                  value={editedInvoice.description}
                  onChange={(e) => handleInvoiceInputChange('description', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Vendor Name *</label>
                {invoiceErrors.vendorName && <span className="error-text">Required</span>}
                <input
                  type="text"
                  className={invoiceErrors.vendorName ? 'error' : ''}
                  value={editedInvoice.vendorName}
                  onChange={(e) => handleInvoiceInputChange('vendorName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Invoice No. *</label>
                {invoiceErrors.invoiceNo && <span className="error-text">Required</span>}
                <input
                  type="text"
                  className={invoiceErrors.invoiceNo ? 'error' : ''}
                  value={editedInvoice.invoiceNo}
                  onChange={(e) => handleInvoiceInputChange('invoiceNo', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Invoice Date *</label>
                {invoiceErrors.date && <span className="error-text">Required</span>}
                <input
                  type="date"
                  className={invoiceErrors.date ? 'error' : ''}
                  value={editedInvoice.date}
                  onChange={(e) => handleInvoiceInputChange('date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Amount *</label>
                {invoiceErrors.amount && <span className="error-text">Required</span>}
                <input
                  type="number"
                  className={invoiceErrors.amount ? 'error' : ''}
                  value={editedInvoice.amount}
                  onChange={(e) => handleInvoiceInputChange('amount', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="lease-detail-actions">
            <button className="panel-btn" style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }} onClick={() => setShowInvoiceDeleteConfirm(true)}>Delete</button>
            <div className="lease-detail-actions-right">
              <button className="panel-btn" style={{ backgroundColor: '#007bff', borderColor: '#007bff', color: 'white' }} onClick={handleSaveInvoice}>Save Changes</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header" style={{ justifyContent: 'space-between' }}>
            <button
              className="lease-detail-edit-toggle"
              title={isEditing ? 'Switch to view mode' : 'Edit'}
              onClick={() => { setIsEditing(e => !e); setErrors({}); }}
            >
              {isEditing ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
              <span>{isEditing ? 'View' : 'Edit'}</span>
            </button>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <button
                className="panel-btn"
                style={{ width: '100%', backgroundColor: '#007bff', borderColor: '#007bff', color: 'white' }}
                onClick={() => setIsAddInvoiceModalOpen(true)}
                disabled={!isEditing}
              >
                Add Invoice
              </button>
            </div>

            <div className="form-group">
              <label>CIP Code</label>
              <input type="text" className="readonly-input" value={editedAsset.id} readOnly />
            </div>

            <div className="form-group">
              <label>Asset Name{isEditing ? ' *' : ''}</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : errors.description ? 'error' : ''}
                readOnly={!isEditing}
                value={editedAsset.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Budget</label>
              <input
                type={isEditing ? 'number' : 'text'}
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedAsset.budget || ''}
                onChange={(e) => handleInputChange('budget', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category{isEditing ? ' *' : ''}</label>
              {errors.category && <span className="error-text">Required</span>}
              {isEditing ? (
                <select
                  className={errors.category ? 'error' : ''}
                  value={editedAsset.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" className="readonly-input" value={editedAsset.category} readOnly />
              )}
            </div>

            <div className="form-group">
              <label>Branch{isEditing ? ' *' : ''}</label>
              {errors.branch && <span className="error-text">Required</span>}
              {isEditing ? (
                <select
                  className={errors.branch ? 'error' : ''}
                  value={editedAsset.branch}
                  onChange={(e) => handleInputChange('branch', e.target.value)}
                >
                  <option value="">Select Branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : (
                <input type="text" className="readonly-input" value={editedAsset.branch} readOnly />
              )}
            </div>

            {editedAsset.transferredAssetId && (
              <div className="form-group">
                <label>Linked Asset ID</label>
                <input type="text" className="readonly-input" value={editedAsset.transferredAssetId} readOnly />
              </div>
            )}
          </div>

          <div className="cip-completion-section">
            <div className="cip-completion-divider" />
            <div className="cip-completion-title">Transfer to Fixed Assets</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Useful Life (Years){errors.usefulLife ? ' *' : ''}</label>
                {errors.usefulLife && <span className="error-text">Required to transfer</span>}
                <input
                  type={isEditing ? 'number' : 'text'}
                  className={!isEditing || !!editedAsset.transferredAssetId ? 'readonly-input' : errors.usefulLife ? 'error' : ''}
                  readOnly={!isEditing}
                  value={editedAsset.usefulLife || ''}
                  disabled={!!editedAsset.transferredAssetId}
                  onChange={(e) => handleInputChange('usefulLife', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Completion Date{errors.completionDate ? ' *' : ''}</label>
                {errors.completionDate && <span className="error-text">Required to transfer</span>}
                <input
                  type={isEditing ? 'date' : 'text'}
                  className={!isEditing || !!editedAsset.transferredAssetId ? 'readonly-input' : errors.completionDate ? 'error' : ''}
                  readOnly={!isEditing}
                  value={isEditing ? (editedAsset.completionDate || '') : (editedAsset.completionDate ? new Date(editedAsset.completionDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')}
                  disabled={!!editedAsset.transferredAssetId}
                  onChange={(e) => handleInputChange('completionDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                {editedAsset.transferredAssetId ? (
                  <button className="panel-btn revert-btn" style={{ width: '100%' }} onClick={handleRevert} disabled={!isEditing}>Revert Completion</button>
                ) : (
                  <button
                    className="panel-btn transfer-btn"
                    style={{ width: '100%' }}
                    onClick={handleTransfer}
                    disabled={!isEditing}
                  >
                    Transfer Completed Asset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lease-detail-actions" style={{ flexDirection: 'column', gap: 8 }}>
          {isEditing && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button className="panel-btn" style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }} onClick={handleDeleteFromPanel}>Delete</button>
              <div className="lease-detail-actions-right">
                <button className="panel-btn" style={{ backgroundColor: '#007bff', borderColor: '#007bff', color: 'white' }} onClick={handleSave}>Save Changes</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-split" style={{ height: 'calc(100vh - 56px)', minHeight: 0, overflow: 'hidden' }}>
      <div
        className="dashboard-main"
        style={selectedAssetId
          ? { marginRight: `${panelWidth}px`, display: 'flex', flexDirection: 'column', height: '100%' }
          : { display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* Sticky header */}
        <div ref={stickyHeaderRef} style={{ flexShrink: 0, background: '#fff' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#333' }}>CIP Schedule ({cipAssets.length})</h2>
          </div>
          {/* Action bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', minHeight: '44px', paddingRight: '8px', gap: '6px' }}>
            {/* Expand col spacer */}
            <div style={{ width: 28, flexShrink: 0 }} />
            {/* Checkbox wrapper aligned with table checkbox column */}
            <div style={{ width: checkboxColWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                ref={selectAllRef}
                className="lease-checkbox"
                onChange={handleSelectAll}
              />
            </div>
            {/* Select-by-status dropdown */}
            <div ref={selectDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setIsSelectDropdownOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', borderRadius: '3px' }}
              >
                <KeyboardArrowDownIcon style={{ fontSize: 16 }} />
              </button>
              {isSelectDropdownOpen && (
                <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '150px', overflow: 'hidden' }}>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('all')}>All</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('completed')}>Completed</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('in-progress')}>Ongoing</button>
                </div>
              )}
            </div>
            {selectedAssets.size > 0 && (
              <>
                <button className="action-btn action-delete" title="Delete selected" onClick={handleBatchDelete}>
                  <DeleteIcon fontSize="small" />
                </button>
                <span className="selection-count">{selectedAssets.size} selected</span>
              </>
            )}
            {/* Centered search */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ pointerEvents: 'auto', width: '420px', padding: '7px 14px', fontSize: '14px', border: '1px solid #d0d0d0', borderRadius: '4px', background: 'white', outline: 'none', color: '#495057' }}
              />
            </div>
            {/* Right side */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #d0d0d0', borderRadius: '4px', background: 'white', color: '#495057', fontSize: '13px', cursor: 'pointer', outline: 'none', minWidth: '120px' }}
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="in-progress">Ongoing</option>
              </select>
              <div ref={advancedFilterRef} style={{ position: 'relative' }}>
                <button
                  className={`adv-filter-btn${hasActiveFilters(advancedFilters) ? ' active' : ''}`}
                  title="Advanced filters"
                  onClick={() => setShowAdvancedFilters(v => !v)}
                >
                  <TuneIcon style={{ fontSize: 16 }} />
                  {hasActiveFilters(advancedFilters) && <span className="adv-filter-dot" />}
                </button>
              </div>
              <div ref={actionsMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsActionsMenuOpen(v => !v)}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d0d0d0', borderRadius: '4px', background: isActionsMenuOpen ? '#e9ecef' : 'transparent', cursor: 'pointer', color: '#495057', fontSize: '18px', lineHeight: 1 }}
                >
                  ⋮
                </button>
                {isActionsMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '160px', overflow: 'hidden' }}>
                    <button
                      className="dropdown-menu-item"
                      onClick={() => { setIsAddModalOpen(true); setIsActionsMenuOpen(false); }}
                      disabled={!selectedEntity}
                    >
                      <AddIcon fontSize="small" /><span>New CIP</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {showAdvancedFilters && (
              <AdvancedFilterPanel
                fields={CIP_FILTER_FIELDS}
                filters={advancedFilters}
                onChange={setAdvancedFilters}
                onClose={() => setShowAdvancedFilters(false)}
              />
            )}
          </div>
        </div>

        {/* Table */}
        <div
          className="table-wrapper"
          style={{ height: `calc(100vh - ${headerHeight}px - ${stickyHeaderHeight}px)`, overflowY: 'auto', overflowX: 'auto', background: 'white', borderRadius: 0, boxShadow: 'none' }}
        >
          <table className="asset-table">
            <colgroup>
              <col style={{ width: 28, minWidth: 28, maxWidth: 28 }} />
              <col style={{ width: 40, minWidth: 40, maxWidth: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: 28, padding: 0 }}></th>
                <th ref={checkboxColRef} style={{ width: 40, padding: 0 }}></th>
                {COLUMNS.map((col) => {
                  const sortKey = COLUMN_SORT_KEYS[col];
                  return (
                    <th
                      key={col}
                      onClick={sortKey ? () => handleSort(sortKey) : undefined}
                      style={sortKey ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                      className={sortKey && sortConfig.key === sortKey ? 'sorted' : ''}
                    >
                      {col}{sortKey ? renderSortIndicator(sortKey) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const isExpanded = expandedRows.has(asset.id);
                const invoices = asset.invoices || [];
                return (
                  <React.Fragment key={asset.id}>
                    <tr
                      className={selectedAssetId === asset.id && !editedInvoice ? 'selected-row' : ''}
                      onClick={() => handleRowClick(asset.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="expand-btn"
                          onClick={() => handleToggleExpand(asset.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', width: '100%' }}
                        >
                          {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="lease-checkbox"
                          checked={selectedAssets.has(asset.id)}
                          onChange={() => handleToggleAsset(asset.id)}
                        />
                      </td>
                      <td>{highlightText(asset.id)}</td>
                      <td>{highlightText(asset.branch)}</td>
                      <td>{highlightText(asset.description)}</td>
                      <td>{highlightText(asset.category)}</td>
                      <td>{asset.budget ? `$${Number(asset.budget).toLocaleString()}` : ''}</td>
                      <td>{`$${invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0).toLocaleString()}`}</td>
                      <td>{(() => { const total = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0); const budget = Number(asset.budget); if (!asset.budget) return ''; const variance = budget - total; return isNaN(variance) ? '' : `$${variance.toLocaleString()}`; })()}</td>
                      <td>
                        <span className={`status-badge ${asset.completed === 'Y' ? 'status-active' : 'status-expiring'}`}>
                          {asset.completed === 'Y' ? 'Completed' : 'Ongoing'}
                        </span>
                      </td>
                      <td>{asset.completed === 'Y' && asset.completionDate ? new Date(asset.completionDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</td>
                      <td>
                        {asset.transferredAssetId ? (
                          entityAssetIds.has(asset.transferredAssetId) ? (
                            <span
                              style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
                              onClick={(e) => { e.stopPropagation(); onNavigateToAsset?.(asset.transferredAssetId!); }}
                            >
                              {asset.transferredAssetId}
                            </span>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#888' }}>{asset.transferredAssetId}</span>
                          )
                        ) : 'N/A'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="invoice-expand-row">
                        <td colSpan={COLUMNS.length + 2} style={{ padding: 0 }}>
                          <div className="cip-invoices-container">
                            {invoices.length === 0 ? (
                              <span className="cip-invoices-empty">No invoices</span>
                            ) : (
                              <table className="cip-invoices-table">
                                <thead>
                                  <tr>
                                    <th className="cip-invoices-check-col"></th>
                                    <th>Invoice No.</th>
                                    <th>Asset Name</th>
                                    <th>Description</th>
                                    <th>Vendor</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {invoices.map(inv => (
                                    <tr key={inv.id} className={editedInvoice?.id === inv.id ? 'selected-row' : ''} onClick={(e) => { e.stopPropagation(); setSelectedAssetId(asset.id); setEditedInvoice({ ...inv }); setInvoiceErrors({}); }} style={{ cursor: 'pointer' }}>
                                      <td className="cip-invoices-check-col">{invoices.indexOf(inv) + 1}</td>
                                      <td>{inv.invoiceNo}</td>
                                      <td>{inv.assetName || asset.description}</td>
                                      <td>{inv.description}</td>
                                      <td>{inv.vendorName}</td>
                                      <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</td>
                                      <td>{inv.amount ? `$${Number(inv.amount).toLocaleString()}` : ''}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {Array.from({ length: emptyRowsNeeded }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ padding: 0 }}></td>
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <input type="checkbox" className="lease-checkbox" disabled />
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAssetId && renderDetailPanel()}

      {isAddModalOpen && selectedEntity && (
        <AddCIPModal
          onClose={() => setIsAddModalOpen(false)}
          onSaveCIPAsset={handleAddCIPAsset}
        />
      )}

      {isAddInvoiceModalOpen && selectedAssetId && (
        <AddCIPInvoiceModal
          onClose={() => setIsAddInvoiceModalOpen(false)}
          onSave={handleAddInvoice}
          defaultAssetName={editedAsset?.description || ''}
        />
      )}

      {showBatchDeleteConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowBatchDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete {selectedAssets.size} CIP Asset{selectedAssets.size > 1 ? 's' : ''}?</h3>
            <p className="confirm-text">Are you sure you want to delete {selectedAssets.size} selected CIP asset{selectedAssets.size > 1 ? 's' : ''}? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowBatchDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleConfirmBatchDelete}>Delete {selectedAssets.size} Asset{selectedAssets.size > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {showPanelDeleteConfirm && editedAsset && (
        <div className="confirm-overlay" onMouseDown={() => setShowPanelDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete CIP Asset?</h3>
            <p className="confirm-text">Are you sure you want to delete "{editedAsset.description}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowPanelDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleConfirmPanelDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceDeleteConfirm && editedInvoice && (
        <div className="confirm-overlay" onMouseDown={() => setShowInvoiceDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete Invoice?</h3>
            <p className="confirm-text">Are you sure you want to delete invoice "{editedInvoice.description}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowInvoiceDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleDeleteInvoice}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
};

export default CIPSchedule;
