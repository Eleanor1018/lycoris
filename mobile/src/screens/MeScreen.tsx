import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, requestJson } from '../lib/http';
import {
  appendUploadImageToFormData,
  pickUploadImage,
  type LocalUploadImage,
} from '../lib/imageUpload';
import { colors } from '../theme/colors';
import { useAuth } from '../auth/AuthProvider';
import { PageBackground } from '../components/PageBackground';
import { radii, shadows, sizes, spacing, typography } from '../theme/tokens';
import aboutEnglishMarkdownRaw from '../docs/about.md';
import aboutChineseMarkdownRaw from '../docs/about.zh.md';
import { useLanguage } from '../i18n/LanguageProvider';

export type MePanel =
  | 'root'
  | 'about'
  | 'register'
  | 'password'
  | 'created'
  | 'favorites';

type MarkerApiRow = {
  id?: number;
  title?: string;
  category?: string;
  updatedAt?: string;
  createdAt?: string;
  lat?: number | string;
  lng?: number | string;
};

type MarkerRow = {
  id: number;
  title: string;
  category: string;
  updatedAt: string;
  lat?: number;
  lng?: number;
};

const rowsPerPage = 6;

const normalizeMarkerRows = (
  raw: unknown,
  tr: (zh: string, en: string) => string,
): MarkerRow[] => {
  if (!Array.isArray(raw)) return [];
  const rows: MarkerRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as MarkerApiRow;
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const title = row.title?.trim() || tr('未命名点位', 'Untitled Place');
    const categoryRaw = row.category || 'self_definition';
    const categoryLabelMap: Record<string, string> = {
      accessible_toilet: tr('无障碍卫生间', 'Accessible Restroom'),
      friendly_clinic: tr('友好医疗机构', 'Trans-Friendly Clinic'),
      baby_room: tr('母婴室', 'Nursing Room'),
      self_definition: tr('自定义', 'Custom'),
      safe_place: tr('自定义', 'Custom'),
      dangerous_place: tr('自定义', 'Custom'),
    };
    const category = categoryLabelMap[categoryRaw] ?? categoryRaw;
    const updatedAtRaw = (row.updatedAt ?? row.createdAt ?? '').toString();
    const updatedAt = updatedAtRaw ? updatedAtRaw.slice(0, 10) : '-';
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    rows.push({
      id,
      title,
      category,
      updatedAt,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    });
  }
  return rows;
};

function AboutEntryCard({ onPress }: { onPress: () => void }) {
  const { tr } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr('关于夏水仙', 'About Lycoris')}
      accessibilityHint={tr('打开项目介绍', 'Open the project introduction')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuEntryCard,
        pressed && styles.pressablePressed,
      ]}
    >
      <View style={[styles.menuEntryIconWrap, styles.menuEntryIconBlush]}>
        <Icon source="information-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.menuEntryTextWrap}>
        <Text style={styles.menuEntryTitle}>
          {tr('关于夏水仙', 'About Lycoris')}
        </Text>
      </View>
      <Icon source="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function MarkerListEntryCard({
  title,
  icon,
  tone,
  onPress,
}: {
  title: string;
  icon: string;
  tone: 'lilac' | 'blush';
  onPress: () => void;
}) {
  const { tr } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={tr('打开点位列表', 'Open the place list')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuEntryCard,
        pressed && styles.pressablePressed,
      ]}
    >
      <View
        style={[
          styles.menuEntryIconWrap,
          tone === 'blush'
            ? styles.menuEntryIconBlush
            : styles.menuEntryIconLilac,
        ]}
      >
        <Icon source={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.menuEntryTextWrap}>
        <Text style={styles.menuEntryTitle}>{title}</Text>
      </View>
      <Icon source="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { tr } = useLanguage();
  return (
    <View style={styles.hero}>
      <View style={styles.heroTopRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('返回', 'Back')}
          accessibilityHint={tr('返回我的页面', 'Return to the Me page')}
          hitSlop={4}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backRow,
            pressed && styles.pressablePressed,
          ]}
        >
          <Icon source="arrow-left" size={20} color={colors.primary} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

type MeScreenProps = {
  onOpenMarker?: (target: {
    markerId: number;
    lat?: number;
    lng?: number;
    title?: string;
  }) => void;
  panel?: MePanel;
  onNavigatePanel?: (panel: Exclude<MePanel, 'root'>) => void;
  onBack?: () => void;
};

