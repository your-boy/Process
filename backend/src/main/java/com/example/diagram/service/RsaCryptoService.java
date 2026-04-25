package com.example.diagram.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

@Service
public class RsaCryptoService {

    private static final OAEPParameterSpec RSA_OAEP_SHA256_SPEC = new OAEPParameterSpec(
        "SHA-256",
        "MGF1",
        MGF1ParameterSpec.SHA256,
        PSource.PSpecified.DEFAULT
    );

    private final KeyPair keyPair = generateKeyPair();

    public String getPublicKeyPem() {
        String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.UTF_8))
            .encodeToString(keyPair.getPublic().getEncoded());
        return "-----BEGIN PUBLIC KEY-----\n" + body + "\n-----END PUBLIC KEY-----";
    }

    public String decrypt(String encryptedValue) {
        try {
            byte[] encryptedBytes = Base64.getDecoder().decode(encryptedValue);
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.DECRYPT_MODE, keyPair.getPrivate(), RSA_OAEP_SHA256_SPEC);
            return new String(cipher.doFinal(encryptedBytes), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密文解析失败", exception);
        }
    }

    private KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法初始化 RSA 密钥对", exception);
        }
    }
}