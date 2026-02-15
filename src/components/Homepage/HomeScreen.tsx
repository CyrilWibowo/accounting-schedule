import React from 'react';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BalanceIcon from '@mui/icons-material/Balance';
import PaidIcon from '@mui/icons-material/Paid';
import DescriptionIcon from '@mui/icons-material/Description';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
}

interface NavItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  view?: View;
  color: string;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUP_COLORS = {
  leases: '#059669',
  fixedAssets: '#d97706',
  other: '#6b7280',
};

const navGroups: NavGroup[] = [
  {
    label: 'Leases',
    items: [
      {
        icon: <HomeWorkIcon />,
        title: 'Property Leases',
        description: 'Manage property lease schedules',
        view: 'property-leases',
        color: GROUP_COLORS.leases,
      },
      {
        icon: <DirectionsCarIcon />,
        title: 'Mobile Equipment Leases',
        description: 'Manage mobile equipment lease schedules',
        view: 'mobile-equipment-leases',
        color: GROUP_COLORS.leases,
      },
    ],
  },
  {
    label: 'Fixed Assets',
    items: [
      {
        icon: <AccountBalanceIcon />,
        title: 'Fixed Assets Registration',
        description: 'Fixed assets registration and tracking',
        view: 'fixed-assets-registration',
        color: GROUP_COLORS.fixedAssets,
      },
      {
        icon: <DescriptionIcon />,
        title: 'CIP Schedule',
        description: 'Capital improvement projects schedule',
        view: 'cip-schedule',
        color: GROUP_COLORS.fixedAssets,
      },
    ],
  },
  {
    label: 'Other',
    items: [
      {
        icon: <PaymentsIcon />,
        title: 'Prepayments',
        description: 'Manage prepayment schedules',
        color: GROUP_COLORS.other,
        disabled: true,
      },
      {
        icon: <ReceiptLongIcon />,
        title: 'Bonds Register',
        description: 'Track bonds and securities',
        color: GROUP_COLORS.other,
        disabled: true,
      },
      {
        icon: <BalanceIcon />,
        title: 'Royalty & Corporate Fee',
        description: 'Royalty and corporate fee tracking',
        color: GROUP_COLORS.other,
        disabled: true,
      },
      {
        icon: <PaidIcon />,
        title: 'Dividend',
        description: 'Dividend management and tracking',
        color: GROUP_COLORS.other,
        disabled: true,
      },
    ],
  },
];

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, selectedEntity }) => {
  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h1>Welcome Back</h1>
        <p className="welcome-entity">
          {selectedEntity ? selectedEntity.name : 'No entity selected'}
        </p>
      </div>

      {navGroups.map((group) => (
        <div key={group.label} className="nav-group">
          <h2 className="nav-group-label">{group.label}</h2>
          <div className="nav-cards">
            {group.items.map((item) => (
              <button
                key={item.title}
                className={`nav-card${item.disabled ? ' disabled' : ''}`}
                style={{ borderLeftColor: item.color }}
                onClick={() => !item.disabled && item.view && onNavigate(item.view)}
                disabled={item.disabled}
              >
                <div className="nav-card-icon" style={{ color: item.color }}>
                  {item.icon}
                </div>
                <div className="nav-card-text">
                  <span className="nav-card-title">{item.title}</span>
                  <span className="nav-card-description">{item.description}</span>
                </div>
                {item.disabled && <span className="coming-soon-badge">Coming Soon</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HomeScreen;
