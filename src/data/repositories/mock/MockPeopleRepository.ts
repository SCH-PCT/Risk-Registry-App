import { IRiskRegistryPerson } from '../../../models/domain/IRiskRegistryItem';
import { IPeopleRepository, IPersonSearchResult } from '../IPeopleRepository';

/** A small, representative sample "directory" for tests and local development without a live tenant. */
const SAMPLE_DIRECTORY: readonly IPersonSearchResult[] = [
  { loginName: 'i:0#.f|membership|james.romero@example.org', displayName: 'Dr. James Romero, MD', email: 'james.romero@example.org' },
  { loginName: 'i:0#.f|membership|sara.chen@example.org', displayName: 'Sara Chen', email: 'sara.chen@example.org' },
  { loginName: 'i:0#.f|membership|amir.khan@example.org', displayName: 'Amir Khan', email: 'amir.khan@example.org' }
];

/** In-memory {@link IPeopleRepository} for tests and local development without a live tenant. */
export class MockPeopleRepository implements IPeopleRepository {
  public constructor(private readonly _directory: readonly IPersonSearchResult[] = SAMPLE_DIRECTORY) {}

  public async searchPeople(query: string): Promise<IPersonSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }
    return this._directory.filter(
      (person) => person.displayName.toLowerCase().includes(q) || person.email?.toLowerCase().includes(q)
    );
  }

  public async ensurePerson(loginName: string): Promise<IRiskRegistryPerson> {
    const match = this._directory.find((person) => person.loginName === loginName);
    return {
      // Deterministic from the login name, like a real site user id would be
      // stable for the same person — not meaningful beyond "some number".
      id: hashToPositiveInt(loginName),
      displayName: match?.displayName ?? loginName,
      email: match?.email
    };
  }
}

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) + 1;
}
