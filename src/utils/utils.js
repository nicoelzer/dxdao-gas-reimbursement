require("dotenv").config();
const got = require("got");
const Web3 = require("web3");
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURAKEY}`
  )
);
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const schemeAdapter = new FileSync("./src/data/schemes.json");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
const AccountGasSpendingAdapter = new FileSync(
  "./src/data/accountGasSpendings.json"
);
const AccountGasSpendingsDB = low(AccountGasSpendingAdapter);
const schemeDB = low(schemeAdapter);

async function getEvents(
  contractAddress,
  startBlock,
  endBlock,
  eventName,
  filter,
  contractAbi
) {
  const contract = new web3.eth.Contract(contractAbi, contractAddress);
  var events = await contract.getPastEvents(eventName, {
    filter: filter,
    fromBlock: startBlock,
    toBlock: endBlock,
  });
  return { events: events };
}

function schemeExists(filter) {
  return schemeDB.get("schemes").find(filter).value() ? true : false;
}

function getSingleScheme(filter) {
  return schemeDB.get("schemes").find(filter).value();
}

function updateScheme(filter, update) {
  schemeDB.get("schemes").chain().find(filter).assign(update).write();
}

function gasSpendingExists(filter) {
  return gasSpendingsDB.get("gasSpendings").find(filter).value() ? true : false;
}

function upsertGasSpending(filter, upsert) {
  if (!gasSpendingExists(filter)) {
    gasSpendingsDB.get("gasSpendings").push(upsert).write();
    return "Insert";
  } else {
    gasSpendingsDB
      .get("gasSpendings")
      .chain()
      .find(filter)
      .assign(upsert)
      .write();
    return "Update";
  }
}

function upsertScheme(filter, upsert) {
  if (!schemeExists(filter)) {
    schemeDB.get("schemes").push(upsert).write();
    return "Insert";
  } else {
    schemeDB.get("schemes").chain().find(filter).assign(upsert).write();
    return "Update";
  }
}

function accountGasSpendingExists(filter) {
  return AccountGasSpendingsDB.get("accountGasSpendings").find(filter).value()
    ? true
    : false;
}

function upsertAccountGasSpending(filter, upsert) {
  if (!accountGasSpendingExists(filter)) {
    AccountGasSpendingsDB.get("accountGasSpendings").push(upsert).write();
    return "Insert";
  } else {
    AccountGasSpendingsDB.get("accountGasSpendings")
      .chain()
      .find(filter)
      .assign(upsert)
      .write();
    return "Update";
  }
}

module.exports = {
  getEvents,
  schemeExists,
  getSingleScheme,
  updateScheme,
  upsertScheme,
  upsertGasSpending,
  upsertAccountGasSpending,
};
