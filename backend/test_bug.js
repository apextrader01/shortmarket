const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/shortmarket.db');

db.serialize(() => {
  db.all("SELECT * FROM positions", (err, rows) => {
    if (err) console.error("Error positions:", err);
    console.log("Positions:", rows);
  });
  db.all("SELECT * FROM orders", (err, rows) => {
    if (err) console.error("Error orders:", err);
    console.log("Orders:", rows);
  });
});
