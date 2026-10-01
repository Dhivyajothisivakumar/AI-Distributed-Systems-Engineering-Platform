const { handleCallback } = require("@vercel/queue");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

module.exports = handleCallback(async (message, metadata) => {
    console.log("Queue message received:", metadata.messageId);
    console.log("Message:", message);

    const taskId = Number(message.taskId);

    if (!taskId) {
        throw new Error("Invalid taskId");
    }

    // Check task
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

    // Mark task as running
    await sql`
        UPDATE tasks
        SET
            status = 'running',
            assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
            worker = 'VERCEL-QUEUE-WORKER'
        WHERE id = ${taskId}
    `;

    console.log(`Processing TASK-${taskId}: ${task.task}`);

    // Simulate distributed processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulated failure test
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

            console.log(
                `TASK-${taskId} failed -> retry ${newRetries}`
            );

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

        console.log(
            `TASK-${taskId} failed permanently after ${newRetries} retries`
        );

        return {
            success: false,
            taskId,
            status: "failed",
            retries: newRetries
        };
    }

    // Successful task
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
