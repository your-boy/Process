package com.process.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class NoteDTO {
    private Long id;
    private String title;
    private String content;
    private String color;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    public static class CreateRequest {
        private String title;
        private String content;
        private String color;
    }

    @Data
    public static class UpdateRequest {
        private String title;
        private String content;
        private String color;
    }
}
