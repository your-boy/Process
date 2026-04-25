package com.example.diagram.controller;

import com.example.diagram.service.AuthFacade;
import com.example.diagram.service.LoginRateLimiter;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthFacade authFacade;
    private final LoginRateLimiter loginRateLimiter;

    public AuthController(AuthFacade authFacade, LoginRateLimiter loginRateLimiter) {
        this.authFacade = authFacade;
        this.loginRateLimiter = loginRateLimiter;
    }

    @GetMapping("/public-key")
    public PublicKeyResponse publicKey() {
        return new PublicKeyResponse(authFacade.getPublicKeyPem(), "RSA-OAEP-256");
    }

    @PostMapping("/login")
    public AuthResponse login(HttpServletRequest servletRequest, @RequestBody LoginRequest request) {
        loginRateLimiter.check(servletRequest);
        AuthFacade.AuthResult result = authFacade.login(
            request == null ? null : request.getUsername(),
            request == null ? null : request.getEncryptedPassword()
        );
        return AuthResponse.from(result);
    }

    @PostMapping("/change-password")
    public AuthResponse changePassword(
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestBody ChangePasswordRequest request
    ) {
        AuthFacade.AuthResult result = authFacade.changePassword(
            authorizationHeader,
            request == null ? null : request.getEncryptedCurrentPassword(),
            request == null ? null : request.getEncryptedNewPassword()
        );
        return AuthResponse.from(result);
    }

    @PostMapping("/forgot-password")
    public AuthResponse forgotPassword(@RequestBody ForgotPasswordRequest request) {
        AuthFacade.AuthResult result = authFacade.forgotPassword(
            request == null ? null : request.getUsername(),
            request == null ? null : request.getEncryptedRecoveryCode(),
            request == null ? null : request.getEncryptedNewPassword()
        );
        return AuthResponse.from(result);
    }

    public static class LoginRequest {

        private String username;
        private String encryptedPassword;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getEncryptedPassword() {
            return encryptedPassword;
        }

        public void setEncryptedPassword(String encryptedPassword) {
            this.encryptedPassword = encryptedPassword;
        }
    }

    public static class ChangePasswordRequest {

        private String encryptedCurrentPassword;
        private String encryptedNewPassword;

        public String getEncryptedCurrentPassword() {
            return encryptedCurrentPassword;
        }

        public void setEncryptedCurrentPassword(String encryptedCurrentPassword) {
            this.encryptedCurrentPassword = encryptedCurrentPassword;
        }

        public String getEncryptedNewPassword() {
            return encryptedNewPassword;
        }

        public void setEncryptedNewPassword(String encryptedNewPassword) {
            this.encryptedNewPassword = encryptedNewPassword;
        }
    }

    public static class ForgotPasswordRequest {

        private String username;
        private String encryptedRecoveryCode;
        private String encryptedNewPassword;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getEncryptedRecoveryCode() {
            return encryptedRecoveryCode;
        }

        public void setEncryptedRecoveryCode(String encryptedRecoveryCode) {
            this.encryptedRecoveryCode = encryptedRecoveryCode;
        }

        public String getEncryptedNewPassword() {
            return encryptedNewPassword;
        }

        public void setEncryptedNewPassword(String encryptedNewPassword) {
            this.encryptedNewPassword = encryptedNewPassword;
        }
    }

    public static class PublicKeyResponse {

        private final String publicKey;
        private final String algorithm;

        public PublicKeyResponse(String publicKey, String algorithm) {
            this.publicKey = publicKey;
            this.algorithm = algorithm;
        }

        public String getPublicKey() {
            return publicKey;
        }

        public String getAlgorithm() {
            return algorithm;
        }
    }

    public static class AuthResponse {

        private final String userId;
        private final String displayName;
        private final String token;

        public AuthResponse(String userId, String displayName, String token) {
            this.userId = userId;
            this.displayName = displayName;
            this.token = token;
        }

        public static AuthResponse from(AuthFacade.AuthResult result) {
            return new AuthResponse(result.getUserId(), result.getDisplayName(), result.getToken());
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