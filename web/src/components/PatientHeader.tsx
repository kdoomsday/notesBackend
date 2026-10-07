import { useTranslation } from 'react-i18next';
import type { Patient, PatientInfo } from '../api/client';

interface PatientHeaderProps {
  patient: Patient;
  info: PatientInfo | null;
  onEdit?: () => void;
}

export default function PatientHeader({ patient, info, onEdit }: PatientHeaderProps) {
  const { t } = useTranslation();

  const infoLine = info
    ? [
        [info.names, info.lastNames].filter(Boolean).join(' '),
        info.historyNumber ? t('patients.historyNumberValue', { value: info.historyNumber }) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="section-head section-head-row patient-header">
      <div>
        <h2>{patient.name}</h2>
        {infoLine && <p className="patient-detail">{infoLine}</p>}
      </div>
      {onEdit && (
        <button
          type="button"
          className="icon-btn"
          title={t('patients.editInfo')}
          aria-label={t('patients.editInfo')}
          onClick={onEdit}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}
    </div>
  );
}
