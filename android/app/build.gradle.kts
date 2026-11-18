import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    // The Kotlin source package keeps its inherited name; only the installed
    // application id is Sidenib-specific so the APK can sit beside Todobar.
    namespace = "dev.todobar.mobile"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.github.adiengelbrecht.sidenib.mobile"
        minSdk = 26
        targetSdk = 34
        versionCode = 15
        versionName = "0.2.0"
        resourceConfigurations += listOf("en")
    }

    signingConfigs {
        // Release builds are signed with a keystore generated in CI so that the
        // produced APK is installable from a GitHub release without further
        // ceremony. The keystore credentials are injected via env vars.
        create("release") {
            val keystorePath = System.getenv("SIDENIB_KEYSTORE_PATH")
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("SIDENIB_KEYSTORE_PASSWORD") ?: "sidenib"
                keyAlias = System.getenv("SIDENIB_KEY_ALIAS") ?: "sidenib"
                keyPassword = System.getenv("SIDENIB_KEY_PASSWORD") ?: "sidenib"
            }
        }
    }

    buildTypes {
        getByName("debug") {
            isMinifyEnabled = false
        }
        getByName("release") {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val keystorePath = System.getenv("SIDENIB_KEYSTORE_PATH")
            if (keystorePath != null) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                // Fall back to the debug signing config so that local
                // `assembleRelease` runs still produce an installable APK.
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets["main"].kotlin.srcDirs("src/main/kotlin")

    packaging {
        resources {
            excludes += listOf(
                "META-INF/AL2.0",
                "META-INF/LGPL2.1",
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
