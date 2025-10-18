# Tower Defense: A FHE-Based Strategic Game

Dive into the world of *Tower Defense*, a thrilling tower defense game where the next wave of enemies is shrouded in uncertainty. This game uniquely utilizes **Zama's Fully Homomorphic Encryption (FHE) technology** to encrypt enemy paths and unit compositions, providing players with only blurred warning information to strategize their defenses.

## The Challenge of Defense

In traditional tower defense games, players have the advantage of knowing enemy paths and unit types in advance, allowing for calculated strategies. However, *Tower Defense* flips this paradigm. The paths of the incoming enemies and the specific units are encrypted using FHE, making it impossible for players to see clear information. Instead, they receive vague alerts that challenge them to think on their feet and adapt to constantly shifting scenarios.

## The FHE Solution

*Tower Defense* addresses the problem of predictability in strategy games by implementing **Fully Homomorphic Encryption** through **Zama's open-source libraries**. By encrypting crucial game elements like enemy paths, players are compelled to enhance their risk management skills. Using Zama’s libraries, such as **Concrete** and **TFHE-rs**, the game maintains the integrity of gameplay while ensuring sensitive data remains confidential.

The ability of FHE to perform computations on encrypted data means that game mechanics, such as enemy pathfinding, can occur without revealing the underlying data to the player. This not only adds layers to the gameplay but also fosters a deeper engagement as players must rely on intuition and limited information to succeed.

## Key Features

- **Encrypted Enemy Paths:** Enemy movements and unit compositions are securely encrypted, adding unpredictability to each wave.
- **Blurry Alerts:** Players receive inconclusive warning signals that provide hints without clear details, enhancing suspense.
- **Adaptive Gameplay:** Players must develop defenses based on analytical skills and risk assessment rather than straightforward knowledge.
- **Engaging Art Style:** The game features a colorful, cartoonish aesthetic that makes strategic planning a visually enjoyable experience.
- **Interactive Grid Map:** Navigate through a grid-based map to build and upgrade defensive towers.

## Technology Stack

- **Zama FHE SDK** (using Concrete and TFHE-rs)
- **Node.js** for backend functionality
- **Hardhat** for smart contract development
- **Solidity** for smart contract implementation

## Directory Structure

Here's how the project's directory is organized:

```
/Tower_Defense_FHE
│
├── contracts
│   └── Tower_Defense_FHE.sol
│
├── src
│   ├── gameLogic.js
│   ├── towerDefense.js
│   └── main.js
│
├── test
│   └── gameLogic.test.js
│
├── package.json
├── hardhat.config.js
└── README.md
```

## Installation Instructions

To set up the *Tower Defense* project on your local machine, follow these steps:

1. Ensure you have **Node.js** installed (version 14 or above).
2. Navigate to the project directory using your terminal.
3. Run the following command to install dependencies including the required Zama FHE libraries:

   ```bash
   npm install
   ```

**Important:** Do not use `git clone` or any other method to obtain the repository; please download it directly.

## Build & Run Instructions

Once you have installed the necessary dependencies, you can proceed to compile and run the game. Use the following commands:

1. **Compile Contracts:**

   ```bash
   npx hardhat compile
   ```

2. **Run Tests:**

   ```bash
   npx hardhat test
   ```

3. **Start the Game:**

   To start the Tower Defense game, run:

   ```bash
   node src/main.js
   ```

## Example Code

Here’s a simple example of how to use the game’s main function to display a blurred enemy alert:

```javascript
const { blurAlert } = require('./towerDefense');

function displayEnemyAlert() {
    const alertMessage = blurAlert();
    console.log(`🚨 Alert: Incoming enemies are on their way! ${alertMessage}`);
}

displayEnemyAlert();
```

This code snippet demonstrates how the player receives a blurred alert, prompting them to prepare their defenses accordingly.

## Acknowledgements

**Powered by Zama**: We extend our heartfelt gratitude to the Zama team for their groundbreaking work in developing open-source tools that enable confidential computations in blockchain applications. Their technologies empower developers to push the envelope of what is possible in secure gaming experiences.

---

Experience the thrill of strategic gameplay like never before with *Tower Defense*, where every decision matters, and safety is a top priority.
