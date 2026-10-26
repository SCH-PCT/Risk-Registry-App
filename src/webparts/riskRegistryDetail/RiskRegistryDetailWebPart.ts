import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneToggle,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'RiskRegistryDetailWebPartStrings';
import { RiskRegistryDetail } from './components/RiskRegistryDetail';
import { IRiskRegistryDetailProps } from './components/IRiskRegistryDetailProps';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { RISK_REGISTRY_DATA } from '../../config/listSchema';
import { ALLOWED_REFRESH_INTERVALS_SECONDS, resolveRefreshIntervalSeconds } from '../../utilities/refreshInterval';
import { parseItemIdFromUrl } from '../../utilities/itemIdentifier';
import { parseSelectedStepFromUrl } from '../../utilities/riskStepParam';
import { parseIsAdminViewFromUrl } from '../../utilities/adminViewParam';
import { PnpRiskRegistryRepository } from '../../data/repositories/pnp/PnpRiskRegistryRepository';
import { PnpRiskActionRepository } from '../../data/repositories/pnp/PnpRiskActionRepository';
import { PnpRiskActivityRepository } from '../../data/repositories/pnp/PnpRiskActivityRepository';
import { PnpRiskUpdateRepository } from '../../data/repositories/pnp/PnpRiskUpdateRepository';
import { PnpRiskAssignmentRepository } from '../../data/repositories/pnp/PnpRiskAssignmentRepository';
import { PnpRiskDocumentRepository } from '../../data/repositories/pnp/PnpRiskDocumentRepository';
import { PnpPeopleRepository } from '../../data/repositories/pnp/PnpPeopleRepository';
import { PnpWebPermissionsService } from '../../data/services/pnp/PnpWebPermissionsService';
import { getSp } from '../../data/services/spContext';
import { IRiskRegistryDetailRepositories } from '../../hooks/useRiskRegistryDetail';

export interface IRiskRegistryDetailWebPartProperties {
  enableAutoRefresh: boolean;
  refreshIntervalSeconds: number;
  showLastRefreshed: boolean;
}

/**
 * Displays and edits one `RiskRegistryData` item.
 *
 * ## Item resolution
 *
 * The item is identified by the `id` query-string parameter on the page
 * this web part is placed on (e.g. `.../SitePages/RiskDetail.aspx?id=482`),
 * not by a property-pane setting — see `utilities/itemIdentifier.ts` for why
 * the SharePoint system ID is used rather than the business `RiskID` field.
 * `onInit` resolves and validates this once; an invalid or missing value
 * renders the handled `invalid-identifier` state without ever constructing a
 * repository or making a network call.
 */
export default class RiskRegistryDetailWebPart extends BaseClientSideWebPart<IRiskRegistryDetailWebPartProperties> {
  private _repositories: IRiskRegistryDetailRepositories | undefined;

  protected onInit(): Promise<void> {
    this._repositories = {
      riskRegistry: new PnpRiskRegistryRepository(this.context),
      actions: new PnpRiskActionRepository(),
      activities: new PnpRiskActivityRepository(),
      updates: new PnpRiskUpdateRepository(),
      assignments: new PnpRiskAssignmentRepository(),
      documents: new PnpRiskDocumentRepository(this.context),
      people: new PnpPeopleRepository(this.context)
    };

    return super.onInit();
  }

  public render(): void {
    const identifierResult = parseItemIdFromUrl(window.location.href);
    const selectedStep = parseSelectedStepFromUrl(window.location.href);
    const isAdminView = parseIsAdminViewFromUrl(window.location.href);

    const props: IRiskRegistryDetailProps = {
      identifierResult,
      selectedStep,
      isAdminView,
      // Non-null: SPFx guarantees `onInit`'s returned promise resolves
      // before the first `render()` call, and `onInit` always sets this.
      repositories: this._repositories!,
      permissions: new PnpWebPermissionsService(getSp(this.context)),
      listTitle: RISK_REGISTRY_DATA.title,
      refreshConfiguration: {
        enabled: this.properties.enableAutoRefresh ?? true,
        intervalSeconds: resolveRefreshIntervalSeconds(this.properties.refreshIntervalSeconds)
      },
      showLastRefreshed: this.properties.showLastRefreshed ?? true
    };

    const element = React.createElement(
      ErrorBoundary,
      { componentName: 'risk detail' },
      React.createElement(RiskRegistryDetail, props)
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
            }
          ]
        }
      ]
    };
  }
}
