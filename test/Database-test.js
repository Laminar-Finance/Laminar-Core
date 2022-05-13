const { expect } = require("chai");
const { ethers } = require("hardhat");

describe.only("Database", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;

  let daix;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];

    daix = { address: accounts[9].address };
  });

  it("Should generate and store unique client ids", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    let clients = await pr.getGateIds(admin.address);
    expect(clients.length).to.equal(0);

    await pr.addGate("harthorn gym", 1);
    await pr.addGate("belgrave gym", 2);
    await pr.addGate("frankston gym", 3);

    clients = await pr.getGateIds(admin.address);
    expect(clients.length).to.equal(3);

    await pr.addGate("kooyong gym", 4);
    clients = await pr.getGateIds(admin.address);
    expect(clients.length).to.equal(4);
    expect(new Set(clients).size).to.equal(4);
  });

  it("Should store and get gate details", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    await pr.addGate("bike 1", 1);

    const gate = (await pr.getGates(admin.address))[0];

    expect(gate.name).to.equal("bike 1");
  });

  it("Should show payee address when given a client id", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    await pr.addGate("truck 1", 4);
    await pr.addGate("truck 2", 5);
    const clients = await pr.getGateIds(admin.address);
    let clientAddress = await pr.getAddress(clients[0]);
    expect(clientAddress).to.equal(admin.address);

    clientAddress = await pr.getAddress(clients[1]);
    expect(clientAddress).to.equal(admin.address);

    const antPR = pr.connect(ant);
    clientAddress = await antPR.getAddress(clients[1]);
    expect(clientAddress).to.equal(admin.address);
  });

  it("Should prevent duplicate gate names for the same payee address", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    await pr.addGate("truck 1", 4);
    await expect(pr.addGate("truck 1", 4)).to.be.reverted;
    await expect(pr.addGate("truck 1", 1)).to.be.reverted;
    await expect(pr.addGate("truck 1", 0)).to.be.reverted;
    await expect(pr.addGate("truck 2", 1)).not.to.be.reverted;

    const antPR = pr.connect(ant);
    await expect(antPR.addGate("truck 1", 4)).not.to.be.reverted;
  });

  it("Should add client ids for the sender", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(daix.address);
    await pr.deployed();

    const antPR = pr.connect(ant);
    await antPR.addGate("truck 1", 1);
    await antPR.addGate("truck 2", 1);
    let antClients = await pr.getGateIds(ant.address);
    expect(antClients.length).to.equal(2);

    const beetlePR = pr.connect(beetle);
    await beetlePR.addGate("car 1", 1);
    await beetlePR.addGate("car 2", 1);
    await beetlePR.addGate("car 3", 2);
    await beetlePR.addGate("car 4", 1);

    const beetleClients = await pr.getGateIds(beetle.address);
    expect(beetleClients.length).to.equal(4);
    antClients = await pr.getGateIds(ant.address);
    expect(antClients.length).to.equal(2);
  });
});
