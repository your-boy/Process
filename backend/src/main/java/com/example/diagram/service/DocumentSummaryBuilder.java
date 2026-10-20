package com.example.diagram.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DocumentSummaryBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_PREVIEW_NODES = 12;
    private static final int MAX_PREVIEW_EDGES = 12;
    private static final int MAX_PREVIEW_TEXT_BLOCKS = 12;
    private static final int MAX_PREVIEW_PAGES = 40;
    private static final int MAX_SOURCE_PREVIEW = 500;
    private static final int MAX_SEARCH_TEXT = 100_000;
    private static final Set<String> SEARCH_TEXT_KEYS = Set.of(
        "text", "note", "sourceText", "title", "label", "labels", "name",
        "summary", "description", "attachmentName", "content"
    );
    private static final Set<String> SEARCH_CONTAINER_KEYS = Set.of(
        "pages", "nodes", "edges", "textBlocks", "layers", "attachments",
        "table", "rows", "cells", "children"
    );

    private DocumentSummaryBuilder() {}

    public static SummaryPayload build(Map<String, Object> content) {
        Map<String, Object> safeContent = content == null ? Map.of() : content;
        List<Map<String, Object>> rawPages = pagesOf(safeContent);
        List<Map<String, Object>> previewPages = new ArrayList<>();
        int previewPageCount = Math.min(rawPages.size(), MAX_PREVIEW_PAGES);

        for (int index = 0; index < previewPageCount; index += 1) {
            Map<String, Object> page = rawPages.get(index);
            Map<String, Object> previewPage = new LinkedHashMap<>();
            previewPage.put("id", stringValue(page.get("id"), "page-" + (index + 1)));
            previewPage.put("name", stringValue(page.get("name"), String.valueOf(index + 1)));
            previewPage.put("page", page.get("page"));
            previewPage.put("nodes", summarizeNodes(page.get("nodes")));
            previewPage.put("edges", summarizeEdges(page.get("edges")));
            previewPage.put("textBlocks", summarizeTextBlocks(page.get("textBlocks")));
            previewPage.put("sourceText", truncate(stringValue(page.get("sourceText"), ""), MAX_SOURCE_PREVIEW));
            previewPages.add(previewPage);
        }

        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("activePageId", stringValue(safeContent.get("activePageId"),
            stringValue(previewPages.isEmpty() ? null : previewPages.get(0).get("id"), "page-1")));
        preview.put("pageCount", Math.max(1, rawPages.size()));
        preview.put("pages", previewPages);

        String summaryText = buildSummaryText(safeContent, rawPages);
        String searchText = buildSearchText(safeContent);
        try {
            return new SummaryPayload(
                MAPPER.writeValueAsString(preview),
                summaryText,
                searchText,
                Math.max(1, rawPages.size())
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize document preview", exception);
        }
    }

    public static Map<String, Object> parsePreview(String previewJson) {
        if (previewJson == null || previewJson.isBlank()) {
            return Map.of("activePageId", "page-1", "pages", List.of());
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = MAPPER.readValue(previewJson, Map.class);
            return parsed;
        } catch (JsonProcessingException exception) {
            return Map.of("activePageId", "page-1", "pages", List.of());
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> pagesOf(Map<String, Object> content) {
        Object pagesValue = content.get("pages");
        if (pagesValue instanceof List<?> pages && !pages.isEmpty()) {
            return pages.stream()
                .filter(Map.class::isInstance)
                .map(page -> (Map<String, Object>) page)
                .toList();
        }
        return List.of(content);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> summarizeNodes(Object value) {
        if (!(value instanceof List<?> items)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : items) {
            if (result.size() >= MAX_PREVIEW_NODES || !(item instanceof Map<?, ?> map)) {
                break;
            }
            Map<String, Object> node = (Map<String, Object>) map;
            Map<String, Object> summary = new LinkedHashMap<>();
            copy(node, summary, List.of("id", "kind", "x", "y", "width", "height", "text", "rotation",
                "collapsed", "floating", "layerId"));
            result.add(summary);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> summarizeEdges(Object value) {
        if (!(value instanceof List<?> items)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : items) {
            if (result.size() >= MAX_PREVIEW_EDGES || !(item instanceof Map<?, ?> map)) {
                break;
            }
            Map<String, Object> edge = (Map<String, Object>) map;
            Map<String, Object> summary = new LinkedHashMap<>();
            copy(edge, summary, List.of("id", "fromNodeId", "toNodeId", "label", "kind", "layerId"));
            result.add(summary);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> summarizeTextBlocks(Object value) {
        if (!(value instanceof List<?> items)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : items) {
            if (result.size() >= MAX_PREVIEW_TEXT_BLOCKS || !(item instanceof Map<?, ?> map)) {
                break;
            }
            Map<String, Object> block = (Map<String, Object>) map;
            Map<String, Object> summary = new LinkedHashMap<>();
            copy(block, summary, List.of("id", "nodeId", "parentId", "text", "width", "height",
                "offsetX", "offsetY", "order", "layerId"));
            result.add(summary);
        }
        return result;
    }

    private static String buildSummaryText(Map<String, Object> content, List<Map<String, Object>> pages) {
        String sourceText = stringValue(content.get("sourceText"), "");
        if (!sourceText.isBlank()) {
            List<String> lines = sourceText.lines()
                .map(line -> line.replaceFirst("^#+\\s*", "").trim())
                .filter(line -> !line.isBlank())
                .limit(2)
                .toList();
            if (!lines.isEmpty()) {
                return truncate(String.join(" / ", lines), 500);
            }
        }

        Set<String> labels = new LinkedHashSet<>();
        for (Map<String, Object> page : pages) {
            collectLabels(page.get("nodes"), labels);
            collectLabels(page.get("textBlocks"), labels);
            if (labels.size() >= 3) {
                break;
            }
        }
        return labels.isEmpty() ? "—" : truncate(String.join(" / ", labels), 500);
    }

    @SuppressWarnings("unchecked")
    private static void collectLabels(Object value, Set<String> labels) {
        if (!(value instanceof List<?> items)) {
            return;
        }
        for (Object item : items) {
            if (labels.size() >= 3) {
                return;
            }
            if (item instanceof Map<?, ?> map) {
                String text = stringValue(((Map<String, Object>) map).get("text"), "")
                    .replaceAll("\\s+", " ")
                    .trim();
                if (!text.isBlank()) {
                    labels.add(truncate(text, 20));
                }
            }
        }
    }

    private static String buildSearchText(Map<String, Object> content) {
        StringBuilder result = new StringBuilder();
        collectSearchValues(content, result);
        return truncate(result.toString().replaceAll("\\s+", " ").trim(), MAX_SEARCH_TEXT);
    }

    private static void collectSearchValues(Object value, StringBuilder result) {
        if (result.length() >= MAX_SEARCH_TEXT || value == null) {
            return;
        }
        if (value instanceof String text) {
            if (!text.isBlank()) {
                result.append(' ').append(text);
            }
            return;
        }
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (!SEARCH_TEXT_KEYS.contains(key) && !SEARCH_CONTAINER_KEYS.contains(key)) {
                    continue;
                }
                collectSearchValues(entry.getValue(), result);
            }
            return;
        }
        if (value instanceof Iterable<?> items) {
            for (Object item : items) {
                collectSearchValues(item, result);
                if (result.length() >= MAX_SEARCH_TEXT) {
                    return;
                }
            }
        }
    }

    private static void copy(Map<String, Object> source, Map<String, Object> target, List<String> keys) {
        for (String key : keys) {
            if (source.containsKey(key)) {
                target.put(key, source.get(key));
            }
        }
    }

    private static String stringValue(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String text = String.valueOf(value);
        return text.isBlank() ? fallback : text;
    }

    private static String truncate(String value, int maxLength) {
        String text = value == null ? "" : value.trim();
        return text.length() > maxLength ? text.substring(0, maxLength) + "…" : text;
    }

    public record SummaryPayload(String previewJson, String summaryText, String searchText, int pageCount) {}
}
