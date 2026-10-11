package com.lifeos.push;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Cifrado del contenido de un mensaje Web Push (RFC 8291, codificación aes128gcm de RFC 8188),
 * implementado con la criptografía estándar de Java.
 */
public final class WebPushEncryption {

    static final int RECORD_SIZE = 4096;
    private static final SecureRandom RANDOM = new SecureRandom();

    private WebPushEncryption() {
    }

    public static byte[] encrypt(byte[] plaintext, byte[] userAgentPublicKey, byte[] authSecret) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, userAgentPublicKey, authSecret, EcKeys.generate(), salt);
    }

    /** Variante determinista para pruebas: clave efímera y sal proporcionadas. */
    static byte[] encrypt(byte[] plaintext, byte[] userAgentPublicKey, byte[] authSecret, KeyPair ephemeral,
            byte[] salt) {
        try {
            byte[] serverPublic = EcKeys.encodePublic((ECPublicKey) ephemeral.getPublic());

            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(ephemeral.getPrivate());
            agreement.doPhase(EcKeys.decodePublic(userAgentPublicKey), true);
            byte[] sharedSecret = agreement.generateSecret();

            byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), userAgentPublicKey,
                    serverPublic);
            byte[] ikm = hkdf(authSecret, sharedSecret, keyInfo, 32);
            byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
            byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            // Un único registro: contenido seguido del delimitador 0x02 (último registro, sin relleno).
            byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[] {2}));

            ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + serverPublic.length);
            header.put(salt).putInt(RECORD_SIZE).put((byte) serverPublic.length).put(serverPublic);
            return concat(header.array(), ciphertext);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se ha podido cifrar el mensaje push", e);
        }
    }

    /** HKDF-SHA256 (RFC 5869) para longitudes de hasta 32 bytes. */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        byte[] prk = hmac(salt, ikm);
        byte[] okm = hmac(prk, concat(info, new byte[] {1}));
        return Arrays.copyOf(okm, length);
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }
}
