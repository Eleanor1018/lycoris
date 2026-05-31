package online.lycoris.android.feature.map

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class MapViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun loadViewportOnlyLatestRequestUpdatesState() = runTest {
        val firstRequest = CompletableDeferred<List<Marker>>()
        val secondRequest = CompletableDeferred<List<Marker>>()
        val repository = FakeMapRepository(
            viewportResults = mutableListOf(firstRequest, secondRequest),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadViewport(ViewportBounds(0.0, 1.0, 0.0, 1.0))
        runCurrent()
        viewModel.loadViewport(ViewportBounds(1.0, 2.0, 1.0, 2.0))
        runCurrent()

        secondRequest.complete(listOf(marker(id = 2)))
        advanceUntilIdle()
        firstRequest.complete(listOf(marker(id = 1)))
        advanceUntilIdle()

        assertEquals(listOf(2L), viewModel.state.value.markers.map { it.id })
        assertFalse(viewModel.state.value.loading)
        assertEquals(null, viewModel.state.value.message)
    }

    @Test
    fun loadFavoritesUpdatesFavoriteIds() = runTest {
        val repository = FakeMapRepository(
            favoriteResults = mutableListOf(CompletableDeferred(listOf(7L, 8L))),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadFavorites()
        advanceUntilIdle()

        assertEquals(setOf(7L, 8L), viewModel.state.value.favoriteIds)
        assertEquals(null, viewModel.state.value.message)
    }

    @Test
    fun loadFavoritesShowsFailureMessage() = runTest {
        val repository = FakeMapRepository(
            favoriteResults = mutableListOf(CompletableDeferred<List<Long>>().also {
                it.completeExceptionally(IllegalStateException("收藏加载失败"))
            }),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadFavorites()
        advanceUntilIdle()

        assertEquals("收藏加载失败", viewModel.state.value.message)
    }

    @Test
    fun toggleFavoriteSerializesRapidTapsAgainstLatestState() = runTest {
        val firstSet = CompletableDeferred<Unit>()
        val secondSet = CompletableDeferred<Unit>()
        val repository = FakeMapRepository(
            setFavoriteGates = mutableListOf(firstSet, secondSet),
        )
        val viewModel = MapViewModel(repository)

        viewModel.toggleFavorite(7)
        runCurrent()
        viewModel.toggleFavorite(7)
        runCurrent()

        firstSet.complete(Unit)
        advanceUntilIdle()
        secondSet.complete(Unit)
        advanceUntilIdle()

        assertEquals(listOf(true, false), repository.setFavoriteCalls.map { it.favorite })
        assertEquals(emptySet<Long>(), viewModel.state.value.favoriteIds)
        assertEquals(null, viewModel.state.value.message)
    }

    @Test
    fun toggleFavoriteShowsFailureMessage() = runTest {
        val repository = FakeMapRepository(
            setFavoriteFailure = IllegalStateException("收藏操作失败"),
        )
        val viewModel = MapViewModel(repository)

        viewModel.toggleFavorite(7)
        advanceUntilIdle()

        assertEquals("收藏操作失败", viewModel.state.value.message)
    }

    @Test
    fun loadNearbyMergesMarkersById() = runTest {
        val repository = FakeMapRepository(
            viewportResults = mutableListOf(CompletableDeferred(listOf(marker(id = 1), marker(id = 2, title = "旧点位")))),
            nearbyResults = mutableListOf(CompletableDeferred(listOf(marker(id = 2, title = "新点位"), marker(id = 3)))),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadViewport(ViewportBounds(0.0, 1.0, 0.0, 1.0))
        advanceUntilIdle()
        viewModel.loadNearby(39.9, 116.4, 1_000, MarkerCategory.AccessibleToilet)
        advanceUntilIdle()

        assertEquals(listOf(1L, 2L, 3L), viewModel.state.value.markers.map { it.id })
        assertEquals("新点位", viewModel.state.value.markers.first { it.id == 2L }.title)
        assertFalse(viewModel.state.value.loading)
        assertEquals(null, viewModel.state.value.message)
    }

    @Test
    fun loadNearbyOnlyLatestRequestUpdatesState() = runTest {
        val firstRequest = CompletableDeferred<List<Marker>>()
        val secondRequest = CompletableDeferred<List<Marker>>()
        val repository = FakeMapRepository(
            nearbyResults = mutableListOf(firstRequest, secondRequest),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadNearby(39.9, 116.4, 1_000, MarkerCategory.AccessibleToilet)
        runCurrent()
        viewModel.loadNearby(40.0, 116.5, 2_000, MarkerCategory.BabyRoom)
        runCurrent()

        secondRequest.complete(listOf(marker(id = 2)))
        advanceUntilIdle()
        firstRequest.complete(listOf(marker(id = 1)))
        advanceUntilIdle()

        assertEquals(listOf(2L), viewModel.state.value.markers.map { it.id })
        assertFalse(viewModel.state.value.loading)
        assertEquals(null, viewModel.state.value.message)
    }

    @Test
    fun loadNearbyShowsFailureMessage() = runTest {
        val repository = FakeMapRepository(
            nearbyResults = mutableListOf(CompletableDeferred<List<Marker>>().also {
                it.completeExceptionally(IllegalStateException("附近点位查询失败"))
            }),
        )
        val viewModel = MapViewModel(repository)

        viewModel.loadNearby(39.9, 116.4, 1_000, MarkerCategory.AccessibleToilet)
        advanceUntilIdle()

        assertFalse(viewModel.state.value.loading)
        assertEquals("附近点位查询失败", viewModel.state.value.message)
    }

    @Test
    fun createMarkerMergesCreatedMarkerAndSelectsIt() = runTest {
        val createdMarker = marker(id = 9, title = "A口")
        val repository = FakeMapRepository(
            createResults = mutableListOf(CompletableDeferred(createdMarker)),
        )
        val viewModel = MapViewModel(repository)

        viewModel.createMarker(
            MarkerDraft(
                lat = 39.9,
                lng = 116.4,
                title = "A口",
                clientRequestId = "draft-1",
            ),
        )
        advanceUntilIdle()

        assertEquals(listOf(9L), viewModel.state.value.markers.map { it.id })
        assertEquals(9L, viewModel.state.value.selectedMarkerId)
        assertEquals("已提交管理员审核", viewModel.state.value.message)
        assertFalse(viewModel.state.value.loading)
        assertEquals("draft-1", repository.createCalls.single().clientRequestId)
    }

    @Test
    fun deleteMarkerRemovesMarkerAndClearsSelection() = runTest {
        val repository = FakeMapRepository(
            viewportResults = mutableListOf(CompletableDeferred(listOf(marker(id = 7)))),
            deleteResults = mutableListOf(CompletableDeferred(Unit)),
        )
        val viewModel = MapViewModel(repository)
        viewModel.loadViewport(ViewportBounds(0.0, 1.0, 0.0, 1.0))
        advanceUntilIdle()
        viewModel.selectMarker(7)

        viewModel.deleteMarker(7)
        advanceUntilIdle()

        assertEquals(emptyList<Long>(), viewModel.state.value.markers.map { it.id })
        assertEquals(null, viewModel.state.value.selectedMarkerId)
        assertEquals("点位已删除", viewModel.state.value.message)
    }
}

private data class SetFavoriteCall(
    val id: Long,
    val favorite: Boolean,
)

private class FakeMapRepository(
    private val viewportResults: MutableList<CompletableDeferred<List<Marker>>> = mutableListOf(),
    private val favoriteResults: MutableList<CompletableDeferred<List<Long>>> = mutableListOf(),
    private val nearbyResults: MutableList<CompletableDeferred<List<Marker>>> = mutableListOf(),
    private val createResults: MutableList<CompletableDeferred<Marker>> = mutableListOf(),
    private val deleteResults: MutableList<CompletableDeferred<Unit>> = mutableListOf(),
    private val setFavoriteGates: MutableList<CompletableDeferred<Unit>> = mutableListOf(),
    private val setFavoriteFailure: Throwable? = null,
) : MapRepository {
    private val favorites = mutableSetOf<Long>()
    val setFavoriteCalls = mutableListOf<SetFavoriteCall>()
    val createCalls = mutableListOf<MarkerCreateRequest>()

    override suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> {
        return viewportResults.removeAt(0).await()
    }

    override suspend fun loadFavoriteIds(): List<Long> {
        return if (favoriteResults.isNotEmpty()) {
            favoriteResults.removeAt(0).await()
        } else {
            favorites.toList()
        }
    }

    override suspend fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ): List<Marker> {
        return nearbyResults.removeAt(0).await()
    }

    override suspend fun createMarker(request: MarkerCreateRequest): Marker {
        createCalls.add(request)
        return createResults.removeAt(0).await()
    }

    override suspend fun deleteMarker(id: Long) {
        deleteResults.removeAt(0).await()
    }

    override suspend fun setFavorite(id: Long, favorite: Boolean) {
        setFavoriteFailure?.let { throw it }
        setFavoriteCalls.add(SetFavoriteCall(id, favorite))
        if (setFavoriteGates.isNotEmpty()) {
            setFavoriteGates.removeAt(0).await()
        }
        if (favorite) {
            favorites.add(id)
        } else {
            favorites.remove(id)
        }
    }
}

private fun marker(
    id: Long,
    title: String = "未命名点位",
): Marker = Marker(
    id = id,
    lat = 39.9,
    lng = 116.4,
    category = MarkerCategory.AccessibleToilet,
    title = title,
    description = "",
    isPublic = true,
    isActive = true,
)

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    private val dispatcher: TestDispatcher = StandardTestDispatcher(),
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
