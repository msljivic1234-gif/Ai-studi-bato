"""Bounded ordinary-Auth continuation on two already approved TEST fixtures.

Uses the one coordinator-approved existing TOTAL task. No model, publication,
admin business writer, account creation, deletion or automatic mutation retry.
Every command identity/body is durable before dispatch. A transport-unknown or
unproven response stops the run; only read-only recovery is safe afterwards.
Credentials, raw IDs, messages and tokens stay in mode-0600 private scratch.
"""
from pathlib import Path
import argparse
import base64
import datetime
import hashlib
import importlib.util
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROJECT = 'leqcwgzvjsxugfgzdmth'
TARGET_HASH = '79abe6784db987340b592e07f11e238f8d54cea85a87b7a3640a1066656268b1'
UUID = re.compile(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$', re.I)
READ_RPCS = {'rpc_read_task', 'rpc_list_need_candidates', 'rpc_get_agreement_workspace',
             'rpc_read_selection_result', 'rpc_read_response_submit_result', 'rpc_agreement_cancellation_v1', 'rpc_read_agreement_messages_page_v1'}
WRITE_RPCS = {'rpc_submit_response', 'rpc_select_response', 'rpc_cancel_agreement'}
TERMS = ['revision', 'mode', 'requester_price_rsd', 'price_basis', 'required_slots',
         'title', 'description', 'schedule_kind', 'starts_at', 'ends_at', 'response_deadline',
         'execution_location_mode', 'required_skills', 'required_tools', 'required_vehicles']


class StopFlow(Exception):
    pass


def check(condition, code):
    if not condition:
        raise StopFlow(code)


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(value):
    if isinstance(value, str):
        value = value.encode()
    elif not isinstance(value, bytes):
        value = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    return hashlib.sha256(value).hexdigest()


class Flow:
    def __init__(self, args):
        self.args, self.root = args, Path(__file__).resolve().parent.parent
        self.path = args.qa_directory / 'private-r07-pricing-r08-20261107.json'
        previous_run = json.loads(self.path.read_text()) if self.path.exists() else None
        check(not previous_run or args.verify_refusal, 'RUN_ALREADY_EXISTS_READ_STATE_BEFORE_CONTINUING')
        check(not args.verify_refusal or previous_run is not None, 'REFUSAL_STATE_REQUIRED')
        old = json.loads((args.qa_directory / 'private-e2e-state.json').read_text())
        self.previous_agreement = old['objects']['agreement']
        lineage_path = args.qa_directory.parent / 'r08-qa-fixture-lineage-setup.receipt.json'
        lineage = json.loads(lineage_path.read_text())
        check(old['project'] == lineage['project'] == PROJECT and old['lineageReceiptSha256'] == sha(lineage_path.read_bytes()), 'TEST_LINEAGE_MISMATCH')
        check(len(lineage['readback']) == 2 and all(r['visibility_world'] == 'TEST' and r['non_production']
              and r['lineage'] == 'SYNTHETIC_ACCEPTANCE_FIXTURE' for r in lineage['readback']), 'TEST_LINEAGE_REQUIRED')
        server = json.loads(args.server_preflight.read_text())
        check(server['project'] == PROJECT and server['r08_migration'] == '20261107165358'
              and all(r['world'] == 'TEST' and r['lineage'] == 'SYNTHETIC_ACCEPTANCE_FIXTURE' for r in server['accounts']), 'LIVE_TEST_PREFLIGHT_REQUIRED')
        helper = next(r for r in server['functions'] if r['signature'] == 'private.agreement_cancellation_facts_v1(uuid)')
        check(helper['body_md5'] == 'ec935f3da29105d0308f9952f9acd58f', 'R08_READER_NOT_DEPLOYED')
        check((datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(server['observed_at'])).total_seconds() < 1800, 'SERVER_PREFLIGHT_EXPIRED')

        spec = importlib.util.spec_from_file_location('r07_existing_ordinary_auth', args.qa_directory / 'public_api_preflight.py')
        self.auth = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.auth)
        config = json.loads((self.root / 'eas.json').read_text())['build']['preview']['env']
        self.auth.BASE = config['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
        self.auth.KEY = config.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or config.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')
        check(self.auth.BASE == 'https://' + PROJECT + '.supabase.co', 'CANONICAL_DEV_REQUIRED')
        if self.auth.KEY.startswith('eyJ'):
            key_claims = self.claims(self.auth.KEY)
            check(key_claims.get('role') == 'anon', 'PUBLIC_KEY_ONLY')
        else:
            check(self.auth.KEY.startswith('sb_publishable_'), 'PUBLIC_KEY_ONLY')

        inventory = json.loads((args.qa_directory / 'private-r07-price-inventory-20261107.json').read_text())
        target = next((r for r in inventory['needs']['worker'] if sha(r['id']) == TARGET_HASH), None)
        check(target and target['mode'] == 'MY_PRICE' and target['price_basis'] == 'TOTAL', 'APPROVED_TOTAL_FIXTURE_REQUIRED')
        saved = json.loads(self.auth.STATE.read_text())
        self.actors = {}
        for label, role, old_role in [('1', 'requester', 'worker'), ('2', 'worker', 'requester')]:
            account = saved[label]
            session = account['session']
            expected = old['accountIdSha256'][old_role]
            check(sha(session['accountId']) == expected and any(row['id_sha256'] == expected for row in server['accounts']), 'ACTOR_NOT_APPROVED_TEST')
            email, password = self.auth.credentials(int(label))
            if session.get('expiresAt', 0) <= time.time() + 90:
                result = self.auth.request('/auth/v1/token?grant_type=password', body={'email': email, 'password': password})
                check(result['status'] == 200 and result['data']['user']['id'] == session['accountId'], 'ORDINARY_LOGIN_FAILED')
                data = result['data']
                session = {'accessToken': data['access_token'], 'expiresAt': data['expires_at'], 'accountId': data['user']['id']}
                account['session'] = session
                self.auth.private_write(self.auth.STATE, saved)
            own = self.auth.request('/auth/v1/user', session['accessToken'])
            claims = self.claims(session['accessToken'])
            check(own['status'] == 200 and own['data']['id'] == session['accountId'] and own['data']['email'] == email
                  and own['data']['role'] == 'authenticated' and claims.get('sub') == session['accountId']
                  and claims.get('role') == 'authenticated' and UUID.fullmatch(claims.get('session_id', '')), 'REAL_ORDINARY_AUTH_REQUIRED')
            self.actors[role] = session
        check(self.actors['requester']['accountId'] != self.actors['worker']['accountId'], 'DISTINCT_ACCOUNTS_REQUIRED')
        worker_profile = next(row for row in saved['2']['profiles'] if row['kind'] == 'WORKER')
        check(worker_profile['account_id'] == self.actors['worker']['accountId'], 'WORKER_PROFILE_OWNERSHIP')
        self.state = previous_run or {'createdAtUtc': utc(), 'project': PROJECT, 'baseSourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip(),
                      'serverPreflightSha256': sha(args.server_preflight.read_bytes()), 'lineageReceiptSha256': sha(lineage_path.read_bytes()),
                      'actors': {role: {'accountIdSha256': sha(value['accountId']), 'authRole': 'authenticated', 'sessionIdPresent': True} for role, value in self.actors.items()},
                      'objects': {'need': target['id'], 'workerProfile': worker_profile['id']},
                      'keys': {name: str(uuid.uuid4()) for name in ['submit', 'select']}, 'operations': {}, 'checks': {}, 'status': 'RUNNING'}
        self.save()

    @staticmethod
    def claims(token):
        value = token.split('.')[1]
        return json.loads(base64.urlsafe_b64decode(value + '=' * (-len(value) % 4)))

    def save(self):
        self.auth.private_write(self.path, self.state)
        receipt = {key: self.state[key] for key in ['createdAtUtc', 'project', 'baseSourceCommit', 'serverPreflightSha256', 'lineageReceiptSha256', 'actors', 'checks', 'status']}
        receipt.update({'schema': 'USKOCI_R07_TOTAL_R08_ORDINARY_AUTH_V1', 'updatedAtUtc': utc(),
                        'objectIdSha256': {key: sha(value) for key, value in self.state['objects'].items()},
                        'operations': [{key: row[key] for key in ['name', 'actor', 'kind', 'state', 'rpc', 'httpStatus', 'sqlstate', 'safeCode', 'elapsedMs', 'bodySha256', 'harnessSha256'] if key in row}
                                       for row in self.state['operations'].values()],
                        'ordinaryAuthBusinessWriter': any(row['kind'] == 'WRITE' for row in self.state['operations'].values()),
                        'businessWriterAttempts': sum(row['kind'] == 'WRITE' for row in self.state['operations'].values()),
                        'confirmedBusinessWrites': sum(row['kind'] == 'WRITE' and row['state'] == 'CONFIRMED' for row in self.state['operations'].values()),
                        'adminBusinessWriter': False, 'modelCalls': 0, 'newAccounts': 0, 'deletions': 0,
                        'boundary': 'Ordinary authenticated DEV API evidence only. No Android, production, three-actor concurrency, PER_PERSON or OFFERS acceptance is claimed.',
                        'blockedScopes': {'PER_PERSON': 'No approved existing fixture; new publication requires its real evaluator and closed AI budget.',
                                          'OFFERS': 'No approved existing fixture; publication approval is not bypassed.',
                                          'threeActorCapacity': 'Only two credentialed approved TEST actors are present.'}})
        if self.state.get('lastStop'):
            receipt['lastStop'] = self.state['lastStop']
        self.args.receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')

    def request(self, name, role, path, body=None, write=False, rpc=None):
        check(name not in self.state['operations'], 'OPERATION_ALREADY_RECORDED_NO_AUTOMATIC_RETRY')
        if write:
            check(not self.args.verify_refusal, 'REFUSAL_VERIFICATION_IS_READ_ONLY')
            check(rpc in WRITE_RPCS, 'BOUNDED_ORDINARY_WRITER_ONLY')
        row = {'name': name, 'actor': role, 'kind': 'WRITE' if write else 'READ', 'state': 'PENDING', 'rpc': rpc,
               'bodySha256': sha(body), 'path': path, 'body': body, 'startedAtUtc': utc(), 'harnessSha256': sha(Path(__file__).read_bytes())}
        self.state['operations'][name] = row
        self.save()
        headers = {'apikey': self.auth.KEY, 'Authorization': 'Bearer ' + self.actors[role]['accessToken'], 'Content-Type': 'application/json'}
        req = urllib.request.Request(self.auth.BASE + path, headers=headers, method='POST' if body is not None else 'GET',
                                     data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
        started = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read(1_048_577)
                check(len(raw) <= 1_048_576, 'BOUNDED_READ_EXCEEDED')
                data = json.loads(raw) if raw.strip() else None
                row.update({'httpStatus': response.status, 'data': data, 'state': 'CONFIRMED'})
                return data
        except urllib.error.HTTPError as error:
            raw = error.read(8192)
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
            code, message = data.get('code'), data.get('message', '')
            row.update({'httpStatus': error.code, 'state': 'REFUSED', 'data': data,
                        'sqlstate': code if re.fullmatch(r'[A-Z0-9_]{1,30}', str(code)) else None,
                        'safeCode': message if re.fullmatch(r'[A-Z0-9_]{1,120}', str(message)) else 'HTTP_FAILURE'})
            raise StopFlow(name.upper() + '_' + row['safeCode'])
        except Exception as error:
            row.update({'state': 'UNKNOWN_OUTCOME', 'safeCode': str(error) if isinstance(error, StopFlow) else type(error).__name__})
            raise StopFlow(name.upper() + '_UNKNOWN_OUTCOME')
        finally:
            row['elapsedMs'] = round((time.monotonic() - started) * 1000, 1)
            self.save()
            print(json.dumps({key: row.get(key) for key in ['name', 'actor', 'state', 'httpStatus', 'safeCode'] if row.get(key) is not None}), flush=True)

    def rpc(self, name, role, rpc, body, write=False):
        check(rpc in (WRITE_RPCS if write else READ_RPCS), 'PUBLIC_RPC_ALLOWLIST')
        return self.request(name, role, '/rest/v1/rpc/' + rpc, body, write, rpc)

    def versions(self, name, role, agreement):
        return self.request(name, role, '/rest/v1/agreement_versions?' + urllib.parse.urlencode({
            'agreement_id': 'eq.' + agreement, 'select': 'version,status,terms', 'order': 'version.asc'}))

    def check_task(self, row, expected_covered, open_required=False):
        check(row and row['id'] == self.state['objects']['need'] and row['mode'] == 'MY_PRICE' and row['price_basis'] == 'TOTAL'
              and row['requester_price_rsd'] == 12000 and row['required_slots'] == 1 and row['covered_slots'] == expected_covered, 'TOTAL_TASK_MEANING_CHANGED')
        if open_required:
            now = datetime.datetime.now(datetime.timezone.utc)
            check(row['status'] in ['PUBLISHED', 'SELECTION'] and row['remaining_search_closed_at'] is None
                  and (row['response_deadline'] is None or datetime.datetime.fromisoformat(row['response_deadline']) > now)
                  and row['schedule_kind'] == 'FIXED_WINDOW' and datetime.datetime.fromisoformat(row['ends_at']) > now, 'TASK_NOT_ADMITTED_NOW')
        if self.state.get('needTerms'):
            check({key: row.get(key) for key in TERMS} == self.state['needTerms'], 'ORIGINAL_NEED_TERMS_CHANGED')

    def verify_refusal(self):
        rejected = self.state['operations']['applicationSubmit']
        check(rejected['state'] == 'REFUSED' and rejected['sqlstate'] == 'P0001' and rejected['safeCode'] == 'WORKER_NOT_ELIGIBLE'
              and json.loads(rejected['data']['details']) == ['CALENDAR_CONFLICT'], 'EXACT_REFUSAL_REQUIRED')
        command = rejected['body']
        result = self.rpc('refusedCommandReadback', 'worker', 'rpc_read_response_submit_result', command)
        check(result.get('authoritative') is True and result.get('found') is False and result.get('result') is None, 'REFUSED_COMMAND_UNEXPECTEDLY_COMMITTED')
        need = self.state['objects']['need']
        after = self.rpc('taskAfterRefusal', 'requester', 'rpc_read_task', {'p_need_id': need})
        self.check_task(after, 0)
        candidates = self.rpc('candidatesAfterRefusal', 'requester', 'rpc_list_need_candidates', {'p_need_id': need})
        check(candidates == [], 'REFUSAL_CREATED_CANDIDATE')
        calendar = json.loads(self.args.calendar_evidence.read_text())
        check(calendar['conflict_count'] == 1 and len(calendar['conflicts']) == 1, 'CALENDAR_EVIDENCE_REQUIRED')
        conflict = calendar['conflicts'][0]
        check(conflict['live_agreement_status'] == 'CONFIRMED' and conflict['execution_state'] == 'CONFIRMED'
              and conflict['execution_mode'] == 'PHYSICAL' and conflict['execution_location_mode'] == 'STATIONARY'
              and conflict['calendar_state'] == 'BLOCKING' and all(conflict[key] for key in
                  ['calendar_version_matches', 'execution_version_matches', 'worker_matches', 'accepted_interval_matches']), 'CALENDAR_RESERVATION_NOT_PROVEN')
        self.state['checks']['refusalReadback'] = {'httpStatus': 400, 'sqlstate': 'P0001', 'code': 'WORKER_NOT_ELIGIBLE',
                                                   'hardBlockers': ['CALENDAR_CONFLICT'], 'readOnlyCommandResult': 'NOT_FOUND',
                                                   'candidateCountBeforeAndAfter': 0, 'coveredSlotsBeforeAndAfter': 0,
                                                   'needTermsSha256After': sha({key: after.get(key) for key in TERMS}),
                                                   'originalNeedTermsUnchanged': True, 'newResponseOrAgreementCreated': False,
                                                   'noWriterRetry': True}
        self.state['checks']['calendarConflictEvidence'] = calendar
        self.save()
        for role in ['requester', 'worker']:
            read = self.rpc(role + 'ExistingCompletedCancellationRead', role, 'rpc_agreement_cancellation_v1', {'p_agreement_ids': [self.previous_agreement]})
            check(read['schema'] == 'AGREEMENT_CANCELLATION_V1' and read['authoritative'] is True and len(read['items']) == 1, 'EXISTING_CANCELLATION_ENVELOPE_INVALID')
            row = read['items'][0]
            check(row['agreementId'] == self.previous_agreement and row['cancelled'] is False and row['reason'] is None
                  and row['reasonState'] is None and row['cancelledAt'] is None, 'COMPLETED_AGREEMENT_FALSLY_CANCELLED')
        self.state['checks']['r08Reader'] = {'ordinaryParticipantReads': 2, 'schema': 'AGREEMENT_CANCELLATION_V1',
                                           'existingCompletedAgreementSha256': sha(self.previous_agreement), 'bothReturnNotCancelled': True,
                                           'noReasonInvented': True, 'positive4000CharacterCancellation': 'BLOCKED_NO_NEW_ELIGIBLE_AGREEMENT'}
        self.state['status'] = 'DEV_ORDINARY_AUTH_TOTAL_BLOCKED_BY_CONFIRMED_CALENDAR_RESERVATION'
        self.save()

    def run(self):
        need = self.state['objects']['need']
        before = self.rpc('taskImmediatelyBeforeSubmit', 'worker', 'rpc_read_task', {'p_need_id': need})
        self.check_task(before, 0, True)
        self.state['needTerms'] = {key: before.get(key) for key in TERMS}
        self.state['checks']['preflight'] = {'taskIdSha256': sha(need), 'priceRsd': 12000, 'priceBasis': 'TOTAL', 'requiredSlots': 1,
                                           'coveredSlots': 0, 'ordinaryPublicRead': True, 'endStillInFutureAtDispatch': True,
                                           'needTermsSha256': sha(self.state['needTerms'])}
        self.save()
        body = {'p_need_id': need, 'p_need_revision': before['revision'], 'p_worker_profile_id': self.state['objects']['workerProfile'],
                'p_covered_slots': 1, 'p_price_rsd': 12000, 'p_proposed_start_at': None, 'p_proposed_end_at': None,
                'p_scope_note': 'QA R07 TOTAL: jedna osoba, ukupno 12.000 RSD. Izolovan TEST, bez stvarne usluge ili naplate.',
                'p_client_request_id': self.state['keys']['submit']}
        application = self.rpc('applicationSubmit', 'worker', 'rpc_submit_response', body, True)
        check(application['applicationPriceBasis'] == 'TOTAL' and application['priceRsd'] == 12000 and application['currency'] == 'RSD'
              and application['coveredSlots'] == 1 and UUID.fullmatch(application['responseId']), 'APPLICATION_PRICE_NOT_CONFIRMED')
        self.state['objects']['response'] = application['responseId']
        self.state['application'] = application
        self.state['checks']['application'] = {'priceRsd': 12000, 'basis': 'TOTAL', 'currency': 'RSD', 'people': 1, 'version': application['version']}
        self.save()
        replay = self.rpc('applicationSameKeyReplay', 'worker', 'rpc_submit_response', body, True)
        check(replay.get('idempotentReplay') is True and all(replay[key] == application[key] for key in
              ['responseId', 'version', 'contentHash', 'applicationPriceBasis', 'priceRsd', 'currency', 'coveredSlots']), 'APPLICATION_REPLAY_CHANGED')
        candidates = self.rpc('ownerCandidateRead', 'requester', 'rpc_list_need_candidates', {'p_need_id': need})
        candidate = next((row for row in candidates if row['responseId'] == application['responseId']), None)
        check(candidate and candidate['canSelect'] and candidate['applicationPriceBasis'] == 'TOTAL'
              and candidate['priceRsd'] == 12000 and candidate['coveredSlots'] == 1, 'CANDIDATE_NOT_SELECTABLE')
        selection = {'p_need_id': need, 'p_need_revision': candidate['needRevision'], 'p_response_id': candidate['responseId'],
                     'p_response_version': candidate['version'], 'p_content_hash': candidate['contentHash'], 'p_client_request_id': self.state['keys']['select']}
        agreement = self.rpc('applicationSelect', 'requester', 'rpc_select_response', selection, True)
        check(isinstance(agreement, str) and UUID.fullmatch(agreement), 'SELECTION_RECEIPT_INVALID')
        self.state['objects']['agreement'] = agreement
        self.save()
        same = self.rpc('selectionSameKeyReplay', 'requester', 'rpc_select_response', selection, True)
        check(same == agreement, 'SELECTION_REPLAY_DUPLICATED')
        workspaces = [self.rpc(role + 'AcceptedWorkspace', role, 'rpc_get_agreement_workspace', {'p_agreement_id': agreement}) for role in ['requester', 'worker']]
        expected = {'price_rsd': 12000, 'priceBasis': 'TOTAL', 'currency': 'RSD', 'covered_slots': 1, 'required_slots': 1, 'pricingMode': 'MY_PRICE'}
        for row in workspaces:
            check(row['id'] == agreement and row['status'] == 'CONFIRMED' and row['currentVersion'] == 1
                  and row['requesterAccountId'] == self.actors['requester']['accountId'] and row['workerAccountId'] == self.actors['worker']['accountId']
                  and all(row['terms'].get(key) == value for key, value in expected.items()), 'AGREEMENT_TERMS_MISMATCH')
        check(workspaces[0]['terms'] == workspaces[1]['terms'], 'PARTICIPANTS_TERMS_DIFFER')
        versions_before = self.versions('versionsBeforeCancellation', 'requester', agreement)
        check(len(versions_before) == 1 and versions_before[0]['version'] == 1, 'VERSION_COUNT_NOT_ONE')
        selected_need = self.rpc('taskAfterSelection', 'requester', 'rpc_read_task', {'p_need_id': need})
        self.check_task(selected_need, 1)
        self.state['checks']['selection'] = {'sameKeyReplaySameAgreement': True, 'applicationSameKeyReplaySameResponse': True,
                                          'bothParticipantsSameTerms': True, 'terms': expected, 'versionCount': 1,
                                          'needTermsUnchanged': True, 'coveredSlotsAfterSelection': 1,
                                          'agreementTermsSha256': sha(workspaces[0]['terms'])}
        self.save()
        prefix = 'QA R08 provera otkazivanja — čćžšđ ŽČĆŠĐ 🙂. '
        reason = (prefix * 200)[:3999] + 'Z'
        check(len(reason) == 4000 and reason == reason.strip(), 'REASON_LENGTH_PRECONDITION')
        cancel = {'p_agreement_id': agreement, 'p_reason': reason}
        self.rpc('cancelNewAgreement', 'requester', 'rpc_cancel_agreement', cancel, True)
        cancelled = {}
        for role in ['requester', 'worker']:
            read = self.rpc(role + 'CancellationRead', role, 'rpc_agreement_cancellation_v1', {'p_agreement_ids': [agreement]})
            check(read['schema'] == 'AGREEMENT_CANCELLATION_V1' and read['authoritative'] is True and len(read['items']) == 1, 'CANCELLATION_ENVELOPE_INVALID')
            row = read['items'][0]
            check(row['agreementId'] == agreement and row['cancelled'] is True and row['cancelledBy'] == 'REQUESTER'
                  and row['reasonState'] == 'KEPT' and row['reason'] == reason and row['cancelledByMe'] == (role == 'requester'), 'FULL_UNICODE_REASON_MISMATCH')
            cancelled[role] = row
        page_args = {'p_expected_user_id': self.actors['worker']['accountId'], 'p_agreement_id': agreement,
                     'p_limit': 50, 'p_before_created_at': None, 'p_before_id': None}
        messages = self.rpc('workerCancellationMessages', 'worker', 'rpc_read_agreement_messages_page_v1', page_args)
        check(messages['authoritative'] is True and messages['agreementId'] == agreement and len(messages['messages']) == 3, 'THREE_REASON_MESSAGES_REQUIRED')
        self.rpc('cancellationReplay', 'requester', 'rpc_cancel_agreement', cancel, True)
        read = self.rpc('workerCancellationAfterReplay', 'worker', 'rpc_agreement_cancellation_v1', {'p_agreement_ids': [agreement]})
        check(read['items'] == [cancelled['worker']], 'CANCELLATION_REPLAY_CHANGED_FACTS')
        messages_after = self.rpc('workerMessagesAfterReplay', 'worker', 'rpc_read_agreement_messages_page_v1', page_args)
        check(messages_after['messages'] == messages['messages'], 'CANCELLATION_REPLAY_DUPLICATED_MESSAGES')
        versions_after = self.versions('versionsAfterCancellation', 'worker', agreement)
        check(versions_after == versions_before, 'CANCELLATION_REWROTE_TERMS_HISTORY')
        after = self.rpc('taskAfterCancellation', 'requester', 'rpc_read_task', {'p_need_id': need})
        self.check_task(after, 0)
        selection_receipt = self.rpc('exactSelectionAfterCancellation', 'requester', 'rpc_read_selection_result', {**selection, 'p_covered_slots': 1})
        check(selection_receipt['authoritative'] is True and selection_receipt['found'] is True
              and selection_receipt['result']['agreementId'] == agreement and selection_receipt['result']['agreementStatus'] == 'CANCELLED', 'TERMINAL_SELECTION_RECEIPT_INVALID')
        self.state['checks']['cancellation'] = {'ordinaryCanceller': 'requester', 'onlyNewAgreement': True, 'characters': len(reason),
                                               'utf8Bytes': len(reason.encode()), 'reasonSha256': sha(reason), 'bothParticipantsExactReason': True,
                                               'reasonMessages': 3, 'replaySameFactsAndMessages': True, 'cancelledAtUnchanged': True,
                                               'versionHistoryUnchanged': True, 'needTermsUnchanged': True, 'coveredSlotsAfterCancellation': 0,
                                               'terminalSelectionReceipt': 'CANCELLED'}
        self.state['status'] = 'DEV_ORDINARY_AUTH_TOTAL_AND_4000_CHARACTER_CANCELLATION_CONFIRMED'
        self.save()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--qa-directory', type=Path, required=True)
    parser.add_argument('--server-preflight', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--verify-refusal', action='store_true')
    parser.add_argument('--calendar-evidence', type=Path)
    args = parser.parse_args()
    flow = None
    try:
        flow = Flow(args)
        if args.verify_refusal:
            check(args.calendar_evidence is not None, 'CALENDAR_EVIDENCE_PATH_REQUIRED')
            flow.verify_refusal()
        else:
            flow.run()
        print(json.dumps({'status': flow.state['status'], 'receipt': str(args.receipt)}, ensure_ascii=False))
    except Exception as error:
        code = str(error) if isinstance(error, StopFlow) else type(error).__name__
        if flow is not None:
            flow.state['status'] = 'STOPPED_WITH_SAVED_CHECKPOINT'
            flow.state['lastStop'] = code
            flow.save()
        print(json.dumps({'status': 'STOPPED_WITH_SAVED_CHECKPOINT', 'safeCode': code}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
