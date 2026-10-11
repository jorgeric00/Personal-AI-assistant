package com.lifeos.fitness;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface FitnessProfileRepository extends JpaRepository<FitnessProfile, UUID> {
}

interface BodyMeasurementRepository extends JpaRepository<BodyMeasurement, UUID> {

    List<BodyMeasurement> findByUserIdOrderByDateDesc(UUID userId);

    Optional<BodyMeasurement> findByIdAndUserId(UUID id, UUID userId);

    Optional<BodyMeasurement> findByUserIdAndDate(UUID userId, LocalDate date);

    Optional<BodyMeasurement> findFirstByUserIdAndWeightKgNotNullOrderByDateDesc(UUID userId);
}
