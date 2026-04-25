package com.process.repository;

import com.process.entity.Mindmap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MindmapRepository extends JpaRepository<Mindmap, Long> {
    List<Mindmap> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<Mindmap> findByIdAndUserId(Long id, Long userId);
}
