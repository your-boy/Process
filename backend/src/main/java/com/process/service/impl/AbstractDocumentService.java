package com.process.service.impl;

import com.process.dto.ApiResponse;
import com.process.dto.DocumentDTO;
import com.process.entity.BaseDocument;
import com.process.entity.User;
import com.process.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

@RequiredArgsConstructor
public abstract class AbstractDocumentService<T extends BaseDocument, R extends JpaRepository<T, Long>> {

    protected final R repository;
    protected final UserRepository userRepository;

    protected abstract List<T> findByUserId(Long userId);
    protected abstract Optional<T> findByIdAndUserId(Long id, Long userId);
    protected abstract T createEntity();

    protected User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));
    }

    protected DocumentDTO toDTO(T doc) {
        DocumentDTO dto = new DocumentDTO();
        dto.setId(doc.getId());
        dto.setTitle(doc.getTitle());
        dto.setContent(doc.getContent());
        dto.setCreatedAt(doc.getCreatedAt());
        dto.setUpdatedAt(doc.getUpdatedAt());
        return dto;
    }

    public ApiResponse<List<DocumentDTO>> list(String username) {
        User user = getUser(username);
        List<DocumentDTO> list = findByUserId(user.getId()).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return ApiResponse.success(list);
    }

    public ApiResponse<DocumentDTO> get(Long id, String username) {
        User user = getUser(username);
        T doc = findByIdAndUserId(id, user.getId())
                .orElse(null);
        if (doc == null) {
            return ApiResponse.error(404, "文档不存在");
        }
        return ApiResponse.success(toDTO(doc));
    }

    public ApiResponse<DocumentDTO> create(DocumentDTO.CreateRequest request, String username) {
        User user = getUser(username);
        T doc = createEntity();
        doc.setTitle(request.getTitle());
        doc.setContent(request.getContent());
        doc.setUser(user);
        T saved = repository.save(doc);
        return ApiResponse.success(toDTO(saved));
    }

    public ApiResponse<DocumentDTO> update(Long id, DocumentDTO.UpdateRequest request, String username) {
        User user = getUser(username);
        T doc = findByIdAndUserId(id, user.getId())
                .orElse(null);
        if (doc == null) {
            return ApiResponse.error(404, "文档不存在");
        }
        if (request.getTitle() != null) doc.setTitle(request.getTitle());
        if (request.getContent() != null) doc.setContent(request.getContent());
        T saved = repository.save(doc);
        return ApiResponse.success(toDTO(saved));
    }

    public ApiResponse<Void> delete(Long id, String username) {
        User user = getUser(username);
        T doc = findByIdAndUserId(id, user.getId())
                .orElse(null);
        if (doc == null) {
            return ApiResponse.error(404, "文档不存在");
        }
        repository.delete(doc);
        return ApiResponse.success();
    }
}
