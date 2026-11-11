import { agreementClientService } from './agreementClientService';
import { applicationClientService } from './applicationClientService';
import { applicationSelectionClientService } from './applicationSelectionClientService';
import { aiNeedV2Production } from './aiNeedV2Production';
import { candidateClientService } from './candidateClientService';
import { contactClientService } from './contactClientService';
import { lazniIzvor } from './lazniIzvor';
import { needClientService } from './needClientService';
import { publicProfileClientService } from './publicProfileClientService';
import { responseClientService } from './responseClientService';
import { supabaseIzvor } from './supabaseIzvor';
import { supabaseKonfigurisan } from './supabaseClient';
import { workerProfileClientService } from './workerProfileClientService';
import { Izvor } from './ports';
import { homeAttentionClientService } from './homeAttentionClientService';

// Eksplicitna kompoziciona granica.
//
// Lazni izvor je dozvoljen SAMO u testu ili uz izricit DEV prekidac.
// Produkcijski put NIKAD ne pada tiho na lazni izvor: ako Supabase nije
// konfigurisan, puca odmah i glasno, jer bi tiho prebacivanje znacilo da
// aplikacija radi na izmisljenim podacima a niko to ne vidi.

const uTestu = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const izricitLazni = process.env.EXPO_PUBLIC_USE_FAKE_SOURCE === '1';

const koristiLazniIzvor = uTestu || izricitLazni;

if (!koristiLazniIzvor && !supabaseKonfigurisan()) {
  throw new Error(
    'SUPABASE_NIJE_KONFIGURISAN: produkcijski put ne sme da padne na lazni izvor. ' +
      'Postavi EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY, ' +
      'ili za DEV eksplicitno EXPO_PUBLIC_USE_FAKE_SOURCE=1.',
  );
}

// Existing adapter remains the baseline while strict canonical closures replace
// known unsafe/incorrect paths. CDL-A03 physically removed legacy Need reads;
// needClientService is their only production owner. CDL-A04 physically removed
// both lower response-viewed owners; responseClientService is its only owner.
// CDL-A05 consolidated PHONE grants and CDL-A08 exact-location reveal;
// contactClientService is the canonical contact/privacy owner for those paths.
// CDL-A09 makes workerProfileClientService the sole Worker-profile mutation owner,
// preserving DRAFT creation and server-authoritative activation by profile id.
// CDL-A06/A07 moved problem reporting and completion marking into Agreement service.
// AI intake uses the separate V2 boundary below; the central port owns only
// the non-AI reads and commands.
// RU-5 P0C-01 owns cross-account profile reads through a narrow public RPC;
// raw app_profiles remains owner-only and is never opened for marketplace cards.
// RU-5 P0D-01 makes candidateClientService the sole Requester candidate-list
// owner; raw response/version reads do not feed R05 directly anymore.
const produkcijskiIzvor: Izvor = {
  ...supabaseIzvor,
  ...applicationClientService,
  ...applicationSelectionClientService,
  ...candidateClientService,
  ...workerProfileClientService,
  ...publicProfileClientService,
  ...contactClientService,
  ...responseClientService,
  ...needClientService,
  ...agreementClientService,
  ...homeAttentionClientService,
  poreklo: 'supabase',
};

export const izvor: Izvor = koristiLazniIzvor ? lazniIzvor : produkcijskiIzvor;

// The signed conversation/review/Save/publish path always uses V2, including
// when the non-AI test/demo source is selected explicitly.
export const aiNeedV2Izvor = aiNeedV2Production;
