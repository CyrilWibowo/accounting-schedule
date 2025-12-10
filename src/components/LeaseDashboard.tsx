import React, { useState, useEffect } from 'react';
import { Lease, PropertyLease, MotorVehicleLease } from '../types/Lease';
import Dashboard from './Dashboard';
import AddLeaseModal from './AddLeaseModal';
import ReportModal from './ReportModal';
import { loadLeases, addLease, updateLease, deleteLease } from '../utils/dataStorage';
import rimexLogo from '../assets/rimexLogo.png';
import cwTechnicaLogo from '../assets/C&WTechnicaLogo.png';
import './LeaseDashboard.css';

interface LeaseDashboardProps {
  onBack: () => void;
}

const LeaseDashboard: React.FC<LeaseDashboardProps> = ({ onBack }) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    const initLeases = async () => {
      const loaded = await loadLeases();
      setLeases(loaded);
    };
    initLeases();
  }, []);

  const handleAddLease = async (newLease: Lease) => {
    const updatedLeases = await addLease(newLease);
    setLeases(updatedLeases);
    setIsModalOpen(false);
  };

  const handleUpdateLease = async (updatedLease: Lease) => {
    const updatedLeases = await updateLease(updatedLease);
    setLeases(updatedLeases);
  };

  const handleDeleteLease = async (leaseId: string) => {
    const updatedLeases = await deleteLease(leaseId);
    setLeases(updatedLeases);
  };

  const handleCopyLease = async (copiedLease: Lease) => {
    const updatedLeases = await addLease(copiedLease);
    setLeases(updatedLeases);
  };

  const propertyLeases = leases.filter((lease): lease is PropertyLease => lease.type === 'Property');
  const motorVehicleLeases = leases.filter((lease): lease is MotorVehicleLease => lease.type === 'Motor Vehicle');

  return (
    <div className="lease-dashboard">
      <header className="lease-dashboard-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="header-logos">
            <img src={cwTechnicaLogo} alt="C&W Technica Logo" className="header-logo" />
          </div>
        </div>
        <div className="header-buttons">
          <button className="add-card-button" onClick={() => setIsModalOpen(true)}>
            Add Card
          </button>
          <button className="report-button" onClick={() => setIsReportModalOpen(true)}>
            AASB16 Report
          </button>
        </div>
      </header>

      <Dashboard
        propertyLeases={propertyLeases}
        motorVehicleLeases={motorVehicleLeases}
        onUpdateLease={handleUpdateLease}
        onDeleteLease={handleDeleteLease}
        onCopyLease={handleCopyLease}
      />

      {isModalOpen && (
        <AddLeaseModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddLease}
        />
      )}

      {isReportModalOpen && (
        <ReportModal
          onClose={() => setIsReportModalOpen(false)}
          propertyLeases={propertyLeases}
          motorVehicleLeases={motorVehicleLeases}
          onUpdateLeases={async (updatedLeases) => {
            for (const lease of updatedLeases) {
              await handleUpdateLease(lease);
            }
          }}
        />
      )}
    </div>
  );
};

export default LeaseDashboard;
