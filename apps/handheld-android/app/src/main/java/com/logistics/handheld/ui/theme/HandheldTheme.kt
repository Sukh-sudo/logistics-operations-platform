package com.logistics.handheld.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF176B43),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFC2F2D4),
    onPrimaryContainer = Color(0xFF082117),
    secondary = Color(0xFF365E4A),
    error = Color(0xFFBA1A1A),
    surface = Color(0xFFF7FAF7),
    surfaceVariant = Color(0xFFE0E8E1),
    onSurface = Color(0xFF18211B),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF7DDBA7),
    primaryContainer = Color(0xFF005231),
    secondary = Color(0xFFB4CCBD),
    surface = Color(0xFF101612),
)

@Composable
fun HandheldTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
