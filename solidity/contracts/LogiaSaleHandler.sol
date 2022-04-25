//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/ITokenPriceOracle.sol';
import '../interfaces/ILogiaSaleHandler.sol';
import 'erc721a/contracts/ERC721A.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '../library/LogiaConfig.sol';

// TODO:
// - Setters
// - Withdraw logic
// - Tests

abstract contract LogiaSaleHandler is Ownable, ILogiaSaleHandler, ERC721A, ITokenPriceOracle {
    using SafeERC20 for IERC20Metadata;

    // Address of the $APE <-> ETH oracle.
    AggregatorV3Interface public priceOracle;
    // Maximum delay between the current block timestamp and the timestamp from the oracle.
    uint32 public maxDelay;
    /// The amount of Wei required to buy an NFT token.
    uint256 public TOKEN_PRICE;
    uint256 public MAX_SUPPLY;
    uint16 public maxTokensPerAddress;
    IERC20Metadata public paymentToken;

    uint256 public saleStartTimestamp;
    uint256 public openSaleStartTimestamp;

    bytes32 immutable public merkleRoot;
    
    /// Amount of tokens per address.
    mapping(address => uint256) public tokensPerAddress;

    constructor(LogiaConfig.SaleConfig memory saleConfig) {
        if (saleConfig.saleStartTimestamp > saleConfig.openSaleStartTimestamp) revert OpenSaleBeforeWhitelistSale();
        TOKEN_PRICE = saleConfig.nftPrice; // Can't be modified!
        MAX_SUPPLY = 7337; // DO NOT CHANGE: Changing this will require that we rethink how we distribute token rarity.
        priceOracle = AggregatorV3Interface(saleConfig.oracle); //TODO: Setters (along with token)
        maxDelay = saleConfig.maxDelay;
        maxTokensPerAddress = saleConfig.maxTokensPerAddress; //TODO: Setters
        paymentToken = saleConfig.paymentToken; // TODO: Setters (along with oracle)
        saleStartTimestamp = saleConfig.saleStartTimestamp; //TODO: Setters
        openSaleStartTimestamp = saleConfig.openSaleStartTimestamp; //TODO: Setters
        merkleRoot = saleConfig.merkleRoot;
    }

    /// Mints the given amount of tokens for a whitelisted address.
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    _validateWhitelistSale(quantity, tokensPerAddress[msg.sender], _merkleProof);
    _validateEthFunds(quantity);
    _assignTokens(msg.sender, quantity);
  }

  /// Mints the given amount of tokens.
  function mint(uint256 quantity) external payable {
    if (block.timestamp < openSaleStartTimestamp) revert OpenSaleNotStarted();
    _validateCommonSale(quantity, tokensPerAddress[msg.sender], false);
    _validateEthFunds(quantity);
    _assignTokens(msg.sender, quantity);
  }

  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    _validateWhitelistSale(quantity, tokensPerAddress[msg.sender], _merkleProof);
    _processTokenSale(quantity);
    _assignTokens(msg.sender, quantity);
  }

  /// Mints the given amount of tokens.
  function buyWithToken(uint256 quantity) external payable {
    if (block.timestamp < openSaleStartTimestamp) revert OpenSaleNotStarted();
    _validateCommonSale(quantity, tokensPerAddress[msg.sender], false);
    _processTokenSale(quantity);
    _assignTokens(msg.sender, quantity);
  }

  function airdrop(address to, uint256 quantity) external payable onlyOwner {
    _validateCommonSale(quantity, tokensPerAddress[to], false);
    _assignTokens(to, quantity);
  }

  function _validateEthFunds(uint256 quantity) internal view {
      if (msg.value < TOKEN_PRICE * quantity) revert InsufficientFunds();
  }

  function _processTokenSale(uint256 quantity) internal {
      uint256 _requiredAmount = _getPriceInToken(quantity);
      paymentToken.safeTransferFrom(msg.sender, address(this), _requiredAmount);
  }

  function _validateCommonSale(uint256 quantity, uint256 tokensInAddress, bool failIfClaimed) internal view {
        if (_hasEnded()) revert SaleEnded();
        if (_currentIndex + quantity > MAX_SUPPLY) revert TokenSupplyExceeded();
        if (msg.sender != tx.origin) revert ContractsCantBuy();
        tokensInAddress = tokensPerAddress[msg.sender];
        if (failIfClaimed && tokensInAddress > 0) revert AddressAlreadyClaimed();
        if (tokensInAddress + quantity >= maxTokensPerAddress) revert TokenLimitExceeded();
    }

    function _validateWhitelistSale(uint256 quantity, uint256 tokensInAddress, bytes32[] calldata _merkleProof) internal view {
        if (block.timestamp < saleStartTimestamp) revert SaleNotStarted();
        _validateCommonSale(quantity, tokensInAddress, true);
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(_merkleProof, merkleRoot, leaf)) revert InvalidProof();
    }

    function _assignTokens(address to, uint256 quantity) internal {
        _safeMint(to, quantity);
        tokensPerAddress[to] += quantity;
    }

    function _getPriceInToken(uint256 quantity) internal view returns (uint256) {
        (, int256 _answer, , uint256 _updatedAt, ) = priceOracle.latestRoundData();
        if (_answer < 0) revert InvalidAnswer();
        if (_updatedAt < block.timestamp - maxDelay) revert OutdatedAnswer();
        return ((TOKEN_PRICE * quantity) / uint(_answer));
    }

    function _hasEnded() internal virtual view returns (bool);

    // Withdraw logic

    // Setters
    function setMaxDelay(uint32 _maxDelay) external onlyOwner {
        maxDelay = _maxDelay;
    }
}