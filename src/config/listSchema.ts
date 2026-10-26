/**
 * Central register of every SharePoint list and field the solution touches.
 *
 * RULE: no `$select`, `$filter`, `$expand` or `$orderby` anywhere in src/data may
 * name a column as a string literal. Every column reference resolves through this
 * file, so an unverified column is a compile-time problem rather than a runtime
 * one discovered by a user.
 *
 * List *titles* are configuration and are safe to check in. List *GUIDs* are
 * resolved at runtime from these titles and must never be hard-coded, along with
 * tenant URLs, site URLs, page URLs and user identities.
 *
 * ⚠️ STATUS: `APP_TOP_NAVIGATION` below is NOT verified against this solution's own
 * site. Its four fields (`linkTitle`, `linkUrl`, `parentTitle`, `sortOrder`) are
 * carried over as a **starting assumption** from a different project's verified
 * `appTopNavigation` schema (same list title, different site, different tenant —
 * see CLAUDE.md-style context: this is a port, not a discovery result). Per
 * SCHEMA-TODO.md question #1-4, this must be confirmed by running
 * `scripts/Get-RiskRegistrySchema.ps1` against the real site before production.
 *
 * Because every column reference still goes through `requireField`/`optionalField`,
 * a wrong assumption fails as a handled `invalid-configuration` error in the
 * navigation bar rather than rendering silently wrong data — but it IS an
 * assumption, not a verified fact, and must be treated as such.
 */

/** Marks a mapping that has not been verified against the live site. */
export const UNRESOLVED = '__UNRESOLVED__' as const;

export type UnresolvedField = typeof UNRESOLVED;

/**
 * An internal name that is either verified or explicitly unresolved.
 * Repositories must call `requireField` before putting one in a query.
 */
export type FieldRef = string | UnresolvedField;

export interface IListDefinition {
  /** List title, used to resolve the list GUID at runtime. */
  readonly title: string;
  /** What the solution uses this list for. */
  readonly purpose: string;
  /** Verified internal names, keyed by the logical name used in domain models. */
  readonly fields: Readonly<Record<string, FieldRef>>;
}

/**
 * Fields SharePoint guarantees on every list. These are the only column names in
 * the solution that are safe without discovery.
 */
export const SYSTEM_FIELDS = {
  id: 'Id',
  created: 'Created',
  modified: 'Modified',
  createdBy: 'Author',
  modifiedBy: 'Editor'
} as const;

/**
 * Navigation configuration for the top navigation application customizer.
 *
 * ⚠️ UNVERIFIED on this site — see the file-level warning above and
 * SCHEMA-TODO.md. Ported from a verified `appTopNavigation` shape on a different
 * project's site: `Title`, `URL`, `Parent`, `SortOrder` only — no visibility flag,
 * no open-in-new-tab flag, no audience targeting. If this site's list differs,
 * `requireField` will throw a clear configuration error naming the missing column
 * rather than guessing.
 *
 * ⚠️ `URL` is assumed to be a plain **Text** field, not a SharePoint Hyperlink
 * field — so it is treated as untrusted input and scheme-checked before it ever
 * reaches an `href`. See `utilities/urlNormalization.ts`.
 *
 * ⚠️ `Parent` is assumed to be **Text** matching another row's `Title`, which is
 * assumed NOT unique. Hierarchy is therefore matched on a non-unique string, with
 * ambiguous and circular references handled explicitly rather than guessed at.
 */
export const APP_TOP_NAVIGATION: IListDefinition = {
  title: 'appTopNavigation',
  purpose: 'Top navigation configuration',
  fields: {
    linkTitle: 'Title', // Assumed Text, NOT required — a row can have no display text
    linkUrl: 'URL', // Assumed Text (NOT Hyperlink). Untrusted; validate before href.
    parentTitle: 'Parent', // Assumed Text - matches another row's Title, assumed not unique
    sortOrder: 'SortOrder' // Assumed Number, no decimal setting declared

    // DELIBERATELY ABSENT until verified against this site:
    //   isVisible / isEnabled  no assumed visibility column.
    //   opensInNewTab          no assumed per-link target column.
    //   audience / permissions no assumed audience targeting of any kind.
    // The navigation reads these through `optionalField`, which returns undefined
    // while they are absent. If discovery finds one of these columns on this site,
    // declare it here and the query and mapper pick it up with no other change.
  }
};

