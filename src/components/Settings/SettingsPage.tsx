import React, { useState, useEffect } from 'react';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { getDataPath, setDataPath } from '../../utils/dataStorage';
import './SettingsPage.css';

interface SettingsPageProps {
  onDataPathChanged: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onDataPathChanged }) => {
  const [dataFilePath, setDataFilePath] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadCurrentPath = async () => {
      const currentPath = await getDataPath();
      setDataFilePath(currentPath);
      setOriginalPath(currentPath);
    };
    loadCurrentPath();
  }, []);

  const handleBrowse = async () => {
    const selectedPath = await window.electronAPI?.showOpenDialog();
    if (selectedPath) {
      setDataFilePath(selectedPath);
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (dataFilePath === originalPath) return;

    setIsSaving(true);
    const success = await setDataPath(dataFilePath);
    setIsSaving(false);

    if (success) {
      setOriginalPath(dataFilePath);
      setSaved(true);
      onDataPathChanged();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const hasChanges = dataFilePath !== originalPath;

  return (
    <div className="settings-page">
      <div className="settings-page-container">
        <h2>Settings</h2>

        <div className="settings-section">
          <h3>Data Storage</h3>
          <div className="settings-field">
            <label>Data File Path</label>
            <div className="settings-input-group">
              <input
                type="text"
                value={dataFilePath}
                onChange={(e) => { setDataFilePath(e.target.value); setSaved(false); }}
                placeholder="Select a folder..."
                readOnly
              />
              <button
                type="button"
                className="settings-browse-button"
                onClick={handleBrowse}
                title="Browse"
              >
                <FolderOpenIcon fontSize="small" />
              </button>
            </div>
          </div>
          {hasChanges && (
            <button
              className="settings-save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {saved && <span className="settings-saved-text">Saved</span>}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
