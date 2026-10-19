package com.example.diagram.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.example.diagram.model.Diagram;

import java.util.List;
import java.util.Optional;

public interface DiagramRepository extends JpaRepository<Diagram, Long> {

	Optional<Diagram> findByIdAndUserId(Long id, String userId);

	List<Diagram> findAllByUserIdOrderByUpdatedAtDesc(String userId);

	@Query("select coalesce(max(d.sequenceNo), 0) from Diagram d where d.userId = :userId")
	long findMaxSequenceNoByUserId(@Param("userId") String userId);
}
