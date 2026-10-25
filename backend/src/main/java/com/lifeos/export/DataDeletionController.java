package com.lifeos.export;

import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;

@RestController
@RequestMapping("/api/data")
public class DataDeletionController {

    public record DeleteRequest(Set<DataScope> scopes, String password) {
    }

    private final DataDeletionService service;

    public DataDeletionController(DataDeletionService service) {
        this.service = service;
    }

    /** Borra para siempre los bloques indicados. Es un POST porque lleva la contraseña en el cuerpo. */
    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @RequestBody DeleteRequest request) {
        service.delete(user.id(), request.scopes(), request.password());
    }
}
