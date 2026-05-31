# Native Android Web Frontend Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Kotlin native Android client that translates the current Web frontend core user flows into Android while reusing the existing backend unchanged.

**Architecture:** Create a new `android-native` Gradle project beside the existing `frontend`, `backend`, and `mobile` folders. Use a single Android app module with focused packages for design, network/session, auth, map, profile, search, and documents; repository classes own API calls and Compose screens consume stable view state.

**Tech Stack:** Kotlin, Jetpack Compose, Material 3, osmdroid with OSM tiles, Retrofit, OkHttp, kotlinx.serialization, DataStore, Android Photo Picker, JUnit.

---

## Source Spec

Implement from:

- `docs/superpowers/specs/2026-05-31-native-android-web-frontend-parity-design.md`
- `frontend/src/theme.ts`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/ChangePassword.tsx`
- `frontend/src/pages/Maps.tsx`
- `frontend/src/pages/Search.tsx`
- `frontend/src/pages/Documents.tsx`
- `frontend/src/components/MarkerFormDialog.tsx`
- `frontend/src/types/marker.ts`

## File Structure

Create a new project rooted at `android-native/`.

```text
android-native/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  gradlew
  gradlew.bat
  gradle/wrapper/gradle-wrapper.jar
  gradle/wrapper/gradle-wrapper.properties
  app/
    build.gradle.kts
    src/main/AndroidManifest.xml
    src/main/assets/docs/about.md
    src/main/assets/docs/nora-hrt-guide.md
    src/main/assets/doc_images/...
    src/main/java/online/lycoris/android/
      LycorisApplication.kt
      MainActivity.kt
      app/LycorisApp.kt
      app/LycorisNav.kt
      core/config/BuildConstants.kt
      core/design/LycorisTheme.kt
      core/network/ApiConfig.kt
      core/network/ApiResult.kt
      core/network/LycorisApi.kt
      core/network/NetworkModule.kt
      core/session/PersistentCookieJar.kt
      core/session/SessionStore.kt
      core/location/LocationProvider.kt
      core/image/ImagePicker.kt
      feature/auth/AuthModels.kt
      feature/auth/AuthRepository.kt
      feature/auth/AuthViewModel.kt
      feature/auth/LoginScreen.kt
      feature/auth/RegisterScreen.kt
      feature/map/MarkerModels.kt
      feature/map/MarkerRepository.kt
      feature/map/MapContracts.kt
      feature/map/MapViewModel.kt
      feature/map/OsmMapView.kt
      feature/map/MapScreen.kt
      feature/map/MarkerDetailSheet.kt
      feature/map/MarkerEditorSheet.kt
      feature/profile/ProfileRepository.kt
      feature/profile/ProfileScreen.kt
      feature/search/SearchRepository.kt
      feature/search/SearchScreen.kt
      feature/documents/DocumentRepository.kt
      feature/documents/DocumentsScreen.kt
    src/test/java/online/lycoris/android/
      core/config/BuildConstantsTest.kt
      core/network/ApiConfigTest.kt
      core/session/PersistentCookieJarTest.kt
      feature/auth/AuthRepositoryTest.kt
      feature/map/MarkerRepositoryTest.kt
      feature/map/MapContractsTest.kt
      feature/map/MarkerSubmitCoordinatorTest.kt
      feature/documents/DocumentRepositoryTest.kt
```

Keep `backend/`, `frontend/`, and `mobile/` untouched except for reading them as references. Do not stage backend files while implementing this plan.

---

### Task 1: Native Android Project Skeleton

**Files:**

- Create: `android-native/settings.gradle.kts`
- Create: `android-native/build.gradle.kts`
- Create: `android-native/gradle.properties`
- Create: `android-native/gradlew`
- Create: `android-native/gradlew.bat`
- Create: `android-native/gradle/wrapper/gradle-wrapper.jar`
- Create: `android-native/gradle/wrapper/gradle-wrapper.properties`
- Create: `android-native/app/build.gradle.kts`
- Create: `android-native/app/src/main/AndroidManifest.xml`
- Create: `android-native/app/src/main/java/online/lycoris/android/LycorisApplication.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/MainActivity.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/config/BuildConstants.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/core/config/BuildConstantsTest.kt`

- [ ] **Step 1: Copy the Gradle wrapper from the existing Android project**

Run from repo root:

```powershell
New-Item -ItemType Directory -Force .\android-native\gradle\wrapper
Copy-Item .\mobile\android\gradlew .\android-native\gradlew
Copy-Item .\mobile\android\gradlew.bat .\android-native\gradlew.bat
Copy-Item .\mobile\android\gradle\wrapper\gradle-wrapper.jar .\android-native\gradle\wrapper\gradle-wrapper.jar
Copy-Item .\mobile\android\gradle\wrapper\gradle-wrapper.properties .\android-native\gradle\wrapper\gradle-wrapper.properties
```

Expected: files exist under `android-native/`.

- [ ] **Step 2: Create Gradle settings**

Write `android-native/settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "LycorisNativeAndroid"
include(":app")
```

- [ ] **Step 3: Create root build file**

Write `android-native/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.20" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.20" apply false
}
```

- [ ] **Step 4: Create project properties**

Write `android-native/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
```

- [ ] **Step 5: Create app build file**

Write `android-native/app/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "online.lycoris.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "online.lycoris.android"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "LY_API_BASE_URL", "\"\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        debug {
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.05.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.navigation:navigation-compose:2.9.0")
    implementation("androidx.datastore:datastore-preferences:1.1.7")

    implementation("org.osmdroid:osmdroid-android:6.1.20")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("io.coil-kt.coil3:coil-compose:3.2.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
```

- [ ] **Step 6: Write the failing build constants test**

Write `android-native/app/src/test/java/online/lycoris/android/core/config/BuildConstantsTest.kt`:

```kotlin
package online.lycoris.android.core.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildConstantsTest {
    @Test
    fun defaultsToProductionApiWhenBuildConfigIsBlank() {
        val constants = BuildConstants(rawApiBaseUrl = "")

        assertEquals("https://api.lycoris.online", constants.apiBaseUrl)
    }

    @Test
    fun trimsTrailingSlashFromCustomApiBaseUrl() {
        val constants = BuildConstants(rawApiBaseUrl = "http://10.0.2.2:8080///")

        assertEquals("http://10.0.2.2:8080", constants.apiBaseUrl)
        assertTrue(constants.isCustomApiBaseUrl)
    }
}
```

- [ ] **Step 7: Run the test and verify it fails**

Run from `android-native/`:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.core.config.BuildConstantsTest
```

Expected: FAIL because `BuildConstants` does not exist.

- [ ] **Step 8: Implement app manifest and application classes**

Write `android-native/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

    <application
        android:name=".LycorisApplication"
        android:allowBackup="false"
        android:label="@string/app_name"
        android:theme="@style/Theme.Lycoris"
        android:supportsRtl="true">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Write `android-native/app/src/main/java/online/lycoris/android/LycorisApplication.kt`:

```kotlin
package online.lycoris.android

import android.app.Application

class LycorisApplication : Application()
```

Write `android-native/app/src/main/java/online/lycoris/android/MainActivity.kt`:

```kotlin
package online.lycoris.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Text("Lycoris")
        }
    }
}
```

Add resource files:

`android-native/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">Lycoris</string>
</resources>
```

`android-native/app/src/main/res/values/styles.xml`:

```xml
<resources>
    <style name="Theme.Lycoris" parent="android:style/Theme.Material.Light.NoActionBar">
        <item name="android:windowNoTitle">true</item>
    </style>
</resources>
```

- [ ] **Step 9: Implement build constants**

Write `android-native/app/src/main/java/online/lycoris/android/core/config/BuildConstants.kt`:

```kotlin
package online.lycoris.android.core.config

import online.lycoris.android.BuildConfig

class BuildConstants(
    rawApiBaseUrl: String = BuildConfig.LY_API_BASE_URL,
) {
    val apiBaseUrl: String = rawApiBaseUrl
        .trim()
        .trimEnd('/')
        .ifBlank { DEFAULT_PROD_API_BASE_URL }

    val isCustomApiBaseUrl: Boolean = rawApiBaseUrl.trim().isNotBlank()

    companion object {
        const val DEFAULT_PROD_API_BASE_URL = "https://api.lycoris.online"
    }
}
```

- [ ] **Step 10: Run the unit test and build**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.core.config.BuildConstantsTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 11: Commit the project skeleton**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):初始化原生Android工程"
```

