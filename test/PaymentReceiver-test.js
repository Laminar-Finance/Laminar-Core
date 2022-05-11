const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentReceiver", function () {
  it("Should generate unique client ids each time a client id is generated", async function () {
    const PR = await ethers.getContractFactory("PaymentReceiver");
    const pr = await PR.deploy();
    await pr.deployed();

    const clientId = await pr.addClient();
    const clientId2 = await pr.addClient();
    const clientId3 = await pr.addClient();

    expect(clientId).not.to.equal(clientId2);
    expect(clientId).not.to.equal(clientId3);
    expect(clientId2).not.to.equal(clientId3);
  });
});
