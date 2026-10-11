# Proyecto: LifeOS — Mi centro de gestión personal

## 1. Tu rol

Actúa como un equipo experimentado formado por:

- Un product manager especializado en aplicaciones personales.
- Un diseñador UI/UX que prioriza la simplicidad y la experiencia de usuario.
- Un arquitecto de software.
- Un desarrollador full-stack senior.
- Un ingeniero de QA encargado de probar y validar las funcionalidades.

Tu objetivo es diseñar y desarrollar una aplicación personal que me permita gestionar mi vida fuera del trabajo. Quiero centralizar mi organización diaria, mis finanzas personales, mis actividades, mi alimentación, mis entrenamientos y mi evolución física.

No quiero una simple demo, una colección de pantallas estáticas ni un prototipo cuyos botones no funcionen. Quiero construir una aplicación real, con persistencia de datos, validaciones, pruebas y una arquitectura que permita añadir funcionalidades en el futuro.

## 2. Forma de trabajar

Antes de implementar nada:

1. Analiza el repositorio, los archivos existentes, las tecnologías y las herramientas disponibles.
2. Si ya hay un proyecto, respeta su arquitectura y reutiliza lo que tenga sentido. No reescribas funcionalidades existentes sin una razón justificada.
3. Si el repositorio está vacío, propón una arquitectura sencilla, mantenible y adecuada para una aplicación personal accesible desde ordenador y móvil. Utiliza tecnologías estables y justifica brevemente la elección.
4. Define los módulos, las pantallas, el modelo de datos, las relaciones entre entidades y el plan de implementación.
5. Identifica los riesgos técnicos y las decisiones que puedan condicionar futuras ampliaciones.

Después, comienza el desarrollo por fases. No te limites a presentarme un plan: implementa las funcionalidades, ejecuta las pruebas y corrige los problemas.

Si falta información no esencial, toma una decisión razonable, documenta la suposición y continúa. Pregunta únicamente cuando exista una decisión verdaderamente bloqueante.

Trabaja en incrementos pequeños y funcionales. Al finalizar cada fase, indica qué has implementado, qué pruebas has ejecutado y qué queda pendiente.

## 3. Objetivo y filosofía del producto

La aplicación será exclusivamente para mi vida personal, nunca para gestionar tareas del trabajo.

Debe permitirme responder rápidamente a preguntas como:

- ¿Qué tengo que hacer hoy?
- ¿Qué actividades y entrenamientos tengo esta semana?
- ¿Qué recordatorios tengo pendientes?
- ¿En qué estoy gastando el dinero?
- ¿Cuánto ingreso, gasto y ahorro cada mes?
- ¿Estoy cumpliendo mi planificación deportiva y alimentaria?
- ¿Cómo está evolucionando mi peso, mi composición corporal y mi rendimiento?
- ¿Estoy mejorando mis hábitos con el paso de las semanas?

Principios del producto:

- Interfaz en español.
- Diseño moderno, limpio y visualmente atractivo.
- Experiencia mobile-first, adaptada también a escritorio.
- Navegación sencilla, sin sobrecargar la pantalla.
- Registro rápido de datos, con el mínimo número de pasos posible.
- Información centralizada y relacionada entre módulos cuando resulte útil.
- Configuración personalizable: no impongas objetivos ni hábitos inamovibles.
- Privacidad como requisito fundamental.
- Las funcionalidades deben ser reales, no meramente visuales.

## 4. Módulo de inicio: Dashboard

Crea una pantalla principal que sirva como resumen de mi día.

Debe incluir:

- Fecha actual y saludo.
- Agenda del día.
- Próximos recordatorios.
- Tareas personales pendientes.
- Entrenamiento previsto.
- Resumen del seguimiento alimentario, si está activado.
- Resumen financiero del mes.
- Accesos rápidos para añadir una nota, un recordatorio, un gasto, una actividad o un entrenamiento.
- Indicadores de hábitos y objetivos.
- Resumen del progreso personal.

El dashboard debe poder personalizarse para mostrar los módulos más relevantes.

No muestres gráficos sin utilidad ni métricas inventadas. Si no hay datos suficientes, utiliza estados vacíos que expliquen cómo empezar.

## 5. Módulo de tareas y recordatorios

Permite gestionar tareas personales y recordatorios.

Cada elemento debe poder tener:

- Título.
- Descripción opcional.
- Fecha y hora.
- Fecha límite, cuando corresponda.
- Prioridad.
- Categoría.
- Estado: pendiente, completado o aplazado, según el tipo de elemento.
- Repetición: diaria, semanal, mensual o personalizada.
- Aviso o notificación, cuando la plataforma lo permita.

