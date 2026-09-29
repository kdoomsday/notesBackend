import i18n from './i18n';
import type { Category, CategoryType } from './api/client';

export const CATEGORY_EXTRA_FIELDS = ['options', 'components'] as const;
export type CategoryExtraField = (typeof CATEGORY_EXTRA_FIELDS)[number];

/** How the values of an extra field are entered. */
export type CategoryValueMode = 'text' | 'category';

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
  Custom: {
    field: 'components',
    mode: 'category',
    labelKey: 'categories.components',
    inlineKey: 'categories.componentsInline',
  },
};

export type CategoryExtras = Record<CategoryExtraField, string[]>;

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
    components: category.components ? [...category.components] : [],
  };
}

/** Values the category carries for its type, empty for types that take none. */
export function extraValues(category: Category): string[] {
  const field = extraFieldForType(category.categoryType.type);
  return field ? category[field] ?? [] : [];
}

/** Attaches only the extra field the type allows, so the server never gets the wrong one. */
export function buildCategory(base: Category, extras: CategoryExtras): Category {
  const field = extraFieldForType(base.categoryType.type);
  if (!field) return base;
  return { ...base, [field]: extras[field].map((value) => value.trim()) };
}

/** Returns a translated message when the values the type requires are missing or invalid. */
export function categoryValuesError(type: CategoryType, extras: CategoryExtras): string {
  const config = categoryConfig(type);
  if (!config) return '';
  const label = i18n.t(config.inlineKey);
  const values = extras[config.field].map((value) => value.trim());
  if (values.length === 0) {
    return i18n.t('categories.valuesRequired', { label });
  }
  if (values.some((value) => !value)) {
    return i18n.t('categories.valueEmpty', { label });
  }
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return i18n.t('categories.duplicateValue', { label, value });
    }
    seen.add(key);
  }
  return '';
}
