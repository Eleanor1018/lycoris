package online.lycoris.android.core.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object LycorisColors {
    val Primary = Color(0xFF5A3850)
    val MapPrimary = Color(0xFF7A4B8F)
    val Secondary = Color(0xFFD0BCFF)
    val Background = Color(0xFFF8EBFF)
    val Surface = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF1D1B20)
    val TextSecondary = Color(0xB8231828)
    val Border = Color(0x1F7A4B8F)
    val Danger = Color(0xFFDC2626)
    val Success = Color(0xFF16A34A)
}

private val LycorisLightColorScheme = lightColorScheme(
    primary = LycorisColors.Primary,
    onPrimary = LycorisColors.Surface,
    primaryContainer = LycorisColors.Secondary,
    onPrimaryContainer = LycorisColors.TextPrimary,
    secondary = LycorisColors.MapPrimary,
    onSecondary = LycorisColors.Surface,
    background = LycorisColors.Background,
    onBackground = LycorisColors.TextPrimary,
    surface = LycorisColors.Surface,
    onSurface = LycorisColors.TextPrimary,
    surfaceVariant = LycorisColors.Background,
    onSurfaceVariant = LycorisColors.TextSecondary,
    outline = LycorisColors.Border,
    error = LycorisColors.Danger,
    onError = LycorisColors.Surface,
)

@Composable
fun LycorisTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LycorisLightColorScheme,
        typography = Typography(),
        content = content,
    )
}
