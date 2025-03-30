// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OptimisticOracleV2Interface } from "@uma/core/contracts/optimistic-oracle-v2/interfaces/OptimisticOracleV2Interface.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

contract SepoliaContract is OApp, OAppOptionsType3 {
    address constant WETH_ADDRESS = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    IWETH public weth = IWETH(WETH_ADDRESS);
    OptimisticOracleV2Interface oo = OptimisticOracleV2Interface(0x9f1263B8f0355673619168b5B8c0248f1d03e88C);
    
    bytes32 public constant identifier = bytes32("MULTIPLE_CHOICE_QUERY");
    
    // Constants for handling TOO_EARLY_RESPONSE
    int256 public constant TOO_EARLY_RESPONSE = type(int256).min;
    int256 public constant NO_ANSWER_POSSIBLE = type(int256).max;
    
    string public data = "Nothing received yet.";

    // Market struct
    struct Market {
        uint256 marketId;
        uint256 reward;
        uint256 bond;
        bytes questionText;
        uint256 verificationTime;
        uint256 optionCount;
        bool isResolved;
        int256 outcome;
        uint256 requestTime;
        bool exists;
        bool isEventBased;
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    // Events
    event MarketCreated(uint256 indexed marketId, uint256 reward, uint256 bond, bytes questionText);
    event OracleRequestCreated(uint256 indexed marketId, bytes questionText, uint256 timestamp);
    event MarketSettled(uint256 indexed marketId, int256 outcome);
    event ResultSent(uint256 indexed marketId, int256 outcome, uint32 dstEid);

    // Store Flow endpoint ID for return messages
    uint32 private flowEndpointId = 30401; // Flow testnet EID

    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    receive() external payable {
        weth.deposit{value: msg.value}();
    }

    function depositETH() external payable {
        weth.deposit{value: msg.value}();
    }

    // Instead of receiving markets, we now create them directly
    function createMarket(
        uint256 marketId, 
        uint256 reward, 
        uint256 bond, 
        string memory jsonQuestion,
        uint256 verificationTime,
        uint256 optionCount
    ) external {
        require(!markets[marketId].exists, "Market already exists");
        require(verificationTime >= 360, "Verification time too short"); // 6 minutes minimum
        require(verificationTime <= 86400, "Verification time too long"); // 24 hours maximum
        require(optionCount >= 2, "At least 2 options required");
        require(reward > 0 && bond > 0, "Invalid reward or bond");

        Market storage market = markets[marketId];
        market.marketId = marketId;
        market.reward = reward;
        market.bond = bond;
        market.questionText = bytes(jsonQuestion);
        market.verificationTime = verificationTime;
        market.optionCount = optionCount;
        market.isResolved = false;
        market.outcome = -1;
        market.exists = true;
        market.isEventBased = true; // Make all markets event-based by default

        if (marketId > marketCount) {
            marketCount = marketId;
        }

        emit MarketCreated(marketId, reward, bond, bytes(jsonQuestion));
    }

    function requestSettlement(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.exists, "Market does not exist");
        require(!market.isResolved, "Market already resolved");
        require(market.requestTime == 0, "Settlement already requested");
        require(weth.balanceOf(address(this)) >= market.bond + market.reward, "Insufficient WETH balance");

        // Set request time
        market.requestTime = block.timestamp;

        // Approve the Oracle to spend the reward and bond
        require(weth.approve(address(oo), market.bond + market.reward), "WETH approval failed");

        // Request price from UMA
        oo.requestPrice(
            identifier,
            market.requestTime,
            market.questionText,
            IERC20(WETH_ADDRESS),
            market.reward
        );

        // Set the bond
        oo.setBond(
            identifier,
            market.requestTime,
            market.questionText,
            market.bond
        );

        // Set custom liveness
        oo.setCustomLiveness(
            identifier,
            market.requestTime,
            market.questionText,
            market.verificationTime
        );
        
        // Set as event-based to allow recurring automation
        if (market.isEventBased) {
            oo.setEventBased(
                identifier,
                market.requestTime,
                market.questionText
            );
            
            // Set callback on price settled to handle TOO_EARLY_RESPONSE
            oo.setCallbacks(
                identifier,
                market.requestTime,
                market.questionText,
                false, // Don't set callback on priceProposed
                false, // Don't set callback on priceDisputed
                true   // DO set callback on priceSettled
            );
        }

        emit OracleRequestCreated(marketId, market.questionText, market.requestTime);
    }

    function settleMarket(uint256 marketId) external payable {
        Market storage market = markets[marketId];
        require(market.exists, "Market does not exist");
        require(!market.isResolved, "Market already resolved");
        require(market.requestTime > 0, "Settlement not requested");
        require(
            block.timestamp >= market.requestTime + market.verificationTime,
            "Verification time not passed"
        );

        // Get result from UMA
        int256 result;
        
        try oo.getRequest(
            address(this),
            identifier,
            market.requestTime,
            market.questionText
        ) returns (OptimisticOracleV2Interface.Request memory request) {
            result = request.resolvedPrice;
        } catch {
            revert("Failed to get oracle response");
        }

        // Check if the result is a special value
        if (result == TOO_EARLY_RESPONSE) {
            revert("Oracle response: Too early to determine result");
        } else if (result == NO_ANSWER_POSSIBLE) {
            revert("Oracle response: No answer possible");
        }

        // Ensure the result is a valid option index
        require(
            result >= 0 && uint256(result) < market.optionCount,
            "Invalid option index from oracle"
        );

        market.isResolved = true;
        market.outcome = result;

        emit MarketSettled(marketId, result);
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
     * @dev _origin A struct containing information about the message sender.
     * @dev _guid A unique global packet identifier for the message.
     * @param payload The encoded message payload being received.
     *
     * @dev The following params are unused in the current implementation of the OApp.
     * @dev _executor The address of the Executor responsible for processing the message.
     * @dev _extraData Arbitrary data appended by the Executor to the message.
     *
     * Decodes the received payload and processes it as per the business logic defined in the function.
     */
    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        data = abi.decode(payload, (string));
    }

    function getMarket(uint256 marketId) external view returns (
        uint256 _marketId,
        uint256 reward,
        uint256 bond,
        bytes memory questionText,
        uint256 verificationTime,
        uint256 optionCount,
        bool isResolved,
        int256 outcome,
        uint256 _requestTime,
        bool exists
    ) {
        Market storage market = markets[marketId];
        require(market.exists, "Market does not exist");
        return (
            market.marketId,
            market.reward,
            market.bond,
            market.questionText,
            market.verificationTime,
            market.optionCount,
            market.isResolved,
            market.outcome,
            market.requestTime,
            market.exists
        );
    }

    function getWETHBalance() external view returns (uint256) {
        return weth.balanceOf(address(this));
    }

    /**
     * @notice Sends a market result to Flow network
     * @param marketId The ID of the market to send
     * @return receipt The messaging receipt
     */
    function sendMarketResult(uint256 marketId) external payable returns (MessagingReceipt memory receipt) {
        Market storage market = markets[marketId];
        require(market.exists, "Market does not exist");
        require(market.isResolved, "Market not yet resolved");
        
        // Format the market data as JSON string for sending to Flow
        string memory marketData = formatMarketForMessage(marketId, market.outcome);
        
        // Send the formatted market data to Flow
        receipt = _lzSend(
            flowEndpointId, 
            abi.encode(marketData),
            new bytes(0), // Default empty options
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
        
        emit ResultSent(marketId, market.outcome, flowEndpointId);
        
        return receipt;
    }
    
    /**
     * @notice Formats market data as a JSON string for cross-chain messaging
     * @param marketId The ID of the market
     * @param outcome The outcome of the market
     * @return A formatted string with market data
     */
    function formatMarketForMessage(uint256 marketId, int256 outcome) internal view returns (string memory) {
        Market storage market = markets[marketId];
        
        // Create a JSON string with essential market data
        return string(
            abi.encodePacked(
                '{"marketId":', uintToString(marketId),
                ',"outcome":', intToString(outcome),
                ',"resolved":true}'
            )
        );
    }
    
    /**
     * @notice Converts an int256 to a string
     * @param value The int256 value to convert
     * @return String representation of the int
     */
    function intToString(int256 value) internal pure returns (string memory) {
        if (value < 0) {
            return string(abi.encodePacked("-", uintToString(uint256(-value))));
        }
        return uintToString(uint256(value));
    }
    
    /**
     * @notice Converts a uint256 to a string
     * @param value The uint256 value to convert
     * @return String representation of the uint
     */
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
}