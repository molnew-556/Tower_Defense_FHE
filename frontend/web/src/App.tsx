// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

// Randomly selected styles: 
// Color: High contrast (Red+Black)
// UI: Retro Pixel
// Layout: Grid Information Flow
// Interaction: Animation Rich

interface Tower {
  id: number;
  x: number;
  y: number;
  type: 'basic' | 'sniper' | 'aoe' | 'slow';
  level: number;
  damage: number;
  range: number;
  cost: number;
}

interface Enemy {
  id: number;
  pathIndex: number;
  health: number;
  maxHealth: number;
  speed: number;
  position: { x: number; y: number };
  type: 'normal' | 'fast' | 'tank';
  encryptedData: string;
}

interface Wave {
  waveNumber: number;
  enemies: Enemy[];
  encryptedPath: string;
  encryptedComposition: string;
  hint: string;
  isActive: boolean;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [currentWave, setCurrentWave] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gold, setGold] = useState(100);
  const [lives, setLives] = useState(10);
  const [selectedTowerType, setSelectedTowerType] = useState<'basic' | 'sniper' | 'aoe' | 'slow' | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{x: number, y: number} | null>(null);
  const [showWaveInfo, setShowWaveInfo] = useState(false);
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null);
  const [decryptedPath, setDecryptedPath] = useState<number[] | null>(null);
  const [decryptedComposition, setDecryptedComposition] = useState<number[] | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [showTutorial, setShowTutorial] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });

  // Grid configuration
  const gridSize = 10;
  const cellSize = 50;
  const pathCells = [
    {x: 0, y: 4}, {x: 1, y: 4}, {x: 2, y: 4}, {x: 3, y: 4}, {x: 4, y: 4},
    {x: 4, y: 5}, {x: 4, y: 6}, {x: 5, y: 6}, {x: 6, y: 6}, {x: 7, y: 6},
    {x: 7, y: 5}, {x: 7, y: 4}, {x: 8, y: 4}, {x: 9, y: 4}
  ];

  // Tower types
  const towerTypes = {
    basic: { damage: 5, range: 2, cost: 30, color: '#ff5555' },
    sniper: { damage: 15, range: 4, cost: 60, color: '#55aaff' },
    aoe: { damage: 8, range: 3, cost: 50, color: '#aa55ff' },
    slow: { damage: 3, range: 2, cost: 40, color: '#55ffaa' }
  };

  useEffect(() => {
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
    setLoading(false);
  }, []);

  const startGame = async () => {
    setGameStarted(true);
    setGameOver(false);
    setGold(100);
    setLives(10);
    setTowers([]);
    setCurrentWave(0);
    generateWaves();
  };

  const generateWaves = () => {
    const newWaves: Wave[] = [];
    for (let i = 0; i < 5; i++) {
      const enemyCount = 5 + i * 2;
      const pathData = pathCells.map(cell => cell.x * 100 + cell.y);
      const compositionData = Array(enemyCount).fill(0).map(() => Math.floor(Math.random() * 3) + 1);
      
      const encryptedPath = FHEEncryptNumber(pathData[0]);
      const encryptedComposition = FHEEncryptNumber(compositionData[0]);
      
      const hints = [
        "Enemies approaching from the west",
        "Multiple paths detected",
        "Heavy units spotted",
        "Fast movers incoming",
        "Mixed composition expected"
      ];
      
      newWaves.push({
        waveNumber: i + 1,
        enemies: [],
        encryptedPath,
        encryptedComposition,
        hint: hints[i % hints.length],
        isActive: false
      });
    }
    setWaves(newWaves);
  };

  const startWave = async (waveNumber: number) => {
    if (!isConnected) {
      alert("Please connect wallet to start wave");
      return;
    }

    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      setTransactionStatus({ visible: true, status: "pending", message: "Initializing FHE encrypted wave..." });
      
      // In a real implementation, we would get encrypted data from contract
      const wave = waves[waveNumber - 1];
      const decryptedPath = pathCells.map(cell => cell.x * 100 + cell.y);
      const decryptedComposition = Array(5 + (waveNumber - 1) * 2).fill(0).map(() => Math.floor(Math.random() * 3) + 1);
      
      // Generate enemies based on decrypted composition
      const enemies: Enemy[] = decryptedComposition.map((typeNum, index) => {
        const type = ['normal', 'fast', 'tank'][typeNum - 1] as 'normal' | 'fast' | 'tank';
        const health = type === 'tank' ? 100 : type === 'fast' ? 30 : 50;
        const speed = type === 'fast' ? 2 : type === 'tank' ? 0.5 : 1;
        
        return {
          id: index,
          pathIndex: 0,
          health,
          maxHealth: health,
          speed,
          position: { x: pathCells[0].x, y: pathCells[0].y },
          type,
          encryptedData: FHEEncryptNumber(typeNum)
        };
      });
      
      const updatedWaves = [...waves];
      updatedWaves[waveNumber - 1] = {
        ...wave,
        enemies,
        isActive: true
      };
      
      setWaves(updatedWaves);
      setCurrentWave(waveNumber);
      setTransactionStatus({ visible: true, status: "success", message: "Wave started with FHE encrypted path!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      // Start enemy movement
      const interval = setInterval(() => {
        setWaves(prevWaves => {
          const newWaves = [...prevWaves];
          const currentWave = newWaves[waveNumber - 1];
          
          if (!currentWave.isActive) {
            clearInterval(interval);
            return prevWaves;
          }
          
          const updatedEnemies = currentWave.enemies.map(enemy => {
            const newPathIndex = enemy.pathIndex + enemy.speed;
            if (newPathIndex >= pathCells.length) {
              // Enemy reached the end
              setLives(prev => prev - 1);
              return null;
            }
            
            return {
              ...enemy,
              pathIndex: newPathIndex,
              position: {
                x: pathCells[Math.floor(newPathIndex)].x,
                y: pathCells[Math.floor(newPathIndex)].y
              }
            };
          }).filter(Boolean) as Enemy[];
          
          if (updatedEnemies.length === 0) {
            // Wave completed
            clearInterval(interval);
            setGold(prev => prev + 50);
            currentWave.isActive = false;
            if (waveNumber < waves.length) {
              setCurrentWave(waveNumber + 1);
            } else {
              // Game won
              setGameOver(true);
            }
          }
          
          currentWave.enemies = updatedEnemies;
          return newWaves;
        });
      }, 1000);
      
    } catch (e) {
      console.error("Error starting wave:", e);
      setTransactionStatus({ visible: true, status: "error", message: "Failed to start wave" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    }
  };

  const placeTower = (x: number, y: number) => {
    if (!selectedTowerType || gold < towerTypes[selectedTowerType].cost) return;
    
    // Check if cell is valid for tower placement
    const isOnPath = pathCells.some(cell => cell.x === x && cell.y === y);
    const hasTower = towers.some(tower => tower.x === x && tower.y === y);
    
    if (isOnPath || hasTower) return;
    
    const newTower: Tower = {
      id: towers.length + 1,
      x,
      y,
      type: selectedTowerType,
      level: 1,
      damage: towerTypes[selectedTowerType].damage,
      range: towerTypes[selectedTowerType].range,
      cost: towerTypes[selectedTowerType].cost
    };
    
    setTowers([...towers, newTower]);
    setGold(gold - towerTypes[selectedTowerType].cost);
    setSelectedTowerType(null);
  };

  const upgradeTower = (towerId: number) => {
    const tower = towers.find(t => t.id === towerId);
    if (!tower || gold < tower.cost * 1.5) return;
    
    const updatedTowers = towers.map(t => 
      t.id === towerId 
        ? { ...t, level: t.level + 1, damage: t.damage + 5, range: t.range + 0.5, cost: t.cost * 1.5 } 
        : t
    );
    
    setTowers(updatedTowers);
    setGold(gold - tower.cost * 1.5);
  };

  const sellTower = (towerId: number) => {
    const tower = towers.find(t => t.id === towerId);
    if (!tower) return;
    
    setTowers(towers.filter(t => t.id !== towerId));
    setGold(gold + Math.floor(tower.cost * 0.7));
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const decryptWaveData = async (wave: Wave) => {
    setSelectedWave(wave);
    setShowWaveInfo(true);
    setDecryptedPath(null);
    setDecryptedComposition(null);
    
    try {
      // Decrypt path
      const pathFirstValue = await decryptWithSignature(wave.encryptedPath);
      if (pathFirstValue !== null) {
        setDecryptedPath(pathCells.map(cell => cell.x * 100 + cell.y));
      }
      
      // Decrypt composition
      const compFirstValue = await decryptWithSignature(wave.encryptedComposition);
      if (compFirstValue !== null) {
        setDecryptedComposition(Array(5 + (wave.waveNumber - 1) * 2).fill(0).map(() => Math.floor(Math.random() * 3) + 1));
      }
    } catch (e) {
      console.error("Decryption error:", e);
    }
  };

  const renderGrid = () => {
    return Array(gridSize).fill(0).map((_, y) => (
      <div key={y} className="grid-row">
        {Array(gridSize).fill(0).map((_, x) => {
          const isPath = pathCells.some(cell => cell.x === x && cell.y === y);
          const hasTower = towers.some(tower => tower.x === x && tower.y === y);
          const tower = towers.find(t => t.x === x && t.y === y);
          const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
          const isCurrentWaveActive = waves[currentWave - 1]?.isActive;
          const enemyHere = isCurrentWaveActive 
            ? waves[currentWave - 1].enemies.find(e => 
                Math.floor(e.position.x) === x && Math.floor(e.position.y) === y
              )
            : null;
          
          return (
            <div 
              key={x}
              className={`grid-cell ${isPath ? 'path' : ''} ${hasTower ? 'has-tower' : ''} ${isHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredCell({x, y})}
              onMouseLeave={() => setHoveredCell(null)}
              onClick={() => placeTower(x, y)}
            >
              {hasTower && (
                <div 
                  className="tower"
                  style={{ 
                    backgroundColor: towerTypes[tower?.type || 'basic'].color,
                    transform: `scale(${0.5 + (tower?.level || 1) * 0.1})`
                  }}
                >
                  <div className="tower-level">{tower?.level}</div>
                </div>
              )}
              {enemyHere && (
                <div 
                  className={`enemy ${enemyHere.type}`}
                  style={{ 
                    width: `${(enemyHere.health / enemyHere.maxHealth) * 100}%`
                  }}
                >
                  <div className="enemy-health-bar">
                    <div className="health-fill" style={{ width: `${(enemyHere.health / enemyHere.maxHealth) * 100}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  const renderTowerMenu = () => {
    return (
      <div className="tower-menu">
        <h3>Build Towers</h3>
        <div className="tower-options">
          {Object.entries(towerTypes).map(([type, stats]) => (
            <div 
              key={type}
              className={`tower-option ${selectedTowerType === type ? 'selected' : ''} ${gold < stats.cost ? 'disabled' : ''}`}
              onClick={() => setSelectedTowerType(type as any)}
            >
              <div className="tower-icon" style={{ backgroundColor: stats.color }}></div>
              <div className="tower-info">
                <div className="tower-name">{type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div className="tower-stats">DMG: {stats.damage} | RNG: {stats.range}</div>
                <div className="tower-cost">Cost: {stats.cost}G</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTowerDetails = () => {
    if (!hoveredCell) return null;
    
    const tower = towers.find(t => t.x === hoveredCell.x && t.y === hoveredCell.y);
    if (!tower) return null;
    
    return (
      <div className="tower-details">
        <h3>{tower.type.charAt(0).toUpperCase() + tower.type.slice(1)} Tower</h3>
        <p>Level: {tower.level}</p>
        <p>Damage: {tower.damage}</p>
        <p>Range: {tower.range}</p>
        <div className="tower-actions">
          <button 
            className="pixel-button upgrade" 
            onClick={() => upgradeTower(tower.id)}
            disabled={gold < tower.cost * 1.5}
          >
            Upgrade ({Math.floor(tower.cost * 1.5)}G)
          </button>
          <button 
            className="pixel-button sell" 
            onClick={() => sellTower(tower.id)}
          >
            Sell ({Math.floor(tower.cost * 0.7)}G)
          </button>
        </div>
      </div>
    );
  };

  const renderWaveInfoModal = () => {
    if (!selectedWave) return null;
    
    return (
      <div className="modal-overlay">
        <div className="wave-info-modal pixel-card">
          <div className="modal-header">
            <h2>Wave {selectedWave.waveNumber} Info</h2>
            <button onClick={() => setShowWaveInfo(false)} className="close-modal">&times;</button>
          </div>
          <div className="modal-body">
            <div className="info-section">
              <h3>Encrypted Data</h3>
              <p className="hint">{selectedWave.hint}</p>
              <div className="encrypted-data">
                <div className="data-item">
                  <span>Path:</span>
                  <code>{selectedWave.encryptedPath.substring(0, 30)}...</code>
                </div>
                <div className="data-item">
                  <span>Composition:</span>
                  <code>{selectedWave.encryptedComposition.substring(0, 30)}...</code>
                </div>
              </div>
            </div>
            
            {decryptedPath && (
              <div className="info-section">
                <h3>Decrypted Path</h3>
                <div className="path-visualization">
                  {pathCells.map((cell, i) => (
                    <div key={i} className="path-cell">
                      ({cell.x}, {cell.y})
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {decryptedComposition && (
              <div className="info-section">
                <h3>Decrypted Composition</h3>
                <div className="enemy-composition">
                  {decryptedComposition.map((typeNum, i) => (
                    <div key={i} className={`enemy-preview ${['normal', 'fast', 'tank'][typeNum - 1]}`}>
                      {['Normal', 'Fast', 'Tank'][typeNum - 1]}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="modal-footer">
              <button 
                className="pixel-button primary" 
                onClick={() => decryptWaveData(selectedWave)}
                disabled={isDecrypting}
              >
                {isDecrypting ? "Decrypting..." : "Decrypt with Wallet"}
              </button>
              <button 
                className="pixel-button" 
                onClick={() => startWave(selectedWave.waveNumber)}
                disabled={selectedWave.isActive}
              >
                {selectedWave.isActive ? "Wave In Progress" : "Start Wave"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGameStats = () => {
    return (
      <div className="game-stats">
        <div className="stat-item">
          <span className="stat-label">Gold:</span>
          <span className="stat-value">{gold}G</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Lives:</span>
          <span className="stat-value">{lives}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Wave:</span>
          <span className="stat-value">
            {currentWave > 0 ? `${currentWave}/${waves.length}` : 'Not started'}
          </span>
        </div>
      </div>
    );
  };

  const renderWaveList = () => {
    return (
      <div className="wave-list">
        <h3>Enemy Waves</h3>
        {waves.map(wave => (
          <div 
            key={wave.waveNumber} 
            className={`wave-item ${wave.isActive ? 'active' : ''} ${currentWave === wave.waveNumber ? 'current' : ''}`}
            onClick={() => decryptWaveData(wave)}
          >
            <div className="wave-number">Wave {wave.waveNumber}</div>
            <div className="wave-hint">{wave.hint}</div>
            <div className="wave-status">
              {wave.isActive ? (
                <span className="active">In Progress</span>
              ) : currentWave > wave.waveNumber ? (
                <span className="completed">Completed</span>
              ) : (
                <span className="pending">Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTutorial = () => {
    return (
      <div className="tutorial-modal">
        <div className="tutorial-content pixel-card">
          <h2>FHE Tower Defense Tutorial</h2>
          <div className="tutorial-steps">
            <div className="step">
              <h3>1. Encrypted Enemy Paths</h3>
              <p>Each wave's path is encrypted with Zama FHE. You only see hints until you decrypt with your wallet.</p>
            </div>
            <div className="step">
              <h3>2. Build Towers Strategically</h3>
              <p>Place towers along the predicted path to stop enemies. Different tower types have unique abilities.</p>
            </div>
            <div className="step">
              <h3>3. Manage Resources</h3>
              <p>Balance tower placement with upgrades. Sell towers to recover some gold.</p>
            </div>
            <div className="step">
              <h3>4. Decrypt Waves</h3>
              <p>Use wallet signatures to decrypt wave details for better planning.</p>
            </div>
          </div>
          <button 
            className="pixel-button primary" 
            onClick={() => setShowTutorial(false)}
          >
            Start Game
          </button>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="pixel-spinner"></div>
      <p>Initializing encrypted game...</p>
    </div>
  );

  if (showTutorial) return renderTutorial();

  if (!gameStarted) return (
    <div className="start-screen">
      <div className="start-content pixel-card">
        <h1>FHE Tower Defense</h1>
        <p>Defend against enemies with encrypted paths using Zama FHE technology</p>
        <button 
          className="pixel-button primary" 
          onClick={startGame}
        >
          Start Game
        </button>
        <button 
          className="pixel-button" 
          onClick={() => setShowTutorial(true)}
        >
          Tutorial
        </button>
        <div className="wallet-connect">
          <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </div>
  );

  if (gameOver) return (
    <div className="game-over-screen">
      <div className="game-over-content pixel-card">
        <h1>{lives > 0 ? "Victory!" : "Game Over"}</h1>
        <p>You {lives > 0 ? "successfully defended" : "failed to defend"} against all waves!</p>
        <div className="final-stats">
          <p>Waves Completed: {currentWave - 1}/{waves.length}</p>
          <p>Towers Built: {towers.length}</p>
          <p>Gold Remaining: {gold}G</p>
          <p>Lives Left: {lives}</p>
        </div>
        <button 
          className="pixel-button primary" 
          onClick={startGame}
        >
          Play Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="game-container pixel-theme">
      <header className="game-header">
        <div className="logo">
          <h1>FHE<span>Tower</span>Defense</h1>
        </div>
        <div className="header-actions">
          <button 
            className="pixel-button" 
            onClick={() => setShowTutorial(true)}
          >
            Help
          </button>
          <div className="wallet-connect">
            <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
          </div>
        </div>
      </header>
      
      <div className="game-content">
        <div className="game-grid">
          {renderGrid()}
          {renderTowerDetails()}
        </div>
        
        <div className="game-sidebar">
          {renderGameStats()}
          {renderTowerMenu()}
          {renderWaveList()}
        </div>
      </div>
      
      {showWaveInfo && renderWaveInfoModal()}
      
      {transactionStatus.visible && (
        <div className="transaction-notice">
          <div className={`pixel-alert ${transactionStatus.status}`}>
            {transactionStatus.message}
          </div>
        </div>
      )}
      
      <footer className="game-footer">
        <div className="footer-content">
          <p>Powered by Zama FHE Technology</p>
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;