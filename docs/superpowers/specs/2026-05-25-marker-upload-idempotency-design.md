# Marker Upload Idempotency Design

## Problem

Creating a marker currently uses two sequential requests:

1. `POST /api/markers` stores the marker text fields.
2. `POST /api/markers/{id}/image` uploads the optional image proposal.

When the network is slow during image upload, the marker may already be stored while the UI still looks stuck. If the user clicks save repeatedly, each click can create another marker because the backend does not recognize repeated submissions.

## Goals

- Prevent duplicate marker creation from repeated clicks, request retries, or slow image uploads.
- Keep marker text submission successful even when the optional image upload fails.
- Give users clear save/upload progress and a recoverable message when image upload fails.
- Keep the change small and compatible with the current split marker/image endpoints.

## Design

Use a two-layer defense.

Frontend:

- Add a save state to the map page so the dialog save button is disabled while a save is in flight.
- Reuse the draft `tempId` as `clientRequestId` for new marker creation.
- Show save/upload progress through the save button label.
- If marker creation succeeds but image upload fails, keep the marker result, close the dialog, and show a notice that the marker was submitted but the image failed and can be retried later.

Backend:

- Add `clientRequestId` to `MarkerCreateRequest` and `MapMarker`.
- Add a repository lookup for `(userPublicId, clientRequestId)`.
- In `MapMarkerService.create`, normalize blank request ids to null. For non-null ids, return the existing marker for the same user and request id instead of creating another row.
- Add a database unique constraint on `(user_public_id, client_request_id)` as defense against concurrent duplicate requests.

## Data Flow

1. User opens a new marker draft; the existing `tempId` is generated once.
2. User clicks save.
3. Frontend sends marker fields plus `clientRequestId: draft.tempId`.
4. Backend checks whether this user already created a marker with that request id.
5. If yes, backend returns the existing marker. If no, backend creates it and stores the request id.
6. Frontend uploads the optional image for the returned marker id.
7. If image upload fails, frontend reports the partial success instead of retrying marker creation.

## Error Handling

- Missing auth stays unchanged.
- Invalid marker fields stay unchanged.
- Duplicate create requests return `200 OK` with the original marker.
- Image upload failures do not undo marker creation.
- The UI prevents multiple simultaneous saves from the same dialog.

## Testing

- Add a unit test proving repeated `create` calls with the same user and `clientRequestId` return the existing marker and call `save` only once.
- Add a unit test proving blank `clientRequestId` uses the previous create behavior.
- Run backend tests with Maven.
- Run frontend build or typecheck if available.
