const express = require("express");
const path = require("path");

const app = express();
const PORT = 5001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const tasks = [];
const workers = {
    "WORKER-1": { workerId: "WORKER-1", online: true, lastHeartbeat: Date.now() },
    "WORKER-2": { workerId: "WORKER-2", online: true, lastHeartbeat: Date.now() },
    "WORKER-3": { workerId: "WORKER-3", online: true, lastHeartbeat: Date.now() }
};

let taskCounter = 0;

function formatTask(t) {
    return {
        id: t.id,
        task: t.task,
        status: t.status,
        worker: t.worker || null,
        retries: t.retries || 0,
        maxRetries: 3,
        createdAt: t.createdAt,
        assignedAt: t.assignedAt || null,
        completedAt: t.completedAt || null,
        failedAt: t.failedAt || null,
        lastError: t.lastError || null
    };
}

function getStats() {
    return {
        jobs: tasks.length,
        failed: tasks.filter(t => t.status === "failed").length,
        running: tasks.filter(t => t.status === "running").length,
        queued: tasks.filter(t => t.status === "queued").length,
        completed: tasks.filter(t => t.status === "completed").length
    };
}

// ================================
// STATUS
// ================================

app.get("/api/status", (req, res) => {
    const stats = getStats();

    const onlineWorkers = Object.values(workers)
        .filter(w => w.online).length;

    res.json({
        system: "Online",
        services: 3,
        jobs: stats.jobs,
        failed: stats.failed,
        running: stats.running,
        queued: stats.queued,
        completed: stats.completed,
        workers: 3,
        onlineWorkers,
        offlineWorkers: 3 - onlineWorkers
    });
});

// ================================
// TASKS
// ================================

app.get("/api/tasks", (req, res) => {
    res.json(tasks.map(formatTask).reverse());
});

app.post("/api/tasks", (req, res) => {
    const taskName =
        req.body.task ||
        req.body.name ||
        req.body.description ||
        "Untitled Task";

    const task = {
        id: `TASK-${++taskCounter}`,
        task: taskName,
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

    tasks.push(task);

    res.status(201).json(formatTask(task));
});

// ================================
// CLAIM TASK
// ================================

app.post("/api/tasks/claim", (req, res) => {
    const workerId = req.body.workerId || "WORKER-1";

    const task = tasks.find(t => t.status === "queued");

    if (!task) {
        return res.status(204).send();
    }

    task.status = "running";
    task.worker = workerId;
    task.assignedAt = new Date().toISOString();

    res.json(formatTask(task));
});

// ================================
// UPDATE TASK
// ================================

app.put("/api/tasks/:id", (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);

    if (!task) {
        return res.status(404).json({ error: "Task not found" });
    }

    const newStatus = req.body.status;

    if (newStatus) {
        task.status = newStatus;
    }

    if (req.body.worker) {
        task.worker = req.body.worker;
    }

    if (newStatus === "completed") {
        task.completedAt = new Date().toISOString();
        task.lastError = null;
    }

    if (newStatus === "failed") {
        task.failedAt = new Date().toISOString();
        task.lastError =
            req.body.error ||
            req.body.lastError ||
            "Worker failure";

        task.retries++;

        if (task.retries < task.maxRetries) {
            task.status = "queued";
            task.worker = null;
            task.failedAt = null;
        }
    }

    res.json(formatTask(task));
});

// ================================
// WORKERS
// ================================

app.get("/api/workers", (req, res) => {
    res.json(Object.values(workers));
});

app.post("/api/workers/heartbeat", (req, res) => {
    const workerId = req.body.workerId;

    if (!workerId) {
        return res.status(400).json({
            error: "workerId required"
        });
    }

    if (!workers[workerId]) {
        workers[workerId] = {
            workerId,
            online: true,
            lastHeartbeat: Date.now()
        };
    }

    workers[workerId].online = true;
    workers[workerId].lastHeartbeat = Date.now();

    res.json({
        success: true,
        workerId
    });
});

// ================================
// AI ANALYSIS
// ================================

app.get("/api/analysis", (req, res) => {
    const stats = getStats();

    let rootCause = "No active failures detected.";
    let recoveryAction = "System operating normally.";

    if (stats.failed > 0) {
        rootCause = "One or more tasks exceeded maximum retry attempts.";
        recoveryAction = "Review failed tasks and worker health.";
    } else if (stats.running > 0) {
        rootCause = "Tasks are currently being processed by distributed workers.";
        recoveryAction = "Continue monitoring worker execution.";
    }

    res.json({
        systemStatus: "Healthy",
        taskAnalysis:
            `${stats.completed} completed, ${stats.running} running, ${stats.queued} queued, ${stats.failed} failed`,
        rootCause,
        recoveryAction
    });
});

// ================================
// ROOT
// ================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ================================
// WORKER MONITOR
// ================================

setInterval(() => {
    const now = Date.now();

    for (const worker of Object.values(workers)) {
        const wasOnline = worker.online;

        worker.online =
            now - worker.lastHeartbeat < 60000;

        if (wasOnline && !worker.online) {
            console.log(
                `[RECOVERY] ${worker.workerId} is OFFLINE`
            );

            const affectedTasks = tasks.filter(
                t =>
                    t.status === "running" &&
                    t.worker === worker.workerId
            );

            for (const task of affectedTasks) {
                task.status = "queued";
                task.worker = null;
                task.failedAt = null;

                task.recoveryCount =
                    (task.recoveryCount || 0) + 1;

                task.recoveredAt =
                    new Date().toISOString();

                task.lastError =
                    `Worker ${worker.workerId} became offline. Task automatically re-queued.`;

                console.log(
                    `[RECOVERY] ${task.id} re-queued from ${worker.workerId}`
                );
            }
        }
    }

    const s = getStats();

    console.log(
        `[MONITOR] queued=${s.queued} running=${s.running} completed=${s.completed} failed=${s.failed} | onlineWorkers=${Object.values(workers).filter(w => w.online).length}`
    );
}, 5000);

app.listen(PORT, () => {
    console.log("================================");
    console.log("AI DISTRIBUTED SYSTEMS PLATFORM");
    console.log("Backend running on port 5001");
    console.log("================================");
});


