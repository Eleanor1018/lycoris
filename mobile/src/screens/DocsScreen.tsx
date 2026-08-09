import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Markdown, {ASTNode, RenderRules} from 'react-native-markdown-display';
import {IconButton} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SvgXml} from 'react-native-svg';
import noraHrtGuideMarkdownRaw from '../docs/nora-hrt-guide.md';
import {docImageAssets, docSvgXmlAssets} from '../docs/imageRegistry';
import {PageBackground} from '../components/PageBackground';
import {WEB_BASE_URL} from '../config/runtime';
import {colors} from '../theme/colors';

type DocSlug = 'nora-hrt-guide';

type DocEntry = {
  slug: DocSlug;
  title: string;
  markdown: string;
};

type TocItem = {
  id: string;
  level: 2 | 3 | 4;
  text: string;
};

const DOCS: DocEntry[] = [
  {
    slug: 'nora-hrt-guide',
    title: "Nora's HRT Guide (MTF)",
    markdown: noraHrtGuideMarkdownRaw,
  },
];

const DRAWER_WIDTH = 272;
const WIDE_LAYOUT_BREAKPOINT = 980;
const HEADING_REGEX = /^#{2,4}\s+(.+)$/gm;

const sanitizeHeadingText = (raw: string) =>
  raw
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

const slugifyHeading = (raw: string) => {
  const cleaned = sanitizeHeadingText(raw)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'section';
};

const buildToc = (markdown: string): TocItem[] => {
  const counts: Record<string, number> = {};
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = HEADING_REGEX.exec(markdown)) !== null) {
    const headingToken = match[0];
    const headingText = match[1];
    const level = (headingToken.match(/^#+/)?.[0].length ?? 0) as 2 | 3 | 4;
    if (level < 2 || level > 4) {
      continue;
    }

    const text = sanitizeHeadingText(headingText);
    if (!text) {
      continue;
    }

    const baseId = slugifyHeading(text);
    const next = (counts[baseId] ?? 0) + 1;
    counts[baseId] = next;
    const id = next === 1 ? baseId : `${baseId}-${next}`;
    items.push({id, level, text});
  }

  return items;
};

const normalizeMarkdown = (input: string) =>
  input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/<img\s+([^>]*?)\/?>/gi, (_full, attrs: string) => {
      const src = attrs.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.trim();
      if (!src) {
        return '';
      }

      const alt =
        attrs.match(/\balt\s*=\s*['"]([^'"]*)['"]/i)?.[1]?.trim() ?? '';
      return `\n![${alt}](${src})\n`;
    })
    .replace(/<div[^>]*>(.*?)<\/div>/gi, (_full, body: string) => {
      const text = body.replace(/<[^>]+>/g, '').trim();
      if (!text) {
        return '';
      }
      return `\n*${text}*\n`;
    });

const toAbsoluteUrl = (path: string) => {
  const normalized = path.trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `${WEB_BASE_URL}${normalized}`;
  }
  return `${WEB_BASE_URL}/${normalized.replace(/^\/+/, '')}`;
};

const getAssetName = (source: string) => {
  const clean = source.trim().replace(/\\/g, '/');
  const noQuery = clean.split('?')[0];
  return noQuery.split('/').pop() ?? '';
};

const extractNodeText = (node?: ASTNode): string => {
  if (!node) {
    return '';
  }

  const content = typeof node.content === 'string' ? node.content : '';
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return content;
  }

  return `${content}${node.children
    .map(child => extractNodeText(child))
    .join('')}`;
};

