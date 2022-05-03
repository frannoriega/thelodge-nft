//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import './TheLodgeSaleHandlerImpl.sol';
import '../interfaces/ITheLodgeSaleHandler.sol';

contract DummyCallerContract {
  TheLodgeSaleHandlerImpl public saleHandler;

  constructor(address _saleHandler) {
    saleHandler = TheLodgeSaleHandlerImpl(_saleHandler);
  }

  function whitelistMint(bytes32[] calldata _merkleProof, uint256 quantity) external payable {
    saleHandler.whitelistMint(_merkleProof, quantity);
  }

  /// Mints the given amount of tokens.
  function mint(uint256 quantity) external payable {
    saleHandler.mint(quantity);
  }

  function whitelistBuyWithToken(bytes32[] calldata _merkleProof, uint256 quantity) external {
    saleHandler.whitelistBuyWithToken(_merkleProof, quantity);
  }

  /// Mints the given amount of tokens.
  function buyWithToken(uint256 quantity) external {
    saleHandler.buyWithToken(quantity);
  }

  function airdrop(ITheLodgeSaleHandler.IndividualAirdrop[] calldata _airdrops) external {
    saleHandler.airdrop(_airdrops);
  }

  function withdrawETH(address payable recipient) external {
    saleHandler.withdrawETH(recipient);
  }

  function withdrawAlternativeToken(address recipient) external {
    saleHandler.withdrawAlternativeToken(recipient);
  }

  function setMaxDelay(uint32 _maxDelay) external {
    saleHandler.setMaxDelay(_maxDelay);
  }
}
