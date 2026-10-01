const { send } = require("@vercel/queue");
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

        const createdTask = rows[0];

        // Send task to Vercel Queue
        await send("distributed-tasks", {
            taskId: createdTask.id
        });

        console.log(
            `ðŸ“¤ TASK-${createdTask.id} sent to Vercel Queue`
        );

        res.status(201).json(
            formatTask(createdTask)
        );

    } catch (error) {
        console.error("CREATE TASK ERROR:", error);

        res.status(500).json({
            error: "Failed to create task"
        });
    }
});


