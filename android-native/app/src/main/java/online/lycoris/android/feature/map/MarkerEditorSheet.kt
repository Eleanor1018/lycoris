package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class MarkerDraft(
    val lat: Double,
    val lng: Double,
    val category: MarkerCategory = MarkerCategory.AccessibleToilet,
    val title: String = "",
    val description: String = "",
    val isPublic: Boolean = true,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
    val clientRequestId: String,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarkerEditorSheet(
    initialDraft: MarkerDraft,
    submitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (MarkerDraft) -> Unit,
    modifier: Modifier = Modifier,
) {
    var title by rememberSaveable(initialDraft.clientRequestId) {
        mutableStateOf(initialDraft.title)
    }
    var description by rememberSaveable(initialDraft.clientRequestId) {
        mutableStateOf(initialDraft.description)
    }
    var isPublic by rememberSaveable(initialDraft.clientRequestId) {
        mutableStateOf(initialDraft.isPublic)
    }
    val currentDraft = initialDraft.copy(
        title = title,
        description = description,
        isPublic = isPublic,
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, top = 8.dp, end = 24.dp, bottom = 32.dp),
        ) {
            Text(
                text = "新增点位",
                style = MaterialTheme.typography.titleLarge,
            )
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("标题") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("描述") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = "公开显示",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Switch(
                    checked = isPublic,
                    onCheckedChange = { isPublic = it },
                )
            }
            Button(
                enabled = !submitting && title.isNotBlank(),
                onClick = { onSubmit(currentDraft) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (submitting) "提交中" else "提交审核")
            }
        }
    }
}
