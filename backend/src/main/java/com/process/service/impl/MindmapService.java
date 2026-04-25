package com.process.service.impl;

import com.process.entity.Mindmap;
import com.process.repository.MindmapRepository;
import com.process.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MindmapService extends AbstractDocumentService<Mindmap, MindmapRepository> {

    public MindmapService(MindmapRepository repository, UserRepository userRepository) {
        super(repository, userRepository);
    }

    @Override
    protected List<Mindmap> findByUserId(Long userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Override
    protected Optional<Mindmap> findByIdAndUserId(Long id, Long userId) {
        return repository.findByIdAndUserId(id, userId);
    }

    @Override
    protected Mindmap createEntity() {
        return new Mindmap();
    }
}
