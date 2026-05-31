package online.lycoris.android.feature.documents

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DocumentsScreen(
    repository: DocumentRepository = DocumentRepository(),
) {
    val context = LocalContext.current
    var active by remember { mutableStateOf(repository.documents.first()) }
    var loaded by remember { mutableStateOf<LoadedDocument?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(active) {
        error = null
        loaded = runCatching { repository.loadDocument(context, active.slug) }
            .onFailure { error = "文档加载失败" }
            .getOrNull()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                text = "文档",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                repository.documents.forEach { document ->
                    val selected = document.slug == active.slug
                    if (selected) {
                        Button(onClick = { active = document }) {
                            Text(document.title)
                        }
                    } else {
                        OutlinedButton(onClick = { active = document }) {
                            Text(document.title)
                        }
                    }
                }
            }
        }

        error?.let { message ->
            item {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        loaded?.let { document ->
            if (document.toc.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = "目录",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            document.toc.take(24).forEach { item ->
                                AssistChip(
                                    onClick = {},
                                    label = { Text("${"  ".repeat((item.level - 2).coerceAtLeast(0))}${item.text}") },
                                )
                            }
                        }
                    }
                }
            }

            item {
                Text(
                    text = document.title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.widthIn(max = 720.dp),
                )
            }

            items(document.blocks) { block ->
                MarkdownTextBlock(block)
            }
        }
    }
}

@Composable
private fun MarkdownTextBlock(block: DocumentBlock) {
    val style = when (block.level) {
        1 -> MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold)
        2 -> MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
        3 -> MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
        4 -> MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold)
        else -> MaterialTheme.typography.bodyLarge.copy(lineHeight = 25.sp)
    }

    Text(
        text = block.text,
        style = style,
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = 720.dp)
            .padding(
                top = if (block.level in 1..4) 10.dp else 0.dp,
                bottom = if (block.level in 1..4) 2.dp else 6.dp,
            ),
    )
}
