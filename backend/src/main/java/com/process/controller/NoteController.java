package com.process.controller;

import com.process.dto.ApiResponse;
import com.process.dto.NoteDTO;
import com.process.service.impl.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public ApiResponse<List<NoteDTO>> list(@AuthenticationPrincipal UserDetails user) {
        return noteService.list(user.getUsername());
    }

    @GetMapping("/{id}")
    public ApiResponse<NoteDTO> get(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return noteService.get(id, user.getUsername());
    }

    @PostMapping
    public ApiResponse<NoteDTO> create(
            @RequestBody NoteDTO.CreateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return noteService.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    public ApiResponse<NoteDTO> update(
            @PathVariable Long id,
            @RequestBody NoteDTO.UpdateRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return noteService.update(id, request, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return noteService.delete(id, user.getUsername());
    }
}
