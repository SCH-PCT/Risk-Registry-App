import * as React from 'react';
import { IButtonStyles, MessageBar, MessageBarType, DefaultButton } from '@fluentui/react';

import { BUTTON_CORNER_RADIUS } from '../../styles/buttonCornerRadius';

const BUTTON_STYLES: IButtonStyles = { root: { borderRadius: BUTTON_CORNER_RADIUS } };

/**
 * Catches a render-time crash in one Risk Registry component.
 *
 * ## Why every component needs one
 *
 * React 16 and later **unmount the entire tree** when a render throws and nothing catches
 * it. On a SharePoint page hosting several Risk Registry components that means one bad row
 * in the risk list blanks everything beside it. A boundary per component turns a total
 * page failure into one component showing a message.
 *
 * ## What is deliberately not logged
 *
 * `componentDidCatch` receives the error and the component stack. Neither is sent
 * anywhere. A render error on a business component routinely carries record values in
 * the message, and error reporters retain what they are given indefinitely. The stack is
 * written to the browser console only, where it stays on the user's machine and is what a
 * developer actually needs while reproducing.
 *
 * Recovery is a remount via a key bump rather than a page reload, so the rest of the page
 * and any sibling component's state survive.
 */

export interface IErrorBoundaryProps {
  /** Names the failing area, e.g. "site navigation". Appears in the message. */
  readonly componentName: string;
  readonly children?: React.ReactNode;
}

interface IErrorBoundaryState {
  readonly hasError: boolean;
  /** Bumped to force a fresh subtree on retry. */
  readonly resetKey: number;
}

export class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
  public constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  public static getDerivedStateFromError(): Partial<IErrorBoundaryState> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Console only. Never a logger, never telemetry: a render error's message frequently
    // contains the record values that caused it. The console is the one sink that stays
    // on the user's own machine.
    console.error(
      `[RiskRegistry] ${this.props.componentName} failed to render.`,
      error,
      errorInfo.componentStack
    );
  }

  private _handleRetry = (): void => {
    // A key bump remounts this subtree only. Reloading the page would discard every other
    // component's state to recover one.
    this.setState((previous) => ({ hasError: false, resetKey: previous.resetKey + 1 }));
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }

    return (
      <MessageBar
        messageBarType={MessageBarType.error}
        actions={
          <DefaultButton
            text="Try again"
            ariaLabel={`Try loading ${this.props.componentName} again`}
            onClick={this._handleRetry}
            styles={BUTTON_STYLES}
          />
        }
      >
        <strong>{`Something went wrong in the ${this.props.componentName}.`}</strong>
        {/* No error text: it routinely carries record values. */}
        <div>
          The rest of this page is unaffected. Try again, and tell a site owner if it keeps
          happening.
        </div>
      </MessageBar>
    );
  }
}

export default ErrorBoundary;
