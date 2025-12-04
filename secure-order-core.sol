// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract model-layouts-dist {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    function dummy() public pure returns (uint256) {
        return 42;
    }
}