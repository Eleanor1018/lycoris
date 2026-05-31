package online.lycoris.android.feature.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import online.lycoris.android.feature.map.Marker

@Composable
fun SearchScreen(
    state: SearchUiState,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                text = "搜索",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = onQueryChange,
                    label = { Text("搜索点位或文档") },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = { onSearch() },
                    enabled = state.query.isNotBlank() && !state.loading,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Text("搜索")
                }
            }
        }

        if (state.loading) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator()
                    Text("正在搜索...")
                }
            }
        }

        if (state.query.isBlank()) {
            item {
                EmptyState("输入关键词后，会同时搜索地图点位和本地文档。")
            }
        } else {
            item {
                SectionHeader("点位结果", "${state.markers.size} 条")
            }
            state.markerError?.let { error ->
                item {
                    Text(error, color = MaterialTheme.colorScheme.error)
                }
            }
            if (state.markers.isEmpty() && !state.loading) {
                item { EmptyState("暂无点位匹配。") }
            } else {
                items(state.markers) { marker ->
                    MarkerResultCard(marker)
                }
            }

            item {
                SectionHeader("文档结果", "${state.documents.size} 条")
            }
            if (state.documents.isEmpty() && !state.loading) {
                item { EmptyState("暂无文档匹配。") }
            } else {
                items(state.documents) { document ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(document.title, fontWeight = FontWeight.Bold)
                            Text(
                                text = document.snippet,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            AssistChip(
                                onClick = {},
                                label = { Text(document.entry.slug) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    SearchScreen(
        state = state,
        onQueryChange = viewModel::updateQuery,
        onSearch = { viewModel.search(context) },
    )
}

@Composable
private fun SectionHeader(title: String, count: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        AssistChip(onClick = {}, label = { Text(count) })
    }
}

@Composable
private fun MarkerResultCard(marker: Marker) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(marker.title, fontWeight = FontWeight.Bold)
            Text(
                text = marker.description.ifBlank { "暂无描述" },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = {}, label = { Text(marker.category.label) })
                AssistChip(
                    onClick = {},
                    label = { Text("%.5f, %.5f".format(marker.lat, marker.lng)) },
                )
            }
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Text(
            text = message,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
