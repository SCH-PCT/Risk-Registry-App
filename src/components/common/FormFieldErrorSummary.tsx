import * as React from 'react';
import { MessageBar, MessageBarType, Link } from '@fluentui/react';

export interface IFieldError {
  readonly fieldKey: string;
  readonly label: string;
  readonly message: string;
}

export interface IFormFieldErrorSummaryProps {
  readonly errors: readonly IFieldError[];
  /** Moves keyboard focus to the named field. Required so the summary is operable, not just visible. */
  readonly onFocusField: (fieldKey: string) => void;
}

/**
 * An accessible error summary at the top of the edit form.
 *
 * Each entry is a real, focusable link rather than plain text: a keyboard or
 * screen-reader user can jump straight to the invalid field instead of
 * tabbing through the whole form to find it. `role="alert"` means assistive
 * technology announces the summary as soon as it appears, which is what
 * makes a failed validation attempt discoverable without sighted scanning.
 */
export const FormFieldErrorSummary: React.FC<IFormFieldErrorSummaryProps> = ({ errors, onFocusField }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <MessageBar messageBarType={MessageBarType.severeWarning} role="alert">
      <strong>
        {errors.length === 1
          ? 'There is 1 field that needs attention.'
          : `There are ${errors.length} fields that need attention.`}
      </strong>
      <ul>
        {errors.map((error) => (
          <li key={error.fieldKey}>
            <Link onClick={() => onFocusField(error.fieldKey)}>
              {error.label}: {error.message}
            </Link>
          </li>
        ))}
      </ul>
    </MessageBar>
  );
};

export default FormFieldErrorSummary;
