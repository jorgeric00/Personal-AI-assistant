package com.lifeos.notes;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

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
class NoteIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    NoteService noteService;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from note");
        jdbc.update("delete from task");
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/notes").statusCode()).isEqualTo(401);
    }

    @Test
    void createsAndEditsNoteWithNormalizedTags() {
        HttpResponse<String> created = api.post("/api/notes", """
                {"title":"  Ideas para el viaje ","body":"Mirar vuelos a Lisboa","tags":["#Viajes","viajes"," Ocio  libre "]}
                """);
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String id = JsonPath.read(created.body(), "$.id");
        assertThat(JsonPath.<String>read(created.body(), "$.title")).isEqualTo("Ideas para el viaje");
        assertThat(JsonPath.<List<String>>read(created.body(), "$.tags")).containsExactly("ocio libre", "viajes");
        assertThat(JsonPath.<String>read(created.body(), "$.createdAt")).isEqualTo("2026-10-11T10:00:00Z");

        clock.set(Instant.parse("2026-10-11T11:00:00Z"));
        HttpResponse<String> updated = api.put("/api/notes/" + id,
                "{\"title\":\"Ideas para el viaje\",\"body\":\"Vuelos y hotel\",\"tags\":[\"viajes\"]}");
        assertThat(JsonPath.<String>read(updated.body(), "$.body")).isEqualTo("Vuelos y hotel");
        assertThat(JsonPath.<String>read(updated.body(), "$.createdAt")).isEqualTo("2026-10-11T10:00:00Z");
        assertThat(JsonPath.<String>read(updated.body(), "$.updatedAt")).isEqualTo("2026-10-11T11:00:00Z");

        assertThat(api.get("/api/note-tags").body()).isEqualTo("[{\"name\":\"viajes\",\"count\":1}]");
    }

    @Test
    void rejectsEmptyNote() {
        HttpResponse<String> response = api.post("/api/notes", "{\"title\":\" \",\"body\":\"\\n\"}");
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).contains("Escribe un título o algo de contenido");
    }

    @Test
    void searchesIgnoringCaseAndAccentsWithAllWords() {
        String cafe = create("Café de especialidad", "Probar el tueste de Etiopía", "compras");
        String recipe = create("Receta de pan", "Harina, agua y sal", "cocina");
        create("Libros", "Leer más ensayo", null);

        assertThat(ids(search("cafe"))).containsExactly(cafe);
        assertThat(ids(search("ETIOPIA tueste"))).containsExactly(cafe);
        assertThat(ids(search("pan sal"))).containsExactly(recipe);
        assertThat(ids(search("pan café"))).isEmpty();
        assertThat(ids(search("cocina"))).as("las etiquetas también se buscan").containsExactly(recipe);
        assertThat(ids(search("100%"))).isEmpty();
        assertThat(ids(api.get("/api/notes?tag=%23Compras"))).containsExactly(cafe);
    }

    @Test
    void pinnedNotesComeFirstAndFavoritesHaveTheirView() {
        String older = create("Antigua", "a", null);
        clock.set(Instant.parse("2026-10-11T12:00:00Z"));
        String newer = create("Nueva", "b", null);

        assertThat(ids(api.get("/api/notes"))).containsExactly(newer, older);

        api.patch("/api/notes/" + older, "{\"pinned\":true}");
        api.patch("/api/notes/" + newer, "{\"favorite\":true}");
        assertThat(ids(api.get("/api/notes"))).containsExactly(older, newer);
        assertThat(ids(api.get("/api/notes?pinned=true"))).containsExactly(older);
        assertThat(ids(api.get("/api/notes?view=FAVORITES"))).containsExactly(newer);
    }

    @Test
    void archiveTrashRestoreAndDelete() {
        String id = create("Contraseña del wifi", "en el router", null);
        api.patch("/api/notes/" + id, "{\"pinned\":true}");

        HttpResponse<String> archived = api.post("/api/notes/" + id + "/archive", null);
        assertThat(JsonPath.<String>read(archived.body(), "$.state")).isEqualTo("ARCHIVED");
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.pinned")).isFalse();
        assertThat(ids(api.get("/api/notes"))).isEmpty();
        assertThat(ids(api.get("/api/notes?view=ARCHIVED"))).containsExactly(id);
        assertThat(api.patch("/api/notes/" + id, "{\"pinned\":true}").statusCode()).isEqualTo(409);

        // Solo se borra para siempre desde la papelera
        assertThat(api.delete("/api/notes/" + id).statusCode()).isEqualTo(409);

        HttpResponse<String> trashed = api.post("/api/notes/" + id + "/trash", null);
        assertThat(JsonPath.<String>read(trashed.body(), "$.state")).isEqualTo("TRASHED");
        assertThat(ids(api.get("/api/notes?view=TRASH"))).containsExactly(id);
        assertThat(api.put("/api/notes/" + id, "{\"title\":\"Otra\"}").statusCode()).isEqualTo(409);
        assertThat(api.get("/api/note-tags").body()).isEqualTo("[]");

        HttpResponse<String> restored = api.post("/api/notes/" + id + "/restore", null);
        assertThat(JsonPath.<String>read(restored.body(), "$.state")).isEqualTo("ACTIVE");

        api.post("/api/notes/" + id + "/trash", null);
        assertThat(api.delete("/api/notes/" + id).statusCode()).isEqualTo(204);
        assertThat(api.get("/api/notes/" + id).statusCode()).isEqualTo(404);
    }

    @Test
    void emptiesTrashAndPurgesAfterThirtyDays() {
        String recent = create("Reciente", "x", null);
        String old = create("Vieja", "y", null);
        String kept = create("Activa", "z", null);
        api.post("/api/notes/" + old + "/trash", null);
        clock.set(Instant.parse("2026-11-05T10:00:00Z"));
        api.post("/api/notes/" + recent + "/trash", null);

        clock.set(Instant.parse("2026-11-11T10:00:01Z"));
        assertThat(noteService.purgeExpiredTrash()).isEqualTo(1);
        assertThat(ids(api.get("/api/notes?view=TRASH"))).containsExactly(recent);

        assertThat(api.delete("/api/notes/trash").statusCode()).isEqualTo(204);
        assertThat(ids(api.get("/api/notes?view=TRASH"))).isEmpty();
        assertThat(ids(api.get("/api/notes"))).containsExactly(kept);
    }

    @Test
    void linksNotesToOwnTasks() {
        HttpResponse<String> task = api.post("/api/tasks",
                "{\"kind\":\"TASK\",\"title\":\"Preparar el viaje\",\"priority\":\"MEDIUM\",\"dueDate\":\"2026-10-20\"}");
        String taskId = JsonPath.read(task.body(), "$.id");

        HttpResponse<String> note = api.post("/api/notes",
                "{\"title\":\"Maleta\",\"body\":\"Cargador\",\"taskIds\":[\"" + taskId + "\"]}");
        assertThat(note.statusCode()).as(note.body()).isEqualTo(201);
        assertThat(JsonPath.<String>read(note.body(), "$.tasks[0].title")).isEqualTo("Preparar el viaje");
        String noteId = JsonPath.read(note.body(), "$.id");
        assertThat(ids(api.get("/api/notes?taskId=" + taskId))).containsExactly(noteId);

        HttpResponse<String> unknown = api.post("/api/notes",
                "{\"title\":\"Otra\",\"taskIds\":[\"00000000-0000-0000-0000-000000000001\"]}");
        assertThat(unknown.statusCode()).isEqualTo(400);
        assertThat(unknown.body()).contains("Alguna de las tareas relacionadas ya no existe");

        // Al borrar la tarea, la nota se conserva sin la relación
        api.delete("/api/tasks/" + taskId);
        assertThat(JsonPath.<List<Object>>read(api.get("/api/notes/" + noteId).body(), "$.tasks")).isEmpty();
    }

    private String create(String title, String body, String tag) {
        String tags = tag == null ? "[]" : "[\"" + tag + "\"]";
        HttpResponse<String> response = api.post("/api/notes",
                "{\"title\":\"" + title + "\",\"body\":\"" + body + "\",\"tags\":" + tags + "}");
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return JsonPath.read(response.body(), "$.id");
    }

    private HttpResponse<String> search(String query) {
        return api.get("/api/notes?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8));
    }

    private static List<String> ids(HttpResponse<String> response) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return JsonPath.read(response.body(), "$[*].id");
    }
}
