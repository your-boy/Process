package com.example.diagram.service;

import com.example.diagram.model.AppUser;
import com.example.diagram.repository.AppUserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.Base64;

@Component
public class DefaultUserBootstrapper implements ApplicationRunner {

    public static final String DEFAULT_USERNAME = "";
    public static final String DEFAULT_USER_ID = "";
    public static final String DEFAULT_DISPLAY_NAME = "";
    public static final String DEFAULT_PASSWORD = "";
    public static final String DEFAULT_RECOVERY_CODE = "";

    private static final byte[] DEFAULT_PASSWORD_SALT = Base64.getDecoder().decode("");
    private static final byte[] DEFAULT_RECOVERY_SALT = Base64.getDecoder().decode("");

    private final AppUserRepository appUserRepository;
    private final PasswordHashService passwordHashService;

    public DefaultUserBootstrapper(AppUserRepository appUserRepository, PasswordHashService passwordHashService) {
        this.appUserRepository = appUserRepository;
        this.passwordHashService = passwordHashService;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureDefaultUser();
    }

    public AppUser ensureDefaultUser() {
        return appUserRepository.findByUsernameIgnoreCase(DEFAULT_USERNAME)
            .orElseGet(() -> appUserRepository.save(buildDefaultUser(new AppUser())));
    }

    public AppUser resetDefaultUser() {
        AppUser user = appUserRepository.findByUsernameIgnoreCase(DEFAULT_USERNAME)
            .orElse(new AppUser());
        return appUserRepository.save(buildDefaultUser(user));
    }

    private AppUser buildDefaultUser(AppUser user) {
        user.setUsername(DEFAULT_USERNAME);
        user.setUserId(DEFAULT_USER_ID);
        user.setDisplayName(DEFAULT_DISPLAY_NAME);
        user.setPasswordHash(passwordHashService.hashWithSalt(DEFAULT_PASSWORD, DEFAULT_PASSWORD_SALT));
        user.setRecoveryCodeHash(passwordHashService.hashWithSalt(DEFAULT_RECOVERY_CODE, DEFAULT_RECOVERY_SALT));
        return user;
    }
}