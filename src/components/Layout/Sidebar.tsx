import React, { useState } from 'react';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import rimexLogo from '../../assets/rimexLogo.png';
import './Sidebar.css';

export type View =
  | 'home'
  | 'entities'
  | 'property-leases'
  | 'mobile-equipment-leases'
  | 'fixed-assets-registration'
  | 'cip-schedule'
  | 'settings';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [leasesExpanded, setLeasesExpanded] = useState(true);
  const [fixedAssetsExpanded, setFixedAssetsExpanded] = useState(true);

  const isLeaseView = currentView === 'property-leases' || currentView === 'mobile-equipment-leases';
  const isFixedAssetView = currentView === 'fixed-assets-registration' || currentView === 'cip-schedule';

  return (
    <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-top-bar">
        {!collapsed && (
          <div className="sidebar-logos">
            <img src={rimexLogo} alt="Rimex Logo" className="sidebar-logo" />
          </div>
        )}
        <div className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Home */}
        <div
          className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => onNavigate('home')}
          title="Home"
        >
          <HomeIcon className="sidebar-icon" />
          {!collapsed && <span className="sidebar-label">Home</span>}
        </div>

        {/* Entities */}
        <div
          className={`sidebar-item ${currentView === 'entities' ? 'active' : ''}`}
          onClick={() => onNavigate('entities')}
          title="Entities"
        >
          <BusinessIcon className="sidebar-icon" />
          {!collapsed && <span className="sidebar-label">Entities</span>}
        </div>

        {/* Leases Section */}
        <div
          className={`sidebar-section-header ${isLeaseView ? 'section-active' : ''}`}
          onClick={() => !collapsed ? setLeasesExpanded(!leasesExpanded) : setLeasesExpanded(true)}
          title="Leases"
        >
          {!collapsed && (
            <>
              <span className="sidebar-label">Leases</span>
              <span className="sidebar-expand-icon">
                {leasesExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </span>
            </>
          )}
        </div>
        {(leasesExpanded || collapsed) && (
          <div className="sidebar-sub-items">
            <div
              className={`sidebar-sub-item ${currentView === 'property-leases' ? 'active' : ''}`}
              onClick={() => onNavigate('property-leases')}
              title="Property Leases"
            >
              <HomeWorkIcon className="sidebar-sub-icon" />
              {!collapsed && <span className="sidebar-label">Property Leases</span>}
            </div>
            <div
              className={`sidebar-sub-item ${currentView === 'mobile-equipment-leases' ? 'active' : ''}`}
              onClick={() => onNavigate('mobile-equipment-leases')}
              title="Mobile Equipment"
            >
              <DirectionsCarIcon className="sidebar-sub-icon" />
              {!collapsed && <span className="sidebar-label">Mobile Equipment</span>}
            </div>
          </div>
        )}

        {/* Fixed Assets Section */}
        <div
          className={`sidebar-section-header ${isFixedAssetView ? 'section-active' : ''}`}
          onClick={() => !collapsed ? setFixedAssetsExpanded(!fixedAssetsExpanded) : setFixedAssetsExpanded(true)}
          title="Fixed Assets"
        >
          {!collapsed && (
            <>
              <span className="sidebar-label">Fixed Assets</span>
              <span className="sidebar-expand-icon">
                {fixedAssetsExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </span>
            </>
          )}
        </div>
        {(fixedAssetsExpanded || collapsed) && (
          <div className="sidebar-sub-items">
            <div
              className={`sidebar-sub-item ${currentView === 'fixed-assets-registration' ? 'active' : ''}`}
              onClick={() => onNavigate('fixed-assets-registration')}
              title="Assets Register"
            >
              <AppRegistrationIcon className="sidebar-sub-icon" />
              {!collapsed && <span className="sidebar-label">Assets Register</span>}
            </div>
            <div
              className={`sidebar-sub-item ${currentView === 'cip-schedule' ? 'active' : ''}`}
              onClick={() => onNavigate('cip-schedule')}
              title="CIP Schedule"
            >
              <ListAltIcon className="sidebar-sub-icon" />
              {!collapsed && <span className="sidebar-label">CIP Schedule</span>}
            </div>
          </div>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div
          className={`sidebar-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Settings"
        >
          <SettingsIcon className="sidebar-icon" />
          {!collapsed && <span className="sidebar-label">Settings</span>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
