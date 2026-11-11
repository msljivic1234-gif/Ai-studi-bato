"""Read-only ordinary-Auth continuation of the existing two TEST fixtures.

No account creation, model dispatch, business writer, selection retry or logout.
Private fixture state and tokens stay in their existing mode-0600 scratch files.
Only hashes, safe error codes and assertions are written to the public receipt.
"""
from pathlib import Path
import argparse
import base64
import datetime
import hashlib
import importlib.util
import json
import re
import time
import uuid

PROJECT = 'leqcwgzvjsxugfgzdmth'
READ_RPCS = {'rpc_read_selection_result', 'rpc_get_agreement_workspace', 'rpc_ai_test_budget_report_service'}


def check(condition, code):
    if not condition:
        raise AssertionError(code)


def sha(value):
    raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--qa-directory', required=True, type=Path)
    parser.add_argument('--dev-readback', required=True, type=Path)
    parser.add_argument('--receipt', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    state_path = args.qa_directory / 'private-e2e-state.json'
    state = json.loads(state_path.read_text())
    lineage_path = args.qa_directory.parent / 'r08-qa-fixture-lineage-setup.receipt.json'
    lineage = json.loads(lineage_path.read_text())
    check(state['project'] == PROJECT == lineage['project'], 'PROJECT_MISMATCH')
    check(state['lineageReceiptSha256'] == sha(lineage_path.read_bytes()), 'LINEAGE_PROOF_CHANGED')
    check(len(lineage['readback']) == 2 and all(r['visibility_world'] == 'TEST' and r['non_production']
          and r['lineage'] == 'SYNTHETIC_ACCEPTANCE_FIXTURE' for r in lineage['readback']), 'TEST_LINEAGE_REQUIRED')
    check(state['operations']['applicationSelect']['state'] == 'CONFIRMED', 'EXISTING_SELECTION_REQUIRED')
    deployed = json.loads(args.dev_readback.read_text())
    sql_sha = sha((root / 'scripts/sql/r07_selection_recovery_20261107.sql').read_bytes())
    check(deployed['ledger']['joined_sha256'] == sql_sha and deployed['reader']['md5'] == 'a5d35714e761047dcbef3f745a86dc22', 'EXACT_DEV_MIGRATION_REQUIRED')

    harness_path = args.qa_directory / 'public_api_preflight.py'
    spec = importlib.util.spec_from_file_location('r07_existing_auth_preflight', harness_path)
    auth = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(auth)
    check(auth.BASE == 'https://' + PROJECT + '.supabase.co', 'AUTH_PROJECT_MISMATCH')
    accounts = json.loads(auth.STATE.read_text())
    operations = []
    verified = {}
    # Retain the previously verified identities; a new login is allowed only
    # for the same stored TEST credential when its access token has expired.
    for label, role in [('1', 'worker'), ('2', 'requester')]:
        saved = accounts[label]
        session = saved['session']
        expected_hash = state['accountIdSha256'][role]
        check(hashlib.sha256(session['accountId'].encode()).hexdigest() == expected_hash, 'ACCOUNT_IDENTITY_CHANGED')
        email, password = auth.credentials(int(label))
        if session.get('expiresAt', 0) <= time.time() + 60:
            login = auth.request('/auth/v1/token?grant_type=password', body={'email': email, 'password': password})
            check(login['status'] == 200 and login['data']['user']['id'] == session['accountId'], 'ORDINARY_LOGIN_FAILED')
            data = login['data']
            session = {'accessToken': data['access_token'], 'expiresAt': data['expires_at'], 'accountId': data['user']['id']}
            saved['session'] = session
            auth.private_write(auth.STATE, accounts)
        own = auth.request('/auth/v1/user', session['accessToken'])
        check(own['status'] == 200 and own['data']['id'] == session['accountId']
              and own['data']['email'] == email and own['data']['role'] == 'authenticated', 'ORDINARY_AUTH_REQUIRED')
        encoded = session['accessToken'].split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
        check(claims.get('sub') == session['accountId'] and claims.get('role') == 'authenticated'
              and isinstance(claims.get('session_id'), str) and re.fullmatch(r'[a-f0-9-]{36}', claims['session_id']), 'SESSION_ID_CLAIM_REQUIRED')
        verified[role] = session
    check(verified['worker']['accountId'] != verified['requester']['accountId'], 'DISTINCT_ACCOUNTS_REQUIRED')

    def rpc(name, role, rpc_name, body, expected_status=200, expected_code=None):
        check(rpc_name in READ_RPCS, 'READ_ONLY_RPC_REQUIRED')
        started = time.monotonic()
        result = auth.request('/rest/v1/rpc/' + rpc_name, verified[role]['accessToken'], body)
        row = {'name': name, 'actor': role, 'rpc': rpc_name, 'http_status': result['status'],
               'elapsed_ms': round((time.monotonic() - started) * 1000, 1)}
        if result.get('safeCode'):
            row['safe_code'] = result['safeCode']
        operations.append(row)
        check(result['status'] == expected_status, 'HTTP_STATUS_' + name.upper())
        if expected_code:
            check(result.get('safeCode') == expected_code, 'ERROR_CODE_' + name.upper())
        return result['data']

    agreement_id = state['objects']['agreement']
    workspace_args = {'p_agreement_id': agreement_id}
    before = {role: rpc(role + '_workspace_before', role, 'rpc_get_agreement_workspace', workspace_args)
              for role in ['requester', 'worker']}
    reviewed = state['candidate']
    original = {'p_need_id': state['objects']['need'], 'p_need_revision': reviewed['needRevision'],
                'p_response_id': reviewed['responseId'], 'p_response_version': reviewed['version'],
                'p_content_hash': reviewed['contentHash'], 'p_client_request_id': state['keys']['select'],
                'p_covered_slots': reviewed['coveredSlots']}
    first = rpc('owner_exact_receipt', 'requester', 'rpc_read_selection_result', original)
    second = rpc('owner_repeated_receipt', 'requester', 'rpc_read_selection_result', original)
    expected = {'schema': 'SELECTION_RESULT_V1', 'authoritative': True, 'found': True, 'result': {
        'agreementId': agreement_id, 'agreementStatus': before['requester']['status'],
        'needId': original['p_need_id'], 'needRevision': original['p_need_revision'],
        'responseId': original['p_response_id'], 'responseVersion': original['p_response_version'],
        'contentHash': original['p_content_hash'], 'coveredSlots': original['p_covered_slots'],
        'clientRequestId': original['p_client_request_id']}}
    check(first == expected == second, 'EXACT_REPEATED_RECEIPT_REQUIRED')
    absent = {'schema': 'SELECTION_RESULT_V1', 'authoritative': True, 'found': False, 'result': None}
    check(rpc('other_account_ledger_hidden', 'worker', 'rpc_read_selection_result', original) == absent, 'FOREIGN_LEDGER_DISCLOSED')
    check(rpc('unknown_key_is_only_not_found', 'requester', 'rpc_read_selection_result',
              {**original, 'p_client_request_id': str(uuid.uuid4())}) == absent, 'NOT_FOUND_SHAPE')
    for label, patch in [('changed_revision', {'p_need_revision': original['p_need_revision'] + 1}),
                         ('changed_hash', {'p_content_hash': '0' * 64}),
                         ('changed_people', {'p_covered_slots': 1 if original['p_covered_slots'] != 1 else 2})]:
        check(any(original[k] != v for k, v in patch.items()), 'NEGATIVE_PAYLOAD_NOT_CHANGED')
        rpc(label, 'requester', 'rpc_read_selection_result', {**original, **patch}, 400, '22023')
    # This report is read-only and service-only. No reservation/settlement RPC
    # is used even for an expected permission denial.
    rpc('ordinary_budget_report_denied', 'requester', 'rpc_ai_test_budget_report_service', {}, 403, '42501')
    after = {role: rpc(role + '_workspace_after', role, 'rpc_get_agreement_workspace', workspace_args)
             for role in ['requester', 'worker']}
    stable_fields = ['id', 'status', 'currentVersion', 'requesterAccountId', 'workerAccountId', 'terms']
    stable = lambda value: {key: value[key] for key in stable_fields}
    check(all(stable(before[role]) == stable(after[role]) for role in before), 'AGREEMENT_OR_PRICE_CHANGED')
    check(stable(before['requester']) == stable(before['worker']), 'PARTICIPANT_TERMS_DIFFER')
    receipt = {'format_version': 1, 'project': PROJECT, 'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'status': 'DEV_ORDINARY_AUTH_READBACK_CONFIRMED', 'world': 'TEST',
               'migration': deployed['ledger'], 'account_id_sha256': state['accountIdSha256'],
               'lineage_receipt_sha256': sha(lineage_path.read_bytes()), 'auth_harness_sha256': sha(harness_path.read_bytes()),
               'fixture_state_sha256': sha(state_path.read_bytes()), 'script_sha256': sha(Path(__file__).read_bytes()),
               'ordinary_auth_roles_verified': 2, 'real_session_id_claims_verified': 2,
               'agreement_id_sha256': hashlib.sha256(agreement_id.encode()).hexdigest(),
               'agreement_status': first['result']['agreementStatus'], 'owned_receipt_sha256': sha(first),
               'original_need_revision': original['p_need_revision'], 'original_response_version': original['p_response_version'],
               'original_covered_slots': original['p_covered_slots'], 'workspace_before_sha256': sha(stable(before['requester'])),
               'workspace_after_sha256': sha(stable(after['requester'])), 'workspace_terms_unchanged': True,
               'both_participants_same_terms': True, 'operations': operations,
               'selection_writer_calls': 0, 'business_writer_calls': 0, 'model_calls': 0,
               'admin_client_used_for_api_scenario': False, 'native_acceptance': False,
               'server_row_hash_before_after': 'Recorded separately by the coordinator/read-only SQL evidence; no privileged writer used.'}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'read_requests': len(operations), 'agreement_status': receipt['agreement_status'],
                      'writer_calls': 0, 'model_calls': 0, 'receipt': str(args.receipt)}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except AssertionError as error:
        print(json.dumps({'status': 'STOPPED', 'reason': str(error) if re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'ASSERTION_FAILED'}))
        raise SystemExit(1)
    except Exception as error:
        print(json.dumps({'status': 'STOPPED', 'reason': type(error).__name__}))
        raise SystemExit(1)
