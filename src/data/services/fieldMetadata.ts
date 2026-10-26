/**
 * Typed validation rules derived from `RiskRegistryData`'s verified field
 * metadata (`config/listSchema.ts`), per the requirement that the edit form
 * validate from SharePoint field metadata rather than a hand-written,
 * independently-maintained rule set that could drift from the real schema.
 *
 * Every rule below reads directly from `IRiskFieldDefinition` — `required`,
 * `maxLength`, `choices`, `type` — so a schema correction (e.g. discovery
 * finds a field is actually required) changes validation automatically
 * rather than needing a second edit here.
 */

import {
  getRiskRegistryDataField,
  IRiskFieldDefinition,
  RISK_REGISTRY_DATA_FIELDS,
  RiskRegistryDataFieldKey
} from '../../config/listSchema';
import { IRiskRegistryPerson, RiskRegistryFieldValue } from '../../models/domain/IRiskRegistryItem';
import { RiskRegistryDraftValues, RiskRegistryFieldErrors } from '../../models/viewModels/IRiskRegistryEditState';

function isEmptyValue(value: RiskRegistryFieldValue): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

function isPersonValue(value: RiskRegistryFieldValue): value is IRiskRegistryPerson {
  return typeof value === 'object' && value !== null && 'displayName' in value;
}

/**
 * Validates one field's draft value against its verified metadata.
 *
 * Returns a user-facing message, or `undefined` when the value is valid.
 * Never throws on a malformed value — a field in an unexpected shape is
 * reported as invalid, not a crash, since it can originate from stale data
 * as easily as from a UI bug.
 */
export function validateFieldValue(key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue): string | undefined {
  const definition = getRiskRegistryDataField(key);

  if (definition.required && isEmptyValue(value)) {
    return `${definition.displayName} is required.`;
  }

  if (isEmptyValue(value)) {
    // Optional and empty: nothing further to check.
    return undefined;
  }

  switch (definition.type) {
    case 'Text':
    case 'Note':
      return validateTextValue(definition, value);
    case 'Number':
      return validateNumberValue(definition, value);
    case 'Choice':
      return validateChoiceValue(definition, value);
    case 'Boolean':
      return validateBooleanValue(definition, value);
    case 'DateTime':
      return validateDateValue(definition, value);
    case 'User':
      return validateUserValue(definition, value);
    default:
      return undefined;
  }
}

function validateTextValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (typeof value !== 'string') {
    return `${definition.displayName} must be text.`;
  }
  if (definition.maxLength !== undefined && value.length > definition.maxLength) {
    return `${definition.displayName} must be ${definition.maxLength} characters or fewer.`;
  }
  return undefined;
}

function validateNumberValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${definition.displayName} must be a number.`;
  }
  return undefined;
}

function validateChoiceValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (typeof value !== 'string') {
    return `${definition.displayName} must be one of the listed choices.`;
  }
  if (definition.choices && definition.choices.indexOf(value) === -1) {
    return `${definition.displayName} must be one of the listed choices.`;
  }
  return undefined;
}

function validateBooleanValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (typeof value !== 'boolean') {
    return `${definition.displayName} must be Yes or No.`;
  }
  return undefined;
}

function validateDateValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return `${definition.displayName} must be a valid date.`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${definition.displayName} must be a valid date.`;
  }
  return undefined;
}

function validateUserValue(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): string | undefined {
  if (!isPersonValue(value)) {
    return `${definition.displayName} must be a person.`;
  }
  return undefined;
}

/** Validates every declared field in `draft`. Fields absent from `draft` are not validated. */
export function validateDraft(draft: RiskRegistryDraftValues): RiskRegistryFieldErrors {
  const errors: RiskRegistryFieldErrors = {};

  for (const key of Object.keys(draft) as RiskRegistryDataFieldKey[]) {
    const message = validateFieldValue(key, draft[key]);
    if (message) {
      errors[key] = message;
    }
  }

  return errors;
}

/** Validates every field the catalog declares as required, even if absent from `draft` entirely. */
export function validateRequiredFieldsPresent(draft: RiskRegistryDraftValues): RiskRegistryFieldErrors {
  const errors: RiskRegistryFieldErrors = {};

  for (const key of Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]) {
    const definition = RISK_REGISTRY_DATA_FIELDS[key];
    if (!definition.required) {
      continue;
    }
    const message = validateFieldValue(key, draft[key]);
    if (message) {
      errors[key] = message;
    }
  }

  return errors;
}

