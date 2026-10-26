import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'RiskRegistryListWebPartStrings';
import { RiskRegistryList } from './components/RiskRegistryList';
import { IRiskRegistryListProps } from './components/IRiskRegistryListProps';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { ALLOWED_REFRESH_INTERVALS_SECONDS, resolveRefreshIntervalSeconds } from '../../utilities/refreshInterval';
import { resolveNavigationUrl } from '../../utilities/urlNormalization';
import { PnpRiskRegistryListRepository } from '../../data/repositories/pnp/PnpRiskRegistryListRepository';
import { IRiskRegistryListRepository } from '../../data/repositories/IRiskRegistryListRepository';

export interface IRiskRegistryListWebPartProperties {
  enableAutoRefresh: boolean;
  refreshIntervalSeconds: number;
  showLastRefreshed: boolean;
  /** Raw, untrusted property-pane text — resolved through `resolveNavigationUrl` before ever reaching an `href`. */
  detailPageUrl: string;
}

/**
 * Displays the `RiskRegistryData` list as a KPI-and-card dashboard, per the
 * "Clinical Clarity" design's Risk Registry List screen.
 *
 * Uses the same refresh framework and the same three refresh-related
 * properties (`enableAutoRefresh`, `refreshIntervalSeconds`,
 * `showLastRefreshed`) as the Detail web part — see
 * `RiskRegistryDetailWebPart.ts` for the pattern this mirrors.
 */
export default class RiskRegistryListWebPart extends BaseClientSideWebPart<IRiskRegistryListWebPartProperties> {
  private _repository: IRiskRegistryListRepository | undefined;

  protected onInit(): Promise<void> {
    this._repository = new PnpRiskRegistryListRepository(this.context);
    return super.onInit();
  }

  public render(): void {
    const props: IRiskRegistryListProps = {
      // Non-null: SPFx guarantees `onInit`'s returned promise resolves
      // before the first `render()` call, and `onInit` always sets this.
      repository: this._repository!,
      refreshConfiguration: {
        enabled: this.properties.enableAutoRefresh ?? true,
        intervalSeconds: resolveRefreshIntervalSeconds(this.properties.refreshIntervalSeconds)
      },
      showLastRefreshed: this.properties.showLastRefreshed ?? true,
      detailPageUrl: resolveNavigationUrl(this.properties.detailPageUrl, this.context.pageContext.web.absoluteUrl)
    };

    const element = React.createElement(
      ErrorBoundary,
      { componentName: 'risk registry list' },
      React.createElement(RiskRegistryList, props)
    );

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const intervalOptions: IPropertyPaneDropdownOption[] = ALLOWED_REFRESH_INTERVALS_SECONDS.map((seconds) => ({
      key: seconds,
      text: seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds === 60 ? '' : 's'}`
    }));

    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.RefreshGroupName,
              groupFields: [
                PropertyPaneToggle('enableAutoRefresh', { label: strings.EnableAutoRefreshFieldLabel }),
                PropertyPaneDropdown('refreshIntervalSeconds', {
                  label: strings.RefreshIntervalFieldLabel,
                  options: intervalOptions,
                  disabled: this.properties.enableAutoRefresh === false
                }),
                PropertyPaneToggle('showLastRefreshed', { label: strings.ShowLastRefreshedFieldLabel })
              ]
            },
            {
              groupName: strings.NavigationGroupName,
              groupFields: [
                PropertyPaneTextField('detailPageUrl', {
                  label: strings.DetailPageUrlFieldLabel,
                  description: strings.DetailPageUrlFieldDescription
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
