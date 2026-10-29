/**
 * Groups every verified `RiskRegistryData` field into the field groups shown
 * on the Detail web part, mirroring the attached visual design's four
 * numbered steps.
 *
 * This is the one place that decides field layout. The generic field
 * renderer (`FieldRenderer.tsx`) and all validation (`fieldMetadata.ts`)
 * read from the field catalog itself, so this file only ever lists *which*
 * verified field goes in *which* group — it cannot introduce a field the
 * catalog does not already declare, and every key here is checked against
 * the catalog by the TypeScript compiler.
 *
 * Field-to-group placement mirrors the reference design image exactly (per
 * explicit sign-off), which sometimes differs from the simpler "field N
 * belongs to step N" grouping a first read of the schema might suggest —
 * e.g. `accountableExecutive` renders in Step 2's "Governance, Priority &
 * Executive Assignment" group, not Step 3, and the design's "Semi-Annual
 * Update" is the last of several stacked groups inside Step 4 rather than a
 * separate fifth step.
 *
 * A group's `templateDownload`/`documentUpload`/`relatedDocuments`
 * are **not** `RiskRegistryData` fields — per explicit confirmation, those design
 * elements belong to document libraries (see `IRiskDocumentRepository`), not
 * to this list's schema: `documentUpload`/`relatedDocuments`
 * read/write the separate `RiskRegistryDocuments` library, keyed by `RiskID`,
 * while `templateDownload` reads a `Templates` folder in the site's own
 * default document library instead — a different library entirely.
 * `derivedApproval`'s `computeApproved`
 * is, likewise, not a field: no verified column backs a distinct "is this
 * closed" flag for those groups, so it is shown as a read-only status
 * computed from the real approval fields already in the same group, rather
 * than inventing a persisted boolean nothing saves.
 */

import { RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { RiskRegistryDraftValues } from '../../../models/viewModels/IRiskRegistryEditState';

/** One labeled, icon-headed card of fields within a step — e.g. "Clinical Evaluation & CQPS Determination". */
export interface IFieldGroup {
  readonly id: string;
  readonly title: string;
  /** Fluent MDL2 icon name shown at the top-left of the group header. `undefined` renders no icon (matches the design's "Deferment" group, which has none). */
  readonly icon?: string;
  readonly fieldKeys: readonly RiskRegistryDataFieldKey[];
  /**
   * Gates whether this entire group renders at all — distinct from
   * `fieldMetadata.ts`'s per-field `CONDITIONAL_FIELD_RULES`, which only
   * hide individual fields (leaving an empty group shell behind once every
   * field inside it happens to be hidden too). Omitted means always
   * visible.
   */
  readonly isVisible?: (values: RiskRegistryDraftValues) => boolean;
  /** Renders the design's "Need [X] Template?" download panel — a `RiskRegistryDocuments` library action, not a field. */
  readonly templateDownload?: { readonly label: string; readonly fileName: string; /** Collapsed-by-default accordion instead of an always-open panel. */ readonly collapsible?: boolean };
  /** Renders the design's upload button — a `RiskRegistryDocuments` library action, not a field. Rendered standalone unless `relatedDocuments` is also set, in which case it nests at the bottom of that panel instead. */
  readonly documentUpload?: {
    readonly label: string;
    readonly helpText: string;
    /** e.g. "CAP Document" — written to the uploaded file's `DocumentType` column (see `IRiskDocumentUploadMetadata`). */
    readonly documentType: string;
  };
  /**
   * Renders a "Related Documents" panel, filtered to files already in the
   * risk's `RiskRegistryDocuments` folder whose `DocumentType` column equals
   * `documentType` (via the same related-documents state the page's bottom
   * "Documents" section reads from), with this group's `documentUpload`
   * control nested at its bottom when present. `documentType` matches the
   * value `documentUpload` writes on upload (see `IRiskDocumentUploadMetadata`),
   * so a file this group uploaded always shows up in this group's own list —
   * never a different group's, even though every group shares one folder.
   */
  readonly relatedDocuments?: { readonly label: string; readonly documentType: string };
  /**
   * Where this group's template/related-documents block renders relative to
   * its fields. `'top'` (the default) matches every existing group's current
   * position, before the fields. `'bottom'` moves the whole block after the
   * fields — used by Step 1's intake group per design.
   */
  readonly documentActionsPosition?: 'top' | 'bottom';
  /**
   * Renders a "Submit [X]" button that saves the record's current edits —
   * the same action as the page's Save/Submit controls, offered inline for
   * this group. `isVisible` gates the button on another field's value
   * (e.g. only once a status field moves to "In Progress"); omitted means
   * always visible.
   */
  readonly sectionSubmit?: { readonly label: string; readonly isVisible?: (values: RiskRegistryDraftValues) => boolean };
  /**
   * Renders a read-only "X Approved and Closed"-style status, computed from
   * this group's own approval fields. `isVisible` additionally gates
   * whether the indicator renders at all (e.g. only once an unrelated
   * approval chain has also cleared); omitted means always visible.
   */
  readonly derivedApproval?: {
    readonly label: string;
    readonly description: string;
    readonly computeApproved: (values: RiskRegistryDraftValues) => boolean;
    readonly isVisible?: (values: RiskRegistryDraftValues) => boolean;
  };
}

/** One step card in the design — always rendered expanded, with one or more stacked field groups. */
export interface IDetailStep {
  readonly id: string;
  /** `undefined` for the "create new" flow's identification pseudo-step, which the design has no number for. */
  readonly stepNumber?: number;
  readonly title: string;
  /** Short caption shown under the title in the card header. */
  readonly description?: string;
  readonly groups: readonly IFieldGroup[];
}

export const DETAIL_STEPS: readonly IDetailStep[] = [
  {
    id: 'intake',
    stepNumber: 1,
    title: 'Intake & SBAR Documentation',
    description: 'Capture frontline incident details, immediate mitigation, and harm verification.',
    groups: [
      {
        id: 'incident-details',
        title: 'Incident Details & SBAR Summary',
        icon: 'EditNote',
        // `title` (displayed as "Risk Title") also renders in the page
        // header for an existing item (see `RiskRegistryDetail.tsx`'s
        // `titleField`) — both instances edit the same field, per explicit
        // confirmation that
        // "Risk Title" is backed by this one column, not a second one. For
        // a new record, the header's identification step is hidden (see
        // `RiskRegistryDetailNew.tsx`), so this is the only place it shows.
        fieldKeys: [
          'title',
          'riskSummary',
          'summaryOfActionsTakenToDate',
          'hasHarmToPatientVisitorWorkforce',
          // "eFeedback #" and "Details of Harm" are only shown once the
          // harm question above is answered (see `fieldMetadata.ts`'s
          // `CONDITIONAL_FIELD_RULES`), so both sit directly after it.
          'eFeedbackNumber',
          'detailsOfHarm',
          'anticipatedResourceForCorrection',
          'otherResourceForCorrection'
        ],
        templateDownload: { label: 'SBAR', fileName: 'SBAR Template.docx', collapsible: true },
        relatedDocuments: { label: 'Related Documents', documentType: 'SBAR Document' },
        documentUpload: { label: 'Attach Telemetry or Docs', helpText: 'PDF, DOCX, CSV (Max 25MB)', documentType: 'SBAR Document' },
        documentActionsPosition: 'bottom'
      }
    ]
  },
  {
    id: 'clinical-evaluation',
    stepNumber: 2,
    title: 'Clinical Evaluation & Risk Assessment',
    description: 'Review clinical harm, assign severity tier, and determine CQPS priority.',
    groups: [
      {
        id: 'cqps-determination',
        title: 'Clinical Evaluation & CQPS Determination',
        icon: 'CheckList',
        fieldKeys: [
          'evaluatorAssigned',
          'riskIdentificationMethods',
          'riskIdentificationMethodsSpecifyOther',
          'sbarReviewComplete',
          'primarySeverityCategory',
          'primarySeverityCategorySpecifyOther',
          'apparentSystemFailureMode',
          'evaluatorAssessmentAndRecommendation',
          'cqpsDetermination'
        ]
      },
      {
        id: 'governance-priority',
        title: 'Governance, Priority & Executive Assignment',
        icon: 'Shield',
        fieldKeys: ['riskPriorityRating', 'riskRatingJustification', 'centerRecommendedNextSteps', 'accountableExecutive']
      }
    ]
  },
  {
    id: 'vp-assignment',
    stepNumber: 3,
    title: 'VP Assignment & Executive Determination',
    description: 'Executive leadership assignment, departmental routing, and governance scope.',
    groups: [
      {
        id: 'executive-determination',
        title: 'Executive Determination',
        icon: 'ComplianceAudit',
        fieldKeys: ['vpDetermination', 'justificationOfDetermination']
      },
      {
        id: 'departmental-assignment',
        title: 'Departmental Assignment & Leadership',
        icon: 'ContactCard',
        fieldKeys: ['assignmentType', 'assignedToCommitteeDepartmentRep']
      },
      {
        id: 'clinical-assessment-scope',
        title: 'Clinical Assessment Scope',
        icon: 'Shield',
        // Hidden outright (not just its individual fields — see
        // `fieldMetadata.ts`'s `CONDITIONAL_FIELD_RULES`, which already hide
        // every field below unless "Assignement Type" is "Assessment")
        // unless "Assignement Type" is explicitly "Assessment" — including
        // while unset, per explicit requirement that neither scope section
        // shows until a value is chosen.
        isVisible: (values) => values.assignmentType === 'Assessment',
        fieldKeys: ['assessmentType', 'assessmentTypeSpecifyOther', 'assessmentTypeSpecifyDetails']
      },
      {
        id: 'correction-scope',
        title: 'Correction Scope & Systems',
        icon: 'Settings',
        // Mirrors `clinical-assessment-scope`'s `isVisible` above — visible
        // only once "Assignement Type" is explicitly "Correction".
        isVisible: (values) => values.assignmentType === 'Correction',
        // "Assigned to Department" and the former "Quality Committee
        // Governance" section's two fields (`qualityCommittee`,
        // `qualityCommitteeSpecifyOther`) moved here per explicit
        // confirmation — all three already only show once "Correction
        // Category" has the one specific value each depends on (see
        // `CONDITIONAL_FIELD_RULES`), so they belong with the rest of this
        // section's correction-category-driven fields rather than in their
        // old, now-deleted groups.
        fieldKeys: [
          'correctionCategory',
          'assignedToDepartment',
          'correctionCategorySpecifyOther',
          'microSystem',
          'mesoSystem',
          'qualityCommittee',
          'qualityCommitteeSpecifyOther'
        ]
      }
    ]
  },
  {
    id: 'cap',
    stepNumber: 4,
    title: 'Action & Corrective Action Plan (CAP)',
    description: 'Remediation milestones, assessment governance, semi-annual tracking, and formal closure.',
    groups: [
      {
        id: 'cap-correction',
        title: 'Correction',
        icon: 'Repair',
        fieldKeys: [
          'capCompleteReadyForReview',
          'capReviewStatus',
          'accountableVpCapApproval',
          'capReviewRequestForMoreInfo',
          'vpCapReviewRequestForMoreInfo',
          'correctionCategorySpecifyOther2'
        ],
        templateDownload: { label: 'CAP', fileName: 'CAP Template.docx', collapsible: true },
        relatedDocuments: { label: 'CAP Document', documentType: 'CAP Document' },
        documentUpload: { label: 'Upload Draft CAP Document', helpText: 'PDF, DOCX, CSV (Max 25MB)', documentType: 'CAP Document' }
      },
      {
        id: 'cap-monthly-update',
        title: 'CAP Monthly Update',
        icon: 'History',
        fieldKeys: [
          'capUpdated',
          'capStatus',
          'summaryOfWorkCompleted',
          'escalationsIssuesBarriers',
          'capClosureStatus',
          'capClosureType',
          'capClosureRequestForMoreInfo',
          'accountableVpClosureApproval',
          'accountableVpCapClosureRequestForMoreInfo',
          'eqocApprovalAcceptance',
          'eqocMeetingDate',
          'eqocCapClosureRequestForMoreInfo'
        ],
        sectionSubmit: { label: 'Submit Monthly Update', isVisible: (values) => values.capStatus === 'In Progress' },
        derivedApproval: {
          label: 'CAP Approved and Closed',
          description: 'Executive confirmation of remediation completion',
          // Choice values as actually defined in listSchema.ts — `capClosureStatus`
          // has no "Approved" option, its "complete" value is "Ready"; `eqocApprovalAcceptance`'s
          // is "Approved/Accepted", not "Approved".
          computeApproved: (values) =>
            values.capClosureStatus === 'Ready' &&
            values.accountableVpClosureApproval === 'Approved' &&
            values.eqocApprovalAcceptance === 'Approved/Accepted'
        }
      },
      {
        id: 'cap-assessment',
        title: 'Assessment',
        icon: 'TaskManager',
        fieldKeys: [
          'assessmentAuditPlanCompleteReadyForReview',
          'assessmentAuditPlanReviewStatus',
          'accountableVpApproval',
          'assessmentAuditPlanRequestForMoreInfo',
          'vpAssessmentAuditRequestForMoreInfo'
        ],
        relatedDocuments: { label: 'Assessment/Audit Plan', documentType: 'Assessment/Audit Plan' },
        documentUpload: { label: 'Upload Draft Assessment/Audit Plan', helpText: 'PDF, DOCX, XLSX (Max 25MB)', documentType: 'Assessment/Audit Plan' }
      },
      {
        id: 'cap-assessment-monthly-update',
        title: 'Assessment Monthly Updates',
        icon: 'BarChart4',
        fieldKeys: [
          'assessmentAuditPlanStatus',
          'assessmentAuditRecommendation',
          'assessmentAuditClosureStatus',
          'assessmentAuditClosureRequestForMoreInfo',
          'accountableVpRiskAssignment',
          'accountableVpRequestForMoreInfo',
          'accountableVpDeterminationNote',
          'escalationsIssuesBarriers2',
          'summaryOfWorkCompleted2'
        ],
        sectionSubmit: { label: 'Submit Monthly Update', isVisible: (values) => values.assessmentAuditPlanStatus === 'In Progress' }
      },
      {
        id: 'deferment',
        title: 'Deferment',
        fieldKeys: [
          'riskAssessmentReviewStatus',
          'riskAssessmentRequestForMoreInfo',
          'accountableVpRiskAssessmentRequestForMoreInfo',
          'eqocRiskAssessmentRequestForMoreInfo',
          'accountableVpApproval2',
          'eqocApprovalAcceptance0',
          'eqocMeetingDate2'
        ],
        relatedDocuments: { label: 'Risk Assessment Draft', documentType: 'Risk Assessment' },
        documentUpload: { label: 'Upload Risk Assessment Draft', helpText: 'PDF, DOCX (Max 25MB)', documentType: 'Risk Assessment' }
      },
      {
        id: 'semi-annual',
        title: 'Semi-Annual Update',
        icon: 'Calendar',
        fieldKeys: [
          'wasTheRiskCorrected',
          'summaryOfCorrection',
          'continuedDefermentRecommended',
          'defermentRecommendationJustification',
          'semiAnnualReviewStatus',
          'correctionType',
          'requestForMoreInformation',
          'accountableVpApproval3',
          'accountableVpRiskAssessmentRequestForMoreInfo2',
          'eqocApprovalAcceptance1',
          'eqocMeetingDate3',
          'eqocRiskAssessmentRequestForMoreInfo2'
        ],
        relatedDocuments: { label: 'Semi-Annual Update', documentType: 'Semi-Annual Update' },
        documentUpload: {
          label: 'Upload Semi-Annual Update Document',
          helpText: 'PDF, DOCX (Max 25MB)',
          documentType: 'Semi-Annual Update'
        },
        derivedApproval: {
          label: 'Correction Approved & Risk Closed',
          description: 'Executive Council formal verification and closure signoff',
          // `wasTheRiskCorrected` is Choice Yes/No, not Boolean; `semiAnnualReviewStatus`'s
          // "complete" value is "Ready" (its choices have no "Approved").
          computeApproved: (values) => values.wasTheRiskCorrected === 'Yes' && values.semiAnnualReviewStatus === 'Ready',
          // Only shown once the (cross-group) EQOC approval has also cleared
          // and continued deferment is recommended — per explicit sign-off,
          // distinct from `computeApproved`'s own approved/not-approved state.
          isVisible: (values) => values.eqocApprovalAcceptance === 'Approved/Accepted' && values.continuedDefermentRecommended === 'Yes'
        }
      }
    ]
  }
];
