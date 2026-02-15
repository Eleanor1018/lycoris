import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {Icon} from 'react-native-paper';
import {ApiError, requestJson} from '../lib/http';
import {
  appendUploadImageToFormData,
  pickUploadImage,
  type LocalUploadImage,
} from '../lib/imageUpload';
import {colors} from '../theme/colors';
import {useAuth} from '../auth/AuthProvider';
import {PageBackground} from '../components/PageBackground';
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
  conversion_therapy: '扭转机构/风险点位',
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

function AboutEntryCard({onPress}: {onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.menuEntryCard}>
      <View style={styles.menuEntryIconWrap}>
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
  onPress,
}: {
  title: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuEntryCard}>
      <View style={styles.menuEntryIconWrap}>
        <Icon source={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.menuEntryTextWrap}>
        <Text style={styles.menuEntryTitle}>{title}</Text>
      </View>
      <Icon source="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
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
  const {loading, user, isLoggedIn, login, register, logout, refresh} = useAuth();
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
  const [avatarDraftFile, setAvatarDraftFile] = useState<LocalUploadImage | null>(
    null,
  );
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
      createdRows.slice(createdPage * rowsPerPage, (createdPage + 1) * rowsPerPage),
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

    if (!payload.username || !payload.nickname || !payload.email || !payload.password) {
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
    const result = await pickUploadImage({mode: 'avatar'});
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
      setPasswordForm({oldPassword: '', newPassword: '', confirm: ''});
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
      <View style={styles.loadingWrap}>
        <PageBackground />
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>正在读取登录状态...</Text>
      </View>
    );
  }

  if (panel === 'about') {
    return (
      <View style={styles.page}>
        <PageBackground />
        <View style={styles.aboutTopBar}>
          <Pressable style={styles.backRow} onPress={() => goPanel('root')}>
            <Icon source="arrow-left" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.aboutContent}
          showsVerticalScrollIndicator={false}>
          <Markdown
            style={aboutMarkdownStyles}
            onLinkPress={url => {
              Linking.openURL(url).catch(() => {});
              return false;
            }}>
            {aboutMarkdown}
          </Markdown>
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
    const rangeEnd = rows.length === 0 ? 0 : Math.min((page + 1) * rowsPerPage, rows.length);

    return (
      <View style={styles.page}>
        <PageBackground />
        <View style={styles.aboutTopBar}>
          <Pressable style={styles.backRow} onPress={() => goPanel('root')}>
            <Icon source="arrow-left" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.listPageTitle}>{title}</Text>

        <View style={styles.card}>
          <View style={styles.markerListHeaderRow}>
            <Text style={[styles.markerListHeaderText, styles.markerTitleCol]}>名称</Text>
            <Text style={[styles.markerListHeaderText, styles.markerTypeCol]}>类型</Text>
            <Text style={[styles.markerListHeaderText, styles.markerDateCol]}>更新</Text>
          </View>

          {markerListLoading ? (
            <View style={styles.markerListLoadingWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.menuEntrySubtitle}>正在加载...</Text>
            </View>
          ) : slice.length === 0 ? (
            <Text style={styles.markerListEmptyText}>{emptyText}</Text>
          ) : (
            slice.map(row => (
              <Pressable
                key={`${panel}-${row.id}`}
                onPress={() => openMarkerOnMap(row)}
                style={styles.markerListRow}>
                <Text style={[styles.markerListCellText, styles.markerTitleCol]} numberOfLines={3}>
                  {row.title}
                </Text>
                <Text style={[styles.markerListCellText, styles.markerTypeCol]} numberOfLines={1}>
                  {row.category}
                </Text>
                <Text style={[styles.markerListCellText, styles.markerDateCol]} numberOfLines={1}>
                  {row.updatedAt}
                </Text>
              </Pressable>
            ))
          )}

          <View style={styles.markerPagerRow}>
            <Text style={styles.markerPagerText}>
              {rangeStart}-{rangeEnd} of {rows.length}
            </Text>
            <View style={styles.markerPagerActions}>
              <Pressable
                style={[
                  styles.markerPagerBtn,
                  page <= 0 && styles.markerPagerBtnDisabled,
                ]}
                disabled={page <= 0}
                onPress={() => setPage(prev => Math.max(0, prev - 1))}>
                <Icon source="chevron-left" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={[
                  styles.markerPagerBtn,
                  page >= pageCount - 1 && styles.markerPagerBtnDisabled,
                ]}
                disabled={page >= pageCount - 1}
                onPress={() =>
                  setPage(prev => Math.min(Math.max(0, pageCount - 1), prev + 1))
                }>
                <Icon source="chevron-right" size={20} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          {markerListError ? <Text style={styles.errorText}>{markerListError}</Text> : null}

          <Pressable
            style={styles.markerReloadBtn}
            disabled={markerListLoading}
            onPress={() => {
              loadMarkerLists().catch(() => {});
            }}>
            <Text style={styles.markerReloadBtnText}>
              {markerListLoading ? '刷新中...' : '刷新列表'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (panel === 'register') {
    return (
      <View style={styles.page}>
        <PageBackground />
        <View style={styles.hero}>
          <Pressable style={styles.backRow} onPress={() => goPanel('root')}>
            <Icon source="arrow-left" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.title}>注册</Text>
          <Text style={styles.subtitle}>创建账号后可同步收藏与个人资料</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>用户名</Text>
            <TextInput
              autoCapitalize="none"
              value={registerForm.username}
              onChangeText={value =>
                setRegisterForm(prev => ({...prev, username: value}))
              }
              style={styles.input}
              placeholder="请输入用户名"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>昵称</Text>
            <TextInput
              value={registerForm.nickname}
              onChangeText={value =>
                setRegisterForm(prev => ({...prev, nickname: value}))
              }
              style={styles.input}
              placeholder="请输入昵称"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>邮箱</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={registerForm.email}
              onChangeText={value =>
                setRegisterForm(prev => ({...prev, email: value}))
              }
              style={styles.input}
              placeholder="请输入邮箱"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              autoCapitalize="none"
              secureTextEntry
              value={registerForm.password}
              onChangeText={value =>
                setRegisterForm(prev => ({...prev, password: value}))
              }
              style={styles.input}
              placeholder="请输入密码"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>再次输入密码</Text>
            <TextInput
              autoCapitalize="none"
              secureTextEntry
              value={password2}
              onChangeText={setPassword2}
              style={styles.input}
              placeholder="请再次输入密码"
              placeholderTextColor="#8a7fa6"
            />

            {registerError ? (
              <Text style={styles.errorText}>{registerError}</Text>
            ) : null}

            <Pressable onPress={doRegister} style={styles.loginBtn} disabled={busy}>
              <Text style={styles.loginBtnText}>{busy ? '注册中...' : '注册'}</Text>
            </Pressable>

            <View style={styles.formLinkRow}>
              <Text style={styles.formLinkHint}>已经有账号？</Text>
              <Pressable
                onPress={() => {
                  setError('');
                  goPanel('root');
                }}>
                <Text style={styles.formLinkText}>去登录</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (panel === 'password') {
    return (
      <View style={styles.page}>
        <PageBackground />
        <View style={styles.hero}>
          <Pressable style={styles.backRow} onPress={() => goPanel('root')}>
            <Icon source="arrow-left" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.title}>修改密码</Text>
          <Text style={styles.subtitle}>用于保护你的账号安全</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>原密码</Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            value={passwordForm.oldPassword}
            onChangeText={value =>
              setPasswordForm(prev => ({...prev, oldPassword: value}))
            }
            style={styles.input}
            placeholder="请输入原密码"
            placeholderTextColor="#8a7fa6"
          />

          <Text style={styles.label}>新密码</Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            value={passwordForm.newPassword}
            onChangeText={value =>
              setPasswordForm(prev => ({...prev, newPassword: value}))
            }
            style={styles.input}
            placeholder="请输入新密码"
            placeholderTextColor="#8a7fa6"
          />

          <Text style={styles.label}>确认新密码</Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            value={passwordForm.confirm}
            onChangeText={value =>
              setPasswordForm(prev => ({...prev, confirm: value}))
            }
            style={styles.input}
            placeholder="请再次输入新密码"
            placeholderTextColor="#8a7fa6"
          />

          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          {passwordSuccess ? (
            <Text style={styles.successText}>{passwordSuccess}</Text>
          ) : null}

          <Pressable onPress={doChangePassword} style={styles.loginBtn} disabled={passwordBusy}>
            <Text style={styles.loginBtnText}>
              {passwordBusy ? '保存中...' : '保存'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PageBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.rootScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {isLoggedIn && user ? (
          <>
            <View style={[styles.profileMainCard, styles.rootPrimaryCardSpacing]}>
              <Pressable style={styles.profileEditFab} onPress={openProfileEdit}>
                <Icon source="pencil" size={18} color={colors.primary} />
              </Pressable>

              {user.avatarUrl ? (
                <Image source={{uri: user.avatarUrl}} style={styles.profileAvatarLarge} />
              ) : (
                <View style={styles.profileAvatarFallbackLarge}>
                  <Icon source="account-outline" size={44} color={colors.primary} />
                </View>
              )}

              <Text style={styles.profileName}>{nickname}</Text>
              <Text style={styles.profileMeta}>
                @{user.username}
                {user.pronouns ? ` · ${user.pronouns}` : ''}
              </Text>
              <Text style={styles.profileSignature}>
                {user.signature || 'Attendre et espérer.'}
              </Text>

              <Pressable
                style={styles.profileOutlineBtn}
                onPress={() => {
                  setPasswordError('');
                  setPasswordSuccess('');
                  goPanel('password');
                }}>
                <Text style={styles.profileOutlineBtnText}>修改密码</Text>
              </Pressable>

              <Pressable
                style={styles.profileLogoutBtn}
                onPress={doLogout}
                disabled={busy}>
                <Text style={styles.profileLogoutBtnText}>
                  {busy ? '处理中...' : '退出登录'}
                </Text>
              </Pressable>
            </View>

            <MarkerListEntryCard
              title="我创建的点位"
              icon="map-marker-plus-outline"
              onPress={() => goPanel('created')}
            />
            <MarkerListEntryCard
              title="我收藏的点位"
              icon="star-outline"
              onPress={() => goPanel('favorites')}
            />
          </>
        ) : (
          <>
            <View style={[styles.card, styles.rootPrimaryCardSpacing]}>
              <Text style={styles.title}>登录</Text>
              <Text style={styles.label}>用户名</Text>
              <TextInput
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                placeholder="请输入用户名"
                placeholderTextColor="#8a7fa6"
              />

              <Text style={styles.label}>密码</Text>
              <TextInput
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor="#8a7fa6"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable onPress={doLogin} style={styles.loginBtn} disabled={busy}>
                <Text style={styles.loginBtnText}>{busy ? '登录中...' : '登录'}</Text>
              </Pressable>

              <View style={styles.formLinkRow}>
                <Text style={styles.formLinkHint}>没有账号？</Text>
                <Pressable
                  onPress={() => {
                    setRegisterError('');
                    goPanel('register');
                  }}>
                  <Text style={styles.formLinkText}>去注册</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        <AboutEntryCard onPress={() => goPanel('about')} />
      </ScrollView>

      <Modal
        visible={profileEditOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!profileSaving) setProfileEditOpen(false);
        }}>
        <View style={styles.modalCenterWrap}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!profileSaving) setProfileEditOpen(false);
            }}
          />
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>编辑资料</Text>

            <Text style={styles.label}>昵称</Text>
            <TextInput
              value={profileDraft.nickname}
              onChangeText={value =>
                setProfileDraft(prev => ({...prev, nickname: value}))
              }
              style={styles.input}
              placeholder="请输入昵称"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>代词</Text>
            <TextInput
              value={profileDraft.pronouns}
              onChangeText={value =>
                setProfileDraft(prev => ({...prev, pronouns: value}))
              }
              style={styles.input}
              placeholder="例如 she/her"
              placeholderTextColor="#8a7fa6"
            />

            <Text style={styles.label}>签名</Text>
            <TextInput
              value={profileDraft.signature}
              onChangeText={value =>
                setProfileDraft(prev => ({...prev, signature: value}))
              }
              style={[styles.input, styles.editSignatureInput]}
              placeholder="写点你想说的话"
              placeholderTextColor="#8a7fa6"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>头像（可选）</Text>
            <View style={styles.uploadRow}>
              <Pressable
                style={styles.uploadPickBtn}
                onPress={pickAvatarImage}
                disabled={profileSaving || avatarPicking}>
                <Text style={styles.uploadPickBtnText}>
                  {avatarPicking ? '处理中...' : '选择图片'}
                </Text>
              </Pressable>
              {avatarDraftFile ? (
                <Pressable
                  style={styles.uploadClearBtn}
                  onPress={() => {
                    setAvatarDraftFile(null);
                    setAvatarHint('');
                    setAvatarError('');
                  }}
                  disabled={profileSaving || avatarPicking}>
                  <Text style={styles.uploadClearBtnText}>清除</Text>
                </Pressable>
              ) : null}
            </View>

            {avatarHint ? <Text style={styles.uploadHintText}>{avatarHint}</Text> : null}
            {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}
            {avatarDraftFile ? (
              <Text style={styles.uploadPickedText}>已选择：{avatarDraftFile.name}</Text>
            ) : null}

            {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

            <View style={styles.editActionRow}>
              <Pressable
                style={styles.editCancelBtn}
                disabled={profileSaving}
                onPress={() => setProfileEditOpen(false)}>
                <Text style={styles.editCancelBtnText}>取消</Text>
              </Pressable>
              <Pressable
                style={styles.editSaveBtn}
                disabled={profileSaving || avatarPicking}
                onPress={saveProfileEdit}>
                <Text style={styles.editSaveBtnText}>
                  {profileSaving ? '保存中...' : '保存'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const aboutMarkdownStyles = StyleSheet.create({
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
  heading1: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: 14,
  },
  heading2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 18,
    marginBottom: 10,
  },
  heading3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
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
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 6,
  },
  blockquote: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    marginBottom: 14,
  },
  code_inline: {
    backgroundColor: 'transparent',
    color: colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  code_block: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 14,
  },
  fence: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 14,
  },
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 54,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingText: {
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 24,
  },
  rootScrollContent: {
    paddingBottom: 24,
  },
  accountScrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  accountBackRowWrap: {
    marginBottom: 10,
  },
  aboutTopBar: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  listPageTitle: {
    marginBottom: 10,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  hero: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
    color: colors.textSecondary,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    gap: 4,
  },
  backText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  menuEntryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 3,
    marginBottom: 12,
  },
  accountEntryCard: {
    minHeight: 96,
    paddingVertical: 16,
  },
  menuEntryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  entryAvatarFallbackLogged: {
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  entryAvatarGuest: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b5b5b5',
  },
  entryAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  menuEntryTextWrap: {
    flex: 1,
    paddingLeft: 16,
  },
  menuEntryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  menuEntrySubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 3,
  },
  rootPrimaryCardSpacing: {
    marginBottom: 14,
  },
  markerListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 2,
    gap: 8,
  },
  markerListHeaderText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  markerTitleCol: {
    flex: 1,
  },
  markerTypeCol: {
    flex: 1,
  },
  markerDateCol: {
    flex: 1,
    textAlign: 'left',
  },
  markerListLoadingWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  markerListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    gap: 8,
  },
  markerListCellText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  markerListEmptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 26,
  },
  markerPagerRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markerPagerText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  markerPagerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markerPagerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  markerPagerBtnDisabled: {
    opacity: 0.42,
  },
  markerReloadBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  markerReloadBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  profileMainCard: {
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 600,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 3,
  },
  profileEditFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(116, 73, 136, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(116, 73, 136, 0.16)',
  },
  profileAvatarLarge: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 4,
    borderColor: '#f2e6f7',
    backgroundColor: colors.surface,
    shadowColor: 'rgba(116, 73, 136, 0.18)',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  profileAvatarFallbackLarge: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 4,
    borderColor: '#f2e6f7',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    marginTop: 20,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
  },
  profileMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  profileSignature: {
    marginTop: 28,
    marginBottom: 28,
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  profileOutlineBtn: {
    minWidth: 168,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c0e5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  profileOutlineBtnText: {
    color: '#744988',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  profileLogoutBtn: {
    marginTop: 18,
    minWidth: 168,
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#e07a7a',
    shadowColor: 'rgba(182, 90, 90, 0.28)',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  profileLogoutBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  profileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  profileAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  profileHeadTextWrap: {
    flex: 1,
  },
  profileHeadTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileHeadSubtitle: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  label: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  errorText: {
    color: colors.danger,
    marginTop: 2,
  },
  successText: {
    color: '#3d8e4e',
    marginTop: 2,
  },
  loginBtn: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    minHeight: 36,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  formLinkRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formLinkHint: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  formLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 14, 24, 0.32)',
  },
  editCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 3,
  },
  editTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  editSignatureInput: {
    minHeight: 86,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
  },
  uploadRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadPickBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  uploadPickBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadClearBtn: {
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
  },
  uploadClearBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadHintText: {
    color: '#3c8b4f',
    fontSize: 12,
    marginTop: 4,
  },
  uploadPickedText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  editActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editCancelBtn: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editCancelBtnText: {
    color: colors.primary,
    fontWeight: '700',
  },
  editSaveBtn: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  row: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingVertical: 8,
    borderWidth: 1,
  },
  refreshBtn: {
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  refreshText: {
    color: colors.primary,
    fontWeight: '600',
  },
  logoutBtn: {
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  logoutText: {
    color: colors.primary,
    fontWeight: '600',
  },
  aboutContent: {
    paddingBottom: 24,
  },
});
