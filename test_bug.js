const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database/shortmarket.db');

db.serialize(() => {
  db.all("SELECT * FROM positions", (err, rows) => {
    console.log("Positions:", rows);
  });
  db.all("SELECT * FROM orders", (err, rows) => {
    console.log("Orders:", rows);
  });
});
