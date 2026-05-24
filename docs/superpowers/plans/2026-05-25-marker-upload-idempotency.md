# Marker Upload Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate marker creation when optional image upload is slow or repeated save clicks occur.

**Architecture:** Add an idempotency key to marker creation and preserve the current separate image upload endpoint. The frontend disables concurrent saves and treats image upload failure as partial success after marker creation succeeds.

**Tech Stack:** Spring Boot 3.5, Spring Data JPA, JUnit/Mockito via `spring-boot-starter-test`, React, TypeScript, MUI, Axios.

---

### Task 1: Backend Idempotency Test

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/test/java/com/lycoris/service/MapMarkerServiceTest.java`

- [ ] **Step 1: Add test dependency**

Add `spring-boot-starter-test` with test scope in `backend/pom.xml`.

- [ ] **Step 2: Write failing tests**

Create `MapMarkerServiceTest` with:

- `createReturnsExistingMarkerForRepeatedClientRequestId`
- `createWithoutClientRequestIdSavesEachRequest`

Run: `./mvnw test -Dtest=MapMarkerServiceTest`

Expected: tests fail because `clientRequestId` fields and repository method do not exist yet.

### Task 2: Backend Idempotency Implementation

**Files:**
- Modify: `backend/src/main/java/com/lycoris/dto/MarkerCreateRequest.java`
- Modify: `backend/src/main/java/com/lycoris/entity/MapMarker.java`
- Modify: `backend/src/main/java/com/lycoris/repository/MapMarkerRepository.java`
- Modify: `backend/src/main/java/com/lycoris/service/MapMarkerService.java`

- [ ] **Step 1: Add DTO/entity field**

Add `clientRequestId` to marker create requests and persisted markers.

- [ ] **Step 2: Add lookup**

Add `Optional<MapMarker> findByUserPublicIdAndClientRequestId(String userPublicId, String clientRequestId)` to `MapMarkerRepository`.

- [ ] **Step 3: Implement create idempotency**

Normalize blank ids to null. For non-null ids, return an existing marker before save. Store the id on new markers. Catch unique constraint races and fetch the existing marker.

- [ ] **Step 4: Verify backend tests**

Run: `./mvnw test -Dtest=MapMarkerServiceTest`

Expected: tests pass.

### Task 3: Frontend Save State

**Files:**
- Modify: `frontend/src/components/MarkerFormDialog.tsx`
- Modify: `frontend/src/pages/Maps.tsx`

- [ ] **Step 1: Add dialog props**

Add `saving?: boolean` and `saveLabel?: string` props. Disable save/cancel/delete/image changes while saving.

- [ ] **Step 2: Add map page save state**

Add `savingDraft` and `saveDraftPhase`. Return early if a save is already in progress.

- [ ] **Step 3: Send idempotency key**

When creating a marker, include `clientRequestId: draft.tempId`.

- [ ] **Step 4: Handle image partial failure**

If image upload fails after marker creation succeeds, still add the marker, close the dialog, and show a warning notice.

### Task 4: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend tests**

Run: `./mvnw test`

Expected: build success.

- [ ] **Step 2: Run frontend verification**

Run the existing frontend build or typecheck command from `frontend/package.json`.

Expected: build/typecheck success.
