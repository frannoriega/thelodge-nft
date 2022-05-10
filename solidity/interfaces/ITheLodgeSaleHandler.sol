//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @notice Handles everything related to the sale.
interface ITheLodgeSaleHandler {
  /// @notice An airdrop of tokens to a single recipient.
  struct IndividualAirdrop {
    /// @notice The address that will receive the tokens.
    address to;
    /// @notice The amount of tokens to send.
    /// @dev The quantity here is not bound to the maximum amount
    /// of tokens that the recipient can mint, but it's bound by
    /// the supply of tokens available.
    uint16 quantity;
  }

  /// @notice Thrown when the open sale date is configured
  /// to be before the whitelist sale date.
  error OpenSaleBeforeWhitelistSale();

  /// @notice Thrown when there's an attempt to mint/buy tokens
  /// after the sale has ended.
  error SaleEnded();

  /// @notice Thrown when there's an attempt to mint/buy more
  /// tokens than the current supply.
  error TokenSupplyExceeded();

  /// @notice Thrown when there's an attempt to mint/buy tokens
  /// from an address belonging to a smart contract.
  error ContractsCantBuy();

  /// @notice Thrown when a whitelisted address attempts to
  /// whitelist mint more than once.
  error AddressAlreadyClaimed();

  /// @notice Thrown when there's an attempt to mint/buy such
  /// that the tokens for the calling address exceeds the maximum
  /// amount of tokens per address.
  error TokenLimitExceeded();

  /// @notice Thrown when attempting to whitelist mint, but
  /// the provided proof is invalid.
  error InvalidProof();

  /// @notice Thrown when attempting to whitelist mint, but
  /// the sale has not started yet.
  /// @param saleStartTimestamp The sale start date.
  error SaleNotStarted(uint256 saleStartTimestamp);

  /// @notice Thrown when attempting to mint, but
  /// the open sale has not started yet.
  /// @param openSaleStartTimestamp The open sale start date.
  error OpenSaleNotStarted(uint256 openSaleStartTimestamp);

  /// @notice Thrown when attempting to mint, but there
  /// are either more funds or less than what's required to buy
  /// the specified amount of tokens.
  /// @param sent The amount of wei sent.
  /// @param required The amount of wei required.
  error InvalidFunds(uint256 sent, uint256 required);

  /// @notice Returns the maximum supply of tokens.
  /// @return The maximum supply of tokens.
  function MAX_SUPPLY() external pure returns (uint16);

  /// @notice Returns the amount of Wei required to mint a token.
  /// @return The token price.
  function tokenPrice() external view returns (uint256);

  /// @notice Returns the maximum amount of tokens an address can have.
  /// @dev An address might have more tokens than specified here, through
  /// an airdrop.
  /// @return The maximum amount of tokens per address.
  function maxTokensPerAddress() external view returns (uint8);

  /// @notice Returns the address of the token price oracle.
  /// @return The token price oracle.
  function priceOracle() external view returns (AggregatorV3Interface);

  /// @notice Returns the maximum delay between the current block timestamp and the timestamp from the oracle.
  /// @return The maximum delay between the current block timestamp and the timestamp from the oracle.
  function maxDelay() external view returns (uint32);

  /// @notice Returns the address of the payment token.
  /// @return The payment token.
  function alternativePaymentToken() external view returns (IERC20);

  /// @notice Returns the whitelisted sale start timestamp.
  /// @return The whitelisted sale start timestamp.
  function saleStartTimestamp() external view returns (uint256);

  /// @notice Returns the open sale start timestamp.
  /// @return The open sale start timestamp.
  function openSaleStartTimestamp() external view returns (uint256);

  /// @notice Returns the root of the Merkle Tree used to authenticate the
  /// whitelisted addresses.
  /// @return The Merkle Tree root.
  function merkleRoot() external view returns (bytes32);

  /// @notice Mints the given amount of tokens, if the caller is a whitelisted address.
  /// Whiteisted addresses can only make one call to either whitelistedMint
  /// or whitelistedBuyWithToken methods. After that, they have to wait
  /// until the open sale starts and call mint/buyWithToken as other users.
  /// @param _merkleProof The proof that the caller is a whitelisted address.
  /// @param quantity The amount of tokens to buy.
  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable;

  /// @notice Mints the given amount of tokens.
  /// @param quantity The amount of tokens to mint.
  function mint(uint256 quantity) external payable;

  /// @notice Buys the given amount of tokens, if the caller is a whitelisted address.
  /// Whiteisted addresses can only make one call to either whitelistedMint
  /// or whitelistedBuyWithToken methods. After that, they have to wait
  /// until the open sale starts and call mint/buyWithToken as other users.
  /// @param _merkleProof The proof that the caller is a whitelisted address.
  /// @param quantity The amount of tokens to buy.
  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external;

  /// @notice Buys the given amount of tokens.
  /// @param quantity The amount of tokens to buy.
  function buyWithToken(uint256 quantity) external;

  /// @notice Performs a set of airdrops.
  /// @param _airdrops The list of airdrops that will be made.
  function airdrop(IndividualAirdrop[] calldata _airdrops) external;

  /// @notice Sends the ETH stored in this contract to the provided recipient.
  /// @param recipient The address that will receive the ETH.
  function withdrawETH(address payable recipient) external;

  /// @notice Sends the tokens stored in this contract to the provided recipient.
  /// @param recipient The address that will receive the tokens.
  function withdrawAlternativeToken(address recipient) external;

  /// @notice Sets the maximum delay allowed between the current block timestamp and the timestamp from the oracle.
  function setMaxDelay(uint32 _maxDelay) external;

  /// @notice Sets the new whitelisted sale and open sale start timestamps.
  /// @param _saleStartTimestamp The whitelisted sale start timestamp, expressed in seconds since epoch.
  /// @param _openSaleStartTimestamp The open sale start timestamp, expressed in seconds since epoch.
  function setStartTimestamps(uint256 _saleStartTimestamp, uint256 _openSaleStartTimestamp) external;

  /// @notice Sets the Merkle Tree root.
  /// @param _merkleRoot The new Merkle Tree root.
  function setMerkleRoot(bytes32 _merkleRoot) external;

  /// @notice Sets the token price.
  /// @param _tokenPrice The new token price, expressed in wei.
  function setTokenPrice(uint256 _tokenPrice) external;

  /// @notice Sets the maximum amount of tokens per address.
  /// @param _maxTokensPerAddress The new maximum amount of tokens an address can have.
  function setMaxTokensPerAddress(uint8 _maxTokensPerAddress) external;
}
