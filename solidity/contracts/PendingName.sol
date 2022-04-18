//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import 'hardhat/console.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'erc721a/contracts/ERC721A.sol';

uint256 constant MAX_SUPPLY = 7337;
uint256 constant MAX_TOKENS_PER_ADDRESS = 5; // TODO: Change this.
uint256 constant TOKEN_PRICE = 1 ether; // TODO: Change this.

/// @title A contract for boilerplating
/// @author Hardhat (and DeFi Wonderland)
/// @notice You can use this contract for only the most basic tests
/// @dev This is just a try out
/// @custom:experimental This is an experimental contrac///t.

// (possible) OPTIMIZATIONS:
// - Define which integer type to use for quantity, once we know.
// - Hardcode maxSupply instead of using variables?
// - Move `msg.sender` to a variable (less gas cost?)

contract PendingName is ERC721A, Ownable {
  bool public revealed = false;

  // Whitelist handing state
  /// Amount of tokens per address.
  mapping(address => uint256) public tokensPerAddress;
  // Open sale start date.
  uint256 private _openSaleStartTimestamp = 1; // TODO: Set Open Sale Date.
  // Merkle root
  bytes32 public merkleRoot; // TODO: Set Merkle Root.

  constructor(bytes32 merkleRoot_) ERC721A('PendingName', 'PN') {
    merkleRoot = merkleRoot_;
  }

  /// Mints the given amount of tokens for a whitelisted address.
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    require(!revealed, 'Token sale has ended');
    // Is this how we check that they are paying for the token?
    // require(msg.value == TOKEN_PRICE, "Invalid amount");
    // This check is somehow redundant, as _safeMint will revert the transaction in this case.
    // Do we benefit from an early check (aka, save gas for users?)
    require(quantity > 0, 'Quantity must be a positive value');
    // TODO: Do we want this? https://stackoverflow.com/a/54056854/5764302.
    require(_currentIndex + quantity <= MAX_SUPPLY, 'There are not enough tokens');
    require(msg.sender == tx.origin, 'Contracts cannot buy tokens');
    require(tokensPerAddress[msg.sender] > 0, 'Address has already claimed tokens');
    require(tokensPerAddress[msg.sender] + quantity < MAX_TOKENS_PER_ADDRESS, 'Cannot buy more than X tokens'); // TODO: Replace X?
    require(block.timestamp < _openSaleStartTimestamp, 'Whitelist sale has already ended');

    bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
    require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), 'Invalid proof');

    _safeMint(msg.sender, quantity);
  }

  /// Mints the given amount of tokens.
  function mint(uint256 quantity) external payable {
    require(!revealed, 'Token sale has ended');
    // require(msg.value == TOKEN_PRICE, "Invalid amount");
    require(quantity > 0, 'Quantity must be a positive value');
    require(_currentIndex + quantity <= MAX_SUPPLY, 'There are not enough tokens');
    require(msg.sender == tx.origin, 'Contracts cannot buy tokens');
    require(block.timestamp >= _openSaleStartTimestamp, "Open sale hasn't started yet");
    require(tokensPerAddress[msg.sender] + quantity < MAX_TOKENS_PER_ADDRESS, 'Cannot buy more than X tokens'); // TODO: Replace X?

    _safeMint(msg.sender, quantity);
  }

  function _startTokenId() internal view virtual override returns (uint256) {
    return 1;
  }

  function reveal() external onlyOwner {
    require(!revealed, 'Already revealed');
    revealed = true;
    // Do stuff.
  }
}
