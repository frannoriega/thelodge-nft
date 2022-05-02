//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract TokenMock is IERC20 {
  bool private shouldFail;

  function totalSupply() external view override returns (uint256) {
    return 0;
  }

  function balanceOf(address) external view override returns (uint256) {
    return 0;
  }

  function transfer(address, uint256) external override returns (bool) {
    return shouldFail;
  }

  function allowance(address, address) external view override returns (uint256) {
    return 0;
  }

  function approve(address, uint256) external override returns (bool) {
    return shouldFail;
  }

  function transferFrom(
    address,
    address,
    uint256
  ) external override returns (bool) {
    return shouldFail;
  }

  function setShouldFail(bool _shouldFail) external {
    shouldFail = _shouldFail;
  }
}
