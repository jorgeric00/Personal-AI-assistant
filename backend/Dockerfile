FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S lifeos && adduser -S lifeos -G lifeos
WORKDIR /app
COPY --from=build /app/target/lifeos-backend-*.jar app.jar
USER lifeos
EXPOSE 8080
ENV TZ=Europe/Madrid
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
