import { useTranslation } from 'react-i18next';
import type { CategoryTypeConfig, CategoryExtras } from '../categoryTypes';
import CategoryComponentsEditor from './CategoryComponentsEditor';
import StringValuesEditor from './StringValuesEditor';

interface CategoryValuesEditorProps {
  config: CategoryTypeConfig;
  extras: CategoryExtras;
  onChange: (next: CategoryExtras) => void;
  disabled?: boolean;
}

/** Renders the field a category type requires, using the editor its mode asks for. */
export default function CategoryValuesEditor({
  config,
  extras,
  onChange,
  disabled,
}: CategoryValuesEditorProps) {
  const { t } = useTranslation();
  const label = t(config.inlineKey);

  function setOptions(options: string[]) {
    onChange({ ...extras, options });
  }

  return (
    <div className="field">
      <span>{t(config.labelKey)}</span>
      {config.mode === 'component' ? (
        <CategoryComponentsEditor
          value={extras.components}
          onChange={(components) => onChange({ ...extras, components })}
          disabled={disabled}
        />
      ) : (
        <StringValuesEditor
          value={extras.options}
          onChange={setOptions}
          label={label}
          disabled={disabled}
        />
      )}
    </div>
  );
}
