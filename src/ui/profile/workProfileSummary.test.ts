import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { workProfileSummary } from './workProfileSummary';
import { guardWorkerAreaOutput } from '../../../supabase/functions/_shared/workerAreaAdmission.mjs';
import { applyWorkerServiceChanges } from '../../../supabase/functions/_shared/conversationIntent.mjs';
import { withUnresolvedSinglePassReply } from '../../../supabase/functions/_shared/singlePassTaxonomy.mjs';
import { workerReviewPresentable, classificationPreparationMessage } from '../../features/ai/intake/intakeReviewReadiness';

describe('Celina 1: Radni profil — više gradova (workAreas) i očuvanje opisa (bio)', () => {
  it('workProfileSummary prikazuje sve gradove iz workAreas (Novi Sad · Beograd)', () => {
    const summary = workProfileSummary({
      stanje: 'ACTIVE',
      vestine: ['Selidbe i prevoz', 'Montaža nameštaja'],
      grad: 'Novi Sad',
      radijusKm: 20,
      workAreas: [
        { kind: 'RADIUS', countryCode: 'RS', city: 'Novi Sad', radiusKm: 20, label: 'Novi Sad · do 20 km', sourceRef: 'osm:relation:1', latitude: 45.25, longitude: 19.84 },
        { kind: 'RADIUS', countryCode: 'RS', city: 'Beograd', radiusKm: 30, label: 'Beograd · do 30 km', sourceRef: 'osm:relation:2', latitude: 44.81, longitude: 20.46 },
      ],
    });
    assert.ok(typeof summary === 'string');
    assert.ok(summary.includes('Aktivan'), `Očekivano da sadrži 'Aktivan', dobijeno: ${summary}`);
    assert.ok(summary.includes('Novi Sad · do 20 km · Beograd · do 30 km'), `Očekivano da sadrži oba grada, dobijeno: ${summary}`);
  });

  it('guardWorkerAreaOutput više ne briše patch.bio kada sadrži više gradova (Novi Sad i Beograd)', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Dodao sam i Beograd u područja rada i ažurirao opis profila.',
      patch: {
        bio: 'Radim selidbe i montažu nameštaja u Novom Sadu i Beogradu.',
        areaRequests: [
          { kind: 'RADIUS', countryCode: 'RS', query: 'Novi Sad', radiusKm: 20 },
          { kind: 'RADIUS', countryCode: 'RS', query: 'Beograd', radiusKm: 30 },
        ],
      },
    };
    const context = {
      candidate: {
        skills: ['Selidbe i prevoz'],
        location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        workAreas: [{ kind: 'RADIUS', countryCode: 'RS', city: 'Novi Sad', radiusKm: 20 }],
      },
    };
    const guarded = guardWorkerAreaOutput(output, 'Dodaj i Beograd na 30 km', context);
    assert.equal(guarded.patch.bio, 'Radim selidbe i montažu nameštaja u Novom Sadu i Beogradu.');
    assert.equal(guarded.patch.areaRequests.length, 2);
  });

  it('guardWorkerAreaOutput automatski dodaje novi grad uz postojeći kada korisnik kaže "Dodaj i Beograd"', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Dodat je i Beograd.',
      patch: {
        bio: 'Radim selidbe u Novom Sadu i Beogradu.',
      },
    };
    const context = {
      candidate: {
        skills: ['Selidbe'],
        location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        workAreas: [{ kind: 'RADIUS', countryCode: 'RS', city: 'Novi Sad', radiusKm: 20 }],
      },
    };
    const guarded = guardWorkerAreaOutput(output, 'Dodaj i Beograd', context);
    assert.ok(Array.isArray(guarded.patch.areaRequests));
    assert.equal(guarded.patch.areaRequests.length, 2);
  });
});

describe('Celina 2 & 3: Spremnost pregleda, očuvanje strimovane poruke i opuštena provera citata za usluge', () => {
  it('withUnresolvedSinglePassReply čuva prirodan AI odgovor umesto robotske poruke kada nema nejasnoća', () => {
    const turn = {
      safety: 'ALLOW',
      assistantMessage: 'Zabeležio sam sve podatke za čišćenje stana sutra u 10h uz budžet od 4000 RSD.',
      dialogue: { next: 'REVIEW', questionKey: '' },
    };
    const result = withUnresolvedSinglePassReply(turn, { unresolvedServices: ['Čišćenje'] }, null);
    assert.equal(result.assistantMessage, turn.assistantMessage);
    assert.equal(result.dialogue.next, 'REVIEW');
  });

  it('workerReviewPresentable dozvoljava prikaz pregleda i kada je classificationState PENDING_CLASSIFICATION ili REVIEW_REQUIRED', () => {
    const baseSnapshot: any = {
      status: 'OPEN',
      stale: false,
      safety: 'ALLOW',
      accountId: 'acc-1',
      conversationId: 'conv-1',
      profileId: 'prof-1',
      revision: 3,
      review: {
        accountId: 'acc-1',
        conversationId: 'conv-1',
        profileId: 'prof-1',
        revision: 3,
        canAccept: true,
        missingRequired: [],
        classificationState: 'PENDING_CLASSIFICATION',
        reviewedServiceModes: [{ service: 'Selidbe', mode: 'ON_SITE' }],
        profile: {
          workAreas: [{ kind: 'CITY', countryCode: 'RS', city: 'Novi Sad', radiusKm: null, label: 'Novi Sad', sourceRef: 'osm:relation:1', latitude: 45.25, longitude: 19.84 }],
          location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20 },
        },
      },
    };
    assert.equal(workerReviewPresentable(baseSnapshot), true);
    assert.equal(classificationPreparationMessage('PENDING_CLASSIFICATION'), null);
    assert.equal(classificationPreparationMessage('REVIEW_REQUIRED'), null);
  });

  it('applyWorkerServiceChanges prihvata promenu usluge i kada je u istoj poruci promenjen grad (WORKER_AREA)', () => {
    const output = {
      safety: 'ALLOW',
      assistantMessage: 'Dodao sam Beograd i uslugu montaže nameštaja.',
      patch: { bio: 'Radim selidbe i montažu nameštaja u Novom Sadu i Beogradu.' },
    };
    const changes = [
      { action: 'ADD', service: 'Montaža nameštaja', replacement: '', evidence: 'montažu nameštaja' },
    ];
    const candidate = { skills: ['Selidbe'] };
    const decision = { valid: true, intent: { kind: 'WORKER_AREA', evidence: 'Dodaj i Beograd i montažu nameštaja' } };
    const res = applyWorkerServiceChanges(output, changes, candidate, 'Dodaj i Beograd i radim montažu nameštaja.', decision);
    assert.equal(res.valid, true);
    assert.deepEqual(res.output.patch.skills, ['Selidbe', 'Montaža nameštaja']);
  });
});