Expected: commit includes only `android-native` files.

---

### Task 2: Web-Matched Theme and Navigation Shell

**Files:**

- Modify: `android-native/app/src/main/java/online/lycoris/android/MainActivity.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/design/LycorisTheme.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/app/LycorisNav.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/app/LycorisApp.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/app/LycorisNavTest.kt`

- [ ] **Step 1: Write the failing navigation test**

Write `android-native/app/src/test/java/online/lycoris/android/app/LycorisNavTest.kt`:

```kotlin
package online.lycoris.android.app

import org.junit.Assert.assertEquals
import org.junit.Test

class LycorisNavTest {
    @Test
    fun bottomDestinationsMatchWebCoreEntrypoints() {
        val routes = LycorisDestination.bottomBarDestinations.map { it.route }

        assertEquals(listOf("map", "search", "documents", "profile"), routes)
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.app.LycorisNavTest
```

Expected: FAIL because `LycorisDestination` does not exist.

- [ ] **Step 3: Implement the theme**

Write `android-native/app/src/main/java/online/lycoris/android/core/design/LycorisTheme.kt`:

```kotlin
package online.lycoris.android.core.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object LycorisColors {
    val Primary = Color(0xFF5A3850)
    val MapPrimary = Color(0xFF7A4B8F)
    val Secondary = Color(0xFFD0BCFF)
    val Background = Color(0xFFF8EBFF)
    val Surface = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF1D1B20)
    val TextSecondary = Color(0xB8231828)
    val Border = Color(0x1F7A4B8F)
    val Danger = Color(0xFFDC2626)
    val Success = Color(0xFF16A34A)
}

val LycorisLightColorScheme: ColorScheme = lightColorScheme(
    primary = LycorisColors.Primary,
    secondary = LycorisColors.Secondary,
    background = LycorisColors.Background,
    surface = LycorisColors.Surface,
    onPrimary = Color.White,
    onSecondary = LycorisColors.TextPrimary,
    onBackground = LycorisColors.TextPrimary,
    onSurface = LycorisColors.TextPrimary,
    error = LycorisColors.Danger,
)

@Composable
fun LycorisTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) LycorisLightColorScheme else LycorisLightColorScheme
    MaterialTheme(
        colorScheme = colors,
        typography = Typography(),
        content = content,
    )
}
```

- [ ] **Step 4: Implement navigation contracts**

Write `android-native/app/src/main/java/online/lycoris/android/app/LycorisNav.kt`:

```kotlin
package online.lycoris.android.app

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Search
import androidx.compose.ui.graphics.vector.ImageVector

sealed class LycorisDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    data object Map : LycorisDestination("map", "地图", Icons.Outlined.Map)
    data object Search : LycorisDestination("search", "搜索", Icons.Outlined.Search)
    data object Documents : LycorisDestination("documents", "文档", Icons.Outlined.Article)
    data object Profile : LycorisDestination("profile", "我的", Icons.Outlined.Person)
    data object Login : LycorisDestination("login", "登录", Icons.Outlined.Person)
    data object Register : LycorisDestination("register", "注册", Icons.Outlined.Person)

    companion object {
        val bottomBarDestinations = listOf(Map, Search, Documents, Profile)
    }
}
```

- [ ] **Step 5: Implement the app shell**

Write `android-native/app/src/main/java/online/lycoris/android/app/LycorisApp.kt`:

```kotlin
package online.lycoris.android.app

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import online.lycoris.android.core.design.LycorisTheme

@Composable
fun LycorisApp() {
    LycorisTheme {
        val navController = rememberNavController()
        val backStack by navController.currentBackStackEntryAsState()
        val currentDestination = backStack?.destination

        Scaffold(
            bottomBar = {
                NavigationBar {
                    LycorisDestination.bottomBarDestinations.forEach { destination ->
                        val selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(destination.route) {
                                    launchSingleTop = true
                                    restoreState = true
                                    popUpTo(LycorisDestination.Map.route) {
                                        saveState = true
                                    }
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = destination.label) },
                            label = { Text(destination.label) },
                        )
                    }
                }
            },
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = LycorisDestination.Map.route,
                modifier = Modifier.padding(innerPadding),
            ) {
                composable(LycorisDestination.Map.route) { Text("地图") }
                composable(LycorisDestination.Search.route) { Text("搜索") }
                composable(LycorisDestination.Documents.route) { Text("文档") }
                composable(LycorisDestination.Profile.route) { Text("我的") }
                composable(LycorisDestination.Login.route) { Text("登录") }
                composable(LycorisDestination.Register.route) { Text("注册") }
            }
        }
    }
}
```

Modify `android-native/app/src/main/java/online/lycoris/android/MainActivity.kt`:

```kotlin
package online.lycoris.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import online.lycoris.android.app.LycorisApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LycorisApp()
        }
    }
}
```

- [ ] **Step 6: Run tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.app.LycorisNavTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit theme and shell**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):添加主题和主导航"
```

Expected: staged files are inside `android-native/`.

---

### Task 3: Network, Session, and API Contracts

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/core/network/ApiConfig.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/network/ApiResult.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/network/LycorisApi.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/network/NetworkModule.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/session/PersistentCookieJar.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/session/SessionStore.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/core/network/ApiConfigTest.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/core/session/PersistentCookieJarTest.kt`

- [ ] **Step 1: Write API config tests**

Write `android-native/app/src/test/java/online/lycoris/android/core/network/ApiConfigTest.kt`:

```kotlin
package online.lycoris.android.core.network

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiConfigTest {
    @Test
    fun buildsAbsoluteApiUrl() {
        val config = ApiConfig(baseUrl = "https://api.lycoris.online")

        assertEquals("https://api.lycoris.online/api/me", config.url("/api/me"))
        assertEquals("https://api.lycoris.online/uploads/a.jpg", config.url("/uploads/a.jpg"))
    }

    @Test
    fun leavesAbsoluteAssetsUnchanged() {
        val config = ApiConfig(baseUrl = "https://api.lycoris.online")

        assertEquals("https://cdn.example/a.jpg", config.assetUrl("https://cdn.example/a.jpg"))
        assertEquals("https://api.lycoris.online/uploads/a.jpg", config.assetUrl("/uploads/a.jpg"))
    }
}
```

- [ ] **Step 2: Write cookie jar tests**

Write `android-native/app/src/test/java/online/lycoris/android/core/session/PersistentCookieJarTest.kt`:

```kotlin
package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class PersistentCookieJarTest {
    @Test
    fun storesAndReturnsMatchingCookies() {
        val store = InMemorySessionStore()
        val jar = PersistentCookieJar(store)
        val url = "https://api.lycoris.online/api/login".toHttpUrl()
        val cookie = Cookie.Builder()
            .name("JSESSIONID")
            .value("abc")
            .domain("api.lycoris.online")
            .path("/")
            .build()

        jar.saveFromResponse(url, listOf(cookie))

        assertEquals(listOf(cookie), jar.loadForRequest(url))
    }
}
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.core.network.ApiConfigTest --tests online.lycoris.android.core.session.PersistentCookieJarTest
```

Expected: FAIL because network/session classes do not exist.

- [ ] **Step 4: Implement API config and result types**

Write `android-native/app/src/main/java/online/lycoris/android/core/network/ApiConfig.kt`:

```kotlin
package online.lycoris.android.core.network

class ApiConfig(val baseUrl: String) {
    private val normalizedBaseUrl = baseUrl.trim().trimEnd('/')

    fun url(path: String): String {
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        return "$normalizedBaseUrl$normalizedPath"
    }

    fun assetUrl(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val trimmed = value.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
        return url(trimmed)
    }
}
```

Write `android-native/app/src/main/java/online/lycoris/android/core/network/ApiResult.kt`:

```kotlin
package online.lycoris.android.core.network

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val status: Int?, val message: String) : ApiResult<Nothing>
}
```

- [ ] **Step 5: Implement session storage and cookie jar**

Write `android-native/app/src/main/java/online/lycoris/android/core/session/SessionStore.kt`:

