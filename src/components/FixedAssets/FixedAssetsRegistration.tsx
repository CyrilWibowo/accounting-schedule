import React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { View } from '../Layout/Sidebar';
import './FixedAssetsPlaceholder.css';

interface FixedAssetsRegistrationProps {
  onNavigate: (view: View) => void;
}

const FixedAssetsRegistration: React.FC<FixedAssetsRegistrationProps> = ({ onNavigate }) => (
  <div className="fixed-assets-placeholder">
    <div className="fixed-assets-header">
      <button className="back-button" onClick={() => onNavigate('home')} title="Back to Home"><ArrowBackIcon fontSize="small" /></button>
      <h2>Fixed Assets Registration</h2>
    </div>
    <p>Coming Soon</p>
  </div>
);

export default FixedAssetsRegistration;
