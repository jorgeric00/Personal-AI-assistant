package com.lifeos.finance;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
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
import com.lifeos.common.config.LifeosProperties;
import com.lifeos.finance.FinanceDtos.AccountRequest;
import com.lifeos.finance.FinanceDtos.BudgetRequest;
import com.lifeos.finance.FinanceDtos.BudgetStatus;
import com.lifeos.finance.FinanceDtos.ImportResult;
import com.lifeos.finance.FinanceDtos.RecurringRequest;
import com.lifeos.finance.FinanceDtos.RecurringResponse;
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
    private final BudgetService budgetService;
    private final RecurringService recurringService;
    private final FinanceCsvService csvService;
    private final LifeosProperties properties;
    private final Clock clock;

    public FinanceController(MovementService movementService, FinanceCatalogService catalogService,
            FinanceReportService reportService, BudgetService budgetService, RecurringService recurringService,
            FinanceCsvService csvService, LifeosProperties properties, Clock clock) {
        this.movementService = movementService;
        this.catalogService = catalogService;
        this.reportService = reportService;
        this.budgetService = budgetService;
        this.recurringService = recurringService;
        this.csvService = csvService;
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

    @GetMapping("/budgets")
    public List<BudgetStatus> budgets(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) YearMonth month) {
        return budgetService.list(user.id(), month != null ? month : currentMonth());
    }

    /** Crea o cambia el presupuesto de una categoría. */
    @PutMapping("/budgets")
    public BudgetStatus setBudget(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody BudgetRequest request) {
        return budgetService.set(user.id(), request.categoryId(), request.amountCents(), currentMonth());
    }

    @DeleteMapping("/budgets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBudget(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        budgetService.delete(user.id(), id);
    }

    @GetMapping("/recurring")
    public List<RecurringResponse> recurring(@AuthenticationPrincipal AppUserPrincipal user) {
        return recurringService.list(user.id());
    }

    @PostMapping("/recurring")
    @ResponseStatus(HttpStatus.CREATED)
    public RecurringResponse createRecurring(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody RecurringRequest request) {
        return recurringService.create(user.id(), request);
    }

    @PostMapping("/recurring/{id}/stop")
    public RecurringResponse stopRecurring(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return recurringService.stop(user.id(), id);
    }

    @DeleteMapping("/recurring/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecurring(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        recurringService.delete(user.id(), id);
    }

    /** Descarga los movimientos del intervalo (por defecto, todos) en CSV con BOM para que Excel lea las tildes. */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        String csv = "\uFEFF" + csvService.export(user.id(), from != null ? from : LocalDate.of(1900, 1, 1),
                to != null ? to : LocalDate.of(9999, 12, 31));
        String filename = "lifeos-movimientos-" + LocalDate.now(clock.withZone(properties.timezone())) + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult importCsv(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam("file") MultipartFile file) throws IOException {
        try (InputStream input = file.getInputStream()) {
            return csvService.importCsv(user.id(), input);
        }
    }

    private YearMonth currentMonth() {
        return YearMonth.now(clock.withZone(properties.timezone()));
    }
}
