package com.example.diagram.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException exception) {
        HttpStatus status = exception.getStatus();
        String error = status == null ? String.valueOf(exception.getRawStatusCode()) : status.getReasonPhrase();
        String message = exception.getReason() == null || exception.getReason().trim().isEmpty()
            ? error
            : exception.getReason();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", exception.getRawStatusCode());
        body.put("error", error);
        body.put("message", message);
        return ResponseEntity.status(exception.getRawStatusCode()).body(body);
    }
}