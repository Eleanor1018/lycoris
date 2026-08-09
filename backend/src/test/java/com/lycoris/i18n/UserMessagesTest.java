package com.lycoris.i18n;

import org.junit.jupiter.api.Test;

import java.util.Locale;

import static com.lycoris.i18n.UserMessages.Key.UNSUPPORTED_CATEGORY;
import static org.assertj.core.api.Assertions.assertThat;

class UserMessagesTest {

    @Test
    void acceptLanguageSelectionDefaultsToEnglishAndHonorsQualityWeights() {
        assertThat(UserMessages.localeForAcceptLanguage(null)).isEqualTo(Locale.ENGLISH);
        assertThat(UserMessages.localeForAcceptLanguage("fr-FR")).isEqualTo(Locale.ENGLISH);
        assertThat(UserMessages.localeForAcceptLanguage("not a valid header")).isEqualTo(Locale.ENGLISH);
        assertThat(UserMessages.localeForAcceptLanguage("zh")).isEqualTo(Locale.SIMPLIFIED_CHINESE);
        assertThat(UserMessages.localeForAcceptLanguage("zh-CN")).isEqualTo(Locale.SIMPLIFIED_CHINESE);
        assertThat(UserMessages.localeForAcceptLanguage("en;q=0.7, zh-CN;q=1"))
                .isEqualTo(Locale.SIMPLIFIED_CHINESE);
        assertThat(UserMessages.localeForAcceptLanguage("en-US, zh-CN;q=0.8"))
                .isEqualTo(Locale.ENGLISH);
    }

    @Test
    void formatsDynamicValuesInBothLanguages() {
        assertThat(UserMessages.textForLocale(
                UNSUPPORTED_CATEGORY,
                Locale.ENGLISH,
                "unknown",
                "one, two"
        )).isEqualTo("Unsupported category: unknown. Supported values: one, two");

        assertThat(UserMessages.textForLocale(
                UNSUPPORTED_CATEGORY,
                Locale.SIMPLIFIED_CHINESE,
                "unknown",
                "one, two"
        )).isEqualTo("不支持的 category：unknown，仅支持：one, two");
    }
}
