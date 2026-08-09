#!/usr/bin/env python3
"""Build a guarded SQL migration for an isolated English database clone.

The generated SQL only replaces user-facing map-marker text. It refuses to run
unless connected to the exact temporary database name supplied at generation
time, validates complete source coverage, and performs every update in one
transaction.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


CJK_RE = re.compile(
    r"[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60]"
)
SAFE_DATABASE_RE = re.compile(r"^lycoris_translate_[a-z0-9_]+$")
TITLE_FIELDS = {
    "map_markers.title",
    "marker_edit_proposals.markerTitle",
    "marker_edit_proposals.title",
    "marker_image_proposals.markerTitle",
}
CATALOG_FIELDS = TITLE_FIELDS | {
    "map_markers.description",
    "marker_edit_proposals.description",
}

FIELD_SPECS = (
    ("map_markers.title", "map_markers", "title"),
    ("map_markers.description", "map_markers", "description"),
    (
        "marker_edit_proposals.marker_title",
        "marker_edit_proposals",
        "marker_title",
    ),
    ("marker_edit_proposals.title", "marker_edit_proposals", "title"),
    (
        "marker_edit_proposals.description",
        "marker_edit_proposals",
        "description",
    ),
    (
        "marker_image_proposals.marker_title",
        "marker_image_proposals",
        "marker_title",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument(
        "--translations",
        required=True,
        type=Path,
        nargs="+",
        help="One or more JSON arrays containing id/source/english entries.",
    )
    parser.add_argument("--database", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--merged-output",
        type=Path,
        help="Optional path for the validated, ID-ordered translation array.",
    )
    return parser.parse_args()


def load_array(path: Path) -> list[dict[str, Any]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Cannot read {path}: {exc}") from exc
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise SystemExit(f"{path} must contain a JSON array of objects")
    return value


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def normalized_sql(column: str) -> str:
    """Match Python str.strip for whitespace present in the legacy dataset."""
    return f"btrim({column}, E' \\t\\n\\r\\f')"


def validate(
    catalog: list[dict[str, Any]], translation_paths: list[Path]
) -> list[dict[str, Any]]:
    expected: dict[int, dict[str, Any]] = {}
    seen_sources: set[str] = set()
    for position, item in enumerate(catalog, start=1):
        item_id = item.get("id")
        source = item.get("source")
        fields = item.get("fields")
        if (
            item_id != position
            or not isinstance(source, str)
            or not source
            or source != source.strip()
        ):
            raise SystemExit(
                "Catalog IDs must be contiguous from 1 and sources nonempty/trimmed"
            )
        if (
            not isinstance(fields, list)
            or not fields
            or not all(isinstance(field, str) for field in fields)
            or not set(fields).issubset(CATALOG_FIELDS)
        ):
            raise SystemExit(f"Catalog entry {item_id} has invalid fields")
        if source in seen_sources:
            raise SystemExit(f"Catalog source is duplicated at entry {item_id}")
        seen_sources.add(source)
        expected[item_id] = item

    supplied: dict[int, dict[str, Any]] = {}
    for path in translation_paths:
        for item in load_array(path):
            item_id = item.get("id")
            if not isinstance(item_id, int) or item_id not in expected:
                raise SystemExit(f"{path} contains unknown translation ID {item_id!r}")
            if item_id in supplied:
                raise SystemExit(f"Duplicate translation ID {item_id}")
            supplied[item_id] = item

    missing = sorted(set(expected) - set(supplied))
    if missing:
        raise SystemExit(f"Missing translation IDs: {missing}")

    merged: list[dict[str, Any]] = []
    for item_id in sorted(expected):
        catalog_item = expected[item_id]
        translated = supplied[item_id]
        source = translated.get("source")
        english = translated.get("english")
        if source != catalog_item["source"]:
            raise SystemExit(f"Translation {item_id} does not match its catalog source")
        if not isinstance(english, str) or not english.strip():
            raise SystemExit(f"Translation {item_id} has empty English text")
        english = english.strip()
        if CJK_RE.search(english):
            raise SystemExit(f"Translation {item_id} still contains CJK characters")
        if english == source:
            raise SystemExit(f"Translation {item_id} is unchanged")
        if english.upper() in {"TODO", "TBD", "TRANSLATE", "TRANSLATION"}:
            raise SystemExit(f"Translation {item_id} is a placeholder")
        if TITLE_FIELDS.intersection(catalog_item["fields"]) and len(english) > 120:
            raise SystemExit(
                f"Translation {item_id} is {len(english)} characters; title limit is 120"
            )
        merged.append({"id": item_id, "source": source, "english": english})
    return merged


def build_sql(database: str, merged: list[dict[str, Any]]) -> str:
    if not SAFE_DATABASE_RE.fullmatch(database):
        raise SystemExit(
            "Temporary database name must match lycoris_translate_[a-z0-9_]+"
        )

    payload = json.dumps(
        [{"source": item["source"], "english": item["english"]} for item in merged],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    tag = "$lycoris_translation_payload$"
    if tag in payload:
        raise SystemExit("Translation payload unexpectedly contains the SQL dollar tag")

    occurrence_parts = []
    for field_name, table, column in FIELD_SPECS:
        normalized = normalized_sql(column)
        occurrence_parts.append(
            "SELECT "
            f"{sql_literal(field_name)}::text AS field_name, "
            f"{normalized}::text AS source "
            f"FROM {table} WHERE {column} IS NOT NULL AND {normalized} <> ''"
        )
    occurrence_sql = "\nUNION ALL\n".join(occurrence_parts)

    update_blocks = []
    for field_name, table, column in FIELD_SPECS:
        normalized = normalized_sql(f"target.{column}")
        update_blocks.append(
            f"""
    UPDATE {table} AS target
       SET {column} = translations.english
      FROM translation_map AS translations
     WHERE {normalized} = translations.source;
    GET DIAGNOSTICS affected = ROW_COUNT;
    SELECT row_count INTO expected
      FROM translation_expected
     WHERE field_name = {sql_literal(field_name)};
    IF affected <> expected THEN
        RAISE EXCEPTION 'Updated % rows for {field_name}, expected %', affected, expected;
    END IF;
