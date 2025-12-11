// components/AddLeaseModal.tsx
import React, { useState, useEffect } from 'react';
import { Lease, PropertyLease, MotorVehicleLease } from '../../types/Lease';
import LeaseForm from './LeaseForm';
import { generateLeaseId } from '../../utils/helper';
import './AddLeaseModal.css';

interface AddLeaseModalProps {
  onClose: () => void;
  onSave: (lease: Lease) => void;
  entityCompanyCode: string;
}

const createPropertyLease = (): PropertyLease => {
  const baseId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  return {
    id: baseId,
    leaseId: generateLeaseId('Property'),
    type: 'Property',
    entity: '',
    lessor: '',
    branch: '',
    propertyAddress: '',
    commencementDate: '',
    expiryDate: '',
    options: '',
    annualRent: '',
    rbaCpiRate: '',
    fixedIncrementRate: '',
    borrowingRate: '',
    incrementMethods: {},
    overrideAmounts: {},
    openingBalances: [],
  };
};

const createMotorVehicleLease = (): MotorVehicleLease => {
  const baseId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  return {
    id: baseId,
    leaseId: generateLeaseId('Motor Vehicle'),
    type: 'Motor Vehicle',
    entity: '',
    lessor: '',
    branch: '',
    description: '',
    vinSerialNo: '',
    regoNo: '',
    engineNumber: '',
    vehicleType: '',
    deliveryDate: '',
    expiryDate: '',
    annualRent: '',
    borrowingRate: '',
    incrementMethods: {},
    overrideAmounts: {},
    openingBalances: [],
  };
};

