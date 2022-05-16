// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "hardhat/console.sol";

import "./IPaymentReceiver.sol";

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

import {
    ISuperfluid,
    ISuperToken,
    ISuperApp,
    ISuperAgreement,
    ContextDefinitions,
    SuperAppDefinitions
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
// When ready to move to leave Remix, change imports to follow this pattern:
// "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {
    CFAv1Library
} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";

import {
    SuperAppBase
} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

contract SuperGate is SuperAppBase {

    ISuperfluid private host; // host
    IConstantFlowAgreementV1 private cfa; // the stored constant flow agreement class
    
    struct Gate{
        string name;
        address owner;
        ISuperToken acceptedToken; // accepted token
        int96 flowRate;
    }

    Gate private gate;
    



    constructor(ISuperfluid _host, IConstantFlowAgreementV1 _cfa, Gate memory _gate) {
        host = _host;
        cfa = _cfa;
        gate = _gate;

        // by default, all 6 callbacks defined in the ISuperApp interface
        // are forwarded to a SuperApp.
        // If you inherit from SuperAppBase, there's a default implementation
        // for each callback which will revert.
        // Developers will want to avoid reverting in Super App callbacks, 
        // In particular, you want to avoid reverting within the termination callback
        // (see rules below regarding the termination callback for more info)
        // you need to make sure only those actually implemented (overridden)
        // are ever invoked. That's achieved by setting the _NOOP flag for those
        // callbacks which you don't need and didn't implement.
        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);
    }


    
    function beforeAgreementCreated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*ctx*/
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        revert("Unsupported callback - Before Agreement Created");
    }

    function afterAgreementCreated(
        ISuperToken superToken,
        address /*agreementClass*/,
        bytes32 agreementId,
        bytes calldata agreementData,
        bytes calldata /*cbdata*/,
        bytes calldata /*ctx*/
    )
        external
        virtual
        override
        returns (bytes memory /*newCtx*/)
    {
        (address user, address receiver) = abi.decode(agreementData, (address, address));
        cfa.getFlowByID(superToken, agreementId);
        // decode Context - store full context as uData variable for easy visualization purposes
        ISuperfluid.Context memory decompiledContext;

        //set userData variable to decoded value
        //for now, this value is hardcoded as a string - this will be made clear in flow creation scripts within the tutorial
        //this string will serve as a message on an 'NFT billboard' when a flow is created with recipient = tradeableCashflow
        //it will be displayed on a front end for assistance in userData explanation
        revert("Unsupported callback - After Agreement Created");
    }

    function beforeAgreementUpdated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*ctx*/
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        revert("Unsupported callback - Before Agreement updated");
    }

    function afterAgreementUpdated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*cbdata*/,
        bytes calldata /*ctx*/
    )
        external
        virtual
        override
        returns (bytes memory /*newCtx*/)
    {
        revert("Unsupported callback - After Agreement Updated");
    }

    function beforeAgreementTerminated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*ctx*/
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        revert("Unsupported callback -  Before Agreement Terminated");
    }

    function afterAgreementTerminated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*cbdata*/,
        bytes calldata /*ctx*/
    )
        external
        virtual
        override
        returns (bytes memory /*newCtx*/)
    {
        revert("Unsupported callback - After Agreement Terminated");
    }
    

}