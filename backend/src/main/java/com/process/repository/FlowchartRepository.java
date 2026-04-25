package com.process.repository;

import com.process.entity.Flowchart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlowchartRepository extends JpaRepository<Flowchart, Long> {
    List<Flowchart> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<Flowchart> findByIdAndUserId(Long id, Long userId);
}
