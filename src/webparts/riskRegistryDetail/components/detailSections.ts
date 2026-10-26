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
 * A group's `templateDownload`/`documentUpload`/`reviewLink`/`relatedDocuments`
 * are **not** `RiskRegistryData` fields — per explicit confirmation, those design
 * elements belong to document libraries (see `IRiskDocumentRepository`), not
 * to this list's schema: `documentUpload`/`relatedDocuments`/`reviewLink`
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
  /** Small pill label shown at the top-right of the group header, e.g. "Clinical Triage". `undefined` renders no badge. */
  readonly badge?: string;
  /** Fluent MDL2 icon name shown at the top-left of the group header. `undefined` renders no icon (matches the design's "Deferment" group, which has none). */
  readonly icon?: string;
  readonly fieldKeys: readonly RiskRegistryDataFieldKey[];
  /** Renders the design's "Need [X] Template?" download panel — a `RiskRegistryDocuments` library action, not a field. */
  readonly templateDownload?: { readonly label: string; readonly fileName: string; /** Collapsed-by-default accordion instead of an always-open panel. */ readonly collapsible?: boolean };
  /** Renders the design's upload dropzone — a `RiskRegistryDocuments` library action, not a field. Rendered standalone unless `relatedDocuments` is also set, in which case it nests at the bottom of that panel instead. */
  readonly documentUpload?: { readonly label: string; readonly helpText: string };
  /** Renders the design's "Review [X] before proceeding" link. Shown under the upload control when both are present. */
  readonly reviewLink?: { readonly label: string };
  /**
   * Renders a "Related Documents" panel listing every file already in the
   * risk's `RiskRegistryDocuments` folder (via the same related-documents
   * state the page's bottom "Documents" section reads from), with this
   * group's `documentUpload` control nested at its bottom when present.
   */
  readonly relatedDocuments?: { readonly label: string };
  /**
   * Where this group's template/related-documents/review-link block renders
   * relative to its fields. `'top'` (the default) matches every existing
   * group's current position, before the fields. `'bottom'` moves the whole
   * block after the fields — used by Step 1's intake group per design.
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

/** Shown in the page header, outside any step card. */
export const HEADER_FIELD_KEYS: readonly RiskRegistryDataFieldKey[] = ['title', 'riskId', 'riskStatus'];

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
        badge: 'eFeedback Standard',
        icon: 'EditNote',
        // `title` (displayed as "Risk Title") also renders in the page
        // header for an existing item (see `HEADER_FIELD_KEYS` above) — both
        // instances edit the same field, per explicit confirmation that
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
        relatedDocuments: { label: 'Related Documents' },
        documentUpload: { label: 'Attach Telemetry or Docs', helpText: 'PDF, DOCX, CSV (Max 25MB)' },
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
        badge: 'Clinical Triage',
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
        badge: 'Executive Council',
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
        badge: 'Executive Decision',
        icon: 'ComplianceAudit',
        fieldKeys: ['vpDetermination', 'justificationOfDetermination']
      },
      {
        id: 'departmental-assignment',
        title: 'Departmental Assignment & Leadership',
        badge: 'Assignment',
        icon: 'ContactCard',
        fieldKeys: ['assignmentType', 'assignedToDepartment', 'assignedToCommitteeDepartmentRep']
      },
      {
        id: 'clinical-assessment-scope',
        title: 'Clinical Assessment Scope',
        badge: 'Quality Assurance',
        icon: 'Shield',
        fieldKeys: ['assessmentType', 'assessmentTypeSpecifyOther', 'assessmentTypeSpecifyDetails']
      },
      {
        id: 'correction-scope',
        title: 'Correction Scope & Systems',
        badge: 'Remediation',
        icon: 'Settings',
        fieldKeys: ['correctionCategory', 'correctionCategorySpecifyOther', 'microSystem', 'mesoSystem']
      },
      {
        id: 'quality-committee',
        title: 'Quality Committee Governance',
        badge: 'Oversight',
        icon: 'Group',
        fieldKeys: ['qualityCommittee', 'qualityCommitteeSpecifyOther']
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
        badge: 'Milestone Track',
        icon: 'Repair',
        fieldKeys: [
          'capCompleteReadyForReview',
          'capReviewStatus',
          'accountableVpCapApproval',
          'capReviewRequestForMoreInfo',
          'vpCapReviewRequestForMoreInfo'
        ],
        templateDownload: { label: 'CAP', fileName: 'CAP Template.docx' },
        documentUpload: { label: 'Upload Draft CAP Document', helpText: 'PDF, DOCX, CSV (Max 25MB)' },
        reviewLink: { label: 'Review CAP' }
      },
      {
        id: 'cap-monthly-update',
        title: 'CAP Monthly Update',
        badge: 'Monthly Cadence',
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
        badge: 'QA Audit',
        icon: 'TaskManager',
        fieldKeys: [
          'assessmentAuditPlanCompleteReadyForReview',
          'assessmentAuditPlanReviewStatus',
          'accountableVpApproval',
          'assessmentAuditPlanRequestForMoreInfo',
          'vpAssessmentAuditRequestForMoreInfo'
        ],
        documentUpload: { label: 'Upload Draft Assessment/Audit Plan', helpText: 'PDF, DOCX, XLSX (Max 25MB)' },
        reviewLink: { label: 'Review Plan' }
      },
      {
        id: 'cap-assessment-monthly-update',
        title: 'Assessment Monthly Updates',
        badge: 'Tracking & Determination',
        icon: 'BarChart4',
        fieldKeys: [
          'assessmentAuditPlanStatus',
          'assessmentAuditRecommendation',
          'assessmentAuditClosureStatus',
          'assessmentAuditClosureRequestForMoreInfo',
          'accountableVpRiskAssignment',
          'accountableVpRequestForMoreInfo',
          'accountableVpDeterminationNote'
        ],
        sectionSubmit: { label: 'Submit Monthly Update', isVisible: (values) => values.assessmentAuditPlanStatus === 'In Progress' }
      },
      {
        id: 'deferment',
        title: 'Deferment',
        badge: 'Governance',
        fieldKeys: [
          'riskAssessmentReviewStatus',
          'riskAssessmentRequestForMoreInfo',
          'accountableVpRiskAssessmentRequestForMoreInfo',
          'eqocRiskAssessmentRequestForMoreInfo'
        ],
        documentUpload: { label: 'Upload Risk Assessment Draft', helpText: 'PDF, DOCX (Max 25MB)' },
        reviewLink: { label: 'Review File' }
      },
      {
        id: 'semi-annual',
        title: 'Semi-Annual Update',
        badge: '6-Month Cycle',
        icon: 'Calendar',
        fieldKeys: [
          'wasTheRiskCorrected',
          'summaryOfCorrection',
          'continuedDefermentRecommended',
          'defermentRecommendationJustification',
          'semiAnnualReviewStatus',
          'correctionType',
          'requestForMoreInformation'
        ],
        sectionSubmit: { label: 'Submit Semi-Annual Assessment' },
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
