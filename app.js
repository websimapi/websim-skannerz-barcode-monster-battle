// Global game state variables
let playerTribe = "";
let playerCollection = [];
let currentEnemyMonster = null;
let currentPlayerMonster = null;
let scanningActive = false;
let ambientSensor = null; // New variable for Ambient Light Sensor

// Helper: Show only the designated screen
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

// Initialize tribe selection and attach event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Tribe button event listener
  document.querySelectorAll('.tribe-btn').forEach(button => {
    button.addEventListener('click', () => {
      // Set player's tribe based on selected button (Zendra, Pataak, Ujalu)
      playerTribe = button.getAttribute('data-tribe');
      // Clear any previous collection
      playerCollection = [];
      showScreen('scanner-screen');
      startScanner();
    });
  });
  
  // Stop scanning button returns to start screen
  document.getElementById('stop-scan-btn').addEventListener('click', () => {
    scanningActive = false;
    Quagga.stop();
    if (ambientSensor) {
      ambientSensor.stop();
      ambientSensor = null;
    }
    toggleTorch(false); // Ensure torch is turned off
    showScreen('start-screen');
  });
  
  // Continue button in result screen
  document.getElementById('result-continue-btn').addEventListener('click', () => {
    // If a rival monster was scanned, initiate battle
    if (currentEnemyMonster) {
      // If player has collected monsters, use the first one; otherwise generate a default starter
      if (playerCollection.length > 0) {
        currentPlayerMonster = cloneMonster(playerCollection[0]);
      } else {
        currentPlayerMonster = generateDefaultPlayerMonster();
      }
      // Reset HP for battle simulation
      currentPlayerMonster.hp = 100;
      currentEnemyMonster.hp = 100;
      initBattle(currentPlayerMonster, currentEnemyMonster);
      currentEnemyMonster = null; // clear candidate
      showScreen('battle-screen');
    } else {
      // Otherwise resume scanning
      showScreen('scanner-screen');
      startScanner();
    }
  });
  
  // Back button in battle screen returns to scanner
  document.getElementById('battle-back-btn').addEventListener('click', () => {
    showScreen('scanner-screen');
    startScanner();
  });
});

// Start the barcode scanner using QuaggaJS
function startScanner() {
  scanningActive = true;

  // Setup Ambient Light Sensor to auto-enable torch in dark environments
  if ('AmbientLightSensor' in window) {
    try {
      ambientSensor = new AmbientLightSensor();
      ambientSensor.addEventListener('reading', () => {
        console.log('Ambient light level:', ambientSensor.illuminance);
        // Threshold for darkness (e.g., less than 10 lux)
        if (ambientSensor.illuminance < 10) {
          toggleTorch(true);
        } else {
          toggleTorch(false);
        }
      });
      ambientSensor.addEventListener('error', (event) => {
        console.error('AmbientLightSensor error:', event.error.name, event.error.message);
      });
      ambientSensor.start();
    } catch (error) {
      console.error('Failed to start AmbientLightSensor:', error);
    }
  } else {
    console.warn('Ambient Light Sensor API not supported on this device.');
  }

  // Initialize Quagga with live video stream from the environment (back) camera
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector("#scanner-container"),
      constraints: {
        facingMode: "environment"
      }
    },
    decoder: {
      readers: ["upc_reader", "ean_reader", "code_128_reader"]
    }
  }, function(err) {
    if (err) {
      console.error(err);
      return;
    }
    Quagga.start();
  });
  
  // When a barcode is detected, process it (only once per scanning session)
  Quagga.offDetected(); // Remove any previous callback
  Quagga.onDetected(result => {
    if (scanningActive) {
      scanningActive = false;
      Quagga.stop();
      if (ambientSensor) {
        ambientSensor.stop();
        ambientSensor = null;
      }
      toggleTorch(false); // Turn off torch when scanning stops
      processBarcode(result.codeResult.code);
    }
  });
}

// Toggle the camera's torch (flashlight) if supported
function toggleTorch(enable) {
  const video = document.querySelector('#scanner-container video');
  if (video && video.srcObject) {
    const track = video.srcObject.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities();
      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: enable }]
        }).then(() => {
          console.log(`Torch ${enable ? 'enabled' : 'disabled'}.`);
        }).catch(err => {
          console.error('Failed to set torch mode:', err);
        });
      }
    }
  }
}

