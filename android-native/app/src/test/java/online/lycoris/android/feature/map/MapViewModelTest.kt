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
        val repository = FakeMapRepository(listOf(firstRequest, secondRequest))
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

    private fun marker(id: Long): Marker = Marker(
        id = id,
        lat = 39.9,
        lng = 116.4,
        category = MarkerCategory.AccessibleToilet,
        title = "未命名点位",
        description = "",
        isPublic = true,
        isActive = true,
    )
}

private class FakeMapRepository(
    private val viewportResults: List<CompletableDeferred<List<Marker>>>,
) : MapRepository {
    private var viewportCalls = 0

    override suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> {
        return viewportResults[viewportCalls++].await()
    }

    override suspend fun loadFavoriteIds(): List<Long> = emptyList()
}

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