/**
 * Declarative conditional visibility/required rules — fields whose
 * visibility and/or requiredness depends on another field's current value,
 * rather than being a static fact from the verified SharePoint schema
 * (every field below is `required: false` in `listSchema.ts`; conditional
 * requiredness is app-level business logic layered on top). Centralized
 * here so the Detail web part's field layout (`SectionCard.tsx`, via
 * `isFieldVisible`/`isFieldConditionallyRequired`), the save-time
 * validation below, and the live per-keystroke revalidation in
 * `useRiskRegistryDetail.ts`/`useRiskRegistryCreate.ts` (via
 * `getConditionalFieldKeysAffectedBy`) all share one rule per field instead
 * of three independently-maintained copies that could drift.
 */
interface IConditionalFieldRule {
  /** The other field(s) this rule's condition reads — plural since a few rules (e.g. `correctionType`) read two. */
  readonly dependsOn: readonly RiskRegistryDataFieldKey[];
  /** True once the dependent field should be shown (and, unless `isRequiredWhenApplicable` is `false`, required). */
  readonly isApplicable: (draft: RiskRegistryDraftValues) => boolean;
  /** `false` for fields that are only conditionally *visible*, never conditionally required (e.g. "eFeedback #"). Defaults to `true`. */
  readonly isRequiredWhenApplicable?: boolean;
  /** Plain-English condition, used in the "X is required when ..." validation message. */
  readonly conditionDescription: string;
}

