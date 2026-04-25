package com.process.repository;

import com.process.entity.Markdown;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarkdownRepository extends JpaRepository<Markdown, Long> {
    List<Markdown> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<Markdown> findByIdAndUserId(Long id, Long userId);
}
