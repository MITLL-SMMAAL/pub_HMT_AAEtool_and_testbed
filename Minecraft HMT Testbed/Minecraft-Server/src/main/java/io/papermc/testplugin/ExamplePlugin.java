package io.papermc.testplugin;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.entity.Slime;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.world.ChunkLoadEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.GameRule;
import org.bukkit.block.Block;

import java.net.InetSocketAddress;
import java.util.Random;
import java.util.logging.Logger;
import java.io.IOException;
import java.util.List;
import java.util.ArrayList;
import org.java_websocket.server.WebSocketServer;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;

import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.PrintWriter;

public class ExamplePlugin extends JavaPlugin implements Listener {
    private static final String LOG_FILE_PATH = "state_log.txt";

    private static Location HUMAN_SPAWN_POINT;
    private WebSocketServer webSocketServer;
    private WebSocketServer aaeWebSocketServer;
    private static final Logger logger = Logger.getLogger("Minecraft");
    private boolean teleported = false;
    private int groundY;

    @Override
    public void onEnable() {
        Bukkit.getPluginManager().registerEvents(this, this);
        getLogger().info("CustomEnvironmentPlugin has been enabled!");

        // Initialize the spawn point
        Bukkit.getScheduler().runTask(this, () -> {
            HUMAN_SPAWN_POINT = new Location(Bukkit.getWorlds().get(0), 0, 1, 0);
        });

        // Set the time to day and stop the daylight cycle
        Bukkit.getScheduler().scheduleSyncRepeatingTask(this, () -> {
            Bukkit.getWorlds().forEach(world -> {
                world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
                world.setGameRule(GameRule.DO_MOB_SPAWNING, false);
                world.setTime(1000); // 1000 ticks = day
            });
        }, 0L, 20L);

        startWebSocketServer();
        // startAAEWebSocketServer();

        // Schedule state logging and communication every 5 seconds
        Bukkit.getScheduler().runTaskTimer(this, () -> {
            World world = Bukkit.getWorlds().get(0);  // Assuming a single world scenario
            logState(world);
        }, 0L, 100L);  // Check every 5 seconds
    }

    private void startWebSocketServer() {
        try {
            webSocketServer = new WebSocketServer(new InetSocketAddress("localhost", 8081)) {
                @Override
                public void onOpen(WebSocket conn, ClientHandshake handshake) {
                    logger.info("Bot connected via WebSocket.");
                }

                @Override
                public void onClose(WebSocket conn, int code, String reason, boolean remote) {
                    logger.info("Bot disconnected from WebSocket.");
                }

                @Override
                public void onMessage(WebSocket conn, String message) {
                    logger.info("Received message from bot: " + message);

                    // Try to parse the message as an integer command first
                    try {
                        int command = Integer.parseInt(message); // Convert the message to an integer
                        if (command == 1) {
                            // Give the bot a wooden pickaxe
                            Bukkit.getScheduler().runTask(ExamplePlugin.this, () -> {
                                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "give Bot minecraft:wooden_pickaxe 1");
                                logger.info("Gave Bot a wooden pickaxe.");

                                // Send a message back to the bot confirming the pickaxe was received
                                conn.send("{\"action\": \"pickaxeReceived\"}");
                                logger.info("Sent 'pickaxeReceived' confirmation to the bot.");
                            });
                        }
                    } catch (NumberFormatException e) {
                        // If the message starts with craftPlanks
                        if (message.startsWith("craftPlanks:")) {
                            String[] parts = message.split(":");
                            if (parts.length == 3) {
                                String plankType = parts[1];
                                int plankCount = Integer.parseInt(parts[2]);

                                Bukkit.getScheduler().runTask(ExamplePlugin.this, () -> {
                                    // Give the planks to the bot
                                    String giveCommand = String.format("give Bot minecraft:%s %d", plankType, plankCount);
                                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), giveCommand);
                                    logger.info("Gave Bot " + plankCount + " " + plankType);

                                    // Send confirmation back to the bot
                                    conn.send("{\"action\": \"planksReceived\"}");
                                    logger.info("Sent 'planksReceived' confirmation to the bot.");
                                });
                            }
                        }
                        // If the message starts with craftSticks
                        else if (message.startsWith("craftSticks:")) {
                            String[] parts = message.split(":");
                            if (parts.length == 3) {
                                String material = parts[1]; // should be "stick"
                                int stickCount = Integer.parseInt(parts[2]);

                                Bukkit.getScheduler().runTask(ExamplePlugin.this, () -> {
                                    // Give the sticks to the bot
                                    String giveCommand = String.format("give Bot minecraft:%s %d", material, stickCount);
                                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), giveCommand);
                                    logger.info("Gave Bot " + stickCount + " sticks");

                                    // Send confirmation back to the bot
                                    conn.send("{\"action\": \"sticksReceived\"}");
                                    logger.info("Sent 'sticksReceived' confirmation to the bot.");
                                });
                            }
                        }
                        // If the message is not an integer, handle it as a chest storage command or position data
                        else if (message.startsWith("storeItem:")) {
                            // Extract item type and count
                            String[] parts = message.split(":");
                            if (parts.length == 3) {
                                String itemType = parts[1];
                                int itemCount = Integer.parseInt(parts[2]);

                                // Use the /data command to set the chest contents at (6, groundY + 1, 12)
                                Bukkit.getScheduler().runTask(ExamplePlugin.this, () -> {
                                    String dataCommand = String.format(
                                            "data modify block 6 -60 12 Items set value [{Slot:0b,id:\"minecraft:%s\",Count:%db}]",
                                            itemType, itemCount
                                    );
                                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), dataCommand);
                                    logger.info("Stored " + itemCount + " x " + itemType + " in chest.");

                                    // Clear the items from the bot's inventory using /clear command
                                    String clearCommand = String.format("clear Bot minecraft:%s %d", itemType, itemCount);
                                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), clearCommand);
                                    logger.info("Cleared " + itemCount + " x " + itemType + " from Bot's inventory.");

