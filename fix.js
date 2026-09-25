const fs = require("fs");
let content = fs.readFileSync("backend/services/triggerEngine.js", "utf8");
const tick = String.fromCharCode(96);
const search = "if (realizedPnl !== 0) {";
const contextSearch = "user_id: order.user_id, amount: realizedPnl, type: 'REALIZED_PNL', description: " + tick + "Realized P&L for exiting holding";
if (content.indexOf(contextSearch) !== -1) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("if (realizedPnl !== 0) {") && lines[i+1] && lines[i+1].includes("await trx('ledger').insert") && lines[i+2] && lines[i+2].includes("Realized P&L for exiting holding")) {
            lines.splice(i, 0, "                        await trx('orders').where({ id: order.id }).update({ realized_pnl: realizedPnl });");
            break;
        }
    }
    fs.writeFileSync("backend/services/triggerEngine.js", lines.join("\n"));
}
