const fs = require("fs");

let accountGasSpendings = {
  accountGasSpendings: [],
};

let gasSpendings = {
  gasSpendings: [],
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
