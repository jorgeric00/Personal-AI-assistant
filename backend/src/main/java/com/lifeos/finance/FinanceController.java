package com.lifeos.finance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.common.config.LifeosProperties;
import com.lifeos.finance.FinanceDtos.AccountRequest;
import com.lifeos.finance.FinanceDtos.AccountResponse;
import com.lifeos.finance.FinanceDtos.CategoryRequest;
import com.lifeos.finance.FinanceDtos.CategoryResponse;
import com.lifeos.finance.FinanceDtos.MonthSummary;
import com.lifeos.finance.FinanceDtos.MovementPage;
import com.lifeos.finance.FinanceDtos.MovementRequest;
import com.lifeos.finance.FinanceDtos.MovementResponse;
import com.lifeos.finance.FinanceDtos.TagResponse;
import com.lifeos.finance.FinanceDtos.Trend;

@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    private final MovementService movementService;
    private final FinanceCatalogService catalogService;
    private final FinanceReportService reportService;
    private final LifeosProperties properties;
    private final Clock clock;

    public FinanceController(MovementService movementService, FinanceCatalogService catalogService,
            FinanceReportService reportService, LifeosProperties properties, Clock clock) {
        this.movementService = movementService;
        this.catalogService = catalogService;
        this.reportService = reportService;
        this.properties = properties;
        this.clock = clock;
    }

    @GetMapping("/movements")
    public MovementPage movements(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) MovementKind kind,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(MovementService.MAX_PAGE_SIZE) int size) {
        return movementService.list(user.id(), new MovementService.Filter(from, to, kind, categoryId, accountId,
                tag == null || tag.isBlank() ? null : tag, q), page, size);
    }

    @GetMapping("/movements/{id}")
    public MovementResponse movement(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return movementService.get(user.id(), id);
    }

    @PostMapping("/movements")
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody MovementRequest request) {
        return movementService.create(user.id(), request);
    }

    @PutMapping("/movements/{id}")
    public MovementResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody MovementRequest request) {
        return movementService.update(user.id(), id, request);
    }

    @DeleteMapping("/movements/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        movementService.delete(user.id(), id);
    }

    @GetMapping("/tags")
    public List<TagResponse> tags(@AuthenticationPrincipal AppUserPrincipal user) {
        return movementService.tags(user.id());
    }

    @GetMapping("/summary")
    public MonthSummary summary(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) YearMonth month) {
        return reportService.month(user.id(), month != null ? month : currentMonth());
    }

    @GetMapping("/trend")
    public Trend trend(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) YearMonth to,
            @RequestParam(defaultValue = "12") @Min(1) @Max(FinanceReportService.MAX_TREND_MONTHS) int months) {
        return reportService.trend(user.id(), to != null ? to : currentMonth(), months);
    }

    @GetMapping("/categories")
    public List<CategoryResponse> categories(@AuthenticationPrincipal AppUserPrincipal user) {
        return catalogService.categories(user.id());
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody CategoryRequest request) {
        return catalogService.createCategory(user.id(), request);
    }

    @PutMapping("/categories/{id}")
    public CategoryResponse updateCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody CategoryRequest request) {
        return catalogService.updateCategory(user.id(), id, request);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        catalogService.deleteCategory(user.id(), id);
    }

    @GetMapping("/accounts")
    public List<AccountResponse> accounts(@AuthenticationPrincipal AppUserPrincipal user) {
        return catalogService.accounts(user.id());
    }

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse createAccount(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody AccountRequest request) {
        return catalogService.createAccount(user.id(), request);
    }

    @PutMapping("/accounts/{id}")
    public AccountResponse renameAccount(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody AccountRequest request) {
        return catalogService.renameAccount(user.id(), id, request);
    }

    @DeleteMapping("/accounts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        catalogService.deleteAccount(user.id(), id);
    }

    private YearMonth currentMonth() {
        return YearMonth.now(clock.withZone(properties.timezone()));
    }
}
