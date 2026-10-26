import * as React from 'react';
import { Persona, PersonaSize } from '@fluentui/react';

export interface IPersonReference {
  readonly displayName: string;
  readonly email?: string;
}

export interface IPersonDisplayProps {
  readonly person: IPersonReference | undefined;
  /** Shown when the field has no value — a normal, common state for optional People fields. */
  readonly emptyText?: string;
}

/** Compact read-only display for a SharePoint People field value. */
export const PersonDisplay: React.FC<IPersonDisplayProps> = ({ person, emptyText = 'Unassigned' }) => {
  if (!person) {
    return <span>{emptyText}</span>;
  }

  return (
    <Persona
      text={person.displayName}
      secondaryText={person.email}
      size={PersonaSize.size24}
      imageInitials={initialsFrom(person.displayName)}
      hidePersonaDetails={false}
      showSecondaryText
    />
  );
};

function initialsFrom(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

export default PersonDisplay;
