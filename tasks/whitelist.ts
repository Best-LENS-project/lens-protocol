import { task } from 'hardhat/config';
import { LensHub__factory } from '../typechain-types';
import { CreateProfileDataStruct } from '../typechain-types/LensHub';
import { waitForTx, initEnv, getAddrs, ZERO_ADDRESS } from './helpers/utils';

task('whitelist', 'whitelist user').setAction(async ({}, hre) => {
  const [governance, , user] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);
  const myaddr = '0xfd9A0CB4038c303d15d2f79697D3591bF9030b84';

  await waitForTx(lensHub.whitelistProfileCreator(myaddr, true));
  const res = await lensHub.isProfileCreatorWhitelisted(myaddr);
  console.log('res', res);
});