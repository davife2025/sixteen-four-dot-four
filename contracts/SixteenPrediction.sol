// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
// SIXTEEN — contracts/SixteenPrediction.sol
// Prediction Market Contract — BNB Testnet
//
// Users bet BNB on which agent will win a competition round.
// After the round ends, the contract auto-pays winners
// proportional to their stake from the total pool.
//
// Deploy with: npx hardhat deploy --network bscTestnet
// ============================================================

contract SixteenPrediction {

    // ── Structs ───────────────────────────────────────────

    struct Round {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        bool    settled;
        string  winnerAgentId;   // Supabase agent UUID
        uint256 totalPool;       // total BNB staked
    }

    struct Bet {
        address bettor;
        string  agentId;         // Supabase agent UUID
        uint256 amount;          // BNB in wei
        bool    claimed;
    }

    // ── State ─────────────────────────────────────────────

    address public owner;
    uint256 public platformFeeBps = 200;   // 2% platform fee
    uint256 public roundCount;

    mapping(uint256 => Round)                     public rounds;
    mapping(uint256 => Bet[])                     public roundBets;
    mapping(uint256 => mapping(string => uint256)) public agentTotalStake;  // roundId => agentId => total BNB
    mapping(uint256 => mapping(address => uint256)) public userBetIndex;    // roundId => user => bet index

    // ── Events ────────────────────────────────────────────

    event RoundCreated(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event BetPlaced(uint256 indexed roundId, address indexed bettor, string agentId, uint256 amount);
    event RoundSettled(uint256 indexed roundId, string winnerAgentId, uint256 totalPool);
    event WinningsClaimed(uint256 indexed roundId, address indexed bettor, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Round management (called by Sixteen backend) ───────

    function createRound(uint256 durationSeconds) external onlyOwner returns (uint256) {
        roundCount++;
        rounds[roundCount] = Round({
            id:          roundCount,
            startTime:   block.timestamp,
            endTime:     block.timestamp + durationSeconds,
            settled:     false,
            winnerAgentId: "",
            totalPool:   0
        });
        emit RoundCreated(roundCount, block.timestamp, block.timestamp + durationSeconds);
        return roundCount;
    }

    // Called by Sixteen backend after round ends with winner agent ID
    function settleRound(uint256 roundId, string calldata winnerAgentId) external onlyOwner {
        Round storage round = rounds[roundId];
        require(!round.settled, "Already settled");
        require(block.timestamp >= round.endTime, "Round not ended");

        round.settled       = true;
        round.winnerAgentId = winnerAgentId;

        // Take platform fee
        uint256 fee = (round.totalPool * platformFeeBps) / 10000;
        if (fee > 0) {
            payable(owner).transfer(fee);
        }

        emit RoundSettled(roundId, winnerAgentId, round.totalPool);
    }

    // ── Betting ───────────────────────────────────────────

    function placeBet(uint256 roundId, string calldata agentId) external payable {
        Round storage round = rounds[roundId];
        require(block.timestamp < round.endTime, "Betting closed");
        require(!round.settled, "Round settled");
        require(msg.value >= 0.001 ether, "Min bet 0.001 BNB");

        roundBets[roundId].push(Bet({
            bettor:  msg.sender,
            agentId: agentId,
            amount:  msg.value,
            claimed: false
        }));

        agentTotalStake[roundId][agentId] += msg.value;
        round.totalPool                   += msg.value;

        emit BetPlaced(roundId, msg.sender, agentId, msg.value);
    }

    // ── Claim winnings ────────────────────────────────────

    function claimWinnings(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.settled, "Round not settled yet");

        uint256 userWinnings = 0;
        Bet[] storage bets   = roundBets[roundId];
        uint256 winnerStake  = agentTotalStake[roundId][round.winnerAgentId];

        for (uint256 i = 0; i < bets.length; i++) {
            Bet storage bet = bets[i];
            if (
                bet.bettor == msg.sender &&
                keccak256(bytes(bet.agentId)) == keccak256(bytes(round.winnerAgentId)) &&
                !bet.claimed
            ) {
                // Payout = (user stake / winner total stake) * (pool - fee)
                uint256 fee        = (round.totalPool * platformFeeBps) / 10000;
                uint256 netPool    = round.totalPool - fee;
                uint256 payout     = (bet.amount * netPool) / winnerStake;
                userWinnings      += payout;
                bet.claimed        = true;
            }
        }

        require(userWinnings > 0, "Nothing to claim");
        payable(msg.sender).transfer(userWinnings);
        emit WinningsClaimed(roundId, msg.sender, userWinnings);
    }

    // ── Views ─────────────────────────────────────────────

    function getRoundBets(uint256 roundId) external view returns (Bet[] memory) {
        return roundBets[roundId];
    }

    function getAgentStake(uint256 roundId, string calldata agentId) external view returns (uint256) {
        return agentTotalStake[roundId][agentId];
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    // ── Admin ─────────────────────────────────────────────

    function setFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Max 10%");
        platformFeeBps = bps;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // Reject direct ETH sends without a roundId
    receive() external payable { revert("Use placeBet()"); }
}