const CONDITIONAL_FIELD_RULES: Partial<Record<RiskRegistryDataFieldKey, IConditionalFieldRule>> = {
  // --- Step 1 ---
  otherResourceForCorrection: {
    dependsOn: ['anticipatedResourceForCorrection'],
    isApplicable: (draft) => draft.anticipatedResourceForCorrection === 'Other',
    conditionDescription: 'Anticipated Resource for Correction is "Other"'
  },
  eFeedbackNumber: {
    dependsOn: ['hasHarmToPatientVisitorWorkforce'],
    isApplicable: (draft) => draft.hasHarmToPatientVisitorWorkforce === 'Yes',
    isRequiredWhenApplicable: false,
    conditionDescription: 'harm is reported as "Yes"'
  },
  detailsOfHarm: {
    dependsOn: ['hasHarmToPatientVisitorWorkforce'],
    isApplicable: (draft) =>
      draft.hasHarmToPatientVisitorWorkforce === 'Yes' || draft.hasHarmToPatientVisitorWorkforce === 'Unknown',
    isRequiredWhenApplicable: false,
    conditionDescription: 'harm is reported as "Yes" or "Unknown"'
  },
  riskIdentificationMethodsSpecifyOther: {
    dependsOn: ['riskIdentificationMethods'],
    isApplicable: (draft) => draft.riskIdentificationMethods === 'Other',
    conditionDescription: 'Risk Identification Methods is "Other"'
  },
  primarySeverityCategorySpecifyOther: {
    dependsOn: ['primarySeverityCategory'],
    isApplicable: (draft) => draft.primarySeverityCategory === 'Other',
    conditionDescription: 'Primary Severity (Potential Harm) Category is "Other"'
  },

  // --- Step 3 ---
  assessmentType: {
    dependsOn: ['assignmentType'],
    isApplicable: (draft) => draft.assignmentType === 'Assessment',
    conditionDescription: 'Assignement Type is "Assessment"'
  },
  correctionCategory: {
    dependsOn: ['assignmentType'],
    isApplicable: (draft) => draft.assignmentType === 'Correction',
    conditionDescription: 'Assignement Type is "Correction"'
  },
  assessmentTypeSpecifyOther: {
    dependsOn: ['assessmentType'],
    isApplicable: (draft) => draft.assessmentType === 'Other',
    conditionDescription: 'Assesment Type is "Other"'
  },
  assessmentTypeSpecifyDetails: {
    dependsOn: ['assessmentType'],
    isApplicable: (draft) => draft.assessmentType === 'Other',
    conditionDescription: 'Assesment Type is "Other"'
  },
  correctionCategorySpecifyOther: {
    dependsOn: ['correctionCategory'],
    isApplicable: (draft) => draft.correctionCategory === 'Other',
    conditionDescription: 'Correction Category is "Other"'
  },
  assignedToDepartment: {
    dependsOn: ['correctionCategory'],
    isApplicable: (draft) => draft.correctionCategory === 'Departmental Directive',
    conditionDescription: 'Correction Category is "Departmental Directive"'
  },
  microSystem: {
    dependsOn: ['correctionCategory'],
    isApplicable: (draft) => draft.correctionCategory === 'Microsystem',
    conditionDescription: 'Correction Category is "Microsystem"'
  },
  mesoSystem: {
    dependsOn: ['correctionCategory'],
    isApplicable: (draft) => draft.correctionCategory === 'Mesosystem',
    conditionDescription: 'Correction Category is "Mesosystem"'
  },
  qualityCommittee: {
    dependsOn: ['correctionCategory'],
    isApplicable: (draft) => draft.correctionCategory === 'Quality Committee',
    conditionDescription: 'Correction Category is "Quality Committee"'
  },
  // The verified choice's literal value is `"Other:"` (with a trailing
  // colon) — see `listSchema.ts`'s `qualityCommittee.choices`.
  qualityCommitteeSpecifyOther: {
    dependsOn: ['qualityCommittee'],
    isApplicable: (draft) => draft.qualityCommittee === 'Other:',
    conditionDescription: 'Quality Committee is "Other"'
  },

  // --- Step 4: Correction CAP ---
  capReviewRequestForMoreInfo: {
    dependsOn: ['capReviewStatus'],
    isApplicable: (draft) => draft.capReviewStatus === 'Request for More Information',
    conditionDescription: 'CAP review status is "Request for More Information"'
  },
  // `accountableVpCapApproval`'s own verified choices spell this
  // `"Request for More Information"` (capital M, I) — unlike the similarly
  // named `accountableVpClosureApproval`/`accountableVpApproval`, which
  // instead use `"Request for Additional Information"` (see below).
  vpCapReviewRequestForMoreInfo: {
    dependsOn: ['accountableVpCapApproval'],
    isApplicable: (draft) => draft.accountableVpCapApproval === 'Request for More Information',
    conditionDescription: 'Accountable VP CAP Approval is "Request for More Information"'
  },
  summaryOfWorkCompleted: {
    dependsOn: ['capStatus'],
    isApplicable: (draft) => draft.capStatus === 'In Progress',
    conditionDescription: 'CAP Status is "In Progress"'
  },
  escalationsIssuesBarriers: {
    dependsOn: ['capStatus'],
    isApplicable: (draft) => draft.capStatus === 'In Progress',
    conditionDescription: 'CAP Status is "In Progress"'
  },
  capClosureStatus: {
    dependsOn: ['capStatus'],
    isApplicable: (draft) => draft.capStatus === 'In Progress',
    conditionDescription: 'CAP Status is "In Progress"'
  },
  capClosureRequestForMoreInfo: {
    dependsOn: ['capClosureStatus'],
    isApplicable: (draft) => draft.capClosureStatus === 'Request for More Information',
    conditionDescription: 'CAP closure status is "Request for More Information"'
  },
  capClosureType: {
    dependsOn: ['capClosureStatus'],
    isApplicable: (draft) => draft.capClosureStatus === 'Ready',
    conditionDescription: 'CAP closure status is "Ready"'
  },
  // `accountableVpClosureApproval`'s verified choices are `"Approved"` /
  // `"Request for Additional Information"` — not `"...more information"`.
  accountableVpCapClosureRequestForMoreInfo: {
    dependsOn: ['accountableVpClosureApproval'],
    isApplicable: (draft) => draft.accountableVpClosureApproval === 'Request for Additional Information',
    conditionDescription: 'Accountable VP Closure Approval is "Request for Additional Information"'
  },
  eqocMeetingDate: {
    dependsOn: ['eqocApprovalAcceptance'],
    isApplicable: (draft) => draft.eqocApprovalAcceptance === 'Approved/Accepted',
    conditionDescription: 'EQOC Approval/Acceptance is "Approved/Accepted"'
  },
  // `eqocApprovalAcceptance`'s verified choices are `"Approved/Accepted"` /
  // `"Request for Additional Information"`.
  eqocCapClosureRequestForMoreInfo: {
    dependsOn: ['eqocApprovalAcceptance'],
    isApplicable: (draft) => draft.eqocApprovalAcceptance === 'Request for Additional Information',
    conditionDescription: 'EQOC Approval/Acceptance is "Request for Additional Information"'
  },

  // --- Step 4: Assessment ---
  assessmentAuditPlanRequestForMoreInfo: {
    dependsOn: ['assessmentAuditPlanReviewStatus'],
    isApplicable: (draft) => draft.assessmentAuditPlanReviewStatus === 'Request for More Information',
    conditionDescription: 'Assessment/Audit Plan Review Status is "Request for More Information"'
  },
  // `accountableVpApproval`'s verified choices are `"Approved"` /
  // `"Request for Additional Information"`.
  vpAssessmentAuditRequestForMoreInfo: {
    dependsOn: ['accountableVpApproval'],
    isApplicable: (draft) => draft.accountableVpApproval === 'Request for Additional Information',
    conditionDescription: 'Accountable VP Approval is "Request for Additional Information"'
  },
  assessmentAuditRecommendation: {
    dependsOn: ['assessmentAuditPlanStatus'],
    isApplicable: (draft) => draft.assessmentAuditPlanStatus === 'Completed',
    conditionDescription: 'Assessment/Audit Plan Status is "Completed"'
  },
  assessmentAuditClosureRequestForMoreInfo: {
    dependsOn: ['assessmentAuditClosureStatus'],
    isApplicable: (draft) => draft.assessmentAuditClosureStatus === 'Request for More Information',
    conditionDescription: 'Assessment/Audit Closure Status is "Request for More Information"'
  },
  // `accountableVpRiskAssignment`'s own verified choices spell this
  // `"Request for more information"` (lowercase) — unlike every
  // `...ApprovalStatus`-style Choice field above, which use
  // `"Request for More Information"`/`"Request for Additional Information"`.
  accountableVpRequestForMoreInfo: {
    dependsOn: ['accountableVpRiskAssignment'],
    isApplicable: (draft) => draft.accountableVpRiskAssignment === 'Request for more information',
    conditionDescription: 'Accountable VP Risk Assignment is "Request for more information"'
  },
  accountableVpDeterminationNote: {
    dependsOn: ['accountableVpRiskAssignment'],
    isApplicable: (draft) => draft.accountableVpRiskAssignment === 'Risk deferred' || draft.accountableVpRiskAssignment === 'Correction',
    conditionDescription: 'Accountable VP Risk Assignment is "Risk deferred" or "Correction"'
  },

  // --- Step 4: Deferment ---
  riskAssessmentRequestForMoreInfo: {
    dependsOn: ['riskAssessmentReviewStatus'],
    isApplicable: (draft) => draft.riskAssessmentReviewStatus === 'Request for More Information',
    conditionDescription: 'Risk Assessment Review Status is "Request for More Information"'
  },
  accountableVpRiskAssessmentRequestForMoreInfo: {
    dependsOn: ['accountableVpApproval'],
    isApplicable: (draft) => draft.accountableVpApproval === 'Request for Additional Information',
    conditionDescription: 'Accountable VP Approval is "Request for Additional Information"'
  },
  eqocRiskAssessmentRequestForMoreInfo: {
    dependsOn: ['eqocApprovalAcceptance'],
    isApplicable: (draft) => draft.eqocApprovalAcceptance === 'Request for Additional Information',
    conditionDescription: 'EQOC Approval/Acceptance is "Request for Additional Information"'
  },

  // --- Semi-Annual Update ---
  summaryOfCorrection: {
    dependsOn: ['wasTheRiskCorrected'],
    isApplicable: (draft) => draft.wasTheRiskCorrected === 'Yes',
    conditionDescription: 'Was the risk corrected? is "Yes"'
  },
  requestForMoreInformation: {
    dependsOn: ['semiAnnualReviewStatus'],
    isApplicable: (draft) => draft.semiAnnualReviewStatus === 'Request for More Information',
    conditionDescription: 'Semi-annual review status is "Request for More Information"'
  },
  correctionType: {
    dependsOn: ['semiAnnualReviewStatus', 'wasTheRiskCorrected'],
    isApplicable: (draft) => draft.semiAnnualReviewStatus === 'Ready' && draft.wasTheRiskCorrected === 'Yes',
    conditionDescription: 'Semi-annual review status is "Ready" and Was the risk corrected? is "Yes"'
  }
};

