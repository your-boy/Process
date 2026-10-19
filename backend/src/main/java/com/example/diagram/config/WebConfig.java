package com.example.diagram.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

/**
 * CORS 配置，全部来自 APP_CORS_ALLOWED_ORIGINS（逗号分隔）。
 *
 * <p>同域部署（Nginx 反代 /api）时留空即可，浏览器根本不会跨域；
 * 只有前后端分域部署时才需要配置，例如：
 * <pre>
 *   APP_CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
 *   APP_CORS_ALLOWED_ORIGINS=https://*.example.com        # 通配子域
 *   APP_CORS_ALLOWED_ORIGINS=http://localhost:*           # 本地多端口调试
 * </pre>
 * 含 {@code *} 的条目按 Spring 的 origin pattern 处理，其余按精确匹配。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] exactOrigins;
    private final String[] originPatterns;

    public WebConfig(@Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String allowedOrigins) {
        List<String> exact = new ArrayList<>();
        List<String> patterns = new ArrayList<>();

        for (String raw : allowedOrigins.split(",")) {
            String origin = raw.trim();
            if (origin.isEmpty()) {
                continue;
            }
            if (origin.contains("*")) {
                patterns.add(origin);
            } else {
                exact.add(origin);
            }
        }

        this.exactOrigins = exact.toArray(new String[0]);
        this.originPatterns = patterns.toArray(new String[0]);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (exactOrigins.length == 0 && originPatterns.length == 0) {
            return;
        }

        var registration = registry.addMapping("/api/**")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With")
            .exposedHeaders("X-Request-Id")
            .allowCredentials(false)
            .maxAge(3600);

        if (exactOrigins.length > 0) {
            registration.allowedOrigins(exactOrigins);
        }
        if (originPatterns.length > 0) {
            registration.allowedOriginPatterns(originPatterns);
        }
    }
}
