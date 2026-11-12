import argparse
import json
import sys

from .workflows import System


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="crunchradar")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("monday-check", help="run the Monday crunch check now (this is what the schedule runs)")
    sub.add_parser("follow-up", help="confirm approved moves against the calendar feed")
    sub.add_parser("summary", help="print weekly hours and issues")
    sub.add_parser("outbox", help="print emails sent or drafted")
    inv = sub.add_parser("student-link", help="print the signed 'too much' token for a student email")
    inv.add_argument("email")
    sv = sub.add_parser("serve", help="start the HTTP API and approval pages")
    sv.add_argument("--port", type=int, default=8000)
    a = ap.parse_args(argv)
    system = System()
    if a.cmd == "serve":
        import uvicorn
        from .api import create_app
        uvicorn.run(create_app(system), host="0.0.0.0", port=a.port)
        return 0
    out = {"monday-check": system.monday_check, "follow-up": system.follow_up, "summary": system.summary, "outbox": system.store.outbox,
           "student-link": lambda: {"email": a.email, "token": system.student_token(a.email)}}[a.cmd]()
    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
