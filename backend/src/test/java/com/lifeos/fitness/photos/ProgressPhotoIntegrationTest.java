package com.lifeos.fitness.photos;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.jayway.jsonpath.JsonPath;
import com.lifeos.TestcontainersConfiguration;
import com.lifeos.support.ApiClient;
import com.lifeos.support.MutableClock;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class ProgressPhotoIntegrationTest {

    private static final String SECRET = "GPS-41.38N-2.17E";

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from progress_photo");
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void storesAReducedCopyWithoutMetadataAndServesItPrivately() throws Exception {
        HttpResponse<String> created = upload(withExif(image(3000, 1500, "jpeg")), "image/jpeg",
                Map.of("takenOn", "2026-10-11", "pose", "FRONT", "notes", "  Tras el verano  "));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String id = JsonPath.read(created.body(), "$.id");
        assertThat(JsonPath.<Integer>read(created.body(), "$.width")).isEqualTo(2048);
        assertThat(JsonPath.<Integer>read(created.body(), "$.height")).isEqualTo(1024);
        assertThat(JsonPath.<String>read(created.body(), "$.notes")).isEqualTo("Tras el verano");

        HttpResponse<byte[]> full = api.getBytes("/api/fitness/photos/" + id + "/image");
        assertThat(full.statusCode()).isEqualTo(200);
        assertThat(full.headers().firstValue("Content-Type")).hasValue("image/jpeg");
        assertThat(full.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
        assertThat(new String(full.body(), StandardCharsets.ISO_8859_1)).doesNotContain(SECRET);
        assertThat(ImageIO.read(new ByteArrayInputStream(full.body())).getWidth()).isEqualTo(2048);

        HttpResponse<byte[]> thumb = api.getBytes("/api/fitness/photos/" + id + "/image?size=thumb");
        BufferedImage small = ImageIO.read(new ByteArrayInputStream(thumb.body()));
        assertThat(small.getWidth()).isEqualTo(480);
        assertThat(small.getHeight()).isEqualTo(240);

        // Una PNG también vale; la lista va de la más reciente a la más antigua
        assertThat(upload(image(400, 600, "png"), "image/png", Map.of("takenOn", "2026-10-12", "pose", "SIDE"))
                .statusCode()).isEqualTo(201);
        HttpResponse<String> list = api.get("/api/fitness/photos");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].takenOn")).containsExactly("2026-10-12",
                "2026-10-11");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].pose")).containsExactly("SIDE", "FRONT");

        HttpResponse<String> updated = api.put("/api/fitness/photos/" + id,
                "{\"takenOn\":\"2026-10-01\",\"pose\":\"BACK\",\"notes\":\"\"}");
        assertThat(updated.statusCode()).as(updated.body()).isEqualTo(200);
        assertThat(JsonPath.<String>read(updated.body(), "$.pose")).isEqualTo("BACK");
        assertThat(JsonPath.<Object>read(updated.body(), "$.notes")).isNull();

        assertThat(api.getBytes("/api/fitness/photos/" + UUID.randomUUID() + "/image").statusCode()).isEqualTo(404);
        assertThat(api.delete("/api/fitness/photos/" + id).statusCode()).isEqualTo(204);
        assertThat(api.getBytes("/api/fitness/photos/" + id + "/image").statusCode()).isEqualTo(404);
        assertThat(jdbc.queryForObject("select count(*) from progress_photo_data", Integer.class)).isEqualTo(1);
    }

    @Test
    void rejectsFilesThatAreNotImagesAndInvalidFields() throws Exception {
        HttpResponse<String> text = upload("hola".getBytes(StandardCharsets.UTF_8), "image/jpeg",
                Map.of("takenOn", "2026-10-13", "pose", "SIDEWAYS"));
        assertThat(text.statusCode()).as(text.body()).isEqualTo(400);
        assertThat(JsonPath.<String>read(text.body(), "$.errors.file")).contains("JPEG o PNG");
        assertThat(JsonPath.<String>read(text.body(), "$.errors.takenOn")).isEqualTo("La fecha no puede ser futura");
        assertThat(JsonPath.<String>read(text.body(), "$.errors.pose")).isEqualTo("Elige el encuadre");

        HttpResponse<String> missing = upload(null, null, Map.of("takenOn", "ayer", "pose", "FRONT"));
        assertThat(missing.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(missing.body(), "$.errors.file")).isEqualTo("Elige una foto");
        assertThat(JsonPath.<String>read(missing.body(), "$.errors.takenOn")).isEqualTo("La fecha no es válida");

        HttpResponse<String> tooBig = upload(new byte[11 * 1024 * 1024], "image/jpeg",
                Map.of("takenOn", "2026-10-12", "pose", "FRONT"));
        assertThat(tooBig.statusCode()).isEqualTo(413);
        assertThat(JsonPath.<String>read(tooBig.body(), "$.title")).isEqualTo("Archivo demasiado grande");
        assertThat(jdbc.queryForObject("select count(*) from progress_photo", Integer.class)).isZero();
    }

    private static byte[] image(int width, int height, String format) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < width; x += 10) {
            image.getGraphics().drawLine(x, 0, x, height);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    /** Inserta un bloque EXIF (APP1) con una "ubicación" justo después del inicio del JPEG. */
    private static byte[] withExif(byte[] jpeg) {
        byte[] payload = ("Exif\0\0" + SECRET).getBytes(StandardCharsets.ISO_8859_1);
        int length = payload.length + 2;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        out.write(0xFF);
        out.write(0xE1);
        out.write(length >> 8);
        out.write(length & 0xFF);
        out.writeBytes(payload);
        out.write(jpeg, 2, jpeg.length - 2);
        byte[] result = out.toByteArray();
        assertThat(new String(result, StandardCharsets.ISO_8859_1)).contains(SECRET);
        return result;
    }

    private HttpResponse<String> upload(byte[] file, String type, Map<String, String> fields) {
        String boundary = "lifeos-photo-boundary";
        List<byte[]> parts = new ArrayList<>();
        fields.forEach((name, value) -> parts.add(("--" + boundary + "\r\nContent-Disposition: form-data; name=\""
                + name + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8)));
        if (file != null) {
            parts.add(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"foto\"\r\n"
                    + "Content-Type: " + type + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            parts.add(file);
            parts.add("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        parts.add(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        parts.forEach(body::writeBytes);
        return api.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/fitness/photos"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())), true);
    }

}
