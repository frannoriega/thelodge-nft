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

// TODO:
// - Tests

abstract contract TheLodgeSaleHandler is Ownable, ITheLodgeSaleHandler, ERC721A, ITokenPriceOracle {
  using SafeERC20 for IERC20;

  // Address of the $APE <-> ETH oracle.
  AggregatorV3Interface public immutable priceOracle;
  // Maximum delay between the current block timestamp and the timestamp from the oracle.
  uint32 public maxDelay;
  /// The amount of Wei required to buy an NFT token.
  uint256 public tokenPrice;
  uint16 public constant MAX_SUPPLY = 7337;
  uint16 public maxTokensPerAddress;
  IERC20 public immutable alternativePaymentToken;

  uint256 public saleStartTimestamp;
  uint256 public openSaleStartTimestamp;

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

  /// Mints the given amount of tokens for a whitelisted address.
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    _validateWhitelistSale(quantity, balanceOf(msg.sender), _merkleProof);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// Mints the given amount of tokens.
  function mint(uint256 quantity) external payable {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, balanceOf(msg.sender), false);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external {
    _validateWhitelistSale(quantity, balanceOf(msg.sender), _merkleProof);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// Mints the given amount of tokens.
  function buyWithToken(uint256 quantity) external {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, balanceOf(msg.sender), false);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  function airdrop(IndividualAirdrop[] calldata _airdrops) external onlyOwner {
    for (uint256 i; i < _airdrops.length; i++) {
      IndividualAirdrop memory _airdrop = _airdrops[i];
      _validateCommon(_airdrop.quantity);
      _mint(_airdrop.to, _airdrop.quantity, '', false);
    }
  }

  function _validateEthSale(uint256 quantity) internal view {
    uint256 _amountRequired = tokenPrice * quantity;
    if (msg.value != _amountRequired) revert InvalidFunds(msg.value, _amountRequired);
  }

  function _processTokenSale(uint256 quantity) internal {
    uint256 _requiredAmount = _getPriceInToken(quantity);
    alternativePaymentToken.safeTransferFrom(msg.sender, address(this), _requiredAmount);
  }

  function _validateCommonSale(
    uint256 quantity,
    uint256 tokensInAddress,
    bool failIfClaimed
  ) internal view {
    if (msg.sender != tx.origin) revert ContractsCantBuy();
    if (failIfClaimed && tokensInAddress > 0) revert AddressAlreadyClaimed();
    if (tokensInAddress + quantity > maxTokensPerAddress) revert TokenLimitExceeded();
    _validateCommon(quantity);
  }

  function _validateCommon(uint256 quantity) internal view {
    if (_hasEnded()) revert SaleEnded();
    if (_currentIndex + quantity > MAX_SUPPLY) revert TokenSupplyExceeded();
  }

  function _validateWhitelistSale(
    uint256 quantity,
    uint256 tokensInAddress,
    bytes32[] calldata _merkleProof
  ) internal view {
    uint256 _saleStartTimestamp = saleStartTimestamp;
    if (block.timestamp < _saleStartTimestamp) revert SaleNotStarted(_saleStartTimestamp);
    _validateCommonSale(quantity, tokensInAddress, true);
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

  function _hasEnded() internal view virtual returns (bool);

  // Withdraw logic
  function withdrawETH(address payable recipient) external onlyOwner {
    recipient.transfer(address(this).balance);
  }

  function withdrawAlternativeToken(address recipient) external onlyOwner {
    alternativePaymentToken.safeTransfer(recipient, alternativePaymentToken.balanceOf(address(this)));
  }

  // Setters
  function setMaxDelay(uint32 _maxDelay) external onlyOwner {
    maxDelay = _maxDelay;
  }

  function setSaleStartTimestamp(uint256 _saleStartTimestamp) external onlyOwner {
    saleStartTimestamp = _saleStartTimestamp;
  }

  function setOpenSaleStartTimestamp(uint256 _openSaleStartTimestamp) external onlyOwner {
    openSaleStartTimestamp = _openSaleStartTimestamp;
  }

  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
  }

  function setTokenPrice(uint256 _tokenPrice) external onlyOwner {
    tokenPrice = _tokenPrice;
  }

  function setMaxTokensPerAddress(uint16 _maxTokensPerAddress) external onlyOwner {
    maxTokensPerAddress = _maxTokensPerAddress;
  }
}
