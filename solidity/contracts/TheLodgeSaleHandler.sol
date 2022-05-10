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
  /// @notice The maximum supply of tokens.
  uint16 public constant MAX_SUPPLY = 7777;

  /// @notice The amount of Wei required to mint a token.
  uint256 public tokenPrice;
  /// @notice The maximum amount of tokens an address can have.
  /// @dev An address might have more tokens than specified here, through
  /// an airdrop.
  uint8 public maxTokensPerAddress;

  /// @notice The address of the token price oracle.
  AggregatorV3Interface public immutable priceOracle;
  // @notice Maximum delay between the current block timestamp and the timestamp from the oracle.
  uint32 public maxDelay;
  /// @notice The token that can be used to buy TheLodge tokens.
  IERC20 public immutable alternativePaymentToken;

  /// @notice The date when whitelisted addresses can to start minitng/buying tokens.
  uint256 public saleStartTimestamp;
  /// @notice The date when the general public can start minting/buyingtokens.
  uint256 public openSaleStartTimestamp;

  /// @notice The root of the Merkle Tree used to authenticate the
  /// whitelisted addresses.
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

  /// @notice Mints the given amount of tokens, if the caller is a whitelisted address.
  /// Whiteisted addresses can only make one call to either whitelistedMint
  /// or whitelistedBuyWithToken methods. After that, they have to wait
  /// until the open sale starts and call mint/buyWithToken as other users.
  /// @param _merkleProof The proof that the caller is a whitelisted address.
  /// @param quantity The amount of tokens to buy.
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    _validateWhitelistSale(quantity, balanceOf(msg.sender), _merkleProof);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @notice Mints the given amount of tokens.
  /// @param quantity The amount of tokens to mint.
  function mint(uint256 quantity) external payable {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, balanceOf(msg.sender), false);
    _validateEthSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @notice Buys the given amount of tokens, if the caller is a whitelisted address.
  /// Whiteisted addresses can only make one call to either whitelistedMint
  /// or whitelistedBuyWithToken methods. After that, they have to wait
  /// until the open sale starts and call mint/buyWithToken as other users.
  /// @param _merkleProof The proof that the caller is a whitelisted address.
  /// @param quantity The amount of tokens to buy.
  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external {
    _validateWhitelistSale(quantity, balanceOf(msg.sender), _merkleProof);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @notice Buys the given amount of tokens.
  /// @param quantity The amount of tokens to buy.
  function buyWithToken(uint256 quantity) external {
    uint256 _openSaleStartTimestamp = openSaleStartTimestamp;
    if (block.timestamp < _openSaleStartTimestamp) revert OpenSaleNotStarted(_openSaleStartTimestamp);
    _validateCommonSale(quantity, balanceOf(msg.sender), false);
    _processTokenSale(quantity);
    _mint(msg.sender, quantity, '', false);
  }

  /// @notice Performs a set of airdrops.
  /// @param _airdrops The list of airdrops that will be made.
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
    if (_currentIndex + quantity - 1 > MAX_SUPPLY) revert TokenSupplyExceeded();
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

  /// @dev This function will determine whether the sale has ended (for all users).
  /// The returned value should ideally be false and then shift to true, and not change again.
  /// @return Whether the sale has ended or not.
  function _hasEnded() internal view virtual returns (bool);

  /// @notice Sends the ETH stored in this contract to the provided recipient.
  /// @param recipient The address that will receive the ETH.
  function withdrawETH(address payable recipient) external onlyOwner {
    recipient.transfer(address(this).balance);
  }

  /// @notice Sends the tokens stored in this contract to the provided recipient.
  /// @param recipient The address that will receive the tokens.
  function withdrawAlternativeToken(address recipient) external onlyOwner {
    alternativePaymentToken.safeTransfer(recipient, alternativePaymentToken.balanceOf(address(this)));
  }

  /// @notice Sets the maximum delay allowed between the current block timestamp and the timestamp from the oracle.
  function setMaxDelay(uint32 _maxDelay) external onlyOwner {
    maxDelay = _maxDelay;
  }

  function setStartTimestamps(uint256 _saleStartTimestamp, uint256 _openSaleStartTimestamp) external onlyOwner {
    if (_openSaleStartTimestamp < _saleStartTimestamp) revert OpenSaleBeforeWhitelistSale();
    saleStartTimestamp = _saleStartTimestamp;
    openSaleStartTimestamp = _openSaleStartTimestamp;
  }

  /// @notice Sets the Merkle Tree root.
  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
  }

  /// @notice Sets the token price.
  function setTokenPrice(uint256 _tokenPrice) external onlyOwner {
    tokenPrice = _tokenPrice;
  }

  /// @notice Sets the maximum amount of tokens per address.
  function setMaxTokensPerAddress(uint8 _maxTokensPerAddress) external onlyOwner {
    maxTokensPerAddress = _maxTokensPerAddress;
  }
}
