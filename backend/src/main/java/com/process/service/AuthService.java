package com.process.service;

import com.process.dto.*;

public interface AuthService {
    ApiResponse<LoginResponse> login(LoginRequest request);
    ApiResponse<UserDTO> getCurrentUser(String username);
    ApiResponse<Void> updatePassword(String username, UpdatePasswordRequest request);
    ApiResponse<Void> forgotPassword(String email);
    ApiResponse<Void> resetPassword(ResetPasswordRequest request);
}
