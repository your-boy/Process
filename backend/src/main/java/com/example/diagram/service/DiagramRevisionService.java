package com.example.diagram.service;

import com.example.diagram.model.Diagram;
import com.example.diagram.model.DiagramRevision;
import com.example.diagram.repository.DiagramRevisionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 文档历史：保存时落快照，超出上限自动裁剪，支持按版本回滚。
 */
@Service
public class DiagramRevisionService {

    private final DiagramRevisionRepository repository;
    private final int maxRevisionsPerDiagram;

    public DiagramRevisionService(
        DiagramRevisionRepository repository,
        @Value("${app.revision.max-per-diagram:50}") int maxRevisionsPerDiagram
    ) {
        this.repository = repository;
        this.maxRevisionsPerDiagram = Math.max(5, maxRevisionsPerDiagram);
    }

    /** 记录一次快照；内容与上一条完全一致时跳过，避免自动保存刷出一堆重复版本。 */
    @Transactional
    public void snapshot(Diagram diagram, String source) {
        if (diagram == null || diagram.getId() == null) {
            return;
        }

        List<DiagramRevision> existing = repository
            .findByDiagramIdAndUserIdOrderByCreatedAtDesc(diagram.getId(), diagram.getUserId());

        if (!existing.isEmpty()) {
            DiagramRevision latest = existing.get(0);
            boolean sameContent = String.valueOf(diagram.getContent()).equals(String.valueOf(latest.getContent()))
                && String.valueOf(diagram.getTitle()).equals(String.valueOf(latest.getTitle()));
            if (sameContent) {
                return;
            }
        }

        DiagramRevision revision = new DiagramRevision();
        revision.setDiagramId(diagram.getId());
        revision.setUserId(diagram.getUserId());
        revision.setTitle(diagram.getTitle());
        revision.setMode(diagram.getMode());
        revision.setContent(diagram.getContent());
        revision.setRevisionNo(existing.size() + 1L);
        revision.setSource(source == null ? "save" : source);
        repository.save(revision);

        prune(diagram, existing);
    }

    private void prune(Diagram diagram, List<DiagramRevision> existing) {
        int overflow = existing.size() + 1 - maxRevisionsPerDiagram;
        if (overflow <= 0) {
            return;
        }
        // existing 已按时间倒序，末尾是最旧的
        for (int index = existing.size() - overflow; index < existing.size(); index += 1) {
            if (index >= 0) {
                repository.delete(existing.get(index));
            }
        }
    }

    @Transactional(readOnly = true)
    public List<DiagramRevision> list(Long diagramId, String userId) {
        return repository.findByDiagramIdAndUserIdOrderByCreatedAtDesc(diagramId, userId);
    }

    @Transactional(readOnly = true)
    public Optional<DiagramRevision> findOne(Long diagramId, Long revisionId, String userId) {
        return repository.findByIdAndDiagramIdAndUserId(revisionId, diagramId, userId);
    }
}
