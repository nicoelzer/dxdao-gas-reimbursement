require("dotenv").config();
const Web3 = require("web3");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
const AccountGasSpendingAdapter = new FileSync(
  "./src/data/accountGasSpendings.json"
);
const AccountGasSpendingsDB = low(AccountGasSpendingAdapter);
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

async function fetchGasSpenings() {
  try {
    console.log("Started fetching gas Spendings...");
    let scheme = await schemeDB.get("schemes").value();
    let filter = { _organization: process.env.AVATAR_ADDRESS };
    let latestBlock = await web3.eth.getBlockNumber();
    let votingMachines = [];
    for (var j in scheme) {
      if (
        !votingMachines.includes(scheme[j].votingMachineAddress) &&
        scheme[j].votingMachineAddress
      ) {
        let latestBlock = await web3.eth.getBlockNumber();
        let orgFilter = { _organization: process.env.AVATAR_ADDRESS };

        if (scheme[j].votingMachineAddress) {
          votingMachines.push(scheme[j].votingMachineAddress);
          const votes = await getEvents(
            scheme[j].votingMachineAddress,
            process.env.STARTING_BLOCK,
            process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
            "VoteProposal",
            orgFilter,
            JSON.parse(scheme[j].votingMachineAbi)
          );

          const stakes = await getEvents(
            scheme[j].votingMachineAddress,
            process.env.STARTING_BLOCK,
            process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
            "Stake",
            orgFilter,
            JSON.parse(scheme[j].votingMachineAbi)
          );

          const proposalCreations = await getEvents(
            scheme[j].votingMachineAddress,
            process.env.STARTING_BLOCK,
            process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
            "NewProposal",
            orgFilter,
            JSON.parse(scheme[j].votingMachineAbi)
          );

          console.log(
            `Found ${votes.events.length} vote, ${stakes.events.length} staking & ${proposalCreations.events.length} proposalCreation transactions on ${scheme[j].name} (Voting Machine)`
          );

          for (var i in votes.events) {
            var receipt = await web3.eth.getTransactionReceipt(
              votes.events[i].transactionHash
            );
            var tx = await web3.eth.getTransaction(
              votes.events[i].transactionHash
            );
            var block = await web3.eth.getBlock(votes.events[i].blockNumber);

            upsertAccountGasSpending(
              { id: votes.events[i].returnValues._voter },
              { id: votes.events[i].returnValues._voter }
            );

            if (receipt.status) {
              upsertGasSpending(
                { id: votes.events[i].transactionHash },
                {
                  id: votes.events[i].transactionHash,
                  proposalId: votes.events[i].returnValues._proposalId,
                  transactionHash: votes.events[i].transactionHash,
                  from: votes.events[i].returnValues._voter,
                  gas: receipt.gasUsed,
                  gasPrice: parseInt(tx.gasPrice),
                  gasTotal: receipt.gasUsed * tx.gasPrice,
                  action: "voting",
                  timestamp: block.timestamp,
                }
              );
            }
          }

          for (var i in proposalCreations.events) {
            var receipt = await web3.eth.getTransactionReceipt(
              proposalCreations.events[i].transactionHash
            );
            var tx = await web3.eth.getTransaction(
              proposalCreations.events[i].transactionHash
            );
            var block = await web3.eth.getBlock(
              proposalCreations.events[i].blockNumber
            );

            upsertAccountGasSpending({ id: tx.from }, { id: tx.from });

            if (receipt.status) {
              upsertGasSpending(
                { id: proposalCreations.events[i].transactionHash },
                {
                  id: proposalCreations.events[i].transactionHash,
                  proposalId:
                    proposalCreations.events[i].returnValues._proposalId,
                  transactionHash: proposalCreations.events[i].transactionHash,
                  from: tx.from,
                  gas: receipt.gasUsed,
                  gasPrice: parseInt(tx.gasPrice),
                  gasTotal: receipt.gasUsed * tx.gasPrice,
                  action: "proposalCreation",
                  timestamp: block.timestamp,
                }
              );
            }
          }

          for (var i in stakes.events) {
            var receipt = await web3.eth.getTransactionReceipt(
              stakes.events[i].transactionHash
            );
            var tx = await web3.eth.getTransaction(
              stakes.events[i].transactionHash
            );
            var block = await web3.eth.getBlock(stakes.events[i].blockNumber);

            upsertAccountGasSpending(
              { id: stakes.events[i].returnValues._staker },
              { id: stakes.events[i].returnValues._staker }
            );

            if (receipt.status) {
              upsertGasSpending(
                { id: stakes.events[i].transactionHash },
                {
                  id: stakes.events[i].transactionHash,
                  proposalId: stakes.events[i].returnValues._proposalId,
                  transactionHash: stakes.events[i].transactionHash,
                  from: stakes.events[i].returnValues._staker,
                  gas: receipt.gasUsed,
                  gasPrice: parseInt(tx.gasPrice),
                  gasTotal: receipt.gasUsed * tx.gasPrice,
                  action: "staking",
                  timestamp: block.timestamp,
                }
              );
            }
          }
        }
      } else {
        console.log(
          `Skipping ${scheme[j].name} – voting machine already scanned.`
        );
      }
    }

    console.log(
      `Transactions written to ./data/gasSpendings.json aggregating data now....`
    );
  } catch (err) {
    console.log(err);
  }
}

async function aggregateData() {
  let uniqueAccounts = await AccountGasSpendingsDB.get(
    "accountGasSpendings"
  ).value();

  for (var i in uniqueAccounts) {
    let votes = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[i].id, action: "voting" })
      .value();
    let stakings = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[i].id, action: "staking" })
      .value();
    let proposals = await gasSpendingsDB
      .get("gasSpendings")
      .filter({ from: uniqueAccounts[i].id, action: "proposalCreation" })
      .value();

    let votesSpending = 0,
      stakingSpending = 0,
      proposalCreationsSpending = 0;
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

    upsertAccountGasSpending(
      { id: uniqueAccounts[i].id },
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
  console.log(
    `Finished... written aggregated data to ./data/accountGasSpendings.json...`
  );
}

async function runScript() {
  await fetchGasSpenings();
  await sleep(1000);
  aggregateData();
}

runScript();
