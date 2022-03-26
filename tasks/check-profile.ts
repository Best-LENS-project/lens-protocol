import { ethers } from 'ethers';

import { task } from 'hardhat/config';
import { LensHub__factory } from '../typechain-types';
import { CreateProfileDataStruct } from '../typechain-types/LensHub';
import { waitForTx, initEnv, getAddrs, ZERO_ADDRESS } from './helpers/utils';

task('check-profile', 'checks a profile').setAction(async ({}, hre) => {
  const [governance, , user] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);
  const myaddr = '0xfd9A0CB4038c303d15d2f79697D3591bF9030b84';
  const res = await lensHub.isProfileCreatorWhitelisted(myaddr);
  console.log('res', res);
  // const inputStruct: CreateProfileDataStruct = {
  //   to: user.address,
  //   handle: 'zer0dot',
  //   imageURI:
  //     'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
  //   followModule: ZERO_ADDRESS,
  //   followModuleData: [],
  //   followNFTURI:
  //     'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
  // };

  // await waitForTx(lensHub.connect(user).createProfile(inputStruct));

  // console.log(Total supply (should be 1): ${await lensHub.totalSupply()});
  // console.log(
  //   Profile owner: ${await lensHub.ownerOf(1)}, user address (should be the same): ${user.address}
  // );
  // console.log(Profile ID by handle: ${await lensHub.getProfileIdByHandle('zer0dot')});
});

// async function listfiles() {
//   const th = await ethers.getContractFactory('LensHub', {
//     libraries: { InteractionLogicLib: '0x0078371BDeDE8aAc7DeBfFf451B74c5EDB385Af7' },
//   });
//   console.log(th);
// }
// listfiles();