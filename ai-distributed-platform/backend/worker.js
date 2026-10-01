const http = require("http");

const workerId = process.env.WORKER_ID || "WORKER-1";
const HOST = "127.0.0.1";
const PORT = 5001;

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);

        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            }
        }, (res) => {
            let response = "";

            res.on("data", chunk => {
                response += chunk;
            });

            res.on("end", () => {
                let result = null;

                try {
                    result = response ? JSON.parse(response) : null;
                } catch {
                    result = response;
                }

                resolve({
                    statusCode: res.statusCode,
                    result: result
                });
            });
        });

        req.on("error", reject);
        req.write(data);
        req.end();
    });
}

async function claimTask() {
    try {
        const result = await post("/api/tasks/claim", {
            workerId: workerId
        });

        if (result.statusCode !== 200 || !result.result) {
            console.log(`No queued task for ${workerId}`);
            return;
        }

        const task = result.result;

        console.log(`CLAIMED: Task ${task.id}`);
        console.log(`EXECUTING: ${task.task}`);

        setTimeout(async () => {
            try {
                const completed = await post("/api/tasks/complete", {
                    taskId: task.id,
                    workerId: workerId,
                    status: "completed"
                });

                if (completed.statusCode === 200) {
                    console.log(`COMPLETED: Task ${task.id}`);
                } else {
                    console.log("COMPLETE FAILED:", completed.result);
                }
            } catch (error) {
                console.log("COMPLETE ERROR:", error.message);
            }
        }, 3000);

    } catch (error) {
        console.log("WORKER ERROR:", error.message);
    }
}

console.log("================================");
console.log(`Worker started: ${workerId}`);
console.log("================================");

claimTask();
setInterval(claimTask, 5000);
