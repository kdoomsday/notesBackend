import type { NoteUpdate } from './api/client';
import { parseCompositeText, type Pair } from './components/CompositeNoteText';

type Translate = (key: string) => string;

/** One displayable piece of an update entry. */
export type ChangeLogBlock =
  /** A single word describing what happened, e.g. "Creada". */
  | { kind: 'message'; text: string }
  /** A bare value with no label, e.g. "5600g". */
  | { kind: 'text'; text: string }
  /** A labelled row. `changed` marks the rows an edit actually touched. */
  | { kind: 'field'; label: string; value: string; changed: boolean };

export interface HistoryChange {
  update: NoteUpdate;
  blocks: ChangeLogBlock[];
}

/** Fields that only say who touched the note, which the entry header already shows. */
const IMPLICIT_FIELDS = new Set(['createdBy', 'updatedByOperator', 'updatedByUser']);

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

function textBlocks(text: string, baseline: Pair[] | null): ChangeLogBlock[] {
  const pairs = parseCompositeText(text);
  if (pairs.length === 0) return [{ kind: 'text', text }];
  return pairs.map((pair) => ({
    kind: 'field',
    label: pair.key,
    value: pair.value,
    changed: baseline !== null && baseline.find((other) => other.key === pair.key)?.value !== pair.value,
  }));
}

function blocksFor(changes: string, baseline: Pair[] | null, t: Translate): {
  blocks: ChangeLogBlock[];
  nextBaseline: Pair[] | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(changes);
  } catch {
    return { blocks: [{ kind: 'text', text: changes }], nextBaseline: baseline };
  }
  if (!isRecord(parsed)) {
    return { blocks: [{ kind: 'text', text: changes }], nextBaseline: baseline };
  }

  const blocks: ChangeLogBlock[] = [];
  let nextBaseline = baseline;

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'created') {
      if (value) blocks.push({ kind: 'message', text: t('notes.changes.created') });
    } else if (key === 'deleted') {
      blocks.push({
        kind: 'message',
        text: t(value ? 'notes.changes.deleted' : 'notes.changes.restored'),
      });
    } else if (key === 'text' && typeof value === 'string') {
      blocks.push(...textBlocks(value, nextBaseline));
      /* A note that is not composite has no rows to compare, so the next
         composite edit has nothing to highlight either. */
      const pairs = parseCompositeText(value);
      nextBaseline = pairs.length > 0 ? pairs : null;
    } else if (key === 'category') {
      blocks.push({ kind: 'field', label: t('notes.changes.category'), value: categoryValue(value), changed: false });
    } else if (key === 'photoCount') {
      blocks.push({ kind: 'field', label: t('notes.photos'), value: plainValue(value), changed: false });
    } else if (!IMPLICIT_FIELDS.has(key)) {
      blocks.push({ kind: 'field', label: key, value: plainValue(value), changed: false });
    }
  }

  return { blocks, nextBaseline };
}

/**
 * Turns the raw update log into display blocks. The server stores each entry as
 * a JSON patch, e.g. `{"created": true}` or `{"text": "5600g"}`, so entries are
 * read in order and each `text` is diffed against the text of the entry before
 * it: a composite note keeps one value per key, and only the keys an edit
 * actually touched are marked as changed.
 */
export function parseHistory(entries: NoteUpdate[], t: Translate): HistoryChange[] {
  const ordered = entries.slice().sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const changes: HistoryChange[] = [];
  let baseline: Pair[] | null = null;

  for (const update of ordered) {
    const result = blocksFor(update.changes, baseline, t);
    baseline = result.nextBaseline;
    changes.push({ update, blocks: result.blocks });
  }

  return changes;
}