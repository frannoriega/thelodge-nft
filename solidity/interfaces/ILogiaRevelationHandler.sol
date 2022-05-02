//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ILogiaRevelationHandler {
  error ZeroAddress();

  error AlreadyRevealed();

  event Revealed(uint256 number);
}
