# Arquitectura y decisiones

## Visión general

```
Móvil / navegador ──HTTPS──▶ web (nginx: PWA + proxy /api) ──▶ backend (Spring Boot) ──▶ PostgreSQL
```

- **Un solo origen.** nginx sirve la app y reenvía `/api` al backend. Así la sesión va en una cookie
  `HttpOnly` y no hace falta CORS.
- **PWA.** La app se instala desde el navegador (Android e iOS) sin pasar por las tiendas. El service worker
  guarda la interfaz en caché para que abra al instante; los datos siempre se piden al servidor.
- **Backend por módulos.** Cada área funcional tendrá su paquete (`auth`, `user`, después `tasks`, `notes`,
  `finance`…) con su controlador, servicio, repositorio y DTOs. Lo compartido vive en `common`.

## Decisiones

| Decisión | Motivo |
| --- | --- |
| PWA en lugar de app nativa | Un único código para móvil y escritorio, instalación sin tiendas y notificaciones push en Android e iOS (16.4+, instalada en la pantalla de inicio). Si más adelante hace falta algo nativo (widgets, Salud), se puede envolver o migrar a React Native reutilizando la API. |
| Spring Boot 4.1 y Java 21 | Versiones estables con soporte largo. |
| Sesión en servidor (Spring Session JDBC) en lugar de JWT | Para un único usuario es más simple y seguro: cookie `HttpOnly`, cierre de sesión real y sesiones que sobreviven a reinicios. Duración: 30 días. |
| CSRF con cookie `XSRF-TOKEN` + cabecera `X-XSRF-TOKEN` | Protección estándar de Spring Security para SPAs. |
| Cuenta única creada al arrancar | La app es personal: no hay registro público. La cuenta se crea con variables de entorno si la base de datos está vacía y nunca se sobrescribe. |
| Contraseñas con BCrypt (`DelegatingPasswordEncoder`) | El prefijo `{bcrypt}` permite cambiar de algoritmo en el futuro sin romper cuentas. |
| Bloqueo tras 5 intentos fallidos durante 15 min | Protección básica frente a fuerza bruta si la app se expone a internet. |
| Fechas en UTC en la base de datos (`timestamptz`) y zona `Europe/Madrid` para mostrar | Evita errores con los cambios de hora. La zona del usuario viene de la configuración y se usa en el frontend. |
| Errores con `application/problem+json` (RFC 9457) | Formato estándar; los mensajes están en español y los errores de validación se devuelven por campo. |
| Internacionalización: español por defecto e inglés | En la app, i18next con los textos en `frontend/src/i18n/locales/` (el español es la referencia y TypeScript obliga a que el inglés tenga las mismas claves). En el servidor, `messages*.properties` según la cabecera `Accept-Language`, que la app envía siempre; una prueba comprueba que ambos ficheros tienen las mismas claves. El idioma elegido se guarda en la cuenta (`app_user.locale`) para usarlo también en lo que genera el servidor, como las notificaciones. Las fechas se formatean con `Intl` según el idioma. |
| Una tarea recurrente es una sola fila | `due_date` guarda la próxima ocurrencia pendiente y las completadas se registran en `task_completion` (clave `task_id` + fecha, así no hay duplicados). Las fechas se calculan con la regla (frecuencia, intervalo, días de la semana, hasta) a partir de `recurrence_anchor`. Si se completa una ocurrencia atrasada, la siguiente salta a hoy o después en lugar de acumular atrasos. Evita generar filas por adelantado y permite editar la regla sin reescribir el historial. |
| Tareas y recordatorios en la misma tabla (`kind`) | Comparten fecha, hora, repetición, categoría y aviso; los recordatorios no tienen fecha límite. |
| Notificaciones Web Push propias, sin servicios de terceros | El servidor cifra los mensajes (RFC 8291, `aes128gcm`) y los firma con VAPID (RFC 8292) usando solo la criptografía del JDK, sin dependencias extra. Las claves VAPID se pueden pasar por variables de entorno; si no, se generan al arrancar y se guardan en `server_key`. El contenido viaja cifrado de extremo a extremo hasta el dispositivo. |
| Envío de avisos con una tarea programada cada minuto | `ReminderNotifier` busca las ocurrencias cuyo aviso ya toca. Antes de enviar, inserta en `task_notification` (clave tarea + fecha), así cada ocurrencia se avisa una sola vez aunque haya varios procesos; si ningún dispositivo lo recibe, libera la marca para reintentar. Los avisos con más de 2 horas de retraso (por ejemplo, tras tener el servidor apagado) se descartan para no enviar ráfagas antiguas. Las suscripciones que el servicio push da por caducadas (404/410) se borran. |
| Notas con guardado automático | El editor guarda mientras se escribe (con una pausa de 0,7 s), al cerrar y al pasar la app a segundo plano. Los guardados van de uno en uno para no crear la misma nota dos veces, y una nota nueva no se crea hasta que tiene título o contenido. |
| Búsqueda de notas sin extensiones de PostgreSQL | Cada nota guarda una columna `search_text` con título, contenido y etiquetas en minúsculas y sin tildes; la búsqueda exige que aparezcan todas las palabras. Es suficiente para el volumen de una persona y no depende de `unaccent` ni de permisos de superusuario. |
| Papelera con borrado a los 30 días | Las notas de la papelera solo se pueden restaurar o borrar. Una tarea programada borra cada 6 horas las que llevan más de 30 días. |
| Relaciones de notas en tablas propias (`note_task`) | Por ahora una nota se puede relacionar con tareas. Cuando existan objetivos, actividades o planificaciones se añadirá una tabla equivalente para cada uno, con claves foráneas reales. |
| Importes en céntimos (`BIGINT`) | Se guardan, se suman y viajan por la API como enteros, siempre positivos con el tipo (ingreso o gasto) como signo. La app formatea con `Intl` sin pasar por números con decimales y lee lo que escribe el usuario («12,50», «1.234,56») como texto. |
| Moneda por usuario y por movimiento | EUR por defecto en `finance_settings`; cada movimiento guarda su moneda para poder permitir otras en el futuro. Mientras no haya conversión, los resúmenes asumen una sola moneda. |
| Categorías iniciales al usar el módulo por primera vez | Se crean en el idioma de la cuenta y son editables. Una categoría con movimientos no se borra, se archiva: deja de ofrecerse para movimientos nuevos y se conserva en el historial. La creación es idempotente (`insert … on conflict do nothing`). |
| Resúmenes calculados en la base de datos | Totales por mes, por categoría y ahorro acumulado (ingresos menos gastos desde el primer movimiento) con `sum` sobre enteros. Los gráficos son SVG propios, sin librerías, con una tabla oculta para lectores de pantalla. |
| Presupuestos mensuales por categoría de gasto | Un límite por categoría que se aplica a cada mes. Al guardar, cambiar o borrar un movimiento del mes actual se recalcula lo gastado y, al pasar del 80 % o del 100 %, se envía una notificación push. `finance_budget_alert` (presupuesto + mes + nivel) garantiza un solo aviso por nivel y mes. El cálculo va después de confirmar la transacción para no retrasar ni romper el guardado. |
| Movimientos recurrentes que generan movimientos reales | Una regla (semanal, mensual o anual, cada 1–12, con fecha de fin opcional) crea un movimiento normal en cada fecha: al crearla se generan las fechas ya pasadas (hasta 5 años), una tarea programada cada hora genera las nuevas y también se generan al consultar movimientos o resúmenes. El índice único `(recurring_id, occurrence_date)` y un bloqueo de la regla impiden duplicados. Los meses cortos usan el último día (el 31 pasa a 30 o 28). Detener o borrar una regla conserva los movimientos ya generados, que se pueden editar uno a uno. |
| Exportación e importación CSV | El mismo formato en los dos sentidos (`date,type,amount,currency,category,account,description,tags`, UTF-8 con BOM para Excel). La importación acepta también `;`, cabeceras en español, «ingreso/gasto» y coma decimal; es todo o nada (si una línea falla no se guarda ninguna y se indica la línea), crea las categorías y cuentas que falten y no duplica movimientos idénticos ya existentes, así se puede reimportar una copia sin riesgo. Las celdas que empiezan por `=`, `+`, `-` o `@` se exportan escapadas para que una hoja de cálculo no las ejecute como fórmulas. |
| Preparado para importar del banco más adelante | Las cuentas son una entidad propia y los movimientos no dependen de ningún proveedor; no se piden credenciales bancarias. Los extractos se pueden traer en CSV. |
| Perfil físico sin datos supuestos | Todos los campos son opcionales y no hay valores por defecto. La edad se calcula a partir de la fecha de nacimiento y el peso actual es el del último registro con peso (o el inicial si aún no hay registros). |
| Un registro de evolución por día | Peso, grasa corporal y perímetros se guardan como `NUMERIC` con los decimales justos (kg con 2, cm y % con 1) y todos son opcionales. Si se elige un día que ya tiene registro, la app abre ese registro en lugar de crear otro. Los gráficos colocan los puntos según la fecha real y solo muestran lo registrado, sin rellenar huecos. |
| Agenda: actividades repetidas como una sola fila | La regla de repetición de tareas se reutiliza, anclada en la fecha de inicio; cada aparición dura lo mismo que la primera. El estado de cada aparición (confirmada, hecha, no hecha, cancelada) se guarda en `activity_occurrence` por fecha; sin fila, está planificada. Editar una actividad repetida cambia toda la serie y conserva los estados ya marcados. Una aparición dura como mucho 60 días y se piden como mucho 62 días de agenda a la vez. |
| Entrenos en la agenda sin duplicados | La agenda no copia los entrenamientos: los lee del módulo de entreno al consultarla. Un entrenamiento registrado aparece una vez; los días que toca una rutina aparecen solo si ese día no hay ya un entrenamiento de esa rutina, y solo desde que se creó la rutina. Si el día pasa sin entrenamiento, se muestra como «sin entreno registrado». |
| Solapamientos como aviso, no como error | La app detecta en el navegador las actividades con hora que se pisan (sin contar canceladas ni no hechas) y las marca en las vistas. Al guardar, si la primera aparición coincide con otras, avisa y permite «Guardar igualmente». Las actividades de todo el día no cuentan como solapamiento ni suman horas. |
| Alimentación sin valores inventados | Un alimento puede guardarse solo con el nombre: cantidad, calorías y macros son opcionales y la app no los rellena ni los estima por su cuenta. Si el usuario indica que lo que ha escrito es aproximado, se guarda `estimated` y los totales marcan con «≈» solo los nutrientes a los que contribuye algún valor estimado. Los totales suman únicamente lo anotado. |
| Objetivos de alimentación opcionales y puestos por el usuario | Calorías, macros y agua son opcionales; la app no los calcula. Si se ponen menos de 1200 kcal se muestra un aviso, y el formulario recuerda que no sustituye a un profesional de la salud o de la nutrición. |
| Diario solo de lo ya comido | No se admiten días futuros en el diario (lo planificado irá en la planificación semanal). Una comida habitual es una plantilla: al registrarla se copian sus alimentos al día y después se editan sueltos. El resumen semanal hace medias solo con los días que tienen algo registrado. |
| Plan semanal de comidas separado del diario | Lo planificado vive en `planned_meal` y nunca suma en el diario. Al «pasarlo al diario» (solo hoy o días anteriores, una vez) se copian los alimentos de su comida habitual; si no tiene, se anota solo el título, sin nutrientes. Las calorías planificadas y la lista de la compra se calculan en la app a partir de las comidas habituales, sin estimar nada más. Borrar una comida habitual deja el plan con su título. La preparación anticipada es un día opcional (como tarde, el de la comida) y una marca de «preparada». «Repetir la semana anterior» copia el plan sin marcas. |
| Hábitos sin rachas que se pierdan | Un hábito es diario (todos los días o los días elegidos) o semanal (de 1 a 7 veces por semana, cualquier día), y se cuenta desde el día en que se crea. Cada día cumplido es una fila en `habit_check` (como mucho una por día, solo hoy o días pasados). La app calcula el progreso de la semana, el porcentaje de las últimas 4 semanas frente a las 4 anteriores y una cuadrícula de 12 semanas; no muestra rachas, y lo que aún puede cumplirse (hoy sin marcar, la semana en curso de un semanal) no cuenta como fallado. Archivar oculta el hábito y conserva el historial; borrarlo pide confirmación porque elimina el historial. |
| Objetivos medidos con los registros | Un objetivo es de un tipo que dice de dónde sale su progreso: medida corporal (mediciones de evolución; el punto de partida es la última medición hasta el día en que se crea), constancia de entreno (días con un entrenamiento terminado esta semana y semanas cumplidas de las 4 anteriores), marca en un ejercicio de fuerza (mejor serie registrada), cumplir un hábito (porcentaje de las últimas 4 semanas) o seguir el plan de comidas (comidas planificadas que se registraron en las últimas 4 semanas). El servidor guarda solo la meta; el progreso se calcula en la app con los mismos datos que ya muestran las otras pantallas, así que nunca hay valores inventados. Que los registros alcancen la meta no cierra el objetivo: lo da por conseguido el usuario, y los de tipo personal solo se cierran a mano. Las metas de peso o medidas llevan un aviso de prudencia. |
| Indicadores propios en la evolución | Además de las medidas fijas (columnas de `body_measurement`), el usuario define indicadores con nombre, unidad opcional y 0, 1 o 2 decimales. Sus valores cuelgan del mismo registro diario (`custom_metric_value`, uno por registro e indicador), así que comparten fecha, historial, comparación y gráfico con el peso y las medidas. Archivar un indicador lo quita del formulario pero conserva valores y gráfico; borrarlo elimina sus valores tras pedir confirmación. |
| Fotos de progreso dentro de la base de datos | Las fotos son datos sensibles. El móvil las reduce antes de subirlas (como mucho 2048 px) y el servidor las vuelve a codificar como JPEG nuevo, con lo que se descartan la ubicación GPS y el resto de metadatos del archivo; también rechaza lo que no sea una imagen JPEG o PNG real. Se guardan en PostgreSQL (`progress_photo_data`, separada de los metadatos para que listar la galería no lea bytes), así entran en las copias de `pg_dump` y nunca se sirven como ficheros públicos: solo la API, con sesión iniciada y a su dueño, con `Cache-Control: no-store` para que no queden en la caché de un dispositivo compartido. La comparación pone dos fotos lado a lado con los días entre ellas, sin interpretar cambios. |
| Exportación completa en un ZIP | `GET /api/export` genera al momento (sin guardarlo) un ZIP con `datos.json` (todas las tablas del usuario, con los nombres de columna de la base de datos, fechas ISO, momentos en UTC e importes en céntimos), `finanzas.csv` (el formato que importa Finanzas) y las fotos en JPEG. Se lee en una sola transacción `REPEATABLE READ` para que sea coherente. No incluye la contraseña, las sesiones, las claves push ni el registro de avisos enviados. Un test compara las tablas exportadas con las de la base de datos, así que una tabla nueva obliga a decidir si se exporta. |
| Copias diarias con `pg_dump` en un servicio aparte | El servicio `backup` (misma imagen de PostgreSQL) hace un volcado en formato `custom` al arrancar y cada 24 horas en `backups/`, con nombre provisional hasta terminar, y conserva las 14 últimas. Restaurar es `pg_restore --clean --if-exists` con la app parada. Las fotos van dentro de la base de datos, así que también entran en la copia. |
| Informes por periodos calculados en el servidor | `GET /api/reports?period=WEEK&date=` (o `MONTH`) resume la semana (lunes a domingo) o el mes que contiene la fecha con lo registrado: tareas completadas (por el día en que se completaron, en la zona horaria del usuario), ingresos, gastos y las 5 categorías con más gasto en la moneda del usuario, entrenos terminados y series hechas, días con comidas anotadas y media de calorías de los días que las tienen (avisando si alguna es estimada), cumplimiento de cada hábito activo y primer y último valor de cada medida dentro del periodo. Cada cifra va junto a la del periodo anterior; si el periodo está en curso, solo cuenta hasta hoy y el anterior se recorta a los mismos días para comparar tramos equivalentes. Lo planificado y no hecho no suma, y la pantalla no valora las diferencias ni habla de tendencias. |
| Ajustes fuera de la barra inferior en el móvil | Con Hábitos hay siete secciones en la barra inferior; Ajustes se abre desde el icono de la cabecera de Hoy en el móvil y sigue en la barra lateral en el escritorio. Objetivos sigue la misma regla: en el móvil se llega desde su tarjeta en Hoy. Informes también: en el móvil se abre desde el icono de gráfico junto a Ajustes en la cabecera de Hoy.
| Migraciones con Flyway, `ddl-auto: validate` | El esquema solo cambia con migraciones versionadas. |
| Pruebas de integración con Testcontainers | Se prueba contra PostgreSQL real, no contra una base de datos en memoria. |