                                    // Send confirmation back to the bot
                                    conn.send("{\"action\": \"chestStored\"}");
                                });
                            }
                        } else {
                            // Assume it's bot's position data for teleportation
                            try {
                                if (!teleported) {
                                    Bukkit.getScheduler().runTask(ExamplePlugin.this, () -> {
                                        try {
                                            // Remove the curly braces and quotes for easier parsing
                                            String sanitizedMessage = message.replaceAll("[{}\"]", "");
                                            String[] parts = sanitizedMessage.split(",");

                                            // Initialize variables
                                            double botX = 0, botY = 0, botZ = 0;
                                            StringBuilder inventoryLog = new StringBuilder("Bot's Inventory:\n");
                                            String lookingAtBlock = "None";
                                            double lookX = 0, lookY = 0, lookZ = 0;
                                            boolean hasLookingAt = false;

                                            for (String part : parts) {
                                                String[] keyValue = part.split(":");
                                                String key = keyValue[0].trim();
                                                String value = keyValue[1].trim();

                                                switch (key) {
                                                    case "position.x":
                                                        botX = Double.parseDouble(value);
                                                        break;
                                                    case "position.y":
                                                        botY = Double.parseDouble(value);
                                                        break;
                                                    case "position.z":
                                                        botZ = Double.parseDouble(value);
                                                        break;
                                                    case "inventory.name":
                                                        inventoryLog.append(value).append(" x ");
                                                        break;
                                                    case "inventory.count":
                                                        inventoryLog.append(value).append("\n");
                                                        break;
                                                    case "lookingAt.name":
                                                        lookingAtBlock = value;
                                                        hasLookingAt = true;
                                                        break;
                                                    case "lookingAt.position.x":
                                                        lookX = Double.parseDouble(value);
                                                        break;
                                                    case "lookingAt.position.y":
                                                        lookY = Double.parseDouble(value);
                                                        break;
                                                    case "lookingAt.position.z":
                                                        lookZ = Double.parseDouble(value);
                                                        break;
                                                }
                                            }

                                            // Log position
                                            logger.info("Bot's current position: X=" + botX + " Y=" + botY + " Z=" + botZ);

                                            // Log inventory
                                            logger.info(inventoryLog.toString());

                                            // Log what the bot is looking at
                                            if (hasLookingAt) {
                                                logger.info("Bot is looking at: " + lookingAtBlock + " at position X=" + lookX + " Y=" + lookY + " Z=" + lookZ);
                                            } else {
                                                logger.info("Bot is not currently looking at any block.");
                                            }

                                            // Teleport the bot if it hasn't been teleported yet
                                            if (!teleported) {
                                                //Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "tp Bot 1 -60 0");
                                                logger.info("Teleported bot to X=1, Y=-60, Z=0");
                                                teleported = true;
                                            }
                                        } catch (Exception ex) {
                                            logger.severe("Error parsing bot data: " + ex.getMessage());
                                        }
                                    });
                                }
                            } catch (Exception ex) {
                                logger.severe("Error processing message from bot: " + ex.getMessage());
                            }
                        }
                    }
                }

                @Override
                public void onError(WebSocket conn, Exception ex) {
                    logger.severe("WebSocket error: " + ex.getMessage());
                }

                @Override
                public void onStart() {
                    logger.info("WebSocket server started on port 8081.");
                }
            };
            webSocketServer.start();  // Start the WebSocket server
            logger.info("WebSocket server is running and listening for connections.");
        } catch (Exception e) {
            logger.severe("Failed to start WebSocket server: " + e.getMessage());
        }
    }

