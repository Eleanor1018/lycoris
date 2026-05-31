package online.lycoris.android.core.image

import android.content.ContentResolver
import android.provider.OpenableColumns
import android.net.Uri

data class LocalImage(
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
    val bytes: ByteArray,
    val uri: Uri? = null,
)

object ImageRules {
    const val MaxUploadBytes: Long = 5 * 1024 * 1024

    fun canUpload(image: LocalImage): Boolean {
        return image.sizeBytes in 1..MaxUploadBytes && image.mimeType.startsWith("image/")
    }
}

sealed interface PickedImageResult {
    data class Success(
        val image: LocalImage,
    ) : PickedImageResult

    data class Invalid(
        val message: String,
    ) : PickedImageResult
}

fun readPickedImage(
    contentResolver: ContentResolver,
    uri: Uri,
): PickedImageResult {
    val mimeType = contentResolver.getType(uri).orEmpty()
    val fileName = contentResolver.displayName(uri) ?: "marker-image"
    val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
        ?: return PickedImageResult.Invalid("图片读取失败")
    val image = LocalImage(
        uri = uri,
        fileName = fileName,
        mimeType = mimeType,
        sizeBytes = bytes.size.toLong(),
        bytes = bytes,
    )
    return if (ImageRules.canUpload(image)) {
        PickedImageResult.Success(image)
    } else {
        PickedImageResult.Invalid("请选择 5MB 以内的图片")
    }
}

private fun ContentResolver.displayName(uri: Uri): String? {
    return query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0 && cursor.moveToFirst()) {
            cursor.getString(nameIndex)
        } else {
            null
        }
    }
}