```kotlin
package online.lycoris.android.core.session

import okhttp3.Cookie

interface SessionStore {
    fun readCookies(): List<Cookie>
    fun writeCookies(cookies: List<Cookie>)
    fun clear()
}

class InMemorySessionStore : SessionStore {
    private var cookies: List<Cookie> = emptyList()

    override fun readCookies(): List<Cookie> = cookies

    override fun writeCookies(cookies: List<Cookie>) {
        this.cookies = cookies
    }

    override fun clear() {
        cookies = emptyList()
    }
}
```

Write `android-native/app/src/main/java/online/lycoris/android/core/session/PersistentCookieJar.kt`:

```kotlin
package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(
    private val store: SessionStore,
) : CookieJar {
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val existing = store.readCookies()
            .filterNot { old -> cookies.any { new -> old.name == new.name && old.domain == new.domain && old.path == new.path } }
        store.writeCookies(existing + cookies)
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        return store.readCookies().filter { it.matches(url) }
    }
}
```

- [ ] **Step 6: Implement the initial Retrofit API shell**

Write `android-native/app/src/main/java/online/lycoris/android/core/network/LycorisApi.kt`:

```kotlin
package online.lycoris.android.core.network

interface LycorisApi
```

Write `android-native/app/src/main/java/online/lycoris/android/core/network/NetworkModule.kt`:

```kotlin
package online.lycoris.android.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import online.lycoris.android.core.session.PersistentCookieJar
import retrofit2.Retrofit

@Serializable
data class ApiEnvelope<T>(
    val code: Int? = null,
    val message: String? = null,
    val data: T? = null,
)

object NetworkModule {
    val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun okHttp(cookieJar: PersistentCookieJar): OkHttpClient {
        return OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            })
            .build()
    }

    fun retrofit(baseUrl: String, client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    fun api(baseUrl: String, client: OkHttpClient): LycorisApi {
        return retrofit(baseUrl, client).create(LycorisApi::class.java)
    }
}
```

- [ ] **Step 7: Run tests**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.core.network.ApiConfigTest --tests online.lycoris.android.core.session.PersistentCookieJarTest
```

Expected: tests pass.

- [ ] **Step 8: Commit network foundation**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):添加网络和会话基础"
```

Expected: commit contains only Android network/session files.

---

### Task 4: Authentication Flow

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthModels.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthRepository.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthViewModel.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/auth/LoginScreen.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/auth/RegisterScreen.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/app/LycorisApp.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/auth/AuthRepositoryTest.kt`

- [ ] **Step 1: Write auth repository tests**

Write `android-native/app/src/test/java/online/lycoris/android/feature/auth/AuthRepositoryTest.kt`:

```kotlin
package online.lycoris.android.feature.auth

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.core.session.InMemorySessionStore
import online.lycoris.android.core.session.PersistentCookieJar
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loginReturnsUserData() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""{"data":{"publicId":"u1","username":"nora","nickname":"Nora","email":"nora@example.com","avatarUrl":"/uploads/a.jpg","role":"USER"}}""")
        )
        val api = NetworkModule.api(
            server.url("/").toString(),
            NetworkModule.okHttp(PersistentCookieJar(InMemorySessionStore())),
        )
        val repository = AuthRepository(api)

        val result = repository.login("nora", "secret")

        assertTrue(result is AuthResult.Authenticated)
        assertEquals("nora", (result as AuthResult.Authenticated).user.username)
        assertEquals("/api/login", server.takeRequest().path)
    }
}
```

- [ ] **Step 2: Run the auth test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.auth.AuthRepositoryTest
```

Expected: FAIL because auth classes do not exist.

- [ ] **Step 3: Implement auth models**

Write `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthModels.kt`:

```kotlin
package online.lycoris.android.feature.auth

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val username: String,
    val nickname: String,
    val email: String,
    val password: String,
    val website: String = "",
)

@Serializable
data class UserDto(
    val publicId: String,
    val username: String,
    val nickname: String,
    val email: String,
    val avatarUrl: String? = null,
    val role: String? = null,
)

data class User(
    val publicId: String,
    val username: String,
    val nickname: String,
    val email: String,
    val avatarUrl: String?,
    val role: String?,
)

fun UserDto.toUser(): User = User(
    publicId = publicId,
    username = username,
    nickname = nickname,
    email = email,
    avatarUrl = avatarUrl,
    role = role,
)

sealed interface AuthResult {
    data class Authenticated(val user: User) : AuthResult
    data object Unauthenticated : AuthResult
    data class Failed(val message: String) : AuthResult
}
```

- [ ] **Step 4: Implement auth repository**

First modify `android-native/app/src/main/java/online/lycoris/android/core/network/LycorisApi.kt`:

```kotlin
package online.lycoris.android.core.network

import online.lycoris.android.feature.auth.LoginRequest
import online.lycoris.android.feature.auth.RegisterRequest
import online.lycoris.android.feature.auth.UserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface LycorisApi {
    @POST("/api/login")
    suspend fun login(@Body body: LoginRequest): Response<ApiEnvelope<UserDto>>

    @POST("/api/register")
    suspend fun register(@Body body: RegisterRequest): Response<ApiEnvelope<UserDto>>

    @GET("/api/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("/api/logout")
    suspend fun logout(): Response<ApiEnvelope<Unit>>
}
```

Write `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthRepository.kt`:

```kotlin
package online.lycoris.android.feature.auth

import online.lycoris.android.core.network.LycorisApi

class AuthRepository(
    private val api: LycorisApi,
) {
    suspend fun login(username: String, password: String): AuthResult {
        val response = api.login(LoginRequest(username = username, password = password))
        if (!response.isSuccessful) return AuthResult.Failed("登录失败")
        val user = response.body()?.data ?: return AuthResult.Failed("登录响应为空")
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun register(request: RegisterRequest): AuthResult {
        val response = api.register(request)
        if (!response.isSuccessful) return AuthResult.Failed("注册失败")
        val user = response.body()?.data ?: return AuthResult.Failed("注册响应为空")
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun refreshMe(): AuthResult {
        val response = api.me()
        if (response.code() == 401) return AuthResult.Unauthenticated
        if (!response.isSuccessful) return AuthResult.Failed("获取登录状态失败")
        val user = response.body()?.data ?: return AuthResult.Unauthenticated
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun logout() {
        api.logout()
    }
}
```

- [ ] **Step 5: Implement auth view model**

Write `android-native/app/src/main/java/online/lycoris/android/feature/auth/AuthViewModel.kt`:

```kotlin
package online.lycoris.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val user: User? = null,
    val loading: Boolean = false,
    val message: String? = null,
) {
    val isLoggedIn: Boolean = user != null
}

class AuthViewModel(
    private val repository: AuthRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(AuthUiState(loading = true))
    val state: StateFlow<AuthUiState> = mutableState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            mutableState.value = when (val result = repository.refreshMe()) {
                is AuthResult.Authenticated -> AuthUiState(user = result.user)
                is AuthResult.Unauthenticated -> AuthUiState(user = null)
                is AuthResult.Failed -> AuthUiState(user = null, message = result.message)
            }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            mutableState.value = when (val result = repository.login(username, password)) {
                is AuthResult.Authenticated -> AuthUiState(user = result.user)
                is AuthResult.Unauthenticated -> AuthUiState(user = null)
                is AuthResult.Failed -> AuthUiState(user = null, message = result.message)
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            mutableState.value = AuthUiState(user = null)
        }
    }
}
```

- [ ] **Step 6: Implement login and register screens**

Write `android-native/app/src/main/java/online/lycoris/android/feature/auth/LoginScreen.kt`:

```kotlin
package online.lycoris.android.feature.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    state: AuthUiState,
    onLogin: (String, String) -> Unit,
    onOpenRegister: () -> Unit,
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
    ) {
        Text("登录 Lycoris")
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("用户名") },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("密码") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        Button(
            enabled = !state.loading,
            onClick = { onLogin(username.trim(), password) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.loading) "登录中" else "登录")
        }
        Button(onClick = onOpenRegister, modifier = Modifier.fillMaxWidth()) {
            Text("创建账号")
        }
        state.message?.let { Text(it) }
    }
}
```

Write `android-native/app/src/main/java/online/lycoris/android/feature/auth/RegisterScreen.kt`:

```kotlin
package online.lycoris.android.feature.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun RegisterScreen(
    loading: Boolean,
    message: String?,
    onRegister: (RegisterRequest) -> Unit,
) {
    var username by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
    ) {
        Text("创建 Lycoris 账号")
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(username, { username = it }, label = { Text("用户名") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(nickname, { nickname = it }, label = { Text("昵称") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text("邮箱") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("密码") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        Button(
            enabled = !loading,
            onClick = {
                onRegister(
                    RegisterRequest(
                        username = username.trim(),
                        nickname = nickname.trim(),
                        email = email.trim(),
                        password = password,
                    )
                )
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (loading) "注册中" else "注册")
        }
        message?.let { Text(it) }
    }
}
```

- [ ] **Step 7: Wire auth screens into the app shell**

Modify `android-native/app/src/main/java/online/lycoris/android/app/LycorisApp.kt` so `login` and `register` routes render `LoginScreen` and `RegisterScreen`. Create the `AuthRepository` from `NetworkModule.api(...)` in the app root for the first implementation pass, then move construction to a small app container in Task 10.

Use this exact construction inside `LycorisApp`:

```kotlin
val constants = remember { BuildConstants() }
val sessionStore = remember { InMemorySessionStore() }
val api = remember {
    NetworkModule.api(
        constants.apiBaseUrl,
        NetworkModule.okHttp(PersistentCookieJar(sessionStore)),
    )
}
val authViewModel = remember { AuthViewModel(AuthRepository(api)) }
```

- [ ] **Step 8: Run auth tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.auth.AuthRepositoryTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit auth flow**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):接入登录注册流程"
```

Expected: commit contains auth models, repository, view model, screens, and app route wiring.

---

### Task 5: Marker Models and Repository

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerModels.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerRepository.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/map/MarkerRepositoryTest.kt`

- [ ] **Step 1: Write marker repository tests**

Write `android-native/app/src/test/java/online/lycoris/android/feature/map/MarkerRepositoryTest.kt`:

```kotlin
package online.lycoris.android.feature.map

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.core.session.InMemorySessionStore
import online.lycoris.android.core.session.PersistentCookieJar
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class MarkerRepositoryTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loadsViewportMarkersWithCategoryQuery() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""[{"id":12,"lat":39.9,"lng":116.4,"category":"accessible_toilet","title":"A口","description":"","isPublic":true,"isActive":true}]""")
        )
        val api = NetworkModule.api(
            server.url("/").toString(),
            NetworkModule.okHttp(PersistentCookieJar(InMemorySessionStore())),
        )
        val repository = MarkerRepository(api)

        val markers = repository.loadViewport(
            bounds = ViewportBounds(39.0, 40.0, 116.0, 117.0),
            categories = listOf(MarkerCategory.AccessibleToilet),
        )

        assertEquals(1, markers.size)
        assertEquals("A口", markers.first().title)
        assertEquals("/api/markers/viewport?minLat=39.0&maxLat=40.0&minLng=116.0&maxLng=117.0&categories=accessible_toilet", server.takeRequest().path)
    }
}
```

- [ ] **Step 2: Run marker test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MarkerRepositoryTest
```