Funcionalidades:

- Crear, editar, completar, posponer y eliminar.
- Visualizar tareas de hoy, atrasadas y próximas.
- Filtrar por categoría, prioridad y estado.
- Consultar las tareas en una vista de lista y una vista de calendario.
- Crear recordatorios recurrentes sin generar duplicados incorrectos.
- Marcar rápidamente una tarea como completada.

Implementa las notificaciones reales que permita la arquitectura seleccionada. Si se requieren permisos o una configuración adicional del navegador o del sistema operativo, indícalo claramente. No simules que se ha enviado una notificación cuando no sea así.

## 6. Módulo de notas

Quiero un espacio para guardar información personal sin tener que organizarla previamente de forma estricta.

Debe incluir:

- Creación y edición rápida de notas.
- Título y contenido.
- Etiquetas personalizadas.
- Búsqueda por texto.
- Fijar notas importantes.
- Favoritos.
- Archivo y papelera, si encaja en el diseño.
- Fecha de creación y última modificación.
- Posibilidad de relacionar una nota con una actividad, un objetivo o una planificación.

La experiencia debe ser rápida, similar a una aplicación de notas moderna.

## 7. Módulo de finanzas personales

Implementa un sistema para registrar y analizar mis ingresos y gastos.

### Registro de movimientos

Cada movimiento tendrá:

- Tipo: ingreso o gasto.
- Importe.
- Fecha.
- Categoría.
- Descripción.
- Cuenta o método de pago opcional.
- Etiquetas opcionales.
- Indicador de movimiento recurrente, cuando proceda.

Incluye categorías editables, con categorías iniciales como:

- Vivienda.
- Alimentación y supermercado.
- Restaurantes y ocio.
- Transporte.
- Deporte.
- Salud y cuidado personal.
- Compras.
- Suscripciones.
- Viajes.
- Nómina.
- Otros ingresos.
- Otros gastos.

### Funcionalidades

- Añadir, editar y eliminar movimientos.
- Ver el saldo de ingresos y gastos.
- Consultar el balance mensual.
- Comparar meses.
- Filtrar por intervalo de fechas, categoría y tipo.
- Visualizar gastos por categoría mediante gráficos.
- Consultar la evolución del ahorro.
- Definir presupuestos mensuales por categoría.
- Avisar cuando se alcance o se aproxime el límite de un presupuesto.
- Gestionar gastos e ingresos recurrentes sin duplicaciones.
- Consultar el historial completo.

Añade importación y exportación CSV para facilitar la conservación y migración de mis datos.

Utiliza EUR como moneda inicial, pero permite configurar la moneda en el futuro. Los importes deben almacenarse y calcularse evitando errores de precisión monetaria.

En la primera versión, el registro puede ser manual. No conectes cuentas bancarias ni solicites credenciales bancarias. Diseña el módulo para que una integración futura sea posible sin hacerla necesaria ahora.

## 8. Módulo de agenda y actividades

Quiero planificar mi tiempo personal y visualizar cómo reparto las horas de mi semana.

Debe permitir planificar:

- Gimnasio.
- Pádel y otros deportes.
- Descanso.
- Tiempo libre.
- Planes con amigos.
- Viajes.
- Recados.
- Citas personales.
- Otros eventos personalizables.

Cada actividad debe tener:

- Título.
- Fecha y hora de inicio y fin.
- Categoría.
- Descripción opcional.
- Ubicación opcional.
- Repetición opcional.
- Estado o confirmación de asistencia, cuando resulte útil.

Incluye vistas diaria, semanal y mensual.

Permite mover o editar actividades, detectar solapamientos y mostrar avisos ante conflictos horarios. No impidas guardar una actividad si el usuario decide mantener el solapamiento.

Distingue entre actividades planificadas y actividades realizadas para poder revisar posteriormente si he cumplido mis planes.

Los entrenamientos creados en el módulo deportivo deben aparecer en la agenda cuando tengan una fecha planificada. Evita que una misma sesión genere dos eventos duplicados.

## 9. Módulo de entrenador personal

Este es uno de los módulos principales de la aplicación.

Quiero utilizar la aplicación como herramienta de seguimiento y planificación de mi entrenamiento, alimentación y evolución física.

No debe limitarse a mostrar tablas: debe ayudarme a planificar, registrar y comparar resultados.

### 9.1. Perfil físico y objetivos

Permite configurar y editar:

