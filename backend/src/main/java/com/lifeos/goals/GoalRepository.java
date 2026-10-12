package com.lifeos.goals;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface GoalRepository extends JpaRepository<Goal, UUID> {

    Optional<Goal> findByIdAndUserId(UUID id, UUID userId);

    List<Goal> findByUserIdOrderByCreatedAtAsc(UUID userId);
}
