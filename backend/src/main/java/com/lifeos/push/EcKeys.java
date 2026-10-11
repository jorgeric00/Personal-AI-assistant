package com.lifeos.push;

import java.math.BigInteger;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/** Utilidades para claves EC P-256 en el formato que usa Web Push (punto sin comprimir y base64url). */
public final class EcKeys {

    private static final ECParameterSpec P256 = p256();

    private EcKeys() {
    }

    public static KeyPair generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Punto sin comprimir: 0x04 || X (32 bytes) || Y (32 bytes). */
    public static byte[] encodePublic(ECPublicKey key) {
        byte[] result = new byte[65];
        result[0] = 0x04;
        copyUnsigned(key.getW().getAffineX(), result, 1);
        copyUnsigned(key.getW().getAffineY(), result, 33);
        return result;
    }

    public static ECPublicKey decodePublic(byte[] encoded) {
        if (encoded.length != 65 || encoded[0] != 0x04) {
            throw new IllegalArgumentException("Clave pública EC no válida");
        }
        try {
            ECPoint point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(encoded, 1, 33)),
                    new BigInteger(1, Arrays.copyOfRange(encoded, 33, 65)));
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Clave pública EC no válida", e);
        }
    }

    public static byte[] encodePrivate(ECPrivateKey key) {
        byte[] result = new byte[32];
        copyUnsigned(key.getS(), result, 0);
        return result;
    }

    public static ECPrivateKey decodePrivate(byte[] encoded) {
        try {
            return (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, encoded), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Clave privada EC no válida", e);
        }
    }

    public static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static byte[] fromBase64Url(String value) {
        return Base64.getUrlDecoder().decode(value.trim().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    private static void copyUnsigned(BigInteger value, byte[] target, int offset) {
        byte[] bytes = value.toByteArray();
        int start = Math.max(0, bytes.length - 32);
        int length = bytes.length - start;
        System.arraycopy(bytes, start, target, offset + 32 - length, length);
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            return parameters.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
