package online.lycoris.android

import android.app.Application
import online.lycoris.android.app.LycorisAppContainer

class LycorisApplication : Application() {
    val container: LycorisAppContainer by lazy {
        LycorisAppContainer(this)
    }
}
