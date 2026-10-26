import {
  clearHiddenFieldValues,
  getConditionalFieldKeysAffectedBy,
  isFieldConditionallyRequired,
  isFieldVisible,
  validateConditionalField,
  validateConditionalRequirements,
  validateDraft,
  validateFieldValue,
  validateOtherResourceForCorrection,
  validateRequiredFieldsPresent
} from './fieldMetadata';

describe('validateFieldValue', () => {
  it('requires the Title field', () => {
    expect(validateFieldValue('title', undefined)).toMatch(/required/i);
    expect(validateFieldValue('title', '')).toMatch(/required/i);
    expect(validateFieldValue('title', '   ')).toMatch(/required/i);
  });

  it('accepts a valid Title', () => {
    expect(validateFieldValue('title', 'Automated Alaris Pump Dose Rate Discrepancy')).toBeUndefined();
  });

  it('does not require an optional field', () => {
    expect(validateFieldValue('riskSummary', undefined)).toBeUndefined();
  });

  it('enforces maxLength on a Text field', () => {
    const tooLong = 'x'.repeat(256);
    expect(validateFieldValue('otherResourceForCorrection', tooLong)).toMatch(/255 characters or fewer/);
    expect(validateFieldValue('otherResourceForCorrection', 'x'.repeat(255))).toBeUndefined();
  });

  it('rejects a Choice value outside the verified choice list', () => {
    expect(validateFieldValue('riskStatus', 'Not A Real Status')).toMatch(/one of the listed choices/);
  });

  it('accepts a verified Choice value', () => {
    expect(validateFieldValue('riskStatus', 'Evaluation')).toBeUndefined();
  });

  it('rejects a non-numeric value for a Number field', () => {
    expect(validateFieldValue('eFeedbackNumber', 'not a number' as unknown as number)).toMatch(/must be a number/);
  });

  it('accepts a numeric value for a Number field', () => {
    expect(validateFieldValue('eFeedbackNumber', 48213)).toBeUndefined();
  });

  it('rejects a non-boolean value for a Boolean field', () => {
    expect(validateFieldValue('capUpdated', 'yes' as unknown as boolean)).toMatch(/Yes or No/);
  });

  it('rejects an unparseable date for a DateTime field', () => {
    expect(validateFieldValue('eqocMeetingDate', 'not-a-date')).toMatch(/valid date/);
  });

  it('accepts a valid ISO date for a DateTime field', () => {
    expect(validateFieldValue('eqocMeetingDate', '2026-10-01T12:00:00Z')).toBeUndefined();
  });
});

describe('validateDraft', () => {
  it('returns an error only for the fields present in the draft that are invalid', () => {
    const errors = validateDraft({
      title: '',
      riskStatus: 'Evaluation',
      eFeedbackNumber: 'oops' as unknown as number
    });

    expect(Object.keys(errors).sort()).toEqual(['eFeedbackNumber', 'title']);
  });

  it('returns no errors for an entirely valid draft', () => {
    const errors = validateDraft({ title: 'Valid title', riskStatus: 'Evaluation' });
    expect(errors).toEqual({});
  });
});

describe('validateRequiredFieldsPresent', () => {
  it('flags a required field missing from the draft entirely, not just empty', () => {
    const errors = validateRequiredFieldsPresent({ riskStatus: 'Evaluation' });
    expect(errors.title).toMatch(/required/i);
  });

  it('passes when every required field is present and valid', () => {
    const errors = validateRequiredFieldsPresent({ title: 'Valid title' });
    expect(errors).toEqual({});
  });
});

