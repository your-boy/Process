package com.example.diagram.repository;

import java.time.LocalDateTime;

/**
 * Lightweight workspace projection. It intentionally excludes the document
 * content LOB and full-text search index.
 */
public class DiagramSummaryView {

    private final Long id;
    private final Long sequenceNo;
    private final String title;
    private final String mode;
    private final String previewJson;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public DiagramSummaryView(
        Long id,
        Long sequenceNo,
        String title,
        String mode,
        String previewJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {
        this.id = id;
        this.sequenceNo = sequenceNo;
        this.title = title;
        this.mode = mode;
        this.previewJson = previewJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getSequenceNo() {
        return sequenceNo;
    }

    public String getTitle() {
        return title;
    }

    public String getMode() {
        return mode;
    }

    public String getPreviewJson() {
        return previewJson;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
