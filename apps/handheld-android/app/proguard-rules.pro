# Moshi reads Kotlin metadata for API models.
-keepclasseswithmembers,includedescriptorclasses class * {
    @com.squareup.moshi.* <methods>;
}

# Retrofit service interfaces are consumed through reflection.
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keep,allowoptimization interface com.logistics.handheld.core.network.HandheldApi

# The current mobile-v1 DTOs use Moshi's reflective Kotlin adapter.
-keep class com.logistics.handheld.core.network.*Dto { *; }
-keep class com.logistics.handheld.core.network.*Request { *; }
-keep class com.logistics.handheld.core.network.ApiEnvelope { *; }
