package com.lifeos.fitness;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Entrenamientos para la agenda: los registrados y los días que toca alguna rutina. El día de una rutina no se
 * muestra si ese día ya hay un entrenamiento de esa rutina, así una misma sesión nunca aparece dos veces.
 */
@Service
public class FitnessCalendar {

    /** {@code workoutId} null = día planificado por la rutina, todavía sin entrenamiento. */
    public record CalendarWorkout(UUID workoutId, UUID routineId, String name, LocalDate date, Instant finishedAt) {
    }

    private final WorkoutRepository workouts;
    private final RoutineRepository routines;

    public FitnessCalendar(WorkoutRepository workouts, RoutineRepository routines) {
        this.workouts = workouts;
        this.routines = routines;
    }

    /**
     * @param zone zona del usuario: los días de rutina cuentan desde el día en que se creó la rutina
     */
    @Transactional(readOnly = true)
    public List<CalendarWorkout> between(UUID userId, LocalDate from, LocalDate to, ZoneId zone) {
        List<CalendarWorkout> result = new ArrayList<>();
        List<Workout> logged = workouts.findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, to);
        logged.forEach(w -> result.add(
                new CalendarWorkout(w.getId(), w.getRoutineId(), w.getName(), w.getDate(), w.getFinishedAt())));
        for (Routine routine : routines.findByUserIdAndWeekdaysNotNull(userId)) {
            LocalDate created = LocalDate.ofInstant(routine.getCreatedAt(), zone);
            for (LocalDate day = from.isBefore(created) ? created : from; !day.isAfter(to); day = day.plusDays(1)) {
                LocalDate date = day;
                boolean alreadyLogged = logged.stream()
                        .anyMatch(w -> date.equals(w.getDate()) && routine.getId().equals(w.getRoutineId()));
                if (routine.getWeekdays().contains(day.getDayOfWeek()) && !alreadyLogged) {
                    result.add(new CalendarWorkout(null, routine.getId(), routine.getName(), day, null));
                }
            }
        }
        return result;
    }
}
