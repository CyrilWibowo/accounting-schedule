import React, { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { Entity } from '../../types/Entity';
import { saveEntity, updateEntityLeasesCompanyCode } from '../../utils/dataStorage';
import '../Leases/Dashboard.css';
import '../Leases/EditLeaseModal.css';
import './EntitiesPage.css';

interface EntitiesPageProps {
  entities: Entity[];
  onDelete: (entityId: string) => void;
  onAdd: () => void;
  onEntityUpdated: (entity: Entity) => void;
}

const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 700;

const EntitiesPage: React.FC<EntitiesPageProps> = ({
  entities,
  onDelete,
  onAdd,
  onEntityUpdated,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedEntity, setEditedEntity] = useState<Entity | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const emptyRows = 10;

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
    if (selectedId) {
      const entity = entities.find(e => e.id === selectedId);
      if (entity) {
        setEditedEntity({ ...entity });
        setErrors({});
      } else {
        setSelectedId(null);
        setEditedEntity(null);
      }
    } else {
      setEditedEntity(null);
      setErrors({});
    }
  }, [selectedId, entities]);

  const handleRowClick = (entityId: string) => {
    setSelectedId(selectedId === entityId ? null : entityId);
  };

  const handleInputChange = (field: keyof Entity, value: string) => {
    if (!editedEntity) return;
    setEditedEntity({ ...editedEntity, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: false });
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
    }
  };

  const renderDetailPanel = () => {
    if (!editedEntity || !selectedId) return null;

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header">
            <span style={{ fontWeight: 600, fontSize: '16px' }}>Edit Entity</span>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              {errors.name && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.name ? 'form-input-error' : 'form-input'}
                value={editedEntity.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company Code *</label>
              {errors.companyCode && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.companyCode ? 'form-input-error' : 'form-input'}
                value={editedEntity.companyCode}
                onChange={(e) => handleInputChange('companyCode', e.target.value)}
                placeholder="Enter company code"
              />
            </div>
            <div className="form-group">
              <label className="form-label">ABN / ACN</label>
              <input
                type="text"
                className="form-input"
                value={editedEntity.abnAcn}
                onChange={(e) => handleInputChange('abnAcn', e.target.value)}
                placeholder="Enter ABN/ACN"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-input"
                value={editedEntity.address}
                onChange={(e) => {
                  handleInputChange('address', e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onFocus={(e) => {
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder="Enter address"
                rows={1}
                style={{ resize: 'none', fontFamily: 'inherit', overflow: 'hidden', lineHeight: 'normal' }}
              />
            </div>
          </div>
        </div>
        <div className="lease-detail-actions">
          <button className="panel-btn" onClick={handleDelete}>Delete</button>
          <div className="lease-detail-actions-right">
            <button className="panel-btn" onClick={handleCancel}>Cancel</button>
            <button className="panel-btn" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`dashboard-split${selectedId ? ' panel-open' : ''}`}>
      <div className="dashboard-main" style={selectedId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div className="dashboard-container">
          <div className="table-section">
            <div className="entities-page-header">
              <h2>Entities ({entities.length})</h2>
              <button className="entities-add-button" onClick={onAdd}>
                New Entity
              </button>
            </div>
            <div className="entities-table-wrapper">
              <table className="lease-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company Code</th>
                    <th>ABN/ACN</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(emptyRows, entities.length) }, (_, i) => {
                    const entity = entities[i];
                    return (
                      <tr
                        key={entity?.id || `empty-${i}`}
                        className={entity && selectedId === entity.id ? 'selected-row' : ''}
                        onClick={() => entity && handleRowClick(entity.id)}
                        style={entity ? { cursor: 'pointer' } : undefined}
                      >
                        <td>{entity ? entity.name : ''}</td>
                        <td>{entity ? entity.companyCode : ''}</td>
                        <td>{entity ? entity.abnAcn : ''}</td>
                        <td>{entity ? entity.address : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="confirm-overlay" onMouseDown={() => setShowDeleteConfirm(false)}>
              <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
                <h3 className="confirm-title">Delete Entity?</h3>
                <p className="confirm-text">
                  Are you sure you want to delete "{editedEntity?.name}"? This will also delete all data associated with this entity. This action cannot be undone.
                </p>
                <div className="confirm-actions">
                  <button className="confirm-cancel-button" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  <button className="confirm-delete-button" onClick={confirmDelete}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedId && renderDetailPanel()}
    </div>
  );
};

export default EntitiesPage;
