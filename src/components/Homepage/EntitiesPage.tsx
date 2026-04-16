import React, { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Entity } from '../../types/Entity';
import { View } from '../Layout/Sidebar';
import { saveEntity, updateEntityLeasesCompanyCode } from '../../utils/dataStorage';
import Toast, { useToast } from '../shared/Toast';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import '../Leases/EditLeaseModal.css';
import './EntitiesPage.css';

interface EntitiesPageProps {
  entities: Entity[];
  selectedEntity: Entity | null;
  onDelete: (entityId: string) => void;
  onAdd: () => void;
  onEntityUpdated: (entity: Entity) => void;
  onNavigate: (view: View) => void;
}

const DEFAULT_PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 900;
const EMPTY_ROW_COUNT = 15;

const EntitiesPage: React.FC<EntitiesPageProps> = ({
  entities,
  selectedEntity,
  onDelete,
  onAdd,
  onEntityUpdated,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedEntity, setEditedEntity] = useState<Entity | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checkboxColWidth, setCheckboxColWidth] = useState(40);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('sidePanelWidth');
    if (saved) { const n = parseInt(saved, 10); if (!isNaN(n)) return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, n)); }
    return DEFAULT_PANEL_WIDTH;
  });
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const checkboxColRef = useRef<HTMLTableCellElement>(null);
  const { toast, showToast, clearToast } = useToast();

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
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
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setIsSelectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync select-all indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = entities.length > 0 && selectedIds.size === entities.length;
      const someSelected = selectedIds.size > 0 && selectedIds.size < entities.length;
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedIds, entities.length]);

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
    if (selectedId) {
      const entity = entities.find(e => e.id === selectedId);
      if (entity) {
        setEditedEntity({ ...entity });
        setErrors({});
        setIsEditing(false);
      } else {
        setSelectedId(null);
        setEditedEntity(null);
        setIsEditing(false);
      }
    } else {
      setEditedEntity(null);
      setErrors({});
      setIsEditing(false);
    }
  }, [selectedId, entities]);

  const handleRowClick = (entityId: string) => {
    setSelectedId(selectedId === entityId ? null : entityId);
  };

  const handleInputChange = (field: keyof Entity, value: string) => {
    if (!editedEntity) return;
    setEditedEntity({ ...editedEntity, [field]: value });
    if (errors[field as string]) setErrors({ ...errors, [field as string]: false });
  };

  const validateForm = (): boolean => {
    if (!editedEntity) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;
    if (!editedEntity.name.trim()) { newErrors.name = true; isValid = false; }
    if (!editedEntity.companyCode.trim()) { newErrors.companyCode = true; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!editedEntity || !validateForm()) return;
    const original = entities.find(e => e.id === editedEntity.id);
    const success = await saveEntity(editedEntity);
    if (success) {
      if (original && original.companyCode !== editedEntity.companyCode) {
        await updateEntityLeasesCompanyCode(editedEntity.id, editedEntity.companyCode);
      }
      onEntityUpdated(editedEntity);
      setSelectedId(null);
      showToast('Entity updated', 'edit');
    }
  };

  const handleCancel = () => setSelectedId(null);

  const handleDelete = () => {
    if (selectedId) setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedId) {
      onDelete(selectedId);
      setSelectedId(null);
      setShowDeleteConfirm(false);
      showToast('Entity deleted', 'delete');
    }
  };

  const handleConfirmBatchDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      onDelete(id);
    }
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
    showToast(`${idsToDelete.length} entit${idsToDelete.length > 1 ? 'ies' : 'y'} deleted`, 'delete');
  };

  const filteredEntities = entities.filter(entity => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      entity.name.toLowerCase().includes(term) ||
      entity.companyCode.toLowerCase().includes(term) ||
      (entity.abnAcn || '').toLowerCase().includes(term) ||
      (entity.address || '').toLowerCase().includes(term)
    );
  });

  const emptyRowsNeeded = Math.max(0, EMPTY_ROW_COUNT - filteredEntities.length);

  const handleSelectAll = () => {
    if (filteredEntities.length > 0 && filteredEntities.every(e => selectedIds.has(e.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntities.map(e => e.id)));
    }
  };

  const handleSelectByStatus = (status: 'all') => {
    if (status === 'all') {
      const allSelected = filteredEntities.length > 0 && filteredEntities.every(e => selectedIds.has(e.id));
      setSelectedIds(allSelected ? new Set() : new Set(filteredEntities.map(e => e.id)));
    }
    setIsSelectDropdownOpen(false);
  };

  const handleToggleEntity = (entityId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(entityId)) newSet.delete(entityId);
    else newSet.add(entityId);
    setSelectedIds(newSet);
  };

  const renderDetailPanel = () => {
    if (!editedEntity || !selectedId) return null;

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
              <label>Company Name{isEditing ? ' *' : ''}</label>
              {errors.name && <span className="error-text">Required</span>}
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : errors.name ? 'error' : ''}
                readOnly={!isEditing}
                value={editedEntity.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={isEditing ? 'Enter company name' : ''}
              />
            </div>
            <div className="form-group">
              <label>Company Code{isEditing ? ' *' : ''}</label>
              {errors.companyCode && <span className="error-text">Required</span>}
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : errors.companyCode ? 'error' : ''}
                readOnly={!isEditing}
                value={editedEntity.companyCode}
                onChange={(e) => handleInputChange('companyCode', e.target.value)}
                placeholder={isEditing ? 'Enter company code' : ''}
              />
            </div>
            <div className="form-group">
              <label>ABN / ACN</label>
              <input
                type="text"
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedEntity.abnAcn || ''}
                onChange={(e) => handleInputChange('abnAcn', e.target.value)}
                placeholder={isEditing ? 'Enter ABN/ACN' : ''}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea
                className={!isEditing ? 'readonly-input' : ''}
                readOnly={!isEditing}
                value={editedEntity.address || ''}
                onChange={(e) => {
                  handleInputChange('address', e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onFocus={(e) => {
                  if (!isEditing) return;
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder={isEditing ? 'Enter address' : ''}
                rows={1}
                style={{ resize: 'none', fontFamily: 'inherit', overflow: 'hidden', lineHeight: 'normal' }}
              />
            </div>
          </div>
        </div>
        <div className="lease-detail-actions" style={{ flexDirection: 'column', gap: 8 }}>
          {isEditing && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                className="panel-btn"
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }}
                onClick={handleDelete}
              >
                Delete
              </button>
              <div className="lease-detail-actions-right">
                <button
                  className="panel-btn"
                  style={{ backgroundColor: '#007bff', borderColor: '#007bff', color: 'white' }}
                  onClick={handleSave}
                >
                  Save Changes
                </button>
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
        style={selectedId
          ? { marginRight: `${panelWidth}px`, display: 'flex', flexDirection: 'column', height: '100%' }
          : { display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* Sticky header */}
        <div ref={stickyHeaderRef} style={{ flexShrink: 0, background: '#fff' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#333' }}>Entities ({entities.length})</h2>
          </div>
          {/* Action bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', minHeight: '44px', paddingRight: '8px', gap: '6px' }}>
            {/* Checkbox aligned with table checkbox column */}
            <div style={{ width: checkboxColWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                ref={selectAllRef}
                className="lease-checkbox"
                onChange={handleSelectAll}
              />
            </div>
            {/* Select dropdown arrow */}
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
                </div>
              )}
            </div>
            {/* Selection actions */}
            {selectedIds.size > 0 && (
              <>
                <button className="action-btn action-delete" title="Delete selected" onClick={() => setShowBatchDeleteConfirm(true)}>
                  <DeleteIcon fontSize="small" />
                </button>
                <span className="selection-count">{selectedIds.size} selected</span>
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
                      onClick={() => { onAdd(); setIsActionsMenuOpen(false); }}
                    >
                      <AddIcon fontSize="small" /><span>New Entity</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          className="table-wrapper"
          style={{ height: `calc(100vh - ${headerHeight}px - ${stickyHeaderHeight}px)`, overflowY: 'auto', overflowX: 'auto', background: 'white', borderRadius: 0, boxShadow: 'none' }}
        >
          <table className="lease-table">
            <thead>
              <tr>
                <th ref={checkboxColRef} style={{ width: 40, minWidth: 40, maxWidth: 40, padding: 0 }}></th>
                <th className="entities-name-col">Name</th>
                <th className="entities-code-col">Company Code</th>
                <th>ABN/ACN</th>
                <th>Address</th>
                <th className="entities-status-col"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((entity) => (
                <tr
                  key={entity.id}
                  className={selectedId === entity.id ? 'selected-row' : ''}
                  onClick={() => handleRowClick(entity.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ textAlign: 'center', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="lease-checkbox"
                      checked={selectedIds.has(entity.id)}
                      onChange={() => handleToggleEntity(entity.id)}
                    />
                  </td>
                  <td className="entities-name-col">{entity.name}</td>
                  <td className="entities-code-col">{entity.companyCode}</td>
                  <td>{entity.abnAcn}</td>
                  <td>{entity.address}</td>
                  <td className="entities-status-col">{selectedEntity?.id === entity.id && <span className="active-entity-badge">Active</span>}</td>
                </tr>
              ))}
              {Array.from({ length: emptyRowsNeeded }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ padding: 0 }}><input type="checkbox" className="lease-checkbox" disabled /></td>
                  <td>&nbsp;</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && renderDetailPanel()}

      {showDeleteConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete Entity?</h3>
            <p className="confirm-text">
              Are you sure you want to delete "{editedEntity?.name}"? This will also delete all associated data. This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showBatchDeleteConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowBatchDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete {selectedIds.size} Entit{selectedIds.size > 1 ? 'ies' : 'y'}?</h3>
            <p className="confirm-text">
              Are you sure you want to delete {selectedIds.size} selected entit{selectedIds.size > 1 ? 'ies' : 'y'}? This will also delete all associated data. This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowBatchDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleConfirmBatchDelete}>Delete {selectedIds.size} Entit{selectedIds.size > 1 ? 'ies' : 'y'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
};

export default EntitiesPage;
