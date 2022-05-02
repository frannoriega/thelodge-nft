const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

export const buildMerkle = function (whitelistedAddresses: string[]) {
  const tree = new MerkleTree(whitelistedAddresses, keccak256, { sort: true });
  const root = tree.getHexRoot();
  return { tree, root };
};
