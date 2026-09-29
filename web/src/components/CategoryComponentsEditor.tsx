import { useTranslation } from 'react-i18next';
import { COMPONENT_TYPES, type Component, type ComponentType } from '../api/client';
import StringValuesEditor from './StringValuesEditor';

interface CategoryComponentsEditorProps {
  value: Component[];
  onChange: (next: Component[]) => void;
  disabled?: boolean;
}

function newComponent(): Component {
  return { name: '', categoryType: { type: 'Text' } };
}

/** Ordered list of fields a `Custom` category defines inline. */
export default function CategoryComponentsEditor({
  value,
  onChange,
  disabled,
}: CategoryComponentsEditorProps) {
  const { t } = useTranslation();

  function add() {
    onChange([...value, newComponent()]);
  }

  function update(index: number, patch: Partial<Component>) {
    onChange(value.map((component, i) => (i === index ? { ...component, ...patch } : component)));
  }

  function setType(index: number, type: ComponentType) {
    onChange(
      value.map((item, i) => {
        if (i !== index) return item;
        // Options only belong to a selection, so switching type drops them.
        const next: Component = { ...item, categoryType: { type } };
        if (type !== 'Selection') delete next.options;
        return next;
      })
    );
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
    <>
      {value.length === 0 ? (
        <p className="values-empty">
          {t('categories.valuesEmpty', { label: t('categories.componentsInline') })}
        </p>
      ) : (
        <ul className="components-list">
          {value.map((component, index) => {
            const name = component.name.trim();
            return (
            <li className="component-item" key={index}>
              <div className="component-head">
                <input
                  type="text"
                  className="component-name"
                  value={component.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder={t('categories.componentNamePlaceholder')}
                  disabled={disabled}
                />
                <select
                  className="field-select component-type"
                  value={component.categoryType.type}
                  onChange={(e) => setType(index, e.target.value as ComponentType)}
                  disabled={disabled}
                  aria-label={t('categories.componentType')}
                >
                  {COMPONENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`categories.type${type}`)}
                    </option>
                  ))}
                </select>
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
                  title={t('categories.removeComponent', { name })}
                  aria-label={t('categories.removeComponent', { name })}
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
              </div>
              {component.categoryType.type === 'Selection' && (
                <div className="component-options">
                  <span className="component-options-label">
                    {t('categories.componentOptions', { name })}
                  </span>
                  <StringValuesEditor
                    value={component.options ?? []}
                    onChange={(options) => update(index, { options })}
                    label={t('categories.optionsInline')}
                    emptyText={t('categories.componentOptionsEmpty')}
                    disabled={disabled}
                  />
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
      <div className="values-add">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={add}
          disabled={disabled}
        >
          {t('categories.addComponent')}
        </button>
      </div>
    </>
  );
}
