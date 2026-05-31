package online.lycoris.android.core.image

import java.io.ByteArrayInputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ImagePickerTest {
    @Test
    fun `bounded read accepts stream at exact max size`() {
        val bytes = ByteArray(ImageRules.MaxUploadBytes.toInt()) { index ->
            (index % 251).toByte()
        }

        val result = readBytesUpToLimit(
            input = ByteArrayInputStream(bytes),
            maxBytes = ImageRules.MaxUploadBytes,
        )

        assertTrue(result is BoundedReadResult.Success)
        assertArrayEquals(bytes, (result as BoundedReadResult.Success).bytes)
    }

    @Test
    fun `bounded read rejects stream over max size`() {
        val bytes = ByteArray(ImageRules.MaxUploadBytes.toInt() + 1)

        val result = readBytesUpToLimit(
            input = ByteArrayInputStream(bytes),
            maxBytes = ImageRules.MaxUploadBytes,
        )

        assertTrue(result is BoundedReadResult.TooLarge)
    }

    @Test
    fun `image rules reject non image mime types`() {
        val image = LocalImage(
            fileName = "notes.txt",
            mimeType = "text/plain",
            sizeBytes = 4,
            bytes = byteArrayOf(1, 2, 3, 4),
        )

        assertFalse(ImageRules.canUpload(image))
    }
}
