import { IListDefinition, isListResolved } from '../../../config/listSchema';
import { RiskRegistryError } from '../IRiskRegistryRepository';

/**
 * Shared guard for the four related-entity PnP repositories
 * (`RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments`) whose
 * schema and relationship to `RiskRegistryData` have not been verified.
 *
 * Throws a `RiskRegistryError('invalid-configuration', ...)` naming the list
 * and pointing at SCHEMA-TODO.md, rather than composing a query against a
 * guessed column name. Once a list's schema is verified and declared in
 * `listSchema.ts`, `isListResolved` starts returning `true` for it and this
 * guard becomes inert — the real query logic can then be added to that one
 * repository without touching the other three.
 */
export function assertRelatedListConfigured(listDefinition: IListDefinition): void {
  if (isListResolved(listDefinition)) {
    return;
  }

  throw new RiskRegistryError(
    'invalid-configuration',
    `'${listDefinition.title}' has not been verified against the live site yet. ` +
      `Run scripts/Get-RiskRegistrySchema.ps1 and update listSchema.ts. See SCHEMA-TODO.md.`
  );
}
