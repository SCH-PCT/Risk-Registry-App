import * as React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
import { RiskRegistryDataFieldKey } from '../../../config/listSchema';

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
      {
        name: 'SBAR.pdf',
        serverRelativeUrl: '/sites/RiskRegistry/RiskRegistryDocuments/142/SBAR.pdf',
        documentType: 'SBAR Document'
      }
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

    // The normal view/edit flow for the new item — itself now defaulting to
    // edit mode, so "Save"/"Cancel" (not "Edit") confirm the switch.
    expect(await screen.findByRole('button', { name: /^Save$/ })).toBeInTheDocument();
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

    // The normal view/edit flow for the new item — itself now defaulting to
    // edit mode, so "Save"/"Cancel" (not "Edit") confirm the switch.
    expect(await screen.findByRole('button', { name: /^Save$/ })).toBeInTheDocument();
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

  it('disables the Step 2-4 WorkflowStepper tiles and caps "Next Step" at Step 1 while creating a new item', async () => {
    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined) })} />);

    await screen.findByRole('button', { name: 'Create' });

    expect(stepTileButton('1. Intake & SBAR')).not.toBeDisabled();
    expect(stepTileButton('2. Clinical Evaluation')).toBeDisabled();
    expect(stepTileButton('3. VP Assignment')).toBeDisabled();
    expect(stepTileButton('4. Action & CAP')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next Step/i })).toBeDisabled();

    // Clicking a disabled tile does not change which step is shown.
    fireEvent.click(stepTileButton('2. Clinical Evaluation'));
    expect(screen.getByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.queryByText(/Step 2: Clinical Evaluation/)).not.toBeInTheDocument();
  });

  it('starts creation on Step 1 even when the page URL requests a later step', async () => {
    render(<RiskRegistryDetail {...buildProps({ identifierResult: parseItemId(undefined), selectedStep: 3 })} />);

    await screen.findByRole('button', { name: 'Create' });

    expect(screen.getByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.queryByText(/Step 3: VP Assignment/)).not.toBeInTheDocument();
  });

  it('re-enables every step tile and "Next Step" once creation hands off to the normal view/edit flow', async () => {
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
    fireEvent.change(titleInput(container), { target: { value: 'Brand new risk' } });
    fireEvent.click(createButton);

    await screen.findByRole('button', { name: /^Save$/ });
    expect(stepTileButton('2. Clinical Evaluation')).not.toBeDisabled();
    expect(stepTileButton('3. VP Assignment')).not.toBeDisabled();
    expect(stepTileButton('4. Action & CAP')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Next Step/i })).not.toBeDisabled();
  });

  it('ignores the Step 2-4 creation restriction and shows every step at once when adminview is true', async () => {
    render(
      <RiskRegistryDetail
        {...buildProps({ identifierResult: parseItemId(undefined), isAdminView: true, selectedStep: 3 })}
      />
    );

    await screen.findByRole('button', { name: 'Create' });

    expect(stepTileButton('1. Intake & SBAR')).not.toBeDisabled();
    expect(stepTileButton('2. Clinical Evaluation')).not.toBeDisabled();
    expect(stepTileButton('3. VP Assignment')).not.toBeDisabled();
    expect(stepTileButton('4. Action & CAP')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Next Step/i })).not.toBeDisabled();

    expect(screen.getByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    expect(screen.getByText(/Step 3: VP Assignment/)).toBeInTheDocument();
    expect(screen.getByText(/Step 4: Action/)).toBeInTheDocument();
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

describe('RiskRegistryDetail — default edit mode', () => {
  it('opens an existing item already in edit mode when the user is permitted to edit it', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    expect(await screen.findByRole('button', { name: /^Save$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(stepTileButton('2. Clinical Evaluation')).not.toBeDisabled();
    expect(stepTileButton('3. VP Assignment')).not.toBeDisabled();
    expect(stepTileButton('4. Action & CAP')).not.toBeDisabled();
  });

  it('stays read-only when the user is not permitted to edit the item', async () => {
    render(<RiskRegistryDetail {...buildProps({ permissions: new MockWebPermissionsService(false) })} />);

    expect(await screen.findByText('Step 1: Intake & SBAR Documentation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    // Unlike the "create new" form, an existing record's step tiles are
    // never disabled — regardless of edit/read mode, every step already
    // exists.
    expect(stepTileButton('2. Clinical Evaluation')).not.toBeDisabled();
    expect(stepTileButton('3. VP Assignment')).not.toBeDisabled();
    expect(stepTileButton('4. Action & CAP')).not.toBeDisabled();
  });

  it('stays in edit mode after a successful save, instead of dropping back to read mode', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Updated via save' } });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    fireEvent.click(saveButton);

    // Still editing: "Save" (now disabled again, nothing left unsaved) and
    // "Cancel" remain, rather than the form reverting to a read-only "Edit"
    // button — and the title field is still a live input, not a read-only span.
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    titleInput(container);
  });
});

describe('RiskRegistryDetail — edit validation', () => {
  it('disables Save until the form has an unsaved, valid change', async () => {
    // The page now defaults to edit mode (for a user permitted to edit), so
    // there is no separate "Edit" click to get here.
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

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

    await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText(/discard them/i)).toBeInTheDocument();

    // The field still shows the unsaved value — cancelling is not automatic.
    expect(titleInput(container).value).toBe('Changed title');
  });

  it('cancels without a prompt when nothing has changed', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('button', { name: /^Save$/ });
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

    await screen.findByRole('button', { name: /^Save$/ });
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

    await screen.findByRole('button', { name: /^Save$/ });
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

    // Rendered once, inside Step 1's "Related Documents" panel — the page's
    // bottom "Documents" section (which also read `detail.relatedSections.documents`)
    // was removed.
    const links = await screen.findAllByRole('link', { name: 'SBAR.pdf' });
    expect(links).toHaveLength(1);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/sites/RiskRegistry/RiskRegistryDocuments/142/SBAR.pdf');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
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

  it('refreshes the Related Documents list so a newly uploaded file appears, without a manual refresh', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('link', { name: 'SBAR.pdf' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const newFile = new File(['binary content'], 'incident-photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [newFile] } });

    expect(await screen.findByRole('link', { name: 'incident-photo.jpg' })).toBeInTheDocument();
    // The previously-listed file is still there too — this refetched the
    // whole list rather than replacing it.
    expect(screen.getByRole('link', { name: 'SBAR.pdf' })).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — Related Documents row actions', () => {
  it('renames a document in place', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('link', { name: 'SBAR.pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Rename SBAR.pdf' }));

    const renameInput = screen.getByRole('textbox', { name: 'New name for SBAR.pdf' });
    fireEvent.change(renameInput, { target: { value: 'SBAR-final.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByRole('link', { name: 'SBAR-final.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'SBAR.pdf' })).not.toBeInTheDocument();
  });

  it('cancels a rename without changing the document', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('link', { name: 'SBAR.pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Rename SBAR.pdf' }));

    const renameInput = screen.getByRole('textbox', { name: 'New name for SBAR.pdf' });
    fireEvent.change(renameInput, { target: { value: 'Something else.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel rename' }));

    expect(screen.getByRole('link', { name: 'SBAR.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Something else.pdf' })).not.toBeInTheDocument();
  });

  it('deletes a document only after the confirmation dialog is accepted', async () => {
    render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('link', { name: 'SBAR.pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete SBAR.pdf' }));

    // Scoped to the dialog itself — the page header already has its own
    // "Cancel" button (edit mode's Save/Cancel), so an unscoped query would
    // be ambiguous. Fluent's `Dialog` renders as `role="alertdialog"` here
    // (not the plain `"dialog"` role), confirmed from the rendered DOM.
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/will be permanently removed/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // Fluent hides the rest of the page from the accessibility tree while
    // the modal is open and lifts that only once it finishes closing — async
    // rather than a synchronous `getByRole`, to allow for that.
    expect(await screen.findByRole('link', { name: 'SBAR.pdf' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete SBAR.pdf' }));
    const reopenedDialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('link', { name: 'SBAR.pdf' })).not.toBeInTheDocument();
    expect(await screen.findByText('No documents found for this risk yet.')).toBeInTheDocument();
  });
});

describe('RiskRegistryDetail — conditional required field', () => {
  it('requires Other Resource for Correction once Anticipated Resource for Correction is "Other"', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('button', { name: /^Save$/ });

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

describe('RiskRegistryDetail — Choice field dropdown enhancements', () => {
  it('shows a hover tooltip on each option and offers a selectable "(Not Set)" option that clears the field', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('button', { name: /^Save$/ });

    const dropdown = container.querySelector(`#${fieldDomId('hasHarmToPatientVisitorWorkforce')}`) as HTMLElement;
    expect(dropdown).toHaveTextContent('No');

    fireEvent.click(dropdown);

    // Scoped to `role="option"` (the open callout's own items) rather than
    // plain text, since every other unset Choice field on the page also
    // displays "(Not Set)" as its own closed-dropdown text simultaneously.
    const noOption = await screen.findByRole('option', { name: 'No' });
    expect(noOption).toHaveAttribute('title', 'No');

    const blankOption = screen.getByRole('option', { name: '(Not Set)' });
    expect(blankOption).toHaveAttribute('title', '(Not Set)');

    fireEvent.click(blankOption);

    expect(dropdown).toHaveTextContent('(Not Set)');
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

    await screen.findByRole('button', { name: /^Save$/ });
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

    await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    // Discarding exits edit mode too, the same as the existing Cancel button.
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('saves the edit and switches steps when the user chooses Save Changes', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Changed title' } });

    fireEvent.click(stepTileButton('2. Clinical Evaluation'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(/Step 2: Clinical Evaluation/)).toBeInTheDocument();
    // Saving keeps the page in edit mode (unlike Discard, above) — "Save" is
    // still there, now disabled again since the just-saved draft is no
    // longer dirty.
    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    expect(saveButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('also guards the footer Next Step control, not just the stepper tiles', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps()} />);

    await screen.findByRole('button', { name: /^Save$/ });
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

    await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    // Saving keeps the page in edit mode — wait for the save to settle via
    // the "Save" button going back to disabled (nothing left unsaved).
    await waitFor(() => expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled());

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

    await screen.findByRole('button', { name: /^Save$/ });

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

    await screen.findByRole('button', { name: /^Save$/ });

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

describe('RiskRegistryDetail — Step 3 section visibility', () => {
  /** Opens a Step 3 Choice field's dropdown and picks `optionText`. */
  async function chooseDropdownOption(
    container: HTMLElement,
    fieldKey: RiskRegistryDataFieldKey,
    optionText: string
  ): Promise<void> {
    const dropdown = container.querySelector(`#${fieldDomId(fieldKey)}`) as HTMLElement;
    fireEvent.click(dropdown);
    fireEvent.click(await screen.findByText(optionText));
  }

  /**
   * The default sample fixture (`buildSampleRiskRegistryItem`) already has
   * `assignmentType: 'Correction'`, `correctionCategory: 'Quality
   * Committee'`, etc. — realistic for most other tests, but these ones are
   * specifically about the *transition* driven by those fields, so each
   * starts from them unset rather than inheriting that default.
   */
  function buildProps3(fieldOverrides: Record<string, unknown> = {}): IRiskRegistryDetailProps {
    const item = buildSampleRiskRegistryItem({
      fields: {
        assignmentType: undefined,
        correctionCategory: undefined,
        qualityCommittee: undefined,
        assignedToDepartment: undefined,
        ...fieldOverrides
      } as never
    });
    return buildProps({ selectedStep: 3, repositories: buildRepositories({ riskRegistry: new MockRiskRegistryRepository({ item }) }) });
  }

  it('hides both scope sections, and no "Quality Committee Governance" section, before Assignement Type is chosen', async () => {
    render(<RiskRegistryDetail {...buildProps3()} />);

    await screen.findByRole('button', { name: /^Save$/ });
    expect(screen.queryByText('Clinical Assessment Scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Correction Scope & Systems')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality Committee Governance')).not.toBeInTheDocument();
  });

  it('shows "Clinical Assessment Scope" (not "Correction Scope & Systems") once Assignement Type is "Assessment"', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps3()} />);

    await screen.findByRole('button', { name: /^Save$/ });
    await chooseDropdownOption(container, 'assignmentType', 'Assessment');

    expect(screen.getByText('Clinical Assessment Scope')).toBeInTheDocument();
    expect(screen.queryByText('Correction Scope & Systems')).not.toBeInTheDocument();
  });

  it('shows "Correction Scope & Systems" (not "Clinical Assessment Scope") once Assignement Type is "Correction", and shows the moved fields inside it', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps3()} />);

    await screen.findByRole('button', { name: /^Save$/ });
    expect(screen.queryByText('Clinical Assessment Scope')).not.toBeInTheDocument();
    await chooseDropdownOption(container, 'assignmentType', 'Correction');

    expect(screen.queryByText('Clinical Assessment Scope')).not.toBeInTheDocument();
    expect(screen.getByText('Correction Scope & Systems')).toBeInTheDocument();

    // "Assigned to Department" — moved from "Departmental Assignment &
    // Leadership" — only shows once Correction Category is "Departmental
    // Directive" (see `fieldMetadata.ts`'s `CONDITIONAL_FIELD_RULES`,
    // unchanged by this reorganization).
    expect(screen.queryByText('Assigned to Department')).not.toBeInTheDocument();
    await chooseDropdownOption(container, 'correctionCategory', 'Departmental Directive');
    expect(await screen.findByText('Assigned to Department')).toBeInTheDocument();
  });

  it('shows "Quality Committee" — moved from the deleted "Quality Committee Governance" section — inside "Correction Scope & Systems"', async () => {
    const { container } = render(<RiskRegistryDetail {...buildProps3()} />);

    await screen.findByRole('button', { name: /^Save$/ });
    await chooseDropdownOption(container, 'assignmentType', 'Correction');

    // "Quality Committee" only shows once Correction Category is itself
    // "Quality Committee" (same pre-existing rule, now surfaced in its new
    // group).
    expect(screen.queryByText('Quality Committee', { selector: 'label' })).not.toBeInTheDocument();
    await chooseDropdownOption(container, 'correctionCategory', 'Quality Committee');
    expect(await screen.findByText('Quality Committee', { selector: 'label' })).toBeInTheDocument();
    expect(screen.queryByText('Quality Committee Governance')).not.toBeInTheDocument();
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

    const saveButton = await screen.findByRole('button', { name: /^Save$/ });
    fireEvent.change(titleInput(container), { target: { value: 'Updated risk title' } });

    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [, , payload] = updateSpy.mock.calls[0];
    expect(payload.RiskID).toBe(482);
  });
});
