import * as React from 'react';
import { Icon } from '@fluentui/react';

import { RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { RiskRegistryDraftValues, RiskRegistryFieldErrors } from '../../../models/viewModels/IRiskRegistryEditState';
import { RiskRegistryFieldValue } from '../../../models/domain/IRiskRegistryItem';
import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IPeopleRepository } from '../../../data/repositories/IPeopleRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { IRelatedEntitySectionState } from '../../../models/domain/IRelatedEntitySection';
import { IDetailStep, IFieldGroup } from './detailSections';
import { SectionCard } from './SectionCard';
import { TemplateDownloadPanel } from './TemplateDownloadPanel';
import { DocumentUploadControl } from './DocumentUploadControl';
import { RelatedDocumentsPanel } from './RelatedDocumentsPanel';
import { DerivedApprovalIndicator } from './DerivedApprovalIndicator';
import styles from './StepCard.module.scss';

export interface IStepCardProps {
  readonly step: IDetailStep;
  readonly mode: 'read' | 'edit';
  readonly values: RiskRegistryDraftValues;
  readonly fieldErrors: RiskRegistryFieldErrors;
  readonly onFieldChange?: (key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => void;
  /** The `RiskID` business field value, for the document-library actions below. `undefined` for an unsaved "create new" record. */
  readonly riskBusinessId?: number;
  /** The risk's own SharePoint system `ID`, written to each uploaded file's `RiskId` column. `undefined` alongside `riskBusinessId` for an unsaved record. */
  readonly riskItemId?: number;
  /** Required only if any group declares `templateDownload`/`documentUpload`/`relatedDocuments`. */
  readonly documents?: IRiskDocumentRepository;
  /**
   * The same related-documents state the page's bottom "Documents" section
   * reads from — required only if any group declares `relatedDocuments`.
   * `undefined` for the "create new" flow, where no document folder exists
   * yet (the panel renders its empty state in that case).
   */
  readonly documentsSection?: IRelatedEntitySectionState<IRiskDocument>;
  /**
   * Hides a group's `relatedDocuments` panel (and its paired
   * `templateDownload`, e.g. "Need SBAR Template?") for the "create new"
   * flow — before the item exists, there is no document folder for either
   * to act on. Does not affect groups without `relatedDocuments` (e.g.
   * Step 4's CAP template/upload, which already degrade gracefully
   * without a `riskBusinessId`).
   */
  readonly isCreateMode?: boolean;
  /** Forwarded to a group's `RelatedDocumentsPanel` — refetches `documentsSection` after a successful upload, rename, or delete so the list stays accurate without a manual refresh. */
  readonly onDocumentsChanged?: () => void;
  /** Backs every group's `sectionSubmit` button — the same save/create action as the page's own Save/Submit controls. */
  readonly onSectionSubmit?: () => void;
  readonly isSectionSubmitDisabled?: boolean;
  /** Threaded to every `SectionCard`/`FieldRenderer` for any `User`-type field a group renders — see `FieldRenderer`'s `people` prop. */
  readonly people?: IPeopleRepository;
}

/** The DOM id the header step-indicator pills scroll to. */
export function stepDomId(stepId: string): string {
  return `risk-step-${stepId}`;
}

/** Icon shown in the card header's avatar, matching `WorkflowStepper`'s per-step icon where one exists. */
const STEP_ICON_NAMES: Readonly<Record<string, string>> = {
  intake: 'TextDocument',
  'clinical-evaluation': 'Health',
  'vp-assignment': 'Permissions',
  cap: 'Repair'
};

/**
 * One collapsible card matching the design's "Step N: ..." bars — a light
 * header with an icon badge and a collapse chevron, over a white body.
 *
 * The body renders every one of the step's field groups stacked and always
 * visible, each in its own icon/title-headed sub-card — matching the
 * design, which shows every group (e.g. Step 4's Correction, CAP Monthly
 * Update, Assessment, Assessment Monthly Updates, Deferment, and
 * Semi-Annual Update) at once rather than behind a tab click. Expanded by
 * default, per the design showing every step's content at once; the
 * chevron lets a user collapse a step they are not working on right now.
 */
export const StepCard: React.FC<IStepCardProps> = ({
  step,
  mode,
  values,
  fieldErrors,
  onFieldChange,
  riskBusinessId,
  riskItemId,
  documents,
  documentsSection,
  isCreateMode,
  onDocumentsChanged,
  onSectionSubmit,
  isSectionSubmitDisabled,
  people
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const headingId = `${stepDomId(step.id)}-heading`;

  /**
   * The template-download / related-documents block for one group. Factored
   * out so it can render either before or after the group's fields per
   * `documentActionsPosition` — every existing group keeps its current
   * "before the fields" position; Step 1's intake group is the only one that
   * moves it to the bottom.
   */
  const renderDocumentActions = (group: IFieldGroup): React.ReactNode => {
    if (isCreateMode && group.relatedDocuments) {
      return null;
    }

    return (
    <>
      {group.templateDownload && documents && (
        <TemplateDownloadPanel
          label={group.templateDownload.label}
          fileName={group.templateDownload.fileName}
          documents={documents}
          collapsible={group.templateDownload.collapsible}
        />
      )}

      {group.relatedDocuments && documents ? (
        <RelatedDocumentsPanel
          label={group.relatedDocuments.label}
          documentType={group.relatedDocuments.documentType}
          section={documentsSection}
          upload={group.documentUpload}
          riskBusinessId={riskBusinessId}
          riskItemId={riskItemId}
          documents={documents}
          onDocumentsChanged={onDocumentsChanged}
        />
      ) : (
        group.documentUpload &&
        documents && (
          <DocumentUploadControl
            label={group.documentUpload.label}
            helpText={group.documentUpload.helpText}
            documentType={group.documentUpload.documentType}
            riskBusinessId={riskBusinessId}
            riskItemId={riskItemId}
            documents={documents}
          />
        )
      )}
    </>
    );
  };

  return (
    <section id={stepDomId(step.id)} className={styles.card} aria-labelledby={headingId}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
      >
        <span className={styles.headerText}>
          <span className={styles.iconBadge}>
            <Icon iconName={STEP_ICON_NAMES[step.id] ?? 'Flag'} aria-hidden="true" />
          </span>
          <span className={styles.headerCopy}>
            <span className={styles.stepTitle} id={headingId}>
              {step.stepNumber !== undefined ? `Step ${step.stepNumber}: ${step.title}` : step.title}
            </span>
            {step.description && <span className={styles.stepDescription}>{step.description}</span>}
          </span>
        </span>
        <Icon iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'} className={styles.chevron} aria-hidden="true" />
      </button>

      {isExpanded && (
        <div className={styles.body}>
          {step.groups
            .filter((group) => (group.isVisible ? group.isVisible(values) : true))
            .map((group) => (
              <div key={group.id} className={styles.sectionGroup}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupHeading}>
                    {group.icon && <Icon iconName={group.icon} className={styles.groupIcon} aria-hidden="true" />}
                    <span className={styles.groupTitle}>{group.title}</span>
                  </span>
                </div>

                {group.documentActionsPosition !== 'bottom' && renderDocumentActions(group)}

                <SectionCard group={group} mode={mode} values={values} fieldErrors={fieldErrors} onFieldChange={onFieldChange} people={people} />

                {group.documentActionsPosition === 'bottom' && renderDocumentActions(group)}

                {group.sectionSubmit &&
                  onSectionSubmit &&
                  (group.sectionSubmit.isVisible ? group.sectionSubmit.isVisible(values) : true) && (
                    <button
                      type="button"
                      className={styles.sectionSubmitButton}
                      onClick={onSectionSubmit}
                      disabled={isSectionSubmitDisabled}
                    >
                      <Icon iconName="Send" aria-hidden="true" />
                      {group.sectionSubmit.label}
                    </button>
                  )}

                {group.derivedApproval && (group.derivedApproval.isVisible ? group.derivedApproval.isVisible(values) : true) && (
                  <DerivedApprovalIndicator
                    label={group.derivedApproval.label}
                    description={group.derivedApproval.description}
                    isApproved={group.derivedApproval.computeApproved(values)}
                  />
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
};

export default StepCard;
