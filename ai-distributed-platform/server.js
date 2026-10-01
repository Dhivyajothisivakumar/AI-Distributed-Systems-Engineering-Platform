const express = require("express");

const app = express();
const PORT = 5001;

app.use(express.json());

const tasks = [];
const workers = {};

app.get("/", (req, res) => {
    res.sendFile(require("path").join(__dirname, "public", "index.html"));
});

// ================================
// CREATE TASK
// ================================

app.post("/api/tasks", (req, res) => {
    const { task } = req.body;

    if (!task) {
        return res.status(400).json({
            error: "task is required"
        });
    }

    const newTask = {
        id: tasks.length + 1,
        task,
        status: "queued",
        workerId: null
    };

    tasks.push(newTask);

    console.log("TASK QUEUED:", newTask);

    res.status(201).json(newTask);
});

// ================================
// GET TASKS
// ================================

app.get("/api/tasks", (req, res) => {
    res.json(tasks);
});

// ================================
// WORKER HEARTBEAT + CLAIM
// ================================

app.post("/api/workers/heartbeat", (req, res) => {
    const { workerId } = req.body;

    if (!workerId) {
        return res.status(400).json({
            error: "workerId is required"
        });
    }

    workers[workerId] = {
        workerId,
        lastHeartbeat: new Date().toISOString()
    };

    // Find first queued task
    const task = tasks.find(
        t => t.status === "queued"
    );

    if (task) {
        task.status = "processing";
        task.workerId = workerId;

        console.log(
            `TASK ${task.id} CLAIMED BY ${workerId}`
        );

        return res.status(200).json(task);
    }

    res.status(200).json({
        message: "heartbeat ok",
        workerId
    });
});

// ================================
// EXPLICIT TASK CLAIM
// ================================

app.post("/api/tasks/claim", (req, res) => {
    const { workerId } = req.body;

    if (!workerId) {
        return res.status(400).json({
            error: "workerId is required"
        });
    }

    const task = tasks.find(
        t => t.status === "queued"
    );

    if (!task) {
        return res.status(204).end();
    }

    task.status = "processing";
    task.workerId = workerId;

    console.log(
        `TASK ${task.id} CLAIMED BY ${workerId}`
    );

    res.status(200).json(task);
});

// ================================
// TASK COMPLETE
// ================================

app.post("/api/tasks/:id/complete", (req, res) => {
    const id = Number(req.params.id);

    const task = tasks.find(
        t => t.id === id
    );

    if (!task) {
        return res.status(404).json({
            error: "task not found"
        });
    }

    task.status = "completed";

    console.log(
        `TASK ${task.id} COMPLETED BY ${task.workerId}`
    );

    res.json(task);
});

// ================================
// START SERVER
// ================================
app.post("/api/tasks/complete", (req, res) => {
    const { taskId, workerId, status } = req.body;

    const task = tasks.find(t => t.id === Number(taskId));

    if (!task) {
        return res.status(404).json({ error: "task not found" });
    }

    task.status = status || "completed";
    task.workerId = workerId;

    console.log("TASK COMPLETED:", task);

    res.json(task);
});

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});
