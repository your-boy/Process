package com.process.service.impl;

import com.process.dto.*;
import com.process.entity.User;
import com.process.repository.UserRepository;
import com.process.security.JwtUtils;
import com.process.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final JavaMailSender mailSender;

    @Value("${app.reset-password.expiration}")
    private long resetExpiration;

    @Value("${app.reset-password.base-url}")
    private String baseUrl;

    @Override
    public ApiResponse<LoginResponse> login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        String token = jwtUtils.generateToken(authentication.getName());
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow();

        UserDTO userDTO = toUserDTO(user);
        return ApiResponse.success(new LoginResponse(token, userDTO));
    }

    @Override
    public ApiResponse<UserDTO> getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return ApiResponse.success(toUserDTO(user));
    }

    @Override
    public ApiResponse<Void> updatePassword(String username, UpdatePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            return ApiResponse.error(400, "原密码不正确");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        return ApiResponse.success();
    }

    @Override
    public ApiResponse<Void> forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            user.setResetTokenExpiry(LocalDateTime.now().plusSeconds(resetExpiration / 1000));
            userRepository.save(user);

            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(email);
                message.setSubject("Process - 重置密码");
                message.setText(String.format(
                        "您好 %s，\n\n请点击以下链接重置密码（链接1小时内有效）：\n%s/reset-password?token=%s\n\n如果您没有请求重置密码，请忽略此邮件。",
                        user.getUsername(), baseUrl, token
                ));
                mailSender.send(message);
            } catch (Exception e) {
                // Log email send failure but don't expose to client
            }
        });

        // Always return success to avoid email enumeration
        return ApiResponse.success();
    }

    @Override
    public ApiResponse<Void> resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByResetToken(request.getToken())
                .orElse(null);

        if (user == null) {
            return ApiResponse.error(400, "无效的重置链接");
        }

        if (user.getResetTokenExpiry() == null || LocalDateTime.now().isAfter(user.getResetTokenExpiry())) {
            return ApiResponse.error(400, "重置链接已过期，请重新申请");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
        return ApiResponse.success();
    }

    private UserDTO toUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setAvatar(user.getAvatar());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}
