import React, { useState, useRef, useEffect, useCallback } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { CIPAsset, AssetCategory, AssetBranch } from '../../types/Asset';
import { loadEntityCIPAssets, addEntityCIPAsset, updateEntityCIPAsset, deleteEntityCIPAsset } from '../../utils/dataStorage';
import AddAssetModal from './AddAssetModal';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
import './FixedAssetsRegister.css';

const CATEGORIES: AssetCategory[] = ['Office Equipment', 'Motor Vehicle', 'Warehouse Equipment', 'Manufacturing Equipment', 'Equipment for Leased', 'Software'];
const BRANCHES: AssetBranch[] = ['CORP', 'PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'PARK'];

interface CIPScheduleProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
}

const COLUMNS = [
  'CIP Code',
  'Description',
  'Category',
  'Branch',
  'Vendor Name',
  'Invoice',
  'Date',
  'Amount',
  'Completed',
];

const EMPTY_ROW_COUNT = 15;
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 700;

const CIPSchedule: React.FC<CIPScheduleProps> = ({ onNavigate, selectedEntity }) => {
  const [search, setSearch] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [cipAssets, setCIPAssets] = useState<CIPAsset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showPanelDeleteConfirm, setShowPanelDeleteConfirm] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<CIPAsset | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [headerHeight, setHeaderHeight] = useState(0);
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
    if (selectedEntity) {
      loadEntityCIPAssets(selectedEntity.id).then(setCIPAssets);
    } else {
      setCIPAssets([]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = cipAssets.find(a => a.id === selectedAssetId);
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
  }, [selectedAssetId, cipAssets]);

  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = cipAssets.length > 0 && selectedAssets.size === cipAssets.length;
      const someSelected = selectedAssets.size > 0 && selectedAssets.size < cipAssets.length;
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedAssets, cipAssets.length]);

  const handleSelectAll = useCallback(() => {
    if (selectedAssets.size === cipAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(cipAssets.map(a => a.id)));
    }
  }, [cipAssets, selectedAssets.size]);

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

  const handleAddCIPAsset = async (cipAsset: CIPAsset) => {
    if (!selectedEntity) return;
    const updated = await addEntityCIPAsset(selectedEntity.id, cipAsset);
    setCIPAssets(updated);
    setIsAddModalOpen(false);
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
    if (!editedAsset.amount.trim()) { newErrors.amount = true; isValid = false; }
    if (!editedAsset.date) { newErrors.date = true; isValid = false; }
    if (editedAsset.completed === 'Y' && !editedAsset.completionDate) { newErrors.completionDate = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!editedAsset || !selectedEntity || !validateForm()) return;
    const updated = await updateEntityCIPAsset(selectedEntity.id, editedAsset);
    setCIPAssets(updated);
    setSelectedAssetId(null);
  };

  const handleCancel = () => {
    setSelectedAssetId(null);
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
  };

  const filteredAssets = cipAssets.filter(asset => {
    if (search) {
      const term = search.toLowerCase();
      return asset.description.toLowerCase().includes(term) ||
        asset.category.toLowerCase().includes(term) ||
        asset.branch.toLowerCase().includes(term) ||
        asset.vendorName.toLowerCase().includes(term) ||
        asset.invoice.toLowerCase().includes(term);
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
          <div className="lease-detail-header">
            <h3>Edit CIP Asset</h3>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>CIP Code</label>
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
              <label>Vendor Name</label>
              <input
                type="text"
                value={editedAsset.vendorName}
                onChange={(e) => handleInputChange('vendorName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Invoice</label>
              <input
                type="text"
                value={editedAsset.invoice}
                onChange={(e) => handleInputChange('invoice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Date *</label>
              {errors.date && <span className="error-text">Required</span>}
              <input
                type="date"
                className={errors.date ? 'error' : ''}
                value={editedAsset.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
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
              <label>Amount *</label>
              {errors.amount && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.amount ? 'error' : ''}
                value={editedAsset.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Completed</label>
              <select
                value={editedAsset.completed}
                onChange={(e) => handleInputChange('completed', e.target.value)}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
            </div>

            {editedAsset.completed === 'Y' && (
              <>
                <div className="form-group">
                  <label>Completion Date *</label>
                  {errors.completionDate && <span className="error-text">Required</span>}
                  <input
                    type="date"
                    className={errors.completionDate ? 'error' : ''}
                    value={editedAsset.completionDate}
                    onChange={(e) => handleInputChange('completionDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <button className="panel-btn transfer-btn" style={{ width: '100%' }} onClick={handleSave}>Transfer Completed Asset</button>
                </div>
              </>
            )}
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
              <h2>CIP Schedule ({cipAssets.length})</h2>
              <div className="page-header-actions">
                <button
                  className="entities-add-button"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!selectedEntity}
                >
                  New CIP Asset
                </button>
              </div>
            </div>

            <div className="assets-register-body">
              <div className="selection-bar">
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  className="select-all-checkbox"
                  onChange={handleSelectAll}
                />
                {selectedAssets.size > 0 ? (
                  <>
                    <span className="selection-count">{selectedAssets.size} selected</span>
                    <div className="selection-actions">
                      <button className="action-btn action-delete" title="Delete" onClick={handleBatchDelete}>
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

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
                        className={selectedAssetId === asset.id ? 'selected-row' : ''}
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
                        <td>{asset.date ? new Date(asset.date).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</td>
                        <td>{asset.amount ? `$${Number(asset.amount).toLocaleString()}` : ''}</td>
                        <td>{asset.completed}</td>
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
          onSaveAsset={() => {}}
          onSaveCIPAsset={handleAddCIPAsset}
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
    </div>
  );
};

export default CIPSchedule;
