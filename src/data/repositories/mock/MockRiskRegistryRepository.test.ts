import { buildSampleRiskRegistryItem, MockRiskRegistryRepository } from './MockRiskRegistryRepository';
import { RiskRegistryError, RiskRegistrySaveConflictError } from '../IRiskRegistryRepository';

describe('MockRiskRegistryRepository.getById', () => {
  it('returns the configured item for a matching id', async () => {
    const repository = new MockRiskRegistryRepository();
    const item = await repository.getById(482);
    expect(item.id).toBe(482);
  });

  it('rejects with a not-found RiskRegistryError for a non-matching id', async () => {
    const repository = new MockRiskRegistryRepository();
    await expect(repository.getById(9999)).rejects.toMatchObject({
      name: 'RiskRegistryError',
      kind: 'not-found'
    });
  });

  it('rejects with access-denied when configured to simulate it', async () => {
    const repository = new MockRiskRegistryRepository({
      failGetWith: new RiskRegistryError('access-denied', 'denied')
    });

    await expect(repository.getById(482)).rejects.toMatchObject({ kind: 'access-denied' });
  });

  it('is retryable only for a transient error', async () => {
    const repository = new MockRiskRegistryRepository({
      failGetWith: new RiskRegistryError('transient', 'blip')
    });

    try {
      await repository.getById(482);
      fail('expected getById to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(RiskRegistryError);
      expect((error as RiskRegistryError).isRetryable).toBe(true);
    }
  });
});

describe('MockRiskRegistryRepository.update — concurrency', () => {
  it('succeeds and advances the etag when the supplied etag matches the server copy', async () => {
    const item = buildSampleRiskRegistryItem();
    const repository = new MockRiskRegistryRepository({ item });

    const updated = await repository.update(item.id, item.etag, { RiskStatus: 'Evaluation' });

    expect(updated.etag).not.toBe(item.etag);
    expect(repository.updateCallCount).toBe(1);
  });

  it('rejects with RiskRegistrySaveConflictError when the supplied etag is stale', async () => {
    const item = buildSampleRiskRegistryItem();
    const repository = new MockRiskRegistryRepository({ item });

    // Simulate another user's save landing first.
    repository.simulateServerChange((current) => ({ ...current, etag: '"99"' }));

    await expect(repository.update(item.id, item.etag, { RiskStatus: 'Evaluation' })).rejects.toBeInstanceOf(
      RiskRegistrySaveConflictError
    );
  });

  it('the conflict error carries the current server item, not the caller\'s stale copy', async () => {
    const item = buildSampleRiskRegistryItem();
    const repository = new MockRiskRegistryRepository({ item });

    repository.simulateServerChange((current) => ({
      ...current,
      etag: '"99"',
      fields: { ...current.fields, riskStatus: 'Corrected - Hard Fix' }
    }));

    try {
      await repository.update(item.id, item.etag, { RiskStatus: 'Evaluation' });
      fail('expected update to reject with a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(RiskRegistrySaveConflictError);
      const conflict = error as RiskRegistrySaveConflictError;
      expect(conflict.serverItem.fields.riskStatus).toBe('Corrected - Hard Fix');
      expect(conflict.serverItem.etag).toBe('"99"');
    }
  });

  it('rejects for an id that does not match the stored item', async () => {
    const repository = new MockRiskRegistryRepository();
    await expect(repository.update(9999, '"1"', {})).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('MockRiskRegistryRepository.create', () => {
  it('returns a new item with an id distinct from the existing one, and a fresh etag', async () => {
    const existing = buildSampleRiskRegistryItem({ id: 482 });
    const repository = new MockRiskRegistryRepository({ item: existing });

    const created = await repository.create({ Title: 'Brand new risk' });

    expect(created.id).not.toBe(existing.id);
    expect(created.etag).toBeTruthy();
    expect(repository.createCallCount).toBe(1);
  });

  it('a subsequent getById resolves the item it just created', async () => {
    const repository = new MockRiskRegistryRepository();

    const created = await repository.create({ Title: 'Brand new risk' });
    const fetched = await repository.getById(created.id);

    expect(fetched.id).toBe(created.id);
  });

  it('rejects with the configured error when set up to simulate a failure', async () => {
    const repository = new MockRiskRegistryRepository({
      failCreateWith: new RiskRegistryError('transient', 'blip')
    });

    await expect(repository.create({ Title: 'Brand new risk' })).rejects.toMatchObject({ kind: 'transient' });
  });
});
