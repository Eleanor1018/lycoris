import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {
  NavigationContainer,
  type NavigatorScreenParams,
  useIsFocused,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Icon,
  MD3LightTheme,
  PaperProvider,
  Text,
} from 'react-native-paper';
import {AuthProvider} from './src/auth/AuthProvider';
import {DocsScreen} from './src/screens/DocsScreen';
import {MapScreen} from './src/screens/MapScreen';
import {MeScreen, type MePanel} from './src/screens/MeScreen';
import {colors} from './src/theme/colors';

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
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    secondaryContainer: colors.navIndicator,
    onSecondaryContainer: colors.primary,
    outlineVariant: colors.border,
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
  route: {params?: {focusRequest?: MapFocusRequest | null}};
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
        initialParams={{focusRequest: null}}
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
        children={({navigation}) => (
          <MePanelRoute panel="about" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeRegister"
        children={({navigation}) => (
          <MePanelRoute panel="register" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MePassword"
        children={({navigation}) => (
          <MePanelRoute panel="password" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeCreated"
        children={({navigation}) => (
          <MePanelRoute panel="created" navigation={navigation} />
        )}
      />
      <MeStack.Screen
        name="MeFavorites"
        children={({navigation}) => (
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
      screenOptions={({route}) => {
        const tab = tabRoutes.find(item => item.key === route.name) ?? tabRoutes[0];
        return {
          headerShown: false,
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarIcon: ({focused, color, size}) => (
            <Icon
              source={focused ? tab.focusedIcon : tab.unfocusedIcon}
              size={size}
              color={color}
            />
          ),
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarLabel: ({focused, color}) => (
            <Text
              style={[
                styles.tabItemLabel,
                focused ? styles.tabItemLabelActive : styles.tabItemLabelInactive,
                {color},
              ]}>
              {tab.title}
            </Text>
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: 'rgba(30, 27, 34, 0.72)',
          tabBarStyle: [
            styles.tabBar,
            {
              paddingBottom: Math.max(2, insets.bottom),
              minHeight: 64 + Math.max(0, insets.bottom - 4),
            },
          ],
          tabBarHideOnKeyboard: false,
        };
      }}>
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
      <NavigationContainer>
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(122, 75, 143, 0.14)',
    backgroundColor: colors.navSurface,
    paddingTop: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tabItemLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    textAlign: 'center',
  },
  tabItemLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabItemLabelInactive: {
    color: 'rgba(30, 27, 34, 0.72)',
    fontWeight: '500',
  },
});
