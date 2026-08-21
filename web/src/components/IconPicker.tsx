import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import CategoryIcon, { CATEGORY_ICON_NAMES } from './CategoryIcon';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MAX_RESULTS = 60;

function baseName(fullName: string) {
  return fullName.replace(/^[^.]+\./, '');
}

export default function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? CATEGORY_ICON_NAMES.filter((name) => name.toLowerCase().includes(q))
      : CATEGORY_ICON_NAMES;
    return filtered.slice(0, MAX_RESULTS);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const current = CATEGORY_ICON_NAMES.indexOf(value);
    setActive(current >= MAX_RESULTS ? 0 : Math.max(current, 0));
    searchRef.current?.focus();
  }, [open, value]);

  useEffect(() => {
    setActive((prev) => Math.min(prev, Math.max(results.length - 1, 0)));
  }, [results.length]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[active]) select(results[active]);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="icon-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-picker-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CategoryIcon iconName={value} size={18} />
        <span className="icon-picker-label">{baseName(value)}</span>
        <svg
          className="icon-picker-chevron"
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="icon-picker-menu">
          <input
            ref={searchRef}
            type="text"
            className="icon-picker-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('categories.iconSearchPlaceholder')}
          />
          {results.length === 0 ? (
            <p className="icon-picker-empty">{t('categories.iconNoMatches')}</p>
          ) : (
            <ul className="icon-picker-list" role="listbox" ref={listRef}>
              {results.map((name, index) => (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={name === value}
                    className={
                      'icon-picker-option' +
                      (index === active ? ' active' : '') +
                      (name === value ? ' selected' : '')
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(name)}
                    onMouseEnter={() => setActive(index)}
                  >
                    <CategoryIcon iconName={name} size={18} />
                    <span>{baseName(name)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
