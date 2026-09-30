const express = require("express");
const path = require("path");
const { neon } = require("@neondatabase/serverless");
const { send } = require("@vercel/queue");

const app = express();
const PORT = 5001;

const sql = neon(process.env.DATABASE_URL);

// ================================
// CORS
// ================================

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
// HELPERS
// ================================

function formatTask(row) {
    return {
        id: `TASK-${row.id}`,
        task: row.task,
        status: row.status,
        worker: row.worker || "",
        retries: row.retries,
        maxRetries: row.max_retries,
        createdAt: row.created_at,
        assignedAt: row.assigned_at,
        completedAt: row.completed_at,
        failedAt: row.failed_at,
        lastError: row.last_error || ""
    };
}

function formatWorker(row) {
    return {
        id: row.id,
        status: row.status,
        lastHeartbeat: row.last_heartbeat
    };
}

// ================================
// STATUS
// ================================

app.get("/api/status", async (req, res) => {
    try {
        const result = await sql`
            SELECT
                COUNT(*)::int AS jobs,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'running')::int AS running,
                COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
            FROM tasks
        `;

        const workers = await sql`
            SELECT status
            FROM workers
        `;

        const onlineWorkers =
            workers.filter(w => w.status === "online").length;

        const offlineWorkers =
            workers.filter(w => w.status === "offline").length;

        res.json({
            system: "Online",
            services: 3,
            jobs: result[0].jobs,
            failed: result[0].failed,
            running: result[0].running,
            queued: result[0].queued,
            completed: result[0].completed,
            workers: workers.length,
            onlineWorkers,
            offlineWorkers
        });

    } catch (error) {
        console.error("STATUS ERROR:", error);

        res.status(500).json({
            system: "Offline",
            error: "Database unavailable"
        });
    }
});

// ================================
// GET TASKS
// ================================

app.get("/api/tasks", async (req, res) => {
    try {
        const rows = await sql`
            SELECT *
            FROM tasks
            ORDER BY id ASC
        `;

        res.json(rows.map(formatTask));

    } catch (error) {
        console.error("GET TASKS ERROR:", error);

        res.status(500).json({
            error: "Failed to load tasks"
        });
    }
});

// ================================
// CREATE TASK
// ================================

app.post("/api/tasks", async (req, res) => {
    try {
        const taskText = String(req.body.task || "").trim();

        if (!taskText) {
            return res.status(400).json({
                error: "Task is required"
            });
        }

        const rows = await sql`
            INSERT INTO tasks (task)
            VALUES (${taskText})
            RETURNING *
        `;

        res.status(201).json(
            formatTask(rows[0])
        );

    } catch (error) {
        console.error("CREATE TASK ERROR:", error);

        res.status(500).json({
            error: "Failed to create task"
        });
    }
});

// ================================
// CLAIM TASK
// ================================

app.post("/api/tasks/claim", async (req, res) => {
    try {
        const workerId = String(
            req.body.workerId || ""
        ).trim();

        if (!workerId) {
            return res.status(400).json({
                error: "workerId is required"
            });
        }

        const worker = await sql`
            SELECT *
            FROM workers
            WHERE id = ${workerId}
              AND status = 'online'
            LIMIT 1
        `;

        if (worker.length === 0) {
            return res.status(409).json({
                error: "Worker is offline"
            });
        }

        const tasks = await sql`
            UPDATE tasks
            SET
                status = 'running',
                worker = ${workerId},
                assigned_at = CURRENT_TIMESTAMP
            WHERE id = (
                SELECT id
                FROM tasks
                WHERE status = 'queued'
                ORDER BY id ASC
                LIMIT 1
            )
            RETURNING *
        `;

        if (tasks.length === 0) {
            return res.status(204).send();
        }

        res.json(formatTask(tasks[0]));

    } catch (error) {
        console.error("CLAIM ERROR:", error);

        res.status(500).json({
            error: "Failed to claim task"
        });
    }
});

// ================================
// UPDATE TASK
// ================================

app.put("/api/tasks/:id", async (req, res) => {
    try {
        const numericId = Number(
            req.params.id.replace("TASK-", "")
        );

        if (!Number.isInteger(numericId)) {
            return res.status(400).json({
                error: "Invalid task ID"
            });
        }

        const status = req.body.status;
        const lastError =
            req.body.lastError || null;

        if (!["completed", "failed"].includes(status)) {
            return res.status(400).json({
                error: "Invalid status"
            });
        }

        if (status === "completed") {
            const rows = await sql`
                UPDATE tasks
                SET
                    status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    failed_at = NULL,
                    last_error = NULL
                WHERE id = ${numericId}
                RETURNING *
            `;

            if (rows.length === 0) {
                return res.status(404).json({
                    error: "Task not found"
                });
            }

            return res.json(
                formatTask(rows[0])
            );
        }

        const rows = await sql`
            UPDATE tasks
            SET
                retries = retries + 1,
                last_error = ${lastError}
            WHERE id = ${numericId}
            RETURNING *
        `;

        if (rows.length === 0) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        const task = rows[0];

        if (task.retries < task.max_retries) {
            const retryRows = await sql`
                UPDATE tasks
                SET
                    status = 'queued',
                    worker = NULL,
                    assigned_at = NULL,
                    failed_at = NULL
                WHERE id = ${numericId}
                RETURNING *
            `;

            return res.json(
                formatTask(retryRows[0])
            );
        }

        const failedRows = await sql`
            UPDATE tasks
            SET
                status = 'failed',
                failed_at = CURRENT_TIMESTAMP
            WHERE id = ${numericId}
            RETURNING *
        `;

        res.json(
            formatTask(failedRows[0])
        );

    } catch (error) {
        console.error("UPDATE TASK ERROR:", error);

        res.status(500).json({
            error: "Failed to update task"
        });
    }
});

// ================================
// WORKER HEARTBEAT
// ================================

app.post("/api/workers/heartbeat", async (req, res) => {
    try {
        const workerId = String(
            req.body.workerId || ""
        ).trim();

        if (!workerId) {
            return res.status(400).json({
                error: "workerId is required"
            });
        }

        const rows = await sql`
            INSERT INTO workers (
                id,
                status,
                last_heartbeat
            )
            VALUES (
                ${workerId},
                'online',
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (id)
            DO UPDATE SET
                status = 'online',
                last_heartbeat = CURRENT_TIMESTAMP
            RETURNING *
        `;

        res.json({
            message: "Heartbeat received",
            worker: formatWorker(rows[0])
        });

    } catch (error) {
        console.error("HEARTBEAT ERROR:", error);

        res.status(500).json({
            error: "Heartbeat failed"
        });
    }
});

// ================================
// GET WORKERS
// ================================

app.get("/api/workers", async (req, res) => {
    try {
        const rows = await sql`
            SELECT *
            FROM workers
            ORDER BY id ASC
        `;

        res.json(
            rows.map(formatWorker)
        );

    } catch (error) {
        console.error("GET WORKERS ERROR:", error);

        res.status(500).json({
            error: "Failed to load workers"
        });
    }
});

// ================================
// ROOT
// ================================

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        database: "connected"
    });
});

// ================================
// LOCAL SERVER
// ================================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(
            `Server listening on port ${PORT}`
        );
    });
}

module.exports = app;