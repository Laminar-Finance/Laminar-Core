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
    
    using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData public cfaV1; //initialize cfaV1 variable

    /*
    * ------------------------------------------------------------
    * Gate information
    * ------------------------------------------------------------
    */

    string public name;
    address public owner;
    ISuperToken public acceptedToken; // accepted token
    int96 public flowRate;
    bool public isPaused;

    mapping(address => bool) private checkedIn;


    constructor(ISuperfluid _host, IConstantFlowAgreementV1 _cfa, string memory _name, address _owner, ISuperToken _acceptedToken, int96 _flowRate) {
        require(flowRate > 0, "flow rate must be positive");
        require(owner != address(0), "owner cannot be 0");
        host = _host;
        cfa = _cfa;
        name = _name;
        owner = _owner;
        acceptedToken = _acceptedToken;
        flowRate = _flowRate;
        isPaused = false;

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
            SuperAppDefinitions.AFTER_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);

        //initialize InitData struct, and set equal to cfaV1
        cfaV1 = CFAv1Library.InitData(
        host,
        //here, we are deriving the address of the CFA using the host contract
        IConstantFlowAgreementV1(
            address(host.getAgreementClass(
                    keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1")
                ))
            )
        );

    }

    /*
    * ------------------------------------------------------------
    * Owner only functions
    * ------------------------------------------------------------
    */

    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "only owner can change owner");
        require(newOwner != owner, "new owner must be different from current owner");
        require(newOwner != address(0), "New receiver is zero address");
        require(!host.isApp(ISuperApp(newOwner)), "New receiver can not be a superApp");
        (,int96 outFlowRate,,) = cfa.getFlow(acceptedToken, address(this), owner);
        if (outFlowRate != 0) {
            cfaV1.deleteFlow(address(this), owner, acceptedToken);
            cfaV1.createFlow(newOwner, acceptedToken, cfa.getNetFlow(acceptedToken, address(this)));
        }
        owner = newOwner;
    }

    function changeName(string calldata newName) external {
        require(msg.sender == owner, "only owner can change name");
        name = newName;
    }

    function changeAcceptedToken(ISuperToken newToken) external {
        require(msg.sender == owner, "only owner can change accepted token");
        acceptedToken = newToken;
    }

    function changeFlowRate(int96 newFlowRate) external {
        require(msg.sender == owner, "only owner can change flow rate");
        flowRate = newFlowRate;
    }

    function pause() external {
        require(msg.sender == owner, "only owner can pause");
        isPaused = true;
    }



    /*
    * ------------------------------------------------------------
    * internal functions
    * ------------------------------------------------------------
    */

    function _updateOutflow(bytes calldata ctx) internal returns (bytes memory newCtx) {
        newCtx = ctx;

        // Inflow is always > 0 and equal to set flow rate here, because of the check in beforeAgreementCreated
        // netflow = inflow - outflow
        // inflow = netflow + outflow
        // outflow = inflow - netflow

        int96 netFlowRate = cfa.getNetFlow(acceptedToken, address(this));
        (,int96 outFlowRate,,) = cfa.getFlow(acceptedToken, address(this), owner);
        int96 inFlowRate = netFlowRate + outFlowRate;

        if(inFlowRate == int96(0)){
            newCtx = cfaV1.deleteFlowWithCtx(newCtx, address(this), owner, acceptedToken);
        }
        else if(outFlowRate != int96(0)){
            newCtx = cfaV1.updateFlowWithCtx(ctx, owner, acceptedToken, inFlowRate);
        }
        else{
            newCtx = cfaV1.createFlowWithCtx(ctx, owner, acceptedToken, inFlowRate);
        }

    }


    /*
    * ------------------------------------------------------------
    * Super app callback functions
    * Note Any attempt to tamper with the value of ctx or failing to give the right ctx will result in a Jailed App.
    * ------------------------------------------------------------
    */

    
    function beforeAgreementCreated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata agreementData,
        bytes calldata /*ctx*/
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        require(!isPaused, "Gate is paused");
        // Require that the incoming flow rate is equal to the rate set by the owner
        (address sender, address receiver) = abi.decode(agreementData, (address, address));
        (,int96 _flowRate,,) = cfa.getFlow(acceptedToken, address(this), owner);
        require(_flowRate == flowRate, "Flow rate must be equal to the flow rate set by the owner");
        require(checkedIn[sender], "You are not checked in!");
    }

    function afterAgreementCreated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata agreementData,
        bytes calldata /*cbdata*/,
        bytes calldata ctx
    )
        external
        virtual
        override
        returns (bytes memory newCtx)
    {
        (address sender,) = abi.decode(agreementData, (address, address));
        newCtx = _updateOutflow(ctx);
        checkedIn[sender] = true;
    }

    function beforeAgreementUpdated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata ctx
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        //Only allow owner to update agreement using context
        ISuperfluid.Context memory decompiledContext = host.decodeCtx(ctx);
        require(decompiledContext.msgSender == owner, "Only owner can update agreement");
    }

    function afterAgreementUpdated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata /*agreementData*/,
        bytes calldata /*cbdata*/,
        bytes calldata ctx
    )
        external
        virtual
        override
        returns (bytes memory /*newCtx*/)
    {
        return ctx;
        //revert("Unsupported callback - After Agreement Updated");
    }

    function beforeAgreementTerminated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata agreementData,
        bytes calldata ctx
    )
        external
        view
        virtual
        override
        returns (bytes memory /*cbdata*/)
    {
        (address sender,) = abi.decode(agreementData, (address, address));
        require(checkedIn[sender], "You are not checked in!");
        return ctx;
    }

    /*
    * ------------------------------------------------------------
    * Note: Super Apps cannot revert in the termination callback (afterAgreementTerminated())
    * Additionally, there is a gas limit of 30,000. Failure to follow these rules will result in the super app becoming jailed.
    * ------------------------------------------------------------
    */
    function afterAgreementTerminated(
        ISuperToken /*superToken*/,
        address /*agreementClass*/,
        bytes32 /*agreementId*/,
        bytes calldata agreementData,
        bytes calldata /*cbdata*/,
        bytes calldata ctx
    )
        external
        virtual
        override
        returns (bytes memory newCtx)
    {
       (address sender,) = abi.decode(agreementData, (address, address));
        newCtx = _updateOutflow(ctx);
        checkedIn[sender] = false;
    }
    

}