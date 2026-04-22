import React, { useRef, useEffect } from 'react';
import './AdvancedFilterPanel.css';

export type InlineFieldDef =
  | { type: 'number-range'; key: string; label: string }
  | { type: 'date-range'; key: string; label: string };

export type FilterFieldDef =
  | { type: 'checkbox'; key: string; label: string; options: string[] }
  | InlineFieldDef
  | { type: 'row'; fields: InlineFieldDef[] };

export interface AdvancedFilters {
  checkboxes: Record<string, string[]>;
  numberRanges: Record<string, { min: string; max: string }>;
  dateRanges: Record<string, { earliest: string; latest: string }>;
}

const flattenFields = (fields: FilterFieldDef[]): Array<Exclude<FilterFieldDef, { type: 'row' }>> =>
  fields.flatMap(f => (f.type === 'row' ? f.fields : [f]));

export const buildEmptyFilters = (fields: FilterFieldDef[]): AdvancedFilters => {
  const flat = flattenFields(fields);
  return {
    checkboxes: Object.fromEntries(flat.filter(f => f.type === 'checkbox').map(f => [f.key, []])),
    numberRanges: Object.fromEntries(flat.filter(f => f.type === 'number-range').map(f => [f.key, { min: '', max: '' }])),
    dateRanges: Object.fromEntries(flat.filter(f => f.type === 'date-range').map(f => [f.key, { earliest: '', latest: '' }])),
  };
};

export const hasActiveFilters = (filters: AdvancedFilters): boolean =>
  Object.values(filters.checkboxes).some(v => v.length > 0) ||
  Object.values(filters.numberRanges).some(v => v.min !== '' || v.max !== '') ||
  Object.values(filters.dateRanges).some(v => v.earliest !== '' || v.latest !== '');

interface Props {
  fields: FilterFieldDef[];
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  onClose: () => void;
}

const AdvancedFilterPanel: React.FC<Props> = ({ fields, filters, onChange, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggleCheckbox = (key: string, value: string) => {
    const current = filters.checkboxes[key] ?? [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    onChange({ ...filters, checkboxes: { ...filters.checkboxes, [key]: next } });
  };

  const setNumberRange = (key: string, side: 'min' | 'max', value: string) => {
    const current = filters.numberRanges[key] ?? { min: '', max: '' };
    onChange({ ...filters, numberRanges: { ...filters.numberRanges, [key]: { ...current, [side]: value } } });
  };

  const setDateRange = (key: string, side: 'earliest' | 'latest', value: string) => {
    const current = filters.dateRanges[key] ?? { earliest: '', latest: '' };
    onChange({ ...filters, dateRanges: { ...filters.dateRanges, [key]: { ...current, [side]: value } } });
  };

  const clearAll = () => onChange(buildEmptyFilters(fields));

  const active = hasActiveFilters(filters);

  const renderInlineField = (field: InlineFieldDef) => (
    <>
      {field.type === 'number-range' && (
        <div className="adv-filter-range-row">
          <input
            type="number"
            placeholder="Min"
            value={filters.numberRanges[field.key]?.min ?? ''}
            onChange={e => setNumberRange(field.key, 'min', e.target.value)}
            className="adv-filter-range-input"
          />
          <span className="adv-filter-range-sep">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.numberRanges[field.key]?.max ?? ''}
            onChange={e => setNumberRange(field.key, 'max', e.target.value)}
            className="adv-filter-range-input"
          />
        </div>
      )}
      {field.type === 'date-range' && (
        <div className="adv-filter-range-row adv-filter-date-row">
          <div className="adv-filter-date-col">
            <span className="adv-filter-date-label">Earliest</span>
            <input
              type="date"
              value={filters.dateRanges[field.key]?.earliest ?? ''}
              onChange={e => setDateRange(field.key, 'earliest', e.target.value)}
              className="adv-filter-range-input"
            />
          </div>
          <div className="adv-filter-date-col">
            <span className="adv-filter-date-label">Latest</span>
            <input
              type="date"
              value={filters.dateRanges[field.key]?.latest ?? ''}
              onChange={e => setDateRange(field.key, 'latest', e.target.value)}
              className="adv-filter-range-input"
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="adv-filter-panel" ref={panelRef} onMouseDown={e => e.stopPropagation()}>
      <div className="adv-filter-header">
        <span className="adv-filter-title">Advanced Filters</span>
        {active && (
          <button className="adv-filter-clear" onClick={clearAll}>Clear all</button>
        )}
      </div>
      <div className="adv-filter-body">
        {fields.map((field, idx) => {
          if (field.type === 'row') {
            return (
              <div key={idx} className="adv-filter-section adv-filter-row-section">
                {field.fields.map(child => (
                  <div key={child.key} className="adv-filter-row-col">
                    <div className="adv-filter-section-label">{child.label}</div>
                    {renderInlineField(child)}
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div key={field.key} className="adv-filter-section">
              <div className="adv-filter-section-label">{field.label}</div>

              {field.type === 'checkbox' && (
                <div className="adv-filter-checkboxes">
                  {field.options.map(opt => (
                    <label key={opt} className="adv-filter-checkbox-row">
                      <input
                        type="checkbox"
                        checked={(filters.checkboxes[field.key] ?? []).includes(opt)}
                        onChange={() => toggleCheckbox(field.key, opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {(field.type === 'number-range' || field.type === 'date-range') && renderInlineField(field)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdvancedFilterPanel;
