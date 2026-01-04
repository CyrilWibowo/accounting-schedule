import React, { useState, useEffect, useRef } from 'react';
import { Lease, PropertyLease, MobileEquipmentLease } from '../../types/Lease';
import { Entity } from '../../types/Entity';
import Dashboard from './Dashboard';
import AddLeaseModal from './AddLeaseModal';
import ReportModal from './ReportModal';
import {
  loadEntities,
  loadEntityLeases,
  addEntityLease,
  updateEntityLease,
  deleteEntityLease,
  loadAppState,
  saveAppState,
} from '../../utils/dataStorage';
import cwTechnicaLogo from '../../assets/C&WTechnicaLogo.png';
import rimexLogo from '../../assets/rimexLogo.png'
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import './LeaseDashboard.css';

interface LeaseDashboardProps {
  onBack: () => void;
}

const LeaseDashboard: React.FC<LeaseDashboardProps> = ({ onBack }) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const loadedEntities = await loadEntities();
      setEntities(loadedEntities);

      const appState = await loadAppState();
      if (appState.selectedEntityId) {
        const entity = loadedEntities.find(e => e.id === appState.selectedEntityId);
        if (entity) {
          setSelectedEntity(entity);
          const entityLeases = await loadEntityLeases(entity.id);
          setLeases(entityLeases);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEntityDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectEntity = async (entity: Entity) => {
    setSelectedEntity(entity);
    setIsEntityDropdownOpen(false);
    await saveAppState({ selectedEntityId: entity.id });
    const entityLeases = await loadEntityLeases(entity.id);
    setLeases(entityLeases);
  };

  const handleAddLease = async (newLease: Lease) => {
    if (!selectedEntity) return;
    const updatedLeases = await addEntityLease(selectedEntity.id, newLease);
    setLeases(updatedLeases);
    setIsModalOpen(false);
  };

  const handleUpdateLease = async (updatedLease: Lease) => {
    if (!selectedEntity) return;
    const updatedLeases = await updateEntityLease(selectedEntity.id, updatedLease);
    setLeases(updatedLeases);
  };

  const handleDeleteLease = async (leaseId: string) => {
    if (!selectedEntity) return;
    const updatedLeases = await deleteEntityLease(selectedEntity.id, leaseId);
    setLeases(updatedLeases);
  };

  const handleCopyLease = async (copiedLease: Lease) => {
    if (!selectedEntity) return;
    const updatedLeases = await addEntityLease(selectedEntity.id, copiedLease);
    setLeases(updatedLeases);
  };

  const propertyLeases = leases.filter((lease): lease is PropertyLease => lease.type === 'Property');
  const mobileEquipmentLeases = leases.filter((lease): lease is MobileEquipmentLease => lease.type === 'Mobile Equipment');

  const isEntitySelected = selectedEntity !== null;

  return (
    <div className="lease-dashboard">
      <header className="lease-dashboard-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="header-logos">
            <img src={cwTechnicaLogo} alt="C&W Technica Logo" className="header-logo" />
            <img src={rimexLogo} alt="C&W Technica Logo" className="header-logo" />
          </div>
        </div>

        <div className="entity-selector" ref={dropdownRef}>
          <button
            className={`entity-selector-button ${!isEntitySelected ? 'no-entity' : ''}`}
            onClick={() => setIsEntityDropdownOpen(!isEntityDropdownOpen)}
          >
            {selectedEntity ? selectedEntity.name : 'No Entity Selected'}
            <ArrowDropDownIcon className="entity-dropdown-icon" />
          </button>
          {isEntityDropdownOpen && (
            <div className="entity-dropdown">
              {entities.length === 0 ? (
                <div className="entity-dropdown-empty">No entities available</div>
              ) : (
                entities.map(entity => (
                  <button
                    key={entity.id}
                    className={`entity-dropdown-item ${selectedEntity?.id === entity.id ? 'selected' : ''}`}
                    onClick={() => handleSelectEntity(entity)}
                  >
                    {entity.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="header-buttons">
          <button
            className="add-card-button"
            onClick={() => setIsModalOpen(true)}
            disabled={!isEntitySelected}
          >
            <NoteAddIcon fontSize="small" /> New Card
          </button>
          <button
            className="report-button"
            onClick={() => setIsReportModalOpen(true)}
            disabled={!isEntitySelected}
          >
            <AssessmentIcon fontSize="small" /> AASB16 Report
          </button>
        </div>
      </header>

      <Dashboard
        propertyLeases={propertyLeases}
        mobileEquipmentLeases={mobileEquipmentLeases}
        onUpdateLease={handleUpdateLease}
        onDeleteLease={handleDeleteLease}
        onCopyLease={handleCopyLease}
      />

      {isModalOpen && selectedEntity && (
        <AddLeaseModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddLease}
          entityCompanyCode={selectedEntity.companyCode}
        />
      )}

      {isReportModalOpen && (
        <ReportModal
          onClose={() => setIsReportModalOpen(false)}
          propertyLeases={propertyLeases}
          mobileEquipmentLeases={mobileEquipmentLeases}
          onUpdateLeases={async (updatedLeases) => {
            for (const lease of updatedLeases) {
              await handleUpdateLease(lease);
            }
          }}
        />
      )}
    </div>
  );
};

export default LeaseDashboard;
