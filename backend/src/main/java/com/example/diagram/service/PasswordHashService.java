package com.example.diagram.service;

import org.springframework.stereotype.Service;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

@Service
public class PasswordHashService {

    private static final String HASH_PREFIX = "pbkdf2_sha256";
    private static final int DEFAULT_ITERATIONS = 210000;
    private static final int KEY_LENGTH = 256;

    private final SecureRandom secureRandom = new SecureRandom();

    public String hash(String plainText) {
        byte[] salt = new byte[16];
        secureRandom.nextBytes(salt);
        return hashWithSalt(plainText, salt);
    }

    public String hashWithSalt(String plainText, byte[] salt) {
        String saltValue = Base64.getEncoder().encodeToString(salt);
        String hashValue = Base64.getEncoder().encodeToString(derive(plainText, salt, DEFAULT_ITERATIONS));
        return HASH_PREFIX + "$" + DEFAULT_ITERATIONS + "$" + saltValue + "$" + hashValue;
    }

    public boolean matches(String plainText, String storedHash) {
        if (plainText == null || storedHash == null || storedHash.trim().isEmpty()) {
            return false;
        }

        String[] parts = storedHash.split("\\$");
        if (parts.length != 4 || !HASH_PREFIX.equals(parts[0])) {
            return false;
        }

        try {
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            byte[] actual = derive(plainText, salt, iterations);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private byte[] derive(String plainText, byte[] salt, int iterations) {
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            PBEKeySpec spec = new PBEKeySpec(plainText.toCharArray(), salt, iterations, KEY_LENGTH);
            return factory.generateSecret(spec).getEncoded();
        } catch (InvalidKeySpecException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("密码哈希失败", exception);
        }
    }
}