const redis = require("redis");

console.log("Loading Redis Client...");

const client = redis.createClient({
    url: "redis://localhost:9000"
});

client.on("error", (err) => {
    console.log("Redis Error:", err);
});

(async () => {
    try {
        await client.connect();
        console.log("Redis Connected");
    } catch (err) {
        console.log("Redis Connection Failed:", err);
    }
})();

module.exports = client;