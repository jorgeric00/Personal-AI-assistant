package com.lifeos.finance;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.finance.FinanceDtos.AccountRequest;
import com.lifeos.finance.FinanceDtos.AccountResponse;
import com.lifeos.finance.FinanceDtos.CategoryRequest;
import com.lifeos.finance.FinanceDtos.CategoryResponse;

/** Categorías y cuentas de finanzas. */
@Service
public class FinanceCatalogService {

    private static final UUID NONE = new UUID(0, 0);

    private final FinanceCategoryRepository categories;
    private final FinanceAccountRepository accounts;
    private final MovementRepository movements;
    private final FinanceSetupService setup;
    private final Clock clock;

    public FinanceCatalogService(FinanceCategoryRepository categories, FinanceAccountRepository accounts,
            MovementRepository movements, FinanceSetupService setup, Clock clock) {
        this.categories = categories;
        this.accounts = accounts;
        this.movements = movements;
        this.setup = setup;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> categories(UUID userId) {
        setup.currency(userId);
        return categories.findByUserIdOrderByKindAscNameAsc(userId).stream().map(CategoryResponse::from).toList();
    }

    @Transactional
    public CategoryResponse createCategory(UUID userId, CategoryRequest request) {
        setup.currency(userId);
        String name = request.name().strip();
        checkCategoryName(userId, request.kind(), name, NONE);
        return CategoryResponse.from(
                categories.save(new FinanceCategory(userId, request.kind(), name, request.color(), clock.instant())));
    }

    /** El tipo de una categoría no cambia: sus movimientos dejarían de cuadrar. */
    @Transactional
    public CategoryResponse updateCategory(UUID userId, UUID id, CategoryRequest request) {
        FinanceCategory category = loadCategory(userId, id);
        String name = request.name().strip();
        checkCategoryName(userId, category.getKind(), name, id);
        category.update(name, request.color(), Boolean.TRUE.equals(request.archived()));
        return CategoryResponse.from(category);
    }

    /** Una categoría con movimientos no se borra (se perdería su historial); se puede archivar. */
    @Transactional
    public void deleteCategory(UUID userId, UUID id) {
        FinanceCategory category = loadCategory(userId, id);
        if (movements.existsByCategoryId(id)) {
            throw new ConflictException("finance-category-in-use");
        }
        categories.delete(category);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> accounts(UUID userId) {
        return accounts.findByUserIdOrderByNameAsc(userId).stream().map(AccountResponse::from).toList();
    }

    @Transactional
    public AccountResponse createAccount(UUID userId, AccountRequest request) {
        String name = request.name().strip();
        checkAccountName(userId, name, NONE);
        return AccountResponse.from(accounts.save(new FinanceAccount(userId, name, clock.instant())));
    }

    @Transactional
    public AccountResponse renameAccount(UUID userId, UUID id, AccountRequest request) {
        FinanceAccount account = loadAccount(userId, id);
        String name = request.name().strip();
        checkAccountName(userId, name, id);
        account.rename(name);
        return AccountResponse.from(account);
    }

    /** Los movimientos de la cuenta se conservan sin cuenta (ON DELETE SET NULL). */
    @Transactional
    public void deleteAccount(UUID userId, UUID id) {
        accounts.delete(loadAccount(userId, id));
    }

    FinanceCategory loadCategory(UUID userId, UUID id) {
        return categories.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    FinanceAccount loadAccount(UUID userId, UUID id) {
        return accounts.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private void checkCategoryName(UUID userId, MovementKind kind, String name, UUID excludeId) {
        new FieldValidationException.Collector()
                .add(categories.existsByName(userId, kind, name, excludeId), "name", "finance.category.name.duplicate")
                .throwIfAny();
    }

    private void checkAccountName(UUID userId, String name, UUID excludeId) {
        new FieldValidationException.Collector()
                .add(accounts.existsByName(userId, name, excludeId), "name", "finance.account.name.duplicate")
                .throwIfAny();
    }
}
