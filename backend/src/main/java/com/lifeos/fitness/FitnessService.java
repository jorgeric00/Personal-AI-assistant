package com.lifeos.fitness;

import java.time.Clock;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.FitnessDtos.MeasurementRequest;
import com.lifeos.fitness.FitnessDtos.MeasurementResponse;
import com.lifeos.fitness.FitnessDtos.ProfileRequest;
import com.lifeos.fitness.FitnessDtos.ProfileResponse;

/** Perfil físico y registros de evolución (peso, perímetros y grasa corporal). */
@Service
public class FitnessService {

    private final FitnessProfileRepository profiles;
    private final BodyMeasurementRepository measurements;
    private final Clock clock;
    private final LifeosProperties properties;

    public FitnessService(FitnessProfileRepository profiles, BodyMeasurementRepository measurements, Clock clock,
            LifeosProperties properties) {
        this.profiles = profiles;
        this.measurements = measurements;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public ProfileResponse profile(UUID userId) {
        return toResponse(userId, profiles.findById(userId).orElseGet(() -> new FitnessProfile(userId)));
    }

    @Transactional
    public ProfileResponse updateProfile(UUID userId, ProfileRequest request) {
        new FieldValidationException.Collector()
                .add(request.birthDate() != null
                        && (!request.birthDate().isBefore(today().minusYears(10))
                                || request.birthDate().isBefore(today().minusYears(120))),
                        "birthDate", "fitness.birth-date.invalid")
                .throwIfAny();
        FitnessProfile profile = profiles.findById(userId).orElseGet(() -> new FitnessProfile(userId));
        profile.update(request, clock.instant());
        return toResponse(userId, profiles.save(profile));
    }

    @Transactional(readOnly = true)
    public List<MeasurementResponse> measurements(UUID userId) {
        return measurements.findByUserIdOrderByDateDesc(userId).stream().map(MeasurementResponse::from).toList();
    }

    /** Un registro por día: si ya existe uno en esa fecha, se edita ese en lugar de crear otro. */
    @Transactional
    public MeasurementResponse createMeasurement(UUID userId, MeasurementRequest request) {
        validate(request);
        if (measurements.findByUserIdAndDate(userId, request.date()).isPresent()) {
            throw new ConflictException("measurement-date-exists");
        }
        return MeasurementResponse.from(measurements.save(new BodyMeasurement(userId, request, clock.instant())));
    }

    @Transactional
    public MeasurementResponse updateMeasurement(UUID userId, UUID id, MeasurementRequest request) {
        validate(request);
        BodyMeasurement measurement = load(userId, id);
        Optional<BodyMeasurement> sameDate = measurements.findByUserIdAndDate(userId, request.date());
        if (sameDate.isPresent() && !sameDate.get().getId().equals(id)) {
            throw new ConflictException("measurement-date-exists");
        }
        measurement.update(request, clock.instant());
        return MeasurementResponse.from(measurement);
    }

    @Transactional
    public void deleteMeasurement(UUID userId, UUID id) {
        measurements.delete(load(userId, id));
    }

    private void validate(MeasurementRequest request) {
        new FieldValidationException.Collector()
                .add(request.isEmpty(), "weightKg", "fitness.measurement.empty")
                .add(request.date() != null && request.date().isAfter(today()), "date", "fitness.measurement.date.future")
                .throwIfAny();
    }

    private BodyMeasurement load(UUID userId, UUID id) {
        return measurements.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private ProfileResponse toResponse(UUID userId, FitnessProfile p) {
        Optional<BodyMeasurement> latest = measurements.findFirstByUserIdAndWeightKgNotNullOrderByDateDesc(userId);
        Integer age = p.getBirthDate() == null ? null : Period.between(p.getBirthDate(), today()).getYears();
        return new ProfileResponse(p.getBirthDate(), age, p.getHeightCm(), p.getStartWeightKg(),
                latest.map(BodyMeasurement::getWeightKg).orElse(p.getStartWeightKg()),
                latest.map(BodyMeasurement::getDate).orElse(null), p.getGoal(), p.getGoalDetails(),
                p.getActivityLevel(), p.getExperience(),
                p.getDaysPerWeek() == null ? null : p.getDaysPerWeek().intValue(),
                p.getMinutesPerSession() == null ? null : p.getMinutesPerSession().intValue(), p.getFoodPreferences(),
                p.getFoodAvoid(), p.getEquipment(), p.getNotes());
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
