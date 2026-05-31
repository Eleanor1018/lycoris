package online.lycoris.android.feature.documents

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class DocumentRepositoryTest {
    @Test
    fun exposesDefaultDocumentOrder() {
        val repository = DocumentRepository()

        assertEquals(listOf("about", "nora-hrt-guide"), repository.documents.map { it.slug })
    }

    @Test
    fun extractsTitleFromFirstMarkdownHeading() {
        val title = MarkdownDocumentParser.title(
            slug = "about",
            markdown = """
                preface
                # About Lycoris

                Body
            """.trimIndent(),
            fallbackTitle = "Fallback",
        )

        assertEquals("About Lycoris", title)
    }

    @Test
    fun createsSnippetAroundQueryFromCleanMarkdownText() {
        val snippet = MarkdownDocumentParser.snippet(
            markdown = "# Title\n\nBody with [important keyword](https://example.com) and trailing words.",
            query = "keyword",
        )

        assertTrue(snippet.contains("important keyword"))
        assertTrue(snippet.contains("trailing words"))
    }

    @Test
    fun buildsTocFromSecondThroughFourthLevelHeadings() {
        val toc = MarkdownDocumentParser.toc(
            """
            # Title
            ## Basics
            ### Dose `Plan`
            #### Follow-up
            ##### Too deep
            """.trimIndent(),
        )

        assertEquals(
            listOf(
                TocItem(level = 2, text = "Basics"),
                TocItem(level = 3, text = "Dose Plan"),
                TocItem(level = 4, text = "Follow-up"),
            ),
            toc,
        )
    }

    @Test
    fun packagedAssetsIncludeFirstHrtGuideImageAliases() {
        val assetRoot = File("src/main/assets")
        val markdown = assetRoot.resolve("docs/nora-hrt-guide.md").readText()
        val imageRefs = Regex("""src="/([^"]+)"""")
            .findAll(markdown)
            .take(3)
            .map { it.groupValues[1] }
            .toList()

        assertEquals(
            listOf(
                "doc_images/figure-1-1-estradiol.svg",
                "doc_images/figure-1-2-testosterone.svg",
                "doc_images/figure-1-3-progesterone.svg",
            ),
            imageRefs,
        )
        imageRefs.forEach { ref ->
            assertTrue("Missing packaged asset $ref", assetRoot.resolve(ref).isFile)
        }
    }
}
