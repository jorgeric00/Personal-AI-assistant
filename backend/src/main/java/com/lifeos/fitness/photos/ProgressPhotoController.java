package com.lifeos.fitness.photos;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.fitness.photos.PhotoDtos.PhotoRequest;
import com.lifeos.fitness.photos.PhotoDtos.PhotoResponse;

@RestController
@RequestMapping("/api/fitness/photos")
public class ProgressPhotoController {

    private final ProgressPhotoService service;

    public ProgressPhotoController(ProgressPhotoService service) {
        this.service = service;
    }

    @GetMapping
    public List<PhotoResponse> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.list(user.id());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "takenOn", required = false) String takenOn,
            @RequestParam(value = "pose", required = false) String pose,
            @RequestParam(value = "notes", required = false) String notes) throws IOException {
        return service.create(user.id(), file == null ? null : file.getBytes(), takenOn, pose, notes);
    }

    @PutMapping("/{id}")
    public PhotoResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody PhotoRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.delete(user.id(), id);
    }

    /** La imagen nunca se guarda en cachés: son datos sensibles y el dispositivo puede ser compartido. */
    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @RequestParam(value = "size", defaultValue = "full") String size) {
        byte[] bytes = service.image(user.id(), id, "thumb".equals(size));
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.noStore())
                .header("Content-Disposition", "inline")
                .body(bytes);
    }
}
