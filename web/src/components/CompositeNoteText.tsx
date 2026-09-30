import { Fragment, useMemo } from 'react';

interface Pair {
  key: string;
  value: string;
}

const KEY_SEPARATOR = /[:=]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(formatValue).filter((item) => item !== '').join(', ');
  }
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

/** The order the pairs arrive in is the order the components were declared in. */
function pairsFromJson(text: string): Pair[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  const pairs: Pair[] = [];
  for (const item of parsed) {
    if (!isRecord(item) || typeof item.key !== 'string') return null;
    pairs.push({ key: item.key, value: formatValue(item.value) });
  }
  return pairs;
}

/** Pairs written as `Key: value` and separated by commas, semicolons or newlines.
 *  A separator that introduces no key belongs to the value before it, so a
 *  multi-value component keeps reading as one value. */
function pairsFromDelimitedText(text: string): Pair[] {
  const segments = text
    .replace(/[\r\n]+/g, ',')
    .split(/[,;]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');

  const pairs: Pair[] = [];
  for (const segment of segments) {
    const separator = KEY_SEPARATOR.exec(segment);
    if (!separator) {
      const previous = pairs[pairs.length - 1];
      if (!previous) return [];
      previous.value = previous.value === '' ? segment : `${previous.value}, ${segment}`;
      continue;
    }
    const key = segment.slice(0, separator.index).trim();
    if (key === '') return [];
    pairs.push({ key, value: segment.slice(separator.index + 1).trim() });
  }
  return pairs;
}

/**
 * A `Composite` note stores its values as a list of key-value pairs inside the
 * note text, e.g. `[{"key": "Systolic", "value": "120"}]`, written in the order
 * the components were declared in. Text that is not JSON falls back to reading
 * `Key: value` pairs, and an empty list means the note has no keys to show.
 */
export function parseCompositeText(text: string): Pair[] {
  return pairsFromJson(text) ?? pairsFromDelimitedText(text);
}

export default function CompositeNoteText({ text, className }: { text: string; className?: string }) {
  const pairs = useMemo(() => parseCompositeText(text), [text]);
  const extra = className ? ` ${className}` : '';

  if (pairs.length === 0) return <p className={`note-text${extra}`}>{text}</p>;

  return (
    <dl className={`composite-text${extra}`}>
      {pairs.map((pair, index) => (
        <Fragment key={`${pair.key}-${index}`}>
          <dt className="composite-key">{pair.key}</dt>
          <dd className="composite-value">{pair.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