//    private void startAAEWebSocketServer() {
//        try {
//            aaeWebSocketServer = new WebSocketServer(new InetSocketAddress("localhost", 8082)) {
//                @Override
//                public void onOpen(WebSocket conn, ClientHandshake handshake) {
//                    logger.info("AAE connected via WebSocket.");
//                }
//
//                @Override
//                public void onClose(WebSocket conn, int code, String reason, boolean remote) {
//                    logger.info("AAE disconnected from WebSocket.");
//                }
//
//                @Override
//                public void onMessage(WebSocket conn, String message) {
//                    logger.info("Received message from AAE: " + message);
//                    // Additional handling for AAE-specific messages can be added here
//                }
//
//                @Override
//                public void onError(WebSocket conn, Exception ex) {
//                    logger.severe("AAE WebSocket error: " + ex.getMessage());
//                }
//
//                @Override
//                public void onStart() {
//                    logger.info("AAE WebSocket server started on port 8082.");
//                }
//            };
//            aaeWebSocketServer.start();
//            logger.info("AAE WebSocket server is running and listening for connections.");
//        } catch (Exception e) {
//            logger.severe("Failed to start AAE WebSocket server: " + e.getMessage());
//        }
//    }
//
    // Method to log state and send human state over WebSocket
    private void logState(World world) {
        try (PrintWriter writer = new PrintWriter(new BufferedWriter(new FileWriter(LOG_FILE_PATH, true)))) {
            // Fetch and log bot state
            String botState = getEntityState("Bot", writer, false); // Write to file but don't send
            writer.println("Bot State:");
            writer.println(botState);

            // Fetch and log human state and send over WebSocket
            String humanState = getEntityState("Human", writer, true); // Write to file and send
            writer.println("Human State:");
            writer.println(humanState);

            writer.flush();
            //getLogger().info("State saved to state_log.txt and human state sent to bot.");
        } catch (Exception e) {
            getLogger().severe("Error logging state: " + e.getMessage());
        }
    }

    // Method to fetch entity state (position, inventory, and looking-at information) and send if specified
    private String getEntityState(String entityName, PrintWriter writer, boolean sendOverWebSocket) {
        Player player = Bukkit.getPlayer(entityName);
        if (player == null) return entityName + " is not online.";

        StringBuilder state = new StringBuilder();
        Location loc = player.getLocation();
        double posX = loc.getX(), posY = loc.getY(), posZ = loc.getZ();

        state.append(String.format("Position: X=%.2f, Y=%.2f, Z=%.2f\n", posX, posY, posZ));

        // Log inventory
        state.append("Inventory:\n");
        List<String[]> inventoryList = new ArrayList<>();
        player.getInventory().forEach(item -> {
            if (item != null) {
                String itemName = item.getType().toString();
                int itemCount = item.getAmount();
                state.append(String.format(" - %d x %s\n", itemCount, itemName));
                inventoryList.add(new String[]{itemName, String.valueOf(itemCount)});
            }
        });

        // Log looking-at info
        String lookingAtName = "None";
        double lookX = 0, lookY = 0, lookZ = 0;
        Block targetBlock = player.getTargetBlockExact(5); // 5-block reach limit
        if (targetBlock != null) {
            Location blockLoc = targetBlock.getLocation();
            lookingAtName = targetBlock.getType().toString();
            lookX = blockLoc.getX();
            lookY = blockLoc.getY();
            lookZ = blockLoc.getZ();
            state.append(String.format("Looking at: %s at X=%.2f, Y=%.2f, Z=%.2f\n", lookingAtName, lookX, lookY, lookZ));
        } else {
            state.append("Looking at: None\n");
        }

        // If specified, send data over WebSocket using sendBotData for JSON formatting
        if (sendOverWebSocket && webSocketServer != null) {
            String[][] inventoryArray = inventoryList.toArray(new String[0][0]);
            for (WebSocket conn : webSocketServer.getConnections()) {
                sendBotData(conn, posX, posY, posZ, inventoryArray, lookingAtName, lookX, lookY, lookZ);
            }
        }

        return state.toString();
    }

    // Method to send formatted JSON data over WebSocket
    private void sendBotData(WebSocket conn, double posX, double posY, double posZ, String[][] inventoryItems, String lookingAtName, double lookX, double lookY, double lookZ) {
        StringBuilder inventoryJson = new StringBuilder();
        inventoryJson.append("[");
        for (int i = 0; i < inventoryItems.length; i++) {
            inventoryJson.append(String.format("{\"name\":\"%s\",\"count\":%s}", inventoryItems[i][0], inventoryItems[i][1]));
            if (i < inventoryItems.length - 1) {
                inventoryJson.append(",");
            }
        }
        inventoryJson.append("]");

        String messageJson = String.format(
                "{\"position\":{\"x\": %f, \"y\": %f, \"z\": %f}, \"inventory\":%s, \"lookingAt\":{\"name\":\"%s\", \"position\":{\"x\": %f, \"y\": %f, \"z\": %f}}}",
                posX, posY, posZ, inventoryJson, lookingAtName, lookX, lookY, lookZ
        );
        conn.send(messageJson);
    }


