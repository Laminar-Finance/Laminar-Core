pragma solidity ^0.8.11;

import "./SuperGate.sol";

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { ISuperToken, ISuperfluid } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


contract Database{
    ISuperfluid private host; // host
    IConstantFlowAgreementV1 private cfa; // the stored constant flow agreement class
    mapping(address => SuperGate) private addressToGate;

    constructor(address _host, address _cfa){
        host = ISuperfluid(_host);
        cfa = IConstantFlowAgreementV1(_cfa);
    }

    function addGate(string calldata _name, int96 _flowRate, ISuperToken _token) external returns (address){
        SuperGate.Gate memory gate = SuperGate.Gate(_name, msg.sender, _token, _flowRate);
        SuperGate newGate = new SuperGate(host, cfa, gate);
        addressToGate[msg.sender] = newGate;
        return address(newGate);
    }

    // Remove gate, calls function in SuperGate that will selfdestruct the conract
    /*
    function deleteGate(address _gate) external {
        
    }
    */
}