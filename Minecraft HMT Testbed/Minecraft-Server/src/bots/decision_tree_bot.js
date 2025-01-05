const mineflayer = require('mineflayer');
const WebSocket = require('ws');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const mcData = require('minecraft-data');
const { Vec3 } = require('vec3');
const fs = require('fs'); 

class HouseTracker {
  constructor() {
    // Ground level from server
    this.groundY = -60;
    
    // House layout coordinates from server
    this.houseLayout = {
      birchPlanksLocations: [
        // Front
        {x: 1, y: this.groundY, z: 0}, {x: 2, y: this.groundY, z: 0}, {x: 3, y: this.groundY, z: 0},
        {x: 4, y: this.groundY, z: 0}, {x: 5, y: this.groundY, z: 0}, {x: 6, y: this.groundY, z: 0},
        // Back
        {x: 1, y: this.groundY, z: 4}, {x: 2, y: this.groundY, z: 4}, {x: 3, y: this.groundY, z: 4},
        {x: 4, y: this.groundY, z: 4}, {x: 5, y: this.groundY, z: 4}, {x: 6, y: this.groundY, z: 4},
        // Left side
        {x: 1, y: this.groundY, z: 1}, {x: 1, y: this.groundY, z: 2}, {x: 1, y: this.groundY, z: 3},
        // Right side
        {x: 6, y: this.groundY, z: 1}, {x: 6, y: this.groundY, z: 2}, {x: 6, y: this.groundY, z: 3}
      ],
      fenceLocations: [
        {x: 1, y: this.groundY, z: -1}, {x: 1, y: this.groundY, z: -2}, {x: 1, y: this.groundY, z: -3},
        {x: 6, y: this.groundY, z: -1}, {x: 6, y: this.groundY, z: -2}, {x: 6, y: this.groundY, z: -3},
        {x: 1, y: this.groundY, z: -4}, {x: 2, y: this.groundY, z: -4}, {x: 3, y: this.groundY, z: -4},
        {x: 4, y: this.groundY, z: -4}, {x: 5, y: this.groundY, z: -4}, {x: 6, y: this.groundY, z: -4}
      ],
      fenceGateLocations: [
        {x: 6, y: this.groundY, z: 1}, {x: 6, y: this.groundY, z: 2}
      ],
      stairLocations: [
        {x: 3, y: this.groundY, z: -6}, {x: 4, y: this.groundY, z: -6}, {x: 5, y: this.groundY, z: -6},
        {x: 6, y: this.groundY, z: -6}, {x: 7, y: this.groundY, z: -6}
      ],
      doorLocations: [
        {x: 3, y: this.groundY, z: 4}, {x: 4, y: this.groundY, z: 4}
      ]
    };

    // Required materials
    this.requirements = {
      birchPlanks: 16,
      andesiteStone: 16,
      junglePlanks: 18,
      cobblestone: 18,
      stairs: 5,
      door: 2,
      fenceGate: 2,
      fence: 10
    };

    // Track completion of each layer
    this.completion = {
      birchPlanks: 0,
      andesiteStone: 0,
      junglePlanks: 0,
      cobblestone: 0,
      fence: 0,
      fenceGate: 0,
      stairs: 0,
      door: 0
    };
  }

  checkHouseProgress(bot) {
    // Reset completion counters
    Object.keys(this.completion).forEach(key => this.completion[key] = 0);

    // Debug log current state
    console.log('\n=== House Progress Check ===');
    console.log('Bot position:', bot.entity.position);

    // Check each layer
    console.log('\nChecking ground layer (birch planks)...');
    this.checkLayer('birchPlanks', bot, 0);
    
    console.log('\nChecking second layer (andesite)...');
    this.checkLayer('andesiteStone', bot, 1);
    
    console.log('\nChecking third layer (jungle planks)...');
    this.checkLayer('junglePlanks', bot, 2);
    
    console.log('\nChecking fourth layer (cobblestone)...');
    this.checkLayer('cobblestone', bot, 3);

    // Check special blocks
    console.log('\nChecking special blocks...');
    this.checkFences(bot);
    this.checkFenceGates(bot);
    this.checkStairs(bot);
    this.checkDoors(bot);

    // Log completion status
    console.log('\nCompletion Status:');
    Object.entries(this.completion).forEach(([key, value]) => {
      const required = this.requirements[key] || 0;
      console.log(`${key}: ${value}/${required} (${((value/required)*100).toFixed(1)}%)`);
    });

    // Calculate total score
    const score = this.calculateScore(bot);
    const phase = this.determinePhase(score);
    console.log('\nFinal Results:');
    console.log('Total Score:', score);
    console.log('Current Phase:', phase);
    console.log('========================\n');
    
    return phase;
  }

