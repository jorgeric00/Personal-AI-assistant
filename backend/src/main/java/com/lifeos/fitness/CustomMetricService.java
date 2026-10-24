package com.lifeos.fitness;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.FitnessDtos.CustomMetricRequest;
import com.lifeos.fitness.FitnessDtos.CustomMetricResponse;

/** Indicadores propios de la evolución física. */
@Service
public class CustomMetricService {

    private final CustomMetricRepository metrics;
    private final Clock clock;

    public CustomMetricService(CustomMetricRepository metrics, Clock clock) {
        this.metrics = metrics;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CustomMetricResponse> list(UUID userId) {
        return metrics.findByUserIdOrderByCreatedAtAsc(userId).stream().map(CustomMetricResponse::from).toList();
    }

    @Transactional
    public CustomMetricResponse create(UUID userId, CustomMetricRequest request) {
        CustomMetric metric = new CustomMetric(userId, clock.instant());
        apply(userId, metric, request);
        return CustomMetricResponse.from(metrics.save(metric));
    }

    @Transactional
    public CustomMetricResponse update(UUID userId, UUID id, CustomMetricRequest request) {
        CustomMetric metric = load(userId, id);
        apply(userId, metric, request);
        return CustomMetricResponse.from(metric);
    }

    /** Borra el indicador y todos sus valores; para conservarlos está archivar. */
    @Transactional
    public void delete(UUID userId, UUID id) {
        metrics.delete(load(userId, id));
    }

    private void apply(UUID userId, CustomMetric metric, CustomMetricRequest request) {
        String name = request.name().strip();
        new FieldValidationException.Collector()
                .add(metrics.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, name, metric.getId()), "name",
                        "fitness.custom.name.exists")
                .throwIfAny();
        String unit = FitnessDtos.blankToNull(request.unit());
        metric.update(name, unit == null ? null : unit.strip(), request.decimals(),
                Boolean.TRUE.equals(request.archived()), clock.instant());
    }

    private CustomMetric load(UUID userId, UUID id) {
        return metrics.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }
}
