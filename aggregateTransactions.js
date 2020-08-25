require("dotenv").config();
const Web3 = require("web3");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
const overallSpendingAdapter = new FileSync("./src/data/overallSpendings.json");
const overallSpendingsDB = low(overallSpendingAdapter);
const schemeAdapter = new FileSync("./src/data/schemes.json");
const schemeDB = low(schemeAdapter);
const { contracts } = require("./src/data/baseContracts.js");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURAKEY}`
  )
);
const {
  getEvents,
  upsertGasSpending,
  upsertAccountGasSpending,
} = require("./src/utils/utils.js");

async function aggregateData() {
  const AccountGasSpendingAdapter = new FileSync(
    "./src/data/accountGasSpendings.json"
  );
  const AccountGasSpendingsDB = low(AccountGasSpendingAdapter);
  console.log("Starting to aggregate data");

  let overallVotesSpending = 0,
    overallStakingsSpending = 0,
    overallProposalCreationsSpending = 0,
    overallVotes = 0,
    overallStakings = 0,
    overallProposal = 0,
    reimbursementVotes = 0,
    reimbursementStakings = 0,
    reimbursementProposalCreations = 0;

  let uniqueAccounts = await AccountGasSpendingsDB.get(
    "accountGasSpendings"
  ).value();
  let votes, stakings, proposals;
  let votesSpending = 0,
    stakingSpending = 0,
    proposalCreationsSpending = 0;

  for (var u in uniqueAccounts) {
    votes = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[u].id, action: "voting" })
      .value();
    stakings = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[u].id, action: "staking" })
      .value();
    proposals = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[u].id, action: "proposalCreation" })
      .value();

    for (var v in votes) {
      votesSpending = votesSpending + votes[v].gasTotal;
    }
    for (var s in stakings) {
      stakingSpending = stakingSpending + stakings[s].gasTotal;
    }

    for (var p in proposals) {
      proposalCreationsSpending =
        proposalCreationsSpending + proposals[p].gasTotal;
    }

    (overallVotesSpending = overallVotesSpending + votesSpending),
      (overallStakingsSpending = overallStakingsSpending + stakingSpending),
      (overallProposalCreationsSpending =
        overallProposalCreationsSpending + proposalCreationsSpending),
      (overallVotes = overallVotes + votes.length),
      (overallStakings = overallStakings + stakings.length),
      (overallProposal = overallProposal + proposals.length);

    upsertAccountGasSpending(
      { id: uniqueAccounts[u].id },
      {
        totalVotes: votes.length,
        votesSpending: votesSpending,
        totalStakings: stakings.length,
        stakingSpending: stakingSpending,
        totalProposalCreations: proposals.length,
        proposalCreationSpending: proposalCreationsSpending,
      }
    );
  }

  await overallSpendingsDB
    .get("overallSpendings")
    .push({
      id: "overall",
      overallVotesSpending: overallVotesSpending,
      overallStakingsSpending: overallStakingsSpending,
      overallProposalCreationsSpending: overallProposalCreationsSpending,
      overallVotes: overallVotes,
      overallStakings: overallStakings,
      overallProposal: overallProposal,
    })
    .write();

  console.log(
    `Finished... written aggregated data to ./data/accountGasSpendings.json...`
  );
}

aggregateData();
