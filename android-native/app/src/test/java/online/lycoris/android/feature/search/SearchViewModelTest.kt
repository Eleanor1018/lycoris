package online.lycoris.android.feature.search

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import online.lycoris.android.core.network.LycorisApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import java.lang.reflect.Proxy

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun searchFailureClearsLoadingAndShowsError() = runTest {
        val failure = CompletableDeferred<SearchResults>().also {
            it.completeExceptionally(IllegalStateException("docs failed"))
        }
        val viewModel = SearchViewModel(FakeSearchRepository(mutableListOf(failure)))

        viewModel.updateQuery("clinic")
        viewModel.search(TestContext())
        advanceUntilIdle()

        assertFalse(viewModel.state.value.loading)
        assertEquals("搜索失败", viewModel.state.value.markerError)
    }
}

private class FakeSearchRepository(
    private val results: MutableList<CompletableDeferred<SearchResults>>,
) : SearchRepository(api = fakeApi()) {
    override suspend fun search(context: Context, query: String): SearchResults {
        return results.removeAt(0).await()
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

private class TestContext : ContextWrapper(null) {
    override fun getApplicationContext(): Context = this
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
