// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

interface ISimpleVoting {
    error NotAcceptingSubmissions();
    error NotHacker();
    error TeamTooLarge();
    error ProjectAlreadySubmitted();
    error VotingInactive();
    error AlreadyVoted();
    error NotVoter();
    error VoteStillActive();
    error AlreadyCollected();
    error JudgeAlreadyCreated();
    error BountyAlreadyCreated();
    error NoMirrors();
    event Voted(uint bountyId, uint256 profileId, uint votedFor, address voter);
    event ProjectSubmitted(uint bountyId, uint profileId, uint pubId, address submitter);
    event PrizeClaimed(uint bountyId, uint profileId, address claimer);
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
        uint256[] voters;
    }
    function castVote( uint256 bountyId, uint256 voterId, uint256 pubIdToVoteFor ) external;
    function claimPrize(uint bountyId, uint claimProfileId) external;
    function state() external view returns(HackState);
    function calculateWinner(uint bountyId) external view returns (uint winningPubId_);
    function calculateWinnings(uint256 bountyId, uint256 totalWinners) external returns(uint256 earnings);
    function getVoterWeight(uint256 profileId, uint bountyId) external returns(uint voteWeight);
}