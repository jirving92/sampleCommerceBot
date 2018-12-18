/**
 * botConnection connects to the SQL DB,
 * then retrieves the list of all books
 * that correspond to the class that
 * was selected
 */

const configFile = require("./config");
var Connection = require("tedious").Connection;
var Request = require("tedious").Request;
var TYPES = require("tedious").TYPES;

// Variables to hold array of books
var bioBooks = [];
var bioBooksPrices = [];
var psychBooks = [];
var psychBooksPrices = [];
var mathBooks = [];
var mathBooksPrices = [];
var computerScienceBooks = [];
var computerScienceBooksPrices = [];
var supplies = [];
var suppliesPrices = [];

var config = {
  userName: configFile.sqlUsername,
  password: configFile.sqlPassword,
  server: configFile.sqlServerName,
  // If you are on Microsoft Azure, you need this:
  options: { encrypt: true, database: configFile.sqlDatabaseName }
};

/**
 * Setting up connections for each different query.
 * Tedious can only do one function per connection,
 * which is why multiple connections need to be made
 */
var bioConnection = new Connection(config);
var mathConnection = new Connection(config);
var psychConnection = new Connection(config);
var csConnection = new Connection(config);
var supplyConnection = new Connection(config);

/**
 *
 * @param {String} courseName
 * Runs the query, and adds the available
 * books to the array
 */

function executedStatement(courseName) {
  request = new Request(
    `SELECT dbo.Book.name, dbo.Book.price FROM dbo.Class 
    LEFT JOIN dbo.Book
    ON dbo.Class.pk_class_id = dbo.Book.fk_class_id AND
    dbo.Class.name = '${courseName}';`,
    function(err) {
      if (err) {
        console.log(err);
      }
    }
  );
  request.on("row", function(columns) {
    columns.forEach(function(column) {
      if (column.value === null) {
      } else {
        if (courseName === "biology") {
          if (column.metadata.colName === "price")
            bioBooksPrices.push(column.value);
          else bioBooks.push(column.value);
        } else if (courseName === "math") {
          if (column.metadata.colName === "price")
            mathBooksPrices.push(column.value);
          else mathBooks.push(column.value);
        } else if (courseName === "psychology") {
          if (column.metadata.colName === "price")
            psychBooksPrices.push(column.value);
          else psychBooks.push(column.value);
        } else if (courseName === "computer science") {
          if (column.metadata.colName === "price")
            computerScienceBooksPrices.push(column.value);
          else computerScienceBooks.push(column.value);
        }
      }
    });
  });
  if (courseName === "biology") {
    bioConnection.execSql(request);
  } else if (courseName === "math") {
    mathConnection.execSql(request);
  } else if (courseName === "psychology") {
    psychConnection.execSql(request);
  } else if (courseName === "computer science") {
    csConnection.execSql(request);
  }
}

//Gets list of school supplies
function getSupplies() {
  request = new Request(
    `SELECT dbo.AddOns.name, dbo.AddOns.price FROM dbo.AddOns;`,
    function(err) {
      if (err) {
        console.log(err);
      }
    }
  );
  request.on("row", function(columns) {
    columns.forEach(function(column) {
      if (column.value === null) {
      } else {
        if (column.metadata.colName === "price")
          suppliesPrices.push(column.value);
        else supplies.push(column.value);
      }
    });
  });
  supplyConnection.execSql(request);
}

// Class that runs the connection function
class BotConnection {
  Connection() {
    bioConnection.on("connect", function(err) {
      console.log("Connected to Bio");
      executedStatement("biology");
    });
    mathConnection.on("connect", function(err) {
      console.log("Connected to Math");
      executedStatement("math");
    });
    psychConnection.on("connect", function(err) {
      console.log("Connected to Psych");
      executedStatement("psychology");
    });

    csConnection.on("connect", function(err) {
      console.log("Connected to Comp Sci");
      executedStatement("computer science");
    });

    supplyConnection.on("connect", function(err) {
      console.log("Connected to supplies");
      getSupplies();
    });
  }
}

exports.BotConnection = BotConnection;
exports.bioBooks = bioBooks;
exports.bioBooksPrices = bioBooksPrices;
exports.mathBooks = mathBooks;
exports.mathBooksPrices = mathBooksPrices;
exports.psychBooks = psychBooks;
exports.psychBooksPrices = psychBooksPrices;
exports.computerScienceBooks = computerScienceBooks;
exports.computerScienceBooksPrices = computerScienceBooksPrices;
exports.supplies = supplies;
exports.suppliesPrices = suppliesPrices;
