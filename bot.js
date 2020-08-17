require("dotenv").config();
const Web3 = require("web3");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
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
  upsertGasSpending
} = require("./src/utils/utils.js");


async function fetchGasSpenings() {
  try {
    console.log("Started fetching gas Spendings...");
    let scheme = await schemeDB.get("schemes").value();
    let filter = { "_organization:": process.env.AVATAR_ADDRESS};

    let genesisVotes = await getEvents(
      contracts.GenesisProtocol.address,
      process.env.STARTING_BLOCK,
      "VoteProposal",
      filter,
      contracts.GenesisProtocol.abi
    );
    
    let genesisStakes = await getEvents(
      contracts.GenesisProtocol.address,
      process.env.STARTING_BLOCK,
      "Stake",
      filter,
      contracts.GenesisProtocol.abi
    );
    
    console.log(`Found ${genesisVotes.events.length} vote & ${genesisStakes.events.length} staking transactions on Genesis Protocol `)

    for (var i in genesisVotes.events) {
      var receipt = await web3.eth.getTransactionReceipt(genesisVotes.events[i].transactionHash)
      if(receipt.status){
        upsertGasSpending(
          { id: genesisVotes.events[i].transactionHash },
          {
            id: genesisVotes.events[i].transactionHash,
            proposalId: genesisVotes.events[i].returnValues._proposalId,
            transactionHash: genesisVotes.events[i].transactionHash,
            voter: genesisVotes.events[i].returnValues._voter,
            scheme: "Genesis Protocol"
          });
      }
    }

    for (var i in genesisStakes.events) {
      var receipt = await web3.eth.getTransactionReceipt(genesisStakes.events[i].transactionHash)
      if(receipt.status){
          upsertGasSpending(
          { id: genesisStakes.events[i].transactionHash },
          {
            id: genesisStakes.events[i].transactionHash,
            proposalId: genesisStakes.events[i].returnValues._proposalId,
            transactionHash: genesisStakes.events[i].transactionHash,
            voter: genesisStakes.events[i].returnValues._staker,
            scheme: "Genesis Protocol"
          });
        }
    }
    
    for (var j in scheme) {
      await sleep(1000);
      console.log(`Searching for transaction on Scheme ${scheme[j].name}...`)
      
      if(scheme[j].votingMachineAddress){
       
        const votes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          "VoteProposal",
          filter,
          JSON.parse(scheme[j].votingMachineAbi)
        );

        
        const stakes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          "Stake",
          filter,
          JSON.parse(scheme[j].votingMachineAbi)
        );
        
        console.log(`Found ${votes.events.length} vote & ${stakes.events.length} staking transactions on ${scheme[j].name} `)
        
        for (var i in votes.events) {
          var receipt = await web3.eth.getTransactionReceipt(votes.events[i].transactionHash)
          if(receipt.status){
            upsertGasSpending(
              { id: votes.events[i].transactionHash },
              {
                id: votes.events[i].transactionHash,
                proposalId: votes.events[i].returnValues._proposalId,
                transactionHash: votes.events[i].transactionHash,
                voter: votes.events[i].returnValues._voter,
                scheme: scheme[j].name
              }
            );
          }
        }
    
        for (var i in stakes.events) {
          var receipt = await web3.eth.getTransactionReceipt(stakes.events[i].transactionHash)
          if(receipt.status){
            upsertGasSpending(
              { id: stakes.events[i].transactionHash },
              {
                id: stakes.events[i].transactionHash,
                proposalId: stakes.events[i].returnValues._proposalId,
                transactionHash: stakes.events[i].transactionHash,
                voter: stakes.events[i].returnValues._voter,
                scheme: scheme[j].name
              }
            );
          }
        }
        
      }
      
    }

    console.log(`Finished. Transaction have been written in gasSpendings.json`)
    
  } catch (err) {
    console.log(err);
  }
}

fetchGasSpenings();