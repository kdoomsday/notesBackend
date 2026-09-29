import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface StringValuesEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Lowercase field name, used for the empty hint. */
  label: string;
  emptyText?: string;
  disabled?: boolean;
}

/** Ordered list of free text values with add, remove and reorder. */
export default function StringValuesEditor({
  value,
  onChange,
  label,
  emptyText,
  disabled,
}: StringValuesEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const pending = draft.trim();
  const canAdd =
    pending.length > 0 && !value.some((item) => item.toLowerCase() === pending.toLowerCase());

  function add() {
    if (!canAdd) return;
    onChange([...value, pending]);
    setDraft('');
  }

  function onDraftKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    add();
  }

  function update(index: number, next: string) {
    onChange(value.map((item, i) => (i === index ? next : item)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  function moveButtons(index: number) {
    return (
      <>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title={t('categories.moveUp')}
          aria-label={t('categories.moveUp')}
          disabled={disabled || index === 0}
          onClick={() => move(index, -1)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title={t('categories.moveDown')}
          aria-label={t('categories.moveDown')}
          disabled={disabled || index === value.length - 1}
          onClick={() => move(index, 1)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </>
    );
  }

  function removeButton(index: number, item: string) {
    const name = item.trim();
    return (
      <button
        type="button"
        className="icon-btn icon-btn-sm icon-btn-danger"
        title={t('categories.removeValue', { value: name })}
        aria-label={t('categories.removeValue', { value: name })}
        disabled={disabled}
        onClick={() => remove(index)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {value.length === 0 ? (
        <p className="values-empty">{emptyText ?? t('categories.valuesEmpty', { label })}</p>
      ) : (
        <ul className="values-list">
          {value.map((item, index) => (
            <li className="values-item" key={index}>
              <input
                type="text"
                value={item}
                onChange={(e) => update(index, e.target.value)}
                placeholder={t('categories.valuePlaceholder')}
                disabled={disabled}
              />
              {value.length > 1 && moveButtons(index)}
              {removeButton(index, item)}
            </li>
          ))}
        </ul>
      )}
      <div className="values-add">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          placeholder={t('categories.valuePlaceholder')}
          disabled={disabled}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={disabled || !canAdd}>
          {t('categories.addValue')}
        </button>
      </div>
    </>
  );
}
