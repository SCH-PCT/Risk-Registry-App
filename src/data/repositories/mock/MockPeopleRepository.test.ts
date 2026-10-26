import { MockPeopleRepository } from './MockPeopleRepository';

describe('MockPeopleRepository', () => {
  describe('searchPeople', () => {
    it('returns no matches for a query shorter than 2 characters', async () => {
      expect(await new MockPeopleRepository().searchPeople('a')).toEqual([]);
    });

    it('matches by display name, case-insensitively', async () => {
      const results = await new MockPeopleRepository().searchPeople('sara');
      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('Sara Chen');
    });

    it('matches by email', async () => {
      const results = await new MockPeopleRepository().searchPeople('amir.khan@example.org');
      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('Amir Khan');
    });

    it('returns no matches for a query that matches nobody in the sample directory', async () => {
      expect(await new MockPeopleRepository().searchPeople('nobody-like-this')).toEqual([]);
    });
  });

  describe('ensurePerson', () => {
    it('resolves a known directory login to its sample person, with a stable numeric id', async () => {
      const repository = new MockPeopleRepository();
      const [match] = await repository.searchPeople('sara');

      const resolved = await repository.ensurePerson(match.loginName);

      expect(resolved.displayName).toBe('Sara Chen');
      expect(resolved.email).toBe('sara.chen@example.org');
      expect(typeof resolved.id).toBe('number');
    });

    it('is deterministic for the same login name', async () => {
      const repository = new MockPeopleRepository();
      const first = await repository.ensurePerson('i:0#.f|membership|anyone@example.org');
      const second = await repository.ensurePerson('i:0#.f|membership|anyone@example.org');
      expect(first.id).toBe(second.id);
    });

    it('still resolves (falling back to the login name as the display name) for a login not in the sample directory', async () => {
      const resolved = await new MockPeopleRepository().ensurePerson('i:0#.f|membership|unknown@example.org');
      expect(resolved.displayName).toBe('i:0#.f|membership|unknown@example.org');
      expect(typeof resolved.id).toBe('number');
    });
  });
});
