// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract FlowContract is OApp, OAppOptionsType3 {
    string public data = "Nothing received yet.";

    // Role management
    mapping(address => bool) public admins;
    mapping(address => bool) public betCreators;

    uint256 public constant PLATFORM_FEE = 300; // 3%
    uint256 public platformBalance;

    enum MarketCategory {
        CULTURE,
        CRYPTO,
        SPORTS,
        POLITICS,
        MEMECOINS,
        GAMING,
        ECONOMY,
        AI
    }

    struct Market {
        string description;
        address creator;
        uint256 expirationDate;
        uint256 verificationTime;
        bool isResolved;
        uint256[] optionAmounts;
        uint256 requestTime;
        int256 outcome;
        bytes questionText;
        string imageUrl;
        MarketCategory category;
        mapping(address => UserBet) userBets;
        address[] bettors;
        uint256 optionCount;
    }

    struct UserBet {
        uint256[] optionAmounts;
        bool claimed;
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    uint256[] public marketIds;

    struct MarketView {
        uint256 marketId;
        string description;
        address creator;
        uint256 expirationDate;
        uint256 verificationTime;
        bool isResolved;
        uint256[] optionAmounts;
        uint256 requestTime;
        int256 outcome;
        MarketCategory category;
        string imageUrl;
        uint256 optionCount;
    }

    // Add this struct to parse received market data
    struct ReceivedMarketData {
        uint256 marketId;
        int256 outcome;
        bool resolved;
    }

    // Add an event to track market data received from Sepolia
    event MarketDataReceived(uint256 marketId, int256 outcome);

    // Events
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event BetCreatorAdded(address indexed creator);
    event BetCreatorRemoved(address indexed creator);
    event MarketCreated(
        uint256 indexed marketId,
        string description,
        uint256 expirationDate,
        uint256 verificationTime
    );
    event BetPlaced(
        address indexed user,
        uint256 indexed marketId,
        uint256 amount,
        uint256 optionIndex
    );
    event SettlementRequested(uint256 indexed marketId, uint256 requestTime);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(
        address indexed user,
        uint256 indexed marketId,
        uint256 amount
    );
    event PlatformFeesWithdrawn(uint256 amount);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call this");
        _;
    }

    modifier onlyBetCreator() {
        require(betCreators[msg.sender], "Only bet creator can call this");
        _;
    }

    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    // Role management functions
    function addAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        admins[newAdmin] = true;
        emit AdminAdded(newAdmin);
    }

    function removeAdmin(address admin) external onlyOwner {
        require(admin != owner(), "Cannot remove owner");
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    function addBetCreator(address creator) external onlyAdmin {
        require(creator != address(0), "Invalid address");
        betCreators[creator] = true;
        emit BetCreatorAdded(creator);
    }

    function removeBetCreator(address creator) external onlyAdmin {
        betCreators[creator] = false;
        emit BetCreatorRemoved(creator);
    }

    function withdrawPlatformFees() external onlyOwner {
        require(platformBalance > 0, "No fees to withdraw");
        uint256 amount = platformBalance;
        platformBalance = 0;
        payable(owner()).transfer(amount);
        emit PlatformFeesWithdrawn(amount);
    }

    function createMarketAdmin(
        string memory title,
        string memory description,
        string[] memory options,
        uint256 expirationDate,
        uint256 _verificationTime,
        string memory imageUrl,
        MarketCategory category
    ) external onlyBetCreator {
        require(expirationDate > block.timestamp, "Invalid expiration date");
        require(_verificationTime >= 150, "Verification time too short");
        require(_verificationTime <= 86400, "Verification time too long"); // Max 24 hours
        require(options.length >= 2, "At least 2 options required");
        require(options.length <= 10, "Maximum 10 options allowed");

        // Create a properly formatted JSON object for UMA's MULTIPLE_CHOICE_QUERY
        string memory jsonStart = '{"title":"';
        string memory jsonTitleEnd = '","description":"';
        string memory jsonDescEnd = '","options":[';

        // Start building the JSON
        string memory formattedQuestion = string(
            abi.encodePacked(
                jsonStart,
                title,
                jsonTitleEnd,
                description,
                jsonDescEnd
            )
        );

        // Add options
        for (uint i = 0; i < options.length; i++) {
            // Format: ["Option1","0"],["Option2","1"]
            if (i > 0) {
                formattedQuestion = string(
                    abi.encodePacked(formattedQuestion, ",")
                );
            }
            formattedQuestion = string(
                abi.encodePacked(
                    formattedQuestion,
                    '["',
                    options[i],
                    '","',
                    uintToString(i),
                    '"]'
                )
            );
        }

        // Close the JSON object
        formattedQuestion = string(abi.encodePacked(formattedQuestion, "]}"));

        marketCount++;
        Market storage market = markets[marketCount];
        market.description = description;
        market.creator = msg.sender;
        market.expirationDate = expirationDate;
        market.verificationTime = _verificationTime;
        market.questionText = bytes(formattedQuestion);
        market.imageUrl = imageUrl;
        market.category = category;
        market.outcome = -1; // Initialize as unresolved
        market.optionCount = options.length;

        // Initialize the optionAmounts array with the correct size
        market.optionAmounts = new uint256[](options.length);

        marketIds.push(marketCount);

        emit MarketCreated(
            marketCount,
            description,
            expirationDate,
            _verificationTime
        );
    }

    // Helper function to convert uint to string
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    // Internal function that both placeBet and placeBetYesNo will call
    function _placeBet(uint256 marketId, uint256 optionIndex) internal {
        require(
            marketId > 0 && marketId <= marketCount,
            "Market does not exist"
        );
        Market storage market = markets[marketId];

        require(!market.isResolved, "Market is resolved");
        require(block.timestamp < market.expirationDate, "Market has expired");
        require(msg.value > 0, "Bet amount must be greater than 0");
        require(optionIndex < market.optionCount, "Invalid option index");

        // Calculate platform fee
        uint256 fee = (msg.value * PLATFORM_FEE) / 10000;
        uint256 betAmount = msg.value - fee;
        platformBalance += fee;

        // Get or initialize user bet
        UserBet storage userBet = market.userBets[msg.sender];

        // Initialize user's optionAmounts array if this is their first bet
        if (userBet.optionAmounts.length == 0) {
            userBet.optionAmounts = new uint256[](market.optionCount);
            market.bettors.push(msg.sender);
        }

        // Update market totals and user bet
        market.optionAmounts[optionIndex] += betAmount;
        userBet.optionAmounts[optionIndex] += betAmount;

        emit BetPlaced(msg.sender, marketId, betAmount, optionIndex);
    }

    // Public function for placing bets with option index
    function placeBet(uint256 marketId, uint256 optionIndex) external payable {
        _placeBet(marketId, optionIndex);
    }

    // Public function for placing Yes/No bets (backward compatibility)
    function placeBetYesNo(uint256 marketId, bool isYes) external payable {
        uint256 optionIndex = isYes ? 1 : 0;
        _placeBet(marketId, optionIndex);
    }


    function claimWinnings(uint256 marketId) external {
        require(
            marketId > 0 && marketId <= marketCount,
            "Market does not exist"
        );
        Market storage market = markets[marketId];
        require(market.isResolved, "Market not resolved");

        UserBet storage userBet = market.userBets[msg.sender];
        require(!userBet.claimed, "Winnings already claimed");

        // Check if user placed any bets
        bool hasBets = false;
        for (uint256 i = 0; i < market.optionCount; i++) {
            if (userBet.optionAmounts[i] > 0) {
                hasBets = true;
                break;
            }
        }
        require(hasBets, "No bets placed");

        uint256 winningOption = uint256(market.outcome);
        uint256 winnings = 0;

        // If user bet on the winning option
        if (userBet.optionAmounts[winningOption] > 0) {
            uint256 totalWinningAmount = market.optionAmounts[winningOption];
            uint256 totalLosingAmount = 0;

            // Calculate total losing amount
            for (uint256 i = 0; i < market.optionCount; i++) {
                if (i != winningOption) {
                    totalLosingAmount += market.optionAmounts[i];
                }
            }

            if (totalLosingAmount > 0) {
                // Normal case: distribute losing pool
                winnings =
                    userBet.optionAmounts[winningOption] +
                    (userBet.optionAmounts[winningOption] * totalLosingAmount) /
                    totalWinningAmount;
            } else {
                // Edge case: everyone bet on the winning option
                winnings = userBet.optionAmounts[winningOption]; // Just return original bet
            }
        }

        require(winnings > 0, "No winnings to claim");
        userBet.claimed = true;

        payable(msg.sender).transfer(winnings);
        emit WinningsClaimed(msg.sender, marketId, winnings);
    }

    function getUserBet(
        address user,
        uint256 marketId
    ) external view returns (uint256[] memory optionAmounts, bool claimed) {
        UserBet storage userBet = markets[marketId].userBets[user];
        return (userBet.optionAmounts, userBet.claimed);
    }

    function getMarketDetails(
        uint256 marketId
    )
        external
        view
        returns (
            uint256 id,
            string memory description,
            address creator,
            uint256 expirationDate,
            uint256 verificationTime,
            bool isResolved,
            uint256[] memory optionAmounts,
            uint256 requestTime,
            int256 outcome,
            MarketCategory category,
            string memory imageUrl,
            uint256 optionCount
        )
    {
        require(
            marketId > 0 && marketId <= marketCount,
            "Market does not exist"
        );
        Market storage marketData = markets[marketId];

        return (
            marketId,
            marketData.description,
            marketData.creator,
            marketData.expirationDate,
            marketData.verificationTime,
            marketData.isResolved,
            marketData.optionAmounts,
            marketData.requestTime,
            marketData.outcome,
            marketData.category,
            marketData.imageUrl,
            marketData.optionCount
        );
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        return marketIds;
    }

    function getAllMarkets() external view returns (MarketView[] memory) {
        uint256 totalMarkets = marketIds.length;
        MarketView[] memory allMarkets = new MarketView[](totalMarkets);

        for (uint256 i = 0; i < totalMarkets; i++) {
            uint256 id = marketIds[i];
            Market storage market = markets[id];

            allMarkets[i] = MarketView({
                marketId: id,
                description: market.description,
                creator: market.creator,
                expirationDate: market.expirationDate,
                verificationTime: market.verificationTime,
                isResolved: market.isResolved,
                optionAmounts: market.optionAmounts,
                requestTime: market.requestTime,
                outcome: market.outcome,
                category: market.category,
                imageUrl: market.imageUrl,
                optionCount: market.optionCount
            });
        }

        return allMarkets;
    }

    function getTotalPoolSize(
        uint256 marketId
    ) external view returns (uint256) {
        require(
            marketId > 0 && marketId <= marketCount,
            "Market does not exist"
        );

        Market storage market = markets[marketId];
        uint256 total = 0;

        for (uint256 i = 0; i < market.optionCount; i++) {
            total += market.optionAmounts[i];
        }

        return total;
    }

    /**
     * @notice Sends a message from the source chain to a destination chain.
     * @param _dstEid The endpoint ID of the destination chain.
     * @param _message The message string to be sent.
     * @param _options Additional options for message execution.
     * @dev Encodes the message as bytes and sends it using the `_lzSend` internal function.
     * @return receipt A `MessagingReceipt` struct containing details of the message sent.
     */
    function send(
        uint32 _dstEid,
        string memory _message,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        bytes memory _payload = abi.encode(_message);
        receipt = _lzSend(_dstEid, _payload, _options, MessagingFee(msg.value, 0), payable(msg.sender));
    }

    /**
     * @notice Quotes the gas needed to pay for the full omnichain transaction in native gas or ZRO token.
     * @param _dstEid Destination chain's endpoint ID.
     * @param _message The message.
     * @param _options Message execution options (e.g., for sending gas to destination).
     * @param _payInLzToken Whether to return fee in ZRO token.
     * @return fee A `MessagingFee` struct containing the calculated gas fee in either the native token or ZRO token.
     */
    function quote(
        uint32 _dstEid,
        string memory _message,
        bytes memory _options,
        bool _payInLzToken
    ) public view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(_message);
        fee = _quote(_dstEid, payload, _options, _payInLzToken);
    }

    /**
     * @dev Internal function override to handle incoming messages from another chain.
     * Parses the market data sent from Sepolia and updates the local market's status.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Store the raw data
        data = abi.decode(payload, (string));
        
        // Try to parse as market data
        ReceivedMarketData memory marketData = parseMarketData(data);
        
        // If valid market data was received
        if (marketData.marketId > 0 && marketData.resolved) {
            // Make sure market exists in our system
            require(
                marketData.marketId <= marketCount && 
                markets[marketData.marketId].expirationDate > 0,
                "Market not found"
            );
            
            // Update the market with outcome
            Market storage market = markets[marketData.marketId];
            market.isResolved = true;
            market.outcome = marketData.outcome;
            
            emit MarketResolved(marketData.marketId, marketData.outcome >= 0);
            emit MarketDataReceived(marketData.marketId, marketData.outcome);
        }
    }
    
    /**
     * @notice Parses market data from JSON string received from Sepolia
     * @param jsonData The JSON string with market data
     * @return parsed The parsed market data
     */
    function parseMarketData(string memory jsonData) internal pure returns (ReceivedMarketData memory parsed) {
        // Initialize with default values
        parsed.marketId = 0;
        parsed.outcome = -1;
        parsed.resolved = false;
        
        // Simple JSON parsing - assumes exact format from Sepolia: {"marketId":X,"outcome":Y,"resolved":true}
        
        bytes memory data = bytes(jsonData);
        
        // Check if data is too short to be valid JSON
        if (data.length < 10) return parsed;
        
        // Find the marketId part
        uint256 marketIdPos = findPosition(data, "marketId");
        if (marketIdPos == 0) return parsed;
        
        // Find the outcome part
        uint256 outcomePos = findPosition(data, "outcome");
        if (outcomePos == 0) return parsed;
        
        // Find the resolved part
        uint256 resolvedPos = findPosition(data, "resolved");
        if (resolvedPos == 0) return parsed;
        
        // Extract values
        parsed.marketId = parseUint(extractValue(data, marketIdPos));
        parsed.outcome = parseInt(extractValue(data, outcomePos));
        parsed.resolved = compareStrings(extractValue(data, resolvedPos), "true");
        
        return parsed;
    }
    
    /**
     * @notice Finds the position of a key in a JSON string
     */
    function findPosition(bytes memory data, string memory key) internal pure returns (uint256) {
        bytes memory searchKey = abi.encodePacked('"', key, '":');
        
        for (uint256 i = 0; i < data.length - searchKey.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < searchKey.length; j++) {
                if (data[i + j] != searchKey[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return i + searchKey.length;
            }
        }
        
        return 0;
    }
    
    /**
     * @notice Extracts a value from a position in JSON data
     */
    function extractValue(bytes memory data, uint256 pos) internal pure returns (string memory) {
        uint256 endPos = pos;
        
        // Find the end of the value (comma or closing brace)
        while (endPos < data.length) {
            if (data[endPos] == ',' || data[endPos] == '}') {
                break;
            }
            endPos++;
        }
        
        // Extract the substring
        bytes memory valueBytes = new bytes(endPos - pos);
        for (uint256 i = 0; i < endPos - pos; i++) {
            valueBytes[i] = data[pos + i];
        }
        
        return string(valueBytes);
    }
    
    /**
     * @notice Parse a string to uint
     */
    function parseUint(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
        
        return result;
    }
    
    /**
     * @notice Parse a string to int (supports negative values)
     */
    function parseInt(string memory s) internal pure returns (int256) {
        bytes memory b = bytes(s);
        bool negative = false;
        uint256 start = 0;
        
        if (b.length > 0 && b[0] == '-') {
            negative = true;
            start = 1;
        }
        
        int256 result = 0;
        for (uint256 i = start; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + int256(uint256(c - 48));
            }
        }
        
        if (negative) {
            result = -result;
        }
        
        return result;
    }
    
    /**
     * @notice Compare two strings
     */
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
