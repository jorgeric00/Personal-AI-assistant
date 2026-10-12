package com.lifeos.fitness.photos;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Set;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;

import org.springframework.stereotype.Component;

/**
 * Vuelve a codificar cada foto subida: comprueba que es una imagen de verdad, la reduce y la guarda como JPEG nuevo.
 * Al no copiar nada del fichero original se descartan los metadatos (ubicación GPS, modelo del móvil, fecha…).
 */
@Component
public class PhotoProcessor {

    static final int MAX_SIDE = 2048;
    static final int THUMB_SIDE = 480;
    /** Límite de píxeles antes de decodificar, para que una imagen enorme no agote la memoria. */
    static final long MAX_PIXELS = 30_000_000L;
    private static final Set<String> FORMATS = Set.of("jpeg", "png");

    public record Processed(byte[] image, byte[] thumbnail, int width, int height) {
    }

    public static class InvalidImageException extends Exception {
        private final String key;

        InvalidImageException(String key) {
            super(key);
            this.key = key;
        }

        public String key() {
            return key;
        }
    }

    public Processed process(byte[] bytes) throws InvalidImageException {
        BufferedImage source = read(bytes);
        BufferedImage image = scale(source, MAX_SIDE);
        BufferedImage thumbnail = scale(image, THUMB_SIDE);
        return new Processed(jpeg(image, 0.85f), jpeg(thumbnail, 0.8f), image.getWidth(), image.getHeight());
    }

    private BufferedImage read(byte[] bytes) throws InvalidImageException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = input == null ? null : ImageIO.getImageReaders(input);
            if (readers == null || !readers.hasNext()) {
                throw new InvalidImageException("fitness.photos.file.format");
            }
            ImageReader reader = readers.next();
            try {
                if (!FORMATS.contains(reader.getFormatName().toLowerCase())) {
                    throw new InvalidImageException("fitness.photos.file.format");
                }
                reader.setInput(input, true, true);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > MAX_PIXELS) {
                    throw new InvalidImageException("fitness.photos.file.dimensions");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            throw new InvalidImageException("fitness.photos.file.format");
        }
    }

    /** Reduce hasta que el lado mayor mida como mucho {@code side}, a mitades para que no pierda calidad. */
    static BufferedImage scale(BufferedImage source, int side) {
        BufferedImage current = toRgb(source);
        int longest = Math.max(current.getWidth(), current.getHeight());
        if (longest <= side) {
            return current;
        }
        double ratio = (double) side / longest;
        int targetW = Math.max(1, (int) Math.round(current.getWidth() * ratio));
        int targetH = Math.max(1, (int) Math.round(current.getHeight() * ratio));
        while (current.getWidth() != targetW || current.getHeight() != targetH) {
            int w = Math.max(targetW, current.getWidth() / 2);
            int h = Math.max(targetH, current.getHeight() / 2);
            BufferedImage next = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = next.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(current, 0, 0, w, h, null);
            g.dispose();
            current = next;
        }
        return current;
    }

    /** Copia los píxeles a RGB opaco (las transparencias de un PNG quedan sobre blanco). */
    private static BufferedImage toRgb(BufferedImage source) {
        if (source.getType() == BufferedImage.TYPE_INT_RGB) {
            return source;
        }
        BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
        g.drawImage(source, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static byte[] jpeg(BufferedImage image, float quality) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream output = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(output);
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), params);
        } catch (IOException e) {
            throw new IllegalStateException("No se ha podido codificar la imagen", e);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
