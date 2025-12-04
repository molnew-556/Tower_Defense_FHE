pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TowerDefenseFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;
    bool public paused;
    uint256 public cooldownSeconds;

    struct EnemyWave {
        euint32 pathSeedEncrypted;
        euint32 unitCompositionSeedEncrypted;
    }
    mapping(uint256 => EnemyWave) public encryptedWaves;
    uint256 public currentBatchId;
    bool public batchOpen;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address account);
    event Unpaused(address account);
    event CooldownSecondsSet(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event WaveSubmitted(address indexed provider, uint256 indexed batchId, uint256 waveIndex);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint32 pathSeed, uint32 unitCompositionSeed);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchClosedError();
    error ReplayError();
    error StateMismatchError();
    error InvalidBatchError();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier checkCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        cooldownSeconds = 60; // Default 60 seconds cooldown
        emit ProviderAdded(owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsSet(oldCooldownSeconds, newCooldownSeconds);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        batchOpen = true;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        batchOpen = false;
        emit BatchClosed(currentBatchId);
    }

    function submitWave(
        uint256 _batchId,
        euint32 _pathSeedEncrypted,
        euint32 _unitCompositionSeedEncrypted
    ) external onlyProvider whenNotPaused checkCooldown {
        if (!batchOpen || _batchId != currentBatchId) revert BatchClosedError();
        lastSubmissionTime[msg.sender] = block.timestamp;

        uint256 waveIndex = encryptedWaves[_batchId].pathSeedEncrypted.isInitialized() ? 1 : 0; // Simplified: assumes one wave per batch for this example
        encryptedWaves[_batchId] = EnemyWave(_pathSeedEncrypted, _unitCompositionSeedEncrypted);

        emit WaveSubmitted(msg.sender, _batchId, waveIndex);
    }

    function requestWaveDecryption(uint256 _batchId) external whenNotPaused checkCooldown {
        if (!_isBatchValid(_batchId)) revert InvalidBatchError();
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        euint32 pathSeedEncrypted = encryptedWaves[_batchId].pathSeedEncrypted;
        euint32 unitCompositionSeedEncrypted = encryptedWaves[_batchId].unitCompositionSeedEncrypted;

        if (!pathSeedEncrypted.isInitialized() || !unitCompositionSeedEncrypted.isInitialized()) {
            revert("Wave data not initialized");
        }

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = pathSeedEncrypted.toBytes32();
        cts[1] = unitCompositionSeedEncrypted.toBytes32();

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: _batchId, stateHash: stateHash, processed: false });

        emit DecryptionRequested(requestId, _batchId);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        if (context.processed) revert ReplayError();
        // Security: Replay protection prevents processing the same decryption request multiple times.

        euint32 pathSeedEncrypted = encryptedWaves[context.batchId].pathSeedEncrypted;
        euint32 unitCompositionSeedEncrypted = encryptedWaves[context.batchId].unitCompositionSeedEncrypted;

        if (!pathSeedEncrypted.isInitialized() || !unitCompositionSeedEncrypted.isInitialized()) {
            revert("Wave data not initialized for batch");
        }

        bytes32[] memory currentCts = new bytes32[](2);
        currentCts[0] = pathSeedEncrypted.toBytes32();
        currentCts[1] = unitCompositionSeedEncrypted.toBytes32();
        bytes32 currentHash = _hashCiphertexts(currentCts);

        if (currentHash != context.stateHash) revert StateMismatchError();
        // Security: State hash verification ensures that the contract's state (specifically, the ciphertexts)
        // has not changed between the decryption request and the callback execution. This prevents
        // scenarios where an attacker might alter the data after a request is made but before it's processed.

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 pathSeed = abi.decode(cleartexts, (uint32));
        uint32 unitCompositionSeed = abi.decode(cleartexts, (uint32)); // Note: cleartexts contains both values packed

        context.processed = true;
        emit DecryptionCompleted(requestId, context.batchId, pathSeed, unitCompositionSeed);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _isBatchValid(uint256 _batchId) internal view returns (bool) {
        return _batchId > 0 && _batchId <= currentBatchId;
    }
}