describe('validateOtherResourceForCorrection', () => {
  it('is not required when Anticipated Resource for Correction is unset', () => {
    expect(validateOtherResourceForCorrection({})).toBeUndefined();
  });

  it('is not required when Anticipated Resource for Correction is set to something other than "Other"', () => {
    expect(
      validateOtherResourceForCorrection({ anticipatedResourceForCorrection: 'Clinical Analytics' })
    ).toBeUndefined();
  });

  it('is required, and empty, once Anticipated Resource for Correction is "Other"', () => {
    expect(validateOtherResourceForCorrection({ anticipatedResourceForCorrection: 'Other' })).toMatch(
      /is required when Anticipated Resource for Correction is "Other"/
    );
  });

  it('passes once a value is supplied', () => {
    expect(
      validateOtherResourceForCorrection({
        anticipatedResourceForCorrection: 'Other',
        otherResourceForCorrection: 'New vendor contract'
      })
    ).toBeUndefined();
  });

  it('still enforces its own shape (maxLength) even when not conditionally required', () => {
    expect(
      validateOtherResourceForCorrection({ otherResourceForCorrection: 'x'.repeat(256) })
    ).toMatch(/255 characters or fewer/);
  });
});

describe('validateConditionalRequirements', () => {
  it('flags otherResourceForCorrection under the same condition', () => {
    const errors = validateConditionalRequirements({ anticipatedResourceForCorrection: 'Other' });
    expect(errors.otherResourceForCorrection).toMatch(/required/i);
  });

  it('returns no errors when the condition does not apply', () => {
    expect(validateConditionalRequirements({ anticipatedResourceForCorrection: 'Clinical Analytics' })).toEqual({});
  });
});

describe('isFieldVisible', () => {
  it('hides eFeedback # until harm is reported as "Yes"', () => {
    expect(isFieldVisible('eFeedbackNumber', {})).toBe(false);
    expect(isFieldVisible('eFeedbackNumber', { hasHarmToPatientVisitorWorkforce: 'No' })).toBe(false);
    expect(isFieldVisible('eFeedbackNumber', { hasHarmToPatientVisitorWorkforce: 'Yes' })).toBe(true);
  });

  it('shows Details of Harm for both "Yes" and "Unknown"', () => {
    expect(isFieldVisible('detailsOfHarm', { hasHarmToPatientVisitorWorkforce: 'Yes' })).toBe(true);
    expect(isFieldVisible('detailsOfHarm', { hasHarmToPatientVisitorWorkforce: 'Unknown' })).toBe(true);
    expect(isFieldVisible('detailsOfHarm', { hasHarmToPatientVisitorWorkforce: 'No' })).toBe(false);
  });

  it('shows Assesment Type only when Assignement Type is "Assessment", and Correction Category only when "Correction"', () => {
    expect(isFieldVisible('assessmentType', { assignmentType: 'Assessment' })).toBe(true);
    expect(isFieldVisible('assessmentType', { assignmentType: 'Correction' })).toBe(false);
    expect(isFieldVisible('correctionCategory', { assignmentType: 'Correction' })).toBe(true);
    expect(isFieldVisible('correctionCategory', { assignmentType: 'Assessment' })).toBe(false);
  });

  it('cascades Correction Category\'s sub-fields off its own verified choice values', () => {
    expect(isFieldVisible('assignedToDepartment', { correctionCategory: 'Departmental Directive' })).toBe(true);
    expect(isFieldVisible('microSystem', { correctionCategory: 'Microsystem' })).toBe(true);
    expect(isFieldVisible('mesoSystem', { correctionCategory: 'Mesosystem' })).toBe(true);
    expect(isFieldVisible('qualityCommittee', { correctionCategory: 'Quality Committee' })).toBe(true);
    expect(isFieldVisible('microSystem', { correctionCategory: 'Mesosystem' })).toBe(false);
  });

  it('matches Quality Committee\'s verified "Other:" choice value exactly (trailing colon)', () => {
    expect(isFieldVisible('qualityCommitteeSpecifyOther', { qualityCommittee: 'Other:' })).toBe(true);
    expect(isFieldVisible('qualityCommitteeSpecifyOther', { qualityCommittee: 'Other' })).toBe(false);
  });

  it('is always visible for a field with no conditional rule', () => {
    expect(isFieldVisible('riskSummary', {})).toBe(true);
  });
});

