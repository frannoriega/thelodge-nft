import MerkleTree from 'merkletreejs';

const keccak256 = require('keccak256');

function paddedBuffer(addr: string) {
  const normalizedAddress = addr.replace(/^0x/gi, '').replace(/[^a-f0-9]/gi, ''); // strip any non-hex characters

  if (normalizedAddress.length !== 40) throw new Error('Invalid address: ' + addr);

  const buf = Buffer.alloc(32);
  Buffer.from(normalizedAddress, 'hex').copy(buf, 32 - 20, 0, 20);

  return buf;
}

function buildMerkle(whitelistedAddresses: string[]) {
  const tree = new MerkleTree(whitelistedAddresses, keccak256, { sort: true });
  const root = tree.getHexRoot();
  return { tree, root };
}

function buildProof(tree: MerkleTree, address: string) {
  const encodedAddress = paddedBuffer(address);
  return tree.getHexProof(encodedAddress);
}

export { buildMerkle, buildProof };
