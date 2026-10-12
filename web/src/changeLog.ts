import type { Note, NoteUpdate } from './api/client';
import { parseCompositeText } from './components/CompositeNoteText';

type Translate = (key: string) => string;

/** One displayable piece of an update entry. */
export type ChangeLogBlock =
  /** A single word describing what happened, e.g. "Created". */
  | { kind: 'message'; text: string }
  /** A value transition. `label` is null for unlabelled text values. `from` is
   *  null when the value appeared (a creation or an added component) and `to`
   *  is null when it disappeared. */
  | { kind: 'transition'; label: string | null; from: string | null; to: string | null };

export interface HistoryChange {
  update: NoteUpdate;
  blocks: ChangeLogBlock[];
}

/** Fields that only say who touched the note, which the entry header already shows. */
const IMPLICIT_FIELDS = new Set([
  'createdBy',
  'created_by',
  'updatedByOperator',
  'updated_by_operator',
  'updatedByUser',
  'updated_by_user',
]);

/** The stored `changes` keys, normalised so variants share one handling path. */
const TEXT = 'text';
const DELETED = 'deleted';
const CATEGORY = 'category';
const DATE = 'note_date';
const PHOTO = 'photo_count';

/** A raw update entry with its `changes` parsed once. */
interface Entry {
  update: NoteUpdate;
  record: Record<string, unknown> | null;
  raw: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function plainValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** A category is stored whole, but only its name is worth showing. */
function categoryValue(value: unknown): string {
  if (isRecord(value) && typeof value.name === 'string') return value.name;
  return plainValue(value);
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canonicalField(key: string): string {
  switch (key) {
    case 'category_name':
    case 'category':
      return CATEGORY;
    case 'photo_count':
    case 'photoCount':
      return PHOTO;
    default:
      return key;
  }
}

/** Reads the value of a field from a `changes` record, accepting key variants. */
function readField(record: Record<string, unknown>, key: string): { present: boolean; value: unknown } {
  if (key === CATEGORY) {
    if (record.category_name !== undefined) return { present: true, value: record.category_name };
    if (record.category !== undefined) return { present: true, value: record.category };
    return { present: false, value: undefined };
  }
  if (key === PHOTO) {
    if (record.photo_count !== undefined) return { present: true, value: record.photo_count };
    if (record.photoCount !== undefined) return { present: true, value: record.photoCount };
    return { present: false, value: undefined };
  }
  if (Object.prototype.hasOwnProperty.call(record, key)) return { present: true, value: record[key] };
  return { present: false, value: undefined };
}

/** The note's own value for a field, used for the state after the last change. */
function noteField(note: Note, key: string): { found: boolean; value: unknown } {
  switch (key) {
    case TEXT:
      return { found: true, value: note.text };
    case DELETED:
      return { found: true, value: !!note.deleted };
    case CATEGORY:
      return note.category ? { found: true, value: note.category.name } : { found: false, value: undefined };
    case DATE:
      return { found: true, value: note.noteDate };
    case PHOTO:
      return { found: true, value: note.photoCount ?? 0 };
    default:
      return { found: false, value: undefined };
  }
}

/**
 * Each entry stores the state *before* the change, so the value a change
 * produced is either the before-value of the next entry touching the same
 * field, or the note's current value when nothing changed it again.
 */
function afterField(
  entries: Entry[],
  index: number,
  key: string,
  note: Note
): { found: boolean; value: unknown } {
  for (let i = index + 1; i < entries.length; i++) {
    const record = entries[i].record;
    if (!record) continue;
    const read = readField(record, key);
    if (read.present) return { found: true, value: read.value };
  }
  return noteField(note, key);
}

function textBlocks(from: string, to: string | null): ChangeLogBlock[] {
  const fromPairs = parseCompositeText(from);
  if (to === null) {
    if (fromPairs.length === 0) return from === '' ? [] : [{ kind: 'transition', label: null, from, to: null }];
    return fromPairs.map((pair) => ({ kind: 'transition', label: pair.key, from: pair.value, to: null }));
  }

  const toPairs = parseCompositeText(to);
  if (fromPairs.length === 0 && toPairs.length === 0) {
    if (from === to) return [];
    return [{ kind: 'transition', label: null, from, to }];
  }

  const blocks: ChangeLogBlock[] = [];
  const seen = new Set<string>();
  for (const pair of toPairs) {
    seen.add(pair.key);
    const before = fromPairs.find((other) => other.key === pair.key);
    if (!before) {
      blocks.push({ kind: 'transition', label: pair.key, from: null, to: pair.value });
    } else if (before.value !== pair.value) {
      blocks.push({ kind: 'transition', label: pair.key, from: before.value, to: pair.value });
    }
  }
  for (const pair of fromPairs) {
    if (!seen.has(pair.key)) blocks.push({ kind: 'transition', label: pair.key, from: pair.value, to: null });
  }
  return blocks;
}

/** The state a note started with, shown on the creation entry. */
function initialBlocks(entries: Entry[], index: number, note: Note, t: Translate): ChangeLogBlock[] {
  const blocks: ChangeLogBlock[] = [];

  const text = afterField(entries, index, TEXT, note);
  if (text.found && String(text.value) !== '') {
    const value = String(text.value);
    const pairs = parseCompositeText(value);
    if (pairs.length === 0) {
      blocks.push({ kind: 'transition', label: null, from: null, to: value });
    } else {
      blocks.push(...pairs.map((pair) => ({ kind: 'transition' as const, label: pair.key, from: null, to: pair.value })));
    }
  }

  const category = afterField(entries, index, CATEGORY, note);
  if (category.found && categoryValue(category.value) !== '') {
    blocks.push({
      kind: 'transition',
      label: t('notes.changes.category'),
      from: null,
      to: categoryValue(category.value),
    });
  }

  return blocks;
}

function blocksFor(
  entry: Entry,
  entries: Entry[],
  index: number,
  note: Note,
  t: Translate,
  locale: string
): ChangeLogBlock[] {
  const record = entry.record;
  if (!record) return [{ kind: 'transition', label: null, from: null, to: entry.raw }];

  if (record.created === true) {
    return [{ kind: 'message', text: t('notes.changes.created') }, ...initialBlocks(entries, index, note, t)];
  }

  const blocks: ChangeLogBlock[] = [];
  for (const rawKey of Object.keys(record)) {
    if (IMPLICIT_FIELDS.has(rawKey)) continue;
    const key = canonicalField(rawKey);

    if (key === DELETED) {
      const after = afterField(entries, index, DELETED, note);
      const deletedNow = after.found ? !!after.value : !record[rawKey];
      blocks.push({ kind: 'message', text: t(deletedNow ? 'notes.changes.deleted' : 'notes.changes.restored') });
      continue;
    }

    if (key === TEXT) {
      const from = plainValue(record[rawKey]);
      const after = afterField(entries, index, TEXT, note);
      blocks.push(...textBlocks(from, after.found ? String(after.value) : null));
      continue;
    }

    if (key === CATEGORY) {
      const from = categoryValue(record[rawKey]);
      const after = afterField(entries, index, CATEGORY, note);
      const to = after.found ? categoryValue(after.value) : null;
      if (to === null || to !== from) {
        blocks.push({ kind: 'transition', label: t('notes.changes.category'), from, to });
      }
      continue;
    }

    if (key === DATE) {
      const from = formatDate(plainValue(record[rawKey]), locale);
      const after = afterField(entries, index, DATE, note);
      const to = after.found ? formatDate(String(after.value), locale) : null;
      if (to === null || to !== from) {
        blocks.push({ kind: 'transition', label: t('notes.changes.date'), from, to });
      }
      continue;
    }

    if (key === PHOTO) {
      const from = plainValue(record[rawKey]);
      const after = afterField(entries, index, PHOTO, note);
      const to = after.found ? plainValue(after.value) : null;
      if (to === null || to !== from) {
        blocks.push({ kind: 'transition', label: t('notes.photos'), from, to });
      }
      continue;
    }

    const from = plainValue(record[rawKey]);
    const after = afterField(entries, index, rawKey, note);
    const to = after.found ? plainValue(after.value) : null;
    if (to === null || to !== from) {
      blocks.push({ kind: 'transition', label: rawKey, from, to });
    }
  }

  return blocks;
}

/**
 * Turns the raw update log into display blocks. The server stores each entry as
 * the state *before* a change, e.g. `{"created": true}` or `{"text": "10"}`, so
 * entries are read in order and the value a change produced is taken from the
 * next entry that touches the same field, or from the note itself for the last
 * change. Each entry is then rendered as a `before -> after` transition.
 */
export function parseHistory(entries: NoteUpdate[], note: Note, t: Translate, locale: string): HistoryChange[] {
  const parsed: Entry[] = entries
    .slice()
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((update) => {
      let record: Record<string, unknown> | null = null;
      try {
        const value = JSON.parse(update.changes);
        if (isRecord(value)) record = value;
      } catch {
        record = null;
      }
      return { update, record, raw: update.changes };
    });

  return parsed.map((entry, index) => ({
    update: entry.update,
    blocks: blocksFor(entry, parsed, index, note, t, locale),
  }));
}