// ---------------------------------------------------------------------------
// RiskRegistryData — VERIFIED 2026-10-22
//
// Verified from a live `/_api/web/lists/getbytitle('RiskRegistryData')/fields`
// response against the real site (seattlechildrens.sharepoint.com/sites/RiskRegistry).
// Every internal name, type and choice list below is read from that response.
// Hidden system/computed SharePoint columns (ContentTypeId, _ModerationStatus,
// FileRef, PermMask, etc.) are intentionally not declared — nothing in this
// solution needs them, and declaring unused columns only grows the attack
// surface of `requireField`/`optionalField` for no benefit.
//
// Two identifiers exist on this list and they are NOT interchangeable:
//  - The system `ID` (Counter, always present, always unique) — this is what
//    `sp.web.lists.getByTitle(...).items.getById(id)` resolves against, and is
//    the value this solution uses for routing (see utilities/itemIdentifier.ts).
//  - `RiskID` ("Risk ID", Number, NOT required, NOT indexed, NOT unique-enforced)
//    — a business-facing risk number. It is displayed as data. It is
//    deliberately NOT used to look up the item: a blank or duplicate value
//    would make routing ambiguous or impossible, where the system ID never is.
// ---------------------------------------------------------------------------

/** The SharePoint field shapes this catalog knows how to render and validate. */
export type RiskFieldType = 'Text' | 'Note' | 'Choice' | 'Boolean' | 'Number' | 'User' | 'DateTime';

/**
 * One field's verified shape, rich enough to drive both the generic field
 * renderer and typed validation — per the requirement that validation rules
 * come from SharePoint field metadata, not from hand-written per-field rules.
 */
export interface IRiskFieldDefinition {
  /** Verified internal (static) name. */
  readonly internalName: string;
  /** Verified display name, used as the form label unless localized. */
  readonly displayName: string;
  readonly type: RiskFieldType;
  readonly required: boolean;
  /** Text/Note only. `MaxLength` from the live field, where SharePoint reports one. */
  readonly maxLength?: number;
  /** Choice only. Exact verified choice values, in list order. */
  readonly choices?: readonly string[];
}

// Repeated choice lists, declared once so the five-plus fields that share a
// vocabulary cannot drift from each other by a typo in one copy.
const YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'] as const;
const YES_NO = ['Yes', 'No'] as const;
const PENDING_REQUEST_READY = ['Pending', 'Request for More Information', 'Ready'] as const;
const IN_PROGRESS_COMPLETED = ['In Progress', 'Completed'] as const;
const APPROVED_REQUEST_ADDITIONAL_INFO = ['Approved', 'Request for Additional Information'] as const;

/**
 * Verified field catalog for `RiskRegistryData`, keyed by the logical (camelCase)
 * name used everywhere above the repository layer. This is the single source of
 * truth for both the OData field map (`RISK_REGISTRY_DATA.fields`, derived below)
 * and the validation/rendering metadata the detail web part reads.
 */