Expected: FAIL because marker classes do not exist.

- [ ] **Step 3: Implement marker models**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerModels.kt`:

```kotlin
package online.lycoris.android.feature.map

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class MarkerCategory(val wireName: String, val label: String) {
    @SerialName("accessible_toilet")
    AccessibleToilet("accessible_toilet", "无障碍卫生间"),

    @SerialName("friendly_clinic")
    FriendlyClinic("friendly_clinic", "友好医疗机构"),

    @SerialName("baby_room")
    BabyRoom("baby_room", "母婴室"),

    @SerialName("self_definition")
    SelfDefinition("self_definition", "自定义");

    companion object {
        fun fromWireName(value: String?): MarkerCategory {
            return entries.firstOrNull { it.wireName == value } ?: SelfDefinition
        }
    }
}

@Serializable
data class MarkerDto(
    val id: Long,
    val lat: Double,
    val lng: Double,
    val category: String,
    val title: String? = null,
    val description: String? = null,
    val isPublic: Boolean = true,
    val isActive: Boolean = true,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
    val markImage: String? = null,
    val username: String? = null,
    val userPublicId: String? = null,
)

data class Marker(
    val id: Long,
    val lat: Double,
    val lng: Double,
    val category: MarkerCategory,
    val title: String,
    val description: String,
    val isPublic: Boolean,
    val isActive: Boolean,
    val openTimeStart: String?,
    val openTimeEnd: String?,
    val markImage: String?,
    val username: String?,
    val userPublicId: String?,
)

fun MarkerDto.toMarker(): Marker = Marker(
    id = id,
    lat = lat,
    lng = lng,
    category = MarkerCategory.fromWireName(category),
    title = title?.takeIf { it.isNotBlank() } ?: "未命名点位",
    description = description.orEmpty(),
    isPublic = isPublic,
    isActive = isActive,
    openTimeStart = openTimeStart,
    openTimeEnd = openTimeEnd,
    markImage = markImage,
    username = username,
    userPublicId = userPublicId,
)

data class ViewportBounds(
    val minLat: Double,
    val maxLat: Double,
    val minLng: Double,
    val maxLng: Double,
)

@Serializable
data class MarkerCreateRequest(
    val lat: Double,
    val lng: Double,
    val category: String,
    val title: String,
    val description: String,
    val isPublic: Boolean,
    val openTimeStart: String,
    val openTimeEnd: String,
    val markImage: String? = null,
    val clientRequestId: String,
)

@Serializable
data class MarkerUpdateRequest(
    val category: String,
    val title: String,
    val description: String,
    val isPublic: Boolean,
    val openTimeStart: String,
    val openTimeEnd: String,
)
```

- [ ] **Step 4: Implement marker repository**

First modify `android-native/app/src/main/java/online/lycoris/android/core/network/LycorisApi.kt` to extend the auth API with marker endpoints:

```kotlin
package online.lycoris.android.core.network

