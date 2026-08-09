package com.lycoris.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;

import static com.lycoris.i18n.UserMessages.localeForAcceptLanguage;

@Configuration
public class LocaleConfig {

    @Bean
    public LocaleResolver localeResolver() {
        return new SelectedLanguageLocaleResolver();
    }

    private static final class SelectedLanguageLocaleResolver implements LocaleResolver {
        @Override
        public java.util.Locale resolveLocale(jakarta.servlet.http.HttpServletRequest request) {
            return localeForAcceptLanguage(request.getHeader("Accept-Language"));
        }

        @Override
        public void setLocale(
                jakarta.servlet.http.HttpServletRequest request,
                jakarta.servlet.http.HttpServletResponse response,
                java.util.Locale locale
        ) {
            throw new UnsupportedOperationException("The locale is selected through Accept-Language");
        }
    }
}
