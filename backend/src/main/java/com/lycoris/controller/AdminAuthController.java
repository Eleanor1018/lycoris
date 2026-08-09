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
            return ResponseEntity.status(403).body("Secondary password is not configured");
        }
        String passcode = request == null ? null : request.getPasscode();
        if (passcode == null || passcode.isBlank()) {
            return ResponseEntity.badRequest().body("Secondary password is required");
        }
        if (!passwordEncoder.matches(passcode, secondPasswordHash)) {
            return ResponseEntity.status(403).body("Incorrect secondary password");
        }
        session.setAttribute("adminSecondVerified", true);
        session.setAttribute("adminSecondVerifiedAt", System.currentTimeMillis());
        return ResponseEntity.ok().build();
    }
}
