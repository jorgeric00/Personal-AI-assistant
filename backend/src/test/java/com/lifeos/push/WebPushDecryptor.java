package com.lifeos.push;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Lado del navegador (receptor) de RFC 8291, implementado de forma independiente para las pruebas. */
final class WebPushDecryptor {

    private WebPushDecryptor() {
    }

    static String decrypt(byte[] body, KeyPair userAgentKeys, byte[] authSecret) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        buffer.get(salt);
        int recordSize = buffer.getInt();
        if (recordSize != WebPushEncryption.RECORD_SIZE) {
            throw new IllegalStateException("rs inesperado: " + recordSize);
        }
        byte[] serverPublic = new byte[buffer.get()];
        buffer.get(serverPublic);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(userAgentKeys.getPrivate());
        agreement.doPhase(EcKeys.decodePublic(serverPublic), true);
        byte[] shared = agreement.generateSecret();

        byte[] uaPublic = EcKeys.encodePublic((ECPublicKey) userAgentKeys.getPublic());
        byte[] keyInfo = WebPushEncryption.concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic,
                serverPublic);
        byte[] ikm = WebPushEncryption.hkdf(authSecret, shared, keyInfo, 32);
        byte[] cek = WebPushEncryption.hkdf(salt, ikm,
                "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = WebPushEncryption.hkdf(salt, ikm,
                "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = cipher.doFinal(ciphertext);
        if (padded[padded.length - 1] != 2) {
            throw new IllegalStateException("Falta el delimitador del último registro");
        }
        return new String(Arrays.copyOf(padded, padded.length - 1), StandardCharsets.UTF_8);
    }
}
