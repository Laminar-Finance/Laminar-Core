const { expect } = require("chai");
const { ethers, web3 } = require("hardhat");
const { Framework } = require("@superfluid-finance/sdk-core");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");

const provider = web3;

const errorHandler = (err) => {
  if (err) throw err;
};

describe("PaymentReceiver", function () {
  let accounts;
  let admin;

  let sf;
  let daix;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];

    await deployFramework(errorHandler, {
      web3,
      from: admin.address,
    });

    const fDAIAddress = await deployTestToken(errorHandler, [":", "fDAI"], {
      web3,
      from: admin.address,
    });

    // deploy a fake erc20 wrapper super token around the fDAI token
    const fDAIxAddress = await deploySuperToken(errorHandler, [":", "fDAI"], {
      web3,
      from: admin.address,
    });

    console.log("fDAIxAddress: ", fDAIxAddress);
    console.log("fDAIAddress: ", fDAIAddress);

    sf = await Framework.create({
      networkName: "custom",
      provider,
      dataMode: "WEB3_ONLY",
      resolverAddress: process.env.RESOLVER_ADDRESS,
      protocolReleaseVersion: "test",
    });

    daix = await sf.loadSuperToken("fDAIx");
  });

  it("Should fail to check in if the signer has no money", async function () {
    const PR = await ethers.getContractFactory("PaymentReceiver");
    const pr = await PR.deploy(
      sf.settings.config.hostAddress,
      sf.settings.config.cfaV1Address
    );
    await pr.deployed();

    let clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(0);

    await pr.addClient();

    clients = await pr.getClients(admin.address);
    const clientId = clients[0];

    await expect(pr.checkIn(clientId, daix.address)).to.be.reverted;
  });
});
