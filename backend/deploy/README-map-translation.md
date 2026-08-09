# Map content translation export

`build_map_translation_sql.py` builds a one-time, transactionally guarded SQL
script for producing a translated database clone. It is intentionally an
offline export tool: never run the generated SQL against the production
database.

The tool changes only these user-facing fields:

- `map_markers.title` and `map_markers.description`
- `marker_edit_proposals.marker_title`, `title`, and `description`
- `marker_image_proposals.marker_title`

It does not translate category or status codes, coordinates, IDs, account
data, timestamps, opening hours, image URLs, or ownership metadata.

## Inputs

The catalog is a JSON array with stable IDs, source strings, and the database
fields where each string occurs:

```json
[{"id": 1, "source": "source text", "fields": ["map_markers.title"]}]
```

Catalog field names follow the exported source JSON: the two proposal snapshot
fields are `marker_edit_proposals.markerTitle` and
`marker_image_proposals.markerTitle` (camel case), while their PostgreSQL
columns are named `marker_title`. The generator rejects any field name outside
the six supported catalog fields so title-length validation cannot be skipped
by a spelling or naming-style mismatch.

Translations may be split across multiple JSON files. Every entry must contain
the catalog ID, the exact trimmed source string, and nonempty English text:

```json
[{"id": 1, "source": "source text", "english": "English text"}]
```

## Generate the SQL

Use an isolated database name beginning with `lycoris_translate_`. The exact
name is embedded in the SQL as a safety guard.

```powershell
python backend/deploy/build_map_translation_sql.py `
  --catalog C:\secure-work\translation-catalog.json `
  --translations C:\secure-work\translations-001.json C:\secure-work\translations-002.json `
  --database lycoris_translate_example `
  --output C:\secure-work\apply-english.sql `
  --merged-output C:\secure-work\translations-merged.json
```

Before writing SQL, the generator rejects missing or duplicate IDs, changed or
untrimmed source text, placeholders, CJK characters left in English text, and
translated titles longer than the schema's 120-character limit. During import,
leading or trailing whitespace in legacy database values is ignored when
matching the normalized catalog source.

The generated SQL then performs another set of checks inside PostgreSQL:

1. Refuse to run unless `current_database()` matches the embedded temporary
   clone name.
2. Ensure every nonempty source value has a translation and every translation
   is used.
3. Update all six fields in one transaction and assert the affected row count
   for each field.
4. Confirm that all resulting values came from the validated translation map
   before committing.

For a release artifact, restore the original production backup into a new
temporary database, apply the generated SQL there, dump that translated clone,
restore the new dump into a second temporary database, and compare table counts
and immutable-field checksums. Drop both temporary databases after validation.
