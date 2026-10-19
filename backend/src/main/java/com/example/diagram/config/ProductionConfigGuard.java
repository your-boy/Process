package com.example.diagram.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class ProductionConfigGuard implements InitializingBean {

    private static final String INSECURE_DEFAULT_SECRET = "diagram-editor-local-token-secret-2026";

    @Value("${app.auth.token-secret:}")
    private String tokenSecret;

    @Value("${spring.datasource.password:}")
    private String databasePassword;

    @Value("${app.default-user.enabled:false}")
    private boolean defaultUserEnabled;

    @Override
    public void afterPropertiesSet() {
        if (tokenSecret == null || tokenSecret.trim().length() < 32 || INSECURE_DEFAULT_SECRET.equals(tokenSecret.trim())) {
            throw new IllegalStateException(
                "Production startup refused: APP_AUTH_TOKEN_SECRET must be set to a random value of at least 32 characters."
            );
        }
        if (databasePassword == null
            || databasePassword.trim().isEmpty()
            || "root".equals(databasePassword)
            || "change-me".equalsIgnoreCase(databasePassword.trim())) {
            throw new IllegalStateException(
                "Production startup refused: DIAGRAM_DB_PASSWORD must be a non-default database password."
            );
        }
        if (defaultUserEnabled) {
            throw new IllegalStateException(
                "Production startup refused: APP_DEFAULT_USER_ENABLED must be false after initial account provisioning."
            );
        }
    }
}
