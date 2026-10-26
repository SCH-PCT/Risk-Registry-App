import * as React from 'react';

import { RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { RiskRegistryDraftValues, RiskRegistryFieldErrors } from '../../../models/viewModels/IRiskRegistryEditState';
import { RiskRegistryFieldValue } from '../../../models/domain/IRiskRegistryItem';
import { IPeopleRepository } from '../../../data/repositories/IPeopleRepository';
import { isFieldConditionallyRequired, isFieldVisible } from '../../../data/services/fieldMetadata';
import { IFieldGroup } from './detailSections';
import { FieldRenderer } from './FieldRenderer';
import styles from './SectionCard.module.scss';

export interface ISectionCardProps {
  readonly group: IFieldGroup;
  readonly mode: 'read' | 'edit';
  readonly values: RiskRegistryDraftValues;
  readonly fieldErrors: RiskRegistryFieldErrors;
  readonly onFieldChange?: (key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => void;
  /** Threaded to `FieldRenderer` for any `User`-type field this group renders — see `FieldRenderer`'s `people` prop. */
  readonly people?: IPeopleRepository;
}

/**
 * A responsive grid of one field group's fields.
 *
 * Purely a field grid — no heading, border or card chrome of its own. The
 * surrounding `StepCard` owns all of that: each group renders inside its own
 * icon/title/badge-headed sub-card, so the two are never nested as visually
 * redundant cards-within-cards.
 */
export const SectionCard: React.FC<ISectionCardProps> = ({ group, mode, values, fieldErrors, onFieldChange, people }) => (
  <div className={styles.grid} aria-label={group.title}>
    {group.fieldKeys
      // Some fields are only shown once another field in the same draft
      // has a particular value (see `fieldMetadata.ts`'s
      // `CONDITIONAL_FIELD_RULES`) — deciding this needs this group's full
      // `values`, which only this component (not `FieldRenderer`, which
      // sees one field at a time) has.
      .filter((key) => isFieldVisible(key, values))
      .map((key) => (
        <FieldRenderer
          key={key}
          fieldKey={key}
          mode={mode}
          value={values[key]}
          error={fieldErrors[key]}
          onChange={onFieldChange}
          isRequired={isFieldConditionallyRequired(key, values)}
          people={people}
        />
      ))}
  </div>
);

export default SectionCard;
