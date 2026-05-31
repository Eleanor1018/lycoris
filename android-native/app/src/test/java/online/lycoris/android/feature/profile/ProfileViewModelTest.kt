package online.lycoris.android.feature.profile

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
import online.lycoris.android.core.network.LycorisApi
import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.MarkerCategory
import online.lycoris.android.feature.map.MarkerRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import java.lang.reflect.Proxy

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun staleLoadDoesNotOverwriteClearedState() = runTest {
        val created = CompletableDeferred<List<Marker>>()
        val favorites = CompletableDeferred<List<Marker>>()
        val viewModel = ProfileViewModel(
            FakeProfileRepository(
                createdResults = mutableListOf(created),
                favoriteResults = mutableListOf(favorites),
            ),
        )

        viewModel.load()
        runCurrent()
        viewModel.clear()

        created.complete(listOf(marker(id = 1)))
        favorites.complete(listOf(marker(id = 2)))
        advanceUntilIdle()

        assertFalse(viewModel.state.value.loading)
        assertEquals(emptyList<Marker>(), viewModel.state.value.createdMarkers)
        assertEquals(emptyList<Marker>(), viewModel.state.value.favoriteMarkers)
    }

    @Test
    fun loadKeepsCreatedMarkersWhenFavoritesFail() = runTest {
        val viewModel = ProfileViewModel(
            FakeProfileRepository(
                createdResults = mutableListOf(CompletableDeferred(listOf(marker(id = 1)))),
                favoriteResults = mutableListOf(CompletableDeferred<List<Marker>>().also {
                    it.completeExceptionally(IllegalStateException("unauthenticated"))
                }),
            ),
        )

        viewModel.load()
        advanceUntilIdle()

        assertFalse(viewModel.state.value.loading)
        assertEquals(listOf(1L), viewModel.state.value.createdMarkers.map { it.id })
        assertEquals(emptyList<Marker>(), viewModel.state.value.favoriteMarkers)
        assertEquals(null, viewModel.state.value.message)
    }
}

private class FakeProfileRepository(
    private val createdResults: MutableList<CompletableDeferred<List<Marker>>>,
    private val favoriteResults: MutableList<CompletableDeferred<List<Marker>>>,
) : ProfileRepository(MarkerRepository(fakeApi())) {
    override suspend fun createdMarkers(): List<Marker> {
        return createdResults.removeAt(0).await()
    }

    override suspend fun favoriteMarkers(): List<Marker> {
        return favoriteResults.removeAt(0).await()
    }
}

private fun fakeApi(): LycorisApi {
    return Proxy.newProxyInstance(
        LycorisApi::class.java.classLoader,
        arrayOf(LycorisApi::class.java),
    ) { _, method, _ ->
        error("Unexpected API call: ${method.name}")
    } as LycorisApi
}

private fun marker(id: Long): Marker = Marker(
    id = id,
    lat = 39.9,
    lng = 116.4,
    category = MarkerCategory.AccessibleToilet,
    title = "Marker $id",
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