""".rstrip()
        )

    current_parts = []
    for field_name, table, column in FIELD_SPECS:
        current_parts.append(
            "SELECT "
            f"{sql_literal(field_name)}::text AS field_name, {column}::text AS value "
            f"FROM {table} WHERE {column} IS NOT NULL AND btrim({column}) <> ''"
        )
    current_sql = "\nUNION ALL\n".join(current_parts)

    return f"""\\set ON_ERROR_STOP on
BEGIN;

DO $database_guard$
BEGIN
    IF current_database() <> {sql_literal(database)} THEN
        RAISE EXCEPTION 'Refusing translation: connected to %, expected {database}',
            current_database();
    END IF;
END
$database_guard$;

CREATE TEMP TABLE translation_map (
    source text PRIMARY KEY,
    english text NOT NULL CHECK (btrim(english) <> '')
) ON COMMIT DROP;

INSERT INTO translation_map (source, english)
SELECT source, english
FROM jsonb_to_recordset({tag}{payload}{tag}::jsonb)
    AS value(source text, english text);

DO $translation_count$
BEGIN
    IF (SELECT count(*) FROM translation_map) <> {len(merged)} THEN
        RAISE EXCEPTION 'Translation map count mismatch';
    END IF;
END
$translation_count$;

CREATE TEMP TABLE source_occurrences ON COMMIT DROP AS
{occurrence_sql};

CREATE TEMP TABLE translation_expected ON COMMIT DROP AS
SELECT field_name, count(*)::integer AS row_count
FROM source_occurrences
GROUP BY field_name;

DO $coverage$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM source_occurrences AS occurrence
        LEFT JOIN translation_map AS translations
          ON translations.source = occurrence.source
        WHERE translations.source IS NULL
    ) THEN
        RAISE EXCEPTION 'At least one source value has no English translation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM translation_map AS translations
        LEFT JOIN source_occurrences AS occurrence
          ON occurrence.source = translations.source
        WHERE occurrence.source IS NULL
    ) THEN
        RAISE EXCEPTION 'At least one translation is unused by this database';
    END IF;
END
$coverage$;

DO $updates$
DECLARE
    affected integer;
    expected integer;
BEGIN
{"\n".join(update_blocks)}
END
$updates$;

CREATE TEMP TABLE translated_occurrences ON COMMIT DROP AS
{current_sql};

DO $translated_values$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM translated_occurrences AS occurrence
        WHERE NOT EXISTS (
            SELECT 1
            FROM translation_map AS translations
            WHERE translations.english = occurrence.value
        )
    ) THEN
        RAISE EXCEPTION 'At least one translated field contains an unexpected value';
    END IF;

    IF (SELECT count(*) FROM translated_occurrences)
       <> (SELECT count(*) FROM source_occurrences) THEN
        RAISE EXCEPTION 'Translated occurrence count changed';
    END IF;
END
$translated_values$;

COMMIT;
"""


def main() -> None:
    args = parse_args()
    catalog = load_array(args.catalog)
    merged = validate(catalog, args.translations)
    sql = build_sql(args.database, merged)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding="utf-8", newline="\n")
    if args.merged_output:
        args.merged_output.parent.mkdir(parents=True, exist_ok=True)
        args.merged_output.write_text(
            json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    print(f"Validated {len(merged)} translations and wrote {args.output}")


if __name__ == "__main__":
    main()
