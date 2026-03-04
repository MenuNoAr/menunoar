import pg from 'pg';
const { Client } = pg;

const connectionString = process.argv[2];
const sql = process.argv[3];

if (!connectionString || !sql) {
    console.error("Usage: node run-sql.js <connection_string> <sql>");
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(sql);
        console.log(JSON.stringify(res.rows, null, 2));
        if (res.command !== 'SELECT') {
            console.log(`Executed: ${res.command}. Rows affected: ${res.rowCount}`);
        }
    } catch (err) {
        console.error("SQL Error:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
