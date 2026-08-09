package com.lycoris.controller;

import com.lycoris.config.LocaleConfig;
import com.lycoris.config.SecurityConfig;
import com.lycoris.entity.MapMarker;
import com.lycoris.entity.MarkerEditProposal;
import com.lycoris.exception.GlobalExceptionHandler;
import com.lycoris.repository.MapMarkerRepository;
import com.lycoris.repository.MarkerEditProposalRepository;
import com.lycoris.repository.MarkerImageProposalRepository;
import com.lycoris.service.MapMarkerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = AdminMarkerController.class,
        properties = {
                "admin.second-factor-enabled=false",
                "cache.marker.redis-enabled=false"
        }
)
@Import({
        SecurityConfig.class,
        LocaleConfig.class,
        GlobalExceptionHandler.class,
        MapMarkerService.class
})
class BackendI18nMvcIntegrationTest {

    private static final long MARKER_ID = 7L;
    private static final long PROPOSAL_ID = 11L;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private MapMarkerRepository markerRepository;

    @MockitoBean
    private MarkerEditProposalRepository editProposalRepository;

    @MockitoBean
    private MarkerImageProposalRepository imageProposalRepository;

    @Test
    void adminUpdateInvalidCategoryUsesGlobalAdviceAndRequestLocale() throws Exception {
        when(markerRepository.findById(MARKER_ID)).thenReturn(Optional.of(marker()));

        mvc.perform(patch("/api/admin/markers/{id}", MARKER_ID)
                        .session(adminSession())
                        .header("Accept-Language", "zh-CN")
                        .contentType("application/json")
                        .content("{\"category\":\"unknown_category\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(startsWith(
                        "不支持的 category：unknown_category，仅支持："
                )));

        mvc.perform(patch("/api/admin/markers/{id}", MARKER_ID)
                        .session(adminSession())
                        .header("Accept-Language", "en-US")
                        .contentType("application/json")
                        .content("{\"category\":\"unknown_category\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(startsWith(
                        "Unsupported category: unknown_category. Supported values: "
                )));
    }

    @Test
    void adminUpdateInvalidTimeUsesGlobalAdviceAndRequestLocale() throws Exception {
        when(markerRepository.findById(MARKER_ID)).thenReturn(Optional.of(marker()));

        mvc.perform(patch("/api/admin/markers/{id}", MARKER_ID)
                        .session(adminSession())
                        .header("Accept-Language", "zh-CN")
                        .contentType("application/json")
                        .content("{\"openTimeStart\":\"25:00\",\"openTimeEnd\":\"26:00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("时间格式不合法，请使用 HH:mm"));

        mvc.perform(patch("/api/admin/markers/{id}", MARKER_ID)
                        .session(adminSession())
                        .header("Accept-Language", "en-US")
                        .contentType("application/json")
                        .content("{\"openTimeStart\":\"25:00\",\"openTimeEnd\":\"26:00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Invalid time format. Use HH:mm"));
    }

    @Test
    void adminApprovalInvalidStoredCategoryUsesGlobalAdviceAndRequestLocale() throws Exception {
        when(markerRepository.findById(MARKER_ID)).thenReturn(Optional.of(marker()));
        when(editProposalRepository.findById(PROPOSAL_ID))
                .thenReturn(Optional.of(proposal("unknown_category")));

        mvc.perform(post("/api/admin/markers/edit-proposals/{id}/approve", PROPOSAL_ID)
                        .session(adminSession())
                        .header("Accept-Language", "zh-CN"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("不支持的存量 category：unknown_category"));

        mvc.perform(post("/api/admin/markers/edit-proposals/{id}/approve", PROPOSAL_ID)
                        .session(adminSession())
                        .header("Accept-Language", "en-US"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Unsupported stored category: unknown_category"));
    }

    @Test
    void securityEntryPointUsesSelectedLanguageBeforeMvcControllerHandling() throws Exception {
        mvc.perform(get("/api/admin/markers/pending")
                        .header("Accept-Language", "zh-CN"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("身份验证失败"));

        mvc.perform(get("/api/admin/markers/pending")
                        .header("Accept-Language", "en-US"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Spring Security Error"));
    }

    private static MockHttpSession adminSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("username", "admin");
        session.setAttribute("role", "ADMIN");
        return session;
    }

    private static MapMarker marker() {
        MapMarker marker = new MapMarker();
        marker.setId(MARKER_ID);
        marker.setCategory("accessible_toilet");
        return marker;
    }

    private static MarkerEditProposal proposal(String category) {
        MarkerEditProposal proposal = new MarkerEditProposal();
        proposal.setId(PROPOSAL_ID);
        proposal.setMarkerId(MARKER_ID);
        proposal.setStatus("PENDING");
        proposal.setCategory(category);
        return proposal;
    }
}
