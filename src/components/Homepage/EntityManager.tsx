import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import { Entity } from '../../types/Entity';
import './EntityManager.css';

interface EntityManagerProps {
  entities: Entity[];
  onClose: () => void;
  onEdit: (entity: Entity) => void;
}

const EntityManager: React.FC<EntityManagerProps> = ({
  entities,
  onClose,
  onEdit
}) => {
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
                  <tr key={entity.id}>
                    <td className="entity-manager-cell-readonly">{entity.id.substring(0, 8)}</td>
                    <td>{entity.name}</td>
                    <td>{entity.companyCode}</td>
                    <td>{entity.abnAcn}</td>
                    <td>{entity.address}</td>
                    <td>
                      <button
                        className="entity-manager-edit-btn"
                        onClick={() => onEdit(entity)}
                        title="Edit entity"
                      >
                        <SettingsIcon />
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
    </div>
  );
};

export default EntityManager;