import okhttp3.MultipartBody
import online.lycoris.android.feature.auth.LoginRequest
import online.lycoris.android.feature.auth.RegisterRequest
import online.lycoris.android.feature.auth.UserDto
import online.lycoris.android.feature.map.MarkerCreateRequest
import online.lycoris.android.feature.map.MarkerDto
import online.lycoris.android.feature.map.MarkerUpdateRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface LycorisApi {
    @POST("/api/login")
    suspend fun login(@Body body: LoginRequest): Response<ApiEnvelope<UserDto>>

    @POST("/api/register")
    suspend fun register(@Body body: RegisterRequest): Response<ApiEnvelope<UserDto>>

    @GET("/api/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("/api/logout")
    suspend fun logout(): Response<ApiEnvelope<Unit>>

    @GET("/api/markers/viewport")
    suspend fun markersInViewport(
        @Query("minLat") minLat: Double,
        @Query("maxLat") maxLat: Double,
        @Query("minLng") minLng: Double,
        @Query("maxLng") maxLng: Double,
        @Query("categories") categories: String,
    ): Response<List<MarkerDto>>

    @GET("/api/markers/nearby")
    suspend fun nearbyMarkers(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radius: Int,
        @Query("category") category: String,
    ): Response<List<MarkerDto>>

    @GET("/api/markers/search")
    suspend fun searchMarkers(@Query("keyword") keyword: String): Response<List<MarkerDto>>

    @GET("/api/markers/me/favorites")
    suspend fun favoriteIds(): Response<List<Long>>

    @POST("/api/markers")
    suspend fun createMarker(@Body body: MarkerCreateRequest): Response<MarkerDto>

    @PATCH("/api/markers/{id}")
    suspend fun updateMarker(
        @Path("id") id: Long,
        @Body body: MarkerUpdateRequest,
    ): Response<MarkerDto>

    @DELETE("/api/markers/{id}")
    suspend fun deleteMarker(@Path("id") id: Long): Response<Unit>

    @Multipart
    @POST("/api/markers/{id}/image")
    suspend fun uploadMarkerImage(
        @Path("id") id: Long,
        @Part file: MultipartBody.Part,
    ): Response<MarkerDto>

    @POST("/api/markers/{id}/favorite")
    suspend fun favoriteMarker(@Path("id") id: Long): Response<Unit>

    @DELETE("/api/markers/{id}/favorite")
    suspend fun unfavoriteMarker(@Path("id") id: Long): Response<Unit>

    @GET("/api/markers/me/created")
    suspend fun myCreatedMarkers(): Response<List<MarkerDto>>

    @GET("/api/markers/me/favorites/details")
    suspend fun myFavoriteMarkers(): Response<List<MarkerDto>>
}
```

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerRepository.kt`:

```kotlin
package online.lycoris.android.feature.map

import okhttp3.MultipartBody
import online.lycoris.android.core.network.LycorisApi

class MarkerRepository(
    private val api: LycorisApi,
) {
    suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> {
        val response = api.markersInViewport(
            minLat = bounds.minLat,
            maxLat = bounds.maxLat,
            minLng = bounds.minLng,
            maxLng = bounds.maxLng,
            categories = categories.joinToString(",") { it.wireName },
        )
        if (!response.isSuccessful) error("点位加载失败")
        return response.body().orEmpty().map { it.toMarker() }
    }

    suspend fun loadFavoriteIds(): Set<Long> {
        val response = api.favoriteIds()
        if (!response.isSuccessful) return emptySet()
        return response.body().orEmpty().toSet()
    }

    suspend fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ): List<Marker> {
        val response = api.nearbyMarkers(lat, lng, radius, category.wireName)
        if (!response.isSuccessful) error("附近点位查询失败")
        return response.body().orEmpty().map { it.toMarker() }
    }

    suspend fun createMarker(request: MarkerCreateRequest): Marker {
        val response = api.createMarker(request)
        if (!response.isSuccessful) error("点位提交失败")
        return requireNotNull(response.body()).toMarker()
    }

    suspend fun updateMarker(id: Long, request: MarkerUpdateRequest): Marker {
        val response = api.updateMarker(id, request)
        if (!response.isSuccessful) error("点位编辑提交失败")
        return requireNotNull(response.body()).toMarker()
    }

    suspend fun deleteMarker(id: Long) {
        val response = api.deleteMarker(id)
        if (!response.isSuccessful) error("点位删除失败")
    }

    suspend fun uploadMarkerImage(id: Long, part: MultipartBody.Part): Marker {
        val response = api.uploadMarkerImage(id, part)
        if (!response.isSuccessful) error("图片上传失败")
        return requireNotNull(response.body()).toMarker()
    }

    suspend fun setFavorite(id: Long, favorite: Boolean) {
        val response = if (favorite) api.favoriteMarker(id) else api.unfavoriteMarker(id)
        if (!response.isSuccessful) error("收藏操作失败")
    }

    suspend fun myCreated(): List<Marker> = api.myCreatedMarkers().body().orEmpty().map { it.toMarker() }

    suspend fun myFavorites(): List<Marker> = api.myFavoriteMarkers().body().orEmpty().map { it.toMarker() }
}
```

- [ ] **Step 5: Run marker tests**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MarkerRepositoryTest
```

Expected: tests pass.

- [ ] **Step 6: Commit marker repository**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):添加点位数据仓库"
```

Expected: commit contains marker models and repository.

---

### Task 6: Map State, Viewport, and OSM Map Shell

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapContracts.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapViewModel.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/OsmMapView.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapScreen.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/core/location/LocationProvider.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/map/MapContractsTest.kt`

- [ ] **Step 1: Write map contracts tests**

Write `android-native/app/src/test/java/online/lycoris/android/feature/map/MapContractsTest.kt`:

```kotlin
package online.lycoris.android.feature.map

import org.junit.Assert.assertEquals
import org.junit.Test

class MapContractsTest {
    @Test
    fun markerUiColorMatchesCategory() {
        assertEquals(0xFF1E88E5.toInt(), MarkerPin.AccessibleToilet.argb)
        assertEquals(0xFF43A047.toInt(), MarkerPin.FriendlyClinic.argb)
        assertEquals(0xFFFB8C00.toInt(), MarkerPin.BabyRoom.argb)
        assertEquals(0xFFF0BF2F.toInt(), MarkerPin.SelfDefinition.argb)
    }

    @Test
    fun nearbyRadiusIsClampedToWebRange() {
        assertEquals(0, NearbyRadius.fromInput("-2").value)
        assertEquals(10000, NearbyRadius.fromInput("50000").value)
        assertEquals(1000, NearbyRadius.fromInput("abc").value)
    }
}
```

- [ ] **Step 2: Run contracts test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MapContractsTest
```

Expected: FAIL because map contracts do not exist.

- [ ] **Step 3: Implement map contracts**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MapContracts.kt`:

```kotlin
package online.lycoris.android.feature.map

enum class MarkerPin(val argb: Int) {
    AccessibleToilet(0xFF1E88E5.toInt()),
    FriendlyClinic(0xFF43A047.toInt()),
    BabyRoom(0xFFFB8C00.toInt()),
    SelfDefinition(0xFFF0BF2F.toInt()),
    Inactive(0xFF9E9E9E.toInt());

    companion object {
        fun from(marker: Marker): MarkerPin {
            if (!marker.isActive) return Inactive
            return when (marker.category) {
                MarkerCategory.AccessibleToilet -> AccessibleToilet
                MarkerCategory.FriendlyClinic -> FriendlyClinic
                MarkerCategory.BabyRoom -> BabyRoom
                MarkerCategory.SelfDefinition -> SelfDefinition
            }
        }
    }
}

data class NearbyRadius(val value: Int) {
    companion object {
        fun fromInput(input: String): NearbyRadius {
            val parsed = input.trim().toIntOrNull() ?: 1000
            return NearbyRadius(parsed.coerceIn(0, 10000))
        }
    }
}

data class MapUiState(
    val loading: Boolean = false,
    val markers: List<Marker> = emptyList(),
    val favoriteIds: Set<Long> = emptySet(),
    val selectedMarkerId: Long? = null,
    val visibleCategories: Set<MarkerCategory> = MarkerCategory.entries.toSet(),
    val ownerFilter: OwnerFilter = OwnerFilter.All,
    val message: String? = null,
)

enum class OwnerFilter {
    All,
    Mine,
    Favorites,
}
```

- [ ] **Step 4: Implement location provider contract**

Write `android-native/app/src/main/java/online/lycoris/android/core/location/LocationProvider.kt`:

```kotlin
package online.lycoris.android.core.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class LycorisLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float?,
)

interface LocationProvider {
    suspend fun currentLocation(): LycorisLocation?
}

class AndroidLocationProvider(
    private val context: Context,
) : LocationProvider {
    override suspend fun currentLocation(): LycorisLocation? {
        val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) return null

        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        val lastKnown = providers.mapNotNull { provider ->
            runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
        }.maxByOrNull { it.time }

        return lastKnown?.toLycorisLocation()
    }
}

private fun Location.toLycorisLocation(): LycorisLocation {
    return LycorisLocation(
        latitude = latitude,
        longitude = longitude,
        accuracyMeters = accuracy,
    )
}
```

- [ ] **Step 5: Implement map view model**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MapViewModel.kt`:

```kotlin
package online.lycoris.android.feature.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MapViewModel(
    private val repository: MarkerRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(MapUiState())
    val state: StateFlow<MapUiState> = mutableState.asStateFlow()

    fun loadViewport(bounds: ViewportBounds) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, message = null)
            runCatching {
                repository.loadViewport(bounds, mutableState.value.visibleCategories.toList())
            }.onSuccess { markers ->
                mutableState.value = mutableState.value.copy(loading = false, markers = markers)
            }.onFailure { error ->
                mutableState.value = mutableState.value.copy(loading = false, message = error.message ?: "点位加载失败")
            }
        }
    }

    fun selectMarker(id: Long?) {
        mutableState.value = mutableState.value.copy(selectedMarkerId = id)
    }

    fun toggleCategory(category: MarkerCategory) {
        val next = mutableState.value.visibleCategories.toMutableSet()
        if (!next.add(category)) next.remove(category)
        mutableState.value = mutableState.value.copy(visibleCategories = next)
    }
}
```

- [ ] **Step 6: Implement OSM map wrapper**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/OsmMapView.kt`:

```kotlin
package online.lycoris.android.feature.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker as OsmMarker

