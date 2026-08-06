const knex = require('knex')(require('./knexfile').production);
async function run() {
    try {
        const res = await knex.raw('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'positions\'');
        console.log(res.rows);
    } catch(e) { console.error(e) }
    process.exit(0);
}
run();
