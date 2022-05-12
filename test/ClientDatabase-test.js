const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Database", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];
  });

  it("Should generate and store unique client ids", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy();
    await pr.deployed();

    let clients = await pr.getGateway(admin.address);
    expect(clients.length).to.equal(0);

    await pr.addGateway();
    await pr.addGateway();
    await pr.addGateway();

    clients = await pr.getGateway(admin.address);
    expect(clients.length).to.equal(3);

    await pr.addGateway();
    clients = await pr.getGateway(admin.address);
    expect(clients.length).to.equal(4);
    expect(new Set(clients).size).to.equal(4);
  });

  it("Should prevent more than 128 client ids per address", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy();
    await pr.deployed();

    for (let index = 0; index < 128; index++) {
      await pr.addGateway();
    }

    let clients = await pr.getGateway(admin.address);
    expect(clients.length).to.equal(128);

    await pr.addGateway();
    await pr.addGateway();
    await pr.addGateway();

    clients = await pr.getGateway(admin.address);
    expect(clients.length).to.equal(128);
  });

  it("Should show associated address when given a client id", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy();
    await pr.deployed();

    await pr.addGateway();
    await pr.addGateway();
    const clients = await pr.getGateway(admin.address);
    let clientAddress = await pr.getAddress(clients[0]);
    expect(clientAddress).to.equal(admin.address);

    clientAddress = await pr.getAddress(clients[1]);
    expect(clientAddress).to.equal(admin.address);
  });

  it("Should add client ids for the sender", async function () {
    const PR = await ethers.getContractFactory("Database");
    const pr = await PR.deploy();
    await pr.deployed();

    const antPR = pr.connect(ant);
    await antPR.addGateway();
    await antPR.addGateway();
    let antClients = await pr.getGateway(ant.address);
    expect(antClients.length).to.equal(2);

    const beetlePR = pr.connect(beetle);
    await beetlePR.addGateway();
    await beetlePR.addGateway();
    await beetlePR.addGateway();
    await beetlePR.addGateway();

    const beetleClients = await pr.getGateway(beetle.address);
    expect(beetleClients.length).to.equal(4);
    antClients = await pr.getGateway(ant.address);
    expect(antClients.length).to.equal(2);
  });
});
