/**
 * In-memory {@link IRiskRegistryListRepository} for tests and local
 * development without a live site.
 */

import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { IRiskRegistryListRepository } from '../IRiskRegistryListRepository';
import { RiskRegistryError } from '../IRiskRegistryRepository';

/** A small, representative sample set covering every card variation the design shows. */
export function buildSampleRiskRegistryListItems(): IRiskRegistryItem[] {
  return [
    {
      id: 842,
      etag: '',
      created: new Date('2025-10-24T09:00:00Z'),
      submittedBy: { id: 1, displayName: 'Dr. Sarah Lin, PharmD', email: 'sarah.lin@example.org' },
      fields: {
        riskId: 842,
        title: 'Automated Alaris Infusion Pump Dose Rate Discrepancy during Shift Handoff',
        riskStatus: 'Evaluation',
        riskPriorityRating: '4 - Noncompliance with safety risks that have reached the patient/visitor/workforce and caused harm (temporary or permanent)',
        hasHarmToPatientVisitorWorkforce: 'Yes',
        anticipatedResourceForCorrection: 'Pharmacy Informatics',
        microSystem: 'CICU',
        accountableExecutive: { id: 11, displayName: 'Dr. Michael Davies, MD', email: 'michael.davies@example.org' },
        evaluatorAssigned: { id: 21, displayName: 'Nina Patel, RN', email: 'nina.patel@example.org' }
      }
    },
    {
      id: 839,
      etag: '',
      created: new Date('2025-10-22T09:00:00Z'),
      submittedBy: { id: 2, displayName: 'RN Marcus Vance, BSN', email: 'marcus.vance@example.org' },
      fields: {
        riskId: 839,
        title: 'Surgical Specimen Mislabeling & Specimen Re-biopsy Delay in Cryo-Pathology',
        riskStatus: 'Assigned In-Progress',
        riskPriorityRating: '4 - Noncompliance with safety risks that have reached the patient/visitor/workforce and caused harm (temporary or permanent)',
        hasHarmToPatientVisitorWorkforce: 'Unknown',
        anticipatedResourceForCorrection: 'Clinical Effectiveness (CSW)',
        microSystem: 'Periop',
        accountableExecutive: { id: 12, displayName: 'Dr. Elena Rostova, MD', email: 'elena.rostova@example.org' },
        evaluatorAssigned: { id: 22, displayName: 'Tom Okafor, RN', email: 'tom.okafor@example.org' },
        capStatus: 'In Progress'
      }
    },
    {
      id: 835,
      etag: '',
      created: new Date('2025-10-21T09:00:00Z'),
      submittedBy: { id: 3, displayName: 'Karen Bradley, RPh', email: 'karen.bradley@example.org' },
      fields: {
        riskId: 835,
        title: 'Look-Alike Sound-Alike (LASA) Neuromuscular Blocker Automated Dispensing Near-Miss',
        riskStatus: 'Pending Assignment',
        riskPriorityRating: '4 - Noncompliance with safety risks that have reached the patient/visitor/workforce and caused harm (temporary or permanent)',
        hasHarmToPatientVisitorWorkforce: 'Yes',
        anticipatedResourceForCorrection: 'Pharmacy Informatics',
        microSystem: 'PICU',
        accountableExecutive: { id: 11, displayName: 'Dr. Michael Davies, MD', email: 'michael.davies@example.org' }
      }
    },
    {
      id: 831,
      etag: '',
      created: new Date('2025-10-19T09:00:00Z'),
      submittedBy: { id: 4, displayName: 'Dr. Jason Miller, MD', email: 'jason.miller@example.org' },
      fields: {
        riskId: 831,
        title: 'CT Scanner Contrast Extravasation Telemetry Protocol Bypass during Trauma Surge',
        riskStatus: 'New',
        riskPriorityRating: '3 - Noncomliance with safety risks that have reached the patient/visitor/workforce',
        hasHarmToPatientVisitorWorkforce: 'No',
        anticipatedResourceForCorrection: 'Clinical Analytics',
        microSystem: 'ED',
        accountableExecutive: { id: 13, displayName: 'Dr. Aris Thorne, MD', email: 'aris.thorne@example.org' }
      }
    },
    {
      id: 828,
      etag: '',
      created: new Date('2025-10-18T09:00:00Z'),
      submittedBy: { id: 5, displayName: 'Patricia Hayes, BSN, RN', email: 'patricia.hayes@example.org' },
      fields: {
        riskId: 828,
        title: 'Central Line-Associated Bloodstream Infection (CLABSI) Bundle Checklist Deviation',
        riskStatus: 'Assigned In-Progress',
        riskPriorityRating: '2 - Noncompliance with safety risks',
        hasHarmToPatientVisitorWorkforce: 'Yes',
        anticipatedResourceForCorrection: 'Clinical Analytics',
        microSystem: 'CICU',
        accountableExecutive: { id: 11, displayName: 'Dr. Michael Davies, MD', email: 'michael.davies@example.org' }
      }
    }
  ];
}

export interface IMockRiskRegistryListRepositoryOptions {
  readonly items?: readonly IRiskRegistryItem[];
  /** Rejects `getAll` with this instead of returning. */
  readonly failWith?: RiskRegistryError;
}

export class MockRiskRegistryListRepository implements IRiskRegistryListRepository {
  private readonly _items: readonly IRiskRegistryItem[];
  private readonly _options: IMockRiskRegistryListRepositoryOptions;

  public getAllCallCount = 0;

  public constructor(options: IMockRiskRegistryListRepositoryOptions = {}) {
    this._options = options;
    this._items = options.items ?? buildSampleRiskRegistryListItems();
  }

  public async getAll(): Promise<IRiskRegistryItem[]> {
    this.getAllCallCount += 1;

    if (this._options.failWith) {
      throw this._options.failWith;
    }

    return [...this._items];
  }
}