// Process the scanned barcode and generate a monster
function processBarcode(barcode) {
  const monster = generateMonster(barcode);
  const resultContent = document.getElementById('result-content');
  if (monster.tribe === playerTribe) {
    // Friendly monster: add to collection
    playerCollection.push(monster);
    resultContent.innerHTML = `
      <h3>You collected a new ${monster.tribe} monster!</h3>
      <div class="monster-svg">${monster.svg}</div>
      <p>Name: ${monster.name}</p>
      <p>Type: ${monster.type}</p>
      <p>Attack Moves:</p>
      <ul>
        ${monster.attacks.map(atk => `<li>${atk.name} (Damage: ${atk.damage})</li>`).join('')}
      </ul>
    `;
  } else {
    // Rival monster: trigger battle sequence
    resultContent.innerHTML = `
      <h3>A rival ${monster.tribe} monster appears!</h3>
      <div class="monster-svg">${monster.svg}</div>
      <p>Name: ${monster.name}</p>
      <p>Type: ${monster.type}</p>
      <p>Prepare for battle!</p>
    `;
    // Save the enemy monster for battle initialization
    currentEnemyMonster = monster;
  }
  showScreen('result-screen');
}

// Generate a monster based on the scanned barcode string
function generateMonster(barcode) {
  let num = parseInt(barcode);
  // If not a valid number, sum the char codes of the string
  if (isNaN(num)) {
    num = 0;
    for (let i = 0; i < barcode.length; i++) {
      num += barcode.charCodeAt(i);
    }
  }
  // Determine tribe based on mod 3
  let tribeIndex = num % 3;
  let tribe = (tribeIndex === 0) ? "Zendra" : (tribeIndex === 1) ? "Pataak" : "Ujalu";
  // Determine monster type using a different modulus for variety
  let typeIndex = Math.floor(num / 7) % 3;
  const types = ["Magic", "Tech", "Power"];
  let type = types[typeIndex];
  // Generate a evocative name
  const adjectives = ["Mystic", "Fierce", "Brave", "Shadow", "Wild", "Ancient", "Electric"];
  const creatures = ["Drake", "Golem", "Sprite", "Beast", "Serpent", "Titan", "Phoenix"];
  let name = adjectives[num % adjectives.length] + " " + creatures[(num + 1) % creatures.length];
  // Create a set of three attacks; damage increases with each move
  let attackNames;
  if (type === "Magic") {
    attackNames = ["Spellbind", "Arcane Blast", "Mystic Wave"];
  } else if (type === "Tech") {
    attackNames = ["Laser Shot", "Cyber Strike", "Plasma Burst"];
  } else {
    attackNames = ["Power Punch", "Thunder Slam", "Mega Smash"];
  }
  let baseDamage = 10 + (num % 11); // Damage range between 10 and 20
  const attacks = attackNames.map((name, i) => ({
    name: name,
    damage: baseDamage + i * 5
  }));
  
  const monster = {
    id: barcode,
    tribe: tribe,
    type: type,
    name: name,
    attacks: attacks,
    hp: 100
  };
  monster.svg = generateSVG(monster);
  return monster;
}

// Generate an inline SVG graphic for the monster based on its type and tribe color
function generateSVG(monster) {
  let color = "#999";
  // Map tribes to colors
  if (monster.tribe === "Zendra") {
    color = "#4A90E2"; // Blue
  } else if (monster.tribe === "Pataak") {
    color = "#7ED321"; // Green
  } else if (monster.tribe === "Ujalu") {
    color = "#D0021B"; // Red
  }
  
  let svgMarkup = "";
  if (monster.type === "Magic") {
    svgMarkup = `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="30" fill="${color}" />
    </svg>`;
  } else if (monster.type === "Tech") {
    svgMarkup = `<svg viewBox="0 0 100 100">
      <rect x="20" y="20" width="60" height="60" fill="${color}" transform="rotate(45 50 50)" />
    </svg>`;
  } else if (monster.type === "Power") {
    svgMarkup = `<svg viewBox="0 0 100 100">
      <polygon points="50,15 80,85 20,85" fill="${color}" />
    </svg>`;
  } else {
    svgMarkup = `<svg viewBox="0 0 100 100">
      <ellipse cx="50" cy="50" rx="30" ry="20" fill="${color}" />
    </svg>`;
  }
  return svgMarkup;
}

