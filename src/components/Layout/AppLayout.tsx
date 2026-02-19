import React, { useState, useEffect, useRef } from 'react';
import Sidebar, { View } from './Sidebar';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Entity } from '../../types/Entity';
import { Lease, PropertyLease, MobileEquipmentLease } from '../../types/Lease';
import {
  loadEntities,
  loadEntityLeases,
  addEntityLease,
  updateEntityLease,
  deleteEntityLease,
  loadAppState,
  saveAppState,
  deleteEntity,
} from '../../utils/dataStorage';
import NewEntityForm from '../Homepage/NewEntityForm';
import SettingsPage from '../Settings/SettingsPage';
import AddLeaseModal from '../Leases/AddLeaseModal';
import ReportModal from '../Leases/ReportModal';
import HomeScreen from '../Homepage/HomeScreen';
import EntitiesPage from '../Homepage/EntitiesPage';
import PropertyLeasesPage from '../Leases/PropertyLeasesPage';
import MobileEquipmentLeasesPage from '../Leases/MobileEquipmentLeasesPage';
import FixedAssetsRegistration from '../FixedAssets/FixedAssetsRegistration';
import CIPSchedule from '../FixedAssets/CIPSchedule';
import Toast, { useToast } from '../shared/Toast';
import './AppLayout.css';

interface AppLayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onNavigate }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false);
  const [isNewEntityFormOpen, setIsNewEntityFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [isAddLeaseModalOpen, setIsAddLeaseModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, clearToast } = useToast();

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

  const handleEntityCreated = async (entity: Entity) => {
    const loadedEntities = await loadEntities();
    setEntities(loadedEntities);
    if (selectedEntity && selectedEntity.id === entity.id) {
      setSelectedEntity(entity);
    }
    setEditingEntity(null);
    showToast('Entity created', 'success');
  };

  const handleEditEntity = (entity: Entity) => {
    setEditingEntity(entity);
    setIsNewEntityFormOpen(true);
  };

  const handleDeleteEntity = async (entityId: string) => {
    const success = await deleteEntity(entityId);
    if (success) {
      const loadedEntities = await loadEntities();
      setEntities(loadedEntities);
      if (selectedEntity && selectedEntity.id === entityId) {
        if (loadedEntities.length > 0) {
          const newSelectedEntity = loadedEntities[0];
          setSelectedEntity(newSelectedEntity);
          await saveAppState({ selectedEntityId: newSelectedEntity.id });
          const entityLeases = await loadEntityLeases(newSelectedEntity.id);
          setLeases(entityLeases);
        } else {
          setSelectedEntity(null);
          setLeases([]);
          await saveAppState({ selectedEntityId: null });
        }
      }
    }
  };

  const handleCloseEntityForm = () => {
    setIsNewEntityFormOpen(false);
    setEditingEntity(null);
  };

  const handleDataPathChanged = async () => {
    setSelectedEntity(null);
    setLeases([]);
    await saveAppState({ selectedEntityId: null, dataFilePath: null });
    const loadedEntities = await loadEntities();
    setEntities(loadedEntities);
  };

  // Lease operations
  const handleAddLease = async (newLease: Lease) => {
    if (!selectedEntity) return;
    const updatedLeases = await addEntityLease(selectedEntity.id, newLease);
    setLeases(updatedLeases);
    setIsAddLeaseModalOpen(false);
    showToast('Lease created', 'success');
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

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomeScreen
            onNavigate={onNavigate}
            selectedEntity={selectedEntity}
          />
        );
      case 'entities':
        return (
          <EntitiesPage
            entities={entities}
            selectedEntity={selectedEntity}
            onDelete={handleDeleteEntity}
            onAdd={() => {
              setEditingEntity(null);
              setIsNewEntityFormOpen(true);
            }}
            onEntityUpdated={handleEntityCreated}
            onNavigate={onNavigate}
          />
        );
      case 'property-leases':
        return (
          <PropertyLeasesPage
            propertyLeases={propertyLeases}
            onUpdateLease={handleUpdateLease}
            onDeleteLease={handleDeleteLease}
            onCopyLease={handleCopyLease}
            entityName={selectedEntity?.name || ''}
            onAddLease={() => setIsAddLeaseModalOpen(true)}
            onOpenReport={() => setIsReportModalOpen(true)}
            isEntitySelected={isEntitySelected}
            onNavigate={onNavigate}
          />
        );
      case 'mobile-equipment-leases':
        return (
          <MobileEquipmentLeasesPage
            mobileEquipmentLeases={mobileEquipmentLeases}
            onUpdateLease={handleUpdateLease}
            onDeleteLease={handleDeleteLease}
            onCopyLease={handleCopyLease}
            entityName={selectedEntity?.name || ''}
            onAddLease={() => setIsAddLeaseModalOpen(true)}
            onOpenReport={() => setIsReportModalOpen(true)}
            isEntitySelected={isEntitySelected}
            onNavigate={onNavigate}
          />
        );
      case 'fixed-assets-registration':
        return <FixedAssetsRegistration onNavigate={onNavigate} selectedEntity={selectedEntity} />;
      case 'cip-schedule':
        return <CIPSchedule onNavigate={onNavigate} selectedEntity={selectedEntity} />;
      case 'settings':
        return <SettingsPage onDataPathChanged={handleDataPathChanged} />;
      default:
        return (
          <HomeScreen
            onNavigate={onNavigate}
            selectedEntity={selectedEntity}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />
      <div className="app-main">
        <header className="app-header">
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

        </header>

        <div className="app-content">
          {renderContent()}
        </div>
      </div>

      {/* Modals */}
      <NewEntityForm
        isOpen={isNewEntityFormOpen}
        onClose={handleCloseEntityForm}
        onEntityCreated={handleEntityCreated}
        editEntity={editingEntity}
      />
      {isAddLeaseModalOpen && selectedEntity && (
        <AddLeaseModal
          onClose={() => setIsAddLeaseModalOpen(false)}
          onSave={handleAddLease}
          entityCompanyCode={selectedEntity.companyCode}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
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
          entityName={selectedEntity?.name || ''}
        />
      )}
    </div>
  );
};

export default AppLayout;