describe('isFieldConditionallyRequired', () => {
  it('overrides to true/false for a required-when-visible field', () => {
    expect(isFieldConditionallyRequired('correctionCategorySpecifyOther', { correctionCategory: 'Other' })).toBe(true);
    expect(isFieldConditionallyRequired('correctionCategorySpecifyOther', { correctionCategory: 'Microsystem' })).toBe(false);
  });

  it('never overrides a visible-only field (eFeedback #, Details of Harm)', () => {
    expect(isFieldConditionallyRequired('eFeedbackNumber', { hasHarmToPatientVisitorWorkforce: 'Yes' })).toBeUndefined();
    expect(isFieldConditionallyRequired('detailsOfHarm', { hasHarmToPatientVisitorWorkforce: 'Yes' })).toBeUndefined();
  });

  it('returns undefined (fall back to static required) for a field with no conditional rule', () => {
    expect(isFieldConditionallyRequired('riskSummary', {})).toBeUndefined();
  });
});

describe('getConditionalFieldKeysAffectedBy', () => {
  it('includes every field whose rule depends on the changed field, plus itself if it has a rule', () => {
    const affected = getConditionalFieldKeysAffectedBy('correctionCategory');
    expect(affected.sort()).toEqual(
      ['assignedToDepartment', 'correctionCategory', 'correctionCategorySpecifyOther', 'mesoSystem', 'microSystem', 'qualityCommittee'].sort()
    );
  });

  it('returns just the field itself when nothing depends on it and it has its own rule', () => {
    expect(getConditionalFieldKeysAffectedBy('otherResourceForCorrection')).toEqual(['otherResourceForCorrection']);
  });

  it('returns an empty list for a field that is neither a rule nor a dependency', () => {
    expect(getConditionalFieldKeysAffectedBy('riskSummary')).toEqual([]);
  });
});

describe('validateConditionalField', () => {
  it('requires Risk Identification Methods-Specify Other Source only when "Other" is selected', () => {
    expect(
      validateConditionalField('riskIdentificationMethodsSpecifyOther', { riskIdentificationMethods: 'Other' })
    ).toMatch(/is required when Risk Identification Methods is "Other"/);
    expect(
      validateConditionalField('riskIdentificationMethodsSpecifyOther', { riskIdentificationMethods: 'Escalation' })
    ).toBeUndefined();
  });

  it('requires both Assessment Type-Specify fields once Assesment Type is "Other"', () => {
    const draft = { assignmentType: 'Assessment' as const, assessmentType: 'Other' as const };
    expect(validateConditionalField('assessmentTypeSpecifyOther', draft)).toMatch(/is required when Assesment Type is "Other"/);
    expect(validateConditionalField('assessmentTypeSpecifyDetails', draft)).toMatch(/is required when Assesment Type is "Other"/);
  });

  it('never requires a visible-only field even when its condition applies', () => {
    expect(
      validateConditionalField('eFeedbackNumber', { hasHarmToPatientVisitorWorkforce: 'Yes' })
    ).toBeUndefined();
  });
});

