"""Read-only local startup checks, using only Python's standard library.
Does not certify real Clerk roles, database migrations or tenant isolation.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

def fetch(url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=5) as response:
            return response.status, response.read(32768)
    except urllib.error.HTTPError as error:
        return error.code, error.read(32768)
    except urllib.error.URLError:
        return None, b""

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="http://127.0.0.1:8000")
    parser.add_argument("--frontend", default="http://localhost:3000")
    args = parser.parse_args(argv)
    for url in (args.backend, args.frontend):
        from urllib.parse import urlsplit
        if urlsplit(url).hostname not in {"localhost", "127.0.0.1", "::1"}:
            parser.error("This script is restricted to local servers")
    checks = [
        ("Python liveness", args.backend + "/health/live", None, {200}),
        ("Unsigned chat rejected", args.backend + "/api/v1/chat", {"query": "test", "organization_id": "untrusted"}, {403}),
        ("Unsigned stream rejected", args.backend + "/api/v1/realtime/events", None, {403}),
        ("Unsigned publisher rejected", args.backend + "/api/v1/realtime/publish", {"event_type": "test", "data": {}}, {403}),
        ("Keyless flow ingestion rejected", args.backend + "/api/v1/flows/ingest", {"raw_record": "{}", "capture_id": "check"}, {401}),
        ("Unauthenticated flow page redirects", args.frontend + "/flows", None, {302, 303, 307, 308}),
    ]
    failed = 0
    for label, url, payload, expected in checks:
        status, _ = fetch(url, payload)
        passed = status in expected
        failed += not passed
        print(f"{'PASS' if passed else 'FAIL'} {label}: HTTP {status if status else 'unreachable'}")
    status, body = fetch(args.backend + "/health/ready")
    try:
        readiness = json.loads(body)
        database = readiness.get("database", "unknown")
        print(f"INFO aggregate readiness HTTP {status}; database {database}")
        if database != "connected":
            failed += 1
            print("FAIL database readiness")
    except (ValueError, AttributeError):
        failed += 1
        print("FAIL readiness response unavailable")
    print("These checks do not replace signed-request, real-user, two-tenant or migration verification.")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
