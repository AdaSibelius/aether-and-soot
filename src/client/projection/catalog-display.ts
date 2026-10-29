import limehouseJson from '../../../data/districts/limehouse_docks.json' with { type: 'json' };
import sootWorksJson from '../../../data/districts/soot_works.json' with { type: 'json' };
import whitechapelJson from '../../../data/districts/whitechapel_ward.json' with { type: 'json' };
import {
  getItemBlueprint,
  getProstheticBlueprint,
  humanizeIdentifier,
  resolveBlueprintDisplayName,
} from '../../sim/data/item-catalog.js';
import { METROPOLIS_DISTRICT_DOSSIERS } from '../../sim/spatial/overworld-matrix.js';

export { humanizeIdentifier };

export const DISTRICT_CATALOG: ReadonlyArray<{ id: string; name: string }> = [
  ...limehouseJson, ...sootWorksJson, ...whitechapelJson,
];

export const KNOWN_LANDMARKS: Readonly<Record<string, string>> = {
  landmark_water_pump: 'Victorian Municipal Water Pump',
  landmark_street_clocktower: 'Great St. Jude Street Clocktower',
  landmark_canal_lock: 'Limehouse Sunken Canal Lock & Winch',
  landmark_spire_greenhouse: 'Belgravia Spire Conservatory',
  foundry_boiler: 'High-Pressure Foundry Boiler',
  artificer_bench: 'Artificer Pneumatic Bench',
  monorail_depot: 'Spitalfields Monorail Depot',
  clocktower: 'St. Jude Street Clocktower',
  submerged_sluice: 'Fleet Ditch Sunken Sluice',
  syndicate_still: 'Black-Market Aether Still',
  catacomb_stairs: 'Chalk Crypt Descent',
  spire_greenhouse: 'Aetheric Aeroponic Greenhouse',
  cartel_bank: 'Clockwork Cartel Bullion Vault',
  spire_lift: 'Pneumatic Grand Elevator',
};

/**
 * Resolves raw entity IDs, district blueprint IDs, landmarks, prosthetics, and item keys into player-facing display names.
 * Falls back to Title-Case humanization if no blueprint matches.
 */
export function resolveCatalogDisplayName(kind: string, id: string): string {
  if (!id) return '';
  const k = kind.toLowerCase();

  if (k === 'district') {
    const dossier = METROPOLIS_DISTRICT_DOSSIERS[id];
    if (dossier?.name) return dossier.name;
    const fromJson = DISTRICT_CATALOG.find((d) => d.id === id);
    if (fromJson?.name) return fromJson.name;
  }

  if (k === 'landmark') {
    if (KNOWN_LANDMARKS[id]) return KNOWN_LANDMARKS[id]!;
    for (const dossier of Object.values(METROPOLIS_DISTRICT_DOSSIERS)) {
      const match = dossier.landmarks?.find((l) => l.id === id);
      if (match?.name) return match.name;
    }
  }

  if (k === 'prosthetic') {
    const p = getProstheticBlueprint(id);
    if (p?.name) return p.name;
  }

  if (k === 'item' || k === 'material' || k === 'consumable' || k === 'commodity' || k === 'recipe') {
    const item = getItemBlueprint(id);
    if (item?.name) return item.name;
  }

  const bpName = resolveBlueprintDisplayName(id);
  if (bpName && bpName !== id) return bpName;

  return humanizeIdentifier(id);
}