  checkLayer(material, bot, yOffset) {
    const locations = this.houseLayout.birchPlanksLocations;
    locations.forEach(loc => {
      const blockPos = new Vec3(loc.x, loc.y + yOffset, loc.z);
      const block = bot.blockAt(blockPos);
      
      if (block) {
        console.log(`Checking ${material} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${block.name}`);
        
        switch(material) {
          case 'birchPlanks':
            if (block.name === 'birch_planks' || block.name === 'minecraft:birch_planks') {
              this.completion.birchPlanks++;
              console.log('✓ Found birch planks');
            }
            break;
            
          case 'andesiteStone':
            if (block.name === 'andesite' || block.name === 'minecraft:andesite' || 
                block.name === 'stone' || block.name === 'minecraft:stone') {
              this.completion.andesiteStone++;
              console.log('✓ Found andesite/stone');
            }
            break;
            
          case 'junglePlanks':
            if (block.name === 'jungle_planks' || block.name === 'minecraft:jungle_planks') {
              this.completion.junglePlanks++;
              console.log('✓ Found jungle planks');
            }
            break;
            
          case 'cobblestone':
            if (block.name === 'cobblestone' || block.name === 'minecraft:cobblestone') {
              this.completion.cobblestone++;
              console.log('✓ Found cobblestone');
            }
            break;
        }
      } else {
        console.log(`No block found at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
      }
    });
  }

  checkFences(bot) {
    this.houseLayout.fenceLocations.forEach(loc => {
      const blockPos = new Vec3(loc.x, loc.y, loc.z);
      const block = bot.blockAt(blockPos);
      
      if (block) {
        console.log(`Checking fence at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${block.name}`);
        if (block.name.includes('fence') && !block.name.includes('gate')) {
          this.completion.fence++;
          console.log('✓ Found fence');
        }
      } else {
        console.log(`No block found at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
      }
    });
  }

  checkFenceGates(bot) {
    this.houseLayout.fenceGateLocations.forEach(loc => {
      const blockPos = new Vec3(loc.x, loc.y, loc.z);
      const block = bot.blockAt(blockPos);
      
      if (block) {
        console.log(`Checking fence gate at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${block.name}`);
        if (block.name.includes('fence_gate')) {
          this.completion.fenceGate++;
          console.log('✓ Found fence gate');
        }
      } else {
        console.log(`No block found at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
      }
    });
  }

  checkStairs(bot) {
    this.houseLayout.stairLocations.forEach(loc => {
      const blockPos = new Vec3(loc.x, loc.y, loc.z);
      const block = bot.blockAt(blockPos);
      
      if (block) {
        console.log(`Checking stairs at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${block.name}`);
        if (block.name.includes('stairs')) {
          this.completion.stairs++;
          console.log('✓ Found stairs');
        }
      } else {
        console.log(`No block found at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
      }
    });
  }

  checkDoors(bot) {
    this.houseLayout.doorLocations.forEach(loc => {
      const blockPos = new Vec3(loc.x, loc.y, loc.z);
      const block = bot.blockAt(blockPos);
      
      if (block) {
        console.log(`Checking door at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${block.name}`);
        if (block.name.includes('door')) {
          this.completion.door++;
          console.log('✓ Found door');
        }
      } else {
        console.log(`No block found at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
      }
    });
  }

  calculateScore(bot) {
    // Get inventory counts
    const botInventory = this.countInventoryItems(bot.inventory.items());

    // Calculate building progress score
    const buildingScore =
      this.completion.birchPlanks +
      this.completion.andesiteStone +
      this.completion.junglePlanks +
      this.completion.cobblestone +
      this.completion.fence +
      this.completion.fenceGate +
      this.completion.stairs +
      this.completion.door;

    // Add inventory resources score (wood counts as 4, similar to original code)
    const resourceScore =
      (botInventory.wood || 0) * 4 +
      (botInventory.planks || 0) +
      (botInventory.stone || 0) +
      (botInventory.cobblestone || 0);

    return buildingScore + resourceScore;
  }

  countInventoryItems(items) {
    const counts = {};
    items.forEach(item => {
      counts[item.name] = (counts[item.name] || 0) + item.count;
    });
    return counts;
  }

  determinePhase(score) {
    if (score < 28) return 1;
    if (score < 54) return 2;
    if (score < 80) return 3;
    if (score < 115) return 4;
    return 5;
  }
}

class StateLogger {
  constructor() {
    this.lastState = null;
    this.logFile = 'minecraft_state_log.json';
    this.startTime = new Date();
    this.logs = [];
  }

  // Helper to get elapsed seconds since start
  getElapsedSeconds() {
    const now = new Date();
    return Math.floor((now - this.startTime) / 1000);
  }

  // Create a state object
  createStateObject(bot, humanPosition, humanInventory, humanBehavior, currentPhase) {
    const botPosition = bot.entity.position;
    const botInventory = bot.inventory.items().map(item => ({
      name: item.name,
      count: item.count
    }));

    const woodCount = botInventory
      .filter(item => item.name.includes('_log'))
      .reduce((sum, item) => sum + item.count, 0);

    const hasPickaxe = botInventory.some(item => item.name === 'wooden_pickaxe');
    const isNearHouse = humanPosition ?
      Math.sqrt(Math.pow(humanPosition.x - 3.5, 2) + Math.pow(humanPosition.z - 2, 2)) <= 5 :
      false;
    const isNearStone = humanPosition ?
      Math.sqrt(Math.pow(humanPosition.x - 23, 2) + Math.pow(humanPosition.z + 4, 2)) <= 5 :
      false;

    return {
      elapsed_seconds: this.getElapsedSeconds(),
      phase: currentPhase,
      actions: {
        human: {
          position: humanPosition,
          inventory: humanInventory,
          near_house: isNearHouse,
          near_stone: isNearStone,
          inferred_action: humanBehavior
        },
        robot: {
          position: {
            x: botPosition.x,
            y: botPosition.y,
            z: botPosition.z
          },
          inventory: botInventory,
          chopping_wood: !hasPickaxe && woodCount < 5,
          total_wood_greater_or_equal_5: woodCount >= 5,
          has_pickaxe: hasPickaxe,
          action: this.determineRobotAction(currentPhase, hasPickaxe, woodCount)
        }
      }
    };
  }

  determineRobotAction(phase, hasPickaxe, woodCount) {
    switch(phase) {
      case 1:
        return woodCount >= 5 ? "ready for crafting" : "chop birch wood";
      case 2:
        return woodCount >= 4 ? "ready for pickaxe" : "chop jungle wood";
      case 3:
        if (hasPickaxe) return "ready to mine stone";
        return woodCount >= 5 ? "ready for pickaxe" : "collecting wood";
      case 4:
        return hasPickaxe ? "mining stone" : "chopping wood";
      case 5:
        return "storing items";
      default:
        return "unknown";
    }
  }

  logState(bot, humanPosition, humanInventory, humanBehavior, currentPhase) {
    const newState = this.createStateObject(bot, humanPosition, humanInventory, humanBehavior, currentPhase);
    this.logs.push(newState);
    fs.writeFileSync(this.logFile, JSON.stringify(this.logs, null, 2));

    // Add debug logging
    console.log('\n=== State Log ===');
    console.log('Human Position:', humanPosition);
    console.log('Human near house:', newState.actions.human.near_house);
    console.log('Human near stone:', newState.actions.human.near_stone);
    console.log('Human behavior:', humanBehavior);
    console.log('Current phase:', currentPhase);
    console.log('================\n');
  }
}

function inferHumanBehavior(humanPosition, craftingTablePosition) {
  const DISTANCE_THRESHOLD = 5;

  if (!humanPosition) return 'unknown';

  // Convert human position to Vec3 for Mineflayer distance calculation
  const humanPos = new Vec3(humanPosition.x, humanPosition.y, humanPosition.z);

  // Check if human is near house
  const houseCenter = new Vec3(3.5, -60, 2);
  const houseDistance = humanPos.distanceTo(houseCenter);

  console.log('\n=== Distance Debug ===');
  console.log('Human position:', humanPos);
  console.log('House center:', houseCenter);
  console.log('Distance to house:', houseDistance);

  if (houseDistance <= DISTANCE_THRESHOLD) {
    // Check if near crafting table
    const craftingPos = new Vec3(craftingTablePosition.x, craftingTablePosition.y, craftingTablePosition.z);
    const craftingDistance = humanPos.distanceTo(craftingPos);
    console.log('Distance to crafting table:', craftingDistance);

    if (craftingDistance <= DISTANCE_THRESHOLD) {
      console.log('Behavior: crafting');
      return 'crafting';
    }
    console.log('Behavior: building');
    return 'building';
  }

  // Check distances to resource areas
  const stoneAreaCenter = new Vec3(23, -60, -4);
  const distanceToStone = humanPos.distanceTo(stoneAreaCenter);
  console.log('Distance to stone area:', distanceToStone);

  if (distanceToStone <= DISTANCE_THRESHOLD) {
    console.log('Behavior: mining');
    return 'mining';
  }

  // If not near any special areas, return unknown
  console.log('Behavior: unknown (not near any special areas)');
  console.log('==================\n');
  return 'unknown';
}

function createBot() {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot'
  });

  // Initialize the state logger
  const stateLogger = new StateLogger();

  bot.loadPlugin(pathfinder);
  const ws = new WebSocket('ws://localhost:8081');
  const houseTracker = new HouseTracker();

  const craftingTablePosition = new Vec3(5, 1, 11);
  const chestPosition = new Vec3(6, 1, 11);
  let readyToSendPickaxeRequest = false;
  let readyToSendCraftBirchPlanksRequest = false;
  let readyToSendCraftSticksRequest = false;
  let readyToStoreInChest = false;
  let currentPhase = 1;
  let lastBehavior = 'unknown';
  let isCollecting = false;
  let shouldStopCollecting = false;

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
      if (shouldStopCollecting) return false;
      const defaultMove = new Movements(bot, mcData(bot.version));
      bot.pathfinder.setMovements(defaultMove);
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      await bot.pathfinder.goto(goal);
      console.log(`Bot has moved to position at ${position}`);
      return true;
    } catch (err) {
      console.log(`Error moving to position: ${err}`);
      return false;
    }
  }

  async function digBlock(position) {
    try {
      if (shouldStopCollecting) return false;
      const targetBlock = bot.blockAt(position);
      if (targetBlock) {
        await bot.lookAt(targetBlock.position);
        await bot.dig(targetBlock);
        console.log(`Successfully mined block at ${position}`);
        printInventory();
        return true;
      } else {
        console.log(`No block found at ${position}`);
        return false;
      }
    } catch (err) {
      console.log(`Error digging block at ${position}: ${err}`);
      return false;
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

  async function collectLogs(woodType) {
    if (isCollecting) return; // Prevent multiple collection processes
    isCollecting = true;
    shouldStopCollecting = false;

    // Validate wood type parameter
    const validWoodTypes = ['jungle_log', 'birch_log'];
    const targetWoodType = validWoodTypes.includes(woodType) ? woodType : 'birch_log';

    console.log(`Starting ${targetWoodType.split('_')[0]} wood collection...`);

    while (!shouldStopCollecting) {
      const nearestLog = await findNearestBlock([targetWoodType]);
      if (nearestLog) {
        const moveSuccess = await moveToBlock(nearestLog.position);
        if (!moveSuccess) break;

        const digSuccess = await digBlock(nearestLog.position);
        if (!digSuccess) break;

        // Check wood count for the specific type
        const woodCount = bot.inventory.items()
          .filter(item => item.name === targetWoodType)
          .reduce((sum, item) => sum + item.count, 0);

        // Different requirements based on wood type
        const requiredAmount = targetWoodType === 'birch_log' ? 5 : 4;
        if (woodCount >= requiredAmount) {
          console.log(`Collected sufficient ${targetWoodType.split('_')[0]} wood (${woodCount} logs)`);
          break;
        }

        // Optional: Small delay to prevent too rapid collection
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.log(`No more ${targetWoodType.split('_')[0]} logs found nearby.`);
        break;
      }
    }

    console.log(`${targetWoodType.split('_')[0]} wood collection stopped.`);
    isCollecting = false;
  }

  async function handlePickaxe() {
    setTimeout(async () => {
      console.log('Starting pickaxe handling...');
      printInventory();

      const pickaxe = bot.inventory.findInventoryItem(bot.registry.itemsByName.wooden_pickaxe.id, null);
      if (pickaxe) {
        try {
          // First move the pickaxe to slot 36 (first hotbar slot)
          await bot.moveSlotItem(pickaxe.slot, 36);
          console.log('Moved pickaxe to hotbar slot 1');

          // Wait a short moment for the move to complete
          await new Promise(resolve => setTimeout(resolve, 250));

          // Then equip it
          await bot.equip(bot.registry.itemsByName.wooden_pickaxe.id, 'hand');
          console.log('Equipped the wooden pickaxe.');
        } catch (err) {
          console.log(`Error handling pickaxe: ${err}`);
        }
      } else {
        console.log('Wooden pickaxe not found in inventory.');
      }
      printInventory();
    }, 1000);
  }

  async function collectStone(stoneType) {
    if (isCollecting) return;
    isCollecting = true;
    shouldStopCollecting = false;

    // Validate stone type parameter
    const validStoneTypes = ['stone', 'cobblestone'];
    const targetStoneType = validStoneTypes.includes(stoneType) ? stoneType : 'stone';

    console.log(`Starting ${targetStoneType} collection...`);

    while (!shouldStopCollecting) {
      const nearestStone = await findNearestBlock([targetStoneType]);
      if (nearestStone) {
        const moveSuccess = await moveToBlock(nearestStone.position);
        if (!moveSuccess) break;

        const digSuccess = await digBlock(nearestStone.position);
        if (!digSuccess) break;

        // Check stone count for the specific type
        const stoneCount = bot.inventory.items()
          .filter(item => item.name === targetStoneType)
          .reduce((sum, item) => sum + item.count, 0);

        if (stoneCount >= 5) {
          console.log(`Collected sufficient ${targetStoneType} (${stoneCount} blocks)`);
          break;
        }

        // Optional: Small delay to prevent too rapid collection
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.log(`No more ${targetStoneType} blocks found nearby.`);
        break;
      }
    }

    console.log(`${targetStoneType} collection stopped.`);
    isCollecting = false;
  }

  async function storeItemsInChest() {
    console.log("Moving to chest position...");
    await moveToBlock(chestPosition);
    readyToStoreInChest = true;

    console.log("Bot inventory before storing in chest:");
    printInventory();
  }

  async function executeBotBehavior(phase, humanBehavior) {
    console.log(`Executing bot behavior for phase ${phase}, human behavior: ${humanBehavior}`);

    // Stop any ongoing collection when behavior changes
    if (isCollecting) {
      shouldStopCollecting = true;
      await new Promise(r => setTimeout(r, 1000)); // Wait for collection to stop
    }

    const getTotalWoodCount = () => {
      return bot.inventory.items()
        .filter(item => item.name.includes('_log'))
        .reduce((sum, item) => sum + item.count, 0);
    };

    const hasPickaxe = () => {
      return bot.inventory.items().some(item => item.name === 'wooden_pickaxe');
    };

    switch (phase) {
      case 1:
        if (getTotalWoodCount() >= 5) {
          readyToSendPickaxeRequest = true;
        } else {
          await collectLogs('birch_log');
        }
        break;

      case 2:
        if (humanBehavior === 'crafting') {
          if (getTotalWoodCount() >= 4) {
            readyToSendCraftBirchPlanksRequest = true
          } else {
            await collectLogs('jungle_log');
          }
        } else {
          if (getTotalWoodCount() >= 4) {
            if (!hasPickaxe()) {
              readyToSendPickaxeRequest = true
            }
          } else {
            await collectLogs('birch_log');
          }
        }
        break;

      case 3:
        if (getTotalWoodCount() >= 5) {
          if (humanBehavior === 'mining') {
            readyToSendPickaxeRequest = true;
          } else {
            await collectLogs('jungle_log');
          }
        } else {
          if (hasPickaxe()) {
            await collectStone('stone');
          } else {
            await collectLogs('jungle_log');
          }
        }
        break;

      case 4:
        if (hasPickaxe()) {
          if (houseTracker.completion.andesiteStone <= 10) {
            await collectStone('stone');
          } else {
            await collectStone('cobblestone');
          }
        } else {
          if (humanBehavior === 'chopping') {
            await collectLogs('jungle_log');
          } else {
            await collectLogs('birch_log');
          }
        }
        break;

      case 5:
        if (humanBehavior === 'crafting') {
          if (hasPickaxe()) {
            await collectStone('cobblestone');
          } else {
            await collectLogs('jungle_log');
          }
        } else {
          if (getTotalWoodCount() >= 5) {
            readyToSendCraftSticksRequest = true
          } else {
            await collectLogs('jungle_log');
          }
        }
        break;
    }
  }

  ws.on('open', () => {
    console.log('WebSocket connection established with Bukkit plugin.');
    bot.once('spawn', () => {
      console.log('Bot has spawned. Starting behavior system.');
      currentPhase = 1;

      setInterval(() => {
        // Print status information
        console.log('\n=== Bot Status Update ===');

        // Check house progress and update phase
        const newPhase = houseTracker.checkHouseProgress(bot);
        if (newPhase !== currentPhase) {
          console.log(`Phase changing from ${currentPhase} to ${newPhase}`);
          currentPhase = newPhase;
          executeBotBehavior(currentPhase, lastBehavior);
        }
        console.log(`Current Phase: ${currentPhase}`);

        // Log house completion status
        console.log('House Completion Status:');
        console.log(`Birch Planks: ${houseTracker.completion.birchPlanks}/${houseTracker.requirements.birchPlanks}`);
        console.log(`Andesite Stone: ${houseTracker.completion.andesiteStone}/${houseTracker.requirements.andesiteStone}`);
        console.log(`Jungle Planks: ${houseTracker.completion.junglePlanks}/${houseTracker.requirements.junglePlanks}`);
        console.log(`Cobblestone: ${houseTracker.completion.cobblestone}/${houseTracker.requirements.cobblestone}`);
        console.log(`Fence: ${houseTracker.completion.fence}/${houseTracker.requirements.fence}`);
        console.log(`Fence Gate: ${houseTracker.completion.fenceGate}/${houseTracker.requirements.fenceGate}`);
        console.log(`Stairs: ${houseTracker.completion.stairs}/${houseTracker.requirements.stairs}`);
        console.log(`Door: ${houseTracker.completion.door}/${houseTracker.requirements.door}`);

        // Get inventory status
        const hasPickaxe = bot.inventory.items().some(item => item.name === 'wooden_pickaxe');
        const woodCount = bot.inventory.items()
          .filter(item => item.name.includes('_log'))
          .reduce((sum, item) => sum + item.count, 0);

        // Determine current state based on phase and house completion
        let currentState;
        switch(currentPhase) {
          case 1:
            currentState = woodCount >= 5 ? 'Ready to craft planks' : 'Collecting birch logs';
            break;
          case 2:
            currentState = houseTracker.completion.birchPlanks >= houseTracker.requirements.birchPlanks ?
              'Birch planks complete' : 'Building birch plank foundation';
            break;
          case 3:
            if (hasPickaxe) {
              currentState = houseTracker.completion.andesiteStone >= houseTracker.requirements.andesiteStone ?
                'Andesite layer complete' : 'Mining andesite';
            } else {
              currentState = 'Need pickaxe for andesite';
            }
            break;
          case 4:
            currentState = houseTracker.completion.junglePlanks >= houseTracker.requirements.junglePlanks ?
              'Jungle planks complete' : 'Building jungle plank layer';
            break;
          case 5:
            currentState = 'Completing final house elements';
            break;
        }

        console.log(`Current State: ${currentState}`);
        console.log(`Human Behavior: ${lastBehavior}`);
        console.log(`Bot Activity: ${isCollecting ? 'Actively collecting resources' : 'Idle or moving'}`);
        console.log('=======================\n');

        // Send bot data to server
        if (bot.entity && bot.entity.position) {
          const position = {
            x: bot.entity.position.x,
            y: bot.entity.position.y,
            z: bot.entity.position.z
          };

          const inventoryItems = bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count
          }));

          const targetBlock = bot.blockAtCursor(5);
          const lookingAt = targetBlock ? {
            name: targetBlock.name,
            position: {
              x: targetBlock.position.x,
              y: targetBlock.position.y,
              z: targetBlock.position.z
            }
          } : null;

          const botData = {
            position,
            inventory: inventoryItems,
            lookingAt
          };

          ws.send(JSON.stringify(botData));
        }

        // Handle pickaxe request
        if (readyToSendPickaxeRequest) {
          ws.send("1");
          console.log('Sent signal to server to give bot a wooden pickaxe.');
          readyToSendPickaxeRequest = false;
        }

        // Handle chest storage
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
        // Handle birch planks crafting request
        if (readyToSendCraftBirchPlanksRequest) {
          // Get the number of logs that can be converted to planks
          const birchLogs = bot.inventory.items()
            .filter(item => item.name === 'birch_log')
            .reduce((sum, item) => sum + item.count, 0);

          if (birchLogs > 0) {
            // Each log makes 4 planks, send the request with the amount
            const message = `craftPlanks:birch_planks:${birchLogs * 4}`;
            ws.send(message);
            console.log(`Sent signal to server to craft ${birchLogs * 4} birch planks`);
          }
          readyToSendCraftBirchPlanksRequest = false;
        }
        // Handle sticks crafting request
        if (readyToSendCraftSticksRequest) {
          // Get the number of planks that can be converted to sticks
          const planks = bot.inventory.items()
            .filter(item => item.name.includes('_planks'))
            .reduce((sum, item) => sum + item.count, 0);

          if (planks >= 2) { // Need 2 planks to make 4 sticks
            // Each 2 planks makes 4 sticks
            const sticksToMake = Math.floor(planks / 2) * 4;
            const message = `craftSticks:stick:${sticksToMake}`;
            ws.send(message);
            console.log(`Sent signal to server to craft ${sticksToMake} sticks`);
          }
          readyToSendCraftSticksRequest = false;
        }

        // Log state
        stateLogger.logState(bot, humanPosition, humanInventory, lastBehavior, currentPhase);
      }, 5000);

      setTimeout(async () => {
        await executeBotBehavior(currentPhase, 'unknown');
      }, 5000);
    });
  });

  let humanPosition = { x: 0, y: 0, z: 0 };
  let humanInventory = [];
  let humanLookingAt = { name: null, position: { x: 0, y: 0, z: 0 } };

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.action === 'pickaxeReceived') {
        console.log('Received signal from server that the bot received a wooden pickaxe.');
        await handlePickaxe();
      } else if (message.action === 'planksReceived') {
        console.log('Received signal from server that birch planks were crafted.');
        printInventory();
      } else if (message.action === 'sticksReceived') {
        console.log('Received signal from server that sticks were crafted.');
        printInventory();
      } else if (message.action === 'chestStored') {
        console.log('Received signal from server that items were stored in the chest.');
        printInventory();
      }

      if (message.position) {
        const { x, y, z } = message.position;
        humanPosition = { x, y, z };
        console.log(`Human position: X=${x}, Y=${y}, Z=${z}`);

        const humanBehavior = inferHumanBehavior(humanPosition, craftingTablePosition);
        if (humanBehavior !== lastBehavior) {
          lastBehavior = humanBehavior;
          console.log(`Detected human behavior: ${humanBehavior}`);
          await executeBotBehavior(currentPhase, humanBehavior);
        }
      }

      if (message.inventory) {
        humanInventory = message.inventory.map(item => ({ name: item.name, count: item.count }));
        console.log('Human inventory updated');
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
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