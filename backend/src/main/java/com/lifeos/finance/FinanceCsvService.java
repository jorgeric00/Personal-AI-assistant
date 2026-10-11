package com.lifeos.finance;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.text.SearchText;
import com.lifeos.finance.FinanceDtos.ImportError;
import com.lifeos.finance.FinanceDtos.ImportResult;

/**
 * Exportación e importación CSV de movimientos. El formato es el mismo en ambos sentidos para poder hacer copias
 * y migrar datos: date,type,amount,currency,category,account,description,tags (importe con punto decimal y
 * etiquetas separadas por «;»). Al importar se acepta también «;» como separador, cabeceras en español, coma
 * decimal y los tipos ingreso/gasto. La importación es todo o nada y no duplica movimientos ya existentes.
 */
@Service
public class FinanceCsvService {

    public static final int MAX_ROWS = 10_000;
    static final List<String> HEADER = List.of("date", "type", "amount", "currency", "category", "account",
            "description", "tags");
    private static final String NEW_CATEGORY_COLOR = "#64748b";
    private static final Pattern AMOUNT = Pattern.compile("^\\d{1,3}([.,]?\\d{3})*([.,]\\d{1,2})?$|^\\d+([.,]\\d{1,2})?$");

    private static final Map<String, String> HEADER_ALIASES = Map.ofEntries(
            Map.entry("fecha", "date"), Map.entry("tipo", "type"), Map.entry("importe", "amount"),
            Map.entry("moneda", "currency"), Map.entry("categoria", "category"), Map.entry("cuenta", "account"),
            Map.entry("descripcion", "description"), Map.entry("etiquetas", "tags"));

    private final MovementRepository movements;
    private final FinanceCategoryRepository categories;
    private final FinanceAccountRepository accounts;
    private final FinanceSetupService setup;
    private final ApplicationEventPublisher events;
    private final MessageSource messages;
    private final Clock clock;

    public FinanceCsvService(MovementRepository movements, FinanceCategoryRepository categories,
            FinanceAccountRepository accounts, FinanceSetupService setup, ApplicationEventPublisher events,
            MessageSource messages, Clock clock) {
        this.movements = movements;
        this.categories = categories;
        this.accounts = accounts;
        this.setup = setup;
        this.events = events;
        this.messages = messages;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public String export(UUID userId, LocalDate from, LocalDate to) {
        StringBuilder csv = new StringBuilder(String.join(",", HEADER)).append("\r\n");
        for (Movement m : movements.findForExport(userId, from, to)) {
            List<String> row = List.of(m.getDate().toString(), m.getKind().name(),
                    BigDecimal.valueOf(m.getAmountCents(), 2).toPlainString(), m.getCurrency(),
                    m.getCategory().getName(), m.getAccount() == null ? "" : m.getAccount().getName(),
                    m.getDescription(), String.join(";", m.getTags().stream().sorted().toList()));
            csv.append(String.join(",", row.stream().map(FinanceCsvService::quote).toList())).append("\r\n");
        }
        return csv.toString();
    }

    private record Row(int line, MovementKind kind, long cents, LocalDate date, String category, String account,
            String description, Set<String> tags) {

        String key(UUID categoryId) {
            return kind + "|" + cents + "|" + date + "|" + categoryId + "|" + description;
        }
    }

    @Transactional
    public ImportResult importCsv(UUID userId, InputStream input) throws IOException {
        String currency = setup.currency(userId);
        List<List<String>> records = parse(new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8)));
        List<ImportError> errors = new ArrayList<>();
        if (records.isEmpty()) {
            return result(0, 0, List.of(), List.of(), List.of(error(1, "finance.import.empty")));
        }
        Map<String, Integer> columns = columns(records.getFirst());
        for (String required : List.of("date", "type", "amount", "category")) {
            if (!columns.containsKey(required)) {
                errors.add(error(1, "finance.import.missing-column", required));
            }
        }
        if (records.size() - 1 > MAX_ROWS) {
            errors.add(error(1, "finance.import.too-many", MAX_ROWS));
        }
        if (!errors.isEmpty()) {
            return result(0, 0, List.of(), List.of(), errors);
        }

