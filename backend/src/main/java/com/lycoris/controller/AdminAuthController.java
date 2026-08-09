package com.lycoris.controller;

import com.lycoris.dto.AdminVerifyRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.lycoris.i18n.UserMessages.Key.INCORRECT_SECONDARY_PASSWORD;
import static com.lycoris.i18n.UserMessages.Key.SECONDARY_PASSWORD_NOT_CONFIGURED;
import static com.lycoris.i18n.UserMessages.Key.SECONDARY_PASSWORD_REQUIRED;
import static com.lycoris.i18n.UserMessages.text;

@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

    private final PasswordEncoder passwordEncoder;
    private final String secondPasswordHash;

    public AdminAuthController(
            PasswordEncoder passwordEncoder,
            @Value("${admin.second-password-hash:}") String secondPasswordHash
    ) {
        this.passwordEncoder = passwordEncoder;
        this.secondPasswordHash = secondPasswordHash == null ? "" : secondPasswordHash.trim();
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody AdminVerifyRequest request, HttpSession session) {
        if (secondPasswordHash.isBlank()) {
            return ResponseEntity.status(403).body(text(SECONDARY_PASSWORD_NOT_CONFIGURED));
        }
        String passcode = request == null ? null : request.getPasscode();
        if (passcode == null || passcode.isBlank()) {
            return ResponseEntity.badRequest().body(text(SECONDARY_PASSWORD_REQUIRED));
        }
        if (!passwordEncoder.matches(passcode, secondPasswordHash)) {
            return ResponseEntity.status(403).body(text(INCORRECT_SECONDARY_PASSWORD));
        }
        session.setAttribute("adminSecondVerified", true);
        session.setAttribute("adminSecondVerifiedAt", System.currentTimeMillis());
        return ResponseEntity.ok().build();
    }
}