export function MeScreen({
  onOpenMarker,
  panel: panelProp,
  onNavigatePanel,
  onBack,
}: MeScreenProps) {
  const { loading, user, isLoggedIn, login, register, logout, refresh } =
    useAuth();
  const { language, tr } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compactLayout = width < 360;
  const pageInsetsStyle = {
    paddingTop: Math.max(insets.top + spacing.sm, spacing.lg),
    paddingBottom: Math.max(insets.bottom, spacing.xs),
    paddingHorizontal: compactLayout ? spacing.sm : spacing.md,
  };
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registerForm, setRegisterForm] = useState({
    username: '',
    nickname: '',
    email: '',
    password: '',
    website: '',
  });
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirm: '',
  });
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarDraftFile, setAvatarDraftFile] =
    useState<LocalUploadImage | null>(null);
  const [avatarPicking, setAvatarPicking] = useState(false);
  const [avatarHint, setAvatarHint] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    nickname: '',
    pronouns: '',
    signature: '',
  });
  const [createdRows, setCreatedRows] = useState<MarkerRow[]>([]);
  const [favoriteRows, setFavoriteRows] = useState<MarkerRow[]>([]);
  const [createdPage, setCreatedPage] = useState(0);
  const [favoritePage, setFavoritePage] = useState(0);
  const [markerListLoading, setMarkerListLoading] = useState(false);
  const [markerListError, setMarkerListError] = useState('');
  const [panelState, setPanelState] = useState<MePanel>('root');
  const panel = panelProp ?? panelState;

  useEffect(() => {
    setError('');
    setRegisterError('');
    setPasswordError('');
    setPasswordSuccess('');
    setProfileError('');
    setAvatarHint('');
    setAvatarError('');
    setMarkerListError('');
  }, [language]);

  const goPanel = useCallback(
    (next: MePanel) => {
      if (next === panel) return;
      if (panelProp == null) {
        setPanelState(next);
        return;
      }
      if (next === 'root') {
        onBack?.();
        return;
      }
      onNavigatePanel?.(next);
    },
    [onBack, onNavigatePanel, panel, panelProp],
  );

  const nickname = useMemo(() => {
    if (!user) return '';
    return user.nickname?.trim() || user.username;
  }, [user]);

  const aboutMarkdown = useMemo(() => {
    const normalized = (
      language === 'zh' ? aboutChineseMarkdownRaw : aboutEnglishMarkdownRaw
    )
      .replace(/\r\n/g, '\n')
      .replace(/&ensp;/g, '');
    return normalized.replace(/^[\u3000 ]+/gmu, '');
  }, [language]);

  const createdSlice = useMemo(
    () =>
      createdRows.slice(
        createdPage * rowsPerPage,
        (createdPage + 1) * rowsPerPage,
      ),
    [createdPage, createdRows],
  );
  const favoriteSlice = useMemo(
    () =>
      favoriteRows.slice(
        favoritePage * rowsPerPage,
        (favoritePage + 1) * rowsPerPage,
      ),
    [favoritePage, favoriteRows],
  );

  const loadMarkerLists = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      setMarkerListLoading(true);
      setMarkerListError('');
      const [createdRes, favoriteRes] = await Promise.all([
        requestJson<unknown>('/api/markers/me/created'),
        requestJson<unknown>('/api/markers/me/favorites/details'),
      ]);
      setCreatedRows(normalizeMarkerRows(createdRes, tr));
      setFavoriteRows(normalizeMarkerRows(favoriteRes, tr));
      setCreatedPage(0);
      setFavoritePage(0);
    } catch (e) {
      setCreatedRows([]);
      setFavoriteRows([]);
      setCreatedPage(0);
      setFavoritePage(0);
      if (e instanceof ApiError) {
        setMarkerListError(e.message);
      } else if (e instanceof Error) {
        setMarkerListError(e.message);
      } else {
        setMarkerListError(
          tr(
            '无法加载点位，请重试。',
            'Could not load your places. Please try again.',
          ),
        );
      }
    } finally {
      setMarkerListLoading(false);
    }
  }, [isLoggedIn, tr]);

  useEffect(() => {
    if (!isLoggedIn) {
      setCreatedRows([]);
      setFavoriteRows([]);
      setCreatedPage(0);
      setFavoritePage(0);
      setMarkerListError('');
      if (panel === 'created' || panel === 'favorites') {
        goPanel('root');
      }
    }
  }, [goPanel, isLoggedIn, panel]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (panel === 'created' || panel === 'favorites') {
      loadMarkerLists().catch(() => {});
    }
  }, [isLoggedIn, loadMarkerLists, panel]);

  const doLogin = async () => {
    const uname = username.trim();
    if (!uname || !password) {
      setError(tr('请输入用户名和密码。', 'Enter your username and password.'));
      return;
    }
    try {
      setBusy(true);
      setError('');
      await login(uname, password);
      setPassword('');
      Keyboard.dismiss();
      goPanel('root');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(
          tr('登录失败，请稍后重试。', 'Could not log in. Please try again.'),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    const payload = {
      username: registerForm.username.trim(),
      nickname: registerForm.nickname.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password,
      website: registerForm.website,
    };

    if (
      !payload.username ||
      !payload.nickname ||
      !payload.email ||
      !payload.password
    ) {
      setRegisterError(
        tr(
          '请填写所有必填注册信息。',
          'Complete all required registration fields.',
        ),
      );
      return;
    }
    if (payload.password !== password2) {
      setRegisterError(
        tr('两次输入的密码不一致。', 'The passwords do not match.'),
      );
      return;
    }

    try {
      setBusy(true);
      setRegisterError('');
      await register(payload);
      setRegisterForm({
        username: '',
        nickname: '',
        email: '',
        password: '',
        website: '',
      });
      setPassword2('');
      Keyboard.dismiss();
      goPanel('root');
    } catch (e) {
      if (e instanceof ApiError) {
        setRegisterError(e.message);
      } else if (e instanceof Error) {
        setRegisterError(e.message);
      } else {
        setRegisterError(
          tr(
            '注册失败，请稍后重试。',
            'Could not create your account. Please try again.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      setBusy(true);
      await logout();
    } finally {
      setBusy(false);
    }
  };

  const openProfileEdit = () => {
    if (!user) return;
    setProfileDraft({
      nickname: user.nickname?.trim() || user.username,
      pronouns: user.pronouns || '',
      signature: user.signature || '',
    });
    setProfileError('');
    setAvatarDraftFile(null);
    setAvatarHint('');
    setAvatarError('');
    setAvatarPicking(false);
    setProfileEditOpen(true);
  };

  const pickAvatarImage = async () => {
    if (profileSaving || avatarPicking) return;
    setAvatarPicking(true);
    setAvatarError('');
    const result = await pickUploadImage({ mode: 'avatar' });
    setAvatarPicking(false);

    if (result.cancelled) return;
    if (!result.file) {
      setAvatarHint('');
      setAvatarDraftFile(null);
      setAvatarError(result.error);
      return;
    }

    setAvatarDraftFile(result.file);
    setAvatarHint(result.hint);
    setAvatarError('');
  };

  const saveProfileEdit = async () => {
    try {
      setProfileSaving(true);
      setProfileError('');
      await requestJson('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          nickname: profileDraft.nickname.trim(),
          pronouns: profileDraft.pronouns.trim(),
          signature: profileDraft.signature.trim(),
        }),
      });

      if (avatarDraftFile) {
        const form = new FormData();
        appendUploadImageToFormData(form, 'file', avatarDraftFile);
        await requestJson('/api/me/avatar', {
          method: 'POST',
          body: form,
          timeoutMs: 20000,
        });
      }

      await refresh();
      setProfileEditOpen(false);
    } catch (e) {
      if (e instanceof ApiError) {
        setProfileError(e.message);
      } else if (e instanceof Error) {
        setProfileError(e.message);
      } else {
        setProfileError(
          tr(
            '保存资料失败，请稍后重试。',
            'Could not save your profile. Please try again.',
          ),
        );
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const doChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError(tr('请填写全部字段。', 'Complete all fields.'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError(
        tr('两次输入的新密码不一致。', 'The new passwords do not match.'),
      );
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccess('');
      await requestJson('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ oldPassword: '', newPassword: '', confirm: '' });
      setPasswordSuccess(tr('密码修改成功。', 'Password changed.'));
      setTimeout(() => {
        setPasswordSuccess('');
        goPanel('root');
      }, 700);
    } catch (e) {
      if (e instanceof ApiError) {
        setPasswordError(e.message);
      } else if (e instanceof Error) {
        setPasswordError(e.message);
      } else {
        setPasswordError(
          tr('修改密码失败。', 'Could not change your password.'),
        );
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  const openMarkerOnMap = (row: MarkerRow) => {
    if (!onOpenMarker) return;
    onOpenMarker({
      markerId: row.id,
      lat: row.lat,
      lng: row.lng,
      title: row.title,
    });
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingWrap,
          {
            paddingTop: Math.max(insets.top, spacing.md),
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <PageBackground />
        <View style={styles.loadingCard}>
          <ActivityIndicator
            accessibilityLabel={tr(
              '正在检查登录状态',
              'Checking sign-in status',
            )}
            color={colors.primary}
          />
          <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
            {tr('正在检查登录状态...', 'Checking sign-in status...')}
          </Text>
        </View>
      </View>
    );
  }

  if (panel === 'about') {
    return (
      <View style={[styles.page, pageInsetsStyle]}>
        <PageBackground />
        <PanelHeader
          title={tr('关于夏水仙', 'About Lycoris')}
          onBack={() => goPanel('root')}
        />

        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.aboutContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.readingCard}>
            <Markdown
              style={aboutMarkdownStyles}
              onLinkPress={url => {
                Linking.openURL(url).catch(() => {});
                return false;
              }}
            >
              {aboutMarkdown}
            </Markdown>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (panel === 'created' || panel === 'favorites') {
    const isCreatedPanel = panel === 'created';
    const title = isCreatedPanel
      ? tr('我创建的点位', 'Places I Created')
      : tr('我收藏的点位', 'Favorite Places');
    const rows = isCreatedPanel ? createdRows : favoriteRows;
    const page = isCreatedPanel ? createdPage : favoritePage;
    const setPage = isCreatedPanel ? setCreatedPage : setFavoritePage;
    const slice = isCreatedPanel ? createdSlice : favoriteSlice;
    const emptyText = isCreatedPanel
      ? tr('你还没有创建点位。', 'You have not created any places yet.')
      : tr('你还没有收藏点位。', 'You have no favorite places yet.');
    const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    const rangeStart = rows.length === 0 ? 0 : page * rowsPerPage + 1;
    const rangeEnd =
      rows.length === 0 ? 0 : Math.min((page + 1) * rowsPerPage, rows.length);

    return (
      <View style={[styles.page, pageInsetsStyle]}>
        <PageBackground />
        <PanelHeader title={title} onBack={() => goPanel('root')} />

        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.markerListSummaryRow}>
              <View>
                <Text style={styles.markerListSummaryTitle}>
                  {tr(
                    `${rows.length} 个点位`,
                    `${rows.length} ${rows.length === 1 ? 'place' : 'places'}`,
                  )}
                </Text>
              </View>
              <View style={styles.markerListCountPill}>
                <Text style={styles.markerListCountText}>
                  {rangeStart}–{rangeEnd}
                </Text>
              </View>
            </View>

            {markerListLoading ? (
              <View style={styles.markerListLoadingWrap}>
                <ActivityIndicator
                  accessibilityLabel={tr(
                    '正在加载点位列表',
                    'Loading place list',
                  )}
                  color={colors.primary}
                />
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.menuEntrySubtitle}
                >
                  {tr('加载中...', 'Loading...')}
                </Text>
              </View>
            ) : slice.length === 0 ? (
              <View style={styles.markerListEmptyWrap}>
                <Text style={styles.markerListEmptyText}>{emptyText}</Text>
              </View>
            ) : (
              slice.map(row => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    `${row.title}，${row.category}，更新于 ${row.updatedAt}`,
                    `${row.title}, ${row.category}, updated ${row.updatedAt}`,
                  )}
                  accessibilityHint={tr(
                    '在地图上打开这个点位',
                    'Open this place on the map',
                  )}
                  key={`${panel}-${row.id}`}
                  onPress={() => openMarkerOnMap(row)}
                  style={({ pressed }) => [
                    styles.markerListRow,
                    pressed && styles.markerListRowPressed,
                  ]}
                >
                  <View style={styles.markerListRowContent}>
                    <Text style={styles.markerListCellText} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <View style={styles.markerMetaRow}>
                      <View style={styles.markerCategoryPill}>
                        <Text
                          style={styles.markerCategoryText}
                          numberOfLines={1}
                        >
                          {row.category}
                        </Text>
                      </View>
                      <Text style={styles.markerDateText}>{row.updatedAt}</Text>
                    </View>
                  </View>
                  <Icon
                    source="chevron-right"
                    size={21}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ))
            )}

            <View style={styles.markerPagerRow}>
              <Text style={styles.markerPagerText}>
                {tr(
                  `第 ${Math.min(page + 1, pageCount)} 页，共 ${pageCount} 页`,
                  `Page ${Math.min(page + 1, pageCount)} of ${pageCount}`,
                )}
              </Text>
              <View style={styles.markerPagerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('上一页', 'Previous page')}
                  accessibilityState={{ disabled: page <= 0 }}
                  style={({ pressed }) => [
                    styles.markerPagerBtn,
                    page <= 0 && styles.markerPagerBtnDisabled,
                    pressed && page > 0 && styles.pressablePressed,
                  ]}
                  disabled={page <= 0}
                  onPress={() => setPage(prev => Math.max(0, prev - 1))}
                >
                  <Icon
                    source="chevron-left"
                    size={22}
                    color={colors.primary}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('下一页', 'Next page')}
                  accessibilityState={{ disabled: page >= pageCount - 1 }}
                  style={({ pressed }) => [
                    styles.markerPagerBtn,
                    page >= pageCount - 1 && styles.markerPagerBtnDisabled,
                    pressed && page < pageCount - 1 && styles.pressablePressed,
                  ]}
                  disabled={page >= pageCount - 1}
                  onPress={() =>
                    setPage(prev =>
                      Math.min(Math.max(0, pageCount - 1), prev + 1),
                    )
                  }
                >
                  <Icon
                    source="chevron-right"
                    size={22}
                    color={colors.primary}
                  />
                </Pressable>
              </View>
            </View>

            {markerListError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {markerListError}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('刷新点位列表', 'Refresh place list')}
              accessibilityState={{
                disabled: markerListLoading,
                busy: markerListLoading,
              }}
              style={({ pressed }) => [
                styles.markerReloadBtn,
                markerListLoading && styles.disabledControl,
                pressed && !markerListLoading && styles.pressablePressed,
              ]}
              disabled={markerListLoading}
              onPress={() => {
                loadMarkerLists().catch(() => {});
              }}
            >
              <Icon source="refresh" size={18} color={colors.primary} />
              <Text style={styles.markerReloadBtnText}>
                {markerListLoading
                  ? tr('刷新中...', 'Refreshing...')
                  : tr('刷新列表', 'Refresh List')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (panel === 'register') {
    return (
      <KeyboardAvoidingView
        style={[styles.page, pageInsetsStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <PageBackground />
        <PanelHeader
          title={tr('注册', 'Create Account')}
          onBack={() => goPanel('root')}
        />

        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.formScrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.label}>{tr('用户名', 'Username')}</Text>
            <TextInput
              accessibilityLabel={tr('用户名', 'Username')}
              autoCapitalize="none"
              autoCorrect={false}
              value={registerForm.username}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, username: value }))
              }
              style={styles.input}
              placeholder={tr('请输入用户名', 'Enter a username')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{tr('昵称', 'Display Name')}</Text>
            <TextInput
              accessibilityLabel={tr('昵称', 'Display name')}
              value={registerForm.nickname}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, nickname: value }))
              }
              style={styles.input}
              placeholder={tr('请输入昵称', 'Enter a display name')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{tr('邮箱', 'Email')}</Text>
            <TextInput
              accessibilityLabel={tr('邮箱', 'Email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={registerForm.email}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, email: value }))
              }
              style={styles.input}
              placeholder={tr('请输入邮箱', 'Enter your email')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{tr('密码', 'Password')}</Text>
            <TextInput
              accessibilityLabel={tr('密码', 'Password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={registerForm.password}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, password: value }))
              }
              style={styles.input}
              placeholder={tr('请输入密码', 'Enter a password')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>
              {tr('再次输入密码', 'Confirm Password')}
            </Text>
            <TextInput
              accessibilityLabel={tr('再次输入密码', 'Confirm password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={password2}
              onChangeText={setPassword2}
              style={styles.input}
              placeholder={tr('请再次输入密码', 'Enter the password again')}
              placeholderTextColor={colors.textMuted}
            />

            {registerError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {registerError}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                busy
                  ? tr('正在注册', 'Creating account')
                  : tr('注册', 'Create account')
              }
              accessibilityState={{ disabled: busy, busy }}
              onPress={doRegister}
              style={({ pressed }) => [
                styles.loginBtn,
                busy && styles.disabledControl,
                pressed && !busy && styles.pressablePressed,
              ]}
              disabled={busy}
            >
              <Text style={styles.loginBtnText}>
                {busy
                  ? tr('注册中...', 'Creating Account...')
                  : tr('注册', 'Create Account')}
              </Text>
            </Pressable>

            <View style={styles.formLinkRow}>
              <Text style={styles.formLinkHint}>
                {tr('已经有账号？', 'Already have an account?')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('去登录', 'Go to login')}
                hitSlop={8}
                style={styles.formLinkPressable}
                onPress={() => {
                  setError('');
                  goPanel('root');
                }}
              >
                <Text style={styles.formLinkText}>
                  {tr('去登录', 'Log In')}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (panel === 'password') {
    return (
      <KeyboardAvoidingView
        style={[styles.page, pageInsetsStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <PageBackground />
        <PanelHeader
          title={tr('修改密码', 'Change Password')}
          onBack={() => goPanel('root')}
        />
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.formScrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.label}>{tr('原密码', 'Current Password')}</Text>
            <TextInput
              accessibilityLabel={tr('原密码', 'Current password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.oldPassword}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, oldPassword: value }))
              }
              style={styles.input}
              placeholder={tr('请输入原密码', 'Enter your current password')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{tr('新密码', 'New Password')}</Text>
            <TextInput
              accessibilityLabel={tr('新密码', 'New password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, newPassword: value }))
              }
              style={styles.input}
              placeholder={tr('请输入新密码', 'Enter a new password')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>
              {tr('确认新密码', 'Confirm New Password')}
            </Text>
            <TextInput
              accessibilityLabel={tr('确认新密码', 'Confirm new password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.confirm}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, confirm: value }))
              }
              style={styles.input}
              placeholder={tr(
                '请再次输入新密码',
                'Enter the new password again',
              )}
              placeholderTextColor={colors.textMuted}
            />

            {passwordError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {passwordError}
              </Text>
            ) : null}
            {passwordSuccess ? (
              <Text accessibilityLiveRegion="polite" style={styles.successText}>
                {passwordSuccess}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                passwordBusy
                  ? tr('正在保存密码', 'Saving password')
                  : tr('保存新密码', 'Save new password')
              }
              accessibilityState={{
                disabled: passwordBusy,
                busy: passwordBusy,
              }}
              onPress={doChangePassword}
              style={({ pressed }) => [
                styles.loginBtn,
                passwordBusy && styles.disabledControl,
                pressed && !passwordBusy && styles.pressablePressed,
              ]}
              disabled={passwordBusy}
            >
              <Text style={styles.loginBtnText}>
                {passwordBusy
                  ? tr('保存中...', 'Saving...')
                  : tr('保存新密码', 'Save New Password')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, pageInsetsStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <PageBackground />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.rootScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {isLoggedIn && user ? (
          <>
            <View
              style={[styles.profileMainCard, styles.rootPrimaryCardSpacing]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('编辑个人资料', 'Edit profile')}
                accessibilityHint={tr(
                  '修改昵称、代词、签名和头像',
                  'Change your display name, pronouns, bio, and profile picture',
                )}
                style={({ pressed }) => [
                  styles.profileEditFab,
                  pressed && styles.pressablePressed,
                ]}
                onPress={openProfileEdit}
              >
                <Icon
                  source="pencil-outline"
                  size={20}
                  color={colors.primary}
                />
              </Pressable>

              {user.avatarUrl ? (
                <Image
                  accessibilityLabel={tr(
                    `${nickname} 的头像`,
                    `${nickname}'s profile picture`,
                  )}
                  source={{ uri: user.avatarUrl }}
                  style={styles.profileAvatarLarge}
                />
              ) : (
                <View
                  accessibilityLabel={tr(
                    '默认个人头像',
                    'Default profile picture',
                  )}
                  style={styles.profileAvatarFallbackLarge}
                >
                  <Icon
                    source="account-outline"
                    size={44}
                    color={colors.primary}
                  />
                </View>
              )}

              <Text style={styles.profileName}>{nickname}</Text>
              <Text style={styles.profileMeta}>
                @{user.username}
                {user.pronouns ? ` · ${user.pronouns}` : ''}
              </Text>
              <View style={styles.profileSignatureBubble}>
                <Text style={styles.profileSignature}>
                  {user.signature || 'Attendre et espérer.'}
                </Text>
              </View>

              <View
                style={[
                  styles.profileActionRow,
                  compactLayout && styles.profileActionRowCompact,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('修改密码', 'Change password')}
                  style={({ pressed }) => [
                    styles.profileOutlineBtn,
                    pressed && styles.pressablePressed,
                  ]}
                  onPress={() => {
                    setPasswordError('');
                    setPasswordSuccess('');
                    goPanel('password');
                  }}
                >
                  <Icon
                    source="lock-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.profileOutlineBtnText}>
                    {tr('修改密码', 'Change Password')}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    busy
                      ? tr('正在退出登录', 'Logging out')
                      : tr('退出登录', 'Log out')
                  }
                  accessibilityState={{ disabled: busy, busy }}
                  style={({ pressed }) => [
                    styles.profileLogoutBtn,
                    busy && styles.disabledControl,
                    pressed && !busy && styles.pressablePressed,
                  ]}
                  onPress={doLogout}
                  disabled={busy}
                >
                  <Icon source="logout" size={18} color={colors.primary} />
                  <Text style={styles.profileLogoutBtnText}>
                    {busy
                      ? tr('处理中...', 'Working...')
                      : tr('退出登录', 'Log Out')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <MarkerListEntryCard
              title={tr('我创建的点位', 'Places I Created')}
              icon="map-marker-plus-outline"
              tone="lilac"
              onPress={() => goPanel('created')}
            />
            <MarkerListEntryCard
              title={tr('我收藏的点位', 'Favorite Places')}
              icon="star-outline"
              tone="blush"
              onPress={() => goPanel('favorites')}
            />
          </>
        ) : (
          <View
            style={[
              styles.card,
              styles.authCard,
              styles.rootPrimaryCardSpacing,
            ]}
          >
            <Text accessibilityRole="header" style={styles.formTitle}>
              {tr('登录', 'Log In')}
            </Text>
            <Text style={styles.label}>{tr('用户名', 'Username')}</Text>
            <TextInput
              accessibilityLabel={tr('用户名', 'Username')}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder={tr('请输入用户名', 'Enter your username')}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>{tr('密码', 'Password')}</Text>
            <TextInput
              accessibilityLabel={tr('密码', 'Password')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder={tr('请输入密码', 'Enter your password')}
              placeholderTextColor={colors.textMuted}
            />

            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                busy ? tr('正在登录', 'Logging in') : tr('登录', 'Log in')
              }
              accessibilityState={{ disabled: busy, busy }}
              onPress={doLogin}
              style={({ pressed }) => [
                styles.loginBtn,
                busy && styles.disabledControl,
                pressed && !busy && styles.pressablePressed,
              ]}
              disabled={busy}
            >
              <Text style={styles.loginBtnText}>
                {busy ? tr('登录中...', 'Logging In...') : tr('登录', 'Log In')}
              </Text>
            </Pressable>

            <View style={styles.formLinkRow}>
              <Text style={styles.formLinkHint}>
                {tr('没有账号？', 'New to Lycoris?')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('去注册', 'Create an account')}
                hitSlop={8}
                style={styles.formLinkPressable}
                onPress={() => {
                  setRegisterError('');
                  goPanel('register');
                }}
              >
                <Text style={styles.formLinkText}>
                  {tr('去注册', 'Create Account')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <AboutEntryCard onPress={() => goPanel('about')} />
      </ScrollView>

      <Modal
        visible={profileEditOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!profileSaving) setProfileEditOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalCenterWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <Pressable
            accessible={false}
            style={styles.modalOverlay}
            onPress={() => {
              if (!profileSaving) setProfileEditOpen(false);
            }}
          />
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View accessibilityViewIsModal style={styles.editCard}>
              <View style={styles.editTitleRow}>
                <View style={styles.editTitleTextWrap}>
                  <Text accessibilityRole="header" style={styles.editTitle}>
                    {tr('编辑资料', 'Edit Profile')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    '关闭编辑资料',
                    'Close profile editor',
                  )}
                  accessibilityState={{ disabled: profileSaving }}
                  disabled={profileSaving}
                  onPress={() => setProfileEditOpen(false)}
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    profileSaving && styles.disabledControl,
                    pressed && !profileSaving && styles.pressablePressed,
                  ]}
                >
                  <Icon source="close" size={20} color={colors.primary} />
                </Pressable>
              </View>

              <Text style={styles.label}>{tr('昵称', 'Display Name')}</Text>
              <TextInput
                accessibilityLabel={tr('昵称', 'Display name')}
                value={profileDraft.nickname}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, nickname: value }))
                }
                style={styles.input}
                placeholder={tr('请输入昵称', 'Enter a display name')}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>{tr('代词', 'Pronouns')}</Text>
              <TextInput
                accessibilityLabel={tr('代词', 'Pronouns')}
                value={profileDraft.pronouns}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, pronouns: value }))
                }
                style={styles.input}
                placeholder={tr('例如 she/her', 'For example, she/her')}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>{tr('签名', 'Bio')}</Text>
              <TextInput
                accessibilityLabel={tr('签名', 'Bio')}
                value={profileDraft.signature}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, signature: value }))
                }
                style={[styles.input, styles.editSignatureInput]}
                placeholder={tr(
                  '写点你想说的话',
                  'Tell us a little about yourself',
                )}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>
                {tr('头像（可选）', 'Profile Picture (Optional)')}
              </Text>
              <View style={styles.uploadRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    avatarPicking
                      ? tr('正在处理图片', 'Processing image')
                      : tr('选择头像图片', 'Choose profile picture')
                  }
                  accessibilityState={{
                    disabled: profileSaving || avatarPicking,
                    busy: avatarPicking,
                  }}
                  style={({ pressed }) => [
                    styles.uploadPickBtn,
                    (profileSaving || avatarPicking) && styles.disabledControl,
                    pressed &&
                      !profileSaving &&
                      !avatarPicking &&
                      styles.pressablePressed,
                  ]}
                  onPress={pickAvatarImage}
                  disabled={profileSaving || avatarPicking}
                >
                  <Icon source="image-plus" size={18} color={colors.primary} />
                  <Text style={styles.uploadPickBtnText}>
                    {avatarPicking
                      ? tr('处理中...', 'Processing...')
                      : tr('选择图片', 'Choose Image')}
                  </Text>
                </Pressable>
                {avatarDraftFile ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr(
                      '清除已选择的头像图片',
                      'Clear selected profile picture',
                    )}
                    accessibilityState={{
                      disabled: profileSaving || avatarPicking,
                    }}
                    style={({ pressed }) => [
                      styles.uploadClearBtn,
                      (profileSaving || avatarPicking) &&
                        styles.disabledControl,
                      pressed &&
                        !profileSaving &&
                        !avatarPicking &&
                        styles.pressablePressed,
                    ]}
                    onPress={() => {
                      setAvatarDraftFile(null);
                      setAvatarHint('');
                      setAvatarError('');
                    }}
                    disabled={profileSaving || avatarPicking}
                  >
                    <Text style={styles.uploadClearBtnText}>
                      {tr('清除', 'Clear')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {avatarHint ? (
                <Text style={styles.uploadHintText}>{avatarHint}</Text>
              ) : null}
              {avatarError ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {avatarError}
                </Text>
              ) : null}
              {avatarDraftFile ? (
                <Text style={styles.uploadPickedText}>
                  {tr('已选择：', 'Selected: ')}
                  {avatarDraftFile.name}
                </Text>
              ) : null}

              {profileError ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {profileError}
                </Text>
              ) : null}

              <View
                style={[
                  styles.editActionRow,
                  compactLayout && styles.editActionRowCompact,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    '取消编辑资料',
                    'Cancel profile editing',
                  )}
                  accessibilityState={{ disabled: profileSaving }}
                  style={({ pressed }) => [
                    styles.editCancelBtn,
                    profileSaving && styles.disabledControl,
                    pressed && !profileSaving && styles.pressablePressed,
                  ]}
                  disabled={profileSaving}
                  onPress={() => setProfileEditOpen(false)}
                >
                  <Text style={styles.editCancelBtnText}>
                    {tr('取消', 'Cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    profileSaving
                      ? tr('正在保存个人资料', 'Saving profile')
                      : tr('保存个人资料', 'Save profile')
                  }
                  accessibilityState={{
                    disabled: profileSaving || avatarPicking,
                    busy: profileSaving,
                  }}
                  style={({ pressed }) => [
                    styles.editSaveBtn,
                    (profileSaving || avatarPicking) && styles.disabledControl,
                    pressed &&
                      !profileSaving &&
                      !avatarPicking &&
                      styles.pressablePressed,
                  ]}
                  disabled={profileSaving || avatarPicking}
                  onPress={saveProfileEdit}
                >
                  <Text style={styles.editSaveBtnText}>
                    {profileSaving
                      ? tr('保存中...', 'Saving...')
                      : tr('保存', 'Save')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const aboutMarkdownStyles = StyleSheet.create({
  body: {
    color: colors.textPrimary,
    ...typography.body,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  heading1: {
    ...typography.display,
    color: colors.primary,
    marginTop: spacing.xxs,
    marginBottom: spacing.lg,
  },
  heading2: {
    ...typography.title,
    color: colors.primary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading3: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
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
    textDecorationColor: colors.pin,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 6,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.pin,
    borderRadius: radii.input,
    backgroundColor: colors.blushSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  code_inline: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 2,
  },
  code_block: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.input,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  fence: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.input,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingCard: {
    minWidth: 216,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.floating,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.floating,
  },
  loadingText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  scroll: {
    flex: 1,
  },
  formScrollContent: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: spacing.lg,
  },
  rootScrollContent: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: spacing.lg,
  },
  listContent: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: spacing.lg,
  },
  hero: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    marginBottom: spacing.md,
    borderRadius: 28,
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTopRow: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    ...typography.display,
    color: colors.primary,
  },
  backRow: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.lilac,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuEntryCard: {
    minHeight: 72,
    borderRadius: radii.floating,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
    marginBottom: spacing.sm,
  },
  menuEntryIconWrap: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: sizes.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuEntryIconLilac: {
    backgroundColor: colors.lilac,
  },
  menuEntryIconBlush: {
    backgroundColor: colors.blush,
  },
  menuEntryTextWrap: {
    flex: 1,
  },
  menuEntryTitle: {
    color: colors.textPrimary,
    ...typography.subtitle,
  },
  menuEntrySubtitle: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  rootPrimaryCardSpacing: {
    marginBottom: spacing.lg,
  },
  markerListLoadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  markerListRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  markerListRowPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.99 }],
  },
  markerListRowContent: {
    flex: 1,
  },
  markerListCellText: {
    color: colors.textPrimary,
    ...typography.subtitle,
  },
  markerMetaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  markerCategoryPill: {
    minHeight: 26,
    maxWidth: '70%',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.lilac,
    paddingHorizontal: spacing.sm,
  },
  markerCategoryText: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  markerDateText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  markerListEmptyWrap: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  markerListEmptyText: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
  },
  markerPagerRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markerPagerText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  markerPagerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  markerPagerBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: sizes.touchTarget / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lilac,
  },
  markerPagerBtnDisabled: {
    opacity: 0.42,
  },
  markerReloadBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blush,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  markerReloadBtnText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: '700',
  },
  markerListSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  markerListSummaryTitle: {
    marginTop: spacing.xxs,
    color: colors.primary,
    ...typography.title,
  },
  markerListCountPill: {
    minHeight: 36,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.blush,
    paddingHorizontal: spacing.sm,
  },
  markerListCountText: {
    color: colors.primary,
    ...typography.label,
  },
  profileMainCard: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.floating,
  },
  profileEditFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileAvatarLarge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: colors.blush,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  profileAvatarFallbackLarge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: colors.blush,
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    marginTop: spacing.lg,
    color: colors.primary,
    ...typography.display,
    textAlign: 'center',
  },
  profileMeta: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.bodySmall,
    textAlign: 'center',
  },
  profileSignatureBubble: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blushSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileSignature: {
    flex: 1,
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  profileActionRow: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  profileActionRowCompact: {
    flexDirection: 'column',
  },
  profileOutlineBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lilac,
  },
  profileOutlineBtnText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: '700',
  },
  profileLogoutBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.blush,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileLogoutBtnText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: '700',
  },
  label: {
    marginTop: spacing.sm,
    color: colors.primary,
    ...typography.label,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    ...typography.body,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.xs,
    ...typography.bodySmall,
  },
  successText: {
    color: colors.success,
    marginTop: spacing.xs,
    ...typography.bodySmall,
  },
  loginBtn: {
    marginTop: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.lilac,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginBtnText: {
    color: colors.primary,
    ...typography.body,
    fontWeight: '800',
  },
  formLinkRow: {
    minHeight: sizes.touchTarget,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  formLinkHint: {
    color: colors.textSecondary,
    ...typography.bodySmall,
  },
  formLinkPressable: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  formLinkText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: colors.pin,
  },
  modalCenterWrap: {
    flex: 1,
    position: 'relative',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  editCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    padding: spacing.lg,
    ...shadows.dialog,
  },
  editTitleRow: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editTitleTextWrap: {
    flex: 1,
  },
  editTitle: {
    color: colors.primary,
    ...typography.title,
  },
  modalCloseBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: sizes.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blush,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editSignatureInput: {
    minHeight: 96,
    maxHeight: 144,
    borderRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  uploadRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadPickBtn: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lilac,
  },
  uploadPickBtnText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: '700',
  },
  uploadClearBtn: {
    minHeight: sizes.touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  uploadClearBtnText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
    fontWeight: '600',
  },
  uploadHintText: {
    color: colors.success,
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  uploadPickedText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
    marginTop: spacing.xxs,
  },
  editActionRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  editActionRowCompact: {
    flexDirection: 'column-reverse',
  },
  editCancelBtn: {
    minWidth: 112,
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  editCancelBtnText: {
    color: colors.primary,
    fontWeight: '700',
  },
  editSaveBtn: {
    minWidth: 112,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editSaveBtnText: {
    color: colors.primary,
    fontWeight: '700',
  },
  formTitle: {
    marginBottom: spacing.xs,
    color: colors.primary,
    ...typography.title,
  },
  authCard: {
    position: 'relative',
    paddingTop: spacing.xl,
  },
  readingCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  pressablePressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabledControl: {
    opacity: 0.46,
  },
  aboutContent: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: spacing.lg,
  },
});
