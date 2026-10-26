import { StatusTone } from '../components/common/StatusBadge';

/**
 * Maps a Choice field's selected value to a {@link StatusTone}, by keyword.
 *
 * `RiskRegistryData` has dozens of independent Choice fields acting as
 * statuses (`RiskStatus`, `CAPStatus`, `CAPreviewstatus`, `VPDetermination`,
 * ...), each with its own verified vocabulary — see `config/listSchema.ts`.
 * None of them is a shared enumeration, so there is no single switch that
 * covers them correctly. A keyword heuristic is the pragmatic middle ground:
 * it is wrong far less often than "always neutral", and — critically — tone
 * is never the only signal (`StatusBadge` always pairs it with an icon and
 * the literal text), so a wrong guess here costs a little visual emphasis,
 * never information.
 *
 * Order matters: more specific/severe keywords are checked first.
 */
export function resolveStatusTone(value: string | undefined): StatusTone {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'neutral';
  }

  const normalized = value.toLowerCase();

  if (
    normalized.indexOf('reject') !== -1 ||
    normalized.indexOf('request for') !== -1 ||
    normalized.indexOf('more information') !== -1 ||
    normalized.indexOf('deferred') !== -1 ||
    normalized.indexOf('unknown') !== -1 ||
    normalized.indexOf('pending') !== -1
  ) {
    return 'warning';
  }

  if (normalized.indexOf('harm') !== -1 && normalized === 'yes') {
    return 'danger';
  }

  if (
    normalized.indexOf('approved') !== -1 ||
    normalized.indexOf('accepted') !== -1 ||
    normalized.indexOf('completed') !== -1 ||
    normalized.indexOf('ready') !== -1 ||
    normalized.indexOf('corrected') !== -1 ||
    normalized.indexOf('closed') !== -1
  ) {
    return 'success';
  }

  if (
    normalized.indexOf('in progress') !== -1 ||
    normalized.indexOf('new') !== -1 ||
    normalized.indexOf('assigned') !== -1
  ) {
    return 'info';
  }

  return 'neutral';
}
