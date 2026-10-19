package com.example.diagram.repository;

import com.example.diagram.model.DiagramRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DiagramRevisionRepository extends JpaRepository<DiagramRevision, Long> {

    List<DiagramRevision> findByDiagramIdAndUserIdOrderByCreatedAtDesc(Long diagramId, String userId);

    Optional<DiagramRevision> findByIdAndDiagramIdAndUserId(Long id, Long diagramId, String userId);

    long countByDiagramIdAndUserId(Long diagramId, String userId);
}
