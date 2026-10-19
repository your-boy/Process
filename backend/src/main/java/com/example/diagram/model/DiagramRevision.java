package com.example.diagram.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 文档版本快照：每次保存（自动保存/手动保存/恢复）落一条，用于「历史记录」与回滚。
 */
@Entity
@Table(name = "diagram_revision")
public class DiagramRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "diagram_id", nullable = false)
    private Long diagramId;

    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 32)
    private String mode;

    @Lob
    @Column(nullable = false)
    private String content;

    @Column(name = "revision_no", nullable = false)
    private long revisionNo;

    @Column(name = "change_source", nullable = false, length = 16)
    private String source;

    private LocalDateTime createdAt;

    public DiagramRevision() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getDiagramId() {
        return diagramId;
    }

    public void setDiagramId(Long diagramId) {
        this.diagramId = diagramId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public long getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(long revisionNo) {
        this.revisionNo = revisionNo;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
