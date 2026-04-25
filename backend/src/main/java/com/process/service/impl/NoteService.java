package com.process.service.impl;

import com.process.dto.ApiResponse;
import com.process.dto.NoteDTO;
import com.process.entity.Note;
import com.process.entity.User;
import com.process.repository.NoteRepository;
import com.process.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));
    }

    private NoteDTO toDTO(Note note) {
        NoteDTO dto = new NoteDTO();
        dto.setId(note.getId());
        dto.setTitle(note.getTitle());
        dto.setContent(note.getContent());
        dto.setColor(note.getColor());
        dto.setCreatedAt(note.getCreatedAt());
        dto.setUpdatedAt(note.getUpdatedAt());
        return dto;
    }

    public ApiResponse<List<NoteDTO>> list(String username) {
        User user = getUser(username);
        return ApiResponse.success(
                noteRepository.findByUserIdOrderByUpdatedAtDesc(user.getId())
                        .stream().map(this::toDTO).collect(Collectors.toList())
        );
    }

    public ApiResponse<NoteDTO> get(Long id, String username) {
        User user = getUser(username);
        return noteRepository.findByIdAndUserId(id, user.getId())
                .map(note -> ApiResponse.success(toDTO(note)))
                .orElse(ApiResponse.error(404, "随记不存在"));
    }

    public ApiResponse<NoteDTO> create(NoteDTO.CreateRequest request, String username) {
        User user = getUser(username);
        Note note = new Note();
        note.setTitle(request.getTitle());
        note.setContent(request.getContent());
        note.setColor(request.getColor());
        note.setUser(user);
        return ApiResponse.success(toDTO(noteRepository.save(note)));
    }

    public ApiResponse<NoteDTO> update(Long id, NoteDTO.UpdateRequest request, String username) {
        User user = getUser(username);
        Note note = noteRepository.findByIdAndUserId(id, user.getId()).orElse(null);
        if (note == null) return ApiResponse.error(404, "随记不存在");
        if (request.getTitle() != null) note.setTitle(request.getTitle());
        if (request.getContent() != null) note.setContent(request.getContent());
        if (request.getColor() != null) note.setColor(request.getColor());
        return ApiResponse.success(toDTO(noteRepository.save(note)));
    }

    public ApiResponse<Void> delete(Long id, String username) {
        User user = getUser(username);
        Note note = noteRepository.findByIdAndUserId(id, user.getId()).orElse(null);
        if (note == null) return ApiResponse.error(404, "随记不存在");
        noteRepository.delete(note);
        return ApiResponse.success();
    }
}
