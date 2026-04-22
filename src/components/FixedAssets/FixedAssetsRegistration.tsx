import React, { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import * as XLSX from 'xlsx';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AssessmentIcon from '@mui/icons-material/Assessment';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TuneIcon from '@mui/icons-material/Tune';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { Asset, AssetCategory, AssetBranch, CIPAsset } from '../../types/Asset';
import { loadEntityAssets, addEntityAsset, updateEntityAsset, deleteEntityAsset, loadEntityCIPAssets, addEntityCIPAsset } from '../../utils/dataStorage';
import AddAssetModal from './AddAssetModal';
import { generateAssetsReport } from './excel/generateAssetsReport';
import AssetUploadModal from './AssetUploadModal';
import Toast, { useToast } from '../shared/Toast';
import AdvancedFilterPanel, { AdvancedFilters, FilterFieldDef, buildEmptyFilters, hasActiveFilters } from '../shared/AdvancedFilterPanel';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
import './AddAssetModal.css';
import './FixedAssetsRegister.css';

const CATEGORIES: AssetCategory[] = ['Office Equipment', 'Motor Vehicle', 'Warehouse Equipment', 'Manufacturing Equipment', 'Equipment for Leased', 'Software'];
const BRANCHES: AssetBranch[] = ['CORP', 'PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'PARK'];

const ASSET_FILTER_FIELDS: FilterFieldDef[] = [
  { type: 'checkbox', key: 'category', label: 'Category', options: [...CATEGORIES] },
  { type: 'checkbox', key: 'branch', label: 'Branch', options: [...BRANCHES] },
  { type: 'number-range', key: 'cost', label: 'Cost' },
  { type: 'number-range', key: 'usefulLife', label: 'Useful Life (years)' },
  { type: 'row', fields: [
    { type: 'date-range', key: 'acquisitionDate', label: 'Acquisition Date' },
    { type: 'date-range', key: 'activeDate', label: 'Active Date' },
  ] },
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

interface FixedAssetsRegistrationProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
  onNavigateToCIP?: (cipId: string) => void;
  jumpToAssetId?: string | null;
  onJumpHandled?: () => void;
}

const normalizeForSearch = (text: string) => String(text).toLowerCase().replace(/\s+/g, ' ').trim();

const getAssetStatus = (asset: Asset): 'active' | 'inactive' | 'disposed' => {
  if (asset.disposed) return 'disposed';
  const effectiveActiveDate = asset.activeDate || asset.acquisitionDate;
  if (effectiveActiveDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(effectiveActiveDate);
    d.setHours(0, 0, 0, 0);
    if (d > today) return 'inactive';
  }
  return 'active';
};

const COLUMNS = [
  'Asset ID',
  'Description',
  'Category',
  'Branch',
  'Vendor',
  'Invoice No.',
  'Serial',
  'Tag/Registration',
  'Acquisition Date',
  'Active Date',
  'Cost',
  'Useful Life',
  'Dep. Rate',
  '',
];

const EMPTY_ROW_COUNT = 15;
const ROW_HEIGHT = 37;
const OVERSCAN = 8;

const COLUMN_SORT_KEYS: Record<string, string | null> = {
  'Asset ID': 'id',
  'Description': 'description',
  'Category': 'category',
  'Branch': 'branch',
  'Vendor': 'vendorName',
  'Invoice No.': 'invoice',
  'Serial': 'serialNo',
  'Tag/Registration': 'tagNo',
  'Acquisition Date': 'acquisitionDate',
  'Active Date': 'activeDate',
  'Cost': 'cost',
  'Useful Life': 'usefulLife',
  'Dep. Rate': 'depreciationRate',
  '': null,
};

const DEFAULT_PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 900;

const FixedAssetsRegistration: React.FC<FixedAssetsRegistrationProps> = ({ onNavigate, selectedEntity, onNavigateToCIP, jumpToAssetId, onJumpHandled }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive' | 'Disposed'>('All');
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cipAssets, setCIPAssets] = useState<CIPAsset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showPanelDeleteConfirm, setShowPanelDeleteConfirm] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [disposeDate, setDisposeDate] = useState('');
  const [disposeDateError, setDisposeDateError] = useState(false);
  const [disposeProceed, setDisposeProceed] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(0);
  const [reportYear, setReportYear] = useState(0);
  const [reportError, setReportError] = useState(false);
  const [uploadPreviewData, setUploadPreviewData] = useState<{ sheet1: Asset[]; sheet2: Asset[]; cipAssets: CIPAsset[]; cipToAssetLinks: { cipId: string; assetId: string }[] } | null>(null);
  const [uploadOpeningBalanceDate, setUploadOpeningBalanceDate] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(() => buildEmptyFilters(ASSET_FILTER_FIELDS));
  const advancedFilterRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [obExpanded, setObExpanded] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(99);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const checkboxColRef = useRef<HTMLTableCellElement>(null);
  const [checkboxColWidth, setCheckboxColWidth] = useState(40);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('sidePanelWidth');
    if (saved) { const n = parseInt(saved, 10); if (!isNaN(n)) return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, n)); }
    return DEFAULT_PANEL_WIDTH;
  });
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, clearToast } = useToast();
  const deferredSearch = useDeferredValue(search);
  const assetIndexMap = useMemo(() => new Map(assets.map((a, i) => [a.id, i])), [assets]);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const currentWidthRef = useRef(panelWidth);

  const highlightText = (text: string): React.ReactNode => {
    if (!deferredSearch || !text) return text;
    const norm = normalizeForSearch(text);
    const normSearch = normalizeForSearch(deferredSearch);
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

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  };

  const renderSortIndicator = (key: string) =>
    sortConfig.key === key ? <span style={{ marginLeft: 4 }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span> : null;

  const filteredAssets = useMemo(() => {
    const term = deferredSearch ? normalizeForSearch(deferredSearch) : '';
    const af = advancedFilters;
    const filtered = assets.filter(asset => {
      const status = getAssetStatus(asset);
      if (filter === 'Active' && status !== 'active') return false;
      if (filter === 'Disposed' && status !== 'disposed') return false;
      if (filter === 'Inactive' && status !== 'inactive') return false;
      if (term) {
        const found = [asset.id, asset.description, asset.tagNo, asset.serialNo, asset.category, asset.branch, asset.vendorName, asset.invoice]
          .some(f => normalizeForSearch(f || '').includes(term));
        if (!found) return false;
      }
      if (af.checkboxes.category?.length > 0 && !af.checkboxes.category.includes(asset.category)) return false;
      if (af.checkboxes.branch?.length > 0 && !af.checkboxes.branch.includes(asset.branch)) return false;
      const cost = parseFloat(asset.cost || '');
      if (af.numberRanges.cost?.min !== '' && !isNaN(cost) && cost < parseFloat(af.numberRanges.cost.min)) return false;
      if (af.numberRanges.cost?.max !== '' && !isNaN(cost) && cost > parseFloat(af.numberRanges.cost.max)) return false;
      const ul = parseFloat(asset.usefulLife || '');
      if (af.numberRanges.usefulLife?.min !== '' && !isNaN(ul) && ul < parseFloat(af.numberRanges.usefulLife.min)) return false;
      if (af.numberRanges.usefulLife?.max !== '' && !isNaN(ul) && ul > parseFloat(af.numberRanges.usefulLife.max)) return false;
      if (af.dateRanges.acquisitionDate?.earliest && asset.acquisitionDate < af.dateRanges.acquisitionDate.earliest) return false;
      if (af.dateRanges.acquisitionDate?.latest && asset.acquisitionDate > af.dateRanges.acquisitionDate.latest) return false;
      if (af.dateRanges.activeDate?.earliest && (asset.activeDate || '') < af.dateRanges.activeDate.earliest) return false;
      if (af.dateRanges.activeDate?.latest && (asset.activeDate || '') > af.dateRanges.activeDate.latest) return false;
      return true;
    });
    if (!sortConfig.key) {
      return filtered.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase() ? -1 : a.id.toLowerCase() > b.id.toLowerCase() ? 1 : 0);
    }
    const key = sortConfig.key;
    return filtered.sort((a, b) => {
      let aVal: any = a[key as keyof Asset] ?? '';
      let bVal: any = b[key as keyof Asset] ?? '';
      if (key === 'acquisitionDate') {
        aVal = new Date(String(aVal)).getTime() || 0;
        bVal = new Date(String(bVal)).getTime() || 0;
      } else if (['cost', 'usefulLife', 'depreciationRate'].includes(key)) {
        aVal = parseFloat(String(aVal).replace(/[^0-9.-]/g, '')) || 0;
        bVal = parseFloat(String(bVal).replace(/[^0-9.-]/g, '')) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, deferredSearch, filter, advancedFilters, sortConfig]);

  const [scrollTop, setScrollTop] = useState(0);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const scrollRAF = useRef<number | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const val = e.currentTarget.scrollTop;
    if (scrollRAF.current !== null) cancelAnimationFrame(scrollRAF.current);
    scrollRAF.current = requestAnimationFrame(() => {
      setScrollTop(val);
      scrollRAF.current = null;
    });
  }, []);

  const wrapperHeight = tableWrapperRef.current?.clientHeight ?? 600;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(filteredAssets.length, Math.ceil((scrollTop + wrapperHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleAssets = filteredAssets.slice(startIndex, endIndex);
  const topPad = startIndex * ROW_HEIGHT;
  const bottomPad = Math.max(0, filteredAssets.length - endIndex) * ROW_HEIGHT;

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
    if (stickyHeaderRef.current) setStickyHeaderHeight(stickyHeaderRef.current.offsetHeight);
    if (checkboxColRef.current) setCheckboxColWidth(checkboxColRef.current.offsetWidth);
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
      currentWidthRef.current = newWidth;
      if (panelRef.current) panelRef.current.style.width = `${newWidth}px`;
      if (mainContentRef.current) mainContentRef.current.style.marginRight = `${newWidth}px`;
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setPanelWidth(currentWidthRef.current);
        localStorage.setItem('sidePanelWidth', String(currentWidthRef.current));
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
      loadEntityAssets(selectedEntity.id).then(setAssets);
      loadEntityCIPAssets(selectedEntity.id).then(setCIPAssets);
    } else {
      setAssets([]);
      setCIPAssets([]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (jumpToAssetId && assets.length > 0) {
      const asset = assets.find(a => a.id === jumpToAssetId);
      if (asset) {
        setSelectedAssetId(jumpToAssetId);
        onJumpHandled?.();
        const idx = filteredAssets.findIndex(a => a.id === jumpToAssetId);
        if (idx >= 0 && tableWrapperRef.current) {
          const target = Math.max(0, idx * ROW_HEIGHT - tableWrapperRef.current.clientHeight / 2 + ROW_HEIGHT / 2);
          tableWrapperRef.current.scrollTop = target;
          setScrollTop(target);
        }
      }
    }
  }, [jumpToAssetId, assets]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = assets.find(a => a.id === selectedAssetId);
      if (asset) {
        setEditedAsset({ ...asset });
        setErrors({});
        setIsEditing(false);
        setObExpanded(false);
      } else {
        setSelectedAssetId(null);
        setEditedAsset(null);
        setIsEditing(false);
        setObExpanded(false);
      }
    } else {
      setEditedAsset(null);
      setErrors({});
      setIsEditing(false);
      setObExpanded(false);
    }
  }, [selectedAssetId, assets]);

  useEffect(() => {
    if (selectAllRef.current) {
      const filteredIndices = filteredAssets.map(a => assetIndexMap.get(a.id) ?? -1);
      const allSelected = filteredIndices.length > 0 && filteredIndices.every(i => selectedAssets.has(i));
      const someSelected = !allSelected && filteredIndices.some(i => selectedAssets.has(i));
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedAssets, filteredAssets, assetIndexMap]);

  const handleSelectAll = () => {
    const filteredIndices = filteredAssets.map(a => assetIndexMap.get(a.id) ?? -1);
    const allSelected = filteredIndices.length > 0 && filteredIndices.every(i => selectedAssets.has(i));
    if (allSelected) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredIndices));
    }
  };

  const handleSelectByStatus = (status: 'all' | 'active' | 'inactive' | 'disposed') => {
    let indices: number[];
    if (status === 'all') indices = filteredAssets.map(a => assetIndexMap.get(a.id) ?? -1);
    else indices = filteredAssets.filter(a => getAssetStatus(a) === status).map(a => assetIndexMap.get(a.id) ?? -1);
    setSelectedAssets(new Set(indices));
    setIsSelectDropdownOpen(false);
  };

  const handleToggleAsset = (index: number) => {
    const newSet = new Set(selectedAssets);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedAssets(newSet);
  };

  const handleRowClick = (assetId: string) => {
    setSelectedAssetId(selectedAssetId === assetId ? null : assetId);
  };

  const handleAddAsset = async (asset: Asset) => {
    if (!selectedEntity) return;
    const updatedAssets = await addEntityAsset(selectedEntity.id, asset);
    setAssets(updatedAssets);
    setIsAddModalOpen(false);
    showToast('Asset created', 'success');
  };

  const handleDeleteSelected = () => {
    if (selectedAssets.size > 0) setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (!selectedEntity) return;
    setShowBatchDeleteConfirm(false);
    setIsActionLoading(true);
    let currentAssets = assets;
    const idsToDelete = Array.from(selectedAssets).map(i => assets[i].id);
    for (let i = 0; i < idsToDelete.length; i++) {
      currentAssets = await deleteEntityAsset(selectedEntity.id, idsToDelete[i]);
    }
    setAssets(currentAssets);
    setSelectedAssets(new Set());
    setIsActionLoading(false);
    showToast('Asset(s) deleted', 'delete');
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, [field]: value } as Asset);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };


  const validateForm = (): boolean => {
    if (!editedAsset) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!editedAsset.description.trim()) { newErrors.description = true; isValid = false; }
    if (!editedAsset.category) { newErrors.category = true; isValid = false; }
    if (!editedAsset.branch) { newErrors.branch = true; isValid = false; }
    if (!editedAsset.cost.trim()) { newErrors.cost = true; isValid = false; }
    if (!editedAsset.usefulLife.trim()) { newErrors.usefulLife = true; isValid = false; }
    if (!editedAsset.depreciationRate.trim()) { newErrors.depreciationRate = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!editedAsset || !selectedEntity || !validateForm()) return;
    const updatedAssets = await updateEntityAsset(selectedEntity.id, editedAsset);
    setAssets(updatedAssets);
    setIsEditing(false);
    showToast('Changes saved', 'edit');
  };

  const handleCancel = () => {
    setSelectedAssetId(null);
  };

  const handleDeleteFromPanel = () => {
    setShowPanelDeleteConfirm(true);
  };

  const handleConfirmPanelDelete = async () => {
    if (!selectedAssetId || !selectedEntity) return;
    setShowPanelDeleteConfirm(false);
    setIsActionLoading(true);
    const updatedAssets = await deleteEntityAsset(selectedEntity.id, selectedAssetId);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
    setIsActionLoading(false);
    showToast('Asset deleted', 'delete');
  };

  const handleConfirmDispose = async () => {
    if (!disposeDate) { setDisposeDateError(true); return; }
    if (!editedAsset || !selectedEntity) return;
    setShowDisposeModal(false);
    setIsActionLoading(true);
    const disposed = { ...editedAsset, disposed: true, disposalDate: disposeDate, proceed: disposeProceed };
    const updatedAssets = await updateEntityAsset(selectedEntity.id, disposed);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
    setDisposeDate('');
    setDisposeProceed('');
    setIsActionLoading(false);
    showToast('Asset disposed', 'delete');
  };

  const handleRevertDisposal = async () => {
    if (!editedAsset || !selectedEntity) return;
    const reverted = { ...editedAsset, disposed: false, disposalDate: undefined, proceed: undefined };
    const updatedAssets = await updateEntityAsset(selectedEntity.id, reverted);
    setAssets(updatedAssets);
    showToast('Disposal reverted', 'edit');
  };

  const handleUploadClick = () => {
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingFile(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      const parseSheetRows = (sheetIndex: number): Record<string, string>[] => {
        const sheetName = workbook.SheetNames[sheetIndex];
        if (!sheetName) return [];
        return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });
      };

      const normalizeRow = (row: Record<string, string>): Record<string, string> => {
        const n: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase().trim()] = String(v).trim(); });
        return n;
      };

      const parseDate = (raw: string): string => {
        if (!raw) return '';
        const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        return raw;
      };

      const makeDepRate = (usefulLife: string) =>
        usefulLife && Number(usefulLife) > 0 ? ((1 / Number(usefulLife)) * 100).toFixed(2) : '';

      // Track all IDs assigned so far (existing + newly parsed) to avoid duplicates
      const allAssignedIds = assets.map(a => a.id);

      const assignId = (n: Record<string, string>): string => {
        const explicit = n['asset id'] || n['asset_id'] || '';
        if (explicit) { allAssignedIds.push(explicit); return explicit; }
        const id = generateAssetId((n['branch'] || '') as AssetBranch, (n['asset category'] || n['category'] || '') as AssetCategory, allAssignedIds);
        allAssignedIds.push(id);
        return id;
      };

      const na = (v: string) => v || 'N-A';

      // --- Sheet 1: Opening balance fixed assets ---
      const sheet1Rows = parseSheetRows(0);
      const sheet1Assets: Asset[] = sheet1Rows.map((row) => {
        const n = normalizeRow(row);
        const usefulLife = n['useful life'] || '';
        const id = assignId(n);
        const obCost = (n['opening balance accumulated depreciation'] || '').replace(/[^0-9.-]/g, '');
        return {
          id,
          assetType: 'Regular' as const,
          description: n['description'] || '',
          category: (n['asset category'] || n['category'] || '') as AssetCategory,
          branch: (n['branch'] || '') as AssetBranch,
          vendorName: na(n['vendor name'] || n['vendor'] || ''),
          invoice: na(n['invoice no.'] || n['invoice no'] || ''),
          serialNo: na(n['serial/vin'] || n['serial'] || ''),
          tagNo: na(n['tag/reg'] || n['tag/registration'] || n['tag'] || ''),
          acquisitionDate: parseDate(n['acquistion/ completion date'] || n['acquistion/completion date'] || n['acquisition/ completion date'] || n['acquisition/completion date'] || n['acquisition date'] || ''),
          activeDate: parseDate(n['active date'] || ''),
          cost: (n['opening balance cost'] || '').replace(/[^0-9.-]/g, ''),
          usefulLife,
          depreciationRate: makeDepRate(usefulLife),
          openingBalances: obCost ? [{ type: 'Existing' as const, date: '', value: obCost }] : undefined,
        };
      }).filter(a => a.description);

      // --- Sheet 2: Addition leases (no opening balances) ---
      const sheet2Rows = parseSheetRows(1);
      const sheet2Assets: Asset[] = sheet2Rows.map((row) => {
        const n = normalizeRow(row);
        const usefulLife = n['useful life'] || '';
        const id = assignId(n);
        const additionalCost = (n['addition cost'] || n['additional cost'] || '').replace(/[^0-9.-]/g, '');
        const transferCost = (n['transfer from completed asset'] || '').replace(/[^0-9.-]/g, '');
        const cost = additionalCost || transferCost;
        return {
          id,
          assetType: 'Regular' as const,
          description: n['description'] || '',
          category: (n['asset category'] || n['category'] || '') as AssetCategory,
          branch: (n['branch'] || '') as AssetBranch,
          vendorName: na(n['vendor name'] || n['vendor'] || ''),
          invoice: na(n['invoice no.'] || n['invoice no'] || ''),
          serialNo: na(n['serial/vin'] || n['serial'] || ''),
          tagNo: na(n['tag/reg'] || n['tag/registration'] || n['tag'] || ''),
          acquisitionDate: parseDate(n['acquistion/ completion date'] || n['acquistion/completion date'] || n['acquisition/ completion date'] || n['acquisition/completion date'] || n['acquisition date'] || ''),
          activeDate: parseDate(n['active date'] || ''),
          cost,
          usefulLife,
          depreciationRate: makeDepRate(usefulLife),
        };
      }).filter(a => a.description);

      // --- Sheet 3: CIP ---
      // Parse as raw arrays to avoid duplicate "asset id" header collision.
      // Column layout (0-based):
      // A=0 asset id (ignored), B=1 cip description, C=2 description, D=3 asset category,
      // E=4 branch, F=5 vendor name, G=6 invoice no., H=7 invoice date, I=8 cip status (ignored),
      // J=9 linked asset id, K=10 completed date, L=11 useful life, M=12 amount, N=13 completed amount (ignored)
      const sheet3Name = workbook.SheetNames[2];
      const sheet3RawRows: string[][] = sheet3Name
        ? XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheet3Name], { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })
        : [];

      const cipMap = new Map<string, { asset: CIPAsset; linkedAssetId: string | null }>();
      const cipOrder: string[] = [];

      const cipCell = (row: string[], col: number) => String(row[col] ?? '').trim();

      for (let ri = 1; ri < sheet3RawRows.length; ri++) {
        const row = sheet3RawRows[ri];
        const cipDesc = cipCell(row, 1);
        if (!cipDesc) continue;

        const category = cipCell(row, 3) as AssetCategory;
        const branch = cipCell(row, 4) as AssetBranch;
        const vendorName = cipCell(row, 5);
        const invoiceNo = cipCell(row, 6);
        const invoiceDate = parseDate(cipCell(row, 7));
        const desc = cipCell(row, 2);

        if (!cipMap.has(cipDesc)) {
          const catCode = CATEGORY_CODE[category] || 'X';
          const rand = Math.floor(1000 + Math.random() * 9000).toString();
          const cipId = `C-${branch}${catCode}${rand}`;
          cipMap.set(cipDesc, {
            asset: {
              id: cipId,
              assetType: 'CIP' as const,
              description: cipDesc,
              category,
              branch,
              vendorName: vendorName || 'N-A',
              invoice: invoiceNo || 'N-A',
              date: invoiceDate,
              amount: '',
              budget: 'N-A',
              completed: 'N',
              completionDate: '',
              usefulLife: '',
              invoices: [],
            },
            linkedAssetId: null,
          });
          cipOrder.push(cipDesc);
        }

        const entry = cipMap.get(cipDesc)!;

        if (desc.toUpperCase() === 'COMPLETED ASSET') {
          const linkedId = cipCell(row, 9);
          entry.asset = {
            ...entry.asset,
            completed: 'Y',
            completionDate: parseDate(cipCell(row, 10)),
            usefulLife: cipCell(row, 11),
          };
          if (linkedId) entry.linkedAssetId = linkedId;
        } else if (desc) {
          const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          entry.asset.invoices = [...entry.asset.invoices, {
            id: invoiceId,
            assetName: cipDesc,
            description: desc,
            vendorName: vendorName || 'N-A',
            invoiceNo: invoiceNo || 'N-A',
            date: invoiceDate,
            amount: cipCell(row, 12).replace(/[^0-9.-]/g, ''),
          }];
        }
      }

      const cipAssets = cipOrder.map(k => {
        const { asset, linkedAssetId } = cipMap.get(k)!;
        return linkedAssetId ? { ...asset, transferredAssetId: linkedAssetId } : asset;
      });
      const cipToAssetLinks = cipAssets
        .filter(c => !!c.transferredAssetId)
        .map(c => ({ cipId: c.id, assetId: c.transferredAssetId! }));

      const totalCount = sheet1Assets.length + sheet2Assets.length + cipAssets.length;
      setIsParsingFile(false);
      if (totalCount > 0) {
        setUploadOpeningBalanceDate('');
        setUploadPreviewData({ sheet1: sheet1Assets, sheet2: sheet2Assets, cipAssets, cipToAssetLinks });
      }
    };
    reader.onerror = () => setIsParsingFile(false);
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmUpload = async (obDate: string) => {
    if (!uploadPreviewData || !selectedEntity || isImporting) return;
    setIsImporting(true);
    const snapshot = uploadPreviewData;
    setUploadPreviewData(null);
    setUploadOpeningBalanceDate('');
    const { sheet1, sheet2, cipAssets, cipToAssetLinks } = snapshot;

    // Apply opening balance date to sheet1 assets
    const sheet1WithDate = sheet1.map(a => ({
      ...a,
      openingBalances: a.openingBalances?.map(ob => ({ ...ob, date: obDate })),
    }));

    // Build a map of assetId -> mutable asset for CIP linking
    const allUploadAssets = [...sheet1WithDate, ...sheet2];
    const assetIdMap = new Map(allUploadAssets.map(a => [a.id, a]));

    // Apply CIP links to assets
    for (const link of cipToAssetLinks) {
      const asset = assetIdMap.get(link.assetId);
      if (asset) {
        assetIdMap.set(link.assetId, { ...asset, sourceCIPId: link.cipId });
      }
    }

    // transferredAssetId already set on cipAssets during parsing
    const finalCIPAssets = cipAssets;

    // Save assets
    let currentAssets = assets;
    for (const asset of allUploadAssets) {
      const finalAsset = assetIdMap.get(asset.id) ?? asset;
      currentAssets = await addEntityAsset(selectedEntity.id, finalAsset);
    }
    setAssets(currentAssets);

    // Save CIP assets
    for (const cip of finalCIPAssets) {
      await addEntityCIPAsset(selectedEntity.id, cip);
    }

    const assetCount = allUploadAssets.length;
    const cipCount = finalCIPAssets.length;
    setIsImporting(false);
    const parts = [];
    if (assetCount > 0) parts.push(`${assetCount} asset${assetCount !== 1 ? 's' : ''}`);
    if (cipCount > 0) parts.push(`${cipCount} CIP item${cipCount !== 1 ? 's' : ''}`);
    showToast(`${parts.join(' and ')} imported`, 'success');
  };

  const renderDetailPanel = () => {
    if (!editedAsset || !selectedAssetId) return null;

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
              {!editedAsset.disposed ? (
                <button
                  className="panel-btn"
                  style={{ backgroundColor: '#fd7e14', borderColor: '#fd7e14', color: 'white', width: '100%' }}
                  onClick={() => setShowDisposeModal(true)}
                  disabled={!isEditing}
                >
                  Dispose Asset
                </button>
              ) : (
                <button
                  className="panel-btn"
                  style={{ backgroundColor: '#6c757d', borderColor: '#6c757d', color: 'white', width: '100%' }}
                  onClick={handleRevertDisposal}
                  disabled={!isEditing}
                >
                  Revert Disposal
                </button>
              )}
            </div>
            <div className="form-group">
              <label>Asset ID</label>
              <input type="text" className="readonly-input" value={editedAsset.id} readOnly />
            </div>

            <div className="form-group">
              <label>Description{isEditing ? ' *' : ''}</label>
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

            <div className="form-group">
              <label>Vendor</label>
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedAsset.vendorName}
                onChange={(e) => handleInputChange('vendorName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Invoice No.</label>
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedAsset.invoice}
                onChange={(e) => handleInputChange('invoice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Serial</label>
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedAsset.serialNo}
                onChange={(e) => handleInputChange('serialNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tag/Registration</label>
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedAsset.tagNo}
                onChange={(e) => handleInputChange('tagNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Acquisition Date</label>
              <input
                type={isEditing ? 'date' : 'text'}
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={isEditing ? editedAsset.acquisitionDate : (editedAsset.acquisitionDate ? new Date(editedAsset.acquisitionDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')}
                onChange={(e) => handleInputChange('acquisitionDate', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Active Date</label>
              {isEditing ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      id="edit-active-same"
                      checked={!editedAsset.activeDate}
                      onChange={(e) => handleInputChange('activeDate', e.target.checked ? '' : (editedAsset.acquisitionDate || ''))}
                    />
                    <label htmlFor="edit-active-same" style={{ margin: 0, fontWeight: 'normal', fontSize: 13 }}>Same as acquisition date</label>
                  </div>
                  {editedAsset.activeDate && (
                    <input
                      type="date"
                      value={editedAsset.activeDate}
                      onChange={(e) => handleInputChange('activeDate', e.target.value)}
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  className="readonly-input"
                  readOnly
                  value={(() => {
                    const d = editedAsset.activeDate || editedAsset.acquisitionDate;
                    return d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                  })()}
                />
              )}
            </div>

            {editedAsset.disposed && (
              <div className="form-group">
                <label>Disposal Date</label>
                <input
                  type={isEditing ? 'date' : 'text'}
                  className={!isEditing ? 'readonly-input' : ''}
                  readOnly={!isEditing}
                  value={isEditing ? (editedAsset.disposalDate || '') : (editedAsset.disposalDate ? new Date(editedAsset.disposalDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')}
                  onChange={(e) => handleInputChange('disposalDate', e.target.value)}
                />
              </div>
            )}

            {editedAsset.disposed && (
              <div className="form-group">
                <label>Proceed</label>
                <input
                  type={isEditing ? 'number' : 'text'}
                  className={!isEditing ? 'readonly-input' : ''}
                  readOnly={!isEditing}
                  value={editedAsset.proceed || ''}
                  onChange={(e) => handleInputChange('proceed', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Cost{isEditing ? ' *' : ''}</label>
              {errors.cost && <span className="error-text">Required</span>}
              <input
                type={isEditing ? 'number' : 'text'}
                className={!isEditing ? 'readonly-input' : errors.cost ? 'error' : ''}
                readOnly={!isEditing}
                value={isEditing ? editedAsset.cost : (editedAsset.cost ? `$${Number(editedAsset.cost).toLocaleString()}` : '')}
                onChange={(e) => handleInputChange('cost', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Useful Life{isEditing ? ' *' : ''}</label>
              {errors.usefulLife && <span className="error-text">Required</span>}
              <input
                type={isEditing ? 'number' : 'text'}
                className={!isEditing ? 'readonly-input' : errors.usefulLife ? 'error' : ''}
                readOnly={!isEditing}
                value={editedAsset.usefulLife}
                onChange={(e) => handleInputChange('usefulLife', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Dep. Rate</label>
              {errors.depreciationRate && <span className="error-text">Required</span>}
              <input
                type={isEditing ? 'number' : 'text'}
                className={!isEditing ? 'readonly-input' : errors.depreciationRate ? 'error' : ''}
                readOnly={!isEditing}
                value={editedAsset.depreciationRate}
                onChange={(e) => handleInputChange('depreciationRate', e.target.value)}
              />
            </div>
          </div>

          <div className="asset-ob-section">
            <div className="asset-ob-header">
              <button className="ob-toggle-btn" onClick={() => setObExpanded(e => !e)}>
                {obExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                <span className="asset-ob-title">Opening Balances{(editedAsset.openingBalances?.length ?? 0) > 0 ? ` (${editedAsset.openingBalances!.length})` : ''}</span>
              </button>
              {obExpanded && isEditing && (
                <button className="asset-ob-add-btn" onClick={() => setEditedAsset({ ...editedAsset, openingBalances: [...(editedAsset.openingBalances || []), { type: 'Existing', date: '', value: '' }] })}>+ Add</button>
              )}
            </div>
            {obExpanded && (editedAsset.openingBalances || []).length === 0 && (
              <p className="asset-ob-empty">No opening balances</p>
            )}
            {obExpanded && (editedAsset.openingBalances || []).map((ob, i) => (
              <div key={i} className="asset-ob-card">
                <div className="asset-ob-card-header">
                  {isEditing && (
                    <button className="asset-ob-delete-btn" onClick={() => setEditedAsset({ ...editedAsset, openingBalances: (editedAsset.openingBalances || []).filter((_, idx) => idx !== i) })}>×</button>
                  )}
                </div>
                <div className="asset-ob-card-body">
                  <div className="asset-ob-field">
                    <label>Date</label>
                    <input
                      type={isEditing ? 'date' : 'text'}
                      className={!isEditing ? 'readonly-input' : ''}
                      readOnly={!isEditing}
                      value={isEditing ? ob.date : (ob.date ? new Date(ob.date).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')}
                      onChange={(e) => {
                        const updated = [...(editedAsset.openingBalances || [])];
                        updated[i] = { ...updated[i], date: e.target.value };
                        setEditedAsset({ ...editedAsset, openingBalances: updated });
                      }}
                    />
                  </div>
                  <div className="asset-ob-field">
                    <label>Balance</label>
                    <input
                      type={isEditing ? 'number' : 'text'}
                      className={!isEditing ? 'readonly-input' : ''}
                      readOnly={!isEditing}
                      placeholder="0"
                      value={isEditing ? ob.value : (ob.value ? `$${Number(ob.value).toLocaleString()}` : '')}
                      onChange={(e) => {
                        const updated = [...(editedAsset.openingBalances || [])];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setEditedAsset({ ...editedAsset, openingBalances: updated });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
      <div className="dashboard-main" ref={mainContentRef} style={selectedAssetId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div ref={stickyHeaderRef} style={{ background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ flex: 1 }} />
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#333' }}>Fixed Assets Register ({assets.length})</h2>
            <div style={{ flex: 1 }} />
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', minHeight: '44px', paddingRight: '8px', gap: '6px' }}>
            <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
            <div style={{ width: checkboxColWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                ref={selectAllRef}
                className="select-all-checkbox"
                onChange={handleSelectAll}
              />
            </div>
            <div ref={selectDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setIsSelectDropdownOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', borderRadius: '3px' }}>
                <KeyboardArrowDownIcon style={{ fontSize: 16 }} />
              </button>
              {isSelectDropdownOpen && (
                <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '150px', overflow: 'hidden' }}>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('all')}>All</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('active')}>Active</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('inactive')}>Inactive</button>
                  <button className="dropdown-menu-item" onClick={() => handleSelectByStatus('disposed')}>Disposed</button>
                </div>
              )}
            </div>
            {selectedAssets.size > 0 && (
              <>
                <button className="action-btn action-copy" title="Copy"><ContentCopyIcon fontSize="small" /></button>
                <button className="action-btn action-delete" title="Delete" onClick={handleDeleteSelected}><DeleteIcon fontSize="small" /></button>
                <span className="selection-count">{selectedAssets.size} selected</span>
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
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'All' | 'Active' | 'Inactive' | 'Disposed')} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #d0d0d0', borderRadius: '4px', background: 'white', color: '#495057', cursor: 'pointer', outline: 'none', minWidth: '120px' }}>
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Disposed">Disposed</option>
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
                style={{ width: 32, height: 32, border: '1px solid #d0d0d0', borderRadius: '4px', background: isActionsMenuOpen ? '#e9ecef' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#495057', fontSize: '18px', lineHeight: 1 }}
                title="More actions"
              >⋮</button>
              {isActionsMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '160px', overflow: 'hidden' }}>
                  <button className="dropdown-menu-item" onClick={() => { setIsAddModalOpen(true); setIsActionsMenuOpen(false); }} disabled={!selectedEntity}>
                    <AddIcon fontSize="small" /><span>New Asset</span>
                  </button>
                  <button className="dropdown-menu-item" onClick={() => { handleUploadClick(); setIsActionsMenuOpen(false); }} disabled={!selectedEntity}>
                    <UploadFileIcon fontSize="small" /><span>Upload Excel</span>
                  </button>
                  <button className="dropdown-menu-item" onClick={() => { setShowReportModal(true); setIsActionsMenuOpen(false); }} disabled={!selectedEntity}>
                    <AssessmentIcon fontSize="small" /><span>Report</span>
                  </button>
                </div>
              )}
            </div>
            </div>
            {showAdvancedFilters && (
              <AdvancedFilterPanel
                fields={ASSET_FILTER_FIELDS}
                filters={advancedFilters}
                onChange={setAdvancedFilters}
                onClose={() => setShowAdvancedFilters(false)}
              />
            )}
          </div>
        </div>
        <div className="dashboard-container" style={{ padding: 0, maxWidth: 'none', margin: 0 }}>
          <div className="table-section" style={{ margin: 0 }}>
            <div className="assets-register-body">
              <div ref={tableWrapperRef} className="table-wrapper" onScroll={handleScroll} style={{ borderRadius: 0, boxShadow: 'none', overflowY: 'auto', height: `calc(100vh - ${headerHeight}px - ${stickyHeaderHeight}px)` }}>
                <table className="asset-table">
                  <colgroup>
                    <col style={{ width: 40, minWidth: 40, maxWidth: 40 }} />
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th ref={checkboxColRef} style={{ width: 40, minWidth: 40, maxWidth: 40 }}></th>
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
                    {topPad > 0 && <tr><td colSpan={15} style={{ height: topPad, padding: 0, border: 'none' }} /></tr>}
                    {visibleAssets.map((asset) => {
                      const assetIndex = assetIndexMap.get(asset.id) ?? -1;
                      return (
                      <tr
                        key={asset.id}
                        data-asset-id={asset.id}
                        className={`${selectedAssetId === asset.id ? 'selected-row' : ''}${asset.disposed ? ' disposed-row' : ''}`}
                        onClick={() => handleRowClick(asset.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center', padding: 8 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="lease-checkbox"
                            checked={selectedAssets.has(assetIndex)}
                            onChange={() => handleToggleAsset(assetIndex)}
                          />
                        </td>
                        <td>{highlightText(asset.id)}</td>
                        <td style={{ maxWidth: 240 }}><div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}>{highlightText(asset.description)}</div></td>
                        <td>{highlightText(asset.category)}</td>
                        <td>{highlightText(asset.branch)}</td>
                        <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.sourceCIPId && onNavigateToCIP ? (
                            <span
                              style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
                              onClick={(e) => { e.stopPropagation(); onNavigateToCIP(asset.sourceCIPId!); }}
                            >
                              {highlightText(asset.vendorName)}
                            </span>
                          ) : highlightText(asset.vendorName)}
                        </td>
                        <td>{highlightText(asset.invoice)}</td>
                        <td style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightText(asset.serialNo)}</td>
                        <td>{highlightText(asset.tagNo)}</td>
                        <td>{asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</td>
                        <td>{(() => { const d = asset.activeDate || asset.acquisitionDate; return d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; })()}</td>
                        <td>{asset.cost ? `$${Number(asset.cost.replace(/[^0-9.-]/g, '')).toLocaleString()}` : ''}</td>
                        <td>{asset.usefulLife}</td>
                        <td>{asset.depreciationRate ? `${Number(asset.depreciationRate).toFixed(2)}%` : ''}</td>
                        <td>
                          {(() => {
                            const s = getAssetStatus(asset);
                            if (s === 'disposed') return <span className="status-badge status-disposed">Disposed</span>;
                            if (s === 'inactive') return <span className="status-badge status-inactive">Inactive</span>;
                            return <span className="status-badge status-active">Active</span>;
                          })()}
                        </td>
                      </tr>
                      );
                    })}
                    {bottomPad > 0 && <tr><td colSpan={15} style={{ height: bottomPad, padding: 0, border: 'none' }} /></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedAssetId && renderDetailPanel()}

{isAddModalOpen && selectedEntity && (
        <AddAssetModal
          onClose={() => setIsAddModalOpen(false)}
          onSaveAsset={handleAddAsset}
          existingIds={assets.map(a => a.id)}
        />
      )}

      {showBatchDeleteConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowBatchDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete {selectedAssets.size} Asset{selectedAssets.size > 1 ? 's' : ''}?</h3>
            <p className="confirm-text">Are you sure you want to delete {selectedAssets.size} selected asset{selectedAssets.size > 1 ? 's' : ''}? This action cannot be undone.</p>
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
            <h3 className="confirm-title">Delete Asset?</h3>
            <p className="confirm-text">Are you sure you want to delete "{editedAsset.description}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowPanelDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleConfirmPanelDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showDisposeModal && (
        <div className="confirm-overlay" onMouseDown={() => { setShowDisposeModal(false); setDisposeDate(''); setDisposeDateError(false); setDisposeProceed(''); }}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Dispose Asset</h3>
            <p className="confirm-text">This will mark the asset as disposed.</p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Disposal Date * {disposeDateError && <span className="error-text">Required</span>}</label>
              <input
                type="date"
                className={disposeDateError ? 'error' : ''}
                value={disposeDate}
                onChange={(e) => { setDisposeDate(e.target.value); if (e.target.value) setDisposeDateError(false); }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Proceed</label>
              <input
                type="number"
                placeholder="0.00"
                value={disposeProceed}
                onChange={(e) => setDisposeProceed(e.target.value)}
              />
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => { setShowDisposeModal(false); setDisposeDate(''); setDisposeDateError(false); setDisposeProceed(''); }}>Cancel</button>
              <button
                className="confirm-delete-button"
                style={{ backgroundColor: '#fd7e14', borderColor: '#fd7e14' }}
                onClick={handleConfirmDispose}
              >Dispose</button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="confirm-overlay" onMouseDown={() => { setShowReportModal(false); setReportMonth(0); setReportYear(0); setReportError(false); }}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Generate Report</h3>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Month {reportError && reportMonth === 0 && <span className="error-text">Required</span>}</label>
              <select
                className={reportError && reportMonth === 0 ? 'error' : ''}
                value={reportMonth}
                onChange={(e) => { setReportMonth(parseInt(e.target.value, 10)); setReportError(false); }}
              >
                <option value={0}>Select month...</option>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Year {reportError && reportYear === 0 && <span className="error-text">Required</span>}</label>
              <select
                className={reportError && reportYear === 0 ? 'error' : ''}
                value={reportYear}
                onChange={(e) => { setReportYear(parseInt(e.target.value, 10)); setReportError(false); }}
              >
                <option value={0}>Select year...</option>
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => { setShowReportModal(false); setReportMonth(0); setReportYear(0); setReportError(false); }}>Cancel</button>
              <button
                className="confirm-delete-button"
                style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
                onClick={async () => {
                  if (!reportMonth || !reportYear) { setReportError(true); return; }
                  const freshCIPAssets = selectedEntity ? await loadEntityCIPAssets(selectedEntity.id) : [];
                  generateAssetsReport(assets, selectedEntity?.name ?? '', reportMonth, reportYear, freshCIPAssets);
                  setShowReportModal(false); setReportMonth(0); setReportYear(0); setReportError(false);
                }}
              >Generate</button>
            </div>
          </div>
        </div>
      )}

      {(isParsingFile || isImporting || isActionLoading) && (
        <div className="confirm-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#fff' }}>
            <div className="upload-spinner" />
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {isParsingFile ? 'Reading file...' : isImporting ? 'Importing...' : 'Loading...'}
            </span>
          </div>
        </div>
      )}

      {uploadPreviewData && (
        <AssetUploadModal
          sheet1Assets={uploadPreviewData.sheet1}
          sheet2Assets={uploadPreviewData.sheet2}
          cipAssets={uploadPreviewData.cipAssets}
          openingBalanceDate={uploadOpeningBalanceDate}
          onOpeningBalanceDateChange={setUploadOpeningBalanceDate}
          onConfirm={handleConfirmUpload}
          onCancel={() => { setUploadPreviewData(null); setUploadOpeningBalanceDate(''); }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
};

export default FixedAssetsRegistration;