- Edad.
- Altura.
- Peso inicial.
- Peso actual, obtenido preferentemente de los registros de seguimiento.
- Objetivo personal.
- Nivel de actividad.
- Experiencia entrenando.
- Disponibilidad semanal.
- Preferencias alimentarias.
- Alergias o alimentos que quiero evitar, si decido registrarlos.
- Equipamiento deportivo disponible.
- Otros parámetros personales relevantes.

Objetivos posibles: perder grasa, ganar masa muscular, mantener el peso, mejorar la resistencia o establecer un objetivo personalizado.

No asumas mis datos ni mis objetivos. Permite introducirlos, modificarlos y dejar campos sin completar.

### 9.2. Planificación y seguimiento de entrenamientos

Crea un catálogo de ejercicios que incluya, como mínimo:

- Nombre.
- Grupo muscular.
- Tipo de ejercicio.
- Equipamiento necesario.
- Instrucciones.
- Indicaciones de técnica y seguridad.
- Nivel de dificultad.

Permite crear rutinas y asignarlas a días de la semana.

Cada entrenamiento puede contener varios ejercicios, con los siguientes datos según corresponda:

- Series.
- Repeticiones.
- Peso utilizado.
- Duración.
- Distancia.
- Tiempo de descanso.
- Percepción del esfuerzo.
- Notas.

Funcionalidades:

- Crear y editar rutinas.
- Iniciar un entrenamiento.
- Registrar series durante la sesión.
- Consultar los resultados de la sesión anterior para cada ejercicio.
- Guardar y finalizar la sesión.
- Registrar entrenamientos que haya realizado fuera de la planificación.
- Consultar el historial.
- Comparar rendimientos.
- Registrar récords personales cuando los datos lo permitan.
- Ver la adherencia a la planificación semanal.
- Integrar el entrenamiento con la agenda.

No marques una sesión como completada por el mero hecho de estar planificada.

### 9.3. Seguimiento de alimentación y dieta

Crea un diario de alimentación sencillo y práctico.

Permite registrar:

- Desayuno, comida, cena y tentempiés.
- Alimentos y cantidades.
- Calorías, si se conocen o se calculan a partir de datos disponibles.
- Proteínas, carbohidratos y grasas.
- Agua consumida.
- Notas sobre las comidas.

Las cantidades y los nutrientes deben poder editarse. Si no se dispone de información nutricional fiable para un alimento, no inventes sus valores: permite introducirlos manualmente y diferencia claramente los valores estimados de los confirmados.

Funcionalidades:

- Crear y reutilizar comidas habituales.
- Consultar el registro alimentario diario.
- Crear una planificación semanal de comidas.
- Comparar la ingesta registrada con los objetivos configurados.
- Mostrar resúmenes diarios y semanales.
- Facilitar la preparación anticipada de comidas.
- Permitir registrar únicamente los datos que me interesen, sin obligarme a contar cada caloría.

Si incorporas objetivos calóricos o de macronutrientes, deben poder configurarse y modificarse. Cualquier cálculo estimado debe explicar sus limitaciones.

No presentes la aplicación como un sustituto de un profesional sanitario o nutricionista, ni recomiendes dietas extremas o déficits calóricos peligrosos.

### 9.4. Evolución física

Implementa un seguimiento longitudinal de mi transformación física.

Permite registrar de forma periódica:

- Peso.
- Perímetro de cintura.
- Perímetro de pecho.
- Perímetro de cadera.
- Perímetros de brazos y piernas.
- Porcentaje de grasa corporal, si dispongo de una medición.
- Otros indicadores configurables.
- Comentarios sobre sensaciones, energía y descanso.

No obligues a registrar todos los parámetros cada vez.

Incluye gráficos de evolución para visualizar tendencias a lo largo del tiempo.

Añade un diario fotográfico privado para comparar mi aspecto en distintas fechas, con posibilidad de asociar las fotografías a una fecha y notas.

Las fotografías y los datos físicos son información sensible: protégelos adecuadamente, no los publiques ni los envíes a servicios externos sin una decisión explícita del usuario.

La aplicación debe facilitar comparaciones entre fechas y periodos, sin prometer resultados ni sacar conclusiones que los datos no permitan.

### 9.5. Objetivos y progreso

Permite establecer objetivos con una fecha objetivo opcional y revisar su evolución.

Ejemplos:

- Entrenar un número determinado de días por semana.
- Mejorar un ejercicio.
- Mantener un hábito.
- Cumplir una planificación alimentaria.
- Alcanzar un objetivo de peso o perímetro.
- Completar una actividad deportiva.

Muestra el progreso real basado en registros, sin generar datos artificiales para completar gráficos.

## 10. Hábitos personales