@Composable
fun OsmMapView(
    markers: List<Marker>,
    modifier: Modifier = Modifier,
    onMarkerClick: (Long) -> Unit,
) {
    val startPoint = remember { GeoPoint(39.9042, 116.4074) }
    AndroidView(
        modifier = modifier,
        factory = { context ->
            Configuration.getInstance().userAgentValue = context.packageName
            MapView(context).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(true)
                controller.setZoom(11.0)
                controller.setCenter(startPoint)
            }
        },
        update = { mapView ->
            mapView.overlays.removeAll { it is OsmMarker }
            markers.forEach { marker ->
                val overlay = OsmMarker(mapView).apply {
                    position = GeoPoint(marker.lat, marker.lng)
                    title = marker.title
                    setOnMarkerClickListener { _, _ ->
                        onMarkerClick(marker.id)
                        true
                    }
                }
                mapView.overlays.add(overlay)
            }
            mapView.invalidate()
        },
    )

    DisposableEffect(Unit) {
        onDispose { }
    }
}
```

- [ ] **Step 7: Implement map screen**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MapScreen.kt`:

```kotlin
package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun MapScreen(
    state: MapUiState,
    onMarkerClick: (Long) -> Unit,
    onAddClick: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        OsmMapView(
            markers = state.markers,
            modifier = Modifier.fillMaxSize(),
            onMarkerClick = onMarkerClick,
        )
        FloatingActionButton(
            onClick = onAddClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
        ) {
            Text("+")
        }
        if (state.loading) {
            CircularProgressIndicator(Modifier.align(Alignment.Center))
        }
        state.message?.let {
            Text(
                text = it,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(12.dp),
            )
        }
    }
}
```

- [ ] **Step 8: Run tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MapContractsTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit map shell**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):接入OSM地图骨架"
```

Expected: commit contains map state, osmdroid wrapper, and map screen.

---

### Task 7: Marker Details, Favorite Actions, and Nearby Search

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerDetailSheet.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapViewModel.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapScreen.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/map/MapContractsTest.kt`

- [ ] **Step 1: Extend map contracts test for selected marker lookup**

Append to `MapContractsTest.kt`:

```kotlin
@Test
fun selectedMarkerLookupReturnsMatchingMarker() {
    val marker = Marker(
        id = 7,
        lat = 1.0,
        lng = 2.0,
        category = MarkerCategory.AccessibleToilet,
        title = "测试点位",
        description = "",
        isPublic = true,
        isActive = true,
        openTimeStart = null,
        openTimeEnd = null,
        markImage = null,
        username = "nora",
        userPublicId = "u1",
    )
    val state = MapUiState(markers = listOf(marker), selectedMarkerId = 7)

    assertEquals(marker, state.selectedMarker)
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MapContractsTest
```

Expected: FAIL because `selectedMarker` does not exist.

- [ ] **Step 3: Add selected marker helper**

Modify `MapContracts.kt`:

```kotlin
val MapUiState.selectedMarker: Marker?
    get() = markers.firstOrNull { it.id == selectedMarkerId }
```

- [ ] **Step 4: Implement marker detail sheet**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerDetailSheet.kt`:

```kotlin
package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun MarkerDetailSheet(
    marker: Marker,
    isFavorite: Boolean,
    onDismiss: () -> Unit,
    onToggleFavorite: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
        ) {
            Text(marker.title)
            Spacer(Modifier.height(6.dp))
            Text(marker.category.label)
            if (marker.description.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Text(marker.description)
            }
            Spacer(Modifier.height(14.dp))
            Row {
                Button(onClick = onToggleFavorite) {
                    Text(if (isFavorite) "取消收藏" else "收藏")
                }
            }
        }
    }
}
```

- [ ] **Step 5: Add favorite and nearby actions to view model**

Add to `MapViewModel.kt`:

```kotlin
fun loadFavorites() {
    viewModelScope.launch {
        val ids = repository.loadFavoriteIds()
        mutableState.value = mutableState.value.copy(favoriteIds = ids)
    }
}

fun toggleFavorite(markerId: Long) {
    viewModelScope.launch {
        val currentlyFavorite = markerId in mutableState.value.favoriteIds
        runCatching {
            repository.setFavorite(markerId, !currentlyFavorite)
            repository.loadFavoriteIds()
        }.onSuccess { ids ->
            mutableState.value = mutableState.value.copy(favoriteIds = ids)
        }.onFailure { error ->
            mutableState.value = mutableState.value.copy(message = error.message ?: "收藏操作失败")
        }
    }
}

fun loadNearby(lat: Double, lng: Double, radius: NearbyRadius, category: MarkerCategory) {
    viewModelScope.launch {
        mutableState.value = mutableState.value.copy(loading = true, message = null)
        runCatching {
            repository.loadNearby(lat, lng, radius.value, category)
        }.onSuccess { nearby ->
            val merged = (mutableState.value.markers + nearby).associateBy { it.id }.values.toList()
            mutableState.value = mutableState.value.copy(loading = false, markers = merged)
        }.onFailure { error ->
            mutableState.value = mutableState.value.copy(loading = false, message = error.message ?: "附近点位查询失败")
        }
    }
}
```

- [ ] **Step 6: Show details from map screen**

Modify `MapScreen.kt` so the root `Box` includes:

```kotlin
val selected = state.selectedMarker
if (selected != null) {
    MarkerDetailSheet(
        marker = selected,
        isFavorite = selected.id in state.favoriteIds,
        onDismiss = { onMarkerClick(0L) },
        onToggleFavorite = { },
    )
}
```

Then change the `MapScreen` function signature so dismiss and favorite are explicit:

```kotlin
fun MapScreen(
    state: MapUiState,
    onMarkerClick: (Long) -> Unit,
    onDismissMarker: () -> Unit,
    onToggleFavorite: (Long) -> Unit,
    onAddClick: () -> Unit,
)
```

Use `onDismissMarker` and `onToggleFavorite(selected.id)` in `MarkerDetailSheet`.

- [ ] **Step 7: Run tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MapContractsTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit map interactions**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):添加点位详情和收藏"
```

Expected: commit contains detail sheet and favorite/nearby view model actions.

---

### Task 8: Marker Create, Edit, Delete, and Image Upload

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/core/image/ImagePicker.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerEditorSheet.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerSubmitCoordinator.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/feature/map/MapViewModel.kt`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/map/MarkerSubmitCoordinatorTest.kt`

- [ ] **Step 1: Write marker submit coordinator tests**

Write `android-native/app/src/test/java/online/lycoris/android/feature/map/MarkerSubmitCoordinatorTest.kt`:

```kotlin
package online.lycoris.android.feature.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerSubmitCoordinatorTest {
    @Test
    fun createsStableClientRequestIdForDraft() {
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        assertEquals("draft-1", coordinator.newClientRequestId())
    }

    @Test
    fun partialImageFailureKeepsCreatedMarker() {
        val marker = Marker(
            id = 1,
            lat = 39.0,
            lng = 116.0,
            category = MarkerCategory.AccessibleToilet,
            title = "A口",
            description = "",
            isPublic = true,
            isActive = true,
            openTimeStart = null,
            openTimeEnd = null,
            markImage = null,
            username = "nora",
            userPublicId = "u1",
        )

        val result = MarkerSubmitResult.PartialImageFailure(marker, "图片上传失败")

        assertEquals(marker, result.marker)
        assertTrue(result.message.contains("图片"))
    }
}
```

- [ ] **Step 2: Run submit coordinator tests and verify they fail**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MarkerSubmitCoordinatorTest
```

Expected: FAIL because submit coordinator classes do not exist.

- [ ] **Step 3: Implement image picker contract**

Write `android-native/app/src/main/java/online/lycoris/android/core/image/ImagePicker.kt`:

```kotlin
package online.lycoris.android.core.image

import android.net.Uri

data class LocalImage(
    val uri: Uri,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
)

object ImageRules {
    const val MaxUploadBytes: Long = 5L * 1024L * 1024L

    fun canUpload(image: LocalImage): Boolean {
        return image.sizeBytes in 1..MaxUploadBytes && image.mimeType.startsWith("image/")
    }
}
```

- [ ] **Step 4: Implement submit coordinator**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerSubmitCoordinator.kt`:

```kotlin
package online.lycoris.android.feature.map

import java.util.UUID

class MarkerSubmitCoordinator(
    private val idFactory: () -> String = { UUID.randomUUID().toString() },
) {
    fun newClientRequestId(): String = idFactory()
}

sealed interface MarkerSubmitResult {
    data class Success(val marker: Marker) : MarkerSubmitResult
    data class PartialImageFailure(val marker: Marker, val message: String) : MarkerSubmitResult
    data class Failure(val message: String) : MarkerSubmitResult
}
```

- [ ] **Step 5: Implement marker editor sheet**

Write `android-native/app/src/main/java/online/lycoris/android/feature/map/MarkerEditorSheet.kt`:

