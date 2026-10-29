/**
 * Pure presentation helpers shared by `RiskListCard`/`RiskRegistryList` —
 * kept separate from the components so the mapping logic (which real field
 * drives which badge/tone) is easy to audit and unit-test on its own.
 */

import { StatusTone } from '../../../components/common/StatusBadge';
import { asNumber, asPerson, asText } from '../../../utilities/riskFieldValue';

export { asNumber, asPerson, asText };

/** Tone for the `riskStatus` pill. Every declared status is covered explicitly — no fallback guess. */
const STATUS_TONE: Readonly<Record<string, StatusTone>> = {
  New: 'info',
  Evaluation: 'info',
  Rejected: 'neutral',
  'Pending Assignment': 'warning',
  'Deferred Risk Accepted': 'neutral',
  'Assigned In-Progress': 'warning',
  'Corrected - Monitoring': 'success',
  'Corrected - Unmonitored': 'success',
  'Corrected - Hard Fix': 'success'
};

export function statusToneFor(riskStatus: string | undefined): StatusTone {
  if (!riskStatus) {
    return 'neutral';
  }
  return STATUS_TONE[riskStatus] ?? 'neutral';
}

export function formatShortDate(date: Date | undefined, locale?: string): string | undefined {
  if (!date) {
    return undefined;
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Initials for the avatar fallback when no profile photo is available (People fields never carry one over REST). */
export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

export type PaginationEntry = number | 'ellipsis';

/**
 * Windowed page numbers for the pagination bar — always shows page 1, the
 * last page, and a small window around the current page, collapsing any gap
 * into a single `'ellipsis'` entry. Matches the "1 2 3 4 … 29" shape the
 * design shows rather than rendering every page number for a large list.
 */
export function computePaginationPages(current: number, total: number, windowSize = 4): PaginationEntry[] {
  if (total <= 1) {
    return [1];
  }

  const windowStart = Math.max(1, Math.min(current, windowSize));
  const windowEnd = Math.min(total, windowStart + windowSize - 1);

  const pages: PaginationEntry[] = [];
  for (let page = 1; page <= windowEnd; page += 1) {
    pages.push(page);
  }

  if (windowEnd < total - 1) {
    pages.push('ellipsis');
  }

  if (windowEnd < total) {
    pages.push(total);
  }

  return pages;
}
