package com.example.diagram.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimiter {

    private static final long WINDOW_MILLIS = 1000L;
    private static final long RETAIN_MILLIS = 5L * 60L * 1000L;
    private static final int MAX_FAILURES = 5;
    private static final long FAILURE_WINDOW_MILLIS = 15L * 60L * 1000L;
    private static final long LOCKOUT_MILLIS = 5L * 60L * 1000L;

    private final Map<String, Long> lastRequestByIp = new ConcurrentHashMap<>();
    private final Map<String, AttemptState> attemptsByAccount = new ConcurrentHashMap<>();
    private final boolean trustForwardedHeaders;
    private final boolean enabled;

    public LoginRateLimiter(
        @Value("${app.proxy.trust-forwarded-headers:false}") boolean trustForwardedHeaders,
        @Value("${app.login-rate-limit.enabled:true}") boolean enabled
    ) {
        this.trustForwardedHeaders = trustForwardedHeaders;
        this.enabled = enabled;
    }

    public synchronized void check(HttpServletRequest request) {
        if (!enabled) {
            return;
        }
        long now = System.currentTimeMillis();
        String clientIp = resolveClientIp(request);
        Long previous = lastRequestByIp.get(clientIp);

        if (previous != null && now - previous < WINDOW_MILLIS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "登录请求过于频繁，请稍后再试");
        }

        lastRequestByIp.put(clientIp, now);
        cleanup(now);
    }

    public synchronized void checkAccount(String account) {
        if (!enabled) {
            return;
        }
        String key = normalizeAccount(account);
        if (key.isEmpty()) {
            return;
        }
        AttemptState state = attemptsByAccount.get(key);
        long now = System.currentTimeMillis();
        if (state != null && state.lockedUntil > now) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "尝试次数过多，请 5 分钟后再试");
        }
    }

    public synchronized void recordFailure(String account) {
        if (!enabled) {
            return;
        }
        String key = normalizeAccount(account);
        if (key.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        AttemptState state = attemptsByAccount.computeIfAbsent(key, ignored -> new AttemptState());
        if (now - state.windowStartedAt > FAILURE_WINDOW_MILLIS) {
            state.failures = 0;
            state.windowStartedAt = now;
        }
        state.failures += 1;
        if (state.failures >= MAX_FAILURES) {
            state.lockedUntil = now + LOCKOUT_MILLIS;
            state.failures = 0;
            state.windowStartedAt = now;
        }
    }

    public synchronized void recordSuccess(String account) {
        String key = normalizeAccount(account);
        if (!key.isEmpty()) {
            attemptsByAccount.remove(key);
        }
    }

    public synchronized void clear() {
        lastRequestByIp.clear();
        attemptsByAccount.clear();
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }

        if (trustForwardedHeaders) {
            String forwardedFor = firstHeaderValue(request.getHeader("X-Forwarded-For"));
            if (!forwardedFor.isEmpty()) {
                return forwardedFor;
            }

            String realIp = firstHeaderValue(request.getHeader("X-Real-IP"));
            if (!realIp.isEmpty()) {
                return realIp;
            }
        }

        String remoteAddr = request.getRemoteAddr();
        return remoteAddr == null || remoteAddr.trim().isEmpty() ? "unknown" : remoteAddr.trim();
    }

    private String firstHeaderValue(String headerValue) {
        if (headerValue == null || headerValue.trim().isEmpty()) {
            return "";
        }

        String[] parts = headerValue.split(",");
        return parts.length == 0 ? "" : parts[0].trim();
    }

    private void cleanup(long now) {
        Iterator<Map.Entry<String, Long>> iterator = lastRequestByIp.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Long> entry = iterator.next();
            if (now - entry.getValue() > RETAIN_MILLIS) {
                iterator.remove();
            }
        }
        attemptsByAccount.entrySet().removeIf(entry -> (
            entry.getValue().lockedUntil < now &&
            now - entry.getValue().windowStartedAt > FAILURE_WINDOW_MILLIS
        ));
    }

    private String normalizeAccount(String account) {
        return account == null ? "" : account.trim().toLowerCase();
    }

    private static class AttemptState {
        private int failures;
        private long windowStartedAt = System.currentTimeMillis();
        private long lockedUntil;
    }
}