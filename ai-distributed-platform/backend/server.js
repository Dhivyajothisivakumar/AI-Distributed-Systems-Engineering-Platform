const express = require("express");
const path = require("path");

const app = express();
const PORT = 5001;

// ================================
// CORS
// ================================

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS"
    );

    next();
});

app.use(express.json());

// ================================
// FRONTEND
// ================================

app.use(
    express.static(
        path.join(__dirname, "../frontend")
    )
);

// ================================
// TASK STORAGE
// ================================

let tasks = [];

// ================================
// WORKER STORAGE
// ================================

let workers = {
    "WORKER-1": {
        status: "online",
        lastHeartbeat: new Date().toISOString()
    },

    "WORKER-2": {
        status: "online",
        lastHeartbeat: new Date().toISOString()
    },

    "WORKER-3": {
        status: "online",
        lastHeartbeat: new Date().toISOString()
    }
};

// ================================
// HOME
// ================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../frontend/index.html"
        )
    );
});

// ================================
// SYSTEM STATUS
// ================================

app.get("/api/status", (req, res) => {
    res.json({
        system: "Online",

        services: 3,

        jobs: tasks.length,

        failed: tasks.filter(
            task => task.status === "failed"
        ).length,

        running: tasks.filter(
            task => task.status === "running"
        ).length,

        queued: tasks.filter(
            task => task.status === "queued"
        ).length,

        completed: tasks.filter(
            task => task.status === "completed"
        ).length,

        workers: Object.keys(workers).length,

        onlineWorkers:
            Object.values(workers).filter(
                worker => worker.status === "online"
            ).length,

        offlineWorkers:
            Object.values(workers).filter(
                worker => worker.status === "offline"
            ).length
    });
});

// ================================
// CREATE TASK
// ================================

app.post("/api/tasks", (req, res) => {
    if (!req.body.task) {
        return res.status(400).json({
            error: "Task is required"
        });
    }

    const newTask = {
        id: `TASK-${tasks.length + 1}`,

        task: req.body.task,

        status: "queued",

        worker: null,

        retries: 0,

        maxRetries: 3,

        createdAt: new Date().toISOString(),

        assignedAt: null,

        completedAt: null,

        failedAt: null,

        lastError: null
    };

    tasks.push(newTask);

    console.log(
        "================================="
    );

    console.log(
        "Created:",
        newTask.id
    );

    console.log(
        `${newTask.id} → QUEUED`
    );

    console.log(
        "================================="
    );

    res.status(201).json(newTask);
});

// ================================
// GET ALL TASKS
// ================================

app.get("/api/tasks", (req, res) => {
    res.json(tasks);
});

// ================================
// CLAIM TASK
// ================================

app.post("/api/tasks/claim", (req, res) => {
    const workerId = req.body.workerId;

    if (!workerId) {
        return res.status(400).json({
            error: "workerId is required"
        });
    }

    // CHECK WORKER

    if (!workers[workerId]) {
        return res.status(404).json({
            error: "Worker not found"
        });
    }

    // CHECK WORKER STATUS

    if (workers[workerId].status !== "online") {
        return res.status(400).json({
            error: "Worker is offline"
        });
    }

    // FIND QUEUED TASK

    const task = tasks.find(
        task => task.status === "queued"
    );

    if (!task) {
        return res.status(404).json({
            message: "No queued tasks"
        });
    }

    // LOCK TASK

    task.status = "running";

    task.worker = workerId;

    task.assignedAt = new Date().toISOString();

    console.log(
        "================================="
    );

    console.log(
        `${workerId} claimed ${task.id}`
    );

    console.log(
        `${task.id} → RUNNING`
    );

    console.log(
        "================================="
    );

    res.json(task);
});

// ================================
// UPDATE TASK STATUS
// ================================

app.put("/api/tasks/:id", (req, res) => {
    const task = tasks.find(
        t => t.id === req.params.id
    );

    if (!task) {
        return res.status(404).json({
            error: "Task not found"
        });
    }

    if (!req.body.status) {
        return res.status(400).json({
            error: "Status is required"
        });
    }

    // WORKER VERIFICATION

    if (
        task.worker &&
        req.body.workerId &&
        task.worker !== req.body.workerId
    ) {
        return res.status(403).json({
            error: "Task belongs to another worker"
        });
    }

    // COMPLETED

    if (req.body.status === "completed") {
        task.status = "completed";

        task.completedAt =
            new Date().toISOString();

        task.lastError = null;

        console.log(
            `${task.id} → COMPLETED`
        );

        return res.json(task);
    }

    // FAILED

    if (req.body.status === "failed") {
        task.retries++;

        task.lastError =
            req.body.error ||
            "Worker execution failed";

        task.failedAt =
            new Date().toISOString();

        console.log(
            `${task.id} → FAILED`
        );

        console.log(
            `Retry count: ${task.retries}/${task.maxRetries}`
        );

        // AUTOMATIC RETRY

        if (
            task.retries <
            task.maxRetries
        ) {
            task.status = "queued";

            task.worker = null;

            task.assignedAt = null;

            console.log(
                `${task.id} → RETRY QUEUED`
            );

            return res.json({
                ...task,
                message: "Task queued for retry"
            });
        }

        // FINAL FAILURE

        task.status = "failed";

        console.log(
            `${task.id} → FINAL FAILED`
        );

        return res.json(task);
    }

    // OTHER STATUS

    task.status = req.body.status;

    console.log(
        `${task.id} → ${task.status}`
    );

    res.json(task);
});

