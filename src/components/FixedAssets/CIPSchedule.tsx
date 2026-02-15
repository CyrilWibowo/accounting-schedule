import React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { View } from '../Layout/Sidebar';
import './FixedAssetsPlaceholder.css';

interface CIPScheduleProps {
  onNavigate: (view: View) => void;
}

const CIPSchedule: React.FC<CIPScheduleProps> = ({ onNavigate }) => (
  <div className="fixed-assets-placeholder">
    <div className="fixed-assets-header">
      <button className="back-button" onClick={() => onNavigate('home')} title="Back to Home"><ArrowBackIcon fontSize="small" /></button>
      <h2>CIP Schedule</h2>
    </div>
    <p>Coming Soon</p>
  </div>
);

export default CIPSchedule;
