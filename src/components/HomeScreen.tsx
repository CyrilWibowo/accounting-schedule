import React from 'react';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PercentIcon from '@mui/icons-material/Percent';
import PaidIcon from '@mui/icons-material/Paid';
import cwTechnicaLogo from '../assets/C&WTechnicaLogo.png';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigateToLeases: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToLeases }) => {
  return (
    <div className="home-screen">
      <header className="home-header">
        <img src={cwTechnicaLogo} alt="C&W Technica Logo" className="home-header-logo" />
      </header>
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
