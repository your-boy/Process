package com.process.service.impl;

import com.process.entity.Markdown;
import com.process.repository.MarkdownRepository;
import com.process.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MarkdownService extends AbstractDocumentService<Markdown, MarkdownRepository> {

    public MarkdownService(MarkdownRepository repository, UserRepository userRepository) {
        super(repository, userRepository);
    }

    @Override
    protected List<Markdown> findByUserId(Long userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Override
    protected Optional<Markdown> findByIdAndUserId(Long id, Long userId) {
        return repository.findByIdAndUserId(id, userId);
    }

    @Override
    protected Markdown createEntity() {
        return new Markdown();
    }
}