const AddLeaseModal: React.FC<AddLeaseModalProps> = ({ onClose, onSave, entityCompanyCode }) => {
  const [leaseType, setLeaseType] = useState<'Property' | 'Motor Vehicle'>('Property');
  const [lease, setLease] = useState<Lease>(() => ({
    ...createPropertyLease(),
    entity: entityCompanyCode,
  }));
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [committedYears, setCommittedYears] = useState(0);

  useEffect(() => {
    if (lease) {
      calculateCommittedYears();
    }
  }, [lease]);

  const calculateCommittedYears = () => {
    if (!lease) return;

    if (lease.type === 'Property') {
      const propertyLease = lease as PropertyLease;
      if (propertyLease.commencementDate && propertyLease.expiryDate) {
        const start = new Date(propertyLease.commencementDate);
        const end = new Date(propertyLease.expiryDate);

        // Calculate total months from commencement to expiry
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());

        // Only add 1 if the end date day is AFTER the start date day
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;

        const optionsYears = parseInt(propertyLease.options) || 0;
        const totalMonths = adjustedMonths + (optionsYears * 12);
        const total = Math.ceil(totalMonths / 12);

        setCommittedYears(total > 0 ? total : 0);
      } else {
        setCommittedYears(0);
      }
    } else {
      const mvLease = lease as MotorVehicleLease;
      if (mvLease.deliveryDate && mvLease.expiryDate) {
        const start = new Date(mvLease.deliveryDate);
        const end = new Date(mvLease.expiryDate);

        // Calculate total months
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());

        // Only add 1 if the end date day is AFTER the start date day
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;
        const total = Math.ceil(adjustedMonths / 12);

        setCommittedYears(total > 0 ? total : 0);
      } else {
        setCommittedYears(0);
      }
    }
  };

  const handleLeaseTypeChange = (type: 'Property' | 'Motor Vehicle') => {
    setLeaseType(type);
    setErrors({});
    setCommittedYears(0);

    if (type === 'Property') {
      setLease({ ...createPropertyLease(), entity: entityCompanyCode });
    } else {
      setLease({ ...createMotorVehicleLease(), entity: entityCompanyCode });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (!lease) return;
    setLease({ ...lease, [field]: value } as Lease);
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const handleIncrementMethodChange = (year: number, value: string) => {
    if (!lease) return;
    const updatedMethods = { ...lease.incrementMethods, [year]: value };
    const updatedLease = { ...lease, incrementMethods: updatedMethods };

    if (value !== 'Market') {
      const updatedOverrides = { ...lease.overrideAmounts };
      delete updatedOverrides[year];
      updatedLease.overrideAmounts = updatedOverrides;
    }

    setLease(updatedLease as Lease);
  };

  const handleOverrideAmountChange = (year: number, value: string) => {
    if (!lease) return;
    const updatedOverrides = { ...lease.overrideAmounts, [year]: value };
    setLease({ ...lease, overrideAmounts: updatedOverrides } as Lease);
  };

  const validateForm = (): boolean => {
    if (!lease) return false;

    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    // Common validations (entity is auto-filled, no validation needed)
    if (!lease.lessor?.trim()) {
      newErrors.lessor = true;
      isValid = false;
    }
    if (!lease.branch?.trim()) {
      newErrors.branch = true;
      isValid = false;
    }
    if (!lease.annualRent.trim()) {
      newErrors.annualRent = true;
      isValid = false;
    }
    if (!lease.borrowingRate.trim()) {
      newErrors.borrowingRate = true;
      isValid = false;
    }

    if (lease.type === 'Property') {
      const propertyLease = lease as PropertyLease;
      if (!propertyLease.propertyAddress?.trim()) {
        newErrors.propertyAddress = true;
        isValid = false;
      }
      if (!propertyLease.commencementDate) {
        newErrors.commencementDate = true;
        isValid = false;
      }
      if (!propertyLease.expiryDate) {
        newErrors.expiryDate = true;
        isValid = false;
      }
      if (!propertyLease.options.trim()) {
        newErrors.options = true;
        isValid = false;
      }
      if (!propertyLease.fixedIncrementRate.trim()) {
        newErrors.fixedIncrementRate = true;
        isValid = false;
      }
      if (!propertyLease.rbaCpiRate.trim()) {
        newErrors.rbaCpiRate = true;
        isValid = false;
      }

      // Validate increment methods starting from year 1
      if (committedYears >= 1) {
        for (let year = 1; year <= committedYears; year++) {
          if (!propertyLease.incrementMethods[year]) {
            newErrors[`incrementMethod_${year}`] = true;
            isValid = false;
          }
          if (propertyLease.incrementMethods[year] === 'Market' && !propertyLease.overrideAmounts[year]?.trim()) {
            newErrors[`overrideAmount_${year}`] = true;
            isValid = false;
          }
        }
      }
    } else {
      const mvLease = lease as MotorVehicleLease;
      if (!mvLease.description?.trim()) {
        newErrors.description = true;
        isValid = false;
      }
      if (!mvLease.vinSerialNo?.trim()) {
        newErrors.vinSerialNo = true;
        isValid = false;
      }
      if (!mvLease.regoNo?.trim()) {
        newErrors.regoNo = true;
        isValid = false;
      }
      if (!mvLease.engineNumber?.trim()) {
        newErrors.engineNumber = true;
        isValid = false;
      }
      if (!mvLease.vehicleType?.trim()) {
        newErrors.vehicleType = true;
        isValid = false;
      }
      if (!mvLease.deliveryDate) {
        newErrors.deliveryDate = true;
        isValid = false;
      }
      if (!mvLease.expiryDate) {
        newErrors.expiryDate = true;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm() && lease) {
      onSave(lease);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <LeaseForm
          lease={lease}
          leaseType={leaseType}
          errors={errors}
          committedYears={committedYears}
          onInputChange={handleInputChange}
          onIncrementMethodChange={handleIncrementMethodChange}
          onOverrideAmountChange={handleOverrideAmountChange}
          onLeaseTypeChange={handleLeaseTypeChange}
          onSubmit={handleSubmit}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

export default AddLeaseModal;