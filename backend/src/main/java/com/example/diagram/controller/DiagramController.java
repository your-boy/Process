package com.example.diagram.controller;

import com.example.diagram.model.AppUser;
import com.example.diagram.model.Diagram;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.service.AuthFacade;
import com.example.diagram.service.DiagramRevisionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/diagrams")
public class DiagramController {

    private static final int MAX_TITLE_LENGTH = 100;
    private static final int MAX_PAGES = 100;
    private static final int MAX_NODES_PER_PAGE = 5000;
    private static final int MAX_EDGES_PER_PAGE = 5000;
    private static final int MAX_CONTENT_BYTES = 20 * 1024 * 1024;
    private static final Set<String> ALLOWED_MODES = new HashSet<>(Arrays.asList(
        "flowchart", "mindmap", "markdown", "mind-note"
    ));

    private final DiagramRepository repository;
    private final ObjectMapper objectMapper;
    private final AuthFacade authFacade;
    private final DiagramRevisionService revisionService;

    public DiagramController(
        DiagramRepository repository,
        ObjectMapper objectMapper,
        AuthFacade authFacade,
        DiagramRevisionService revisionService
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.authFacade = authFacade;
        this.revisionService = revisionService;
    }

    @GetMapping
    public List<DiagramDocumentDto> list(
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestParam(value = "summary", defaultValue = "false") boolean summary
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        return repository.findAllByUserIdOrderByUpdatedAtDesc(currentUser.getUserId())
            .stream()
            .map(diagram -> summary ? toSummaryDto(diagram) : toDto(diagram))
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
        diagram.setContent(toValidatedJson(normalized.getContent()));
        Diagram saved = repository.save(diagram);
        revisionService.snapshot(saved, "create");
        return toDto(saved);
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
        diagram.setContent(toValidatedJson(normalized.getContent()));
        Diagram saved = repository.save(diagram);
        revisionService.snapshot(saved, "save");
        return ResponseEntity.ok(toDto(saved));
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

    // ── 历史版本 ────────────────────────────────────────────────

    @GetMapping("/{id}/revisions")
    public ResponseEntity<List<DiagramRevisionDto>> listRevisions(
        @PathVariable Long id,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        Optional<Diagram> existing = repository.findByIdAndUserId(id, currentUser.getUserId());
        if (!existing.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        List<DiagramRevisionDto> items = revisionService.list(id, currentUser.getUserId())
            .stream()
            .map(this::toRevisionDto)
            .toList();
        return ResponseEntity.ok(items);
    }

    @GetMapping("/{id}/revisions/{revisionId}")
    public ResponseEntity<DiagramDocumentDto> getRevision(
        @PathVariable Long id,
        @PathVariable Long revisionId,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        return revisionService.findOne(id, revisionId, currentUser.getUserId())
            .map(revision -> {
                DiagramDocumentDto dto = new DiagramDocumentDto();
                dto.setId(id);
                dto.setTitle(revision.getTitle());
                dto.setMode(revision.getMode());
                dto.setContent(fromJson(revision.getContent()));
                dto.setUpdatedAt(revision.getCreatedAt());
                dto.setCreatedAt(revision.getCreatedAt());
                return ResponseEntity.ok(dto);
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/revisions/{revisionId}/restore")
    public ResponseEntity<DiagramDocumentDto> restoreRevision(
        @PathVariable Long id,
        @PathVariable Long revisionId,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        AppUser currentUser = authFacade.authenticate(authorizationHeader);
        Optional<Diagram> existing = repository.findByIdAndUserId(id, currentUser.getUserId());
        if (!existing.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Optional<com.example.diagram.model.DiagramRevision> revision =
            revisionService.findOne(id, revisionId, currentUser.getUserId());
        if (!revision.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Diagram diagram = existing.get();
        // 先把「当前状态」存一份，保证回滚本身也能再回滚
        revisionService.snapshot(diagram, "before-restore");

        com.example.diagram.model.DiagramRevision snapshot = revision.get();
        diagram.setTitle(snapshot.getTitle());
        diagram.setMode(snapshot.getMode());
        diagram.setContent(snapshot.getContent());
        Diagram saved = repository.save(diagram);
        revisionService.snapshot(saved, "restore");
        return ResponseEntity.ok(toDto(saved));
    }

    private DiagramRevisionDto toRevisionDto(com.example.diagram.model.DiagramRevision revision) {
        DiagramRevisionDto dto = new DiagramRevisionDto();
        dto.setId(revision.getId());
        dto.setRevisionNo(revision.getRevisionNo());
        dto.setTitle(revision.getTitle());
        dto.setMode(revision.getMode());
        dto.setSource(revision.getSource());
        dto.setSizeBytes(revision.getContent() == null
            ? 0
            : revision.getContent().getBytes(StandardCharsets.UTF_8).length);
        dto.setCreatedAt(revision.getCreatedAt());
        return dto;
    }

    private DiagramDocumentDto validateDocument(DiagramDocumentDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请求体不能为空");
        }
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "标题不能为空");
        }
        String title = request.getTitle().trim();
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "标题不能超过 100 个字符");
        }
        String mode = request.getMode() == null ? "" : request.getMode().trim();
        if (!ALLOWED_MODES.contains(mode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文档模式无效");
        }
        if (request.getContent() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "内容不能为空");
        }

        validatePageLimits(request.getContent());
        request.setTitle(title);
        request.setMode(mode);
        return request;
    }

    private void validatePageLimits(Map<String, Object> content) {
        validatePageLimits(content, true);
    }

    @SuppressWarnings("unchecked")
    private void validatePageLimits(Map<String, Object> page, boolean root) {
        if (!root) {
            validateCollectionLimit(page.get("nodes"), MAX_NODES_PER_PAGE, "单页图形数量过多");
            validateCollectionLimit(page.get("edges"), MAX_EDGES_PER_PAGE, "单页连线数量过多");
        } else {
            validateCollectionLimit(page.get("nodes"), MAX_NODES_PER_PAGE, "图形数量过多");
            validateCollectionLimit(page.get("edges"), MAX_EDGES_PER_PAGE, "连线数量过多");
        }

        Object pagesValue = page.get("pages");
        if (root && pagesValue instanceof List) {
            List<?> pages = (List<?>) pagesValue;
            if (pages.size() > MAX_PAGES) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "页面数量不能超过 100");
            }
            for (Object item : pages) {
                if (item instanceof Map) {
                    validatePageLimits((Map<String, Object>) item, false);
                }
            }
        }
    }

