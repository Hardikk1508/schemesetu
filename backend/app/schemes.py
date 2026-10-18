"""Load and validate topics and scheme definitions from app/data/schemes.json."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.models import Scheme, Topic

DATA_FILE = Path(__file__).resolve().parent / "data" / "schemes.json"


def _dupes(ids: list[str]) -> list[str]:
    return sorted({i for i in ids if ids.count(i) > 1})


def load_catalogue_from(path: Path) -> tuple[list[Topic], list[Scheme]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    topics = [Topic(**t) for t in raw["topics"]]
    schemes = [Scheme(**s) for s in raw["schemes"]]
    if dupes := _dupes([t.id for t in topics]):
        raise ValueError(f"duplicate topic ids in {path.name}: {dupes}")
    if dupes := _dupes([s.id for s in schemes]):
        raise ValueError(f"duplicate scheme ids in {path.name}: {dupes}")
    known = {t.id for t in topics}
    for s in schemes:
        if unknown := sorted(set(s.topics) - known):
            raise ValueError(f"scheme {s.id}: unknown topic(s) {unknown}")
    return topics, schemes


def load_schemes_from(path: Path) -> list[Scheme]:
    return load_catalogue_from(path)[1]


@lru_cache(maxsize=1)
def _cached() -> tuple[tuple[Topic, ...], tuple[Scheme, ...]]:
    topics, schemes = load_catalogue_from(DATA_FILE)
    return tuple(topics), tuple(schemes)


def get_topics() -> list[Topic]:
    return list(_cached()[0])


def get_topic(topic_id: str) -> Topic:
    for t in _cached()[0]:
        if t.id == topic_id:
            return t
    raise KeyError(f"unknown topic id: {topic_id}")


def get_schemes(topic: str | None = None) -> list[Scheme]:
    schemes = _cached()[1]
    return [s for s in schemes if topic is None or topic in s.topics]


def get_scheme(scheme_id: str) -> Scheme:
    for s in _cached()[1]:
        if s.id == scheme_id:
            return s
    raise KeyError(f"unknown scheme id: {scheme_id}")


def data_note() -> str:
    return json.loads(DATA_FILE.read_text(encoding="utf-8")).get("data_note", "")


def reload_schemes() -> None:
    _cached.cache_clear()
