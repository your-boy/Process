package com.example.diagram.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.diagram.model.Diagram;

import java.util.List;
import java.util.Optional;

public interface DiagramRepository extends JpaRepository<Diagram, Long> {

	Optional<Diagram> findByIdAndUserId(Long id, String userId);

	List<Diagram> findAllByUserIdOrderByUpdatedAtDesc(String userId);
}
