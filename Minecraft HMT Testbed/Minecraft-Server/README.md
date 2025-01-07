PaperMC Setup Instructions (For Windows - Linux will be slightly different):
  -	Install Java 21
      - https://docs.papermc.io/misc/java-install#verifying-installation
      - Make sure environment variable JAVA_HOME was updated to: JAVA_HOME "C:\Program Files\Amazon Corretto\jdk21.0.4_7"
      - For MacOS:
          - install JDK version appropriate for MacOS and set JAVA_HOME using export JAVA_HOME="path to home directory of installed jdk" and then echo $JAVA_HOME on Terminal to confirm the path. 
  -	Follow these instructions to download paper jar (make sure the version is 1.20.4 or lower, otherwise mcraft.fun cannot work):
      - https://docs.papermc.io/paper/getting-started (put the paper jar in a new folder)
          - Command to run the paper jar: java -Xms4G -Xmx4G -jar paper-1.20.4-497.jar –nogui
          - After each run of the paper jar, 3 world folders will automatically be generated, containing folders such as playerdata and region which saves the state of the world. Make sure to delete the generated world folder (e.g. smmaal-world)
      - Change eula.txt from false to TRUE
      - Clone this repository into a new folder. This repository contains our custom Bukkit Plugin (requires gradle) that generates our human-AI house-building world environment and handles websocket communications
          - Install gradle
          - To compile the plugin: ./gradlew build
          - If the build is successful, a plugin jar file will be generated under /build/libs
          - Move the plugin jar into the plugins folder, which is in the folder you created containing the paper jar
          - Crucial!!! In the server.properties file in this repository, copy and paste the contents into the existing server.properties file in your folder containing the paper jar, fully replacing everything in that file.

Minecraft Web Client Proxy Server (localhost:8080):
  - Follow instructions to set up and run the minecraft-web-client built in proxy server: https://github.com/zardoy/minecraft-web-client
      - Install pnpm, run pnpm i, and finally run pnpm prod-start in order to run the proxy server on port 8080

Connect to Server on Minecraft Web Client:
  - Search up mcraft.fun in your browser
  - Press connect to server and Add
  - Server name should be 'localhost' and server port should be '25565', then press Save
  - Proxy server field should be changed to: http://localhost:8080
  - Change the name of your player to be 'Human'
  - Double click the localhost:25565 server to join the server
      - Make sure that both the proxy server (8080) and the paper server (25565) are both running before trying to join the server on mcraft.fun

Connect Bots onto server:
  - Make sure Node.js is installed
  - npm install mineflayer, mineflayer-viewer, mineflayer-pathfinder, ws
  - Navigate to the src/bots directory and run any of the bots (e.g. node new_bot.js)


--------------------
DISTRIBUTION STATEMENT A. Approved for public release. Distribution is unlimited.

This material is based upon work supported by the Under Secretary of Defense for Research and Engineering under Air Force Contract No. FA8702-15-D-0001. Any opinions, findings, conclusions or recommendations expressed in this material are those of the author(s) and do not necessarily reflect the views of the Under Secretary of Defense for Research and Engineering.
© 2024 Massachusetts Institute of Technology.

The software/firmware is provided to you on an As-Is basis
Delivered to the U.S. Government with Unlimited Rights, as defined in DFARS Part 252.227-7013 or 7014 (Feb 2014). Notwithstanding any copyright notice, U.S. Government rights in this work are defined by DFARS 252.227-7013 or DFARS 252.227-7014 as detailed above. Use of this work other than as specifically authorized by the U.S. Government may violate any copyrights that exist in this work.