export const RISK_REGISTRY_DATA_FIELDS: Readonly<Record<string, IRiskFieldDefinition>> = {
  // --- Step 1: Intake & SBAR documentation ---
  // "Risk Title" is this field — SharePoint's own `Title` column — per
  // explicit confirmation. A separate `RiskTitle` column existed earlier in
  // this catalog under the same "Risk Title" display label; it has been
  // retired here in favor of this one so the app never shows two
  // differently-backed fields under the same label.
  title: { internalName: 'Title', displayName: 'Risk Title', type: 'Text', required: true, maxLength: 255 },
  riskId: { internalName: 'RiskID', displayName: 'Risk ID', type: 'Number', required: false },
  riskStatus: {
    internalName: 'RiskStatus',
    displayName: 'Risk Status',
    type: 'Choice',
    required: false,
    choices: [
      'New',
      'Evaluation',
      'Rejected',
      'Pending Assignment',
      'Deferred Risk Accepted',
      'Assigned In-Progress',
      'Corrected - Monitoring',
      'Corrected - Unmonitored',
      'Corrected - Hard Fix'
    ]
  },
  riskSummary: { internalName: 'RiskSummary', displayName: 'Risk Summary', type: 'Note', required: false },
  summaryOfActionsTakenToDate: {
    internalName: 'SummaryofActionsTakemToDate',
    displayName: 'Summary of Actions Takem To Date',
    type: 'Note',
    required: false
  },
  anticipatedResourceForCorrection: {
    internalName: 'AnticipatedResourceforCorrection',
    displayName: 'Anticipated Resource for Correction',
    type: 'Choice',
    required: false,
    choices: [
      'Clinical Analytics',
      'Nursing Informatics',
      'Provider Informatics',
      'Pharmacy Informatics',
      'Clinical Applications',
      'Clinical Effectiveness (CSW)',
      'Nursing Professional Development',
      'Learning (Grow@SC)',
      'Facilities Management',
      'Planning Design & Construction',
      'Continuous Improvement and Innovation (CII)',
      'Improvement & Innovation Project Management Office',
      'Strategic Sourcing/Contracting',
      'Supply Chain',
      'EVS',
      'Other',
      'N/A'
    ]
  },
  otherResourceForCorrection: {
    internalName: 'OtherResourceforCorrection',
    displayName: 'Other Resource for Correction',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  hasHarmToPatientVisitorWorkforce: {
    internalName: 'HasHarmToPatientVisitorWorkforce',
    displayName: 'Unaddressed risk has resulted in harm to patient, visitor and/or workforce member?',
    type: 'Choice',
    required: false,
    choices: YES_NO_UNKNOWN
  },
  eFeedbackNumber: { internalName: 'eFeedback', displayName: 'eFeedback #', type: 'Number', required: false },
  detailsOfHarm: { internalName: 'DetailsofHarm', displayName: 'Details of Harm', type: 'Note', required: false },
  evaluatorAssigned: {
    internalName: 'EvaluatorAssigned',
    displayName: 'Evaluator Assigned (staff picker)',
    type: 'User',
    required: false
  },
  riskIdentificationMethods: {
    internalName: 'RiskIdentificationMethods',
    displayName: 'Risk Identification Methods',
    type: 'Choice',
    required: false,
    choices: [
      'CQPS Rounding/Observation',
      'Regulatory Agency OFI',
      'eFeedback Theme',
      'Escalation',
      'Internal Quality Indicators',
      'Other'
    ]
  },
  riskIdentificationMethodsSpecifyOther: {
    internalName: 'RiskIdentificationMethods_Specif',
    displayName: 'Risk Identification Methods-Specify Other Source',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  sbarReviewComplete: {
    internalName: 'ReviewandupdateofattachedSBARisc',
    displayName: 'Review and update of attached SBAR is complete?',
    type: 'Boolean',
    required: false
  },

  // --- Step 2: Clinical Evaluation & Risk Assessment ---
  primarySeverityCategory: {
    internalName: 'PrimarySeverityPotentialHarmCate',
    displayName: 'Primary Severity (Potential Harm) Category',
    type: 'Choice',
    required: false,
    choices: ['Patient Harm', 'Workforce Member Harm', 'Visitor Harm', 'Financial Risk', 'Other']
  },
  primarySeverityCategorySpecifyOther: {
    internalName: 'PrimarySeverityPotentialHarmCate0',
    displayName: 'Primary Severity (Potential Harm) Category-Specify Other Severity',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  apparentSystemFailureMode: {
    internalName: 'ApparentSystemFailureMode',
    displayName: 'Apparent System Failure Mode',
    type: 'Choice',
    required: false,
    choices: ['Structure', 'Culture', 'Process', 'Policy & Protocol', 'Technology & Environment']
  },
  evaluatorAssessmentAndRecommendation: {
    internalName: 'EvaluatorAssessmentRecommendatio',
    displayName: 'Evaluator Assessment & Recommendation',
    type: 'Note',
    required: false
  },
  cqpsDetermination: {
    internalName: 'CQPSDetermination',
    displayName: 'CQPS Determination (Drop Down)',
    type: 'Choice',
    required: false,
    choices: ['Approved', 'Rejected']
  },
  riskPriorityRating: {
    internalName: 'RiskPriorityRating',
    displayName: 'Risk Priority Rating (Drop Down)',
    type: 'Choice',
    required: false,
    choices: [
      '1 - Noncompliance',
      '2 - Noncompliance with safety risks',
      '3 - Noncomliance with safety risks that have reached the patient/visitor/workforce',
      '4 - Noncomliance with safety risks that have reached the patient/visitor/workforce and caused harm (temporary or permanent)'
    ]
  },
  riskRatingJustification: {
    internalName: 'RiskRatingJustification',
    displayName: 'Risk Rating Justification',
    type: 'Note',
    required: false
  },
  centerRecommendedNextSteps: {
    internalName: 'CentrRecommendedNextSteps',
    displayName: 'Centr Recommended Next Steps',
    type: 'Note',
    required: false
  },
  riskAssessmentReviewStatus: {
    internalName: 'RiskAssessmentReviewStatus',
    displayName: 'Risk Assessment Review Status',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  riskAssessmentRequestForMoreInfo: {
    internalName: 'RiskAssessmentRequestforMoreInfo',
    displayName: 'Risk Assessment Request for More Information',
    type: 'Note',
    required: false
  },

  // --- Step 3: VP Assignment & Executive Determination ---
  accountableExecutive: {
    internalName: 'AccountableExecutive',
    displayName: 'Accountable Executive',
    type: 'User',
    required: false
  },
  vpDetermination: {
    internalName: 'VPDetermination',
    displayName: 'VP Determination',
    type: 'Choice',
    required: false,
    choices: ['Accepted', 'Deferred']
  },
  justificationOfDetermination: {
    internalName: 'JustificationofDetermination',
    displayName: 'Justification of Determination',
    type: 'Note',
    required: false
  },
  assignmentType: {
    internalName: 'AssignementType',
    displayName: 'Assignement Type',
    type: 'Choice',
    required: false,
    choices: ['Assessment', 'Correction']
  },
  assessmentType: {
    internalName: 'AssesmentType',
    displayName: 'Assesment Type',
    type: 'Choice',
    required: false,
    choices: ['Internal Audit', 'Gap Anlysis', 'ISO Audit', 'Other']
  },
  assessmentTypeSpecifyOther: {
    internalName: 'AssessmentType_SpecifyOther',
    displayName: 'Assessment Type-Specify Other',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  assessmentTypeSpecifyDetails: {
    internalName: 'AssessmentType_SpecifyDetailsfor',
    displayName: 'Assessment Type-Specify Details for Other',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  correctionCategory: {
    internalName: 'CorrectionCategory',
    displayName: 'Correction Category',
    type: 'Choice',
    required: false,
    choices: ['Departmental Directive', 'Microsystem', 'Mesosystem', 'Quality Committee', 'Other']
  },
  correctionCategorySpecifyOther: {
    internalName: 'CorrectionCategory_SpecifyOther',
    displayName: 'Correction Category-Specify Other',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  assignedToDepartment: {
    internalName: 'AssignedtoDepartment',
    displayName: 'Assigned to Department',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  microSystem: {
    internalName: 'MicroSystem',
    displayName: 'Micro System',
    type: 'Choice',
    required: false,
    choices: [
      'CBDC - Inpatient',
      'Cardiology/CSR',
      'CICU',
      'ED',
      'Heart Center - Regional',
      'NICU',
      'Periop',
      'PICU',
      'PBMU'
    ]
  },
  mesoSystem: {
    internalName: 'MesoSystem',
    displayName: 'Meso System',
    type: 'Choice',
    required: false,
    choices: ['Heart Center', 'Cancer and Blood Disorder Center', 'Neurosciences']
  },
  qualityCommittee: {
    internalName: 'QualityCommittee',
    displayName: 'Quality Committee',
    type: 'Choice',
    required: false,
    choices: [
      'Blood Usage',
      'Dialysis',
      'Credentialing & Professional Standards Committee',
      'Departmental Mortality & Morbidity conferences (M&M)',
      'Employee Health & Safety Committee',
      'Emergency Management Leadership Committee',
      'Grievance Committee',
      'Hospital Acquired Conditions (HAC) Steering Committee',
      'Infection Prevention',
      'Medical Executive Committee',
      'Medication Safety',
      'Medication Security',
      'Nutrition',
      'Pain Champions',
      'Patient Safety',
      'Peer Review & Development Committee',
      'Pharmacy & Therapeutics',
      'Restraints & Seclusion',
      'Resuscitation',
      'Safety Leadership Committee',
      'Sedation',
      'Surgical Procedural Performance Improvement and Patient Safety (PIPS)',
      'Solid Organ Transplant',
      'Utilization Review',
      'Quality Improvement Sterring Committee',
      'Workplace Violence Committee',
      'Other:'
    ]
  },
  qualityCommitteeSpecifyOther: {
    internalName: 'QualityCommittee_SpecifyOther',
    displayName: 'Quality Committee-Specify Other',
    type: 'Text',
    required: false,
    maxLength: 255
  },
  assignedToCommitteeDepartmentRep: {
    internalName: 'AssignedtoCommitteeDepartmentRep',
    displayName: 'Assigned to Committee/Department Representative',
    type: 'User',
    required: false
  },
  accountableVpRiskAssignment: {
    internalName: 'AccountableVPRiskAssignment',
    displayName: 'Accountable VP Risk Assignment',
    type: 'Choice',
    required: false,
    choices: ['Risk deferred', 'Correction', 'Request for more information']
  },
  accountableVpRequestForMoreInfo: {
    internalName: 'AccountableVPRequestforMoreInfor',
    displayName: 'Accountable VP Request for More Information',
    type: 'Note',
    required: false
  },
  accountableVpDeterminationNote: {
    internalName: 'AcountableVPDetermination',
    displayName: 'Acountable VP Determination',
    type: 'Note',
    required: false
  },
  accountableVpRiskAssessmentRequestForMoreInfo: {
    internalName: 'AccountableVPRiskAssessmentReque',
    displayName: 'Accountable VP Risk Assessment Request for More Information',
    type: 'Note',
    required: false
  },
  eqocRiskAssessmentRequestForMoreInfo: {
    internalName: 'EQOCRiskAssessmentRequestforMore',
    displayName: 'EQOC Risk Assessment Request for More Information',
    type: 'Note',
    required: false
  },

  // --- Step 4: Correction CAP ---
  capCompleteReadyForReview: {
    internalName: 'CAPCompleteAndReadyForReview',
    displayName: 'CAP Complete and ready for review? (Clck to review CAP document before proceeding)',
    type: 'Boolean',
    required: false
  },
  capReviewStatus: {
    internalName: 'CAPreviewstatus',
    displayName: 'CAP review status',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  capReviewRequestForMoreInfo: {
    internalName: 'CAPReviewRequestforMoreInformati',
    displayName: 'CAP Review Request for More Information',
    type: 'Note',
    required: false
  },
  accountableVpCapApproval: {
    internalName: 'AccountableVPCAPApproval',
    displayName: 'Accountable VP CAP Approval',
    type: 'Choice',
    required: false,
    choices: ['Request for More Information', 'Approved']
  },
  vpCapReviewRequestForMoreInfo: {
    internalName: 'VPCAPReviewRequestforMoreInforma',
    displayName: 'VP CAP Review Request for More Information',
    type: 'Note',
    required: false
  },
  capUpdated: {
    internalName: 'CAPUpdated',
    displayName: 'CAP Updated? (Important: Click to review CAP document before proceeding)',
    type: 'Boolean',
    required: false
  },
  capStatus: {
    internalName: 'CAPStatus',
    displayName: 'CAP Status',
    type: 'Choice',
    required: false,
    choices: IN_PROGRESS_COMPLETED
  },
  summaryOfWorkCompleted: {
    internalName: 'SummaryofWorkCompleted',
    displayName: 'Summary of Work Completed',
    type: 'Note',
    required: false
  },
  escalationsIssuesBarriers: {
    internalName: 'EscalationsIssuesBarriers',
    displayName: 'Escalations/Issues/Barriers',
    type: 'Note',
    required: false
  },
  capClosureStatus: {
    internalName: 'CAPclosurestatus',
    displayName: 'CAP closure status:',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  capClosureRequestForMoreInfo: {
    internalName: 'CAPClosureRequestformoreinformat',
    displayName: 'CAP Closure Request for more information',
    type: 'Note',
    required: false
  },
  capClosureType: {
    internalName: 'CAPClosureType',
    displayName: 'CAP Closure Type',
    type: 'Choice',
    required: false,
    // Verified exactly as stored: the live site's choice list repeats "Closed" as a
    // separate entry from each "Corrected ..." qualifier rather than combining them.
    choices: ['Closed', 'Corrected & Monitored', 'Closed', 'Corrected & Unmonitored', 'Closed', 'Corrected-Hard Fix']
  },
  accountableVpClosureApproval: {
    internalName: 'AccountableVPClosureApproval',
    displayName: 'Accountable VP Closure Approval',
    type: 'Choice',
    required: false,
    choices: APPROVED_REQUEST_ADDITIONAL_INFO
  },
  accountableVpCapClosureRequestForMoreInfo: {
    internalName: 'AccountableVPCAPClosureRequestfo',
    displayName: 'Accountable VP CAP Closure Request for more Information',
    type: 'Note',
    required: false
  },
  eqocApprovalAcceptance: {
    internalName: 'EQOCApprovalAcceptance',
    displayName: 'EQOC Approval/Acceptance: (Only applies once VP approves closure)',
    type: 'Choice',
    required: false,
    choices: ['Approved/Accepted', 'Request for Additional Information']
  },
  eqocMeetingDate: {
    internalName: 'EQOCMeetingDate',
    displayName: 'EQOC Meeting Date',
    type: 'DateTime',
    required: false
  },
  eqocCapClosureRequestForMoreInfo: {
    internalName: 'EQOCCAPClosureRequestformoreinfo',
    displayName: 'EQOC CAP Closure Request for more information',
    type: 'Note',
    required: false
  },
  wasTheRiskCorrected: {
    internalName: 'Wastheriskcorrected',
    displayName: 'Was the risk corrected?',
    type: 'Choice',
    required: false,
    choices: YES_NO
  },
  summaryOfCorrection: {
    internalName: 'SummaryofCorrection',
    displayName: 'Summary of Correction',
    type: 'Note',
    required: false
  },
  correctionType: {
    internalName: 'CorrectinType',
    displayName: 'Correctin Type',
    type: 'Choice',
    required: false,
    choices: ['Closed', 'Corrected & Monitored', 'Closed', 'Corrected & Unmonitored', 'Closed', 'Corrected-Hard Fix']
  },

  // --- Step 4: Assessment ---
  assessmentAuditPlanCompleteReadyForReview: {
    internalName: 'AssessmentAuditPlanCompleteandre',
    displayName: 'Assessment/Audit Plan Complete and ready for review? (Important: Click to review Assessment Plan document before proceeding)',
    type: 'Boolean',
    required: false
  },
  assessmentAuditPlanReviewStatus: {
    internalName: 'AssessmentAuditPlanReviewStatus',
    displayName: 'Assessment/Audit Plan Review Status',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  assessmentAuditPlanRequestForMoreInfo: {
    internalName: 'AssessmentAuditPlanRequestforMor',
    displayName: 'Assessment/Audit Plan Request for More Information',
    type: 'Note',
    required: false
  },
  accountableVpApproval: {
    internalName: 'AccountableVPApproval',
    displayName: 'Accountable VP Approval',
    type: 'Choice',
    required: false,
    choices: APPROVED_REQUEST_ADDITIONAL_INFO
  },
  vpAssessmentAuditRequestForMoreInfo: {
    internalName: 'VPAssessmentAuditRequestforMoreI',
    displayName: 'VP Assessment/Audit Request for More Information',
    type: 'Note',
    required: false
  },
  assessmentAuditPlanStatus: {
    internalName: 'AssessmentAuditPlanStatus',
    displayName: 'Assessment/Audit Plan Status',
    type: 'Choice',
    required: false,
    choices: IN_PROGRESS_COMPLETED
  },
  assessmentAuditRecommendation: {
    internalName: 'AssessmentAuditRecommendationtoA',
    displayName: 'Assessment/Audit Recommendation to Adress Risk',
    type: 'Note',
    required: false
  },
  assessmentAuditClosureStatus: {
    internalName: 'AssessmentAuditClosureStatus',
    displayName: 'Assessment/Audit Closure Status',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  assessmentAuditClosureRequestForMoreInfo: {
    internalName: 'AssessmentAuditClosureRequestfor',
    displayName: 'Assessment/Audit Closure Request for More Information',
    type: 'Note',
    required: false
  },

  // --- Step 4: Deferment ---
  continuedDefermentRecommended: {
    internalName: 'Continueddefermentrecommended',
    displayName: 'Continued deferment recommended?',
    type: 'Choice',
    required: false,
    choices: YES_NO
  },
  defermentRecommendationJustification: {
    internalName: 'DefermentRecommendaionJustificat',
    displayName: 'Deferment Recommendaion Justification',
    type: 'Note',
    required: false
  },

  // --- Semi-annual update ---
  semiAnnualReviewStatus: {
    internalName: 'Semi_annualreviewstatus',
    displayName: 'Semi-annual review status:',
    type: 'Choice',
    required: false,
    choices: PENDING_REQUEST_READY
  },
  requestForMoreInformation: {
    internalName: 'RequestforMoreInformation',
    displayName: 'Request for More Information',
    type: 'Note',
    required: false
  }
} as const;

export type RiskRegistryDataFieldKey = keyof typeof RISK_REGISTRY_DATA_FIELDS;

/** Builds the plain `{logicalName: internalName}` map `IListDefinition.fields` needs. */
function toFieldMap(
  defs: Readonly<Record<string, IRiskFieldDefinition>>
): Readonly<Record<string, FieldRef>> {
  const map: Record<string, FieldRef> = {};
  for (const key of Object.keys(defs)) {
    map[key] = defs[key].internalName;
  }
  return map;
}

export const RISK_REGISTRY_DATA: IListDefinition = {
  title: 'RiskRegistryData',
  purpose: 'Risk registry data — the parent entity for every child list',
  fields: toFieldMap(RISK_REGISTRY_DATA_FIELDS)
};

/** Rich metadata for one `RiskRegistryData` field, or throws if the key is unknown. */
export function getRiskRegistryDataField(logicalName: RiskRegistryDataFieldKey): IRiskFieldDefinition {
  const def = RISK_REGISTRY_DATA_FIELDS[logicalName];
  if (!def) {
    throw new Error(`Field '${logicalName}' is not declared in RISK_REGISTRY_DATA_FIELDS.`);
  }
  return def;
}

// ---------------------------------------------------------------------------
// Child lists — UNRESOLVED. Only RiskRegistryData has been verified so far.
//
// The brief names these as RiskActions, RiskActivities, RiskUpdates,
// RiskAssignments (lists) and RiskRegistryDocuments (a document library,
// grouped by folders named by RiskId). No `/_api/.../fields` response has been
// captured for any of them, and none of their relationships to
// RiskRegistryData (plain column vs. lookup; keyed by the system `ID` vs. the
// `RiskID` business field) has been confirmed. See SCHEMA-TODO.md.
//
// Each is declared with a single UNRESOLVED field so `isListResolved` reports
// false and any repository touching one fails with a clear configuration-error
// state rather than guessing a column name.
// ---------------------------------------------------------------------------

export const RISK_ACTIONS: IListDefinition = {
  title: 'RiskActions',
  purpose: 'Actions related to risks, linked by RiskId (relationship unverified)',
  fields: { riskLink: UNRESOLVED }
};

export const RISK_ACTIVITIES: IListDefinition = {
  title: 'RiskActivities',
  purpose: 'Activities related to risks, linked by RiskId (relationship unverified)',
  fields: { riskLink: UNRESOLVED }
};

export const RISK_UPDATES: IListDefinition = {
  title: 'RiskUpdates',
  purpose: 'Updates related to risks, linked by RiskId (relationship unverified)',
  fields: { riskLink: UNRESOLVED }
};

export const RISK_ASSIGNMENTS: IListDefinition = {
  title: 'RiskAssignments',
  purpose: 'Risk registry assignments, linked by RiskId (relationship unverified)',
  fields: { riskLink: UNRESOLVED }
};

/** Document library. Folder-per-risk convention is unverified — see SCHEMA-TODO.md #27-31. */
export const RISK_REGISTRY_DOCUMENTS: IListDefinition = {
  title: 'RiskRegistryDocuments',
  purpose: 'Documents related to risks, grouped by folders named by RiskId (convention unverified)',
  fields: { riskLink: UNRESOLVED }
};

export const RISK_REGISTRY_LISTS = {
  appTopNavigation: APP_TOP_NAVIGATION,
  riskRegistryData: RISK_REGISTRY_DATA,
  riskActions: RISK_ACTIONS,
  riskActivities: RISK_ACTIVITIES,
  riskUpdates: RISK_UPDATES,
  riskAssignments: RISK_ASSIGNMENTS,
  riskRegistryDocuments: RISK_REGISTRY_DOCUMENTS
} as const;

export type RiskRegistryListKey = keyof typeof RISK_REGISTRY_LISTS;

/**
 * Returns a verified internal name, or throws a configuration error.
 *
 * Repositories call this rather than reading `fields` directly, so an unresolved
 * mapping surfaces as a handled configuration-error state in the UI instead of an
 * opaque SharePoint 400.
 */
export function requireField(list: IListDefinition, logicalName: string): string {
  const value = list.fields[logicalName];

  if (value === undefined) {
    throw new Error(
      `Field '${logicalName}' is not declared for list '${list.title}'. Add it to listSchema.ts.`
    );
  }

  if (value === UNRESOLVED) {
    throw new Error(
      `Field '${logicalName}' on list '${list.title}' has not been verified against the site. ` +
        `Run scripts/Get-RiskRegistrySchema.ps1 and update listSchema.ts. See SCHEMA-TODO.md.`
    );
  }

  return value;
}

/**
 * Returns a verified internal name, or `undefined` when the concept is not declared.
 *
 * This is the counterpart to `requireField`, for columns the solution *supports* but
 * does not *depend on* — a visibility flag being the case that motivated it. Callers
 * add the column to a `$select` only when this returns a name, so the same code path
 * works on a site that has the column and on one that does not.
 *
 * Unlike `requireField`, an undeclared concept is not an error. An UNRESOLVED one still
 * is: that means somebody wrote the mapping down without verifying it, and querying it
 * would produce a SharePoint 400.
 */
export function optionalField(list: IListDefinition, logicalName: string): string | undefined {
  const value = list.fields[logicalName];

  if (value === undefined) {
    return undefined;
  }

  if (value === UNRESOLVED) {
    throw new Error(
      `Field '${logicalName}' on list '${list.title}' is declared but unverified. ` +
        `Remove it or verify it with scripts/Get-RiskRegistrySchema.ps1. See SCHEMA-TODO.md.`
    );
  }

  return value;
}

/** True when every declared field on the list has a verified internal name. */
export function isListResolved(list: IListDefinition): boolean {
  const names = Object.keys(list.fields);
  return names.length > 0 && names.every((n) => list.fields[n] !== UNRESOLVED);
}

/** List keys that are not yet safe to query. Used by the config-error state. */
export function unresolvedLists(): RiskRegistryListKey[] {
  return (Object.keys(RISK_REGISTRY_LISTS) as RiskRegistryListKey[]).filter(
    (key) => !isListResolved(RISK_REGISTRY_LISTS[key])
  );
}
