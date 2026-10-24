#!/bin/sh
# Copias automáticas de la base de datos de LifeOS. Lo ejecuta el servicio «backup» de docker-compose.yml:
# hace una copia al arrancar y después una cada LIFEOS_BACKUP_INTERVAL_HOURS horas, y conserva las
# LIFEOS_BACKUP_KEEP más recientes en /backups (la carpeta backups/ del proyecto).
set -eu

interval_hours="${LIFEOS_BACKUP_INTERVAL_HOURS:-24}"
keep="${LIFEOS_BACKUP_KEEP:-14}"

backup() {
  name="lifeos-$(date +%Y%m%d-%H%M%S).dump"
  # Se escribe con otro nombre y se renombra al terminar, para no dejar nunca una copia a medias con el nombre bueno
  if pg_dump --format=custom --file="/backups/$name.partial"; then
    mv "/backups/$name.partial" "/backups/$name"
    echo "$(date '+%F %T') Copia guardada: $name"
  else
    rm -f "/backups/$name.partial"
    echo "$(date '+%F %T') ERROR: no se pudo hacer la copia" >&2
    return 1
  fi
  # Borra las más antiguas a partir de la número $keep
  ls -1t /backups/lifeos-*.dump 2>/dev/null | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f -- "$old"
    echo "$(date '+%F %T') Copia antigua borrada: $(basename "$old")"
  done
}

# Al parar el contenedor se sale enseguida, también durante la espera
trap 'exit 0' TERM INT
umask 077
while true; do
  backup || true
  sleep "$((interval_hours * 3600))" &
  wait $!
done
