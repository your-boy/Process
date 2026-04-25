package com.process.controller;

import com.process.dto.ApiResponse;
import com.process.dto.DocumentDTO;
import com.process.service.impl.FlowchartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/flowcharts")
@RequiredArgsConstructor
public class FlowchartController {

    private final FlowchartService flowchartService;

    @GetMapping
    public ApiResponse<List<DocumentDTO>> list(@AuthenticationPrincipal UserDetails user) {
        return flowchartService.list(user.getUsername());
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDTO> get(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return flowchartService.get(id, user.getUsername());
    }

    @PostMapping
    public ApiResponse<DocumentDTO> create(
            @RequestBody DocumentDTO.CreateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return flowchartService.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentDTO> update(
            @PathVariable Long id,
            @RequestBody DocumentDTO.UpdateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return flowchartService.update(id, request, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return flowchartService.delete(id, user.getUsername());
    }
}
