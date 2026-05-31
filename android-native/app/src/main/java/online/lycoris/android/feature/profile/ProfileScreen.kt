package online.lycoris.android.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import online.lycoris.android.feature.auth.AuthUiState
import online.lycoris.android.feature.map.Marker

@Composable
fun ProfileScreen(
    authState: AuthUiState,
    profileState: ProfileUiState,
    onOpenLogin: () -> Unit,
    onLogout: () -> Unit,
    onLoadProfile: () -> Unit,
    onClearProfile: () -> Unit,
) {
    val user = authState.user

    LaunchedEffect(user?.publicId) {
        if (user == null) {
            onClearProfile()
        } else {
            onLoadProfile()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                text = "我的",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        if (user == null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text("登录后可以查看资料、我创建的点位和收藏点位。")
                        Button(onClick = onOpenLogin) {
                            Text("登录")
                        }
                    }
                }
            }
            return@LazyColumn
        }

        item {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(user.nickname.ifBlank { user.username }, fontWeight = FontWeight.Bold)
                    Text("@${user.username}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(user.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    user.role?.takeIf { it.isNotBlank() }?.let { role ->
                        AssistChip(onClick = {}, label = { Text(role) })
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(onClick = onLoadProfile, enabled = !profileState.loading) {
                            Text("刷新")
                        }
                        Button(onClick = onLogout) {
                            Text("退出登录")
                        }
                    }
                }
            }
        }

        if (profileState.loading) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator()
                    Text("正在加载点位...")
                }
            }
        }

        profileState.message?.let { message ->
            item {
                Text(message, color = MaterialTheme.colorScheme.error)
            }
        }

        item {
            SectionHeader("我创建的点位", profileState.createdMarkers.size)
        }
        if (profileState.createdMarkers.isEmpty() && !profileState.loading) {
            item { EmptyMarkerState("暂无创建点位") }
        } else {
            items(profileState.createdMarkers) { marker ->
                ProfileMarkerCard(marker)
            }
        }

        item {
            SectionHeader("我收藏的点位", profileState.favoriteMarkers.size)
        }
        if (profileState.favoriteMarkers.isEmpty() && !profileState.loading) {
            item { EmptyMarkerState("暂无收藏点位") }
        } else {
            items(profileState.favoriteMarkers) { marker ->
                ProfileMarkerCard(marker)
            }
        }
    }
}

@Composable
fun ProfileScreen(
    authState: AuthUiState,
    viewModel: ProfileViewModel,
    onOpenLogin: () -> Unit,
    onLogout: () -> Unit,
) {
    val profileState by viewModel.state.collectAsStateWithLifecycle()
    ProfileScreen(
        authState = authState,
        profileState = profileState,
        onOpenLogin = onOpenLogin,
        onLogout = onLogout,
        onLoadProfile = viewModel::load,
        onClearProfile = viewModel::clear,
    )
}

@Composable
private fun SectionHeader(title: String, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        AssistChip(onClick = {}, label = { Text("$count 条") })
    }
}

@Composable
private fun ProfileMarkerCard(marker: Marker) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(marker.title, fontWeight = FontWeight.Bold)
            Text(marker.category.label, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                marker.updatedAt?.take(10) ?: marker.createdAt?.take(10) ?: "暂无更新时间",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (marker.description.isNotBlank()) {
                Text(marker.description)
            }
        }
    }
}

@Composable
private fun EmptyMarkerState(message: String) {
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
