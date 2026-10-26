import { resolvePersonFieldsForSave } from './personFieldResolution';
import { IPeopleRepository, IPersonSearchResult } from '../repositories/IPeopleRepository';
import { IRiskRegistryPerson } from '../../models/domain/IRiskRegistryItem';

class StubPeopleRepository implements IPeopleRepository {
  public ensurePersonCallCount = 0;

  public async searchPeople(): Promise<IPersonSearchResult[]> {
    return [];
  }

  public async ensurePerson(): Promise<IRiskRegistryPerson> {
    this.ensurePersonCallCount += 1;
    return { id: 99, displayName: 'Resolved Person', email: 'resolved@example.org' };
  }
}

describe('resolvePersonFieldsForSave', () => {
  it('resolves a freshly-picked Person field (loginName, no id) via ensurePerson', async () => {
    const people = new StubPeopleRepository();
    const draft = {
      evaluatorAssigned: { displayName: 'Someone', loginName: 'i:0#.f|membership|someone@example.org' }
    };

    const resolved = await resolvePersonFieldsForSave(draft, people);

    expect(people.ensurePersonCallCount).toBe(1);
    expect(resolved.evaluatorAssigned).toEqual({
      id: 99,
      displayName: 'Resolved Person',
      email: 'resolved@example.org'
    });
  });

  it('leaves an already-resolved Person field (has an id) untouched', async () => {
    const people = new StubPeopleRepository();
    const existing = { id: 11, displayName: 'Dr. James Romero, MD', email: 'james.romero@example.org' };
    const draft = { evaluatorAssigned: existing };

    const resolved = await resolvePersonFieldsForSave(draft, people);

    expect(people.ensurePersonCallCount).toBe(0);
    expect(resolved.evaluatorAssigned).toBe(existing);
  });

  it('leaves an empty Person field untouched', async () => {
    const people = new StubPeopleRepository();
    const resolved = await resolvePersonFieldsForSave({ evaluatorAssigned: undefined }, people);

    expect(people.ensurePersonCallCount).toBe(0);
    expect(resolved.evaluatorAssigned).toBeUndefined();
  });

  it('resolves every unresolved Person field in the draft independently', async () => {
    const people = new StubPeopleRepository();
    const draft = {
      evaluatorAssigned: { displayName: 'A', loginName: 'i:0#.f|membership|a@example.org' },
      accountableExecutive: { displayName: 'B', loginName: 'i:0#.f|membership|b@example.org' }
    };

    const resolved = await resolvePersonFieldsForSave(draft, people);

    expect(people.ensurePersonCallCount).toBe(2);
    expect((resolved.evaluatorAssigned as IRiskRegistryPerson | undefined)?.id).toBe(99);
    expect((resolved.accountableExecutive as IRiskRegistryPerson | undefined)?.id).toBe(99);
  });

  it('leaves non-Person fields untouched', async () => {
    const people = new StubPeopleRepository();
    const resolved = await resolvePersonFieldsForSave({ title: 'Some risk', riskStatus: 'New' }, people);

    expect(resolved).toEqual({ title: 'Some risk', riskStatus: 'New' });
    expect(people.ensurePersonCallCount).toBe(0);
  });
});
