package online.lycoris.android.app

import online.lycoris.android.feature.map.MarkerSubmitCoordinator
import org.junit.Assert.assertEquals
import org.junit.Test

class LycorisAddMarkerDraftTest {
    @Test
    fun newAddMarkerDraftUsesStableClientRequestIdAndBeijingMvpCoordinates() {
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        val draft = newAddMarkerDraft(coordinator)

        assertEquals("draft-1", draft.clientRequestId)
        assertEquals(39.9042, draft.lat, 0.0)
        assertEquals(116.4074, draft.lng, 0.0)
    }
}
