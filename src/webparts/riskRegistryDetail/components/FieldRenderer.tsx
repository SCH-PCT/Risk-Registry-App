import * as React from 'react';
import { TextField, Dropdown, IDropdownOption, Toggle, IToggleStyleProps, IToggleStyles, DatePicker } from '@fluentui/react';

import { getRiskRegistryDataField, RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { IRiskRegistryPerson, RiskRegistryFieldValue } from '../../../models/domain/IRiskRegistryItem';
import { IPeopleRepository } from '../../../data/repositories/IPeopleRepository';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { PersonDisplay } from '../../../components/common/PersonDisplay';
import { resolveStatusTone } from '../../../utilities/statusTone';
import { fieldDomId } from './fieldDomId';
import { PersonPickerField } from './PersonPickerField';
import styles from './FieldRenderer.module.scss';

export interface IFieldRendererProps {
  readonly fieldKey: RiskRegistryDataFieldKey;
  readonly mode: 'read' | 'edit';
  readonly value: RiskRegistryFieldValue;
  readonly error?: string;
  readonly onChange?: (key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => void;
  /**
   * Overrides the required-asterisk decision for a field whose
   * requiredness is conditional on another field's value (e.g.
   * `otherResourceForCorrection`, only required once
   * `anticipatedResourceForCorrection` is "Other" — see
   * `fieldMetadata.ts`'s `validateOtherResourceForCorrection`). Falls back
   * to the field's static `listSchema.ts` `required` flag when omitted.
   */
  readonly isRequired?: boolean;
  /**
   * Overrides the generated `fieldDomId(fieldKey)` DOM id. Needed only when
   * the same field renders in more than one place at once — currently just
   * `title` ("Risk Title"), which shows both in the page header and inside
   * Step 1's fields for an existing record — so the two instances don't
   * collide on the same id.
   */
  readonly domId?: string;
  /**
   * Overrides the field label (normally `definition.displayName`). Used by
   * the page header's `title` instance, which shows the risk's title text
   * but labels it "Risk ID: [n]" rather than "Risk Title" — Step 1's
   * instance of the same field keeps the normal "Risk Title" label.
   */
  readonly labelOverride?: string;
  /**
   * Required to edit a `User`-type field — searches the tenant directory for
   * the picker (see `PersonPickerField`). `undefined` for every other field
   * type, and for a `User` field rendered somewhere read-only.
   */
  readonly people?: IPeopleRepository;
}

/** Dropdown key for a Choice field's explicit "clear this field" option — never collides with a real choice's `${choice}-${index}` key. */
const CHOICE_BLANK_OPTION_KEY = '__blank__';

function isPerson(value: RiskRegistryFieldValue): value is IRiskRegistryPerson {
  return typeof value === 'object' && value !== null && 'displayName' in value;
}

/** Teal "on" state for Boolean fields, matching the design's toggle switches. */
function toggleStyles(props: IToggleStyleProps): Partial<IToggleStyles> {
  const onColor = props.checked ? '#0e3b3c' : '#dde5e3';
  const onColorHover = props.checked ? '#1a5c5c' : '#c9d3d1';
  return {
    pill: {
      backgroundColor: onColor,
      borderColor: onColor,
      selectors: {
        ':hover': { backgroundColor: onColorHover, borderColor: onColorHover }
      }
    }
  };
}

function formatDate(value: RiskRegistryFieldValue): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(typeof navigator !== 'undefined' ? navigator.language : undefined, {
    dateStyle: 'medium'
  }).format(date);
}

/**
 * Renders one `RiskRegistryData` field, in either read or edit mode, driven
 * entirely by its verified metadata (`config/listSchema.ts`) — the one
 * switch on `definition.type` below is the only place field-shape decisions
 * are made, which is what let `detailSections.ts` grow to cover every
 * verified field as plain configuration data rather than ~80 hand-written
 * JSX blocks.
 *
 * Read and edit modes share the same section/label/grid styling
 * (`FieldRenderer.module.scss`), per the requirement that both modes use
 * the same styles — only the value surface (text vs. input) changes.
 */
export const FieldRenderer: React.FC<IFieldRendererProps> = ({
  fieldKey,
  mode,
  value,
  error,
  onChange,
  isRequired,
  domId: domIdOverride,
  labelOverride,
  people
}) => {
  const definition = getRiskRegistryDataField(fieldKey);
  const domId = domIdOverride ?? fieldDomId(fieldKey);
  const isReadOnly = mode === 'read';
  const showRequiredAsterisk = isRequired ?? definition.required;

  const handleChange = (next: RiskRegistryFieldValue): void => onChange?.(fieldKey, next);

  const fieldBody = (): React.ReactElement => {
    if (isReadOnly) {
      return renderReadValue();
    }

    switch (definition.type) {
      case 'Text':
        return (
          <TextField
            id={domId}
            value={typeof value === 'string' ? value : ''}
            onChange={(_, newValue) => handleChange(newValue)}
            errorMessage={error}
            maxLength={definition.maxLength}
          />
        );
      case 'Note':
        return (
          <TextField
            id={domId}
            value={typeof value === 'string' ? value : ''}
            onChange={(_, newValue) => handleChange(newValue)}
            errorMessage={error}
            multiline
            autoAdjustHeight
          />
        );
      case 'Number':
        return (
          <TextField
            id={domId}
            type="number"
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(_, newValue) => {
              if (newValue === undefined || newValue === '') {
                handleChange(undefined);
                return;
              }
              const parsed = Number(newValue);
              handleChange(Number.isFinite(parsed) ? parsed : newValue);
            }}
            errorMessage={error}
          />
        );
      case 'Choice': {
        // A real, selectable option rather than just a placeholder — the
        // only way to clear a Choice field back to blank once some value has
        // been picked (Fluent's placeholder only ever shows for an
        // already-blank field; it is not itself a selectable item).
        const blankOption: IDropdownOption = { key: CHOICE_BLANK_OPTION_KEY, text: '(Not Set)', data: undefined, title: '(Not Set)' };
        const options: IDropdownOption[] = [
          blankOption,
          ...(definition.choices ?? []).map((choice, index) => ({
            key: `${choice}-${index}`,
            text: choice,
            // Built-in tooltip on hover, so a long option (either in the open
            // list or truncated once selected) is still readable in full.
            title: choice,
            data: choice
          }))
        ];
        const selectedKey = options.find((option) => option.data === value)?.key ?? CHOICE_BLANK_OPTION_KEY;
        return (
          <Dropdown
            id={domId}
            selectedKey={selectedKey}
            options={options}
            onChange={(_, option) => handleChange(option ? (option.data as string | undefined) : undefined)}
            errorMessage={error}
          />
        );
      }
      case 'Boolean':
        return (
          <Toggle
            id={domId}
            checked={value === true}
            onText="Yes"
            offText="No"
            onChange={(_, checked) => handleChange(checked === true)}
            styles={toggleStyles}
          />
        );
      case 'DateTime':
        return (
          <DatePicker
            id={domId}
            value={typeof value === 'string' ? new Date(value) : value instanceof Date ? value : undefined}
            onSelectDate={(date) => handleChange(date ? date.toISOString() : undefined)}
            allowTextInput
          />
        );
      case 'User':
        // `people` is only absent if a caller forgot to thread it through —
        // degrade to the read-only display rather than rendering a picker
        // that could never search, which would silently look broken.
        return people ? (
          <PersonPickerField id={domId} value={isPerson(value) ? value : undefined} people={people} onChange={handleChange} />
        ) : (
          <PersonDisplay person={isPerson(value) ? value : undefined} />
        );
      default:
        return renderReadValue();
    }
  };

  function renderReadValue(): React.ReactElement {
    if (value === undefined || value === null || value === '') {
      return (
        <span id={domId} className={styles.emptyValue}>
          —
        </span>
      );
    }

    switch (definition.type) {
      case 'Note':
        return (
          <p id={domId} className={styles.noteValue}>
            {typeof value === 'string' ? value : ''}
          </p>
        );
      case 'Choice':
        return typeof value === 'string' ? (
          <span id={domId}>
            <StatusBadge text={value} tone={resolveStatusTone(value)} />
          </span>
        ) : (
          <span id={domId}>—</span>
        );
      case 'Boolean':
        return (
          <span id={domId}>
            <StatusBadge text={value === true ? 'Yes' : 'No'} tone={value === true ? 'success' : 'neutral'} />
          </span>
        );
      case 'DateTime':
        return <span id={domId}>{formatDate(value)}</span>;
      case 'User':
        return (
          <span id={domId}>
            <PersonDisplay person={isPerson(value) ? value : undefined} />
          </span>
        );
      default:
        return <span id={domId}>{String(value)}</span>;
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={domId} className={styles.fieldLabel}>
        {labelOverride ?? definition.displayName}
        {showRequiredAsterisk && mode === 'edit' && <span aria-hidden="true"> *</span>}
      </label>
      {fieldBody()}
    </div>
  );
};

export default FieldRenderer;
