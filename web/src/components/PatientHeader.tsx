import { useTranslation } from 'react-i18next';
import type { Patient, PatientInfo } from '../api/client';

interface PatientHeaderProps {
  patient: Patient;
  info: PatientInfo | null;
}

export default function PatientHeader({ patient, info }: PatientHeaderProps) {
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
    <div className="section-head patient-header">
      <h2>{patient.name}</h2>
      {infoLine && <p className="patient-detail">{infoLine}</p>}
    </div>
  );
}