// Clone a monster object (for battle simulation without affecting the original)
function cloneMonster(monster) {
  return JSON.parse(JSON.stringify(monster));
}

// Generate a default starter monster if the player has not collected any
function generateDefaultPlayerMonster() {
  const monster = {
    id: "default",
    tribe: playerTribe,
    type: "Power",
    name: "Starter " + playerTribe,
    attacks: [
      { name: "Starter Punch", damage: 15 },
      { name: "Starter Kick", damage: 20 },
      { name: "Starter Slam", damage: 25 }
    ],
    hp: 100
  };
  monster.svg = generateSVG(monster);
  return monster;
}

// Initialize the battle by displaying both monsters and setting up attack options
function initBattle(playerMonster, enemyMonster) {
  // Display player monster info
  document.getElementById('player-monster').innerHTML = `
    <div class="monster-svg">${playerMonster.svg}</div>
    <h3>${playerMonster.name}</h3>
    <p>${playerMonster.type}</p>
  `;
  // Display enemy monster info
  document.getElementById('enemy-monster').innerHTML = `
    <div class="monster-svg">${enemyMonster.svg}</div>
    <h3>${enemyMonster.name}</h3>
    <p>${enemyMonster.type}</p>
  `;
  
  // Set initial HP values in the UI
  document.getElementById('player-hp').textContent = playerMonster.hp;
  document.getElementById('enemy-hp').textContent = enemyMonster.hp;
  
  // Build attack buttons for the player's monster
  const attackContainer = document.getElementById('attack-options');
  attackContainer.innerHTML = "";
  playerMonster.attacks.forEach((attack, index) => {
    const btn = document.createElement('button');
    btn.textContent = `${attack.name} (Damage: ${attack.damage})`;
    btn.classList.add('attack-btn');
    btn.addEventListener('click', () => handleAttack(index));
    attackContainer.appendChild(btn);
  });
  
  // Hide the back button until battle concludes
  document.getElementById('battle-back-btn').classList.add('hidden');
}

// Handle a battle round when the player selects one of the attack moves
function handleAttack(attackIndex) {
  // Player's chosen attack
  const playerAttack = currentPlayerMonster.attacks[attackIndex];
  currentEnemyMonster.hp -= playerAttack.damage;
  updateBattleUI();

  // Check if enemy has been defeated
  if (currentEnemyMonster.hp <= 0) {
    alert(`Victory! Your ${currentPlayerMonster.name} defeated the rival monster!`);
    // Optionally add the defeated rival to your collection
    playerCollection.push(cloneMonster(currentEnemyMonster));
    disableAttackButtons();
    document.getElementById('battle-back-btn').classList.remove('hidden');
    return;
  }
  
  // Enemy counterattack: choose a random attack
  const enemyAttack = currentEnemyMonster.attacks[Math.floor(Math.random() * currentEnemyMonster.attacks.length)];
  currentPlayerMonster.hp -= enemyAttack.damage;
  updateBattleUI();

  // Check if player's monster is defeated
  if (currentPlayerMonster.hp <= 0) {
    alert(`Defeat! Your ${currentPlayerMonster.name} has been knocked out!`);
    disableAttackButtons();
    document.getElementById('battle-back-btn').classList.remove('hidden');
    return;
  }
}

// Update the battle info (HP display) in the UI
function updateBattleUI() {
  document.getElementById('player-hp').textContent = Math.max(currentPlayerMonster.hp, 0);
  document.getElementById('enemy-hp').textContent = Math.max(currentEnemyMonster.hp, 0);
}

// Disable the attack buttons after battle concludes
function disableAttackButtons() {
  const attackBtns = document.querySelectorAll('#attack-options button');
  attackBtns.forEach(btn => btn.disabled = true);
}