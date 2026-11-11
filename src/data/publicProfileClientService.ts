import type { JavniProfilProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type PublicProfileService = {
  javniProfil(profileId: string, signal?: AbortSignal): ReturnType<Izvor['javniProfil']>;
};

function mapPublicProfile(raw: any): JavniProfilProjekcija {
  if (!raw || typeof raw !== 'object') throw new Error('PUBLIC_PROFILE_INVALID_PROJECTION');
  if (typeof raw.profileId !== 'string' || !raw.profileId) throw new Error('PUBLIC_PROFILE_ID_MISSING');
  if (raw.role !== 'REQUESTER' && raw.role !== 'WORKER') throw new Error('PUBLIC_PROFILE_ROLE_UNSUPPORTED');

  const trust = raw.trust;
  if (!trust || typeof trust !== 'object') throw new Error('PUBLIC_PROFILE_TRUST_INVALID');

  const completedCount = trust.completedCount;
  if (typeof completedCount !== 'number' || !Number.isSafeInteger(completedCount) || completedCount < 0) {
    throw new Error('PUBLIC_PROFILE_COMPLETED_COUNT_INVALID');
  }

  const reviewsAvailable = trust.reviewsAvailable === true;
  const count = trust.reviewCount, average = trust.ratingAverage;
  if (reviewsAvailable) {
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        (count === 0 ? average !== null || trust.ratingAvailable !== false
          : typeof average !== 'number' || !Number.isFinite(average) || average < 1 || average > 5 || trust.ratingAvailable !== true)) {
      throw new Error('PUBLIC_PROFILE_RATING_INVALID');
    }
  } else if (count !== null || average !== null || trust.ratingAvailable !== false) {
    throw new Error('PUBLIC_PROFILE_RATING_INVALID');
  }

  return {
    profilId: raw.profileId,
    uloga: raw.role === 'REQUESTER' ? 'narucilac' : 'uskocer',
    ime: typeof raw.displayName === 'string' ? raw.displayName : null,
    avatarPutanja: typeof raw.avatarPath === 'string' ? raw.avatarPath : null,
    grad: typeof raw.city === 'string' ? raw.city : null,
    naslov: typeof raw.publicSummary?.headline === 'string' ? raw.publicSummary.headline : null,
    biografija: typeof raw.publicSummary?.bio === 'string' ? raw.publicSummary.bio : null,
    poverenje: {
      ocenaProsek: typeof trust.ratingAverage === 'number' ? trust.ratingAverage : null,
      brojRecenzija: Number.isInteger(trust.reviewCount) && trust.reviewCount >= 0 ? trust.reviewCount : null,
      zavrseniBroj: completedCount,
      identitetVerifikovan: trust.identityVerified === true,
      ocenaDostupna: trust.ratingAvailable === true,
      recenzijeDostupne: trust.reviewsAvailable === true,
      verifikacijaIdentitetaDostupna: trust.identityVerificationAvailable === true,
    },
  };
}

/**
 * RU-5 / P0C-01 typed read boundary.
 *
 * The server owns the public/private cut. This client never reads another
 * account's raw app_profiles row and never reconstructs rating, review,
 * verification, completed-work, availability, radius, tool or vehicle truth.
 */
export const publicProfileClientService: PublicProfileService = {
  async javniProfil(profileId, signal) {
    const id = profileId.trim();
    if (!id) return null;

    let result;
    try {
      if (signal?.aborted) throw new Error('PUBLIC_PROFILE_READ_ABORTED');
      const request = supabase.rpc('rpc_get_public_profile', { p_profile_id: id });
      result = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request);
      if (signal?.aborted) throw new Error('PUBLIC_PROFILE_READ_ABORTED');
    }
    catch { throw new Error('PUBLIC_PROFILE_READ_FAILED'); }
    const { data, error } = result;
    if (error) throw new Error(error.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'PUBLIC_PROFILE_READ_FAILED');
    return data ? mapPublicProfile(data) : null;
  },
};
