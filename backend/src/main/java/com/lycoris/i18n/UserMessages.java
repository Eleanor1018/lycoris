package com.lycoris.i18n;

import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;

import java.text.MessageFormat;
import java.util.List;
import java.util.Locale;

/**
 * Central catalog for text that can be shown directly by the Web or app clients.
 * Spring MVC populates {@link LocaleContextHolder} from the request's
 * {@code Accept-Language} header before invoking a controller.
 */
public final class UserMessages {

    private UserMessages() {
    }

    public enum Key {
        SUCCESS("ok", "成功"),
        SECONDARY_PASSWORD_NOT_CONFIGURED(
                "Secondary password is not configured", "未配置二级密码"),
        SECONDARY_PASSWORD_REQUIRED(
                "Secondary password is required", "缺少二级密码"),
        INCORRECT_SECONDARY_PASSWORD(
                "Incorrect secondary password", "二级密码错误"),
        MARKER_NOT_FOUND("Marker not found", "点位不存在"),
        PROPOSAL_ALREADY_REVIEWED(
                "This proposal has already been reviewed", "该提案已处理"),
        RELATED_MARKER_NOT_FOUND("Related marker not found", "关联点位不存在"),
        EDIT_PROPOSAL_NOT_FOUND("Edit proposal not found", "编辑提案不存在"),
        IMAGE_PROPOSAL_NOT_FOUND("Image proposal not found", "图片提案不存在"),
        INVALID_IMAGE_LINKS_CLEANED(
                "Invalid image links have been cleaned up", "失效图片链接清理完成"),
        SECONDARY_PASSWORD_VERIFICATION_REQUIRED(
                "Secondary password verification required", "需要二级密码"),
        SECONDARY_PASSWORD_VERIFICATION_EXPIRED(
                "Secondary password verification has expired. Please verify again", "二级密码已过期，请重新验证"),
        DELETED_USER_PASSWORD_RESET_FORBIDDEN(
                "Deleted users cannot have their password reset", "已删除用户不能重置密码"),
        PASSWORD_RESET_TO_DEFAULT(
                "Password has been reset to the default password", "密码已重置为默认密码"),
        USER_NOT_FOUND("User not found", "用户不存在"),
        CANNOT_DELETE_CURRENT_ADMIN(
                "You cannot delete the currently signed-in administrator account", "不能删除当前登录管理员账号"),
        USER_DELETED("User deleted", "用户已删除"),
        USER_NOT_DELETED("This user has not been deleted", "该用户未被删除"),
        USER_RESTORED("User restored", "用户已恢复"),
        SPRING_SECURITY_ERROR("Spring Security Error", "身份验证失败"),
        INVALID_USERNAME_OR_PASSWORD("Invalid username or password", "用户名或密码错误"),
        INVALID_REGISTRATION_REQUEST("Invalid registration request", "注册请求无效"),
        TOO_MANY_REQUESTS(
                "Too many requests. Please try again later", "请求过于频繁，请稍后再试"),
        USERNAME_OR_EMAIL_EXISTS("Username or email already exists", "用户名或邮箱已存在"),
        NOT_SIGNED_IN("Not signed in", "未登录"),
        FILE_EMPTY("File is empty", "文件为空"),
        UPLOAD_FAILED("Upload failed", "上传失败"),
        MISSING_PARAMETERS("Missing parameters", "缺少参数"),
        PASSWORD_CHANGE_INVALID(
                "Current password is incorrect or the new password is invalid", "原密码错误或新密码不合法"),
        SIGN_IN_FIRST("Please sign in first", "请先登录"),
        REQUIRED_FIELDS_MISSING("Required fields are missing", "缺少必要字段"),
        MISSING_LAT_LNG("Missing lat/lng parameters", "缺少 lat/lng 参数"),
        INVALID_LAT_LNG("Invalid lat/lng values", "lat/lng 不合法"),
        POSTGIS_NOT_ENABLED(
                "PostGIS is not enabled in the database. Run: CREATE EXTENSION postgis;",
                "数据库未启用 PostGIS，请先执行：CREATE EXTENSION postgis;"),
        VIEWPORT_BOUNDS_REQUIRED("Viewport bounds are required", "缺少视口边界参数"),
        OPENING_AND_CLOSING_TIMES_REQUIRED(
                "Provide both opening and closing times, or leave both empty", "请同时填写开始和结束时间，或都留空"),
        PERMISSION_DENIED("Permission denied", "无权限"),
        FILE_TOO_LARGE(
                "File too large. Please choose an image under 5 MB.", "上传文件过大，请选择 5MB 以内的图片"),
        INVALID_VIEWPORT_BOUNDS("Invalid viewport bounds", "边界参数不合法"),
        VIEWPORT_BOUNDS_OUT_OF_RANGE(
                "Viewport bounds are outside the valid latitude/longitude range", "边界超出合法经纬度范围"),
        INVALID_TIME_FORMAT("Invalid time format. Use HH:mm", "时间格式不合法，请使用 HH:mm"),
        CATEGORY_REQUIRED("category is required", "category 不能为空"),
        UNSUPPORTED_CATEGORY(
                "Unsupported category: {0}. Supported values: {1}", "不支持的 category：{0}，仅支持：{1}"),
        STORED_CATEGORY_REQUIRED("Stored category is required", "存量 category 不能为空"),
        UNSUPPORTED_STORED_CATEGORY(
                "Unsupported stored category: {0}", "不支持的存量 category：{0}"),
        CLIENT_REQUEST_ID_TOO_LONG("clientRequestId is too long", "clientRequestId 过长");

        private final String english;
        private final String chinese;

        Key(String english, String chinese) {
            this.english = english;
            this.chinese = chinese;
        }
    }

    public static String text(Key key, Object... arguments) {
        LocaleContext localeContext = LocaleContextHolder.getLocaleContext();
        Locale locale = localeContext == null || localeContext.getLocale() == null
                ? Locale.ENGLISH
                : localeContext.getLocale();
        return textForLocale(key, locale, arguments);
    }

    public static String textForLocale(Key key, Locale locale, Object... arguments) {
        Locale effectiveLocale = locale == null ? Locale.ENGLISH : locale;
        String pattern = isChinese(effectiveLocale) ? key.chinese : key.english;
        if (arguments == null || arguments.length == 0) {
            return pattern;
        }
        return new MessageFormat(pattern, effectiveLocale).format(arguments);
    }

    public static Locale localeForAcceptLanguage(String header) {
        if (header == null || header.isBlank()) {
            return Locale.ENGLISH;
        }
        try {
            List<Locale.LanguageRange> ranges = Locale.LanguageRange.parse(header);
            for (Locale.LanguageRange range : ranges) {
                if (range.getWeight() <= 0) continue;
                String languageRange = range.getRange().toLowerCase(Locale.ROOT);
                if ("zh".equals(languageRange) || languageRange.startsWith("zh-")) {
                    return Locale.SIMPLIFIED_CHINESE;
                }
                if ("en".equals(languageRange) || languageRange.startsWith("en-") || "*".equals(languageRange)) {
                    return Locale.ENGLISH;
                }
            }
        } catch (IllegalArgumentException ignored) {
            // Invalid Accept-Language headers fall back to English.
        }
        return Locale.ENGLISH;
    }

    static boolean isChinese(Locale locale) {
        return locale != null && "zh".equalsIgnoreCase(locale.getLanguage());
    }
}