        List<Row> rows = new ArrayList<>();
        for (int i = 1; i < records.size(); i++) {
            List<String> record = records.get(i);
            int line = i + 1;
            if (record.stream().allMatch(String::isBlank)) {
                continue;
            }
            Row row = toRow(record, columns, line, currency, errors);
            if (row != null) {
                rows.add(row);
            }
        }
        if (!errors.isEmpty()) {
            return result(0, 0, List.of(), List.of(), errors);
        }

        // Categorías y cuentas por nombre (sin distinguir mayúsculas); las que no existen se crean.
        Map<String, FinanceCategory> categoryByKey = new HashMap<>();
        categories.findByUserIdOrderByKindAscNameAsc(userId)
                .forEach(c -> categoryByKey.put(c.getKind() + "|" + c.getName().toLowerCase(Locale.ROOT), c));
        Map<String, FinanceAccount> accountByName = new HashMap<>();
        accounts.findByUserIdOrderByNameAsc(userId).forEach(a -> accountByName.put(a.getName().toLowerCase(Locale.ROOT), a));
        List<String> createdCategories = new ArrayList<>();
        List<String> createdAccounts = new ArrayList<>();

        // Un fichero puede repetir movimientos idénticos (dos cafés el mismo día): solo se omiten tantos como ya
        // existan, así reimportar una exportación no duplica nada.
        Map<String, Long> existing = new HashMap<>();
        int imported = 0;
        int skipped = 0;
        Set<UUID> changedCategories = new HashSet<>();
        Set<YearMonth> changedMonths = new HashSet<>();
        for (Row row : rows) {
            FinanceCategory category = categoryByKey.computeIfAbsent(
                    row.kind() + "|" + row.category().toLowerCase(Locale.ROOT), k -> {
                        createdCategories.add(row.category());
                        return categories.save(new FinanceCategory(userId, row.kind(), row.category(),
                                NEW_CATEGORY_COLOR, clock.instant()));
                    });
            FinanceAccount account = row.account().isEmpty() ? null
                    : accountByName.computeIfAbsent(row.account().toLowerCase(Locale.ROOT), k -> {
                        createdAccounts.add(row.account());
                        return accounts.save(new FinanceAccount(userId, row.account(), clock.instant()));
                    });
            String key = row.key(category.getId());
            long remaining = existing.computeIfAbsent(key, k -> movements.countSame(userId, row.kind(), row.cents(),
                    row.date(), category.getId(), row.description()));
            if (remaining > 0) {
                existing.put(key, remaining - 1);
                skipped++;
                continue;
            }
            Movement movement = new Movement(userId, currency, clock.instant());
            movement.edit(row.kind(), row.cents(), row.date(), category, account, row.description(), row.tags(),
                    clock.instant());
            movements.save(movement);
            changedCategories.add(category.getId());
            changedMonths.add(YearMonth.from(row.date()));
            imported++;
        }
        if (imported > 0) {
            events.publishEvent(new MovementsChanged(userId, changedCategories, changedMonths));
        }
        return result(imported, skipped, createdCategories, createdAccounts, List.of());
    }

    private Row toRow(List<String> record, Map<String, Integer> columns, int line, String currency,
            List<ImportError> errors) {
        int before = errors.size();
        String dateText = value(record, columns, "date");
        LocalDate date = null;
        try {
            date = LocalDate.parse(dateText);
        } catch (DateTimeParseException e) {
            errors.add(error(line, "finance.import.date", dateText));
        }
        MovementKind kind = switch (SearchText.normalize(value(record, columns, "type"))) {
            case "income", "ingreso", "ingresos" -> MovementKind.INCOME;
            case "expense", "gasto", "gastos" -> MovementKind.EXPENSE;
            default -> {
                errors.add(error(line, "finance.import.type", value(record, columns, "type")));
                yield null;
            }
        };
        Long cents = parseAmount(value(record, columns, "amount"));
        if (cents == null) {
            errors.add(error(line, "finance.import.amount", value(record, columns, "amount")));
        }
        String rowCurrency = value(record, columns, "currency").toUpperCase(Locale.ROOT);
        if (!rowCurrency.isEmpty() && !rowCurrency.equals(currency)) {
            errors.add(error(line, "finance.import.currency", rowCurrency, currency));
        }
        String category = value(record, columns, "category");
        if (category.isEmpty() || category.length() > 50) {
            errors.add(error(line, "finance.import.category"));
        }
        String account = value(record, columns, "account");
        String description = value(record, columns, "description");
        if (account.length() > 50 || description.length() > 200) {
            errors.add(error(line, "finance.import.too-long"));
        }
        Set<String> tags = SearchText.normalizeTags(List.of(value(record, columns, "tags").split("[;|]")));
        if (errors.size() > before) {
            return null;
        }
        return new Row(line, kind, cents, date, category, account, description, tags);
    }

    /** «12.50», «12,5», «1.234,56» o «1,234.56» en céntimos; null si no es un importe positivo válido. */
    static Long parseAmount(String text) {
        String clean = text.replace(" ", "").replace("€", "");
        if (!AMOUNT.matcher(clean).matches()) {
            return null;
        }
        int last = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('.'));
        String integer = clean;
        String decimals = "";
        if (last >= 0 && clean.length() - last - 1 <= 2) {
            integer = clean.substring(0, last);
            decimals = clean.substring(last + 1);
        }
        integer = integer.replace(".", "").replace(",", "");
        if (integer.length() > 10) {
            return null;
        }
        long cents = Long.parseLong(integer) * 100 + (decimals.isEmpty() ? 0 : Long.parseLong((decimals + "0").substring(0, 2)));
        return cents > 0 ? cents : null;
    }

    private static Map<String, Integer> columns(List<String> header) {
        Map<String, Integer> columns = new LinkedHashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String name = SearchText.normalize(header.get(i).strip().replace("﻿", ""));
            columns.putIfAbsent(HEADER_ALIASES.getOrDefault(name, name), i);
        }
        return columns;
    }

    private static String value(List<String> record, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        return index == null || index >= record.size() ? "" : record.get(index).strip();
    }

    /** Lector CSV (RFC 4180): comillas dobles, saltos de línea dentro de comillas y separador «,» o «;». */
    static List<List<String>> parse(BufferedReader reader) throws IOException {
        StringBuilder all = new StringBuilder();
        char[] buffer = new char[8192];
        for (int n; (n = reader.read(buffer)) > 0;) {
            all.append(buffer, 0, n);
        }
        String text = all.toString();
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        int firstLineEnd = text.indexOf('\n') < 0 ? text.length() : text.indexOf('\n');
        String firstLine = text.substring(0, firstLineEnd);
        char separator = firstLine.chars().filter(c -> c == ';').count() > firstLine.chars().filter(c -> c == ',').count()
                ? ';' : ',';

        List<List<String>> records = new ArrayList<>();
        List<String> record = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    field.append('"');
                    i++;
                } else if (c == '"') {
                    quoted = false;
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == separator) {
                record.add(field.toString());
                field.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                record.add(field.toString());
                field.setLength(0);
                records.add(record);
                record = new ArrayList<>();
            } else {
                field.append(c);
            }
        }
        if (!field.isEmpty() || !record.isEmpty()) {
            record.add(field.toString());
            records.add(record);
        }
        return records;
    }

    private static String quote(String value) {
        // Evita que una hoja de cálculo interprete el texto como fórmula.
        String safe = !value.isEmpty() && "=+-@".indexOf(value.charAt(0)) >= 0 && !value.matches("-?\\d.*")
                ? "'" + value : value;
        return safe.contains(",") || safe.contains("\"") || safe.contains("\n") || safe.contains("\r")
                ? "\"" + safe.replace("\"", "\"\"") + "\"" : safe;
    }

    private ImportError error(int line, String key, Object... args) {
        return new ImportError(line, messages.getMessage(key, args, LocaleContextHolder.getLocale()));
    }

    private static ImportResult result(int imported, int skipped, List<String> categories, List<String> accounts,
            List<ImportError> errors) {
        return new ImportResult(imported, skipped, categories, accounts, errors.stream().limit(50).toList());
    }
}
