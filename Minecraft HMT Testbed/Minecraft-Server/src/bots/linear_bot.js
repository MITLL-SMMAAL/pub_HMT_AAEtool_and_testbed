const mineflayer = require('mineflayer');
const WebSocket = require('ws');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const mcData = require('minecraft-data');
const { Vec3 } = require('vec3');
const fs = require('fs');

function createBot() {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot'
  });

  bot.loadPlugin(pathfinder);
  const ws = new WebSocket('ws://localhost:8081');

  const craftingTablePosition = new Vec3(5, 1, 11);
  const chestPosition = new Vec3(6, 1, 11);
  let readyToSendPickaxeRequest = false;
  let readyToStoreInChest = false;

  function printInventory() {
    const items = bot.inventory.items();
    if (items.length > 0) {
      console.log('Current inventory:');
      items.forEach(item => {
        console.log(`${item.count} x ${item.name}`);
      });
    } else {
      console.log('Inventory is empty.');
    }
  }

  async function moveToBlock(position) {
    try {
      const defaultMove = new Movements(bot, mcData(bot.version));
      bot.pathfinder.setMovements(defaultMove);
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      await bot.pathfinder.goto(goal);
      console.log(`Bot has moved to position at ${position}`);
    } catch (err) {
      console.log(`Error moving to position: ${err}`);
    }
  }

  async function digBlock(position) {
    try {
      const targetBlock = bot.blockAt(position);
      if (targetBlock) {
        await bot.lookAt(targetBlock.position);
        await bot.dig(targetBlock);
        console.log(`Successfully mined block at ${position}`);
        printInventory();
      } else {
        console.log(`No block found at ${position}`);
      }
    } catch (err) {
      console.log(`Error digging block at ${position}: ${err}`);
    }
  }

  async function findNearestBlock(types) {
    const blocks = bot.findBlocks({
      matching: block => types.includes(block.name),
      maxDistance: 64,
      count: 100
    });

    if (blocks.length === 0) return null;

    let nearestBlock = null;
    let minDistance = Infinity;

    for (const pos of blocks) {
      const distance = bot.entity.position.distanceTo(pos);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBlock = bot.blockAt(pos);
      }
    }

    return nearestBlock;
  }

  async function collectLogs() {
    const LOG_TYPES = ['jungle_log', 'birch_log'];
    let collectedLogs = 0;

    while (collectedLogs < 3) {
      const nearestLog = await findNearestBlock(LOG_TYPES);
      if (nearestLog) {
        await moveToBlock(nearestLog.position);
        await digBlock(nearestLog.position);

        const logs = bot.inventory.items().filter(item => LOG_TYPES.includes(item.name));
        collectedLogs = logs.reduce((total, log) => total + log.count, 0);
      } else {
        console.log("No logs found nearby.");
        break;
      }
    }

    await moveToBlock(craftingTablePosition);
    console.log('Bot moved to the crafting table.');
    readyToSendPickaxeRequest = true;
  }

  async function handlePickaxe() {
    setTimeout(async () => {
      printInventory();
      const pickaxe = bot.inventory.findInventoryItem(bot.registry.itemsByName.wooden_pickaxe.id, null);
      if (pickaxe) {
        try {
          await bot.equip(pickaxe, 'hand');
          console.log('Equipped the wooden pickaxe.');
          await collectStone(); // Start collecting stone after equipping the pickaxe
        } catch (err) {
          console.log(`Error equipping the pickaxe: ${err}`);
        }
      } else {
        console.log('Wooden pickaxe not found in inventory.');
      }
      printInventory();
    }, 1000);
  }

  async function collectStone() {
    const STONE_TYPES = ['stone', 'cobblestone'];
    console.log('Bot is starting to mine stone blocks.');

    for (let i = 0; i < 5; i++) {
      const nearestStone = await findNearestBlock(STONE_TYPES);
      if (nearestStone) {
        await moveToBlock(nearestStone.position);
        await digBlock(nearestStone.position);
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log("No stone blocks found nearby.");
        break;
      }
    }

    console.log('Finished mining all stone blocks.');
    printInventory();
  }

  async function storeItemsInChest() {
    console.log("Moving to chest position...");
    await moveToBlock(chestPosition);
    readyToStoreInChest = true;

    console.log("Bot inventory before storing in chest:");
    printInventory();
  }

  ws.on('open', () => {
    console.log('WebSocket connection established with Bukkit plugin.');
    bot.once('spawn', () => {
      console.log('Bot has spawned. Starting mining tasks.');

      setInterval(() => {
        if (bot.entity && bot.entity.position) {
          const position = {
            x: bot.entity.position.x,
            y: bot.entity.position.y,
            z: bot.entity.position.z
          };

          // Get bot's inventory items
          const inventoryItems = bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count
          }));

          // Get what the bot is looking at (if any)
          const targetBlock = bot.blockAtCursor(5); // Get the block the bot is looking at within 5 blocks
          const lookingAt = targetBlock ? {
            name: targetBlock.name,
            position: {
              x: targetBlock.position.x,
              y: targetBlock.position.y,
              z: targetBlock.position.z
            }
          } : null;

          // Combine data to send to the server
          const botData = {
            position,
            inventory: inventoryItems,
            lookingAt
          };

          ws.send(JSON.stringify(botData));
          console.log('Sent bot data to Bukkit plugin:', botData);
        }

        if (readyToSendPickaxeRequest) {
          ws.send("1");
          console.log('Sent signal to server to give bot a wooden pickaxe.');
          readyToSendPickaxeRequest = false;
        }

        if (readyToStoreInChest) {
          const chestItems = bot.inventory.items().filter(item => item.name === "jungle_log");
          for (let item of chestItems) {
            const message = `storeItem:${item.name}:${item.count}`;
            ws.send(message);
            console.log(`Sent "${message}" to server to store in chest.`);
          }

          chestItems.forEach(item => bot.inventory.updateSlot(item.slot, null));
          console.log("Bot inventory after storing in chest:");
          printInventory();
          readyToStoreInChest = false;
        }
      }, 5000);

      setTimeout(async () => {
        await collectLogs();
        await collectStone();
        await storeItemsInChest();
      }, 5000);
    });
  });

  let humanPosition = { x: 0, y: 0, z: 0 };
  let humanInventory = [];
  let humanLookingAt = { name: null, position: { x: 0, y: 0, z: 0 } };

  ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);

        if (message.action === 'pickaxeReceived') {
            console.log('Received signal from server that the bot received a wooden pickaxe.');
            handlePickaxe();
        } else if (message.action === 'chestStored') {
            console.log('Received signal from server that items were stored in the chest.');
            printInventory();
        }

        // Update human's position
        if (message.position) {
            const { x, y, z } = message.position;
            humanPosition = { x, y, z };  // Store position for later use
            console.log(`Human position: X=${x}, Y=${y}, Z=${z}`);
        }

        // Update human's inventory
        if (message.inventory) {
            humanInventory = message.inventory.map(item => ({ name: item.name, count: item.count }));  // Store inventory
            console.log('Human inventory:');
            humanInventory.forEach(item => {
                console.log(`${item.count} x ${item.name}`);
            });
        }

        // Update what human is looking at
        if (message.lookingAt) {
            const { name, position } = message.lookingAt;
            humanLookingAt = { name, position };  // Store looking-at information
            console.log(`Human is looking at ${name} at position X=${position.x}, Y=${position.y}, Z=${position.z}`);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
  });

  mineflayerViewer(bot, { port: 3006, firstPerson: true });
  mineflayerViewer(bot, { port: 3007, firstPerson: false });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed.');
  });

  bot.on('kicked', console.log);
  bot.on('error', console.log);
}

createBot();
