package com.process.controller;

import com.process.dto.ApiResponse;
import com.process.dto.DocumentDTO;
import com.process.service.impl.MindmapService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/mindmaps")
@RequiredArgsConstructor
public class MindmapController {

    private final MindmapService mindmapService;

    @GetMapping
    public ApiResponse<List<DocumentDTO>> list(@AuthenticationPrincipal UserDetails user) {
        return mindmapService.list(user.getUsername());
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDTO> get(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return mindmapService.get(id, user.getUsername());
    }

    @PostMapping
    public ApiResponse<DocumentDTO> create(
            @RequestBody DocumentDTO.CreateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return mindmapService.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentDTO> update(
            @PathVariable Long id,
            @RequestBody DocumentDTO.UpdateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return mindmapService.update(id, request, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return mindmapService.delete(id, user.getUsername());
    }
}