Incluye un módulo sencillo de hábitos diarios o semanales.

Debe permitir crear hábitos personalizados, establecer la frecuencia esperada y marcar su cumplimiento.

Ejemplos: beber agua, entrenar, leer, caminar, dormir a una hora determinada o dedicar tiempo a una afición.

Incluye un historial visual de cumplimiento y resúmenes semanales. Evita que perder una racha se convierta en una experiencia frustrante: el objetivo es ayudarme a identificar tendencias, no penalizarme.

## 11. Diseño y experiencia de usuario

Diseña una interfaz moderna y cuidada, inspirada en las mejores aplicaciones de productividad y seguimiento personal.

Requisitos:

- Diseño responsive para móvil, tablet y escritorio.
- Navegación coherente entre módulos.
- Barra de navegación inferior en móvil, si resulta adecuada.
- Barra lateral en escritorio, si mejora la experiencia.
- Modo claro y oscuro.
- Tarjetas y gráficos legibles.
- Tipografía clara y jerarquía visual consistente.
- Formularios breves y fáciles de completar.
- Confirmación en operaciones destructivas.
- Feedback visible después de guardar, editar o eliminar.
- Estados vacíos útiles.
- Tratamiento correcto de errores y estados de carga.
- Accesibilidad básica: contraste, navegación por teclado, etiquetas y controles accesibles.

Evita llenar todas las pantallas de tarjetas, animaciones, indicadores y gráficos. Prioriza la información que necesito para realizar la siguiente acción.

## 12. Arquitectura, persistencia y privacidad

La aplicación debe funcionar de forma real y mantener sus datos entre sesiones.

Si el proyecto no tiene tecnologías definidas, prioriza una solución web responsive instalable como PWA, accesible desde móvil y ordenador.

Evalúa la persistencia de datos, el acceso desde varios dispositivos y los requisitos de despliegue antes de escoger la arquitectura definitiva. Si el proyecto está vacío, una opción de partida es:

- Frontend: React y TypeScript.
- Backend: Java con Spring Boot.
- Base de datos: PostgreSQL.
- Contenedores y entorno local: Docker Compose.
- Migraciones de base de datos versionadas.
- Pruebas unitarias y de integración para las partes críticas.

Puedes proponer una alternativa más sencilla si está mejor justificada. No adoptes tecnologías adicionales solo por moda.

Requisitos técnicos:

- Separación clara de responsabilidades.
- Modelo de datos coherente y normalizado cuando corresponda.
- Validaciones tanto en cliente como en servidor.
- Tratamiento centralizado de errores.
- Fechas y zonas horarias gestionadas correctamente, utilizando Europe/Madrid como configuración inicial.
- Unidades métricas por defecto: kg, cm y km.
- Autenticación y autorización adecuadas si se accede a los datos a través de una red.
- Contraseñas protegidas mediante mecanismos de hash seguros, si se utilizan cuentas.
- Secretos y credenciales fuera del código fuente.
- Protección de datos y acceso restringido a las fotografías.
- Sin analíticas invasivas, publicidad ni integraciones externas innecesarias.
- Copias de seguridad y restauración documentadas.
- Exportación de datos personales en formatos utilizables.
- Posibilidad de eliminar los datos de forma controlada.

No consideres suficiente guardar todos los datos exclusivamente en memoria ni utilizar datos simulados como sustituto de una base de datos real. Si propones almacenamiento local, explica las limitaciones para cambiar de dispositivo y cómo se realizarán las copias de seguridad.

## 13. Modelo de datos

Diseña un modelo coherente que incluya, según lo que finalmente requiera la arquitectura:

- Perfil de usuario y configuración.
- Tareas y recordatorios.
- Notas y etiquetas.
- Movimientos financieros.
- Categorías financieras y presupuestos.
- Actividades y eventos recurrentes.
- Hábitos y registros de cumplimiento.
- Ejercicios.
- Rutinas y ejercicios de rutina.
- Sesiones de entrenamiento y resultados por ejercicio.
- Alimentos y registros alimentarios.
- Objetivos nutricionales.
- Mediciones físicas.
- Fotografías de progreso y sus metadatos.
- Objetivos personales.
- Recordatorios o notificaciones pendientes.

Define las relaciones, restricciones, índices y reglas de borrado necesarias. Evita crear entidades innecesarias y no guardes el mismo dato en varios lugares si puede calcularse de forma fiable.

Incluye migraciones de base de datos cuando corresponda.

## 14. Pruebas y calidad

No des por terminada ninguna funcionalidad solo porque la pantalla se vea correctamente.

Incluye:

- Pruebas unitarias para la lógica de negocio.
- Pruebas de integración para persistencia y API.
- Pruebas de validaciones y errores.
- Pruebas de los cálculos financieros.
- Pruebas de recurrencia de recordatorios.
- Pruebas de fechas y cambios de mes.
- Pruebas de creación y finalización de entrenamientos.
- Pruebas de los cálculos y gráficos de evolución con datos reales del sistema.
- Pruebas de los flujos principales de usuario.
- Verificación de los permisos de acceso a los datos.

Ejecuta los tests, el análisis estático disponible y la compilación. Corrige los errores introducidos por tus cambios.

No elimines ni debilites pruebas existentes para hacer que el proyecto pase.

No afirmes que una prueba ha pasado si no la has ejecutado realmente.

## 15. Alcance y orden de implementación

Divide el desarrollo en las siguientes fases.

### Fase 1. Base funcional

- Estructura del proyecto.
- Diseño visual inicial.
- Navegación.
- Persistencia real.
- Configuración y perfil.
- Dashboard.
- Tareas y recordatorios.
- Notas.
- Agenda de actividades.
- Registro de ingresos y gastos.
- Categorías y resúmenes financieros.
- Pruebas de las funcionalidades principales.

### Fase 2. Entrenador personal

- Perfil físico.
- Catálogo de ejercicios.
- Rutinas.
- Registro de entrenamientos.
- Agenda deportiva integrada.
- Diario de alimentación.
- Registro del peso y medidas.
- Evolución gráfica.

### Fase 3. Seguimiento avanzado

- Diario fotográfico.
- Objetivos personalizados.
- Hábitos.
- Presupuestos avanzados.
- Planificación semanal alimentaria.
- Informes y comparaciones por periodos.
- Copias de seguridad, importación y exportación completas.
- Mejoras de notificaciones y experiencia móvil.

Desarrolla cada fase de manera incremental y deja la aplicación en un estado funcional al finalizar cada una. No sacrifiques las pruebas, la calidad ni la persistencia por añadir muchas pantallas rápidamente.

## 16. Criterios de aceptación

Consideraremos que la primera versión funcional está lista cuando pueda realizar correctamente estas operaciones:

1. Crear un recordatorio y consultarlo posteriormente.
2. Recibir un aviso cuando corresponda, si se ha configurado correctamente el canal de notificaciones.
3. Crear, buscar y editar notas.
4. Planificar actividades y consultarlas en el calendario.
5. Registrar ingresos y gastos y obtener balances mensuales correctos.
6. Consultar el desglose de los gastos por categoría.
7. Crear una rutina y registrar un entrenamiento realizado.
8. Consultar el historial de entrenamientos y sus resultados.
9. Registrar alimentos y consultar el resumen diario de la dieta.
10. Introducir mi peso y mis medidas y ver su evolución.
11. Cerrar y volver a abrir la aplicación sin perder los registros guardados.
12. Exportar mis datos y recuperar una copia de seguridad siguiendo el procedimiento documentado.
13. Utilizar las funciones principales desde un móvil y desde un ordenador.
14. Ejecutar correctamente las pruebas y la compilación del proyecto.

Las funcionalidades incompletas deben declararse como tales. No simules resultados ni presentes botones sin funcionalidad como si el producto estuviera terminado.

## 17. Entregables

Al terminar cada fase, proporciona:

- Resumen de funcionalidades implementadas.
- Arquitectura y decisiones técnicas.
- Estructura de los módulos.
- Cambios realizados en la base de datos.
- Instrucciones para arrancar el proyecto en local.
- Variables de entorno necesarias, mediante un archivo de ejemplo sin secretos.
- Comandos para ejecutar pruebas y compilación.
- Resultado real de las pruebas.
- Limitaciones conocidas.
- Siguiente fase recomendada.

Mantén actualizado un README.md con las instrucciones de instalación, desarrollo y ejecución.

## 18. Primera acción

Empieza analizando el repositorio actual.

A continuación, presenta una propuesta breve con:

1. Arquitectura recomendada y justificación.
2. Estructura de módulos y pantallas.
3. Modelo de datos inicial.
4. Fases de desarrollo y prioridades.
5. Principales riesgos técnicos y de privacidad.

Después, comienza a implementar la primera fase siguiendo las decisiones justificadas. Prioriza una base sólida y funcional, con una interfaz de calidad, y amplía la aplicación de manera incremental.

Tu objetivo final no es crear una demo que impresione durante cinco minutos. Es construir una aplicación que pueda utilizar todos los días para organizar mi vida personal, controlar mis finanzas y mejorar mi condición física a largo plazo.