## Suposiciones

- La app tiene un solo usuario (tú). El modelo de datos incluye `user_id` en las entidades para no cerrar la
  puerta a varios usuarios, pero no hay registro ni roles.
- Unidades métricas y euros por defecto.
- Para añadir un idioma: crear `frontend/src/i18n/locales/<código>.ts` y `backend/src/main/resources/messages_<código>.properties`, y añadirlo a `SUPPORTED_LANGUAGES` y a `SupportedLocales`.

## Modelo de datos actual

| Tabla | Contenido |
| --- | --- |
| `app_user` | Cuenta: correo (único, sin distinguir mayúsculas), nombre visible, hash de la contraseña, idioma, fechas. |
| `spring_session`, `spring_session_attributes` | Sesiones activas. |
| `task_category` | Categorías de tareas del usuario: nombre (único sin distinguir mayúsculas) y color. |
| `task` | Tareas y recordatorios: tipo, título, descripción, fecha y hora, fecha límite, prioridad, estado (pendiente, aplazada, hecha), regla de repetición y minutos de antelación del aviso. |
| `task_completion` | Ocurrencias completadas de cada tarea, con la fecha de la ocurrencia y cuándo se completó. |
| `push_subscription` | Dispositivos con notificaciones activadas: endpoint del servicio push y claves públicas del navegador. |
| `task_notification` | Avisos ya enviados por tarea y ocurrencia, para no repetirlos. |
| `server_key` | Claves generadas por el servidor (VAPID). |
| `note` | Notas: título, contenido, estado (activa, archivada, en la papelera), fijada, favorita, texto de búsqueda y fechas. |
| `note_tag` | Etiquetas de cada nota, en minúsculas. |
| `note_task` | Tareas relacionadas con cada nota. |
| `finance_settings` | Moneda del usuario (EUR por defecto). |
| `finance_category` | Categorías de ingresos y de gastos: nombre, color y si está archivada. |
| `finance_account` | Cuentas o métodos de pago (opcionales en cada movimiento). |
| `finance_movement` | Movimientos: tipo, importe en céntimos, moneda, fecha, categoría, cuenta, descripción, texto de búsqueda y, si lo generó una regla, la regla y la fecha de su aparición. |
| `finance_movement_tag` | Etiquetas de cada movimiento. |
| `finance_budget` | Límite mensual en céntimos por categoría de gasto (uno por categoría). |
| `finance_budget_alert` | Avisos de presupuesto ya enviados por mes y nivel (80 % o superado). |
| `fitness_profile` | Perfil físico: fecha de nacimiento, altura, peso inicial, objetivo, nivel de actividad, experiencia, disponibilidad, equipamiento, preferencias y alimentos a evitar. Todo opcional. |
| `body_measurement` | Registros de evolución: fecha (uno por día), peso, grasa corporal, cintura, pecho, cadera, brazo, muslo y comentarios. |
| `fitness_settings` | Marca que el catálogo inicial de ejercicios ya se creó (para no recrear los que el usuario borre). |
| `exercise` | Catálogo de ejercicios del usuario: nombre, grupo muscular, qué se anota (peso y repeticiones, repeticiones, tiempo, tiempo y distancia), material, cómo se hace, precauciones y archivado. Los iniciales se crean en el idioma del usuario. |
| `routine` / `routine_exercise` | Rutinas con días de la semana opcionales y sus ejercicios en orden, con objetivo de series, repeticiones (rango), peso, tiempo, distancia, descanso e indicaciones. Un ejercicio usado en una rutina no se borra; se archiva. |
| `workout` / `workout_exercise` / `workout_set` | Entrenamientos (en curso o terminados) con el objetivo copiado de la rutina al empezar y las series anotadas. Solo cuentan las series marcadas como hechas en entrenamientos terminados: de ahí salen el historial, la última vez de cada ejercicio, los récords y la constancia semanal. |
| `agenda_settings` / `activity_category` | Categorías de actividades (iniciales en el idioma del usuario, editables y archivables; una categoría con actividades no se borra). |
| `activity` / `activity_occurrence` | Actividades: título, categoría, inicio y fin (fecha y hora locales; sin horas = todo el día), descripción, ubicación y repetición; y el estado guardado de cada aparición. |
| `nutrition_target` | Objetivos diarios opcionales: calorías, proteínas, hidratos, grasas y agua. |
| `nutrition_day` | Por día: agua bebida y una nota por comida (desayuno, comida, cena, picoteo). |
| `food_entry` | Alimentos anotados: fecha, comida, nombre, cantidad y unidad, calorías y macros (todo opcional) y si los valores son estimados. |
| `saved_meal` / `saved_meal_item` | Comidas habituales con sus alimentos, para registrarlas de una vez. |
| `planned_meal` | Plan semanal: día, comida, título, comida habitual opcional, notas, día de preparación, si está preparada y si ya se pasó al diario. |
| `custom_metric` / `custom_metric_value` | Indicadores propios de la evolución (nombre, unidad, decimales, archivado) y su valor en cada registro. |
| `progress_photo` / `progress_photo_data` | Fotos de progreso (fecha, encuadre, notas, tamaño) y sus bytes (imagen reducida y miniatura). |
| `goal` | Objetivos (título, tipo, medida, meta, ejercicio o hábito de referencia, fechas de inicio y límite, notas, estado y fecha en que se consiguió). |
| `habit` / `habit_check` | Hábitos (nombre, color, frecuencia diaria con días opcionales o veces por semana, fecha de inicio, archivado) y los días en que se cumplieron. |
| `finance_recurring` | Reglas de movimientos recurrentes: importe, categoría, cuenta, descripción, frecuencia, cada cuántos, inicio, fin y próxima fecha. Los movimientos generados guardan `recurring_id` y la fecha de su aparición. |

## Riesgos y temas abiertos

- **Despliegue.** Para usarla fuera de casa el servidor tiene que ser accesible desde el móvil y servirse por
  HTTPS (necesario para instalar la PWA, para las notificaciones y para la cookie `Secure`).
  Opciones: un VPS pequeño con Caddy, o un equipo en casa con Tailscale. Pendiente de decidir.
- **Notificaciones en iOS.** Solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o posterior);
  la pantalla de Ajustes lo explica cuando detecta un iPhone sin instalar. Los avisos se envían por los
  servicios push de Apple, Google o Mozilla, que solo ven el mensaje cifrado.
- **Precisión de los avisos.** Se comprueban cada minuto, así que pueden llegar hasta un minuto tarde.
- **Sin conexión.** Por ahora la app necesita conexión para ver y guardar datos. Un modo sin conexión con
  sincronización añadiría mucha complejidad; se valorará cuando haya módulos en uso.
- **Copias de seguridad.** El servicio `backup` hace un `pg_dump` diario en `backups/` y guarda las 14 últimas,
  pero en el mismo disco que la app: conviene copiar la más reciente a otro sitio de vez en cuando. El
  procedimiento de copia y restauración está en [copias-de-seguridad.md](copias-de-seguridad.md).
