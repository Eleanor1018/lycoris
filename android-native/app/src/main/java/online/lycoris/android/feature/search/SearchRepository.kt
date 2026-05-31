package online.lycoris.android.feature.search

import android.content.Context
import kotlinx.coroutines.CancellationException
import online.lycoris.android.core.network.LycorisApi
import online.lycoris.android.feature.documents.DocumentRepository
import online.lycoris.android.feature.documents.DocumentSearchResult
import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.MarkerDto
import online.lycoris.android.feature.map.toMarker
import retrofit2.Response

data class SearchResults(
    val markers: List<Marker> = emptyList(),
    val documents: List<DocumentSearchResult> = emptyList(),
    val markerError: String? = null,
)

open class SearchRepository(
    private val api: LycorisApi,
    private val documentRepository: DocumentRepository = DocumentRepository(),
) {
    open suspend fun search(context: Context, query: String): SearchResults {
        val keyword = query.trim()
        if (keyword.isBlank()) return SearchResults()

        val markerResults = searchMarkersSafely(keyword)
        return markerResults.copy(
            documents = documentRepository.search(context, keyword),
        )
    }

    suspend fun searchMarkers(keyword: String): List<Marker> {
        val query = keyword.trim()
        if (query.isBlank()) return emptyList()
        return api.searchMarkers(query).bodyOrThrow().map(MarkerDto::toMarker)
    }

    suspend fun searchMarkersSafely(keyword: String): SearchResults {
        return try {
            SearchResults(markers = searchMarkers(keyword))
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            SearchResults(markerError = "搜索点位失败")
        }
    }

    private fun <T> Response<T>.bodyOrThrow(): T {
        if (!isSuccessful) {
            throw SearchRepositoryException(code())
        }
        return body() ?: throw SearchRepositoryException(code())
    }
}

class SearchRepositoryException(
    val statusCode: Int?,
) : Exception("搜索点位失败")
