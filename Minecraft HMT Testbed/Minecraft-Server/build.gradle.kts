plugins {
    java
    id("com.github.johnrengelman.shadow") version "7.1.2" // Add Shadow plugin for creating fat JAR
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:1.20.4-R0.1-SNAPSHOT") // Paper API
    implementation("org.java-websocket:Java-WebSocket:1.5.2")      // WebSocket dependency
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(21)) // Use Java 21
}

tasks {
    // Configure the shadowJar task to bundle dependencies into a fat JAR
    shadowJar {
        archiveBaseName.set("Minecraft-Server")  // Name of your plugin
        archiveClassifier.set("")  // No additional classifier like 'all'
        archiveVersion.set("")  // You can set the version or leave it empty
    }

    // Ensure the build task depends on the shadow JAR task
    build {
        dependsOn(shadowJar)
    }
}