```kotlin
package online.lycoris.android.feature.map

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class MarkerDraft(
    val lat: Double,
    val lng: Double,
    val category: MarkerCategory,
    val title: String,
    val description: String,
    val isPublic: Boolean,
    val openTimeStart: String,
    val openTimeEnd: String,
    val clientRequestId: String,
)

@Composable
fun MarkerEditorSheet(
    lat: Double,
    lng: Double,
    clientRequestId: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (MarkerDraft) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(true) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
        ) {
            Text("新增点位")
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(title, { title = it }, label = { Text("标题") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(description, { description = it }, label = { Text("描述") }, modifier = Modifier.fillMaxWidth())
            Text("公开显示")
            Switch(checked = isPublic, onCheckedChange = { isPublic = it })
            Button(
                enabled = !saving && title.trim().isNotBlank(),
                onClick = {
                    onSubmit(
                        MarkerDraft(
                            lat = lat,
                            lng = lng,
                            category = MarkerCategory.AccessibleToilet,
                            title = title.trim(),
                            description = description.trim(),
                            isPublic = isPublic,
                            openTimeStart = "",
                            openTimeEnd = "",
                            clientRequestId = clientRequestId,
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (saving) "提交中" else "提交审核")
            }
        }
    }
}
```

- [ ] **Step 6: Add create/edit/delete actions to view model**

Add to `MapViewModel.kt`:

```kotlin
fun createMarker(draft: MarkerDraft) {
    viewModelScope.launch {
        mutableState.value = mutableState.value.copy(loading = true, message = null)
        val request = MarkerCreateRequest(
            lat = draft.lat,
            lng = draft.lng,
            category = draft.category.wireName,
            title = draft.title,
            description = draft.description,
            isPublic = draft.isPublic,
            openTimeStart = draft.openTimeStart,
            openTimeEnd = draft.openTimeEnd,
            markImage = null,
            clientRequestId = draft.clientRequestId,
        )
        runCatching { repository.createMarker(request) }
            .onSuccess { marker ->
                val merged = (listOf(marker) + mutableState.value.markers).associateBy { it.id }.values.toList()
                mutableState.value = mutableState.value.copy(loading = false, markers = merged, selectedMarkerId = marker.id, message = "已提交管理员审核")
            }
            .onFailure { error ->
                mutableState.value = mutableState.value.copy(loading = false, message = error.message ?: "点位提交失败")
            }
    }
}

fun deleteMarker(id: Long) {
    viewModelScope.launch {
        runCatching { repository.deleteMarker(id) }
            .onSuccess {
                mutableState.value = mutableState.value.copy(
                    markers = mutableState.value.markers.filterNot { it.id == id },
                    selectedMarkerId = null,
                    message = "点位已删除",
                )
            }
            .onFailure { error ->
                mutableState.value = mutableState.value.copy(message = error.message ?: "点位删除失败")
            }
    }
}
```

- [ ] **Step 7: Run tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.map.MarkerSubmitCoordinatorTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit marker editing**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):添加点位提交流程"
```

Expected: commit contains marker editor and submit coordinator.

---

### Task 9: Profile, Search, and Documents

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/feature/profile/ProfileRepository.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/profile/ProfileScreen.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/search/SearchRepository.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/search/SearchScreen.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/documents/DocumentRepository.kt`
- Create: `android-native/app/src/main/java/online/lycoris/android/feature/documents/DocumentsScreen.kt`
- Create: `android-native/app/src/main/assets/docs/about.md`
- Create: `android-native/app/src/main/assets/docs/nora-hrt-guide.md`
- Create: `android-native/app/src/main/assets/doc_images/...`
- Test: `android-native/app/src/test/java/online/lycoris/android/feature/documents/DocumentRepositoryTest.kt`

- [ ] **Step 1: Copy markdown and document images from the Web frontend**

Run from repo root:

```powershell
New-Item -ItemType Directory -Force .\android-native\app\src\main\assets\docs
New-Item -ItemType Directory -Force .\android-native\app\src\main\assets\doc_images
Copy-Item .\frontend\src\docs\about.md .\android-native\app\src\main\assets\docs\about.md
Copy-Item .\frontend\src\docs\nora-hrt-guide.md .\android-native\app\src\main\assets\docs\nora-hrt-guide.md
Copy-Item .\frontend\src\doc_images\* .\android-native\app\src\main\assets\doc_images\ -Recurse
```

Expected: Android assets contain the same docs and images as the Web frontend.

- [ ] **Step 2: Write document repository test**

Write `android-native/app/src/test/java/online/lycoris/android/feature/documents/DocumentRepositoryTest.kt`:

```kotlin
package online.lycoris.android.feature.documents

import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentRepositoryTest {
    @Test
    fun exposesDefaultDocumentOrder() {
        val repository = DocumentRepository()

        assertEquals(listOf("about", "nora-hrt-guide"), repository.documents.map { it.slug })
    }
}
```

- [ ] **Step 3: Run document test and verify it fails**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.documents.DocumentRepositoryTest
```

Expected: FAIL because document classes do not exist.

- [ ] **Step 4: Implement document repository**

Write `android-native/app/src/main/java/online/lycoris/android/feature/documents/DocumentRepository.kt`:

```kotlin
package online.lycoris.android.feature.documents

data class DocumentEntry(
    val slug: String,
    val title: String,
    val assetPath: String,
)

class DocumentRepository {
    val documents: List<DocumentEntry> = listOf(
        DocumentEntry("about", "关于 Lycoris", "docs/about.md"),
        DocumentEntry("nora-hrt-guide", "HRT 指南", "docs/nora-hrt-guide.md"),
    )

    fun find(slug: String): DocumentEntry {
        return documents.firstOrNull { it.slug == slug } ?: documents.first()
    }
}
```

- [ ] **Step 5: Implement document screen**

Write `android-native/app/src/main/java/online/lycoris/android/feature/documents/DocumentsScreen.kt`:

```kotlin
package online.lycoris.android.feature.documents

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DocumentsScreen(
    repository: DocumentRepository = DocumentRepository(),
) {
    var active by remember { mutableStateOf(repository.documents.first()) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        LazyColumn {
            items(repository.documents) { document ->
                Button(onClick = { active = document }) {
                    Text(document.title)
                }
            }
            item {
                Text(
                    text = "文档资源：${active.assetPath}",
                    modifier = Modifier.padding(top = 18.dp),
                )
            }
        }
    }
}
```

- [ ] **Step 6: Implement profile repository and screen**

Write `android-native/app/src/main/java/online/lycoris/android/feature/profile/ProfileRepository.kt`:

```kotlin
package online.lycoris.android.feature.profile

import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.MarkerRepository

class ProfileRepository(
    private val markerRepository: MarkerRepository,
) {
    suspend fun createdMarkers(): List<Marker> = markerRepository.myCreated()
    suspend fun favoriteMarkers(): List<Marker> = markerRepository.myFavorites()
}
```

Write `android-native/app/src/main/java/online/lycoris/android/feature/profile/ProfileScreen.kt`:

```kotlin
package online.lycoris.android.feature.profile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import online.lycoris.android.feature.auth.AuthUiState

@Composable
fun ProfileScreen(
    authState: AuthUiState,
    onOpenLogin: () -> Unit,
    onLogout: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(18.dp)) {
        val user = authState.user
        if (user == null) {
            Text("登录后可以管理资料、点位和收藏。")
            Button(onClick = onOpenLogin) {
                Text("登录")
            }
        } else {
            Text(user.nickname)
            Text(user.email)
            Button(onClick = onLogout) {
                Text("退出登录")
            }
        }
    }
}
```

- [ ] **Step 7: Implement search repository and screen**

Write `android-native/app/src/main/java/online/lycoris/android/feature/search/SearchRepository.kt`:

```kotlin
package online.lycoris.android.feature.search

import online.lycoris.android.core.network.LycorisApi
import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.toMarker

