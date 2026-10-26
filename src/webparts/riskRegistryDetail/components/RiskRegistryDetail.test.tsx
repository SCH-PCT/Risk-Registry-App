import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { RiskRegistryDetail } from './RiskRegistryDetail';
import { fieldDomId } from './fieldDomId';
import { IRiskRegistryDetailProps } from './IRiskRegistryDetailProps';
import { buildSampleRiskRegistryItem, MockRiskRegistryRepository } from '../../../data/repositories/mock/MockRiskRegistryRepository';
import {
  MockRiskActionRepository,
  MockRiskActivityRepository,
  MockRiskAssignmentRepository,
  MockRiskDocumentRepository,
  MockRiskUpdateRepository
} from '../../../data/repositories/mock/MockRelatedRepositories';
import { MockWebPermissionsService } from '../../../data/services/mock/MockWebPermissionsService';
import { MockPeopleRepository } from '../../../data/repositories/mock/MockPeopleRepository';
import { RiskRegistryError } from '../../../data/repositories/IRiskRegistryRepository';
import { parseItemId } from '../../../utilities/itemIdentifier';
import { IRiskRegistryDetailRepositories } from '../../../hooks/useRiskRegistryDetail';

function buildRepositories(
  overrides: Partial<IRiskRegistryDetailRepositories> = {}
): IRiskRegistryDetailRepositories {
  return {
    riskRegistry: new MockRiskRegistryRepository(),
    actions: new MockRiskActionRepository(),
    activities: new MockRiskActivityRepository(),
    updates: new MockRiskUpdateRepository(),
    assignments: new MockRiskAssignmentRepository(),
    documents: new MockRiskDocumentRepository([
      { name: 'SBAR.pdf', serverRelativeUrl: '/sites/RiskRegistry/RiskRegistryDocuments/142/SBAR.pdf' }
    ]),
    people: new MockPeopleRepository(),
    ...overrides
  };
}

function buildProps(overrides: Partial<IRiskRegistryDetailProps> = {}): IRiskRegistryDetailProps {
  return {
    identifierResult: parseItemId('482'),
    repositories: buildRepositories(),
    permissions: new MockWebPermissionsService(true),
    listTitle: 'RiskRegistryData',
    // Auto-refresh disabled so no background timer is left running after a
    // test ends — the initial load still happens regardless (see
    // useAutoRefresh's mount effect), which is all these tests exercise.
    refreshConfiguration: { enabled: false, intervalSeconds: 60 },
    showLastRefreshed: true,
    selectedStep: 1,
    isAdminView: false,
    ...overrides
  };
}

/** The clickable `WorkflowStepper` tile containing `label` (e.g. "2. Clinical Evaluation"). */
function stepTileButton(label: string): HTMLButtonElement {
  const button = screen.getByText(label).closest('button');
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

/**
 * Step 1's `title` ("Risk Title") field input. For an existing item, the
 * page header also shows this same field, but under a different DOM id
 * (see `FieldRenderer`'s `domId` override in `RiskRegistryDetail.tsx`) —
 * so this always resolves to Step 1's instance specifically, not the
 * header's. For the "create new" flow, Step 1's is the only instance at
 * all (the header's identification step is hidden).
 */
function titleInput(container: HTMLElement): HTMLInputElement {
  const element = container.querySelector(`#${fieldDomId('title')}`);
  expect(element).toBeInstanceOf(HTMLInputElement);
  return element as HTMLInputElement;
}

describe('RiskRegistryDetail — invalid identifier', () => {
  it('shows the invalid-identifier state and never calls the repository', async () => {
    const getByIdSpy = jest.fn();
    const repositories = buildRepositories({
      riskRegistry: { getById: getByIdSpy, update: jest.fn(), create: jest.fn() }
    });

    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId('not-a-number'), repositories })} />);

    expect(await screen.findByText(/does not point at a valid risk record/i)).toBeInTheDocument();
    expect(getByIdSpy).not.toHaveBeenCalled();
  });
});

