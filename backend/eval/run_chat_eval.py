"""Chat understanding eval: how well messages are turned into profile fields.

Usage (from backend/):
    python -m eval.run_chat_eval          # basic rule-based parser
    python -m eval.run_chat_eval --llm    # the configured LLM (needs LLM_API_KEY / GROQ_API_KEY)

Scores each labelled message by field: precision (extracted fields that are right) and
recall (expected fields that were found). The rules engine has its own eval (run_eval.py).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.assistant import ChatRequest, _basic_understand, _llm_understand, _validated  # noqa: E402
from app.ai.llm import LLMError  # noqa: E402
from app.models import Profile  # noqa: E402
from app.services.rules_engine import normalize_profile  # noqa: E402


def normalized(fields: dict) -> dict:
    """Fields plus what they imply (a BTech student is studying beyond Class 10), as the rules engine sees them."""
    return normalize_profile(Profile(**fields)).model_dump(exclude_none=True)

CASES = Path(__file__).resolve().parent / "chat_utterances.json"


def load_cases() -> list[dict]:
    return json.loads(CASES.read_text(encoding="utf-8"))["cases"]


def understand(case: dict, use_llm: bool) -> dict:
    req = ChatRequest(message=case["message"], pending_field=case.get("pending"))
    if not use_llm:
        _, fields, _, _ = _basic_understand(req)
        return _validated(fields)
    for attempt in range(5):  # free tiers allow a few requests a minute: wait and retry when limited
        try:
            _, fields, _, _ = _llm_understand(req)
            return _validated(fields)
        except LLMError as e:
            if "429" not in str(e) or attempt == 4:
                raise
            time.sleep(15)
    raise AssertionError("unreachable")


def score(cases: list[dict], use_llm: bool) -> dict:
    tp = fp = fn = exact = 0
    rows = []
    for case in cases:
        try:
            got = understand(case, use_llm)
        except LLMError as e:
            got = {"<error>": str(e)}
        expected = normalized(case["expected"])
        got = got if "<error>" in got else normalized(got)
        right = {k for k, v in got.items() if expected.get(k) == v}
        tp += len(right)
        fp += len(got) - len(right)
        fn += len(expected) - len(right)
        exact += got == expected
        rows.append((case, got, got == expected))
    return {
        "precision": tp / (tp + fp) if tp + fp else 1.0,
        "recall": tp / (tp + fn) if tp + fn else 1.0,
        "exact": exact,
        "total": len(cases),
        "rows": rows,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Score chat message understanding.")
    parser.add_argument("--llm", action="store_true", help="use the configured LLM instead of the basic parser")
    args = parser.parse_args(argv)
    cases = load_cases()
    groups = {"standard": [c for c in cases if not c.get("llm_only")], "llm_only": [c for c in cases if c.get("llm_only")]}
    print(f"\nChat understanding eval ({'LLM' if args.llm else 'basic parser'})\n")
    for name, group in groups.items():
        r = score(group, args.llm)
        print(f"{name:<10} exact {r['exact']}/{r['total']}   precision {r['precision']:.0%}   recall {r['recall']:.0%}")
        for case, got, ok in r["rows"]:
            if not ok:
                print(f"   ✗ {case['id']} {case['message']!r}\n       expected {case['expected']}\n       got      {got}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
