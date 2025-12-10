import React, { useState, useEffect, useRef } from 'react';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PercentIcon from '@mui/icons-material/Percent';
import PaidIcon from '@mui/icons-material/Paid';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import cwTechnicaLogo from '../../assets/C&WTechnicaLogo.png';
import rimexLogo from '../../assets/rimexLogo.png'
import NewEntityForm from './NewEntityForm';
import { Entity } from '../../types/Entity';
import { loadEntities, loadAppState, saveAppState } from '../../utils/dataStorage';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigateToLeases: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToLeases }) => {
  const [isNewEntityFormOpen, setIsNewEntityFormOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
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
  };

  const handleEntityCreated = async () => {
    const loadedEntities = await loadEntities();
    setEntities(loadedEntities);
  };

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="header-logos">
          <img src={cwTechnicaLogo} alt="C&W Technica Logo" className="header-logo" />
          <img src={rimexLogo} alt="Rimex Logo" className="header-logo" />
        </div>

        <div className="entity-selector" ref={dropdownRef}>
          <button
            className={`entity-selector-button ${!selectedEntity ? 'no-entity' : ''}`}
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

        <button
          className="new-entity-button"
          onClick={() => setIsNewEntityFormOpen(true)}
        >
          <AddBusinessIcon className="new-entity-button-icon" />
          New Entity
        </button>
      </header>
      <NewEntityForm
        isOpen={isNewEntityFormOpen}
        onClose={() => setIsNewEntityFormOpen(false)}
        onEntityCreated={handleEntityCreated}
      />
      <div className="home-content">
        <h1>Accounting Schedule</h1>
        <div className="tool-buttons-grid">
          <button className="tool-button" onClick={onNavigateToLeases}>
            Leases
            <HomeWorkIcon className="tool-button-icon" />
          </button>
          <button className="tool-button disabled" disabled>
            Fixed Assets
            <AccountBalanceIcon className="tool-button-icon" />
          </button>
          <button className="tool-button disabled" disabled>
            Prepayments
            <PaymentsIcon className="tool-button-icon" />
          </button>
          <button className="tool-button disabled" disabled>
            Bonds Register
            <ReceiptLongIcon className="tool-button-icon" />
          </button>
          <button className="tool-button disabled" disabled>
            Royalty & Corp. Fee
            <PercentIcon className="tool-button-icon" />
          </button>
          <button className="tool-button disabled" disabled>
            Dividend
            <PaidIcon className="tool-button-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
