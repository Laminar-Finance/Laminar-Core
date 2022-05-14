const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Database", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;

  let fauxDiax;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];

    fauxDiax = { address: accounts[9].address };
  });

  it("Should generate and store unique client ids", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
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
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("bike 1", 2);
    await pr.addGate("bike 2", 3);

    let gate = (await pr.getGates(admin.address))[0];
    expect(gate.name).to.equal("bike 1");
    expect(gate.flowRate).to.equal(2);
    expect(gate.payee).to.equal(admin.address);

    gate = (await pr.getGates(admin.address))[1];
    expect(gate.name).to.equal("bike 2");
    expect(gate.flowRate).to.equal(3);
    expect(gate.payee).to.equal(admin.address);

    const antPR = pr.connect(ant);
    gate = (await antPR.getGates(admin.address))[0];
    expect(gate.name).to.equal("bike 1");
    expect(gate.payee).to.equal(admin.address);
  });

  it("Should show payee address when given a client id", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
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
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("truck 1", 4);
    await expect(pr.addGate("truck 1", 4)).to.be.reverted;
    await expect(pr.addGate("truck 1", 1)).to.be.reverted;
    await expect(pr.addGate("truck 1", 0)).to.be.reverted;
    await expect(pr.addGate("truck 2", 1)).not.to.be.reverted;

    const antPR = pr.connect(ant);
    await expect(antPR.addGate("truck 1", 4)).not.to.be.reverted;
  });

  it("Should delete gates", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("truck 1", 4);

    let gateIds = await pr.getGateIds(admin.address);
    expect(gateIds.length).to.equal(1);
    const gateId = gateIds[0];

    let gate = await pr.getGate(gateId);
    expect(gate.payee).to.equal(admin.address);

    await pr.deleteGate(gateId);
    gateIds = await pr.getGateIds(admin.address);
    expect(gateIds.length).to.equal(0);

    gate = await pr.getGate(gateId);
    expect(gate.payee).to.equal("0x0000000000000000000000000000000000000000");

    await pr.addGate("truck 1", 1);
    await pr.addGate("truck 2", 2);
    await pr.addGate("truck 3", 3);
    await pr.addGate("truck 4", 1);
    gateIds = await pr.getGateIds(admin.address);
    expect(gateIds.length).to.equal(4);

    await pr.deleteGate(gateIds[1]);
    await pr.deleteGate(gateIds[2]);
    gateIds = await pr.getGateIds(admin.address);
    expect(gateIds.length).to.equal(2);

    gate = await pr.getGate(gateIds[0]);
    expect(gate.payee).to.equal(admin.address);
    expect(gate.name).to.equal("truck 1");

    gate = await pr.getGate(gateIds[1]);
    expect(gate.payee).to.equal(admin.address);
    expect(gate.name).to.equal("truck 4");
  });

  it("Should rename gates", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("server #7356", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];
    let gate = await pr.getGate(gateId);
    expect(gate.name).to.equal("server #7356");

    await pr.renameGate(gateId, "server #1");
    gate = await pr.getGate(gateId);
    expect(gate.name).to.equal("server #1");
  });

  it("Should prevent renaming to existing gates", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("server #7356", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];
    await pr.addGate("server #77", 1);

    await expect(pr.renameGate(gateId, "server #77")).to.be.reverted;
  });

  it("Should prevent renaming of nonexistant gates", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await expect(pr.renameGate(32473472, "server #77")).to.be.reverted;
  });

  it("Should prevent gate deletion by another address", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("truck 1", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];

    const antPR = pr.connect(ant);
    await expect(antPR.deleteGate(gateId)).to.be.revertedWith(
      "cannot delete gate belonging to another merchant"
    );
  });

  it.only("Should prevent gate renaming by another address", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("truck 1", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];

    const antPR = pr.connect(ant);
    await expect(antPR.renameGate(gateId, "antGate")).to.be.revertedWith(
      "cannot rename gate belonging to another merchant"
    );
  });

  it("Should prevent double deletion", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await expect(pr.deleteGate(93242342)).to.be.revertedWith(
      "cannot delete nonexistant gate"
    );

    await pr.addGate("truck 1", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];

    await pr.deleteGate(gateId);

    await expect(pr.deleteGate(gateId)).to.be.revertedWith(
      "cannot delete nonexistant gate"
    );
  });

  it("Should prevent deletion by other merchants", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
    await pr.deployed();

    await pr.addGate("truck 1", 1);
    const gateId = (await pr.getGateIds(admin.address))[0];
    const antPR = pr.connect(ant);

    await expect(antPR.deleteGate(gateId)).to.be.revertedWith(
      "cannot delete gate belonging to another merchant"
    );
  });

  it("Should add client ids for the sender", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy(fauxDiax.address);
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
