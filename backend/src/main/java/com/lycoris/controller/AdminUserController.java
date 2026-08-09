package com.lycoris.controller;

import com.lycoris.entity.User;
import com.lycoris.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private static final long SECOND_FACTOR_TTL_MS = 30 * 60 * 1000L;

    private final UserService userService;
    private final boolean adminSecondFactorEnabled;

    @Value("${admin.default-user-password:Lycoris123!}")
    private String defaultUserPassword;

    public AdminUserController(
            UserService userService,
            @Value("${admin.second-factor-enabled:true}") boolean adminSecondFactorEnabled
    ) {
        this.userService = userService;
        this.adminSecondFactorEnabled = adminSecondFactorEnabled;
    }

    @GetMapping
    public ResponseEntity<?> listUsers(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "q", required = false) String q,
            HttpSession session
    ) {
        ResponseEntity<?> blocked = requireSecondFactor(session);
        if (blocked != null) return blocked;

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Page<User> p = userService.searchForAdmin(
                q,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "id"))
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("page", p.getNumber());
        result.put("size", p.getSize());
        result.put("totalPages", p.getTotalPages());
        result.put("totalElements", p.getTotalElements());
        result.put("items", p.getContent().stream().map(this::toAdminUser).toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable("id") Integer id, HttpSession session) {
        ResponseEntity<?> blocked = requireSecondFactor(session);
        if (blocked != null) return blocked;

        return userService.findAnyById(id)
                .<ResponseEntity<?>>map(user -> {
                    if (Boolean.TRUE.equals(user.getDeleted())) {
                        return ResponseEntity.badRequest().body("Deleted users cannot have their password reset");
                    }
                    userService.resetPassword(user, defaultUserPassword);
                    return ResponseEntity.ok(Map.of(
                            "message", "Password has been reset to the default password",
                            "username", user.getUsername()
                    ));
                })
                .orElseGet(() -> ResponseEntity.status(404).body("User not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable("id") Integer id, HttpSession session) {
        ResponseEntity<?> blocked = requireSecondFactor(session);
        if (blocked != null) return blocked;

        Integer currentUserId = (Integer) session.getAttribute("userId");
        if (currentUserId != null && currentUserId.equals(id)) {
            return ResponseEntity.status(400).body("You cannot delete the currently signed-in administrator account");
        }

        boolean deleted = userService.deleteById(id);
        if (!deleted) {
            return ResponseEntity.status(404).body("User not found");
        }
        return ResponseEntity.ok(Map.of("message", "User deleted"));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restoreUser(@PathVariable("id") Integer id, HttpSession session) {
        ResponseEntity<?> blocked = requireSecondFactor(session);
        if (blocked != null) return blocked;

        return userService.findAnyById(id)
                .<ResponseEntity<?>>map(user -> {
                    if (!Boolean.TRUE.equals(user.getDeleted())) {
                        return ResponseEntity.badRequest().body("This user has not been deleted");
                    }
                    userService.restore(user);
                    return ResponseEntity.ok(Map.of("message", "User restored"));
                })
                .orElseGet(() -> ResponseEntity.status(404).body("User not found"));
    }

    private Map<String, Object> toAdminUser(User user) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", user.getId());
        item.put("publicId", user.getPublicId() == null ? null : String.valueOf(user.getPublicId()));
        item.put("username", user.getUsername());
        item.put("nickname", user.getNickname());
        item.put("email", user.getEmail());
        item.put("avatarUrl", user.getAvatarUrl());
        item.put("pronouns", user.getPronouns());
        item.put("signature", user.getSignature());
        item.put("role", user.getRole());
        item.put("deleted", user.getDeleted());
        item.put("deletedAt", user.getDeletedAt());
        return item;
    }

    private ResponseEntity<?> requireSecondFactor(HttpSession session) {
        if (!adminSecondFactorEnabled) {
            return null;
        }
        Object ok = session.getAttribute("adminSecondVerified");
        Object at = session.getAttribute("adminSecondVerifiedAt");
        if (!(ok instanceof Boolean) || !((Boolean) ok)) {
            return ResponseEntity.status(403).body("Secondary password verification required");
        }
        if (at instanceof Long) {
            long elapsed = System.currentTimeMillis() - (Long) at;
            if (elapsed > SECOND_FACTOR_TTL_MS) {
                session.removeAttribute("adminSecondVerified");
                session.removeAttribute("adminSecondVerifiedAt");
                return ResponseEntity.status(403)
                        .body("Secondary password verification has expired. Please verify again");
            }
        }
        return null;
    }
}
