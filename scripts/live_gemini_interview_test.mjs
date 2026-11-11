// Istorijska DEV Need proba sa običnim QA nalogom; nije native ili dva-naloga E2E dokaz.
import { createClient } from '@supabase/supabase-js';

import { readFileSync } from 'node:fs';

const preview = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build.preview.env;
const SUPABASE_URL = preview.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = preview.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (SUPABASE_URL !== 'https://leqcwgzvjsxugfgzdmth.supabase.co'
  || !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(ANON_KEY ?? '')) {
  console.error('Potreban je kanonski DEV preview sa važećim javnim ključem.'); process.exit(1);
}

function requiredQaEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`MISSING_QA_ENV:${name}`);
  return value;
}

async function main() {
  console.log('=== POKRETANJE PRAVOG RAZGOVORA SA GEMINIJEM NA DEV SERVERU ===\n');


  const testEmail = requiredQaEnv('QA_REQUESTER_EMAIL');
  const testPassword = requiredQaEnv('QA_REQUESTER_PASSWORD');
  console.log('[1/5] Koristim QA nalog iz okruženja.');

  // 2. Sign in to get user session / JWT
  console.log('[2/5] Prijavljujem korisnika...');
  const userClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionData, error: sessionError } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (sessionError || !sessionData.session) {
    console.error('Greška pri prijavi:', sessionError?.message);
    return;
  }
  const token = sessionData.session.access_token;
  console.log('  Korisnik uspešno prijavljen, dobijen JWT token.\n');

  // 3. Open conversation via RPC
  console.log('[3/5] Otvaram AI razgovor (rpc_ai_open_need_conversation_owned_v2)...');
  const openRequestId = crypto.randomUUID();
  const { data: openData, error: openError } = await userClient.rpc('rpc_ai_open_need_conversation_owned_v2', {
    p_client_request_id: openRequestId
  });

  if (openError || !openData?.conversationId) {
    console.error('Greška pri otvaranju razgovora:', openError?.message || openData);
    return;
  }
  const conversationId = openData.conversationId;
  console.log(`  Razgovor otvoren! ID: ${conversationId}\n`);

  // Helper for sending turns
  async function sendTurn(turnNumber, userMessage) {
    console.log(`----------------------------------------------------------------`);
    console.log(`KORISNIK [Poruka ${turnNumber}]: "${userMessage}"`);
    console.log(`Slanje na uskoci-ai-interview...`);
    const t0 = performance.now();

    const clientRequestId = crypto.randomUUID();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/uskoci-ai-interview`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId,
        clientRequestId,
        text: userMessage
      })
    });

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    const data = await res.json();

    console.log(`\nODGOVOR STIGAO ZA: ${elapsed} sekundi (Status: ${res.status})`);
    
    // Read turn recovery or review to see updated facts
    const { data: review } = await userClient.rpc('rpc_ai_need_review_v2', {
      p_conversation_id: conversationId
    });

    console.log(`\nGEMINI ODGOVARA:`);
    console.log(`"${data.receipt?.assistantMessage || data.assistantMessage || JSON.stringify(data)}"`);

    console.log(`\nTRENUTNA KARTICA U BAZI (Sve što je AI razumeo i spakovao):`);
    if (review?.facts) {
      for (const f of review.facts) {
        if (f.status !== 'UNKNOWN') {
          const k = f.key ?? f.fact_key ?? f.id;
          const v = f.value ?? f.fact_value ?? f.displayValue;
          console.log(`  • ${k}: ${JSON.stringify(v)}`);
        }
      }
    } else {
      console.log('  (Nema činjenica ili još uvek nepoznato)');
    }
    console.log(`----------------------------------------------------------------\n`);
  }

  // TURN 1: Novi, egzotičan zadatak sa emocijom
  await sendTurn(1, 'Ćao druže! Treba mi neko da mi pomogne oko menjanja i skupljanja sličica za svetsko prvenstvo.');
  await new Promise(r => setTimeout(r, 1500));

  // TURN 2: Lokacija, termin, novac
  await sendTurn(2, 'Ja sam u Novom Sadu kod Spensa. Voleo bih sutra u 17h ako neko može da uskoči, platio bih 1500 dinara.');
  await new Promise(r => setTimeout(r, 1500));

  // TURN 3: Promena i prelazak na online/daljinu
  await sendTurn(3, 'A reci mi, ako se javi neko iz drugog grada, možemo li to da odradimo online preko video poziva i da pošaljemo sličice poštom?');
  await new Promise(r => setTimeout(r, 1500));

  // TURN 4: Završetak i potvrda
  await sendTurn(4, 'Super, to je to, sve mi odgovara!');

  console.log('[5/5] Završen razgovor.');
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'QA_SCRIPT_FAILED'); process.exitCode = 1; });
