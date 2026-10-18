"""Eligibility eval: run the rules engine over hand-labelled profiles and score it.

Usage (from backend/):
    python -m eval.run_eval
    python -m eval.run_eval --min-accuracy 0.95 --json report.json
Exit code is 1 if accuracy is below --min-accuracy (default 1.0), so it can gate CI.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

if __package__ in (None, ""):  # allow `python eval/run_eval.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import Profile, Scheme  # noqa: E402
from app.schemes import get_schemes  # noqa: E402
from app.services.rules_engine import evaluate_scheme  # noqa: E402

DEFAULT_CASES = Path(__file__).resolve().parent / "labelled_profiles.json"
STATUSES = ("eligible", "needs_info", "not_eligible")


@dataclass
class Mismatch:
    case_id: str
    scheme_id: str
    expected: str
    actual: str
    failed_reasons: list[str]
    missing_fields: list[str]


@dataclass
class EvalReport:
    cases: int
    pairs: int
    correct: int
    cases_fully_correct: int
    per_scheme: dict[str, dict[str, int]] = field(default_factory=dict)
    confusion: dict[str, dict[str, int]] = field(default_factory=dict)
    mismatches: list[Mismatch] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        return self.correct / self.pairs if self.pairs else 0.0


def load_cases(path: Path = DEFAULT_CASES) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["cases"]


def run(path: Path = DEFAULT_CASES, schemes: list[Scheme] | None = None) -> EvalReport:
    schemes = schemes if schemes is not None else get_schemes()
    by_id = {s.id: s for s in schemes}
    cases = load_cases(path)

    report = EvalReport(cases=len(cases), pairs=0, correct=0, cases_fully_correct=0)
    report.confusion = {e: {a: 0 for a in STATUSES} for e in STATUSES}

    for case in cases:
        profile = Profile(**case["profile"])
        case_ok = True
        for scheme_id, expected in case["expected"].items():
            if scheme_id not in by_id:
                raise KeyError(f"case {case['id']}: unknown scheme id '{scheme_id}'")
            if expected not in STATUSES:
                raise ValueError(f"case {case['id']}: invalid status '{expected}'")
            result = evaluate_scheme(by_id[scheme_id], profile)
            stats = report.per_scheme.setdefault(scheme_id, {"correct": 0, "total": 0})
            stats["total"] += 1
            report.pairs += 1
            report.confusion[expected][result.status] += 1
            if result.status == expected:
                stats["correct"] += 1
                report.correct += 1
            else:
                case_ok = False
                report.mismatches.append(
                    Mismatch(
                        case_id=case["id"],
                        scheme_id=scheme_id,
                        expected=expected,
                        actual=result.status,
                        failed_reasons=[r.en for r in result.failed_reasons],
                        missing_fields=result.missing_fields,
                    )
                )
        report.cases_fully_correct += case_ok
    return report


def print_report(report: EvalReport) -> None:
    print(f"\nSchemeSetu eligibility eval: {report.cases} cases, {report.pairs} labelled (case, scheme) pairs\n")
    print(f"{'Scheme':<12}{'Correct':>9}{'Total':>7}{'Accuracy':>10}")
    print("-" * 38)
    for sid, s in sorted(report.per_scheme.items()):
        print(f"{sid:<12}{s['correct']:>9}{s['total']:>7}{s['correct'] / s['total']:>10.1%}")
    print("-" * 38)
    print(f"{'OVERALL':<12}{report.correct:>9}{report.pairs:>7}{report.accuracy:>10.1%}")
    print(f"Cases fully correct: {report.cases_fully_correct}/{report.cases}\n")

    print("Confusion matrix (rows = expected, cols = predicted)")
    short = {"eligible": "eligible", "needs_info": "needs_info", "not_eligible": "not_elig"}
    print(f"{'':<14}" + "".join(f"{short[a]:>12}" for a in STATUSES))
    for e in STATUSES:
        print(f"{short[e]:<14}" + "".join(f"{report.confusion[e][a]:>12}" for a in STATUSES))

    if report.mismatches:
        print(f"\nMismatches ({len(report.mismatches)}):")
        for m in report.mismatches:
            print(f"  ✗ {m.case_id} / {m.scheme_id}: expected {m.expected}, got {m.actual}")
            for r in m.failed_reasons:
                print(f"      failed: {r}")
            if m.missing_fields:
                print(f"      missing: {', '.join(m.missing_fields)}")
    else:
        print("\nNo mismatches.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the SchemeSetu eligibility eval.")
    parser.add_argument("--file", type=Path, default=DEFAULT_CASES, help="labelled cases JSON")
    parser.add_argument("--min-accuracy", type=float, default=1.0, help="fail below this (0-1)")
    parser.add_argument("--json", type=Path, help="also write the report as JSON to this path")
    args = parser.parse_args(argv)

    report = run(args.file)
    print_report(report)
    if args.json:
        payload = asdict(report) | {"accuracy": report.accuracy}
        args.json.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nReport written to {args.json}")
    return 0 if report.accuracy >= args.min_accuracy else 1


if __name__ == "__main__":
    sys.exit(main())
