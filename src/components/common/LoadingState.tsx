import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';

export interface ILoadingStateProps {
  readonly label?: string;
}

/** Full loading state, shown only when there is no usable data to display yet. */
export const LoadingState: React.FC<ILoadingStateProps> = ({ label = 'Loading…' }) => (
  <div role="status" aria-live="polite">
    <Spinner size={SpinnerSize.large} label={label} ariaLive="assertive" />
  </div>
);

export default LoadingState;
