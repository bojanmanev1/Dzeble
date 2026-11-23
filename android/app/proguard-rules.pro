# ProGuard / R8 optimization and obfuscation rules for Dzeble

# 1. Preserve Line Numbers & Attributes for Play Console crash reports
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# 2. Capacitor Core & Bridge reflection
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

# 3. WebView JavaScript Interface (Critical for Capacitor JS Bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 4. Social Login plugin
-keep class ee.forgr.capacitor.social.login.** { *; }
-dontwarn ee.forgr.capacitor.social.login.**

# 5. Firebase & Google Play Services (Push notifications & Auth)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# 6. ML Kit Barcode Scanning
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# 7. Cordova plugins compatibility
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**
