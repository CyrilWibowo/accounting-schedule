import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { Asset, AssetCategory, AssetBranch, OpeningBalance } from '../../types/Asset';
import { loadEntityAssets, addEntityAsset, updateEntityAsset, deleteEntityAsset } from '../../utils/dataStorage';
import AddAssetModal from './AddAssetModal';
import { generateAssetsReport } from './excel/generateAssetsReport';
import AssetUploadModal from './AssetUploadModal';
import Toast, { useToast } from '../shared/Toast';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
import './AddAssetModal.css';
import './FixedAssetsRegister.css';

const CATEGORIES: AssetCategory[] = ['Office Equipment', 'Motor Vehicle', 'Warehouse Equipment', 'Manufacturing Equipment', 'Equipment for Leased', 'Software'];
const BRANCHES: AssetBranch[] = ['CORP', 'PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'PARK'];

const CATEGORY_CODE: Record<string, string> = {
  'Office Equipment': 'O',
  'Motor Vehicle': 'V',
  'Warehouse Equipment': 'W',
  'Manufacturing Equipment': 'M',
  'Equipment for Leased': 'L',
  'Software': 'S',
};

const generateAssetId = (branch: AssetBranch, category: AssetCategory): string => {
  const catCode = CATEGORY_CODE[category] || 'X';
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  return `${branch}${catCode}${rand}`;
};

interface FixedAssetsRegistrationProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
}

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
  'Cost',
  'Useful Life (Yrs)',
  'Dep. Rate (%)',
  'Status',
];

const EMPTY_ROW_COUNT = 15;
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 700;

