// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title LimitedTimedFeeCollectModule
 * @author Lens Protocol
 *
 * @notice This is a simple Lens CollectModule implementation, inheriting from the ICollectModule interface and
 * the FeeCollectModuleBase abstract contract. To optimize on gas, this module uses a constant 24 hour maximum
 * collection time.
 *
 * This module works by allowing limited collects for a publication within the allotted time with a given fee.
 */
contract LimitedTimedFeeCollectModule is ICollectModule {
    using SafeERC20 for IERC20;
    constructor(address hub) ModuleBase(hub) {}
    enum HackState {
        SubmissionsActive,
        VotingActive,
        VotingClosed
    }
    enum VoterType {
        Judge,
        Hacker
    }
    struct Voter {
        uint voterType;
        uint idVotedFor;
        bool canVote;
        bool hasVoted;
    }
    struct Submission {
        uint voteCount;
        string contentURI;
        bool hasSubmitted;
        uint256[] teamMembers;
        mapping(uint256 => bool) teamMemberCollectedPrize;
    }
    struct Bounty {
        uint judgesDistribution;
        uint prizeMoney;
        uint PrizeMoneyCollected;
        address token;
        mapping(uint256 => Submission) pubIdToSubmission;
        mapping(uint256 => Voter) idToVoters;
        uint256[] submissions;
        // Can update voters to be just a uint pubId pounts to idToVoters
        uint256[] voters;
    }
    mapping(uint256 => Bounty) idToBounty;
    mapping(uint256 => bool) isHacker;

    uint startTime;
    uint submissionsEnd;
    uint votingEnd;
    uint maxTeamSize;
    uint profileId;
    uint pubId;

    /**
     * @notice Initializes data for a given publication being published. This can only be called by the hub.
     *
     * @param profileId The token ID of the profile publishing the publication.
     * @param pubId The associated publication's LensHub publication ID.
     * @param data Arbitrary data __passed from the user!__ to be decoded.
     *
     * @return An abi encoded byte array encapsulating the execution's state changes. This will be emitted by the
     * hub alongside the collect module's address and should be consumed by front ends.
     */
    function initializePublicationCollectModule(
        uint256 _profileId,
        uint256 _pubId,
        bytes calldata _data
    ) external onlyHub returns (bytes memory) {
        profileId = _profileId;
        pubId = _pubId;
        (
            uint256 _startTime,
            uint256 _submissionsEnd,
            uint256 _votingEnd,
            uint256 _maxTeamSize,
            uint256[] _hackers,
            uint256[] _bountyIds,
            uint256[] _judgesDistribution,
            uint256[][] _judges,
            uint256[] _amounts,
            address[] _tokens
        ) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint256[], uint256[], uint256[][], uint256[], address[]));
        // SafeGuard Params
        if(
            _submissionsEnd == 0 || 
            _votingEnd == 0 || 
            _maxTeamSize == 0 ||
            _hackers.length == 0 || 
            _bountyIds.length == 0
        ) revert Errors.InitParamsInvalid();
        if(
            _bountyIds.length != _judgesDistribution.length || 
            _judgesDistribution.length != _judges.length || 
            _judges.length != _amounts.length || 
            _amounts.length != _tokens.length) revert Errors.InitParamsInvalid();
        
        // Initate .env Variables
        startTime = block.timestamp;
        submissionsEnd = _submissionsEnd;
        votingEnd = _votingEnd;
        maxTeamSize = _maxTeamSize;

        // Initate Hackers
        _initHackers(_hackers);

        // Initiate Bounties + Judges
        for(uint i = 0; i< _bountyIds.length; i++){
            idToBounty[_bountyIds[i]]._judgesDistribution = _judgesDistribution[i];
            _initJudges(_bountyIds[i], _judges[i]);
            _fundBounty(_bountyIds[i], _amounts[i], _tokens[i]);
        }
    }

    function submitProject(
        uint256 submitterId,
        uint256 bountyId,
        uint256 pubId,
        string contentURI,
        uint256[] calldata teamMembersId
    ) {
        // Safeguard Params - HackState / isHacker / ProfileId Owner / TeamMember Length / PubId Not Submitted
        if(state() != HackState.SubmissionsActive) revert;
        if(isHacker[submitterId] != true) revert;
            address owner = IERC721(HUB).ownerOf(submitterId);
        if (msg.sender != owner) revert Errors.NotProfileOwner();
        if(teamMembers.length > maxTeamSize) revert;
        if(idToBounty[bountyId].pubIdToSubmission[pubId].hasSubmitted != false) revert;

        // Set Submission .env Variables
        idToBounty[bountyId].pubIdToSubmission[pubId].hasSubmitted = true; 
        idToBounty[bountyId].pubIdToSubmission[pubId].contentURI = ILensHub(HUB).getContentURI(submitterId, pubId);      
        _assignTeamMembers(bountyId, pubId, teamMembersId);
        // Submit Project

        idToBounty[bountyId].submissions.push(pubId);
    }

    function castVote(
        uint256 bountyId,
        uint256  voterId,
        uint256 pubIdToVoteFor
    ) external {
        // Safeguard Params - State / HasVotes / CanVote || isHacker / VoterId Owner
        if(state() != HackState.VotingActive) revert;
        if(idToBounty[bountyId].idToVoter[voterId].hasVoted != false) revert;
        if(idToBounty[bountyId].idToVoter[voterId].canVote != true && isHacker[profileId] != true) revert;
            address owner = IERC721(HUB).ownerOf(voterId);
        if (msg.sender != owner) revert Errors.NotProfileOwner();

        // Set Voter State - Reentrency / Add Hacker to Voter Array
        if(isHacker) {
            idToBounty[bountyId].idToVoter[profileId].voterType = Voter(VoteType.Hacker, pubIdToVoteFor, true, true);
            idToBounty[bountyId].voters.push(voterId);
        } else {
            idToBounty[bountyId].idToVoter[voterId].hasVoted = true;
            idToBounty[bountyId].idToVoter[voterId].idVotedFor = pubIdToVoteFor;
        }

        pubIToSubmission[pubIdToVoteFor].voteCount += getVoterWeight(voterId);
    }
    
    function claimPrize(
        uint bountyId,
        uint claimProfileId
    ) public {
        if(state() != HackState.VotingClosed) revert;
        address owner = IERC721(HUB).ownerOf(claimProfileId);
        if (msg.sender != owner) revert Errors.NotProfileOwner();
        uint256 winningPubId = calculateWinner(bountyId);
        uint256[] winningProfiles = idToBounty[bountyId].pubIdToSubmission[winningPubId].teamMembers;
        for(uint i; i < winningProfiles; i++) {
            if(winningProfiles[i] == claimProfileId) {
                // Protect from Retentrency
                if(idToBounty[bountyId].pubIdToSubmission[winningPubId].teamMemberCollectedPrize =! false) revert;
                idToBounty[bountyId].pubIdToSubmission[winningPubId].teamMemberCollectedPrize = true;
                uint256 earnings = _calculateWinnings(bountyId, winningProfiles.length);
                idToBounty[bountyId].PrizeMoneyCollected += earnings;
                uint256  prizeMoneyRemaining = idToBount[bountyId].prizeMoney - idToBount[bountyId].PrizeMoneyCollected;
                if(earnings <= prizeMoneyRemaining) {
                    IERC20(idToBounty[bountyId].token).safeTransfer(msg.sender, earnings);
                } else {
                    IERC20(idToBounty[bountyId].token).safeTransfer(msg.sender, prizeMoneyRemaining);
                }
            }
        }
    }
    
    function state() public view returns(HackState) {
        if (block.timestamp >= startTime && block.timestamp < submissionsEnd) return HackState.SubmissionsActive;
        if (block.timestamp >= submissionsEnd && block.timestamp < votingEnd) return HackState.VotingActive;
        if ( block.timestamp >= votingEnd) return HackState.VotingClosed;
    }
    function calculateWinner(uint bountyId) public view returns (uint winningPubId_) {
        uint winningVoteCount = 0;
        for (uint i = 0; i < idToBounty[bountyId].submissions.length; i++) {
            uint256 _pubId = idToBounty[bountyId].submissions[i];
            uint256 _voteCount = idToBounty[bountyId].pubIdToSubmission[_pubId].voteCount;
            if (_voteCount > winningVoteCount) {
                winningVoteCount = _voteCount;
                winningSubmission_ = _pubId;
            }
        }
    }

    function calculateWinnings(uint256 bountyId, uint256 totalWinners) public returns(uint256 earnings) {
        uint256 prizeMoney = idToBounty[bountyId].prizeMoney;
        earnings = prizeMoney / totalWinners;
    }
    function getVoterWeight(uint256 profileId, uint bountyId) public returns(uint voteWeight){
        uint256 percision = 10 ** 5;
        uint voterType = idToBounty[bountyId].idToVoter[profileId].voterType;
        voteWeight = 0;
        if(voterType == VoterType.Judge) {
            uint totalJudgeVotes = percision / judgesDistribution;
            uint totalJudges;
            for(uint i; idToBounty[bountyId].voters.length; i++){
                uint256 voterId = idToBounty[bountyId].voters[i];
                if(idToBounty[bountyId].idToVoter[voterId].voterType == VoterType.Judge) totalJudges++;
            }
            voteWeight = totalJudgeVotes / totaJudges;
        } else if(voterType == VoterType.Hacker && judgesDistribution != 100) {
            uint totalHackerVotes = percision / (100 - judgesDistribution);
            uint totalHackers;
            for(uint i; idToBounty[bountyId].voters.length; i++){
                uint256 voterId = idToBounty[bountyId].voters[i];
                if(idToBounty[bountyId].idToVoter[voterId].voterType == VoterType.Hacker) totalHackers++;
            }
            voteWeight = totalHackerVotes / totalHackers;
        }
    }
    function _initHackers(uint[] hackers) internal{
        for(uint i = 0; i< _hackers; i++) {
            idToHackers[_hackers[i]] = true;
        }
    }
    function _initJudges(uint bountyId, uint[] judges) internal {
        for(uint i = 0; i<judges.length; i++){
            // Do NOT Reinit Judge 
            if(idToBounty[bountyId].idToVoters[judges[i]].canVote != false) revert;
            idToBounty[bountyId].idToVoters[judges[i]] = Voter(VoteType.Judge, 0, true, false);
            idToBounty[bountyId].voters.push(judges[i]);
        }
    }

    function _fundBounty(uint bountyId, uint amount, address token) internal {
        if(idToBounty[bountyId].amount > 0) revert;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        idToBounty[bountyId].prizeMoney =  amount;
        idToBounty[bountyId].token = token;
    } 

    function _assignTeamMembers(uint bountyId, uint pubId, uint[] teamMembersId) internal {
        for (uint i; teamMembersId.length; i++) {
            if(!isHacker[teamMembersId[i]]) revert;
            idToBounty[bountyId].pubIdToSubmission[pubId].teamMembers.push(teamMembersId[i]);
        }
    }

    /**
     * @notice Processes a collect action for a given publication, this can only be called by the hub.
     *
     * @param referrerProfileId The LensHub profile token ID of the referrer's profile (only different in case of mirrors).
     * @param collector The collector address.
     * @param profileId The token ID of the profile associated with the publication being collected.
     * @param pubId The LensHub publication ID associated with the publication being collected.
     * @param data Arbitrary data __passed from the collector!__ to be decoded.
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external onlyHub;
}