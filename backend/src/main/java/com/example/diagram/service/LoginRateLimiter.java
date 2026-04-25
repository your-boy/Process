package com.example.diagram.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimiter {

    private static final long WINDOW_MILLIS = 1000L;
    private static final long RETAIN_MILLIS = 5L * 60L * 1000L;

    private final Map<String, Long> lastRequestByIp = new ConcurrentHashMap<>();

    public synchronized void check(HttpServletRequest request) {
        long now = System.currentTimeMillis();
        String clientIp = resolveClientIp(request);
        Long previous = lastRequestByIp.get(clientIp);

        if (previous != null && now - previous < WINDOW_MILLIS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "登录请求过于频繁，请稍后再试");
        }

        lastRequestByIp.put(clientIp, now);
        cleanup(now);
    }

    public synchronized void clear() {
        lastRequestByIp.clear();
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }

        String forwardedFor = firstHeaderValue(request.getHeader("X-Forwarded-For"));
        if (!forwardedFor.isEmpty()) {
            return forwardedFor;
        }

        String realIp = firstHeaderValue(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
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
    }
}