class SearchRepository(
    private val api: LycorisApi,
) {
    suspend fun search(keyword: String): List<Marker> {
        if (keyword.isBlank()) return emptyList()
        val response = api.searchMarkers(keyword.trim())
        if (!response.isSuccessful) error("搜索失败")
        return response.body().orEmpty().map { it.toMarker() }
    }
}
```

Write `android-native/app/src/main/java/online/lycoris/android/feature/search/SearchScreen.kt`:

```kotlin
package online.lycoris.android.feature.search

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SearchScreen(
    onSearch: (String) -> Unit,
) {
    var keyword by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().padding(18.dp)) {
        OutlinedTextField(
            value = keyword,
            onValueChange = { keyword = it },
            label = { Text("搜索点位或文档") },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(onClick = { onSearch(keyword) }) {
            Text("搜索")
        }
    }
}
```

- [ ] **Step 8: Run document test and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests online.lycoris.android.feature.documents.DocumentRepositoryTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit profile search documents**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):迁移我的搜索和文档入口"
```

Expected: commit contains profile, search, document files, and copied assets.

---

### Task 10: App Container and End-to-End Wiring

**Files:**

- Create: `android-native/app/src/main/java/online/lycoris/android/app/LycorisAppContainer.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/app/LycorisApp.kt`
- Modify: `android-native/app/src/main/java/online/lycoris/android/MainActivity.kt`

- [ ] **Step 1: Create app container**

Write `android-native/app/src/main/java/online/lycoris/android/app/LycorisAppContainer.kt`:

```kotlin
package online.lycoris.android.app

import android.content.Context
import online.lycoris.android.core.config.BuildConstants
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.core.session.InMemorySessionStore
import online.lycoris.android.core.session.PersistentCookieJar
import online.lycoris.android.feature.auth.AuthRepository
import online.lycoris.android.feature.map.MarkerRepository
import online.lycoris.android.feature.search.SearchRepository

class LycorisAppContainer(
    context: Context,
) {
    private val constants = BuildConstants()
    private val sessionStore = InMemorySessionStore()
    private val cookieJar = PersistentCookieJar(sessionStore)
    private val client = NetworkModule.okHttp(cookieJar)
    val api = NetworkModule.api(constants.apiBaseUrl, client)

    val authRepository = AuthRepository(api)
    val markerRepository = MarkerRepository(api)
    val searchRepository = SearchRepository(api)

    init {
        context.applicationContext
    }
}
```

- [ ] **Step 2: Pass app container from MainActivity**

Modify `MainActivity.kt`:

```kotlin
package online.lycoris.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import online.lycoris.android.app.LycorisApp
import online.lycoris.android.app.LycorisAppContainer

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = LycorisAppContainer(applicationContext)
        setContent {
            LycorisApp(container = container)
        }
    }
}
```

- [ ] **Step 3: Wire real screens into navigation**

Modify `LycorisApp.kt` so it accepts:

```kotlin
@Composable
fun LycorisApp(container: LycorisAppContainer)
```

Inside the function, construct view models:

```kotlin
val authViewModel = remember { AuthViewModel(container.authRepository) }
val mapViewModel = remember { MapViewModel(container.markerRepository) }
```

Replace route bodies:

```kotlin
composable(LycorisDestination.Map.route) {
    val state by mapViewModel.state.collectAsState()
    MapScreen(
        state = state,
        onMarkerClick = { id -> mapViewModel.selectMarker(id) },
        onDismissMarker = { mapViewModel.selectMarker(null) },
        onToggleFavorite = { id -> mapViewModel.toggleFavorite(id) },
        onAddClick = { },
    )
}
composable(LycorisDestination.Search.route) {
    SearchScreen(onSearch = { })
}
composable(LycorisDestination.Documents.route) {
    DocumentsScreen()
}
composable(LycorisDestination.Profile.route) {
    val authState by authViewModel.state.collectAsState()
    ProfileScreen(
        authState = authState,
        onOpenLogin = { navController.navigate(LycorisDestination.Login.route) },
        onLogout = { authViewModel.logout() },
    )
}
composable(LycorisDestination.Login.route) {
    val authState by authViewModel.state.collectAsState()
    LoginScreen(
        state = authState,
        onLogin = authViewModel::login,
        onOpenRegister = { navController.navigate(LycorisDestination.Register.route) },
    )
}
composable(LycorisDestination.Register.route) {
    val authState by authViewModel.state.collectAsState()
    RegisterScreen(
        loading = authState.loading,
        message = authState.message,
        onRegister = { request -> authViewModel.register(request) },
    )
}
```

Add `register` to `AuthViewModel`:

```kotlin
fun register(request: RegisterRequest) {
    viewModelScope.launch {
        mutableState.value = mutableState.value.copy(loading = true, message = null)
        mutableState.value = when (val result = repository.register(request)) {
            is AuthResult.Authenticated -> AuthUiState(user = result.user)
            is AuthResult.Unauthenticated -> AuthUiState(user = null)
            is AuthResult.Failed -> AuthUiState(user = null, message = result.message)
        }
    }
}
```

- [ ] **Step 4: Run all unit tests and assemble**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 5: Verify no backend files are staged**

Run:

```powershell
git diff --name-only --staged
```

Expected: no path starts with `backend/`.

- [ ] **Step 6: Commit app wiring**

Run:

```powershell
git add .\android-native
git commit -m "feat(android):串联原生客户端主流程"
```

Expected: commit contains app container and route wiring.

---

### Task 11: Manual MVP Verification

**Files:**

- Modify only if verification finds a defect inside `android-native/`.

- [ ] **Step 1: Start the backend**

Use the existing backend run method from `backend/`. If using Maven locally:

```powershell
cd C:\Users\Nora\lycoris\backend
.\mvnw.cmd spring-boot:run
```

Expected: backend listens on `http://localhost:8080`.

- [ ] **Step 2: Build the Android debug APK**

Run:

```powershell
cd C:\Users\Nora\lycoris\android-native
.\gradlew.bat :app:assembleDebug
```

Expected: `android-native/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 3: Run automated verification**

Run:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
```

Expected: both commands exit 0.

- [ ] **Step 4: Install on emulator**

Run:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Expected: install succeeds.

- [ ] **Step 5: Manually verify core flows**

Open the app and check:

```text
1. App launches to the map tab.
2. OSM map tiles render.
3. Bottom navigation switches between 地图 / 搜索 / 文档 / 我的.
4. Login screen accepts an existing account.
5. /api/me refresh keeps the user logged in after app restart.
6. Map can load backend markers in the visible region.
7. Tapping a marker opens the detail sheet.
8. Favorite toggle sends the expected backend request.
9. Add marker flow sends clientRequestId with POST /api/markers.
10. Image upload failure shows partial-success messaging and does not create duplicate text markers.
11. Search screen sends /api/markers/search.
12. Documents screen shows packaged document entries.
13. Profile screen shows user information and logout.
```

- [ ] **Step 6: Capture any defects as focused follow-up commits**

If Step 5 finds a map interaction defect, fix only `android-native/`, rerun Step 3, then commit:

```powershell
git status --short
git add .\android-native
git commit -m "fix(android):修复地图交互问题"
```

If Step 5 finds an auth/session defect, fix only `android-native/`, rerun Step 3, then commit:

```powershell
git status --short
git add .\android-native
git commit -m "fix(android):修复登录状态刷新"
```

If Step 5 finds a document asset defect, fix only `android-native/`, rerun Step 3, then commit:

```powershell
git status --short
git add .\android-native
git commit -m "fix(android):修复文档资源路径"
```

- [ ] **Step 7: Final staged-file check**

Run:

```powershell
git status --short
git diff --name-only --staged
```

Expected: no staged backend files; unrelated pre-existing dirty files remain unstaged.

---

## Self-Review

Spec coverage:

- New native Android project is covered by Task 1.
- Web-matched style is covered by Task 2.
- Backend unchanged and API-only integration is covered by Tasks 3, 4, 5, 9, and 10.
- OSM-first map MVP is covered by Tasks 6 and 7.
- Marker create, `clientRequestId`, and image partial failure are covered by Task 8.
- Profile, search, and documents are covered by Task 9.
- Verification is covered by Task 11.

Placeholder scan:

- No task depends on unspecified backend changes.
- No task asks the implementer to fill an unnamed detail.
- Every new file has an explicit path and concrete starter content.

Type consistency:

- `MarkerDto`, `Marker`, `MarkerCategory`, `ViewportBounds`, `MarkerCreateRequest`, and `MarkerUpdateRequest` are introduced before repositories use them.
- `AuthRepository`, `AuthViewModel`, `LoginScreen`, and `RegisterScreen` share the same `AuthResult`, `AuthUiState`, and request types.
- `LycorisAppContainer` wires the same repository types used by feature screens.
