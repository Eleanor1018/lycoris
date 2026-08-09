import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
  type NavigatorScreenParams,
  useIsFocused,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Icon, MD3LightTheme, PaperProvider, Text } from 'react-native-paper';
import { AuthProvider } from './src/auth/AuthProvider';
import { DocsScreen } from './src/screens/DocsScreen';
import { MapScreen } from './src/screens/MapScreen';
import { MeScreen, type MePanel } from './src/screens/MeScreen';
import { colors } from './src/theme/colors';
import { radii, shadows, sizes, typography } from './src/theme/tokens';

type AppRoute = {
  key: keyof RootTabParamList;
  title: string;
  focusedIcon: string;
  unfocusedIcon: string;
};

type MapFocusRequest = {
  markerId: number;
  lat?: number;
  lng?: number;
  title?: string;
  requestId: number;
};

type MapsStackParamList = {
  MapsHome: {
    focusRequest?: MapFocusRequest | null;
  };
};

type DocsStackParamList = {
  DocsHome: undefined;
};

type MeStackParamList = {
  MeRoot: undefined;
  MeAbout: undefined;
  MeRegister: undefined;
  MePassword: undefined;
  MeCreated: undefined;
  MeFavorites: undefined;
};

type RootTabParamList = {
  maps: NavigatorScreenParams<MapsStackParamList> | undefined;
  docs: NavigatorScreenParams<DocsStackParamList> | undefined;
  me: NavigatorScreenParams<MeStackParamList> | undefined;
};

const materialTheme = {
  ...MD3LightTheme,
  roundness: radii.card,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.lilac,
    onPrimaryContainer: colors.primary,
    secondary: colors.secondary,
    onSecondary: colors.primary,
    secondaryContainer: colors.blush,
    onSecondaryContainer: colors.primary,
    tertiary: colors.pin,
    onTertiary: colors.primary,
    tertiaryContainer: colors.pinSoft,
    onTertiaryContainer: colors.primary,
    background: colors.background,
    onBackground: colors.textPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.surfaceMuted,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.borderStrong,
    outlineVariant: colors.border,
    error: colors.danger,
    backdrop: colors.scrim,
  },
};

const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.pin,
  },
};

const tabRoutes: AppRoute[] = [
  {
    key: 'maps',
    title: '地图',
    focusedIcon: 'map',
    unfocusedIcon: 'map-outline',
  },
  {
    key: 'docs',
    title: '文档',
    focusedIcon: 'file-document',
    unfocusedIcon: 'file-document-outline',
  },
  {
    key: 'me',
    title: '我的',
    focusedIcon: 'account',
    unfocusedIcon: 'account-outline',
  },
];

const MePanelRouteMap: Record<
  Exclude<MePanel, 'root'>,
  keyof MeStackParamList
> = {
  about: 'MeAbout',
  register: 'MeRegister',
  password: 'MePassword',
  created: 'MeCreated',
  favorites: 'MeFavorites',
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const MapsStack = createNativeStackNavigator<MapsStackParamList>();
const DocsStack = createNativeStackNavigator<DocsStackParamList>();
const MeStack = createNativeStackNavigator<MeStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

function MapsHomeRoute({
  route,
}: {
  route: { params?: { focusRequest?: MapFocusRequest | null } };
}) {
  const isFocused = useIsFocused();
  return (
    <MapScreen
      focusRequest={route.params?.focusRequest ?? null}
      isActive={isFocused}
    />
  );
}

function MapsStackNavigator() {
  return (
    <MapsStack.Navigator screenOptions={stackScreenOptions}>
      <MapsStack.Screen
        name="MapsHome"
        component={MapsHomeRoute}
        initialParams={{ focusRequest: null }}
      />
    </MapsStack.Navigator>
  );
}

function DocsStackNavigator() {
  return (
    <DocsStack.Navigator screenOptions={stackScreenOptions}>
      <DocsStack.Screen name="DocsHome" component={DocsScreen} />
    </DocsStack.Navigator>
  );
}

function MeRootRoute({
  navigation,
}: {
  navigation: {
    navigate: (name: keyof MeStackParamList) => void;
    getParent: () => {
      navigate: (name: keyof RootTabParamList, params?: unknown) => void;
    } | null;
  };
}) {
  const openMarkerOnMap = (target: {
    markerId: number;
    lat?: number;
    lng?: number;
    title?: string;
  }) => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.navigate('maps', {
      screen: 'MapsHome',
      params: {
        focusRequest: {
          markerId: target.markerId,
          lat: target.lat,
          lng: target.lng,
          title: target.title,
          requestId: Date.now(),
        },
      },
    });
  };

  return (
    <MeScreen
      panel="root"
      onOpenMarker={openMarkerOnMap}
      onNavigatePanel={panel => {
        navigation.navigate(MePanelRouteMap[panel]);
      }}
    />
  );
}

