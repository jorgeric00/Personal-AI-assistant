package com.lifeos.export;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;

@RestController
@RequestMapping("/api/export")
public class DataExportController {

    private final DataExportService service;

    public DataExportController(DataExportService service) {
        this.service = service;
    }

    /** Descarga un ZIP con todos los datos del usuario. Contiene datos sensibles: no se guarda en cachés. */
    @GetMapping
    public void export(@AuthenticationPrincipal AppUserPrincipal user, HttpServletResponse response)
            throws IOException {
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(service.fileName()).build().toString());
        response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        service.write(user.id(), response.getOutputStream());
    }
}
