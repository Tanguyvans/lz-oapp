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
    
    bytes32 public identifier = bytes32("YES_OR_NO_QUERY");
    uint256 public requestTime;
    string public data = "Nothing received yet.";
    bool public dataReceived;
    
    event DataUpdated(string newData);
    event OracleRequested(string question, uint256 timestamp);

    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    receive() external payable {
        weth.deposit{value: msg.value}();
    }

    function depositETH() external payable {
        weth.deposit{value: msg.value}();
    }

    // This function only updates the data
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address _executor,
        bytes calldata /*_extraData*/
    ) internal override {
        // Only decode and store the data
        data = abi.decode(payload, (string));
        dataReceived = true;
        emit DataUpdated(data);
    }

    // Separate function for oracle interaction
    function createOracleRequest() external {
        require(dataReceived, "No data received yet");
        require(weth.balanceOf(address(this)) >= 0.1 ether, "Insufficient WETH balance");

        string memory formattedQuestion = string(abi.encodePacked(
            "Q: ", data, " A: 1 for YES, 0 for NO"
        ));

        // Approve WETH
        require(weth.approve(address(oo), 0.1 ether), "WETH approval failed");

        requestTime = block.timestamp;
        
        // Make the oracle request
        oo.requestPrice(
            identifier,
            requestTime,
            bytes(formattedQuestion),
            IERC20(WETH_ADDRESS),
            0
        );

        emit OracleRequested(formattedQuestion, requestTime);
        dataReceived = false;
    }

    // Add view functions to check status
    function getWETHBalance() external view returns (uint256) {
        return weth.balanceOf(address(this));
    }

    function hasNewData() external view returns (bool) {
        return dataReceived;
    }
}