function MePanelRoute({
  panel,
  navigation,
}: {
  panel: Exclude<MePanel, 'root'>;
  navigation: {
    goBack: () => void;
    getParent: () => {
      navigate: (name: keyof RootTabParamList, params?: unknown) => void;
    } | null;
  };
}) {
  const openMarkerOnMap = (target: {
    markerId: number;
    lat?: number;
    lng?: number;
    title?: string;
  }) => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.navigate('maps', {
      screen: 'MapsHome',
      params: {
        focusRequest: {
          markerId: target.markerId,
          lat: target.lat,
          lng: target.lng,
          title: target.title,
          requestId: Date.now(),
        },
      },
    });
  };

  return (
    <MeScreen
      panel={panel}
      onOpenMarker={openMarkerOnMap}
      onBack={() => navigation.goBack()}
      onNavigatePanel={() => {}}
    />
  );
}

function MeStackNavigator() {
  return (
    <MeStack.Navigator screenOptions={stackScreenOptions}>
      <MeStack.Screen name="MeRoot" component={MeRootRoute} />
      <MeStack.Screen
        name="MeAbout"
        children={({ navigation }) => (
          <MePanelRoute panel="about" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeRegister"
        children={({ navigation }) => (
          <MePanelRoute panel="register" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MePassword"
        children={({ navigation }) => (
          <MePanelRoute panel="password" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeCreated"
        children={({ navigation }) => (
          <MePanelRoute panel="created" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeFavorites"
        children={({ navigation }) => (
          <MePanelRoute panel="favorites" navigation={navigation} />
        )}
      />
    </MeStack.Navigator>
  );
}

function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="maps"
      screenOptions={({ route }) => {
        const tab =
          tabRoutes.find(item => item.key === route.name) ?? tabRoutes[0];
        return {
          headerShown: false,
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.tabIconPill}>
              <Icon
                source={focused ? tab.focusedIcon : tab.unfocusedIcon}
                size={21}
                color={color}
              />
            </View>
          ),
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={[
                styles.tabItemLabel,
                focused
                  ? styles.tabItemLabelActive
                  : styles.tabItemLabelInactive,
                { color },
              ]}
            >
              {tab.title}
            </Text>
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: [
            styles.tabBar,
            {
              marginBottom: Math.max(10, insets.bottom),
            },
          ],
          tabBarHideOnKeyboard: true,
        };
      }}
    >
      <Tab.Screen name="maps" component={MapsStackNavigator} />
      <Tab.Screen name="docs" component={DocsStackNavigator} />
      <Tab.Screen name="me" component={MeStackNavigator} />
    </Tab.Navigator>
  );
}

function AppShell() {
  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={materialTheme.colors.background}
      />
      <NavigationContainer theme={navigationTheme}>
        <AppTabs />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={materialTheme}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: sizes.floatingNavigationHeight,
    marginHorizontal: 14,
    marginTop: 8,
    paddingTop: 6,
    paddingBottom: 6,
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.navSurface,
    borderRadius: radii.floating,
    ...shadows.floating,
  },
  tabItem: {
    minHeight: sizes.touchTarget,
    borderRadius: radii.floating,
    paddingVertical: 2,
  },
  tabIconPill: {
    width: 48,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemLabel: {
    ...typography.label,
    includeFontPadding: false,
    textAlign: 'center',
  },
  tabItemLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  tabItemLabelInactive: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});