/** True when `key`'s rule (if any) says it should currently be shown. Fields without a rule are always visible. */
export function isFieldVisible(key: RiskRegistryDataFieldKey, draft: RiskRegistryDraftValues): boolean {
  const rule = CONDITIONAL_FIELD_RULES[key];
  return rule ? rule.isApplicable(draft) : true;
}

/**
 * Returns `draft` with every currently-hidden conditional field's value
 * cleared to `undefined` — e.g. picking "Other" then changing one's mind
 * leaves a stale "Specify Other" value behind that the field no longer
 * shows.
 *
 * Re-checks visibility against the progressively-cleared draft, looping to
 * a fixed point, so a multi-level chain cascades correctly: e.g. switching
 * "Assignement Type" away from "Correction" hides "Correction Category",
 * which must in turn blank "Quality Committee" (visible only for a specific
 * Correction Category value, now gone) and then "Quality Committee-Specify
 * Other" (visible only for a specific Quality Committee value, also now
 * gone) — three levels deep, from one top-level change. The rule graph has
 * no cycles, so this always terminates (bounded by the deepest chain).
 *
 * Called at save/create time, right before validating and building the
 * update payload: `riskRegistryMapper.ts`'s `mapFieldToDto` turns
 * `undefined` into `null`, so a cleared field is actually blanked out in
 * SharePoint rather than silently left with its last value.
 */
