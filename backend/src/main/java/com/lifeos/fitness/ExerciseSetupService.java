package com.lifeos.fitness;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.fitness.Exercise.MuscleGroup;
import com.lifeos.fitness.Exercise.Type;
import com.lifeos.user.AppUserRepository;

/**
 * Crea el catálogo inicial de ejercicios en el idioma del usuario la primera vez que entra en él. Después es suyo:
 * puede editarlos, archivarlos o borrarlos sin que vuelvan a aparecer.
 */
@Service
public class ExerciseSetupService {

    private record DefaultExercise(String key, MuscleGroup group, Type type) {
    }

    static final List<DefaultExercise> DEFAULTS = List.of(
            new DefaultExercise("squat", MuscleGroup.LEGS, Type.BODYWEIGHT),
            new DefaultExercise("barbell-squat", MuscleGroup.LEGS, Type.STRENGTH),
            new DefaultExercise("lunge", MuscleGroup.LEGS, Type.BODYWEIGHT),
            new DefaultExercise("romanian-deadlift", MuscleGroup.LEGS, Type.STRENGTH),
            new DefaultExercise("glute-bridge", MuscleGroup.LEGS, Type.BODYWEIGHT),
            new DefaultExercise("bench-press", MuscleGroup.CHEST, Type.STRENGTH),
            new DefaultExercise("push-up", MuscleGroup.CHEST, Type.BODYWEIGHT),
            new DefaultExercise("pull-up", MuscleGroup.BACK, Type.BODYWEIGHT),
            new DefaultExercise("dumbbell-row", MuscleGroup.BACK, Type.STRENGTH),
            new DefaultExercise("lat-pulldown", MuscleGroup.BACK, Type.STRENGTH),
            new DefaultExercise("shoulder-press", MuscleGroup.SHOULDERS, Type.STRENGTH),
            new DefaultExercise("lateral-raise", MuscleGroup.SHOULDERS, Type.STRENGTH),
            new DefaultExercise("biceps-curl", MuscleGroup.ARMS, Type.STRENGTH),
            new DefaultExercise("bench-dip", MuscleGroup.ARMS, Type.BODYWEIGHT),
            new DefaultExercise("plank", MuscleGroup.CORE, Type.TIMED),
            new DefaultExercise("dead-bug", MuscleGroup.CORE, Type.BODYWEIGHT),
            new DefaultExercise("running", MuscleGroup.CARDIO, Type.CARDIO),
            new DefaultExercise("cycling", MuscleGroup.CARDIO, Type.CARDIO),
            new DefaultExercise("walking", MuscleGroup.CARDIO, Type.CARDIO),
            new DefaultExercise("jump-rope", MuscleGroup.CARDIO, Type.TIMED));

    private final ExerciseRepository exercises;
    private final AppUserRepository users;
    private final MessageSource messages;
    private final Clock clock;

    public ExerciseSetupService(ExerciseRepository exercises, AppUserRepository users, MessageSource messages,
            Clock clock) {
        this.exercises = exercises;
        this.users = users;
        this.messages = messages;
        this.clock = clock;
    }

    /** Si dos peticiones llegan a la vez, solo la que crea los ajustes crea los ejercicios. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureCatalog(UUID userId) {
        if (exercises.insertSettingsIfAbsent(userId, clock.instant()) == 0) {
            return;
        }
        Locale locale = users.findById(userId).map(u -> Locale.forLanguageTag(u.getLocale())).orElse(Locale.ROOT);
        DEFAULTS.forEach(d -> {
            String prefix = "fitness.exercise.default." + d.key() + ".";
            exercises.save(new Exercise(userId, messages.getMessage(prefix + "name", null, locale), d.group(),
                    d.type(), messages.getMessage(prefix + "equipment", null, null, locale),
                    messages.getMessage(prefix + "instructions", null, locale),
                    messages.getMessage(prefix + "safety", null, locale), clock.instant()));
        });
    }
}