// ================================
// WORKER HEARTBEAT
// ================================

app.post(
    "/api/workers/heartbeat",
    (req, res) => {
        const workerId =
            req.body.workerId;

        if (!workerId) {
            return res.status(400).json({
                error: "workerId is required"
            });
        }

        // CREATE WORKER IF NOT EXISTS

        if (!workers[workerId]) {
            workers[workerId] = {
                status: "online",
                lastHeartbeat: null
            };
        }

        // UPDATE HEARTBEAT

        workers[workerId].status =
            "online";

        workers[workerId].lastHeartbeat =
            new Date().toISOString();

        console.log(
            `Heartbeat received from ${workerId}`
        );

        res.json({
            workerId: workerId,

            status: "online",

            lastHeartbeat:
                workers[workerId]
                    .lastHeartbeat
        });
    }
);

// ================================
// GET ALL WORKERS
// ================================

app.get(
    "/api/workers",
    (req, res) => {
        res.json(workers);
    }
);

// ================================
// AUTOMATIC WORKER FAILURE DETECTION
// ================================

const HEARTBEAT_TIMEOUT = 60000;

setInterval(() => {
    const now = Date.now();

    Object.keys(workers)
        .forEach(workerId => {
            const worker =
                workers[workerId];

            if (!worker.lastHeartbeat) {
                return;
            }

            const lastHeartbeat =
                new Date(
                    worker.lastHeartbeat
                ).getTime();

            const timeSinceHeartbeat =
                now - lastHeartbeat;

            if (
                timeSinceHeartbeat >
                HEARTBEAT_TIMEOUT
            ) {
                if (
                    worker.status ===
                    "online"
                ) {
                    worker.status =
                        "offline";

                    console.log(
                        `⚠️ ${workerId} → OFFLINE`
                    );

                    // REQUEUE WORKER TASK

                    tasks
                        .filter(
                            task =>
                                task.worker ===
                                    workerId &&
                                task.status ===
                                    "running"
                        )
                        .forEach(task => {
                            task.status =
                                "queued";

                            task.worker = null;

                            task.assignedAt =
                                null;

                            task.lastError =
                                "Worker went offline";

                            task.failedAt =
                                new Date()
                                    .toISOString();

                            console.log(
                                `${task.id} → REQUEUED`
                            );
                        });
                }
            }
        });
}, 5000);

// ================================
// SYSTEM MONITOR
// ================================

setInterval(() => {
    const queuedTasks =
        tasks.filter(
            task =>
                task.status === "queued"
        ).length;

    const runningTasks =
        tasks.filter(
            task =>
                task.status === "running"
        ).length;

    const completedTasks =
        tasks.filter(
            task =>
                task.status === "completed"
        ).length;

    const failedTasks =
        tasks.filter(
            task =>
                task.status === "failed"
        ).length;

    const onlineWorkers =
        Object.values(workers)
            .filter(
                worker =>
                    worker.status === "online"
            ).length;

    const offlineWorkers =
        Object.values(workers)
            .filter(
                worker =>
                    worker.status === "offline"
            ).length;

    console.log(
        `Monitor → ` +
        `Queued: ${queuedTasks} | ` +
        `Running: ${runningTasks} | ` +
        `Completed: ${completedTasks} | ` +
        `Failed: ${failedTasks} | ` +
        `Online Workers: ${onlineWorkers} | ` +
        `Offline Workers: ${offlineWorkers}`
    );
}, 5000);

// ================================
// SERVER START
// ================================

console.log(
    "================================="
);

console.log(
    "AI DISTRIBUTED SYSTEMS PLATFORM"
);

console.log(
    "================================="
);

console.log(
    `Server running on http://localhost:${PORT}`
);

// LOCAL DEVELOPMENT
// Vercel will import the app directly.

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(
            `Server listening on port ${PORT}`
        );
    });
}

// VERCEL EXPORT

module.exports = app;