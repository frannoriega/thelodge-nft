//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/ITokenPriceOracle.sol';
import '../interfaces/ITheLodgeSaleHandler.sol';
import 'erc721a/contracts/ERC721A.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '../library/TheLodgeConfig.sol';

/// @title TheLodgeSaleHandler
/// @notice Contract that handles all the sale logic.
abstract contract TheLodgeSaleHandler is Ownable, ITheLodgeSaleHandler, ERC721A, ITokenPriceOracle {
  using SafeERC20 for IERC20;

  /// @inheritdoc ITheLodgeSaleHandler
  uint16 public constant MAX_SUPPLY = 7777;

  /// @inheritdoc ITheLodgeSaleHandler
  uint256 public tokenPrice;
  /// @inheritdoc ITheLodgeSaleHandler
  uint8 public maxTokensPerAddress;

  /// @inheritdoc ITheLodgeSaleHandler
  AggregatorV3Interface public immutable priceOracle;
  /// @inheritdoc ITheLodgeSaleHandler
  uint32 public maxDelay;
  /// @inheritdoc ITheLodgeSaleHandler
  IERC20 public immutable alternativePaymentToken;

  /// @inheritdoc ITheLodgeSaleHandler
  uint256 public saleStartTimestamp;
  /// @inheritdoc ITheLodgeSaleHandler
  uint256 public openSaleStartTimestamp;

  /// @inheritdoc ITheLodgeSaleHandler
  bytes32 public merkleRoot;

  constructor(TheLodgeConfig.SaleConfig memory _saleConfig) ERC721A(_saleConfig.tokenName, _saleConfig.tokenSymbol) {
    _validateStartTimestamps(_saleConfig.saleStartTimestamp, _saleConfig.openSaleStartTimestamp);
    tokenPrice = _saleConfig.nftPrice; // TODO: Setters
    priceOracle = AggregatorV3Interface(_saleConfig.oracle);
    maxDelay = _saleConfig.maxDelay;
    maxTokensPerAddress = _saleConfig.maxTokensPerAddress; //TODO: Setters
    alternativePaymentToken = _saleConfig.alternativePaymentToken;
    saleStartTimestamp = _saleConfig.saleStartTimestamp; //TODO: Setters
    openSaleStartTimestamp = _saleConfig.openSaleStartTimestamp; //TODO: Setters
    merkleRoot = _saleConfig.merkleRoot;
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable override {
    _validateWhitelistSale(quantity, _merkleProof);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function mint(uint256 quantity) external payable override {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, false);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external override {
    _validateWhitelistSale(quantity, _merkleProof);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function buyWithToken(uint256 quantity) external override {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, false);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function airdrop(IndividualAirdrop[] calldata _airdrops) external override onlyOwner {
    for (uint256 i; i < _airdrops.length; i++) {
      IndividualAirdrop memory _airdrop = _airdrops[i];
      _validateCommon(_airdrop.quantity);
      _mint(_airdrop.to, _airdrop.quantity, '', false);
    }
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function withdrawETH(address payable recipient) external override onlyOwner {
    recipient.transfer(address(this).balance);
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function withdrawAlternativeToken(address recipient) external override onlyOwner {
    alternativePaymentToken.safeTransfer(recipient, alternativePaymentToken.balanceOf(address(this)));
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function setMaxDelay(uint32 _maxDelay) external override onlyOwner {
    maxDelay = _maxDelay;
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function setStartTimestamps(uint256 _saleStartTimestamp, uint256 _openSaleStartTimestamp) external override onlyOwner {
    _validateStartTimestamps(_saleStartTimestamp, _openSaleStartTimestamp);
    saleStartTimestamp = _saleStartTimestamp;
    openSaleStartTimestamp = _openSaleStartTimestamp;
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function setMerkleRoot(bytes32 _merkleRoot) external override onlyOwner {
    merkleRoot = _merkleRoot;
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function setTokenPrice(uint256 _tokenPrice) external override onlyOwner {
    tokenPrice = _tokenPrice;
  }

  /// @inheritdoc ITheLodgeSaleHandler
  function setMaxTokensPerAddress(uint8 _maxTokensPerAddress) external override onlyOwner {
    maxTokensPerAddress = _maxTokensPerAddress;
  }

  function _validateEthSale(uint256 quantity) internal view {
    uint256 _amountRequired = tokenPrice * quantity;
    if (msg.value != _amountRequired) revert InvalidFunds(msg.value, _amountRequired);
  }

  function _processTokenSale(uint256 quantity) internal {
    uint256 _requiredAmount = _getPriceInToken(quantity);
    alternativePaymentToken.safeTransferFrom(msg.sender, address(this), _requiredAmount);
  }

  function _validateCommonSale(uint256 quantity, bool failIfClaimed) internal view {
    if (msg.sender != tx.origin) revert ContractsCantBuy();
    uint256 tokensInAddress = balanceOf(msg.sender);
    if (failIfClaimed && tokensInAddress > 0) revert AddressAlreadyClaimed();
    if (tokensInAddress + quantity > maxTokensPerAddress) revert TokenLimitExceeded();
    _validateCommon(quantity);
  }

  function _validateCommon(uint256 quantity) internal view {
    if (_hasEnded()) revert SaleEnded();
    if (_currentIndex + quantity - 1 > MAX_SUPPLY) revert TokenSupplyExceeded();
  }

  function _validateWhitelistSale(uint256 quantity, bytes32[] calldata _merkleProof) internal view {
    uint256 _saleStartTimestamp = saleStartTimestamp;
    if (block.timestamp < _saleStartTimestamp) revert SaleNotStarted(_saleStartTimestamp);
    _validateCommonSale(quantity, true);
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
    if (!MerkleProof.verify(_merkleProof, merkleRoot, leaf)) revert InvalidProof();
  }

  function _getPriceInToken(uint256 quantity) internal view returns (uint256) {
    (, int256 _answer, , uint256 _updatedAt, ) = priceOracle.latestRoundData();
    if (_answer <= 0) revert InvalidAnswer();
    if (_updatedAt < block.timestamp - maxDelay) revert OutdatedAnswer();
    return (tokenPrice * quantity) / uint256(_answer);
  }

  function _validateStartTimestamps(uint256 _saleStartTimestamp, uint256 _openSaleStartTimestamp) internal pure {
    if (_saleStartTimestamp > _openSaleStartTimestamp) revert OpenSaleBeforeWhitelistSale();
  }

  function _startTokenId() internal pure override returns (uint256) {
    return 1;
  }

  /// @dev This function will determine whether the sale has ended (for all users).
  /// The returned value should ideally be false and then shift to true, and not change again.
  /// @return Whether the sale has ended or not.
  function _hasEnded() internal view virtual returns (bool);
}
