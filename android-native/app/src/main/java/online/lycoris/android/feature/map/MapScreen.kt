package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun MapScreen(
    state: MapUiState,
    onMarkerClick: (Long) -> Unit,
    onDismissMarker: () -> Unit,
    onToggleFavorite: (Long) -> Unit,
    onMapCenterChanged: (MapCenter) -> Unit,
    onAddClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize()) {
        OsmMapView(
            markers = state.markers,
            onMarkerClick = onMarkerClick,
            onMapCenterChanged = onMapCenterChanged,
            modifier = Modifier.fillMaxSize(),
        )

        FloatingActionButton(
            onClick = onAddClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "新增点位")
        }

        if (state.loading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
            )
        }

        state.message?.let { message ->
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                tonalElevation = 4.dp,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(16.dp),
            ) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                )
            }
        }

        state.selectedMarker?.let { selectedMarker ->
            MarkerDetailSheet(
                marker = selectedMarker,
                isFavorite = selectedMarker.id in state.favoriteIds,
                onDismiss = onDismissMarker,
                onToggleFavorite = { onToggleFavorite(selectedMarker.id) },
            )
        }
    }
}
