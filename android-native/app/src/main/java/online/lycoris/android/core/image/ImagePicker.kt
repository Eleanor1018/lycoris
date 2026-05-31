package online.lycoris.android.core.image

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import java.io.InputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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

sealed interface BoundedReadResult {
    data class Success(
        val bytes: ByteArray,
    ) : BoundedReadResult

    data object TooLarge : BoundedReadResult
}

suspend fun readPickedImage(
    contentResolver: ContentResolver,
    uri: Uri,
): PickedImageResult = withContext(Dispatchers.IO) {
    try {
        val mimeType = contentResolver.getType(uri).orEmpty()
        if (!mimeType.startsWith("image/")) {
            return@withContext PickedImageResult.Invalid("请选择图片文件")
        }

        val fileName = contentResolver.displayName(uri) ?: "marker-image"
        val reportedSize = contentResolver.sizeBytes(uri)
        if (reportedSize != null && reportedSize > ImageRules.MaxUploadBytes) {
            return@withContext PickedImageResult.Invalid("请选择 5MB 以内的图片")
        }

        val bytes = when (
            val readResult = contentResolver.openInputStream(uri)?.use { input ->
                readBytesUpToLimit(input, ImageRules.MaxUploadBytes)
            }
        ) {
            is BoundedReadResult.Success -> readResult.bytes
            BoundedReadResult.TooLarge -> return@withContext PickedImageResult.Invalid("请选择 5MB 以内的图片")
            null -> return@withContext PickedImageResult.Invalid("图片读取失败")
        }
        val image = LocalImage(
            uri = uri,
            fileName = fileName,
            mimeType = mimeType,
            sizeBytes = bytes.size.toLong(),
            bytes = bytes,
        )
        if (ImageRules.canUpload(image)) {
            PickedImageResult.Success(image)
        } else {
            PickedImageResult.Invalid("请选择 5MB 以内的图片")
        }
    } catch (error: CancellationException) {
        throw error
    } catch (error: Throwable) {
        PickedImageResult.Invalid("图片读取失败")
    }
}

fun readBytesUpToLimit(
    input: InputStream,
    maxBytes: Long,
): BoundedReadResult {
    require(maxBytes in 0..Int.MAX_VALUE)

    val output = ByteArray(maxBytes.toInt())
    val chunk = ByteArray(DEFAULT_BUFFER_SIZE)
    var total = 0
    while (true) {
        val readLimit = (maxBytes - total + 1).coerceAtMost(chunk.size.toLong()).toInt()
        val bytesRead = input.read(chunk, 0, readLimit)
        if (bytesRead == -1) {
            return BoundedReadResult.Success(
                bytes = if (total == output.size) output else output.copyOf(total),
            )
        }
        if (total + bytesRead > maxBytes) {
            return BoundedReadResult.TooLarge
        }
        chunk.copyInto(
            destination = output,
            destinationOffset = total,
            startIndex = 0,
            endIndex = bytesRead,
        )
        total += bytesRead
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

private fun ContentResolver.sizeBytes(uri: Uri): Long? {
    return query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (sizeIndex >= 0 && cursor.moveToFirst() && !cursor.isNull(sizeIndex)) {
            cursor.getLong(sizeIndex).takeIf { it > 0 }
        } else {
            null
        }
    }
}
