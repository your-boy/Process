package com.example.diagram.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

	@Query("""
		select new com.example.diagram.repository.DiagramSummaryView(
			d.id, d.sequenceNo, d.title, d.mode, d.previewJson,
			d.createdAt, d.updatedAt
		)
		from Diagram d
		where d.userId = :userId
		  and (:mode = '' or d.mode = :mode)
		  and (:search = '' or lower(concat(
		      d.title, ' ', coalesce(d.summaryText, ''), ' ', coalesce(d.searchText, '')
		  )) like :search)
		""")
	Page<DiagramSummaryView> findSummaries(
		@Param("userId") String userId,
		@Param("mode") String mode,
		@Param("search") String search,
		Pageable pageable
	);
}
