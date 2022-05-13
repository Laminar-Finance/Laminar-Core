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

describe.only("Database", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;

  let sf;
  let daix;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];

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

  it("Should generate and store unique client ids", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    let clients = await pr.getGateways(admin.address);
    expect(clients.length).to.equal(0);

    await pr.addGate("harthorn gym", 1);
    await pr.addGate("belgrave gym", 2);
    await pr.addGate("frankston gym", 3);

    clients = await pr.getGateways(admin.address);
    expect(clients.length).to.equal(3);

    await pr.addGate("kooyong gym", 4);
    clients = await pr.getGateways(admin.address);
    expect(clients.length).to.equal(4);
    expect(new Set(clients).size).to.equal(4);
  });

  it("Should show associated address when given a client id", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    await pr.addGate("truck 1", 4);
    await pr.addGate("truck 2", 5);
    const clients = await pr.getGateways(admin.address);
    let clientAddress = await pr.getAddress(clients[0]);
    expect(clientAddress).to.equal(admin.address);

    clientAddress = await pr.getAddress(clients[1]);
    expect(clientAddress).to.equal(admin.address);
  });

  it("Should add client ids for the sender", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    const antPR = pr.connect(ant);
    await antPR.addGate("truck 1", 1);
    await antPR.addGate("truck 2", 1);
    let antClients = await pr.getGateways(ant.address);
    expect(antClients.length).to.equal(2);

    const beetlePR = pr.connect(beetle);
    await beetlePR.addGate("car 1", 1);
    await beetlePR.addGate("car 2", 1);
    await beetlePR.addGate("car 3", 2);
    await beetlePR.addGate("car 4", 1);

    const beetleClients = await pr.getGateways(beetle.address);
    expect(beetleClients.length).to.equal(4);
    antClients = await pr.getGateways(ant.address);
    expect(antClients.length).to.equal(2);
  });
});
