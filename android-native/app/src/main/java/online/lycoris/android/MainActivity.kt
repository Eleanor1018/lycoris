package online.lycoris.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import online.lycoris.android.app.LycorisApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LycorisApp(
                container = (application as LycorisApplication).container,
            )
        }
    }
}
