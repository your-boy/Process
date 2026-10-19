package com.example.diagram.service;

import com.example.diagram.model.AppUser;
import com.example.diagram.repository.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Creates the optional first account from external configuration.
 *
 * <p>The account is disabled by default. The local profile turns it on with
 * demo credentials, while production is expected to provide an account through
 * the existing MySQL data or through explicit APP_DEFAULT_USER_* variables.
 */
@Component
public class DefaultUserBootstrapper implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultUserBootstrapper.class);

    private final AppUserRepository appUserRepository;
    private final PasswordHashService passwordHashService;
    private final boolean enabled;
    private final String username;
    private final String userId;
    private final String displayName;
    private final String password;
    private final String recoveryCode;

    public DefaultUserBootstrapper(
        AppUserRepository appUserRepository,
        PasswordHashService passwordHashService,
        @Value("${app.default-user.enabled:false}") boolean enabled,
        @Value("${app.default-user.username:}") String username,
        @Value("${app.default-user.user-id:}") String userId,
        @Value("${app.default-user.display-name:}") String displayName,
        @Value("${app.default-user.password:}") String password,
        @Value("${app.default-user.recovery-code:}") String recoveryCode
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordHashService = passwordHashService;
        this.enabled = enabled;
        this.username = trim(username);
        this.userId = trim(userId);
        this.displayName = trim(displayName);
        this.password = password == null ? "" : password;
        this.recoveryCode = recoveryCode == null ? "" : recoveryCode;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.debug("Default user bootstrapping is disabled");
            return;
        }
        if (username.isEmpty()) {
            log.warn("Default user bootstrapping is enabled but app.default-user.username is empty; skipping");
            return;
        }
        AppUser user = ensureDefaultUser();
        log.info("Local default user is available: username={}, userId={}", user.getUsername(), user.getUserId());
    }

    public AppUser ensureDefaultUser() {
        return appUserRepository.findByUsernameIgnoreCase(username)
            .orElseGet(() -> appUserRepository.save(buildDefaultUser(new AppUser())));
    }

    public AppUser resetDefaultUser() {
        AppUser user = appUserRepository.findByUsernameIgnoreCase(username)
            .orElse(new AppUser());
        return appUserRepository.save(buildDefaultUser(user));
    }

    private AppUser buildDefaultUser(AppUser user) {
        user.setUsername(username);
        user.setUserId(userId.isEmpty() ? username : userId);
        user.setDisplayName(displayName.isEmpty() ? username : displayName);
        user.setPasswordHash(passwordHashService.hash(password));
        user.setRecoveryCodeHash(passwordHashService.hash(recoveryCode));
        return user;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
