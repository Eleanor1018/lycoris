# 2026-09-05 bug fixes

`2026-09-05-bugfix-versions.sql` adds the session and optimistic concurrency columns without deleting existing data. The current application uses `spring.jpa.hibernate.ddl-auto=update`; the same column definitions are present on the entities. Deployments that disable automatic schema updates should apply this SQL before starting the new backend. Do not run the older backend concurrently with the new one: it does not maintain the version fields.

After this release, existing sessions without a session version need to log in again. Password reset, account deletion and restoration revoke older sessions. A password change keeps the device making the change logged in and revokes its other sessions.

Existing edit proposals have no trustworthy baseline version. They remain available in the review queue, but approval returns HTTP 409 and asks for a new submission. New proposals record the marker version, so later approvals cannot silently overwrite intervening changes.

Uploads are now served through `UploadController`. Keep `/uploads/` routed to the backend; do not add a public Nginx alias or object-store ACL that bypasses marker permissions. Newly uploaded JPEG, PNG, GIF and WebP images are decoded and re-encoded as JPEG/PNG. Existing supported image files remain readable subject to current permissions; no uploaded files are deleted by this migration.

WebP decoding uses [TwelveMonkeys ImageIO](https://github.com/haraldk/TwelveMonkeys), pinned in `pom.xml`. H2 is a test-only dependency used for the review-concurrency regression tests; the production database remains PostgreSQL.
