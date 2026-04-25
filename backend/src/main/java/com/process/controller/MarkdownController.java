package com.process.controller;

import com.process.dto.ApiResponse;
import com.process.dto.DocumentDTO;
import com.process.service.impl.MarkdownService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/markdowns")
@RequiredArgsConstructor
public class MarkdownController {

    private final MarkdownService markdownService;

    @GetMapping
    public ApiResponse<List<DocumentDTO>> list(@AuthenticationPrincipal UserDetails user) {
        return markdownService.list(user.getUsername());
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDTO> get(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return markdownService.get(id, user.getUsername());
    }

    @PostMapping
    public ApiResponse<DocumentDTO> create(
            @RequestBody DocumentDTO.CreateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return markdownService.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentDTO> update(
            @PathVariable Long id,
            @RequestBody DocumentDTO.UpdateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return markdownService.update(id, request, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return markdownService.delete(id, user.getUsername());
    }
}
