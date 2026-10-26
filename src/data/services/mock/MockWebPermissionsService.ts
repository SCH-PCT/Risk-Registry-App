import { IWebPermissionsService } from '../IWebPermissionsService';

/** In-memory implementation for tests and local development. */
export class MockWebPermissionsService implements IWebPermissionsService {
  public constructor(
    private readonly _canEdit: boolean = true,
    private readonly _canAdd: boolean = true
  ) {}

  public async canEditItem(): Promise<boolean> {
    return this._canEdit;
  }

  public async canAddItems(): Promise<boolean> {
    return this._canAdd;
  }
}