describe('RiskRegistryDetail — blank identifier (create new item)', () => {
  it('shows the new-item creation form instead of the invalid-identifier error, and never calls getById', async () => {
    const getByIdSpy = jest.fn();
    const repositories = buildRepositories({
      riskRegistry: { getById: getByIdSpy, update: jest.fn(), create: jest.fn() }
    });

    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined), repositories })} />);

    expect(await screen.findByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.queryByText(/does not point at a valid risk record/i)).not.toBeInTheDocument();
    expect(getByIdSpy).not.toHaveBeenCalled();
  });

  it('still shows the invalid-identifier error for a present but malformed id', async () => {
    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId('not-a-number') })} />);

    expect(await screen.findByText(/does not point at a valid risk record/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('disables creation and shows a validation error when the required Title is left blank', async () => {
    const createSpy = jest.fn();
    const repositories = buildRepositories({
      riskRegistry: { getById: jest.fn(), update: jest.fn(), create: createSpy }
    });

    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined), repositories })} />);

    const createButton = await screen.findByRole('button', { name: 'Create' });
    await waitFor(() => expect(createButton).not.toBeDisabled());

    fireEvent.click(createButton);

    expect(await screen.findByText(/needs attention/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('creates the item and switches to the normal view/edit flow for it', async () => {
    // `riskId` matches the item's own system id, so the RiskID backfill
    // (covered separately below, for when the two differ) does not fire here.
    const createdItem = buildSampleRiskRegistryItem({ id: 900, fields: { title: 'Brand new risk', riskId: 900 } });
    const createSpy = jest.fn().mockResolvedValue(createdItem);
    const getByIdSpy = jest.fn().mockResolvedValue(createdItem);
    const repositories = buildRepositories({
      riskRegistry: { getById: getByIdSpy, update: jest.fn(), create: createSpy }
    });

    const { container } = render(
      <RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined), repositories })} />
    );

    const createButton = await screen.findByRole('button', { name: 'Create' });
    await waitFor(() => expect(createButton).not.toBeDisabled());

    // "Risk Identification" is hidden while creating, but `title` ("Risk
    // Title") is still editable — it is one of Step 1's own fields.
    fireEvent.change(titleInput(container), { target: { value: 'Brand new risk' } });
    fireEvent.click(createButton);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0][0]).toMatchObject({
      Title: 'Brand new risk',
      RiskStatus: 'New'
    });
    expect(getByIdSpy).toHaveBeenCalledWith(900);
  });

  it('backfills Risk ID with the new item’s system id immediately after creation, when not already set', async () => {
    const createdItem = buildSampleRiskRegistryItem({ id: 901, fields: { title: 'Brand new risk', riskId: undefined } });
    const backfilledItem = { ...createdItem, fields: { ...createdItem.fields, riskId: 901 } };
    const createSpy = jest.fn().mockResolvedValue(createdItem);
    const updateSpy = jest.fn().mockResolvedValue(backfilledItem);
    const getByIdSpy = jest.fn().mockResolvedValue(backfilledItem);
    const repositories = buildRepositories({
      riskRegistry: { getById: getByIdSpy, update: updateSpy, create: createSpy }
    });

    const { container } = render(
      <RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined), repositories })} />
    );

    const createButton = await screen.findByRole('button', { name: 'Create' });
    await waitFor(() => expect(createButton).not.toBeDisabled());

    fireEvent.change(titleInput(container), { target: { value: 'Brand new risk' } });
    fireEvent.click(createButton);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(updateSpy).toHaveBeenCalledWith(901, createdItem.etag, { RiskID: 901 });
    expect(getByIdSpy).toHaveBeenCalledWith(901);
  });

  it('hides Risk Identification, Need SBAR Template?, and Related Documents while creating a new item', async () => {
    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined) })} />);

    await screen.findByRole('button', { name: 'Create' });

    expect(screen.queryByText('Risk Identification')).not.toBeInTheDocument();
    expect(screen.queryByText(/Need SBAR Template\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Related Documents')).not.toBeInTheDocument();
  });

  it('defaults Risk Status to "New" on the Intake & SBAR step', async () => {
    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined) })} />);

    await screen.findByRole('button', { name: 'Create' });

    // The selected step tile shows the record's current status.
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows a permission-denied message and offers no way to create when the user cannot add items', async () => {
    const repositories = buildRepositories();

    render(
      <RiskRegistryDetail
        {...buildProps({
          identifierResult: parseItemId(undefined),
          repositories,
          permissions: new MockWebPermissionsService(true, false)
        })}
      />
    );

    expect(await screen.findByText(/do not have permission to create/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — missing item', () => {
  it('shows a not-found state when the item does not exist', async () => {
    const repositories = buildRepositories({
      riskRegistry: new MockRiskRegistryRepository({ item: buildSampleRiskRegistryItem({ id: 999 }) })
    });

    render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — access denied', () => {
  it('shows an access-denied state and does not render the record', async () => {
    const repositories = buildRepositories({
      riskRegistry: new MockRiskRegistryRepository({
        failGetWith: new RiskRegistryError('access-denied', 'denied')
      })
    });

    render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — edit validation', () => {
  it('disables Save until the form has an unsaved, valid change', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    expect(saveButton).toBeDisabled();

    // Clearing the required Title field: invalid, so still disabled.
    fireEvent.change(titleInput(container), { target: { value: '' } });
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(screen.getByText(/needs attention/i)).toBeInTheDocument();

    // A valid, changed value: now enabled.
    fireEvent.change(titleInput(container), { target: { value: 'Updated risk title' } });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
  });
});

describe('RiskRegistryDetail — unsaved changes', () => {
  it('asks for confirmation before discarding an unsaved edit on Cancel', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText(/discard them/i)).toBeInTheDocument();

    // The field still shows the unsaved value — cancelling is not automatic.
    expect(titleInput(container).value).toBe('Changed title');
  });

  it('cancels without a prompt when nothing has changed', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/discard them/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — concurrency conflict', () => {
  it('shows a conflict banner and keeps the unsaved draft when the server record changes mid-edit', async () => {
    const repository = new MockRiskRegistryRepository();
    const repositories = buildRepositories({ riskRegistry: repository });

    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'My unsaved edit' } });

    // Someone else's save lands on the server while this edit is open.
    repository.simulateServerChange((item) => ({ ...item, etag: '"99"' }));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
    // The draft was not overwritten by the refresh.
    expect(titleInput(container).value).toBe('My unsaved edit');
  });

  it('surfaces a conflict instead of overwriting data when Save hits a stale etag', async () => {
    const repository = new MockRiskRegistryRepository();
    const repositories = buildRepositories({ riskRegistry: repository });

    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'My unsaved edit' } });

    // The server copy moves on without a corresponding client-side refresh.
    repository.simulateServerChange((item) => ({ ...item, etag: '"deadbeef"' }));

    fireEvent.click(await screen.findByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
    expect(titleInput(container).value).toBe('My unsaved edit');
  });
});

