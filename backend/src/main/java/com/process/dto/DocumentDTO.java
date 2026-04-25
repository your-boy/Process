package com.process.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DocumentDTO {
    private Long id;
    private String title;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    public static class CreateRequest {
        @NotBlank(message = "标题不能为空")
        private String title;
        private String content;
    }

    @Data
    public static class UpdateRequest {
        private String title;
        private String content;
    }
}