const FixedAssetsRegistration: React.FC<FixedAssetsRegistrationProps> = ({ onNavigate, selectedEntity }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Disposed'>('All');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState<Asset[]>([]);
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
  const [uploadPreviewAssets, setUploadPreviewAssets] = useState<Asset[] | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, clearToast } = useToast();

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
    if (selectedEntity) {
      loadEntityAssets(selectedEntity.id).then(setAssets);
    } else {
      setAssets([]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = assets.find(a => a.id === selectedAssetId);
      if (asset) {
        setEditedAsset({ ...asset });
        setErrors({});
      } else {
        setSelectedAssetId(null);
        setEditedAsset(null);
      }
    } else {
      setEditedAsset(null);
      setErrors({});
    }
  }, [selectedAssetId, assets]);

  // Keep select-all indeterminate state in sync
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = assets.length > 0 && selectedAssets.size === assets.length;
      const someSelected = selectedAssets.size > 0 && selectedAssets.size < assets.length;
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedAssets, assets.length]);

  const handleSelectAll = useCallback(() => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map(a => a.id)));
    }
  }, [assets, selectedAssets.size]);

  const handleToggleAsset = (assetId: string) => {
    const newSet = new Set(selectedAssets);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
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
    let currentAssets = assets;
    const idsToDelete = Array.from(selectedAssets);
    for (let i = 0; i < idsToDelete.length; i++) {
      currentAssets = await deleteEntityAsset(selectedEntity.id, idsToDelete[i]);
    }
    setAssets(currentAssets);
    setSelectedAssets(new Set());
    setShowBatchDeleteConfirm(false);
    showToast('Asset(s) deleted', 'delete');
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, [field]: value } as Asset);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const handleAddOpeningBalance = () => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, openingBalances: [...(editedAsset.openingBalances || []), { type: 'New', date: '', value: '' }] });
  };

  const handleOpeningBalanceChange = (index: number, field: keyof OpeningBalance, value: string) => {
    if (!editedAsset) return;
    const updated = [...(editedAsset.openingBalances || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditedAsset({ ...editedAsset, openingBalances: updated });
  };

  const handleRemoveOpeningBalance = (index: number) => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, openingBalances: (editedAsset.openingBalances || []).filter((_, i) => i !== index) });
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
    setSelectedAssetId(null);
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
    const updatedAssets = await deleteEntityAsset(selectedEntity.id, selectedAssetId);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
    setShowPanelDeleteConfirm(false);
    showToast('Asset deleted', 'delete');
  };

  const handleConfirmDispose = async () => {
    if (!disposeDate) { setDisposeDateError(true); return; }
    if (!editedAsset || !selectedEntity) return;
    const disposed = { ...editedAsset, disposed: true, disposalDate: disposeDate, proceed: disposeProceed };
    const updatedAssets = await updateEntityAsset(selectedEntity.id, disposed);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
    setShowDisposeModal(false);
    setDisposeDate('');
    setDisposeProceed('');
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

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: '',
        raw: false,
        dateNF: 'yyyy-mm-dd',
      });

      const parsed: Asset[] = rows.map((row) => {
        const n: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase().trim()] = String(v).trim(); });

        const usefulLife = n['useful life'] || '';
        const depRate = usefulLife && Number(usefulLife) > 0
          ? ((1 / Number(usefulLife)) * 100).toFixed(2)
          : '';

        const branch = (n['branch'] || '') as AssetBranch;
        const category = (n['category'] || '') as AssetCategory;
        const assetId = n['asset id'] || n['asset_id'] || '';
        const id = assetId || generateAssetId(branch, category);

        return {
          id,
          assetType: 'Regular' as const,
          description: n['description'] || '',
          category,
          branch,
          vendorName: n['vendor'] || '',
          invoice: n['invoice no'] || n['invoice no.'] || '',
          serialNo: n['serial'] || '',
          tagNo: n['tag/registration'] || n['tag'] || '',
          acquisitionDate: n['acquisition date'] || '',
          cost: (n['cost'] || '').replace(/[^0-9.-]/g, ''),
          usefulLife,
          depreciationRate: depRate,
        };
      }).filter(a => a.description);

      if (parsed.length > 0) {
        setUploadPreviewAssets(parsed);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmUpload = async () => {
    if (!uploadPreviewAssets || !selectedEntity) return;
    let currentAssets = assets;
    for (const asset of uploadPreviewAssets) {
      currentAssets = await addEntityAsset(selectedEntity.id, asset);
    }
    setAssets(currentAssets);
    setUploadPreviewAssets(null);
    showToast(`${uploadPreviewAssets.length} asset${uploadPreviewAssets.length !== 1 ? 's' : ''} imported`, 'success');
  };

  const filteredAssets = assets.filter(asset => {
    if (filter === 'Active' && asset.disposed) return false;
    if (filter === 'Disposed' && !asset.disposed) return false;
    if (search) {
      const term = search.toLowerCase();
      const matches = asset.description.toLowerCase().includes(term) ||
        asset.tagNo.toLowerCase().includes(term) ||
        asset.serialNo.toLowerCase().includes(term) ||
        asset.category.toLowerCase().includes(term) ||
        asset.branch.toLowerCase().includes(term) ||
        asset.vendorName.toLowerCase().includes(term);
      if (!matches) return false;
    }
    return true;
  });

  const emptyRowsNeeded = Math.max(0, EMPTY_ROW_COUNT - filteredAssets.length);

  const renderDetailPanel = () => {
    if (!editedAsset || !selectedAssetId) return null;

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header" style={{ justifyContent: 'space-between' }}>
            {!editedAsset.disposed ? (
              <button
                className="panel-btn"
                style={{ backgroundColor: '#fd7e14', borderColor: '#fd7e14', color: 'white' }}
                onClick={() => setShowDisposeModal(true)}
              >
                Dispose
              </button>
            ) : (
              <button
                className="panel-btn"
                style={{ backgroundColor: '#6c757d', borderColor: '#6c757d', color: 'white' }}
                onClick={handleRevertDisposal}
              >
                Revert Disposal
              </button>
            )}
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Asset ID</label>
              <input type="text" className="readonly-input" value={editedAsset.id} readOnly />
            </div>

            <div className="form-group">
              <label>Description *</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={editedAsset.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              {errors.category && <span className="error-text">Required</span>}
              <select
                className={errors.category ? 'error' : ''}
                value={editedAsset.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Branch *</label>
              {errors.branch && <span className="error-text">Required</span>}
              <select
                className={errors.branch ? 'error' : ''}
                value={editedAsset.branch}
                onChange={(e) => handleInputChange('branch', e.target.value)}
              >
                <option value="">Select Branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Vendor</label>
              <input
                type="text"
                value={editedAsset.vendorName}
                onChange={(e) => handleInputChange('vendorName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Invoice No.</label>
              <input
                type="text"
                value={editedAsset.invoice}
                onChange={(e) => handleInputChange('invoice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Serial</label>
              <input
                type="text"
                value={editedAsset.serialNo}
                onChange={(e) => handleInputChange('serialNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tag/Registration</label>
              <input
                type="text"
                value={editedAsset.tagNo}
                onChange={(e) => handleInputChange('tagNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Acquisition Date</label>
              <input
                type="date"
                value={editedAsset.acquisitionDate}
                onChange={(e) => handleInputChange('acquisitionDate', e.target.value)}
              />
            </div>

            {editedAsset.disposed && (
              <div className="form-group">
                <label>Disposal Date</label>
                <input
                  type="date"
                  value={editedAsset.disposalDate || ''}
                  onChange={(e) => handleInputChange('disposalDate', e.target.value)}
                />
              </div>
            )}

            {editedAsset.disposed && (
              <div className="form-group">
                <label>Proceed</label>
                <input
                  type="number"
                  value={editedAsset.proceed || ''}
                  onChange={(e) => handleInputChange('proceed', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Cost *</label>
              {errors.cost && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.cost ? 'error' : ''}
                value={editedAsset.cost}
                onChange={(e) => handleInputChange('cost', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Useful Life (Years) *</label>
              {errors.usefulLife && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.usefulLife ? 'error' : ''}
                value={editedAsset.usefulLife}
                onChange={(e) => handleInputChange('usefulLife', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Dep. Rate (%)</label>
              {errors.depreciationRate && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.depreciationRate ? 'error' : ''}
                value={editedAsset.depreciationRate}
                onChange={(e) => handleInputChange('depreciationRate', e.target.value)}
              />
            </div>
          </div>

          <div className="opening-balances-section">
            <div className="opening-balances-header">
              <span>Opening Balances</span>
              <button type="button" className="add-opening-balance-btn" onClick={handleAddOpeningBalance}>+ Add</button>
            </div>
            {(editedAsset.openingBalances || []).map((cb, i) => (
              <div key={i} className="opening-balance-row">
                <select
                  className="opening-balance-type"
                  value={cb.type}
                  onChange={(e) => handleOpeningBalanceChange(i, 'type', e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="Existing">Existing</option>
                </select>
                <input
                  type="date"
                  value={cb.date}
                  onChange={(e) => handleOpeningBalanceChange(i, 'date', e.target.value)}
                />
                {cb.type === 'Existing' && (
                  <input
                    type="number"
                    placeholder="Balance"
                    value={cb.value}
                    onChange={(e) => handleOpeningBalanceChange(i, 'value', e.target.value)}
                  />
                )}
                <button type="button" className="remove-opening-balance-btn" onClick={() => handleRemoveOpeningBalance(i)}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="lease-detail-actions">
          <button className="panel-btn" onClick={handleDeleteFromPanel}>Delete</button>
          <div className="lease-detail-actions-right">
            <button className="panel-btn" onClick={handleCancel}>Cancel</button>
            <button className="panel-btn" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-split">
      <div className="dashboard-main" style={selectedAssetId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div className="dashboard-container">
          <div className="table-section">
            <div className="page-header">
              <button className="back-button" onClick={() => onNavigate('home')} title="Back to Home">
                <ArrowBackIcon fontSize="small" />
              </button>
              <h2>Fixed Assets Register ({assets.length})</h2>
              <div className="page-header-actions">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  className="entities-add-button"
                  style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }}
                  onClick={handleUploadClick}
                  disabled={!selectedEntity}
                >
                  Upload Excel
                </button>
                <button
                  className="entities-add-button"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!selectedEntity}
                >
                  New Asset
                </button>
                <button
                  className="entities-add-button"
                  style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
                  onClick={() => setShowReportModal(true)}
                  disabled={!selectedEntity}
                >
                  Report
                </button>
              </div>
            </div>

            <div className="assets-register-body">
              {/* Selection / toolbar bar */}
              <div className="selection-bar">
                <div className="selection-bar-left">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    className="select-all-checkbox"
                    onChange={handleSelectAll}
                  />
                  {selectedAssets.size > 0 && (
                    <button className="action-btn action-copy" title="Copy">
                      <ContentCopyIcon fontSize="small" />
                    </button>
                  )}
                  {selectedAssets.size > 0 && (
                    <button className="action-btn action-delete" title="Delete" onClick={handleDeleteSelected}>
                      <DeleteIcon fontSize="small" />
                    </button>
                  )}
                  {selectedAssets.size > 0 ? (
                    <span className="selection-count">{selectedAssets.size} selected</span>
                  ) : (
                    <span className="selection-hint">Select items</span>
                  )}
                </div>
                <div className="selection-bar-right">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    className="filter-dropdown"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'All' | 'Active' | 'Disposed')}
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="asset-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      {COLUMNS.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset) => (
                      <tr
                        key={asset.id}
                        className={`${selectedAssetId === asset.id ? 'selected-row' : ''}${asset.disposed ? ' disposed-row' : ''}`}
                        onClick={() => handleRowClick(asset.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center', padding: 8 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="lease-checkbox"
                            checked={selectedAssets.has(asset.id)}
                            onChange={() => handleToggleAsset(asset.id)}
                          />
                        </td>
                        <td>{asset.id}</td>
                        <td>{asset.description}</td>
                        <td>{asset.category}</td>
                        <td>{asset.branch}</td>
                        <td>{asset.vendorName}</td>
                        <td>{asset.invoice}</td>
                        <td>{asset.serialNo}</td>
                        <td>{asset.tagNo}</td>
                        <td>{asset.acquisitionDate}</td>
                        <td>{asset.cost ? `$${Number(asset.cost.replace(/[^0-9.-]/g, '')).toLocaleString()}` : ''}</td>
                        <td>{asset.usefulLife}</td>
                        <td>{asset.depreciationRate ? `${Number(asset.depreciationRate).toFixed(2)}%` : ''}</td>
                        <td>
                          {asset.disposed
                            ? <span className="status-badge status-disposed">Disposed</span>
                            : <span className="status-badge status-active">Active</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyRowsNeeded }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td style={{ textAlign: 'center', padding: 8 }}>
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
          </div>
        </div>
      </div>

      {selectedAssetId && renderDetailPanel()}

      {isAddModalOpen && selectedEntity && (
        <AddAssetModal
          onClose={() => setIsAddModalOpen(false)}
          onSaveAsset={handleAddAsset}
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
                onClick={() => {
                  if (!reportMonth || !reportYear) { setReportError(true); return; }
                  generateAssetsReport(assets, selectedEntity?.name ?? '', reportMonth, reportYear);
                }}
              >Generate</button>
            </div>
          </div>
        </div>
      )}

      {uploadPreviewAssets && (
        <AssetUploadModal
          assets={uploadPreviewAssets}
          onConfirm={handleConfirmUpload}
          onCancel={() => setUploadPreviewAssets(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
};

export default FixedAssetsRegistration;