describe('RiskRegistryDetail — linked documents', () => {
  it('renders each document as a link to its file URL', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    // Rendered twice: once inside Step 1's "Related Documents" panel, once
    // in the page's bottom "Documents" section — both from the same
    // `detail.relatedSections.documents` state.
    const links = await screen.findAllByRole('link', { name: 'SBAR.pdf' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/sites/RiskRegistry/RiskRegistryDocuments/142/SBAR.pdf');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('shows an empty state, not an error, when a risk has no RiskID and therefore no document folder', async () => {
    const item = buildSampleRiskRegistryItem({ fields: { riskId: undefined } });
    const repositories = buildRepositories({
      riskRegistry: new MockRiskRegistryRepository({ item }),
      documents: new MockRiskDocumentRepository([])
    });

    render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    expect(await screen.findByText(/no documents uploaded/i)).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — Step 1 document actions', () => {
  it('renders "Need SBAR Template?" collapsed by default, expanding only on click', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    const toggle = await screen.findByRole('button', { name: /Need SBAR Template\?/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('SBAR Template.docx')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('SBAR Template.docx')).toBeInTheDocument();
  });

  it('indicates when no documents are found for the risk', async () => {
    const item = buildSampleRiskRegistryItem({ fields: { riskId: undefined } });
    const repositories = buildRepositories({
      riskRegistry: new MockRiskRegistryRepository({ item }),
      documents: new MockRiskDocumentRepository([])
    });

    render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    expect(await screen.findByText('No documents found for this risk yet.')).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — conditional required field', () => {
  it('requires Other Resource for Correction once Anticipated Resource for Correction is "Other"', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    const anticipatedDropdown = container.querySelector(`#${fieldDomId('anticipatedResourceForCorrection')}`) as HTMLElement;
    fireEvent.click(anticipatedDropdown);
    fireEvent.click(await screen.findByText('Other'));

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Other Resource for Correction is required/i).length).toBeGreaterThan(0);

    const otherInput = container.querySelector(`#${fieldDomId('otherResourceForCorrection')}`) as HTMLInputElement;
    fireEvent.change(otherInput, { target: { value: 'New vendor contract' } });

    await waitFor(() => expect(saveButton).not.toBeDisabled());
  });
});

describe('RiskRegistryDetail — step visibility and URL sync', () => {
  it('shows only the active step section by default, and switches sections (not just collapses) on tile click', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByText('Step 1: Intake & SBAR Documentation');
    expect(screen.queryByText(/Step 2: Clinical Evaluation/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 3: VP Assignment/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 4: Action/)).not.toBeInTheDocument();

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    expect(screen.queryByText('Step 1: Intake & SBAR Documentation')).not.toBeInTheDocument();
  });

  it('updates the page URL step parameter when a tile is clicked', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByText('Step 1: Intake & SBAR Documentation');
    fireEvent.click(stepTileButton('3. VP Assignment'));

    await screen.findByText(/Step 3: VP Assignment/);
    expect(window.location.search).toContain('step=3');
  });

  it('updates the step parameter from the footer Next and Previous controls too', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByText('Step 1: Intake & SBAR Documentation');
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    expect(window.location.search).toContain('step=2');
  });

  it('shows every step at once when adminview is true, regardless of the active step', async () => {
    render(<RiskRegistryDetail {...buildProps({ isAdminView: true })} />);

    expect(await screen.findByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    expect(screen.getByText(/Step 3: VP Assignment/)).toBeInTheDocument();
    expect(screen.getByText(/Step 4: Action/)).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — unsaved-changes guard on step navigation', () => {
  it('switches steps immediately, with no prompt, when there are no unsaved edits', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByText('Step 1: Intake & SBAR Documentation');
    fireEvent.click(stepTileButton('2. Clinical Evaluation'));

    expect(screen.queryByText(/unsaved changes on this step/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
  });

  it('prompts before switching steps when there are unsaved edits, and lets the user stay put', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));

    expect(await screen.findByText(/unsaved changes on this step/i)).toBeInTheDocument();
    expect(screen.queryByText(/Step 2: Clinical Evaluation/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stay on This Step' }));

    // Fluent's `Dialog` keeps its content mounted through its close
    // animation, so this only asserts on the behavior that matters here:
    // the step never changed, and the unsaved edit is still intact.
    expect(screen.getByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.queryByText(/Step 2: Clinical Evaluation/)).not.toBeInTheDocument();
    expect(titleInput(container).value).toBe('Changed title');
  });

  it('discards the edit and switches steps when the user chooses Discard Changes', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    // Discarding exits edit mode too, the same as the existing Cancel button.
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('saves the edit and switches steps when the user chooses Save Changes', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('also guards the footer Next Step control, not just the stepper tiles', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    expect(await screen.findByText(/unsaved changes on this step/i)).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — sensitive-data logging controls', () => {
  it('never writes the risk record to the console while loading, editing or saving', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Updated title' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('renders a Note field containing markup as plain text, never as interpreted HTML', async () => {
    const item = buildSampleRiskRegistryItem({
      fields: {
        riskSummary: 'Pump reading <img src=x onerror=alert(1)> was wrong.'
      } as never
    });
    const repositories = buildRepositories({ riskRegistry: new MockRiskRegistryRepository({ item }) });

    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    // The tag survives sanitization as literal text (React escapes every text
    // node it renders regardless), so the visible characters are unchanged —
    // what matters is that no live `<img>` element, and therefore no
    // `onerror` *attribute* capable of executing, exists in the DOM.
    const note = await screen.findByText(/Pump reading.*was wrong\./);
    expect(note.textContent).toBe('Pump reading <img src=x onerror=alert(1)> was wrong.');
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('[onerror]')).not.toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — Person field editing', () => {
  it('searches the tenant directory, resolves the pick to a site user, and saves it as the Id-suffixed field', async () => {
    const repository = new MockRiskRegistryRepository();
    const updateSpy = jest.spyOn(repository, 'update');
    // `evaluatorAssigned` lives in Step 2's "Clinical Evaluation & CQPS
    // Determination" group (see `detailSections.ts`).
    const repositories = buildRepositories({ riskRegistry: repository });

    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories, selectedStep: 2 })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    const input = container.querySelector(`#${fieldDomId('evaluatorAssigned')}`) as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);

    input.focus();
    fireEvent.input(input, { target: { value: 'sara' } });
    fireEvent.click(await screen.findByText('Sara Chen'));

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [, , payload] = updateSpy.mock.calls[0];
    // The directory pick (no SharePoint id of its own) is resolved to a
    // real site user — see `resolvePersonFieldsForSave` — and written as
    // `EvaluatorAssignedId`, the key shape a Person field's REST update
    // needs (see `buildUpdatePayload`), not `EvaluatorAssigned`.
    expect(payload).toHaveProperty('EvaluatorAssignedId');
    expect(typeof payload.EvaluatorAssignedId).toBe('number');
  });

  it('clears a Person field to null when the picker selection is removed', async () => {
    // A name distinct from the sample fixture's default `accountableExecutive`
    // ("Dr. James Romero, MD") — Step 2 renders both fields' groups at once,
    // so a shared display name would make text queries ambiguous.
    const item = buildSampleRiskRegistryItem({
      fields: { evaluatorAssigned: { id: 21, displayName: 'Nina Sorensen', email: 'nina.sorensen@example.org' } } as never
    });
    const repository = new MockRiskRegistryRepository({ item });
    const updateSpy = jest.spyOn(repository, 'update');
    const repositories = buildRepositories({ riskRegistry: repository });

    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories, selectedStep: 2 })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    // Target the picker's remove control by its "Cancel" (x) icon rather
    // than an accessible name or text match — Fluent's `TooltipHost` renders
    // the persona's name twice (a visible span plus a hidden aria-description
    // copy), and sets no explicit `removeButtonAriaLabel`, so both routes
    // are ambiguous in jsdom.
    await waitFor(() => expect(container.querySelector('[data-icon-name="Cancel"]')).not.toBeNull());
    const removeIcon = container.querySelector('[data-icon-name="Cancel"]');
    const removeButton = removeIcon?.closest('button');
    expect(removeButton).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(removeButton as HTMLButtonElement);

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [, , payload] = updateSpy.mock.calls[0];
    expect(payload.EvaluatorAssignedId).toBeNull();
  });
});

describe('RiskRegistryDetail — Risk ID / system id consistency', () => {
  it('corrects RiskID to the item’s own system id on save when the two differ', async () => {
    // The default sample item's `riskId` (142) deliberately differs from
    // its system `id` (482) elsewhere in this file, to prove the code never
    // confuses the two — but on an actual save, RiskID must be brought back
    // in line with the system id it is supposed to track.
    const repository = new MockRiskRegistryRepository();
    const updateSpy = jest.spyOn(repository, 'update');
    const repositories = buildRepositories({ riskRegistry: repository });
    const { container } = render(<RiskRegistryDetail {...buildProps({ repositories })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(titleInput(container), { target: { value: 'Updated risk title' } });

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [, , payload] = updateSpy.mock.calls[0];
    expect(payload.RiskID).toBe(482);
  });
});
