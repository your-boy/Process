package com.example.diagram.config;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final long MAX_API_REQUEST_BYTES = 20L * 1024L * 1024L;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if (request.getRequestURI() != null
            && request.getRequestURI().startsWith("/api/")
            && exceedsRequestLimit(request)) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "Request body is too large");
            return;
        }

        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Cross-Origin-Resource-Policy", "same-site");

        if (request.getRequestURI() != null && request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store");
        }

        filterChain.doFilter(request, response);
    }

    private boolean exceedsRequestLimit(HttpServletRequest request) {
        String contentLength = request.getHeader("Content-Length");
        if (contentLength == null || contentLength.trim().isEmpty()) {
            return false;
        }
        try {
            return Long.parseLong(contentLength) > MAX_API_REQUEST_BYTES;
        } catch (NumberFormatException exception) {
            return true;
        }
    }
}