describe('Step 4 conditional rules', () => {
  it('distinguishes "Request for More Information" (capReviewStatus) from "Request for Additional Information" (accountableVpClosureApproval)', () => {
    // `capReviewStatus`/`accountableVpCapApproval` spell the "request" choice
    // "...More Information"; `accountableVpClosureApproval`/`accountableVpApproval`
    // spell it "...Additional Information" instead — verified in listSchema.ts.
    expect(isFieldVisible('capReviewRequestForMoreInfo', { capReviewStatus: 'Request for More Information' })).toBe(true);
    expect(
      isFieldVisible('accountableVpCapClosureRequestForMoreInfo', {
        accountableVpClosureApproval: 'Request for More Information'
      })
    ).toBe(false);
    expect(
      isFieldVisible('accountableVpCapClosureRequestForMoreInfo', {
        accountableVpClosureApproval: 'Request for Additional Information'
      })
    ).toBe(true);
  });

  it('matches accountableVpRiskAssignment\'s own lowercase "Request for more information" choice', () => {
    expect(isFieldVisible('accountableVpRequestForMoreInfo', { accountableVpRiskAssignment: 'Request for more information' })).toBe(true);
    expect(
      isFieldVisible('accountableVpRequestForMoreInfo', { accountableVpRiskAssignment: 'Request for More Information' })
    ).toBe(false);
  });

  it('shows Acountable VP Determination for either "Risk deferred" or "Correction"', () => {
    expect(isFieldVisible('accountableVpDeterminationNote', { accountableVpRiskAssignment: 'Risk deferred' })).toBe(true);
    expect(isFieldVisible('accountableVpDeterminationNote', { accountableVpRiskAssignment: 'Correction' })).toBe(true);
    expect(
      isFieldVisible('accountableVpDeterminationNote', { accountableVpRiskAssignment: 'Request for more information' })
    ).toBe(false);
  });

  it('requires Correctin Type only when both Semi-annual review status is "Ready" and Was the risk corrected? is "Yes"', () => {
    expect(isFieldVisible('correctionType', { semiAnnualReviewStatus: 'Ready', wasTheRiskCorrected: 'Yes' })).toBe(true);
    expect(isFieldVisible('correctionType', { semiAnnualReviewStatus: 'Ready', wasTheRiskCorrected: 'No' })).toBe(false);
    expect(isFieldVisible('correctionType', { semiAnnualReviewStatus: 'Pending', wasTheRiskCorrected: 'Yes' })).toBe(false);
  });

  it('re-validates Correctin Type when either of its two dependencies changes', () => {
    expect(getConditionalFieldKeysAffectedBy('semiAnnualReviewStatus')).toContain('correctionType');
    expect(getConditionalFieldKeysAffectedBy('wasTheRiskCorrected')).toContain('correctionType');
  });

  it('shows CAP Closure Type only when CAP closure status is "Ready", distinct from the "request more info" branch', () => {
    expect(isFieldVisible('capClosureType', { capClosureStatus: 'Ready' })).toBe(true);
    expect(isFieldVisible('capClosureType', { capClosureStatus: 'Request for More Information' })).toBe(false);
  });
});

describe('clearHiddenFieldValues', () => {
  it('blanks a stale "Specify Other" value left over after the user changed their selection away from "Other"', () => {
    const cleared = clearHiddenFieldValues({
      assignmentType: 'Correction',
      correctionCategory: 'Microsystem',
      correctionCategorySpecifyOther: 'A leftover note from when this was "Other"',
      microSystem: 'ED'
    });

    expect(cleared.correctionCategorySpecifyOther).toBeUndefined();
    // Fields that are still visible keep their value untouched.
    expect(cleared.correctionCategory).toBe('Microsystem');
    expect(cleared.microSystem).toBe('ED');
  });

  it('clears an entire cascade at once when the top-level driver hides every dependent field', () => {
    const cleared = clearHiddenFieldValues({
      assignmentType: 'Assessment',
      // Stale from when assignmentType was "Correction":
      correctionCategory: 'Quality Committee',
      qualityCommittee: 'Medication Safety',
      assignedToDepartment: 'Pharmacy'
    });

    expect(cleared.correctionCategory).toBeUndefined();
    expect(cleared.qualityCommittee).toBeUndefined();
    expect(cleared.assignedToDepartment).toBeUndefined();
  });

  it('cascades three levels deep: Assignement Type hides Correction Category, which hides Quality Committee, which hides Quality Committee-Specify Other', () => {
    const cleared = clearHiddenFieldValues({
      assignmentType: 'Assessment',
      correctionCategory: 'Quality Committee',
      qualityCommittee: 'Other:',
      qualityCommitteeSpecifyOther: 'A leftover committee name'
    });

    expect(cleared.correctionCategory).toBeUndefined();
    expect(cleared.qualityCommittee).toBeUndefined();
    expect(cleared.qualityCommitteeSpecifyOther).toBeUndefined();
  });

  it('leaves fields with no conditional rule untouched', () => {
    expect(clearHiddenFieldValues({ riskSummary: 'Still relevant' }).riskSummary).toBe('Still relevant');
  });

  it('is a no-op when nothing is hidden', () => {
    const draft = { anticipatedResourceForCorrection: 'Other', otherResourceForCorrection: 'New vendor contract' };
    expect(clearHiddenFieldValues(draft)).toEqual(draft);
  });
});
