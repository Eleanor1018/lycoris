package online.lycoris.android.feature.search

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.feature.documents.DocumentRepository
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SearchRepositoryTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun searchMarkersUsesBackendSearchEndpoint() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    [
                      {
                        "id": 7,
                        "lat": 39.9,
                        "lng": 116.4,
                        "category": "friendly_clinic",
                        "title": "Clinic",
                        "description": "care",
                        "isPublic": true,
                        "isActive": true
                      }
                    ]
                    """.trimIndent(),
                ),
        )
        val repository = SearchRepository(createApi(), DocumentRepository())

        val result = repository.searchMarkers(" clinic ")
        val request = server.takeRequest()

        assertEquals("/api/markers/search?q=clinic", request.path)
        assertEquals("Clinic", result.single().title)
    }

    @Test
    fun searchMarkersReturnsEmptyAndErrorForBackendFailure() = runTest {
        server.enqueue(MockResponse().setResponseCode(500))
        val repository = SearchRepository(createApi(), DocumentRepository())

        val result = repository.searchMarkersSafely("clinic")

        assertTrue(result.markers.isEmpty())
        assertEquals("搜索点位失败", result.markerError)
    }

    private fun createApi() = NetworkModule.api(
        server.url("/").toString(),
        OkHttpClient(),
    )
}
