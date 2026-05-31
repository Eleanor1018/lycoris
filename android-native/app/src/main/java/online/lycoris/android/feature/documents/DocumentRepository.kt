package online.lycoris.android.feature.documents

import android.content.Context

data class DocumentEntry(
    val slug: String,
    val title: String,
    val assetPath: String,
)

data class TocItem(
    val level: Int,
    val text: String,
)

data class LoadedDocument(
    val entry: DocumentEntry,
    val markdown: String,
    val title: String,
    val toc: List<TocItem>,
)

data class DocumentSearchResult(
    val entry: DocumentEntry,
    val title: String,
    val snippet: String,
)

class DocumentRepository {
    val documents: List<DocumentEntry> = listOf(
        DocumentEntry("about", "关于 Lycoris", "docs/about.md"),
        DocumentEntry("nora-hrt-guide", "HRT 指南", "docs/nora-hrt-guide.md"),
    )

    fun find(slug: String): DocumentEntry {
        return documents.firstOrNull { it.slug == slug } ?: documents.first()
    }

    fun loadMarkdown(context: Context, document: DocumentEntry): String {
        return context.assets.open(document.assetPath).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    fun loadDocument(context: Context, slug: String): LoadedDocument {
        val entry = find(slug)
        val markdown = loadMarkdown(context, entry)
        return LoadedDocument(
            entry = entry,
            markdown = markdown,
            title = MarkdownDocumentParser.title(entry.slug, markdown, entry.title),
            toc = MarkdownDocumentParser.toc(markdown),
        )
    }

    fun search(context: Context, query: String): List<DocumentSearchResult> {
        val needle = query.trim()
        if (needle.isBlank()) return emptyList()

        return documents.mapNotNull { entry ->
            val markdown = loadMarkdown(context, entry)
            val cleanText = MarkdownDocumentParser.cleanText(markdown)
            val title = MarkdownDocumentParser.title(entry.slug, markdown, entry.title)
            val matches = cleanText.contains(needle, ignoreCase = true) ||
                title.contains(needle, ignoreCase = true)

            if (!matches) {
                null
            } else {
                DocumentSearchResult(
                    entry = entry,
                    title = title,
                    snippet = MarkdownDocumentParser.snippet(markdown, needle).ifBlank { "已命中文档内容" },
                )
            }
        }
    }
}

object MarkdownDocumentParser {
    private val titleRegex = Regex("""^\uFEFF?#\s+(.+)$""", RegexOption.MULTILINE)
    private val headingRegex = Regex("""^(#{2,4})\s+(.+)$""", RegexOption.MULTILINE)
    private val markdownLinkRegex = Regex("""\[(.*?)]\([^)]*\)""")
    private val htmlTagRegex = Regex("""<[^>]+>""")
    private val markdownMarksRegex = Regex("""[#>*_~`]""")
    private val whitespaceRegex = Regex("""\s+""")

    fun title(slug: String, markdown: String, fallbackTitle: String): String {
        return titleRegex.find(markdown)
            ?.groupValues
            ?.getOrNull(1)
            ?.let(::cleanText)
            ?.takeIf { it.isNotBlank() }
            ?: fallbackTitle.ifBlank { slug }
    }

    fun snippet(markdown: String, query: String, contextChars: Int = 34): String {
        val needle = query.trim()
        if (needle.isBlank()) return ""
        val clean = cleanText(markdown)
        val index = clean.indexOf(needle, ignoreCase = true)
        if (index < 0) return ""

        val start = (index - contextChars).coerceAtLeast(0)
        val end = (index + needle.length + contextChars).coerceAtMost(clean.length)
        return buildString {
            if (start > 0) append("...")
            append(clean.substring(start, end))
            if (end < clean.length) append("...")
        }
    }

    fun toc(markdown: String): List<TocItem> {
        return headingRegex.findAll(markdown).mapNotNull { match ->
            val level = match.groupValues[1].length
            val text = cleanText(match.groupValues[2])
            if (text.isBlank()) null else TocItem(level = level, text = text)
        }.toList()
    }

    fun cleanText(markdown: String): String {
        return markdown
            .replace("&ensp;", " ")
            .replace("&emsp;", " ")
            .replace("&nbsp;", " ")
            .replace(markdownLinkRegex) { it.groupValues[1] }
            .replace(htmlTagRegex, " ")
            .replace(markdownMarksRegex, "")
            .replace(whitespaceRegex, " ")
            .trim()
    }
}
