package online.lycoris.android.core.image

import android.net.Uri

data class LocalImage(
    val uri: Uri,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
)

object ImageRules {
    const val MaxUploadBytes: Long = 5 * 1024 * 1024

    fun canUpload(image: LocalImage): Boolean {
        return image.sizeBytes in 1..MaxUploadBytes && image.mimeType.startsWith("image/")
    }
}
