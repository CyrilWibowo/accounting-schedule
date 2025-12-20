import React, { useState, useEffect } from 'react';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { getDataPath, setDataPath } from '../../utils/dataStorage';
import './SettingsPopup.css';

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onDataPathChanged: () => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose, onDataPathChanged }) => {
  const [dataFilePath, setDataFilePath] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadCurrentPath = async () => {
        const currentPath = await getDataPath();
        setDataFilePath(currentPath);
        setOriginalPath(currentPath);
      };
      loadCurrentPath();
    }
  }, [isOpen]);

  const handleBrowse = async () => {
    const selectedPath = await window.electronAPI?.showOpenDialog();
    if (selectedPath) {
      setDataFilePath(selectedPath);
    }
  };

  const handleSave = async () => {
    if (dataFilePath === originalPath) {
      onClose();
      return;
    }

    setIsSaving(true);
    const success = await setDataPath(dataFilePath);
    setIsSaving(false);

    if (success) {
      onDataPathChanged();
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasChanges = dataFilePath !== originalPath;

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
          <button
            type="button"
            className="settings-popup-save"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPopup;
