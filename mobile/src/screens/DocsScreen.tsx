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
  subtitle?: string;
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
    title: '雪雁的 HRT 指南',
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

      const alt = attrs.match(/\balt\s*=\s*['"]([^'"]*)['"]/i)?.[1]?.trim() ?? '';
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

  return `${content}${node.children.map(child => extractNodeText(child)).join('')}`;
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
            }}>
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
              <View style={[styles.svgCard, {width: imageWidth, height: imageHeight}]}>
                <SvgXml xml={svgXml} width="100%" height="100%" />
              </View>
              {altText ? <Text style={styles.imageCaption}>{altText}</Text> : null}
            </View>
          );
        }

        const localAsset = docImageAssets[assetName];
        const source = localAsset ? localAsset : {uri: toAbsoluteUrl(rawSrc)};
        return (
          <View key={node.key} style={styles.imageWrap}>
            <Image
              source={source}
              style={[styles.markdownImage, {width: imageWidth, height: imageHeight}]}
              resizeMode="contain"
            />
            {altText ? <Text style={styles.imageCaption}>{altText}</Text> : null}
          </View>
        );
      },
    };
  }, [imageWidth]);

  const mobileFabStyle = useMemo(() => [styles.menuFab, {bottom: insets.bottom + 16}], [insets.bottom]);

  const drawerContent = (
    <View style={styles.drawerInner}>
      <Text style={styles.drawerTitle}>目录</Text>

      <Text style={styles.drawerSectionTitle}>文档</Text>
      <View style={styles.drawerCard}>
        {DOCS.map(doc => (
          <Pressable
            key={doc.slug}
            onPress={() => onSelectDoc(doc.slug)}
            style={[
              styles.drawerItem,
              activeDoc.slug === doc.slug ? styles.drawerItemActive : null,
            ]}>
            <Text
              style={[
                styles.drawerItemTitle,
                activeDoc.slug === doc.slug ? styles.drawerItemTitleActive : null,
              ]}>
              {doc.title}
            </Text>
            {doc.subtitle ? (
              <Text style={styles.drawerItemSubtitle}>{doc.subtitle}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Text style={[styles.drawerSectionTitle, styles.tocHeading]}>当前文章</Text>
      <ScrollView
        style={styles.tocScroll}
        contentContainerStyle={styles.tocContent}
        showsVerticalScrollIndicator={false}>
        {tocItems.length === 0 ? (
          <Text style={styles.tocEmpty}>当前文档没有可用目录</Text>
        ) : (
          tocItems.map(item => (
            <Pressable
              key={item.id}
              onPress={() => onSelectToc(item.id)}
              style={[
                styles.tocItem,
                item.level === 2
                  ? styles.tocLevel2
                  : item.level === 3
                    ? styles.tocLevel3
                    : styles.tocLevel4,
              ]}>
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
      <View style={styles.layout}>
        {isWideLayout ? <View style={styles.desktopDrawer}>{drawerContent}</View> : null}

        <View style={styles.contentArea}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.markdownCard}>
              <Text style={styles.docManualTitle}>{displayTitle}</Text>
              <Markdown
                style={markdownStyles}
                rules={markdownRules}
                onLinkPress={url => {
                  openUrl(url).catch(() => {});
                  return false;
                }}>
                {markdown}
              </Markdown>
            </View>
          </ScrollView>
        </View>
      </View>

      {!isWideLayout ? (
        <IconButton
          icon="menu"
          size={22}
          mode="contained"
          containerColor="#7a4b8f"
          iconColor="#ffffff"
          onPress={() => setDrawerOpen(true)}
          style={mobileFabStyle}
        />
      ) : null}

      {!isWideLayout ? (
        <Modal
          transparent
          animationType="fade"
          visible={drawerOpen}
          onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.modalRoot}>
            <View style={styles.mobileDrawer}>{drawerContent}</View>
            <Pressable style={styles.modalBackdrop} onPress={() => setDrawerOpen(false)} />
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
    backgroundColor: 'rgba(122, 75, 143, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  fence: {
    backgroundColor: 'rgba(122, 75, 143, 0.08)',
    borderRadius: 10,
    padding: 12,
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
    paddingTop: 16,
  },
  desktopDrawer: {
    width: DRAWER_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  drawerInner: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  drawerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  drawerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 6,
  },
  drawerItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  drawerItemActive: {
    backgroundColor: colors.primarySoft,
  },
  drawerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  drawerItemTitleActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  drawerItemSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  tocHeading: {
    marginTop: 14,
  },
  tocScroll: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    borderRadius: 10,
    paddingVertical: 7,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  markdownCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  docManualTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: 14,
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
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  menuFab: {
    position: 'absolute',
    right: 16,
    zIndex: 1300,
    width: 46,
    height: 46,
    borderRadius: 23,
    margin: 0,
    shadowColor: 'rgba(122, 75, 143, 0.8)',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 8,
  },
});
