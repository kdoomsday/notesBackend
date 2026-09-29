import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '../api/client';
import type { CategoryTypeConfig } from '../categoryTypes';

interface CategoryValuesEditorProps {
  config: CategoryTypeConfig;
  value: string[];
  onChange: (next: string[]) => void;
  /** Categories offered in `category` mode. */
  categories?: Category[];
  /** Name of the category being edited, so it cannot pick itself. */
  currentName?: string;
  disabled?: boolean;
}

export default function CategoryValuesEditor({
  config,
  value,
  onChange,
  categories,
  currentName,
  disabled,
}: CategoryValuesEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const label = t(config.labelKey);
  const inlineLabel = t(config.inlineKey);

  const available = (categories ?? []).filter(
    (cat) => !cat.deleted && cat.name !== currentName && !value.includes(cat.name)
  );
  const pending = draft.trim();
  const canAdd =
    pending.length > 0 && !value.some((item) => item.toLowerCase() === pending.toLowerCase());
  const nothingLeft =
    config.mode === 'category' && value.length > 0 && available.length === 0;

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

  return (
    <div className="field">
      <span>{label}</span>
      {value.length === 0 ? (
        <p className="values-empty">{t('categories.valuesEmpty', { label: inlineLabel })}</p>
      ) : (
        <ul className="values-list">
          {value.map((item, index) => (
            <li className="values-item" key={index}>
              {config.mode === 'text' ? (
                <input
                  type="text"
                  value={item}
                  onChange={(e) => update(index, e.target.value)}
                  placeholder={t('categories.valuePlaceholder')}
                  disabled={disabled}
                />
              ) : (
                <span className="values-text">{item}</span>
              )}
              {value.length > 1 && (
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
              )}
              <button
                type="button"
                className="icon-btn icon-btn-sm icon-btn-danger"
                title={t('categories.removeValue', { value: item })}
                aria-label={t('categories.removeValue', { value: item })}
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
            </li>
          ))}
        </ul>
      )}
      {nothingLeft ? (
        <p className="values-empty">{t('categories.nothingToAdd', { label: inlineLabel })}</p>
      ) : (
        <div className="values-add">
          {config.mode === 'text' ? (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder={t('categories.valuePlaceholder')}
              disabled={disabled}
            />
          ) : (
            <select
              className="field-select"
              value={pending}
              onChange={(e) => setDraft(e.target.value)}
              disabled={disabled}
            >
              <option value="">{t('categories.pickValue')}</option>
              {available.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={add}
            disabled={disabled || !canAdd}
          >
            {t('categories.addValue')}
          </button>
        </div>
      )}
    </div>
  );
}
