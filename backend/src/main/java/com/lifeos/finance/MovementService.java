package com.lifeos.finance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.common.text.SearchText;
import com.lifeos.finance.FinanceDtos.AccountResponse;
import com.lifeos.finance.FinanceDtos.CategoryResponse;
import com.lifeos.finance.FinanceDtos.MovementPage;
import com.lifeos.finance.FinanceDtos.MovementRequest;
import com.lifeos.finance.FinanceDtos.MovementResponse;
import com.lifeos.finance.FinanceDtos.TagResponse;
import com.lifeos.finance.FinanceDtos.Totals;

@Service
public class MovementService {

    public static final int MAX_PAGE_SIZE = 200;
    private static final int TAG_MAX_LENGTH = 40;

    /** Filtros del historial; todos opcionales. */
    public record Filter(LocalDate from, LocalDate to, MovementKind kind, UUID categoryId, UUID accountId, String tag,
            String query) {
    }

    private final MovementRepository movements;
    private final FinanceCatalogService catalog;
    private final FinanceSetupService setup;
    private final RecurringService recurring;
    private final ApplicationEventPublisher events;
    private final EntityManager entityManager;
    private final Clock clock;

    public MovementService(MovementRepository movements, FinanceCatalogService catalog, FinanceSetupService setup,
            RecurringService recurring, ApplicationEventPublisher events, EntityManager entityManager, Clock clock) {
        this.movements = movements;
        this.catalog = catalog;
        this.setup = setup;
        this.recurring = recurring;
        this.events = events;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    /** Historial paginado (más recientes primero) con los totales de todo lo filtrado. */
    @Transactional(readOnly = true)
    public MovementPage list(UUID userId, Filter filter, int page, int size) {
        String currency = setup.currency(userId);
        recurring.generateDue(userId);
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();

        CriteriaQuery<Movement> query = cb.createQuery(Movement.class);
        Root<Movement> root = query.from(Movement.class);
        root.fetch("category");
        root.fetch("account", jakarta.persistence.criteria.JoinType.LEFT);
        query.select(root).where(predicates(cb, root, userId, filter))
                .orderBy(cb.desc(root.get("date")), cb.desc(root.get("createdAt")), cb.asc(root.get("id")));
        List<MovementResponse> items = entityManager.createQuery(query)
                .setFirstResult(page * size).setMaxResults(size)
                .getResultList().stream().map(MovementService::toResponse).toList();

        CriteriaQuery<Tuple> sums = cb.createTupleQuery();
        Root<Movement> sumRoot = sums.from(Movement.class);
        sums.multiselect(sumRoot.get("kind"), cb.sum(sumRoot.<Long>get("amountCents")), cb.count(sumRoot))
                .where(predicates(cb, sumRoot, userId, filter))
                .groupBy(sumRoot.get("kind"));
        long income = 0;
        long expense = 0;
        long count = 0;
        for (Tuple row : entityManager.createQuery(sums).getResultList()) {
            long total = Objects.requireNonNullElse(row.get(1, Long.class), 0L);
            if (row.get(0, MovementKind.class) == MovementKind.INCOME) {
                income = total;
            } else {
                expense = total;
            }
            count += row.get(2, Long.class);
        }
        return new MovementPage(items, page, size, count, Totals.of(income, expense), currency);
    }

    @Transactional(readOnly = true)
    public MovementResponse get(UUID userId, UUID id) {
        return toResponse(load(userId, id));
    }

    @Transactional
    public MovementResponse create(UUID userId, MovementRequest request) {
        Movement movement = new Movement(userId, setup.currency(userId), clock.instant());
        apply(userId, movement, request);
        changed(movement);
        return toResponse(movements.save(movement));
    }

    @Transactional
    public MovementResponse update(UUID userId, UUID id, MovementRequest request) {
        Movement movement = load(userId, id);
        Set<UUID> categories = new java.util.HashSet<>(Set.of(movement.getCategory().getId()));
        Set<YearMonth> months = new java.util.HashSet<>(Set.of(YearMonth.from(movement.getDate())));
        apply(userId, movement, request);
        categories.add(movement.getCategory().getId());
        months.add(YearMonth.from(movement.getDate()));
        events.publishEvent(new MovementsChanged(userId, categories, months));
        return toResponse(movement);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Movement movement = load(userId, id);
        changed(movement);
        movements.delete(movement);
    }

    private void changed(Movement movement) {
        events.publishEvent(new MovementsChanged(movement.getUserId(), Set.of(movement.getCategory().getId()),
                Set.of(YearMonth.from(movement.getDate()))));
    }

    @Transactional(readOnly = true)
    public List<TagResponse> tags(UUID userId) {
        return movements.countTags(userId).stream().map(t -> new TagResponse(t.getName(), t.getCount())).toList();
    }

    private void apply(UUID userId, Movement movement, MovementRequest request) {
        FinanceCategory category = catalog.loadCategory(userId, request.categoryId());
        FinanceAccount account = request.accountId() == null ? null : catalog.loadAccount(userId, request.accountId());
        Set<String> tags = SearchText.normalizeTags(request.tags());
        boolean keepsArchivedCategory = movement.getCategory() != null
                && movement.getCategory().getId().equals(category.getId());
        new FieldValidationException.Collector()
                .add(category.getKind() != request.kind(), "categoryId", "finance.movement.category.kind-mismatch")
                .add(category.isArchived() && !keepsArchivedCategory, "categoryId", "finance.movement.category.archived")
                .add(tags.stream().anyMatch(t -> t.length() > TAG_MAX_LENGTH), "tags", "finance.movement.tags.too-long")
                .throwIfAny();
        movement.edit(request.kind(), request.amountCents(), request.date(), category, account,
                Objects.requireNonNullElse(request.description(), "").strip(), tags, clock.instant());
    }

    private Movement load(UUID userId, UUID id) {
        return movements.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private static Predicate[] predicates(CriteriaBuilder cb, Root<Movement> root, UUID userId, Filter filter) {
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(root.get("userId"), userId));
        if (filter.from() != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("date"), filter.from()));
        }
        if (filter.to() != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("date"), filter.to()));
        }
        if (filter.kind() != null) {
            predicates.add(cb.equal(root.get("kind"), filter.kind()));
        }
        if (filter.categoryId() != null) {
            predicates.add(cb.equal(root.get("category").get("id"), filter.categoryId()));
        }
        if (filter.accountId() != null) {
            predicates.add(cb.equal(root.get("account").get("id"), filter.accountId()));
        }
        if (filter.tag() != null) {
            Set<String> tag = SearchText.normalizeTags(List.of(filter.tag()));
            predicates.add(cb.isMember(tag.isEmpty() ? "" : tag.iterator().next(), root.get("tags")));
        }
        for (String term : SearchText.terms(filter.query())) {
            predicates.add(cb.like(root.get("searchText"), SearchText.containsPattern(term), '\\'));
        }
        return predicates.toArray(Predicate[]::new);
    }

    static MovementResponse toResponse(Movement movement) {
        return new MovementResponse(movement.getId(), movement.getKind(), movement.getAmountCents(),
                movement.getCurrency(), movement.getDate(), CategoryResponse.from(movement.getCategory()),
                AccountResponse.from(movement.getAccount()), movement.getDescription(),
                movement.getTags().stream().sorted().toList(),
                movement.getRecurring() == null ? null : movement.getRecurring().getId(), movement.getCreatedAt(),
                movement.getUpdatedAt());
    }
}
