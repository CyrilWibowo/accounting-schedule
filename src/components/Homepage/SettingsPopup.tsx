import React, { useState } from 'react';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import './SettingsPopup.css';

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose }) => {
  const [dataFilePath, setDataFilePath] = useState('');

  const handleBrowse = async () => {
    const selectedPath = await window.electronAPI?.showOpenDialog();
    if (selectedPath) {
      setDataFilePath(selectedPath);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-popup-overlay" onMouseDown={handleOverlayClick}>
      <div className="settings-popup-modal">
        <div className="settings-popup-header">
          <h2>Settings</h2>
          <button className="settings-popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="settings-popup-content">
          <div className="settings-popup-field">
            <label htmlFor="dataFilePath">Data File Path</label>
            <div className="settings-popup-input-group">
              <input
                type="text"
                id="dataFilePath"
                value={dataFilePath}
                onChange={(e) => setDataFilePath(e.target.value)}
                placeholder="Select a folder..."
                readOnly
              />
              <button
                type="button"
                className="settings-popup-browse-button"
                onClick={handleBrowse}
                title="Browse"
              >
                <FolderOpenIcon />
              </button>
            </div>
          </div>
        </div>
        <div className="settings-popup-actions">
          <button type="button" className="settings-popup-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="settings-popup-save" disabled>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPopup;
