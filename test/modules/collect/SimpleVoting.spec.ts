import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { ethers, network } from "hardhat";
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
    abiCoder,
    BPS_MAX,
    currency,
    simpleVoting,
    feeCollectModule,
    emptyCollectModule,
    FIRST_PROFILE_ID,
    governance,
    lensHub,
    makeSuiteCleanRoom,
    MOCK_FOLLOW_NFT_URI,
    MOCK_PROFILE_HANDLE,
    MOCK_PROFILE_URI,
    MOCK_URI,
    moduleGlobals,
    REFERRAL_FEE_BPS,
    treasuryAddress,
    TREASURY_FEE_BPS,
    userAddress,
    userTwo,
    userTwoAddress,
    user,
} from '../../__setup.spec';

makeSuiteCleanRoom('Simple Voting Module', function () {
    const DEFAULT_COLLECT_PRICE = parseEther('10');
    const secondProfileId = FIRST_PROFILE_ID + 1;
    const Mock_Bounty = 1;
    beforeEach(async function () {
        await expect(
            lensHub.createProfile({
                to: userAddress,
                handle: MOCK_PROFILE_HANDLE,
                imageURI: MOCK_PROFILE_URI,
                followModule: ZERO_ADDRESS,
                followModuleData: [],
                followNFTURI: MOCK_FOLLOW_NFT_URI,
            })
        ).to.not.be.reverted;
        await expect(
            lensHub.connect(userTwo).createProfile({
                to: userTwoAddress,
                handle: 'usertwo',
                imageURI: MOCK_PROFILE_URI,
                followModule: ZERO_ADDRESS,
                followModuleData: [],
                followNFTURI: MOCK_FOLLOW_NFT_URI,
            })
        ).to.not.be.reverted;
        await expect(
            lensHub.connect(governance).whitelistCollectModule(simpleVoting.address, true)
        ).to.not.be.reverted;
        await expect(
            lensHub.connect(governance).whitelistCollectModule(emptyCollectModule.address, true)
          ).to.not.be.reverted;
        await expect(currency.mint(userAddress, MAX_UINT256)).to.not.be.reverted;
        await expect(currency.connect(user).approve(simpleVoting.address, MAX_UINT256)).to.not.be.reverted;
    });

    context('Scenarios', function () {
        it.only('User should post with Simple Voting collect module as the collect module and data, correct events should be emitted', async function () {
            const collectModuleData = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                    'uint256[]',
                    'uint256[]',
                    'uint256[][]',
                    'uint256[]',
                    'address[]'
                ],
                [1648152830, 1648160030, 5, [secondProfileId], [Mock_Bounty], [50], [[FIRST_PROFILE_ID]], [100], [currency.address]]
            );

            const tx = lensHub.post({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: simpleVoting.address,
                collectModuleData: collectModuleData,
                referenceModule: ZERO_ADDRESS,
                referenceModuleData: [],
            });
            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(2);
            matchEvent(receipt, 'PostCreated', [
                FIRST_PROFILE_ID,
                1,
                MOCK_URI,
                simpleVoting.address,
                [collectModuleData],
                ZERO_ADDRESS,
                [],
                await getTimestamp(),
            ]);
        });

        it.only('User should post with the simpleVoting as the collect module and data, fetched publication data should be accurate', async function () {
            const collectModuleData = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                    'uint256[]',
                    'uint256[]',
                    'uint256[][]',
                    'uint256[]',
                    'address[]'
                ],
                [1648152830, 1648160030, 5, [secondProfileId], [Mock_Bounty], [50], [[FIRST_PROFILE_ID]], [100], [currency.address]]
            );
            await expect(
                lensHub.post({
                    profileId: FIRST_PROFILE_ID,
                    contentURI: MOCK_URI,
                    collectModule: simpleVoting.address,
                    collectModuleData: collectModuleData,
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;

            expect(await simpleVoting.submissionsEnd()).to.eq(1648152830);
            expect(await simpleVoting.votingEnd()).to.eq(1648160030);
            expect(await simpleVoting.maxTeamSize()).to.eq(5);
            expect(await simpleVoting.isHacker(secondProfileId)).to.eq(true);
            expect(await (await simpleVoting.idToBounty(Mock_Bounty)).judgesDistribution).to.eq(50);
            expect(await (await simpleVoting.idToBounty(Mock_Bounty)).prizeMoney).to.eq(100);
            expect(await (await simpleVoting.idToBounty(Mock_Bounty)).token).to.eq(currency.address);
            expect(await currency.balanceOf(simpleVoting.address)).to.eq(100);
        });

        it.only('Hacker should be able to submit a project', async function () {
            const Mock_Submission = 1;
            const collectModuleData = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                    'uint256[]',
                    'uint256[]',
                    'uint256[][]',
                    'uint256[]',
                    'address[]'
                ],
                [2648152830, 2648160030, 5, [secondProfileId], [Mock_Bounty], [50], [[FIRST_PROFILE_ID]], [100], [currency.address]]
            );
            const data = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                ],
                [secondProfileId, Mock_Bounty, Mock_Submission, [secondProfileId]]
            );
            await expect(
                lensHub.post({
                    profileId: FIRST_PROFILE_ID,
                    contentURI: MOCK_URI,
                    collectModule: simpleVoting.address,
                    collectModuleData: collectModuleData,
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;
            await expect(
                lensHub.connect(userTwo).post({
                    profileId: secondProfileId,
                    contentURI: MOCK_URI,
                    collectModule: emptyCollectModule.address,
                    collectModuleData: [],
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;
            
            await expect(await simpleVoting.state()).to.eq(0);
            
            await expect(
                lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
            ).to.not.be.reverted;
        });

        it.only('Judge / Hacker Should be able to cast a vote', async function () {
            const Mock_Submission = 1;
            const collectModuleData = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                    'uint256[]',
                    'uint256[]',
                    'uint256[][]',
                    'uint256[]',
                    'address[]'
                ],
                [2648152830, 2648160030, 5, [secondProfileId], [Mock_Bounty], [50], [[FIRST_PROFILE_ID]], [100], [currency.address]]
            );
            const data = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                ],
                [secondProfileId, Mock_Bounty, Mock_Submission, [secondProfileId]]
            );
            await expect(
                lensHub.post({
                    profileId: FIRST_PROFILE_ID,
                    contentURI: MOCK_URI,
                    collectModule: simpleVoting.address,
                    collectModuleData: collectModuleData,
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;

            await expect(
                lensHub.connect(userTwo).post({
                    profileId: secondProfileId,
                    contentURI: MOCK_URI,
                    collectModule: emptyCollectModule.address,
                    collectModuleData: [],
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;

            await expect(
                lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
            ).to.not.be.reverted;
            await expect(await simpleVoting.state()).to.eq(0);
            await network.provider.send("evm_setNextBlockTimestamp", [2648152830]);
            await network.provider.send("evm_mine");
            await expect(await simpleVoting.state()).to.eq(1);

            await expect(
                simpleVoting.connect(user).castVote(Mock_Bounty, FIRST_PROFILE_ID, Mock_Submission)
            ).to.not.be.reverted;
            await expect(
                simpleVoting.connect(userTwo).castVote(Mock_Bounty, secondProfileId, Mock_Submission)
            ).to.not.be.reverted;
        });

        it.only('Winner Should be able to claim prize', async function () {
            const Mock_Submission = 1;
            const collectModuleData = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                    'uint256[]',
                    'uint256[]',
                    'uint256[][]',
                    'uint256[]',
                    'address[]'
                ],
                [2648152830, 2648160030, 5, [secondProfileId], [Mock_Bounty], [50], [[FIRST_PROFILE_ID]], [100], [currency.address]]
            );
            const data = abiCoder.encode(
                [
                    'uint256',
                    'uint256',
                    'uint256',
                    'uint256[]',
                ],
                [secondProfileId, Mock_Bounty, Mock_Submission, [secondProfileId]]
            );
            await expect(
                lensHub.post({
                    profileId: FIRST_PROFILE_ID,
                    contentURI: MOCK_URI,
                    collectModule: simpleVoting.address,
                    collectModuleData: collectModuleData,
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;

            await expect(
                lensHub.connect(userTwo).post({
                    profileId: secondProfileId,
                    contentURI: MOCK_URI,
                    collectModule: emptyCollectModule.address,
                    collectModuleData: [],
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleData: [],
                })
            ).to.not.be.reverted;

            await expect(
                lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)
            ).to.not.be.reverted;
            await expect(await simpleVoting.state()).to.eq(0);
            await network.provider.send("evm_setNextBlockTimestamp", [2648152830]);
            await network.provider.send("evm_mine");
            await expect(await simpleVoting.state()).to.eq(1);

            await expect(
                simpleVoting.connect(user).castVote(Mock_Bounty, FIRST_PROFILE_ID, Mock_Submission)
            ).to.not.be.reverted;
            await expect(
                simpleVoting.connect(userTwo).castVote(Mock_Bounty, secondProfileId, Mock_Submission)
            ).to.not.be.reverted;

            await expect(await simpleVoting.state()).to.eq(1);
            await network.provider.send("evm_setNextBlockTimestamp", [2648160030]);
            await network.provider.send("evm_mine");
            await expect(await simpleVoting.state()).to.eq(2);
            
            expect(await currency.balanceOf(simpleVoting.address)).to.eq(100);
            expect(await currency.balanceOf(userTwoAddress)).to.eq(0);
            await expect(
                simpleVoting.connect(userTwo).claimPrize(Mock_Bounty, secondProfileId)
            ).to.not.be.reverted;
            expect(await currency.balanceOf(simpleVoting.address)).to.eq(0);
            expect(await currency.balanceOf(userTwoAddress)).to.eq(100);
        });

        // it('User should post with the fee collect module as the collect module and data, user two follows, then collects and pays fee, fee distribution is valid', async function () {
        //   const collectModuleData = abiCoder.encode(
        //     ['uint256', 'address', 'address', 'uint16'],
        //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS]
        //   );
        //   await expect(
        //     lensHub.post({
        //       profileId: FIRST_PROFILE_ID,
        //       contentURI: MOCK_URI,
        //       collectModule: feeCollectModule.address,
        //       collectModuleData: collectModuleData,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
        //   await expect(
        //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
        //   ).to.not.be.reverted;
        //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        //   const data = abiCoder.encode(
        //     ['address', 'uint256'],
        //     [currency.address, DEFAULT_COLLECT_PRICE]
        //   );
        //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

        //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .mul(TREASURY_FEE_BPS)
        //     .div(BPS_MAX);
        //   const expectedRecipientAmount =
        //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

        //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
        //     BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
        //   );
        //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
        //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
        // });

        // it('User should post with the fee collect module as the collect module and data, user two follows, then collects twice, fee distribution is valid', async function () {
        //   const collectModuleData = abiCoder.encode(
        //     ['uint256', 'address', 'address', 'uint16'],
        //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS]
        //   );
        //   await expect(
        //     lensHub.post({
        //       profileId: FIRST_PROFILE_ID,
        //       contentURI: MOCK_URI,
        //       collectModule: feeCollectModule.address,
        //       collectModuleData: collectModuleData,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
        //   await expect(
        //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
        //   ).to.not.be.reverted;
        //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        //   const data = abiCoder.encode(
        //     ['address', 'uint256'],
        //     [currency.address, DEFAULT_COLLECT_PRICE]
        //   );
        //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;
        //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

        //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .mul(TREASURY_FEE_BPS)
        //     .div(BPS_MAX);
        //   const expectedRecipientAmount =
        //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

        //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
        //     BigNumber.from(MAX_UINT256).sub(BigNumber.from(DEFAULT_COLLECT_PRICE).mul(2))
        //   );
        //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount.mul(2));
        //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount.mul(2));
        // });

        // it('User should post with the fee collect module as the collect module and data, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
        //   const secondProfileId = FIRST_PROFILE_ID + 1;
        //   const collectModuleData = abiCoder.encode(
        //     ['uint256', 'address', 'address', 'uint16'],
        //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS]
        //   );
        //   await expect(
        //     lensHub.post({
        //       profileId: FIRST_PROFILE_ID,
        //       contentURI: MOCK_URI,
        //       collectModule: feeCollectModule.address,
        //       collectModuleData: collectModuleData,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(
        //     lensHub.connect(userTwo).createProfile({
        //       to: userTwoAddress,
        //       handle: 'usertwo',
        //       imageURI: MOCK_PROFILE_URI,
        //       followModule: ZERO_ADDRESS,
        //       followModuleData: [],
        //       followNFTURI: MOCK_FOLLOW_NFT_URI,
        //     })
        //   ).to.not.be.reverted;
        //   await expect(
        //     lensHub.connect(userTwo).mirror({
        //       profileId: secondProfileId,
        //       profileIdPointed: FIRST_PROFILE_ID,
        //       pubIdPointed: 1,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
        //   await expect(
        //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
        //   ).to.not.be.reverted;
        //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        //   const data = abiCoder.encode(
        //     ['address', 'uint256'],
        //     [currency.address, DEFAULT_COLLECT_PRICE]
        //   );
        //   await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

        //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .mul(TREASURY_FEE_BPS)
        //     .div(BPS_MAX);
        //   const expectedReferralAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .sub(expectedTreasuryAmount)
        //     .mul(REFERRAL_FEE_BPS)
        //     .div(BPS_MAX);
        //   const expectedReferrerAmount = BigNumber.from(MAX_UINT256)
        //     .sub(DEFAULT_COLLECT_PRICE)
        //     .add(expectedReferralAmount);
        //   const expectedRecipientAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .sub(expectedTreasuryAmount)
        //     .sub(expectedReferralAmount);

        //   expect(await currency.balanceOf(userTwoAddress)).to.eq(expectedReferrerAmount);
        //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
        //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
        // });

        // it('User should post with the fee collect module as the collect module and data, with no referral fee, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
        //   const secondProfileId = FIRST_PROFILE_ID + 1;
        //   const collectModuleData = abiCoder.encode(
        //     ['uint256', 'address', 'address', 'uint16'],
        //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, 0]
        //   );
        //   await expect(
        //     lensHub.post({
        //       profileId: FIRST_PROFILE_ID,
        //       contentURI: MOCK_URI,
        //       collectModule: feeCollectModule.address,
        //       collectModuleData: collectModuleData,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(
        //     lensHub.connect(userTwo).createProfile({
        //       to: userTwoAddress,
        //       handle: 'usertwo',
        //       imageURI: MOCK_PROFILE_URI,
        //       followModule: ZERO_ADDRESS,
        //       followModuleData: [],
        //       followNFTURI: MOCK_FOLLOW_NFT_URI,
        //     })
        //   ).to.not.be.reverted;
        //   await expect(
        //     lensHub.connect(userTwo).mirror({
        //       profileId: secondProfileId,
        //       profileIdPointed: FIRST_PROFILE_ID,
        //       pubIdPointed: 1,
        //       referenceModule: ZERO_ADDRESS,
        //       referenceModuleData: [],
        //     })
        //   ).to.not.be.reverted;

        //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
        //   await expect(
        //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
        //   ).to.not.be.reverted;
        //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        //   const data = abiCoder.encode(
        //     ['address', 'uint256'],
        //     [currency.address, DEFAULT_COLLECT_PRICE]
        //   );
        //   await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

        //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
        //     .mul(TREASURY_FEE_BPS)
        //     .div(BPS_MAX);
        //   const expectedRecipientAmount =
        //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

        //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
        //     BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
        //   );
        //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
        //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
        // });
    });
});