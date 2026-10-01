const { handleCallback } = require("@vercel/queue");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

const callback = handleCallback(async (message, metadata) => {
    console.log("Queue message received:", metadata.messageId);
    console.log("Message:", message);

    const taskId = Number(message.taskId);

    if (!taskId) {
        throw new Error("Invalid taskId");
    }

    const existing = await sql`
        SELECT *
        FROM tasks
        WHERE id = ${taskId}
        LIMIT 1
    `;

    if (existing.length === 0) {
        throw new Error(`Task ${taskId} not found`);
    }

    const task = existing[0];

    await sql`
        UPDATE tasks
        SET
            status = 'running',
            assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
            worker = 'VERCEL-QUEUE-WORKER'
        WHERE id = ${taskId}
    `;

    console.log(`Processing TASK-${taskId}: ${task.task}`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    if (String(task.task).toLowerCase().includes("fail")) {
        const newRetries = Number(task.retries || 0) + 1;

        if (newRetries < Number(task.max_retries || 3)) {
            await sql`
                UPDATE tasks
                SET
                    status = 'queued',
                    retries = ${newRetries},
                    failed_at = CURRENT_TIMESTAMP,
                    last_error = 'Simulated worker failure'
                WHERE id = ${taskId}
            `;

            throw new Error("Simulated worker failure");
        }

        await sql`
            UPDATE tasks
            SET
                status = 'failed',
                retries = ${newRetries},
                failed_at = CURRENT_TIMESTAMP,
                last_error = 'Simulated worker failure'
            WHERE id = ${taskId}
        `;

        return {
            success: false,
            taskId,
            status: "failed",
            retries: newRetries
        };
    }

    await sql`
        UPDATE tasks
        SET
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            last_error = NULL
        WHERE id = ${taskId}
    `;

    console.log(`TASK-${taskId} completed successfully`);

    return {
        success: true,
        taskId,
        status: "completed"
    };
});

module.exports = async function handler(req, res) {
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers || {})) {
        if (Array.isArray(value)) {
            headers.set(key, value.join(", "));
        } else if (value !== undefined) {
            headers.set(key, String(value));
        }
    }

    const body = req.body
        ? JSON.stringify(req.body)
        : undefined;

    const request = new Request(
        `https://${req.headers.host || "localhost"}/api/queue-consumer`,
        {
            method: req.method || "POST",
            headers,
            body
        }
    );

    const response = await callback(request);

    res.status(response.status);

    response.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });

    const responseBody = await response.text();

    res.send(responseBody);
};
