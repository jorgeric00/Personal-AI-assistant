package com.lifeos.fitness.photos;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface ProgressPhotoRepository extends JpaRepository<ProgressPhoto, UUID> {

    Optional<ProgressPhoto> findByIdAndUserId(UUID id, UUID userId);

    List<ProgressPhoto> findByUserIdOrderByTakenOnDescCreatedAtDesc(UUID userId);
}
