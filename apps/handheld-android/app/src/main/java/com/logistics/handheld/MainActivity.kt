package com.logistics.handheld

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.logistics.handheld.ui.HandheldApp
import com.logistics.handheld.ui.HandheldViewModel
import com.logistics.handheld.ui.theme.HandheldTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: HandheldViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HandheldTheme {
                HandheldApp(viewModel)
            }
        }
    }
}
