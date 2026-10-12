package com.lifeos.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;

import org.junit.jupiter.api.Test;

class WebPushEncryptionTest {

    @Test
    void browserCanDecryptWhatServerEncrypts() throws Exception {
        KeyPair browser = EcKeys.generate();
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        String message = "{\"title\":\"Pádel\",\"body\":\"Hoy a las 19:00\"}";

        byte[] body = WebPushEncryption.encrypt(message.getBytes(StandardCharsets.UTF_8),
                EcKeys.encodePublic((ECPublicKey) browser.getPublic()), auth);

        assertThat(WebPushDecryptor.decrypt(body, browser, auth)).isEqualTo(message);
        // sal (16) + rs (4) + longitud de clave (1) + clave (65) + contenido + delimitador + etiqueta GCM (16)
        assertThat(body).hasSize(86 + message.getBytes(StandardCharsets.UTF_8).length + 1 + 16);
    }

    @Test
    void wrongAuthSecretCannotDecrypt() {
        KeyPair browser = EcKeys.generate();
        byte[] body = WebPushEncryption.encrypt("hola".getBytes(StandardCharsets.UTF_8),
                EcKeys.encodePublic((ECPublicKey) browser.getPublic()), new byte[16]);
        byte[] otherAuth = new byte[16];
        otherAuth[0] = 1;
        assertThatThrownBy(() -> WebPushDecryptor.decrypt(body, browser, otherAuth)).isInstanceOf(Exception.class);
    }

    @Test
    void keysRoundTripThroughBase64Url() {
        KeyPair pair = EcKeys.generate();
        byte[] publicKey = EcKeys.encodePublic((ECPublicKey) pair.getPublic());
        byte[] privateKey = EcKeys.encodePrivate((ECPrivateKey) pair.getPrivate());
        assertThat(EcKeys.encodePublic(EcKeys.decodePublic(EcKeys.fromBase64Url(EcKeys.base64Url(publicKey)))))
                .isEqualTo(publicKey);
        assertThat(EcKeys.encodePrivate(EcKeys.decodePrivate(privateKey))).isEqualTo(privateKey);
    }
}
