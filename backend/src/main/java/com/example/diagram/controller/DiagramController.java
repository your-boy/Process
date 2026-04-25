package com.example.diagram.controller;

import com.example.diagram.model.AppUser;
import com.example.diagram.model.Diagram;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.service.AuthFacade;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/diagrams")
@CrossOrigin(origins = "*")
public class DiagramController {

    private final DiagramRepository repository;
    private final ObjectMapper objectMapper;
    private final AuthFacade authFacade;

    public DiagramController(DiagramRepository repository, ObjectMapper objectMapper, AuthFacade authFacade) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.authFacade = authFacade;
    }

    @GetMapping
    public List<DiagramDocumentDto> list(
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        return repository.findAllByUserIdOrderByUpdatedAtDesc(currentUser.getUserId())
            .stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @PostMapping
    public DiagramDocumentDto create(
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestBody DiagramDocumentDto request
    ) {
        DiagramDocumentDto normalized = validateDocument(request);
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        Diagram diagram = new Diagram();
        diagram.setTitle(normalized.getTitle());
        diagram.setMode(normalized.getMode());
        diagram.setUserId(currentUser.getUserId());
        diagram.setContent(toJson(normalized.getContent()));
        return toDto(repository.save(diagram));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DiagramDocumentDto> get(
        @PathVariable Long id,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        Optional<Diagram> opt = repository.findByIdAndUserId(id, currentUser.getUserId());
        return opt.map(this::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<DiagramDocumentDto> update(
        @PathVariable Long id,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestBody DiagramDocumentDto request
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        String currentUserId = currentUser.getUserId();
        Optional<Diagram> existing = repository.findByIdAndUserId(id, currentUserId);
        if (!existing.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        DiagramDocumentDto normalized = validateDocument(request);
        Diagram diagram = existing.get();
        diagram.setTitle(normalized.getTitle());
        diagram.setMode(normalized.getMode());
        diagram.setContent(toJson(normalized.getContent()));
        return ResponseEntity.ok(toDto(repository.save(diagram)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @PathVariable Long id,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        Optional<Diagram> existing = repository.findByIdAndUserId(id, currentUser.getUserId());
        if (!existing.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        repository.delete(existing.get());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ping")
    public String ping() { return "pong"; }

    private DiagramDocumentDto validateDocument(DiagramDocumentDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请求体不能为空");
        }
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "标题不能为空");
        }
        if (request.getMode() == null || request.getMode().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "模式不能为空");
        }
        if (request.getContent() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "内容不能为空");
        }

        request.setTitle(request.getTitle().trim());
        request.setMode(request.getMode().trim());
        return request;
    }

    private DiagramDocumentDto toDto(Diagram diagram) {
        DiagramDocumentDto dto = new DiagramDocumentDto();
        dto.setId(diagram.getId());
        dto.setTitle(diagram.getTitle());
        dto.setMode(diagram.getMode());
        dto.setContent(fromJson(diagram.getContent()));
        dto.setCreatedAt(diagram.getCreatedAt());
        dto.setUpdatedAt(diagram.getUpdatedAt());
        return dto;
    }

    private String toJson(Map<String, Object> content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文档内容序列化失败", exception);
        }
    }

    private Map<String, Object> fromJson(String content) {
        try {
            return objectMapper.readValue(content, new TypeReference<Map<String, Object>>() { });
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "文档内容解析失败", exception);
        }
    }
}
