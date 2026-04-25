package com.process.service.impl;

import com.process.entity.Flowchart;
import com.process.repository.FlowchartRepository;
import com.process.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FlowchartService extends AbstractDocumentService<Flowchart, FlowchartRepository> {

    public FlowchartService(FlowchartRepository repository, UserRepository userRepository) {
        super(repository, userRepository);
    }

    @Override
    protected List<Flowchart> findByUserId(Long userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Override
    protected Optional<Flowchart> findByIdAndUserId(Long id, Long userId) {
        return repository.findByIdAndUserId(id, userId);
    }

    @Override
    protected Flowchart createEntity() {
        return new Flowchart();
    }
}
