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
import aboutMarkdownRaw from '../docs/about.md';

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

const categoryLabelMap: Record<string, string> = {
  accessible_toilet: '无障碍卫生间',
  friendly_clinic: '友好医疗机构',
  baby_room: '母婴室',
  self_definition: '自定义',
  safe_place: '自定义',
  dangerous_place: '自定义',
};

const normalizeMarkerRows = (raw: unknown): MarkerRow[] => {
  if (!Array.isArray(raw)) return [];
  const rows: MarkerRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as MarkerApiRow;
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const title = row.title?.trim() || '未命名点位';
    const categoryRaw = row.category || 'self_definition';
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="关于夏水仙"
      accessibilityHint="打开项目介绍"
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
        <Text style={styles.menuEntryTitle}>关于夏水仙</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="打开点位列表"
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

function PanelHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTopRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          accessibilityHint="返回我的页面"
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
    const normalized = aboutMarkdownRaw
      .replace(/\r\n/g, '\n')
      .replace(/&ensp;/g, '');
    return normalized.replace(/^[\u3000 ]+/gmu, '');
  }, []);

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
      setCreatedRows(normalizeMarkerRows(createdRes));
      setFavoriteRows(normalizeMarkerRows(favoriteRes));
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
        setMarkerListError('加载点位列表失败，请稍后重试。');
      }
    } finally {
      setMarkerListLoading(false);
    }
  }, [isLoggedIn]);

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
      setError('请输入用户名和密码');
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
        setError('登录失败，请稍后再试');
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
      setRegisterError('请完整填写注册信息');
      return;
    }
    if (payload.password !== password2) {
      setRegisterError('两次密码输入不一致');
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
        setRegisterError('注册失败，请稍后再试');
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
        setProfileError('保存失败，请稍后再试');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const doChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError('请填写完整');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError('两次新密码不一致');
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
      setPasswordSuccess('修改成功');
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
        setPasswordError('修改失败');
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
            accessibilityLabel="正在读取登录状态"
            color={colors.primary}
          />
          <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
            正在读取登录状态...
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
          title="关于夏水仙"
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
    const title = isCreatedPanel ? '我创建的点位' : '我收藏的点位';
    const rows = isCreatedPanel ? createdRows : favoriteRows;
    const page = isCreatedPanel ? createdPage : favoritePage;
    const setPage = isCreatedPanel ? setCreatedPage : setFavoritePage;
    const slice = isCreatedPanel ? createdSlice : favoriteSlice;
    const emptyText = isCreatedPanel ? '暂无创建点位' : '暂无收藏点位';
    const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    const rangeStart = rows.length === 0 ? 0 : page * rowsPerPage + 1;
    const rangeEnd =
      rows.length === 0 ? 0 : Math.min((page + 1) * rowsPerPage, rows.length);

    return (
      <View style={[styles.page, pageInsetsStyle]}>
        <PageBackground />
        <PanelHeader
          title={title}
          onBack={() => goPanel('root')}
        />

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
                  共 {rows.length} 个点位
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
                  accessibilityLabel="正在加载点位列表"
                  color={colors.primary}
                />
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.menuEntrySubtitle}
                >
                  正在加载...
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
                  accessibilityLabel={`${row.title}，${row.category}，更新于 ${row.updatedAt}`}
                  accessibilityHint="在地图中打开这个点位"
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
                第 {Math.min(page + 1, pageCount)} / {pageCount} 页
              </Text>
              <View style={styles.markerPagerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="上一页"
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
                  accessibilityLabel="下一页"
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
              accessibilityLabel="刷新点位列表"
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
                {markerListLoading ? '刷新中...' : '刷新列表'}
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
          title="注册"
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
            <Text style={styles.label}>用户名</Text>
            <TextInput
              accessibilityLabel="用户名"
              autoCapitalize="none"
              autoCorrect={false}
              value={registerForm.username}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, username: value }))
              }
              style={styles.input}
              placeholder="请输入用户名"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>昵称</Text>
            <TextInput
              accessibilityLabel="昵称"
              value={registerForm.nickname}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, nickname: value }))
              }
              style={styles.input}
              placeholder="请输入昵称"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>邮箱</Text>
            <TextInput
              accessibilityLabel="邮箱"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={registerForm.email}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, email: value }))
              }
              style={styles.input}
              placeholder="请输入邮箱"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              accessibilityLabel="密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={registerForm.password}
              onChangeText={value =>
                setRegisterForm(prev => ({ ...prev, password: value }))
              }
              style={styles.input}
              placeholder="请输入密码"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>再次输入密码</Text>
            <TextInput
              accessibilityLabel="再次输入密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={password2}
              onChangeText={setPassword2}
              style={styles.input}
              placeholder="请再次输入密码"
              placeholderTextColor={colors.textMuted}
            />

            {registerError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {registerError}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? '正在注册' : '注册'}
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
                {busy ? '注册中...' : '注册'}
              </Text>
            </Pressable>

            <View style={styles.formLinkRow}>
              <Text style={styles.formLinkHint}>已经有账号？</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="去登录"
                hitSlop={8}
                style={styles.formLinkPressable}
                onPress={() => {
                  setError('');
                  goPanel('root');
                }}
              >
                <Text style={styles.formLinkText}>去登录</Text>
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
          title="修改密码"
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
            <Text style={styles.label}>原密码</Text>
            <TextInput
              accessibilityLabel="原密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.oldPassword}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, oldPassword: value }))
              }
              style={styles.input}
              placeholder="请输入原密码"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>新密码</Text>
            <TextInput
              accessibilityLabel="新密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, newPassword: value }))
              }
              style={styles.input}
              placeholder="请输入新密码"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>确认新密码</Text>
            <TextInput
              accessibilityLabel="确认新密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={passwordForm.confirm}
              onChangeText={value =>
                setPasswordForm(prev => ({ ...prev, confirm: value }))
              }
              style={styles.input}
              placeholder="请再次输入新密码"
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
              accessibilityLabel={passwordBusy ? '正在保存密码' : '保存新密码'}
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
                {passwordBusy ? '保存中...' : '保存新密码'}
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
                accessibilityLabel="编辑个人资料"
                accessibilityHint="修改昵称、代词、签名和头像"
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
                  accessibilityLabel={`${nickname} 的头像`}
                  source={{ uri: user.avatarUrl }}
                  style={styles.profileAvatarLarge}
                />
              ) : (
                <View
                  accessibilityLabel="默认个人头像"
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
                  accessibilityLabel="修改密码"
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
                  <Text style={styles.profileOutlineBtnText}>修改密码</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={busy ? '正在退出登录' : '退出登录'}
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
                    {busy ? '处理中...' : '退出登录'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <MarkerListEntryCard
              title="我创建的点位"
              icon="map-marker-plus-outline"
              tone="lilac"
              onPress={() => goPanel('created')}
            />
            <MarkerListEntryCard
              title="我收藏的点位"
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
              登录
            </Text>
            <Text style={styles.label}>用户名</Text>
            <TextInput
              accessibilityLabel="用户名"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder="请输入用户名"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              accessibilityLabel="密码"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder="请输入密码"
              placeholderTextColor={colors.textMuted}
            />

            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? '正在登录' : '登录'}
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
                {busy ? '登录中...' : '登录'}
              </Text>
            </Pressable>

            <View style={styles.formLinkRow}>
              <Text style={styles.formLinkHint}>没有账号？</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="去注册"
                hitSlop={8}
                style={styles.formLinkPressable}
                onPress={() => {
                  setRegisterError('');
                  goPanel('register');
                }}
              >
                <Text style={styles.formLinkText}>去注册</Text>
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
                    编辑资料
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭编辑资料"
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

              <Text style={styles.label}>昵称</Text>
              <TextInput
                accessibilityLabel="昵称"
                value={profileDraft.nickname}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, nickname: value }))
                }
                style={styles.input}
                placeholder="请输入昵称"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>代词</Text>
              <TextInput
                accessibilityLabel="代词"
                value={profileDraft.pronouns}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, pronouns: value }))
                }
                style={styles.input}
                placeholder="例如 she/her"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>签名</Text>
              <TextInput
                accessibilityLabel="签名"
                value={profileDraft.signature}
                onChangeText={value =>
                  setProfileDraft(prev => ({ ...prev, signature: value }))
                }
                style={[styles.input, styles.editSignatureInput]}
                placeholder="写点你想说的话"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>头像（可选）</Text>
              <View style={styles.uploadRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    avatarPicking ? '正在处理图片' : '选择头像图片'
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
                    {avatarPicking ? '处理中...' : '选择图片'}
                  </Text>
                </Pressable>
                {avatarDraftFile ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="清除已选择的头像图片"
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
                    <Text style={styles.uploadClearBtnText}>清除</Text>
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
                  已选择：{avatarDraftFile.name}
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
                  accessibilityLabel="取消编辑资料"
                  accessibilityState={{ disabled: profileSaving }}
                  style={({ pressed }) => [
                    styles.editCancelBtn,
                    profileSaving && styles.disabledControl,
                    pressed && !profileSaving && styles.pressablePressed,
                  ]}
                  disabled={profileSaving}
                  onPress={() => setProfileEditOpen(false)}
                >
                  <Text style={styles.editCancelBtnText}>取消</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    profileSaving ? '正在保存个人资料' : '保存个人资料'
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
                    {profileSaving ? '保存中...' : '保存'}
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
