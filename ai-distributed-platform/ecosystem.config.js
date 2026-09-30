module.exports = {
    apps: [
        {
            name: "ai-platform",
            script: "./backend/server.js"
        },
        {
            name: "worker-1",
            script: "./backend/worker.js",
            args: "WORKER-1"
        },
        {
            name: "worker-2",
            script: "./backend/worker.js",
            args: "WORKER-2"
        },
        {
            name: "worker-3",
            script: "./backend/worker.js",
            args: "WORKER-3"
        }
    ]
};