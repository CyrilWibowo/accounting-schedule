import React, { useState, useRef, useEffect, useCallback } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { Asset, CIPAsset, CIPInvoice, AssetCategory, AssetBranch } from '../../types/Asset';
import { loadEntityCIPAssets, addEntityCIPAsset, updateEntityCIPAsset, deleteEntityCIPAsset, addEntityAsset } from '../../utils/dataStorage';
import AddCIPModal from './AddCIPModal';
import AddCIPInvoiceModal from './AddCIPInvoiceModal';
import Toast, { useToast } from '../shared/Toast';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
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

interface CIPScheduleProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
}

const COLUMNS = [
  'CIP Code',
  'Asset Name',
  'Category',
  'Branch',
  'Completed',
  'Invoices',
  'Total',
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAddInvoiceModalOpen, setIsAddInvoiceModalOpen] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState<CIPInvoice | null>(null);
  const [invoiceErrors, setInvoiceErrors] = useState<{ [key: string]: boolean }>({});
  const [showInvoiceDeleteConfirm, setShowInvoiceDeleteConfirm] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<CIPAsset | null>(null);
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
    if (editedAsset.completed === 'Y' && !editedAsset.completionDate) { newErrors.completionDate = true; isValid = false; }

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

    const newAsset: Asset = {
      id: generateAssetId(editedAsset.branch as AssetBranch, editedAsset.category as AssetCategory),
      assetType: 'Regular',
      description: editedAsset.description,
      category: editedAsset.category,
      branch: editedAsset.branch,
      cost: totalCost.toString(),
      vendorName: 'N/A',
      invoice: 'N/A',
      usefulLife: editedAsset.usefulLife,
      depreciationRate: depRate,
      tagNo: 'N/A',
      serialNo: 'N/A',
    };

    await addEntityAsset(selectedEntity.id, newAsset);

    const updated = await updateEntityCIPAsset(selectedEntity.id, editedAsset);
    setCIPAssets(updated);
    setSelectedAssetId(null);
    showToast('Asset transferred', 'success');
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

  const filteredAssets = cipAssets.filter(asset => {
    if (search) {
      const term = search.toLowerCase();
      return asset.id.toLowerCase().includes(term) ||
        asset.description.toLowerCase().includes(term) ||
        asset.category.toLowerCase().includes(term) ||
        asset.branch.toLowerCase().includes(term);
    }
    return true;
  });

  const emptyRowsNeeded = Math.max(0, EMPTY_ROW_COUNT - filteredAssets.length);

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
            <button className="panel-btn" onClick={() => setShowInvoiceDeleteConfirm(true)}>Delete</button>
            <div className="lease-detail-actions-right">
              <button className="panel-btn" onClick={handleCancelInvoice}>Cancel</button>
              <button className="panel-btn" onClick={handleSaveInvoice}>Save Changes</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header">
            <button className="entities-add-button" onClick={() => setIsAddInvoiceModalOpen(true)}>Add Invoice</button>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>CIP Code</label>
              <input type="text" className="readonly-input" value={editedAsset.id} readOnly />
            </div>

            <div className="form-group">
              <label>Asset Name *</label>
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
              <label>Completed</label>
              <select
                value={editedAsset.completed}
                onChange={(e) => handleInputChange('completed', e.target.value)}
              >
                <option value="N">No</option>
                <option value="Y">Yes</option>
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
                  <label>Useful Life (Years){errors.usefulLife ? ' *' : ''}</label>
                  {errors.usefulLife && <span className="error-text">Required to transfer</span>}
                  <input
                    type="number"
                    className={errors.usefulLife ? 'error' : ''}
                    value={editedAsset.usefulLife}
                    onChange={(e) => handleInputChange('usefulLife', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <button className="panel-btn transfer-btn" style={{ width: '100%' }} onClick={handleTransfer}>Transfer Completed Asset</button>
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
                  New CIP
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
                      <th style={{ width: 28, padding: 0 }}></th>
                      <th style={{ width: 32, padding: 0 }}></th>
                      {COLUMNS.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
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
                            <td style={{ textAlign: 'center', padding: '4px 0' }} onClick={(e) => e.stopPropagation()}>
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
                            <td>{asset.completed === 'Y' ? 'Yes' : 'No'}</td>
                            <td>{invoices.length}</td>
                            <td>{invoices.length > 0 ? `$${invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0).toLocaleString()}` : ''}</td>
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
                                          <th>ID</th>
                                          <th>Description</th>
                                          <th>Vendor</th>
                                          <th>Invoice No.</th>
                                          <th>Date</th>
                                          <th>Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {invoices.map(inv => (
                                          <tr key={inv.id} className={editedInvoice?.id === inv.id ? 'selected-row' : ''} onClick={(e) => { e.stopPropagation(); setSelectedAssetId(asset.id); setEditedInvoice({ ...inv }); setInvoiceErrors({}); }} style={{ cursor: 'pointer' }}>
                                            <td>{inv.id}</td>
                                            <td>{inv.description}</td>
                                            <td>{inv.vendorName}</td>
                                            <td>{inv.invoiceNo}</td>
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
                        <td style={{ textAlign: 'center', padding: '4px 0' }}>
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
        <AddCIPModal
          onClose={() => setIsAddModalOpen(false)}
          onSaveCIPAsset={handleAddCIPAsset}
        />
      )}

      {isAddInvoiceModalOpen && selectedAssetId && (
        <AddCIPInvoiceModal
          onClose={() => setIsAddInvoiceModalOpen(false)}
          onSave={handleAddInvoice}
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
