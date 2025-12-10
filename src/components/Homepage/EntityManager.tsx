import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { Entity } from '../../types/Entity';
import './EntityManager.css';

interface EntityManagerProps {
  entities: Entity[];
  currentEntityId: string | null;
  onClose: () => void;
  onEdit: (entity: Entity) => void;
  onDelete: (entityId: string) => void;
}

const EntityManager: React.FC<EntityManagerProps> = ({
  entities,
  currentEntityId,
  onClose,
  onEdit,
  onDelete
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const handleDeleteClick = (entity: Entity) => {
    setEntityToDelete(entity);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (entityToDelete) {
      onDelete(entityToDelete.id);
      setShowDeleteConfirm(false);
      setEntityToDelete(null);
    }
  };

  return (
    <div className="entity-manager-overlay" onMouseDown={onClose}>
      <div className="entity-manager-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="entity-manager-header">
          <h2 className="entity-manager-title">Manage Entities</h2>
          <button className="entity-manager-close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="entity-manager-table-container">
          <table className="entity-manager-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Company Code</th>
                <th>ABN/ACN</th>
                <th>Address</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="entity-manager-empty">
                    No entities found
                  </td>
                </tr>
              ) : (
                entities.map((entity) => (
                  <tr key={entity.id} className={entity.id === currentEntityId ? 'entity-manager-row-current' : ''}>
                    <td className="entity-manager-cell-readonly">{entity.id.substring(0, 8)}</td>
                    <td>{entity.name}</td>
                    <td>{entity.companyCode}</td>
                    <td>{entity.abnAcn}</td>
                    <td>{entity.address}</td>
                    <td className="entity-manager-actions-cell">
                      <button
                        className="entity-manager-edit-btn"
                        onClick={() => onEdit(entity)}
                        title="Edit entity"
                      >
                        <SettingsIcon />
                      </button>
                      <button
                        className="entity-manager-delete-btn"
                        onClick={() => handleDeleteClick(entity)}
                        title="Delete entity"
                      >
                        <DeleteIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="entity-manager-actions">
          <button className="entity-manager-close-action-button" onClick={onClose}>Close</button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="entity-manager-confirm-overlay" onMouseDown={() => setShowDeleteConfirm(false)}>
          <div className="entity-manager-confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="entity-manager-confirm-title">Delete Entity?</h3>
            <p className="entity-manager-confirm-text">
              Are you sure you want to delete "{entityToDelete?.name}"? This will also delete all data associated with this entity. This action cannot be undone.
            </p>
            <div className="entity-manager-confirm-actions">
              <button className="entity-manager-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="entity-manager-confirm-delete" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityManager;
