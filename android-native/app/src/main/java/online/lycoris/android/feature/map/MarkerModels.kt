package online.lycoris.android.feature.map

import kotlinx.serialization.Serializable

enum class MarkerCategory(
    val wireName: String,
    val label: String,
) {
    AccessibleToilet("accessible_toilet", "无障碍卫生间"),
    FriendlyClinic("friendly_clinic", "友好医疗机构"),
    BabyRoom("baby_room", "母婴室"),
    SelfDefinition("self_definition", "自定义"),
    ;

    companion object {
        fun fromWireName(wireName: String?): MarkerCategory {
            return entries.firstOrNull { it.wireName == wireName } ?: SelfDefinition
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
    val username: String? = null,
    val userPublicId: String? = null,
    val clientRequestId: String? = null,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
    val reviewStatus: String? = null,
    val markImage: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
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
    val username: String? = null,
    val userPublicId: String? = null,
    val clientRequestId: String? = null,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
    val reviewStatus: String? = null,
    val markImage: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
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
    username = username,
    userPublicId = userPublicId,
    clientRequestId = clientRequestId,
    openTimeStart = openTimeStart,
    openTimeEnd = openTimeEnd,
    reviewStatus = reviewStatus,
    markImage = markImage,
    createdAt = createdAt,
    updatedAt = updatedAt,
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
    val description: String = "",
    val isPublic: Boolean = true,
    val isActive: Boolean = true,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
    val clientRequestId: String? = null,
    val markImage: String? = null,
)

@Serializable
data class MarkerUpdateRequest(
    val category: String? = null,
    val title: String? = null,
    val description: String? = null,
    val isPublic: Boolean? = null,
    val isActive: Boolean? = null,
    val openTimeStart: String? = null,
    val openTimeEnd: String? = null,
)