export function DocsScreen() {
  const {width: windowWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWideLayout = windowWidth >= WIDE_LAYOUT_BREAKPOINT;
  const imageWidth = Math.max(
    220,
    Math.min(640, windowWidth - (isWideLayout ? DRAWER_WIDTH + 92 : 42)),
  );

  const [activeSlug, setActiveSlug] = useState<DocSlug>('nora-hrt-guide');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeDoc = useMemo(
    () => DOCS.find(doc => doc.slug === activeSlug) ?? DOCS[0],
    [activeSlug],
  );
  const {displayTitle, markdown} = useMemo(() => {
    const normalized = normalizeMarkdown(activeDoc.markdown);
    const lines = normalized.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    const titleMatch = firstLine.match(/^#\s+(.+)$/);

    if (!titleMatch) {
      return {
        displayTitle: activeDoc.title,
        markdown: normalized,
      };
    }

    const nextLines = lines.slice(1);
    while (nextLines.length > 0 && nextLines[0].trim() === '') {
      nextLines.shift();
    }

    return {
      displayTitle: sanitizeHeadingText(titleMatch[1]) || activeDoc.title,
      markdown: nextLines.join('\n'),
    };
  }, [activeDoc.markdown, activeDoc.title]);
  const tocItems = useMemo(() => buildToc(markdown), [markdown]);

  const scrollRef = useRef<ScrollView>(null);
  const headingOffsetsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (isWideLayout) {
      setDrawerOpen(false);
    }
  }, [isWideLayout]);

  useEffect(() => {
    headingOffsetsRef.current = {};
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, [activeSlug]);

  const openUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(toAbsoluteUrl(url));
    } catch {
      // Keep failure silent in UI to avoid breaking reading flow.
    }
    return false;
  }, []);

  const onSelectDoc = useCallback(
    (slug: DocSlug) => {
      setActiveSlug(slug);
      if (!isWideLayout) {
        setDrawerOpen(false);
      }
    },
    [isWideLayout],
  );

  const onSelectToc = useCallback(
    (headingId: string) => {
      const targetY = headingOffsetsRef.current[headingId];
      if (typeof targetY === 'number') {
        scrollRef.current?.scrollTo({
          y: Math.max(0, targetY - 14),
          animated: true,
        });
      }
      if (!isWideLayout) {
        setDrawerOpen(false);
      }
    },
    [isWideLayout],
  );

  const markdownRules = useMemo<RenderRules>(() => {
    const slugCounts: Record<string, number> = {};

    const getHeadingId = (node: ASTNode) => {
      const base = slugifyHeading(extractNodeText(node));
      const next = (slugCounts[base] ?? 0) + 1;
      slugCounts[base] = next;
      return next === 1 ? base : `${base}-${next}`;
    };

    const renderHeading =
      (level: 1 | 2 | 3 | 4 | 5 | 6) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      (node: ASTNode, children: React.ReactNode[]) => {
        const headingId = getHeadingId(node);
        const headingStyle =
          level === 1
            ? styles.mdH1
            : level === 2
            ? styles.mdH2
            : level === 3
            ? styles.mdH3
            : level === 4
            ? styles.mdH4
            : styles.mdH5;

        return (
          <View
            key={node.key}
            onLayout={event => {
              headingOffsetsRef.current[headingId] = event.nativeEvent.layout.y;
            }}
          >
            <Text style={headingStyle}>{children}</Text>
          </View>
        );
      };

    return {
      heading1: renderHeading(1),
      heading2: renderHeading(2),
      heading3: renderHeading(3),
      heading4: renderHeading(4),
      heading5: renderHeading(5),
      heading6: renderHeading(6),
      // eslint-disable-next-line react/no-unstable-nested-components
      image: node => {
        const rawSrc = String(node.attributes?.src ?? '').trim();
        if (!rawSrc) {
          return null;
        }

        const altText = String(node.attributes?.alt ?? '').trim();
        const assetName = getAssetName(rawSrc);
        const imageHeight = Math.round(imageWidth * 0.66);
        const svgXml = docSvgXmlAssets[assetName];
        if (svgXml) {
          return (
            <View key={node.key} style={styles.imageWrap}>
              <View
                style={[
                  styles.svgCard,
                  {width: imageWidth, height: imageHeight},
                ]}
              >
                <SvgXml xml={svgXml} width="100%" height="100%" />
              </View>
              {altText ? (
                <Text style={styles.imageCaption}>{altText}</Text>
              ) : null}
            </View>
          );
        }

        const localAsset = docImageAssets[assetName];
        const source = localAsset ? localAsset : {uri: toAbsoluteUrl(rawSrc)};
        return (
          <View key={node.key} style={styles.imageWrap}>
            <Image
              source={source}
              style={[
                styles.markdownImage,
                {width: imageWidth, height: imageHeight},
              ]}
              resizeMode="contain"
            />
            {altText ? (
              <Text style={styles.imageCaption}>{altText}</Text>
            ) : null}
          </View>
        );
      },
    };
  }, [imageWidth]);

  const drawerContent = (
    <View style={styles.drawerInner}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Reading menu</Text>
      </View>

      <Text style={styles.drawerSectionTitle}>Guides</Text>
      <View style={styles.drawerCard}>
        {DOCS.map(doc => (
          <Pressable
            key={doc.slug}
            onPress={() => onSelectDoc(doc.slug)}
            accessibilityRole="button"
            accessibilityState={{selected: activeDoc.slug === doc.slug}}
            style={[
              styles.drawerItem,
              activeDoc.slug === doc.slug ? styles.drawerItemActive : null,
            ]}
          >
            <Text
              style={[
                styles.drawerItemTitle,
                activeDoc.slug === doc.slug
                  ? styles.drawerItemTitleActive
                  : null,
              ]}
            >
              {doc.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.drawerSectionTitle, styles.tocHeading]}>
        On this page
      </Text>
      <ScrollView
        style={styles.tocScroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.tocContent}
        showsVerticalScrollIndicator={false}
      >
        {tocItems.length === 0 ? (
          <Text style={styles.tocEmpty}>
            No sections are available for this guide.
          </Text>
        ) : (
          tocItems.map(item => (
            <Pressable
              key={item.id}
              onPress={() => onSelectToc(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${item.text}`}
              style={[
                styles.tocItem,
                item.level === 2
                  ? styles.tocLevel2
                  : item.level === 3
                  ? styles.tocLevel3
                  : styles.tocLevel4,
              ]}
            >
              <Text style={styles.tocText} numberOfLines={2}>
                {item.text}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.page}>
      <PageBackground />
      <View style={[styles.layout, {paddingTop: Math.max(14, insets.top + 6)}]}>
        {isWideLayout ? (
          <View style={styles.desktopDrawer}>{drawerContent}</View>
        ) : null}

        <View style={styles.contentArea}>
          <View style={styles.readerChrome}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.readerTitle}
            >
              {activeDoc.title}
            </Text>
            {!isWideLayout ? (
              <IconButton
                icon="format-list-bulleted"
                size={22}
                mode="contained"
                containerColor={colors.primarySoft}
                iconColor={colors.primary}
                accessibilityLabel="Open reading menu"
                onPress={() => setDrawerOpen(true)}
                style={styles.menuButton}
              />
            ) : null}
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.markdownCard,
                !isWideLayout ? styles.markdownCardMobile : null,
              ]}
            >
              <Text style={styles.docManualTitle}>{displayTitle}</Text>
              <View style={styles.titleRule} />
              <Markdown
                style={markdownStyles}
                rules={markdownRules}
                onLinkPress={url => {
                  openUrl(url).catch(() => {});
                  return false;
                }}
              >
                {markdown}
              </Markdown>
            </View>
          </ScrollView>
        </View>
      </View>

      {!isWideLayout ? (
        <Modal
          transparent
          animationType="fade"
          visible={drawerOpen}
          onRequestClose={() => setDrawerOpen(false)}
        >
          <View style={styles.modalRoot}>
            <View
              style={[
                styles.mobileDrawer,
                {
                  paddingTop: Math.max(0, insets.top - 8),
                  paddingBottom: Math.max(0, insets.bottom - 8),
                },
              ]}
            >
              {drawerContent}
            </View>
            <Pressable
              style={styles.modalBackdrop}
              accessibilityRole="button"
              accessibilityLabel="Close reading menu"
              onPress={() => setDrawerOpen(false)}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 14,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  strong: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  em: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  bullet_list: {
    marginBottom: 14,
  },
  ordered_list: {
    marginBottom: 14,
  },
  list_item: {
    marginBottom: 6,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
    paddingLeft: 12,
    marginBottom: 14,
  },
  code_inline: {
    backgroundColor: colors.primarySoft,
    color: colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  code_block: {
    backgroundColor: 'rgba(208, 188, 255, 0.22)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  fence: {
    backgroundColor: 'rgba(208, 188, 255, 0.22)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
    overflow: 'hidden',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 12,
  },
  desktopDrawer: {
    width: DRAWER_WIDTH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  drawerInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  drawerHeader: {
    marginBottom: 24,
  },
  drawerTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  drawerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  drawerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 6,
  },
  drawerItem: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  drawerItemActive: {
    backgroundColor: '#d0bcff',
  },
  drawerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  drawerItemTitleActive: {
    color: '#5a3850',
    fontWeight: '700',
  },
  tocHeading: {
    marginTop: 14,
  },
  tocScroll: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  tocContent: {
    padding: 6,
  },
  tocEmpty: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  tocItem: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 13,
    paddingVertical: 8,
    paddingRight: 8,
    marginBottom: 2,
  },
  tocLevel2: {
    paddingLeft: 10,
  },
  tocLevel3: {
    paddingLeft: 20,
  },
  tocLevel4: {
    paddingLeft: 30,
  },
  tocText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  contentArea: {
    flex: 1,
    minWidth: 0,
  },
  readerChrome: {
    minHeight: 62,
    marginBottom: 10,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 3,
  },
  readerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    margin: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 2,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  markdownCard: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 34,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 2,
  },
  markdownCardMobile: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 5,
    paddingTop: 18,
    paddingBottom: 28,
    shadowOpacity: 0,
    elevation: 0,
  },
  docManualTitle: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 0,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  titleRule: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d0bcff',
    marginBottom: 22,
  },
  mdH1: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: 14,
  },
  mdH2: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 10,
  },
  mdH3: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  mdH4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  mdH5: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 7,
  },
  imageWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  markdownImage: {
    maxWidth: '100%',
    borderRadius: 12,
  },
  svgCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    padding: 10,
  },
  imageCaption: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 34, 0.28)',
  },
  mobileDrawer: {
    width: DRAWER_WIDTH,
    maxWidth: '82%',
    marginTop: 8,
    marginBottom: 8,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    backgroundColor: '#faf5ff',
    overflow: 'hidden',
  },
});
