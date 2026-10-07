import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Patient, type PatientInfo } from '../api/client';
import { serverErrorMessage } from '../i18n';

interface PatientInfoEditModalProps {
  patient: Patient;
  info: PatientInfo | null;
  onClose: () => void;
  onSaved: (patient: Patient, info: PatientInfo) => void;
}

export default function PatientInfoEditModal({ patient, info, onClose, onSaved }: PatientInfoEditModalProps) {
  const { t } = useTranslation();
  const [editName, setEditName] = useState(patient.name);
  const [editNames, setEditNames] = useState('');
  const [editLastNames, setEditLastNames] = useState('');
  const [editHistoryNumber, setEditHistoryNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The info may still be loading when the user opens the modal, so prefill the
  // fields as soon as it arrives. Once the user starts typing, their input wins.
  useEffect(() => {
    if (dirty) return;
    setEditNames(info?.names ?? '');
    setEditLastNames(info?.lastNames ?? '');
    setEditHistoryNumber(info?.historyNumber ?? '');
  }, [info, dirty]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const displayName = editName.trim();
    const names = editNames.trim();
    const lastNames = editLastNames.trim();
    const historyNumber = editHistoryNumber.trim();
    if (!displayName || !names || !lastNames || !historyNumber || saving) return;
    setSaveError('');
    setSaving(true);
    try {
      const saved = await authApi.updatePatient(patient.id, {
        displayName,
        names,
        lastNames,
        historyNumber,
      });
      onSaved(saved, {
        patientId: patient.id,
        names,
        lastNames,
        historyNumber,
        updatedAt: saved.updatedAt,
        deleted: false,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSaveError(t('errors.unauthorized'));
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setSaveError(t('patients.alreadyExists'));
        return;
      }
      setSaveError(serverErrorMessage(err) || t('patients.saveInfoFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="edit-info-title" className="modal-title">
          {t('patients.editInfoTitle')}
        </h3>
        <form onSubmit={handleSave}>
          <label className="field">
            <span>{t('patients.name')}</span>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t('patients.namePlaceholder')}
              autoFocus
              disabled={saving}
              required
            />
          </label>
          <label className="field">
            <span>{t('patients.names')}</span>
            <input
              type="text"
              value={editNames}
              onChange={(e) => {
                setEditNames(e.target.value);
                setDirty(true);
              }}
              placeholder={t('patients.namesPlaceholder')}
              disabled={saving}
              required
            />
          </label>
          <label className="field">
            <span>{t('patients.lastNames')}</span>
            <input
              type="text"
              value={editLastNames}
              onChange={(e) => {
                setEditLastNames(e.target.value);
                setDirty(true);
              }}
              placeholder={t('patients.lastNamesPlaceholder')}
              disabled={saving}
              required
            />
          </label>
          <label className="field">
            <span>{t('patients.historyNumber')}</span>
            <input
              type="text"
              value={editHistoryNumber}
              onChange={(e) => {
                setEditHistoryNumber(e.target.value);
                setDirty(true);
              }}
              placeholder={t('patients.historyNumberPlaceholder')}
              disabled={saving}
              required
            />
          </label>
          {saveError && <p className="error modal-error">{saveError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !editName.trim() || !editNames.trim() || !editLastNames.trim() || !editHistoryNumber.trim()}
            >
              {saving ? t('patients.savingInfo') : t('patients.saveInfo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
