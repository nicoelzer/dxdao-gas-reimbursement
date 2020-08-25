const fs = require("fs");

let accountGasSpendings = {
  accountGasSpendings: [],
};

let gasSpendings = {
  gasSpendings: [],
};

let overallSpendings = {
  overallSpendings: [],
};

fs.writeFile(
  "./src/data/accountGasSpendings.json",
  JSON.stringify(accountGasSpendings),
  (err) => {
    if (err) throw err;
    console.log("Reset accountGasSpendings.json");
  }
);

fs.writeFile(
  "./src/data/gasSpendings.json",
  JSON.stringify(gasSpendings),
  (err) => {
    if (err) throw err;
    console.log("Reset gasSpendings.json");
  }
);

fs.writeFile(
  "./src/data/overallSpendings.json",
  JSON.stringify(overallSpendings),
  (err) => {
    if (err) throw err;
    console.log("Reset overallSpendings.json");
  }
);
