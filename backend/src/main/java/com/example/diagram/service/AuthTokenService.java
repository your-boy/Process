package com.example.diagram.service;

import com.example.diagram.model.AppUser;
import com.example.diagram.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;

@Service
public class AuthTokenService {

    private static final long TOKEN_TTL_MILLIS = 12L * 60L * 60L * 1000L;

    private final AppUserRepository appUserRepository;
    private final String tokenSecret;

    public AuthTokenService(AppUserRepository appUserRepository, @Value("${app.auth.token-secret}") String tokenSecret) {
        this.appUserRepository = appUserRepository;
        this.tokenSecret = tokenSecret;
    }

    public String issueToken(AppUser user) {
        long expiresAt = System.currentTimeMillis() + TOKEN_TTL_MILLIS;
        String payload = user.getUserId() + ":" + expiresAt;
        String signature = sign(payload, user.getPasswordHash());
        String body = payload + ":" + signature;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(body.getBytes(StandardCharsets.UTF_8));
    }

    public AppUser authenticate(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        String decoded;
        try {
            decoded = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            throw unauthorized("登录态无效");
        }

        String[] parts = decoded.split(":");
        if (parts.length != 3) {
            throw unauthorized("登录态无效");
        }

        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[1]);
        } catch (NumberFormatException exception) {
            throw unauthorized("登录态无效");
        }

        if (expiresAt < System.currentTimeMillis()) {
            throw unauthorized("登录已过期，请重新登录");
        }

        AppUser user = appUserRepository.findByUserId(parts[0])
            .orElseThrow(() -> unauthorized("登录态无效"));

        String expected = sign(parts[0] + ":" + expiresAt, user.getPasswordHash());
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw unauthorized("登录态无效");
        }

        return user;
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.trim().isEmpty()) {
            throw unauthorized("请先登录");
        }

        String value = authorizationHeader.trim();
        if (!value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw unauthorized("登录态无效");
        }

        String token = value.substring(7).trim();
        if (token.isEmpty()) {
            throw unauthorized("登录态无效");
        }
        return token;
    }

    private String sign(String payload, String passwordHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(tokenSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal((payload + ":" + passwordHash).getBytes(StandardCharsets.UTF_8));
            return toHex(bytes);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法生成登录令牌", exception);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private ResponseStatusException unauthorized(String message) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
    }
}