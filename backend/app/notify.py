"""Send WhatsApp alerts when schemes are added to the catalogue.

Run after updating app/data/schemes.json (e.g. from cron):
    python -m app.notify            # alert opted-in users about new schemes they may qualify for
    python -m app.notify --dry-run  # show what would be sent

The first run only records the current catalogue, so existing schemes never trigger alerts.
A user is alerted when the rules engine says "eligible" for their saved answers, at most once per scheme.
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import KnownScheme, Notification, User, init_db, new_session
from app.messaging import send_scheme_alert
from app.models import Profile
from app.schemes import get_schemes
from app.services.rules_engine import evaluate_scheme

PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:3000").rstrip("/")


@dataclass
class NotifyReport:
    first_run: bool = False
    new_schemes: list[str] = field(default_factory=list)
    sent: list[tuple[str, str]] = field(default_factory=list)  # (phone, scheme_id)
    failed: list[tuple[str, str]] = field(default_factory=list)


def notify_new_schemes(db: Session, dry_run: bool = False) -> NotifyReport:
    report = NotifyReport()
    known = set(db.scalars(select(KnownScheme.scheme_id)).all())
    catalogue = get_schemes()
    report.first_run = not known
    new = [s for s in catalogue if s.id not in known]
    report.new_schemes = [s.id for s in new]

    if new and not report.first_run:
        users = db.scalars(select(User).where(User.whatsapp_opt_in.is_(True), User.phone.is_not(None))).all()
        for user in users:
            if user.profile is None:
                continue
            profile = Profile(**user.profile.profile)
            for scheme in new:
                if evaluate_scheme(scheme, profile).status != "eligible":
                    continue
                already = db.scalar(
                    select(Notification.id).where(Notification.user_id == user.id, Notification.scheme_id == scheme.id)
                )
                if already:
                    continue
                if dry_run:
                    report.sent.append((user.phone, scheme.id))
                    continue
                hi = user.lang == "hi"
                result = send_scheme_alert(
                    user.phone,
                    scheme.name_hi if hi else scheme.name,
                    scheme.benefit.hi if hi else scheme.benefit.en,
                    f"{PUBLIC_URL}/{user.lang}/schemes/{scheme.id}",
                    user.lang,
                )
                db.add(Notification(user_id=user.id, scheme_id=scheme.id, channel=result.channel,
                                    status="sent" if result.ok else "failed"))
                try:
                    db.commit()
                except IntegrityError:  # already alerted about this scheme
                    db.rollback()
                    continue
                (report.sent if result.ok else report.failed).append((user.phone, scheme.id))

    if not dry_run:
        for s in new:
            db.add(KnownScheme(scheme_id=s.id))
        db.commit()
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Alert users on WhatsApp about newly added schemes.")
    parser.add_argument("--dry-run", action="store_true", help="show what would be sent without sending")
    args = parser.parse_args(argv)
    init_db()
    with new_session() as db:
        report = notify_new_schemes(db, dry_run=args.dry_run)
    if report.first_run:
        print(f"First run: recorded {len(report.new_schemes)} existing schemes. Future additions will trigger alerts.")
    else:
        print(f"New schemes: {', '.join(report.new_schemes) or 'none'}")
        print(f"{'Would send' if args.dry_run else 'Sent'}: {len(report.sent)}  Failed: {len(report.failed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
