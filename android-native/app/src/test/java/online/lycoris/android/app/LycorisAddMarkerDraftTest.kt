package online.lycoris.android.app

import online.lycoris.android.feature.map.MarkerSubmitCoordinator
import online.lycoris.android.feature.map.MapCenter
import org.junit.Assert.assertEquals
import org.junit.Test

class LycorisAddMarkerDraftTest {
    @Test
    fun newAddMarkerDraftUsesStableClientRequestIdAndProvidedMapCenter() {
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        val draft = newAddMarkerDraft(
            markerSubmitCoordinator = coordinator,
            center = MapCenter(lat = 31.2304, lng = 121.4737),
        )

        assertEquals("draft-1", draft.clientRequestId)
        assertEquals(31.2304, draft.lat, 0.0)
        assertEquals(121.4737, draft.lng, 0.0)
    }
}
