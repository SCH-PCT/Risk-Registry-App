import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';

import { IRelatedEntitySectionState } from '../../../models/domain/IRelatedEntitySection';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import styles from './RelatedSection.module.scss';

export interface IRelatedSectionProps<T> {
  readonly title: string;
  readonly state: IRelatedEntitySectionState<T>;
  readonly renderItem: (item: T) => React.ReactNode;
  readonly getKey: (item: T) => string | number;
  readonly emptyMessage?: string;
}

/**
 * One related-entity section (Actions, Activities, Updates, Assignments).
 *
 * `not-configured` is rendered distinctly from `error`: it means this
 * solution has not yet verified the list's schema (see SCHEMA-TODO.md), not
 * that something is broken. Conflating the two would make a known,
 * documented gap look like a bug.
 */
export function RelatedSection<T>({
  title,
  state,
  renderItem,
  getKey,
  emptyMessage = 'Nothing to show yet.'
}: IRelatedSectionProps<T>): React.ReactElement {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.heading}>{title}</h3>

      {state.status === 'loading' && <Spinner size={SpinnerSize.small} label={`Loading ${title.toLowerCase()}…`} />}

      {state.status === 'not-configured' && (
        <EmptyState message={`${title} are not available yet — this list's connection to the risk record has not been verified.`} />
      )}

      {state.status === 'access-denied' && <ErrorState kind="access-denied" />}

      {state.status === 'error' && <ErrorState kind="unknown" />}

      {state.status === 'loaded' && state.items.length === 0 && <EmptyState message={emptyMessage} />}

      {state.status === 'loaded' && state.items.length > 0 && (
        <ul className={styles.list}>
          {state.items.map((item) => (
            <li key={getKey(item)} className={styles.listItem}>
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RelatedSection;
