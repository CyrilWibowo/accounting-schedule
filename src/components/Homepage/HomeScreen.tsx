import React from 'react';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PercentIcon from '@mui/icons-material/Percent';
import PaidIcon from '@mui/icons-material/Paid';
import { View } from '../Layout/Sidebar';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (view: View) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="home-content">
      <h1>Accounting Schedule</h1>
      <div className="tool-buttons-grid">
        <button className="tool-button" onClick={() => onNavigate('property-leases')}>
          Leases
          <HomeWorkIcon className="tool-button-icon" />
        </button>
        <button className="tool-button" onClick={() => onNavigate('fixed-assets-registration')}>
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
          Royalty & Corporate Fee
          <PercentIcon className="tool-button-icon" />
        </button>
        <button className="tool-button disabled" disabled>
          Dividend
          <PaidIcon className="tool-button-icon" />
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
