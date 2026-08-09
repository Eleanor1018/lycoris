package com.lycoris.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lycoris.service.RegisterRateLimitService;
import com.lycoris.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BackendMessageLocalizationTest {

    @Test
    void stringBodyFollowsAcceptLanguageWithoutChangingStatus() throws Exception {
        AdminAuthController controller = new AdminAuthController(mock(PasswordEncoder.class), "");
        MockMvc mvc = mvcFor(controller);

        mvc.perform(post("/api/admin/verify")
                        .header("Accept-Language", "zh-CN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(content().string("未配置二级密码"));

        mvc.perform(post("/api/admin/verify")
                        .header("Accept-Language", "en-US")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(content().string("Secondary password is not configured"));
    }

    @Test
    void apiResponseMessageFollowsGenericChineseAndEnglishHeaders() throws Exception {
        UserService userService = mock(UserService.class);
        RegisterRateLimitService rateLimitService = mock(RegisterRateLimitService.class);
        AuthController controller = new AuthController(userService, rateLimitService);
        MockMvc mvc = mvcFor(controller);

        mvc.perform(post("/api/login")
                        .header("Accept-Language", "zh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nora\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(4001))
                .andExpect(jsonPath("$.message").value("用户名或密码错误"));

        mvc.perform(post("/api/login")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nora\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(4001))
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void apiSuccessMessageFollowsAcceptLanguageWithoutChangingCodeOrData() throws Exception {
        AuthController controller = new AuthController(mock(UserService.class), mock(RegisterRateLimitService.class));
        MockMvc mvc = mvcFor(controller);

        mvc.perform(post("/api/logout").header("Accept-Language", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("成功"))
                .andExpect(jsonPath("$.data").doesNotExist());

        mvc.perform(post("/api/logout").header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void mapMessageFollowsAcceptLanguageWithoutChangingShape() throws Exception {
        UserService userService = mock(UserService.class);
        when(userService.deleteById(7)).thenReturn(true);
        AdminUserController controller = new AdminUserController(userService, false);
        MockMvc mvc = mvcFor(controller);

        mvc.perform(delete("/api/admin/users/7").header("Accept-Language", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("用户已删除"));

        mvc.perform(delete("/api/admin/users/7").header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User deleted"));
    }

    private static MockMvc mvcFor(Object controller) {
        return MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(
                        new StringHttpMessageConverter(StandardCharsets.UTF_8),
                        new MappingJackson2HttpMessageConverter(new ObjectMapper())
                )
                .build();
    }
}
