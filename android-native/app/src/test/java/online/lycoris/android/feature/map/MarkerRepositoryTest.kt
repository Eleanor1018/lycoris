package online.lycoris.android.feature.map

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import online.lycoris.android.core.image.LocalImage
import online.lycoris.android.core.network.NetworkModule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MarkerRepositoryTest {
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
    fun loadViewportSendsBoundsAndCategoryQuery() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    [
                      {
                        "id": 12,
                        "lat": 39.9,
                        "lng": 116.4,
                        "category": "accessible_toilet",
                        "title": "A口",
                        "description": "",
                        "isPublic": true,
                        "isActive": true
                      }
                    ]
                    """.trimIndent(),
                ),
        )
        val repository = MarkerRepository(createApi())

        val markers = repository.loadViewport(
            ViewportBounds(39.0, 40.0, 116.0, 117.0),
            listOf(MarkerCategory.AccessibleToilet),
        )
        val request = server.takeRequest()

        assertEquals(1, markers.size)
        assertEquals("A口", markers.single().title)
        assertEquals(
            "/api/markers/viewport?minLat=39.0&maxLat=40.0&minLng=116.0&maxLng=117.0&categories=accessible_toilet",
            request.path,
        )
    }

    @Test
    fun uploadMarkerImageUsesMultipartFieldNamedFile() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "id": 12,
                      "lat": 39.9,
                      "lng": 116.4,
                      "category": "accessible_toilet",
                      "title": "A口",
                      "description": "",
                      "isPublic": true,
                      "isActive": true,
                      "markImage": "/uploads/marker.jpg"
                    }
                    """.trimIndent(),
                ),
        )
        val repository = MarkerRepository(createApi())

        val marker = repository.uploadMarkerImage(
            12,
            LocalImage(
                fileName = "marker.jpg",
                mimeType = "image/jpeg",
                sizeBytes = 4,
                bytes = byteArrayOf(1, 2, 3, 4),
            ),
        )
        val request = server.takeRequest()

        assertEquals("/api/markers/12/image", request.path)
        assertTrue(request.body.readUtf8().contains("name=\"file\"; filename=\"marker.jpg\""))
        assertEquals("/uploads/marker.jpg", marker.markImage)
    }

    private fun createApi() = NetworkModule.api(
        server.url("/").toString(),
        OkHttpClient(),
    )
}
