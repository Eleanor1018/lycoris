package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarkerDetailSheet(
    marker: Marker,
    isFavorite: Boolean,
    onDismiss: () -> Unit,
    onToggleFavorite: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, top = 8.dp, end = 24.dp, bottom = 32.dp),
        ) {
            Text(
                text = marker.title,
                style = MaterialTheme.typography.titleLarge,
            )
            Text(
                text = marker.category.label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            if (marker.description.isNotBlank()) {
                Text(
                    text = marker.description,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            val buttonText = if (isFavorite) "取消收藏" else "收藏"
            if (isFavorite) {
                OutlinedButton(
                    onClick = onToggleFavorite,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(buttonText)
                }
            } else {
                Button(
                    onClick = onToggleFavorite,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(buttonText)
                }
            }
        }
    }
}
