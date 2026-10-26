import * as React from 'react';
import { NormalPeoplePicker, IPersonaProps } from '@fluentui/react';

import { IPeopleRepository } from '../../../data/repositories/IPeopleRepository';
import { IRiskRegistryPerson } from '../../../models/domain/IRiskRegistryItem';

export interface IPersonPickerFieldProps {
  readonly id: string;
  readonly value: IRiskRegistryPerson | undefined;
  readonly people: IPeopleRepository;
  readonly onChange: (next: IRiskRegistryPerson | undefined) => void;
}

/** A search-result persona, carrying the directory login a pick needs to resolve later — see `IRiskRegistryPerson.loginName`. */
interface IDirectoryPersonaProps extends IPersonaProps {
  readonly loginName: string;
}

function personToPersona(person: IRiskRegistryPerson): IPersonaProps {
  return {
    key: person.loginName ?? String(person.id ?? person.email ?? person.displayName),
    text: person.displayName,
    secondaryText: person.email,
    // Fluent's selected-item chip defaults to hiding the secondary line at this persona size.
    showSecondaryText: true
  };
}

/**
 * Single-person picker for a `RiskRegistryData` Person field — searches the
 * tenant directory (`IPeopleRepository.searchPeople`, Azure Entra ID-backed
 * on SharePoint Online) as the user types, rather than accepting free text.
 *
 * A pick only carries a directory login (`loginName`) until save time, when
 * `resolvePersonFieldsForSave` resolves it to this site's SharePoint user —
 * see that function's doc comment for why a fresh directory result cannot
 * be saved as-is.
 */
export const PersonPickerField: React.FC<IPersonPickerFieldProps> = ({ id, value, people, onChange }) => {
  const selectedItems = value ? [personToPersona(value)] : [];

  const onResolveSuggestions = React.useCallback(
    async (filter: string): Promise<IPersonaProps[]> => {
      if (!filter) {
        return [];
      }
      const results = await people.searchPeople(filter);
      return results.map(
        (result): IDirectoryPersonaProps => ({
          key: result.loginName,
          text: result.displayName,
          secondaryText: result.email,
          showSecondaryText: true,
          loginName: result.loginName
        })
      );
    },
    [people]
  );

  const handleChange = (items?: IPersonaProps[]): void => {
    const picked = items && items[0];
    if (!picked) {
      onChange(undefined);
      return;
    }

    const loginName = (picked as Partial<IDirectoryPersonaProps>).loginName;
    onChange({
      displayName: picked.text ?? '',
      email: picked.secondaryText,
      loginName
    });
  };

  return (
    <NormalPeoplePicker
      inputProps={{ id, 'aria-label': 'Search people in this organization' }}
      onResolveSuggestions={onResolveSuggestions}
      getTextFromItem={(persona) => persona.text ?? ''}
      itemLimit={1}
      selectedItems={selectedItems}
      onChange={handleChange}
      resolveDelay={300}
    />
  );
};

export default PersonPickerField;