    private void validateCollectionLimit(Object value, int limit, String message) {
        if (value instanceof List && ((List<?>) value).size() > limit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        if (value != null && !(value instanceof List)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文档结构不正确");
        }
    }

    private String toValidatedJson(Map<String, Object> content) {
        String json = toJson(content);
        if (json.getBytes(StandardCharsets.UTF_8).length > MAX_CONTENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "文档内容超过 20 MB 限制");
        }
        return json;
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

    private DiagramDocumentDto toSummaryDto(Diagram diagram) {
        DiagramDocumentDto dto = toDto(diagram);
        Map<String, Object> content = dto.getContent();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("nodes", summarizeNodes(content.get("nodes")));
        summary.put("edges", summarizeEdges(content.get("edges")));
        summary.put("sourceText", truncateText(content.get("sourceText"), 500));
        summary.put("page", content.get("page"));
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("previewOnly", true);
        summary.put("meta", meta);
        dto.setContent(summary);
        dto.setSummaryOnly(true);
        return dto;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> summarizeNodes(Object value) {
        if (!(value instanceof List)) {
            return new ArrayList<>();
        }
        final int limit = 12;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : (List<Object>) value) {
            if (result.size() >= limit || !(item instanceof Map)) {
                break;
            }
            Map<String, Object> node = (Map<String, Object>) item;
            Map<String, Object> summary = new LinkedHashMap<>();
            for (String key : Arrays.asList("id", "kind", "x", "y", "width", "height", "text", "rotation")) {
                if (node.containsKey(key)) {
                    summary.put(key, node.get(key));
                }
            }
            result.add(summary);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> summarizeEdges(Object value) {
        if (!(value instanceof List)) {
            return new ArrayList<>();
        }
        final int limit = 12;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : (List<Object>) value) {
            if (result.size() >= limit || !(item instanceof Map)) {
                break;
            }
            Map<String, Object> edge = (Map<String, Object>) item;
            Map<String, Object> summary = new LinkedHashMap<>();
            for (String key : Arrays.asList("id", "fromNodeId", "toNodeId", "label")) {
                if (edge.containsKey(key)) {
                    summary.put(key, edge.get(key));
                }
            }
            result.add(summary);
        }
        return result;
    }

    private String truncateText(Object value, int maxLength) {
        if (value == null) {
            return "";
        }
        String text = String.valueOf(value);
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
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
