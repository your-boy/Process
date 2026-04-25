package com.example.diagram.service;

import com.example.diagram.model.AppUser;
import com.example.diagram.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class AuthFacade {

    private final AppUserRepository appUserRepository;
    private final PasswordHashService passwordHashService;
    private final RsaCryptoService rsaCryptoService;
    private final AuthTokenService authTokenService;

    public AuthFacade(
        AppUserRepository appUserRepository,
        PasswordHashService passwordHashService,
        RsaCryptoService rsaCryptoService,
        AuthTokenService authTokenService
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordHashService = passwordHashService;
        this.rsaCryptoService = rsaCryptoService;
        this.authTokenService = authTokenService;
    }

    public String getPublicKeyPem() {
        return rsaCryptoService.getPublicKeyPem();
    }

    public AuthResult login(String username, String encryptedPassword) {
        AppUser user = findByUsername(username);
        String password = decryptRequired(encryptedPassword, "密码");
        if (!passwordHashService.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }
        return createResult(user);
    }

    public AuthResult changePassword(String authorizationHeader, String encryptedCurrentPassword, String encryptedNewPassword) {
        AppUser user = authenticate(authorizationHeader);
        String currentPassword = decryptRequired(encryptedCurrentPassword, "当前密码");
        String newPassword = decryptRequired(encryptedNewPassword, "新密码");

        if (!passwordHashService.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "当前密码错误");
        }

        validateNewPassword(newPassword);
        user.setPasswordHash(passwordHashService.hash(newPassword));
        return createResult(appUserRepository.save(user));
    }

    public AuthResult forgotPassword(String username, String encryptedRecoveryCode, String encryptedNewPassword) {
        AppUser user = findByUsername(username);
        String recoveryCode = normalizeRecoveryCode(decryptRequired(encryptedRecoveryCode, "恢复口令"));
        String newPassword = decryptRequired(encryptedNewPassword, "新密码");

        if (!passwordHashService.matches(recoveryCode, user.getRecoveryCodeHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "恢复口令错误");
        }

        validateNewPassword(newPassword);
        user.setPasswordHash(passwordHashService.hash(newPassword));
        return createResult(appUserRepository.save(user));
    }

    public AppUser authenticate(String authorizationHeader) {
        return authTokenService.authenticate(authorizationHeader);
    }

    private AppUser findByUsername(String username) {
        String normalized = username == null ? "" : username.trim();
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名不能为空");
        }
        return appUserRepository.findByUsernameIgnoreCase(normalized)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误"));
    }

    private String decryptRequired(String encryptedValue, String fieldLabel) {
        if (encryptedValue == null || encryptedValue.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldLabel + "不能为空");
        }
        return rsaCryptoService.decrypt(encryptedValue);
    }

    private void validateNewPassword(String newPassword) {
        if (newPassword == null || newPassword.length() < 6 || newPassword.length() > 64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "新密码长度必须在 6 到 64 位之间");
        }
    }

    private String normalizeRecoveryCode(String recoveryCode) {
        return recoveryCode == null ? null : recoveryCode.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }

    private AuthResult createResult(AppUser user) {
        return new AuthResult(user.getUserId(), user.getDisplayName(), authTokenService.issueToken(user));
    }

    public static class AuthResult {

        private final String userId;
        private final String displayName;
        private final String token;

        public AuthResult(String userId, String displayName, String token) {
            this.userId = userId;
            this.displayName = displayName;
            this.token = token;
        }

        public String getUserId() {
            return userId;
        }

        public String getDisplayName() {
            return displayName;
        }

        public String getToken() {
            return token;
        }
    }
}