export function clearHiddenFieldValues(draft: RiskRegistryDraftValues): RiskRegistryDraftValues {
  let cleared: RiskRegistryDraftValues = { ...draft };
  let changedThisPass = true;
  while (changedThisPass) {
    changedThisPass = false;
    for (const key of Object.keys(CONDITIONAL_FIELD_RULES) as RiskRegistryDataFieldKey[]) {
      if (cleared[key] !== undefined && !isFieldVisible(key, cleared)) {
        cleared = { ...cleared, [key]: undefined };
        changedThisPass = true;
      }
    }
  }
  return cleared;
}

/**
 * The required-asterisk override for `key`, or `undefined` to fall back to
 * its static `listSchema.ts` `required` flag — matches `FieldRenderer`'s
 * `isRequired` prop contract. Visibility-only rules
 * (`isRequiredWhenApplicable: false`) never override requiredness.
 */
export function isFieldConditionallyRequired(key: RiskRegistryDataFieldKey, draft: RiskRegistryDraftValues): boolean | undefined {
  const rule = CONDITIONAL_FIELD_RULES[key];
  if (!rule || rule.isRequiredWhenApplicable === false) {
    return undefined;
  }
  return rule.isApplicable(draft);
}

/**
 * Every rule-bearing field that needs re-validating when `changedKey` just
 * changed: `changedKey` itself (if it has a rule) plus every field whose
 * rule depends on `changedKey` — e.g. changing "Correction Category" must
 * re-check "Correction Category-Specify Other", "Assigned to Department",
 * "Micro System", "Meso System", and "Quality Committee" all at once.
 */
export function getConditionalFieldKeysAffectedBy(changedKey: RiskRegistryDataFieldKey): RiskRegistryDataFieldKey[] {
  const affected: RiskRegistryDataFieldKey[] = [];
  for (const key of Object.keys(CONDITIONAL_FIELD_RULES) as RiskRegistryDataFieldKey[]) {
    const rule = CONDITIONAL_FIELD_RULES[key];
    if (key === changedKey || rule?.dependsOn.includes(changedKey)) {
      affected.push(key);
    }
  }
  return affected;
}

/**
 * Validates one conditionally-visible/required field: its own shape first
 * (e.g. its 255-character max length) so a real shape error is never masked
 * by — or masks — the conditional-required rule, then whether it is
 * required-and-empty given the rest of `draft`.
 */
export function validateConditionalField(key: RiskRegistryDataFieldKey, draft: RiskRegistryDraftValues): string | undefined {
  const shapeMessage = validateFieldValue(key, draft[key]);
  if (shapeMessage) {
    return shapeMessage;
  }

  const rule = CONDITIONAL_FIELD_RULES[key];
  if (!rule || rule.isRequiredWhenApplicable === false) {
    return undefined;
  }
  if (rule.isApplicable(draft) && isEmptyValue(draft[key])) {
    return `${getRiskRegistryDataField(key).displayName} is required when ${rule.conditionDescription}.`;
  }
  return undefined;
}

/**
 * "Other Resource for Correction" is only required once "Anticipated
 * Resource for Correction" is "Other". Kept as its own named export (the
 * original, still-used entry point for this one rule) — equivalent to
 * `validateConditionalField('otherResourceForCorrection', draft)`.
 */
export function validateOtherResourceForCorrection(draft: RiskRegistryDraftValues): string | undefined {
  return validateConditionalField('otherResourceForCorrection', draft);
}

/** Validates every app-level conditional-required rule (see `CONDITIONAL_FIELD_RULES`) against the full draft. */
export function validateConditionalRequirements(draft: RiskRegistryDraftValues): RiskRegistryFieldErrors {
  const errors: RiskRegistryFieldErrors = {};
  for (const key of Object.keys(CONDITIONAL_FIELD_RULES) as RiskRegistryDataFieldKey[]) {
    const message = validateConditionalField(key, draft);
    if (message) {
      errors[key] = message;
    }
  }
  return errors;
}
