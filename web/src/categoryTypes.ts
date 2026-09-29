import i18n from './i18n';
import type { Category, CategoryType, Component } from './api/client';

export type CategoryExtraField = 'options' | 'components';

/** How the values of an extra field are entered. */
export type CategoryValueMode = 'text' | 'component';

export interface CategoryTypeConfig {
  /** Field of the category payload the type requires. */
  field: CategoryExtraField;
  mode: CategoryValueMode;
  /** Translation key for the heading of the field. */
  labelKey: string;
  /** Translation key for the lowercase field name, used inside sentences. */
  inlineKey: string;
}

/**
 * The server rejects extra values that do not go with the type, so every type
 * that needs them declares which field it uses and how it is filled in.
 */
export const CATEGORY_TYPE_CONFIGS: Partial<Record<CategoryType, CategoryTypeConfig>> = {
  Selection: {
    field: 'options',
    mode: 'text',
    labelKey: 'categories.options',
    inlineKey: 'categories.optionsInline',
  },
  Composite: {
    field: 'components',
    mode: 'component',
    labelKey: 'categories.components',
    inlineKey: 'categories.componentsInline',
  },
};

export interface CategoryExtras {
  options: string[];
  components: Component[];
}

export function categoryConfig(type: CategoryType): CategoryTypeConfig | null {
  return CATEGORY_TYPE_CONFIGS[type] ?? null;
}

export function extraFieldForType(type: CategoryType): CategoryExtraField | null {
  return categoryConfig(type)?.field ?? null;
}

export function emptyExtras(): CategoryExtras {
  return { options: [], components: [] };
}

export function readExtras(category: Category): CategoryExtras {
  return {
    options: category.options ? [...category.options] : [],
    components: (category.components ?? []).map((component) => ({
      ...component,
      categoryType: { type: component.categoryType.type },
      ...(component.options ? { options: [...component.options] } : {}),
    })),
  };
}

/** How many values the category carries for its type, zero for types that take none. */
export function extraCount(category: Category): number {
  const field = extraFieldForType(category.categoryType.type);
  return field ? category[field]?.length ?? 0 : 0;
}

function cleanValues(values: string[]): string[] {
  return values.map((value) => value.trim());
}

/** Keeps every field the server sent and only fixes what the form owns. */
function cleanComponent(component: Component): Component {
  const next: Component = {
    ...component,
    name: component.name.trim(),
    categoryType: { type: component.categoryType.type },
  };
  if (component.categoryType.type === 'Selection') {
    next.options = cleanValues(component.options ?? []);
  } else {
    delete next.options;
  }
  if (next.fixedText !== undefined && !next.fixedText.trim()) {
    delete next.fixedText;
  }
  return next;
}

/** Attaches only the extra field the type allows, so the server never gets the wrong one. */
export function buildCategory(base: Category, extras: CategoryExtras): Category {
  const config = categoryConfig(base.categoryType.type);
  if (!config) return base;
  if (config.field === 'options') {
    return { ...base, options: cleanValues(extras.options) };
  }
  return { ...base, components: extras.components.map(cleanComponent) };
}

function isDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) return null;
    if (seen.has(key)) return value.trim();
    seen.add(key);
  }
  return null;
}

function textValuesError(label: string, values: string[]): string {
  if (values.length === 0) {
    return i18n.t('categories.valuesRequired', { label });
  }
  if (values.some((value) => !value.trim())) {
    return i18n.t('categories.valueEmpty', { label });
  }
  const duplicate = isDuplicate(values);
  if (duplicate) {
    return i18n.t('categories.duplicateValue', { label, value: duplicate });
  }
  return '';
}

function componentValuesError(label: string, components: Component[]): string {
  if (components.length === 0) {
    return i18n.t('categories.valuesRequired', { label });
  }
  if (components.some((component) => !component.name.trim())) {
    return i18n.t('categories.componentNameRequired');
  }
  const duplicateName = isDuplicate(components.map((component) => component.name));
  if (duplicateName) {
    return i18n.t('categories.componentNameDuplicate', { value: duplicateName });
  }
  for (const component of components) {
    if (component.categoryType.type !== 'Selection') continue;
    const options = component.options ?? [];
    if (options.length === 0) {
      return i18n.t('categories.componentOptionsRequired', { name: component.name.trim() });
    }
    if (options.some((option) => !option.trim())) {
      return i18n.t('categories.componentValueEmpty', { name: component.name.trim() });
    }
    const duplicate = isDuplicate(options);
    if (duplicate) {
      return i18n.t('categories.componentDuplicateOption', {
        name: component.name.trim(),
        value: duplicate,
      });
    }
  }
  return '';
}

/** Returns a translated message when the values the type requires are missing or invalid. */
export function categoryValuesError(type: CategoryType, extras: CategoryExtras): string {
  const config = categoryConfig(type);
  if (!config) return '';
  const label = i18n.t(config.inlineKey);
  if (config.field === 'options') return textValuesError(label, extras.options);
  return componentValuesError(label, extras.components);
}