//    // House layout coordinates requiring 3 logs stacked on each
//    private final int[][] houseLayoutPositions = {
//            {1, 0, 0}, {2, 0, 0}, {3, 0, 0}, {4, 0, 0}, {5, 0, 0}, {6, 0, 0},
//            {1, 0, 4}, {2, 0, 4}, {3, 0, 4}, {4, 0, 4}, {5, 0, 4}, {6, 0, 4},
//            {1, 0, 1}, {1, 0, 2}, {1, 0, 3},
//            {6, 0, 1}, {6, 0, 2}, {6, 0, 3},
//            {4, 0, 4}, {3, 0, 4}, {1, 0, -1}, {1, 0, -2}, {1, 0, -3},
//            {6, 0, -1}, {6, 0, -2}, {6, 0, -3}, {1, 0, -4}, {2, 0, -4},
//            {3, 0, -4}, {4, 0, -4}, {5, 0, -4}, {6, 0, -4}, {3, 0, -6}, {4, 0, -6}, {5, 0, -6}, {6, 0, -6}, {7, 0, -6}
//    };
//
//    private boolean isHouseBuildComplete(World world, int groundY) {
//        int requiredLogsPerPosition = 3;
//        int completedPositions = 0;
//
//        for (int[] pos : houseLayoutPositions) {
//            for (int i = 0; i < requiredLogsPerPosition; i++) {
//                Location loc = new Location(world, pos[0], groundY + pos[1] + i, pos[2]);
//                Material material = world.getBlockAt(loc).getType();
//                if (material == Material.JUNGLE_LOG) {
//                    completedPositions++;
//                    break;
//                }
//            }
//        }
//
//        // Calculate the completion percentage
//        int totalPositions = houseLayoutPositions.length * requiredLogsPerPosition;
//        int completionPercentage = (completedPositions * 100) / totalPositions;
//
//        logger.info("House completion percentage: " + completionPercentage + "%");
//        return completionPercentage >= 1; //should be 100 when full house is built
//    }
//
//    private void checkHouseCompletion(World world) {
//        Bukkit.getScheduler().runTaskTimer(this, () -> {
//            if (isHouseBuildComplete(world, groundY)) {
//                logger.info("House build is complete. Sending 'missionEnd' to AAE server.");
//                sendMissionEndToAAE();
//            }
//        }, 0L, 100L);  // Check every 5 seconds
//    }
//
//    private void sendMissionEndToAAE() {
//        if (aaeWebSocketServer != null) {
//            for (WebSocket conn : aaeWebSocketServer.getConnections()) {
//                conn.send("missionEnd");
//            }
//            logger.info("Sent 'missionEnd' to AAE server.");
//        }
//    }

    @Override
    public void onDisable() {
        if (webSocketServer != null) {
            try {
                webSocketServer.stop();
            } catch (InterruptedException e) {
                getLogger().severe("Error stopping Bot WebSocket server: " + e.getMessage());
            }
        }
//        if (aaeWebSocketServer != null) {
//            try {
//                aaeWebSocketServer.stop();
//            } catch (InterruptedException e) {
//                getLogger().severe("Error stopping AAE WebSocket server: " + e.getMessage());
//            }
//        }
        getLogger().info("CustomEnvironmentPlugin has been disabled!");
    }

    @EventHandler
    public void onCreatureSpawn(CreatureSpawnEvent event) {
        if (event.getEntityType() == EntityType.SLIME) {
            event.getEntity().remove(); // Remove the slime
            getLogger().info("A slime was removed on spawn at location: " + event.getLocation());
        }
    }

    @EventHandler
    public void onChunkLoad(ChunkLoadEvent event) {
        Entity[] entities = event.getChunk().getEntities();  // getEntities() returns an array

        for (Entity entity : entities) {
            if (entity instanceof Slime) {
                entity.remove(); // Remove the slime
                getLogger().info("A slime was removed from a loaded chunk at location: " + entity.getLocation());
            }
        }
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        World world = player.getWorld();
        int groundY = world.getHighestBlockAt(HUMAN_SPAWN_POINT).getY();

        if (player.getName().equalsIgnoreCase("Human")) {
            player.teleport(new Location(world, HUMAN_SPAWN_POINT.getX(), groundY + 1, HUMAN_SPAWN_POINT.getZ()));
            player.sendMessage("Welcome to your starting position, Human!");

            // Build structures on player join
            buildHouseArea(world, groundY);
            buildDecorations(world, groundY);
            buildNecessities(world, groundY);
            buildJungleLogs(world, groundY);
            buildBirchLogs(world, groundY);
            buildSmoothAndesite(world, groundY);
            buildCobblestone(world, groundY);
            buildBedrockCuboid(world, groundY);

            // sendPlayerPosition(player);
        } else {
            player.sendMessage("Welcome to the flatland world!");
        }
    }

    @EventHandler
    public void onPlayerMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        if (player.getName().equalsIgnoreCase("Human")) {
            sendPlayerPosition(player); // Send position in real-time as the player moves
        }
    }

    private void sendPlayerPosition(Player player) {
        if (webSocketServer != null) {
            Location location = player.getLocation();
            String positionJson = String.format("{\"x\": %f, \"y\": %f, \"z\": %f}",
                    location.getX(), location.getY(), location.getZ());
            for (WebSocket conn : webSocketServer.getConnections()) {
                conn.send(positionJson);
            }
            //getLogger().info("Sent player's position to bot: " + positionJson);
        }
    }

    // Build house area at ground level
    private void buildHouseArea(World world, int groundY) {
        setBlocks(world, Material.DIAMOND_BLOCK, groundY, new int[][]{
                {1, 0, 0}, {2, 0, 0}, {3, 0, 0}, {4, 0, 0}, {5, 0, 0}, {6, 0, 0},  // Front
                {1, 0, 4}, {2, 0, 4}, {3, 0, 4}, {4, 0, 4}, {5, 0, 4}, {6, 0, 4},  // Back
                {1, 0, 1}, {1, 0, 2}, {1, 0, 3},                                   // Left side
                {6, 0, 1}, {6, 0, 2}, {6, 0, 3}                                    // Right side
        });

        setBlocks(world, Material.COAL_BLOCK, groundY, new int[][]{
                {4, 0, 4}, {3, 0, 4}
        });
    }

    private void buildDecorations(World world, int groundY) {
        setBlocks(world, Material.REDSTONE_BLOCK, groundY, new int[][]{
                {1, 0, -1}, {1, 0, -2}, {1, 0, -3},     // Left Redstone line
                {6, 0, -1}, {6, 0, -2}, {6, 0, -3},     // Right Redstone line
                {1, 0, -4}, {2, 0, -4}, {3, 0, -4},     // Bottom Redstone
                {4, 0, -4}, {5, 0, -4}, {6, 0, -4}
        });

        setBlocks(world, Material.EMERALD_BLOCK, groundY, new int[][]{
                {6, 0, 1}, {6, 0, 2}
        });

        setBlocks(world, Material.GOLD_BLOCK, groundY, new int[][]{
                {3, 0, -6}, {4, 0, -6}, {5, 0, -6}, {6, 0, -6}, {7, 0, -6}
        });
    }

    private void buildNecessities(World world, int groundY) {
        Location craftingTableLocation = new Location(world, 5, groundY + 1, 12);
        world.getBlockAt(craftingTableLocation).setType(Material.CRAFTING_TABLE);
        getLogger().info("Placed CRAFTING_TABLE at X=" + craftingTableLocation.getBlockX() +
                " Y=" + craftingTableLocation.getBlockY() + " Z=" + craftingTableLocation.getBlockZ());

        Location chestLocation = new Location(world, 6, groundY + 1, 12);
        world.getBlockAt(chestLocation).setType(Material.CHEST);
        getLogger().info("Placed CHEST at X=" + chestLocation.getBlockX() +
                " Y=" + chestLocation.getBlockY() + " Z=" + chestLocation.getBlockZ());
    }

    private void buildJungleLogs(World world, int groundY) {
        int[][] jungleLogs = {
                // Southwest corner (negative X, positive Z)
                {-20, 1, 15}, {-20, 2, 15},
                {-22, 1, 18}, {-22, 2, 18},
                {-25, 1, 20}, {-25, 2, 20},
                {-18, 1, 22}, {-18, 2, 22},
                {-15, 1, 25}, {-15, 2, 25},
                {-28, 1, 15}, {-28, 2, 15},
                {-23, 1, 25}, {-23, 2, 25},
                {-17, 1, 18}, {-17, 2, 18},
                {-25, 1, 15}, {-25, 2, 15},
                {-20, 1, 20}, {-20, 2, 20},
                {-15, 1, 15}, {-15, 2, 15},
                {-28, 1, 20}, {-28, 2, 20},
                {-22, 1, 25}, {-22, 2, 25},
                {-18, 1, 18}, {-18, 2, 18}
        };
        setBlocks(world, Material.JUNGLE_LOG, groundY, jungleLogs);
    }

    private void buildBirchLogs(World world, int groundY) {
        int[][] birchLogs = {
                // Northwest corner (negative X, negative Z)
                {-20, 1, -15}, {-20, 2, -15},
                {-22, 1, -18}, {-22, 2, -18},
                {-25, 1, -20}, {-25, 2, -20},
                {-18, 1, -22}, {-18, 2, -22},
                {-15, 1, -25}, {-15, 2, -25},
                {-28, 1, -15}, {-28, 2, -15},
                {-23, 1, -25}, {-23, 2, -25},
                {-17, 1, -18}, {-17, 2, -18},
                {-25, 1, -15}, {-25, 2, -15},
                {-20, 1, -20}, {-20, 2, -20},
                {-15, 1, -15}, {-15, 2, -15},
                {-28, 1, -20}, {-28, 2, -20},
                {-22, 1, -25}, {-22, 2, -25},
                {-18, 1, -18}, {-18, 2, -18}
        };
        setBlocks(world, Material.BIRCH_LOG, groundY, birchLogs);
    }

    private void buildSmoothAndesite(World world, int groundY) {
        int[][] andesite = {
                // Northeast corner (positive X, negative Z)
                {20, 1, -15}, {20, 2, -15},
                {22, 1, -18}, {22, 2, -18},
                {25, 1, -20}, {25, 2, -20},
                {18, 1, -22}, {18, 2, -22},
                {15, 1, -25}, {15, 2, -25},
                {28, 1, -15}, {28, 2, -15},
                {23, 1, -25}, {23, 2, -25},
                {17, 1, -18}, {17, 2, -18},
                {25, 1, -15}, {25, 2, -15},
                {20, 1, -20}, {20, 2, -20},
                {15, 1, -15}, {15, 2, -15},
                {28, 1, -20}, {28, 2, -20},
                {22, 1, -25}, {22, 2, -25},
                {18, 1, -18}, {18, 2, -18}
        };
        setBlocks(world, Material.STONE, groundY, andesite);
    }

    private void buildCobblestone(World world, int groundY) {
        int[][] cobblestone = {
                // Southeast corner (positive X, positive Z)
                {20, 1, 15}, {20, 2, 15},
                {22, 1, 18}, {22, 2, 18},
                {25, 1, 20}, {25, 2, 20},
                {18, 1, 22}, {18, 2, 22},
                {15, 1, 25}, {15, 2, 25},
                {28, 1, 15}, {28, 2, 15},
                {23, 1, 25}, {23, 2, 25},
                {17, 1, 18}, {17, 2, 18},
                {25, 1, 15}, {25, 2, 15},
                {20, 1, 20}, {20, 2, 20},
                {15, 1, 15}, {15, 2, 15},
                {28, 1, 20}, {28, 2, 20},
                {22, 1, 25}, {22, 2, 25},
                {18, 1, 18}, {18, 2, 18}
        };
        setBlocks(world, Material.COBBLESTONE, groundY, cobblestone);
    }

    private void buildBedrockCuboid(World world, int groundY) {
        int minX = -35;
        int maxX = 35;
        int minZ = -34;
        int maxZ = 36;
        int minY = 0;
        int maxY = 5;

        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                world.getBlockAt(new Location(world, x, groundY + y, minZ)).setType(Material.BEDROCK);
                world.getBlockAt(new Location(world, x, groundY + y, maxZ)).setType(Material.BEDROCK);
            }
        }

        for (int z = minZ; z <= maxZ; z++) {
            for (int y = minY; y <= maxY; y++) {
                world.getBlockAt(new Location(world, minX, groundY + y, z)).setType(Material.BEDROCK);
                world.getBlockAt(new Location(world, maxX, groundY + y, z)).setType(Material.BEDROCK);
            }
        }
    }

    // Helper method to place blocks at multiple absolute locations and print their positions
    public void setBlocks(World world, Material material, int groundY, int[][] locations) {
        for (int[] loc : locations) {
            Location blockLocation = new Location(world, loc[0], groundY + loc[1], loc[2]);
            world.getBlockAt(blockLocation).setType(material);

//            // Log the location of the placed block
//            getLogger().info("Placed " + material.name() + " at X=" + blockLocation.getBlockX() +
//                    " Y=" + blockLocation.getBlockY() + " Z=" + blockLocation.getBlockZ());
        }
    }


    // Method to spawn creepers randomly within the bedrock walls
    private void spawnCreepers(World world, int numberOfCreepers, int groundY) {
        Random random = new Random();
        int minX = -29;
        int maxX = 29;
        int minZ = -29;
        int maxZ = 29;

        for (int i = 0; i < numberOfCreepers; i++) {
            int x = random.nextInt(maxX - minX + 1) + minX;
            int z = random.nextInt(maxZ - minZ + 1) + minZ;
            Location creeperLocation = new Location(world, x, groundY, z);
            world.spawnEntity(creeperLocation, EntityType.CREEPER); // Spawns a creeper
            getLogger().info("Spawned a creeper at: " + creeperLocation);
        }
    }
}