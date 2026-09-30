const API = "http://127.0.0.1:5001";

// ==========================================
// HELPERS
// ==========================================

function getStatusIcon(status) {
    switch (status) {
        case "completed":
            return "[OK]";

        case "running":
            return "[RUNNING]";

        case "failed":
            return "[FAILED]";

        case "queued":
            return "[QUEUED]";

        default:
            return "[--]";
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// ==========================================
// LOAD TASKS
// ==========================================

async function loadTasks() {
    try {
        const response = await fetch(`${API}/api/tasks`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const tasks = await response.json();

        renderTasks(tasks);
        updateTaskStats(tasks);

        return tasks;

    } catch (error) {
        console.error("Task loading failed:", error);

        const taskList = document.getElementById("taskList");

        if (taskList) {
            taskList.innerHTML =
                `<p>Unable to load tasks. Check backend.</p>`;
        }

        return [];
    }
}


// ==========================================
// RENDER TASK
// ==========================================

function renderTask(task) {
    return `
        <div class="task-item">

            <strong>
                ${escapeHtml(task.id)}
            </strong>

            <span>
                ${escapeHtml(task.task)}
            </span>

            <span class="task-status">

                ${getStatusIcon(task.status)}

                ${escapeHtml(task.status)}

            </span>

        </div>
    `;
}


// ==========================================
// RENDER TASKS
// ==========================================

function renderTasks(tasks) {

    const taskList =
        document.getElementById("taskList");

    const previewTaskList =
        document.getElementById("previewTaskList");


    // Main task list
    if (taskList) {

        if (!tasks.length) {

            taskList.innerHTML =
                "<p>No tasks yet</p>";

        } else {

            taskList.innerHTML =
                tasks
                    .slice()
                    .reverse()
                    .map(renderTask)
                    .join("");
        }
    }


    // Dashboard preview
    if (previewTaskList) {

        const recentTasks =
            tasks.slice(-5).reverse();


        if (!recentTasks.length) {

            previewTaskList.innerHTML =
                "<p>No tasks yet</p>";

        } else {

            previewTaskList.innerHTML =
                recentTasks
                    .map(renderTask)
                    .join("");
        }
    }
}


// ==========================================
// TASK STATISTICS
// ==========================================

function updateTaskStats(tasks) {

    const queued =
        tasks.filter(
            task => task.status === "queued"
        ).length;

    const running =
        tasks.filter(
            task => task.status === "running"
        ).length;

    const completed =
        tasks.filter(
            task => task.status === "completed"
        ).length;

    const failed =
        tasks.filter(
            task => task.status === "failed"
        ).length;


    setText(
        "queuedCount",
        queued
    );

    setText(
        "runningCount",
        running
    );

    setText(
        "completedCount",
        completed
    );

    setText(
        "failedCount",
        failed
    );

    setText(
        "previewTasks",
        tasks.length
    );
}


// ==========================================
// CREATE TASK
// ==========================================

async function createTask() {

    const input =
        document.getElementById("taskInput");

    const result =
        document.getElementById("taskResult");


    const taskText =
        input
            ? input.value.trim()
            : "";


    if (!taskText) {

        if (result) {
            result.textContent =
                "Please enter a task.";
        }

        return;
    }


    try {

        if (result) {
            result.textContent =
                "Creating task...";
        }


        const response =
            await fetch(
                `${API}/api/tasks`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        task: taskText
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to create task"
            );
        }


        if (result) {

            result.textContent =
                `${data.id} created → queued`;
        }


        input.value = "";


        await refreshDashboard();


    } catch (error) {

        console.error(
            "Create task failed:",
            error
        );


        if (result) {

            result.textContent =
                `Error: ${error.message}`;
        }
    }
}


// ==========================================
// BACKEND CHECK
// ==========================================

async function checkBackend() {

    const result =
        document.getElementById("result");


    try {

        const response =
            await fetch(
                `${API}/api/status`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (result) {

            result.textContent =
                "Backend connected successfully.";
        }


        setText(
            "systemStatus",
            data.system === "Online"
                ? "Online"
                : "Offline"
        );


    } catch (error) {

        console.error(
            "Backend check failed:",
            error
        );


        if (result) {

            result.textContent =
                "Backend unavailable";
        }


        setText(
            "systemStatus",
            "Offline"
        );
    }
}


// ==========================================
// SYSTEM STATUS
// ==========================================

async function loadStatus() {

    try {

        const response =
            await fetch(
                `${API}/api/status`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        setText(
            "systemStatus",
            data.system === "Online"
                ? "Online"
                : "Offline"
        );


        setText(
            "previewServices",
            data.services
        );


        setText(
            "previewTasks",
            data.jobs
        );


        setText(
            "previewWorkers",
            data.onlineWorkers
        );


        setText(
            "previewFailures",
            data.failed
        );


        setText(
            "queuedCount",
            data.queued
        );


        setText(
            "runningCount",
            data.running
        );


        setText(
            "completedCount",
            data.completed
        );


        setText(
            "failedCount",
            data.failed
        );


        return data;


    } catch (error) {

        console.error(
            "Status loading failed:",
            error
        );


        setText(
            "systemStatus",
            "Backend Offline"
        );


        return null;
    }
}


// ==========================================
// LOAD WORKERS
// ==========================================

async function loadWorkers() {

    const workerList =
        document.getElementById(
            "workerList"
        );


    try {

        const response =
            await fetch(
                `${API}/api/workers`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const workers =
            await response.json();


        const workerEntries =
            Object.entries(workers);


        if (!workerEntries.length) {

            if (workerList) {

                workerList.innerHTML =
                    "<p>No workers registered</p>";
            }

            return workers;
        }


        if (workerList) {

            workerList.innerHTML =
                workerEntries
                    .map(
                        ([id, worker]) => {

                            const online =
                                worker.status ===
                                "online";


                            return `
                                <div class="worker-item">

                                    <div>

                                        <strong>
                                            ${escapeHtml(id)}
                                        </strong>

                                        <small>

                                            ${
                                                worker.lastHeartbeat

                                                    ? "Heartbeat: " +
                                                      new Date(
                                                          worker.lastHeartbeat
                                                      ).toLocaleTimeString()

                                                    : "No heartbeat"
                                            }

                                        </small>

                                    </div>


                                    <span class="${
                                        online
                                            ? "worker-online"
                                            : "worker-offline"
                                    }">

                                        ${
                                            online
                                                ? "[ONLINE]"
                                                : "[OFFLINE]"
                                        }

                                        ${escapeHtml(
                                            worker.status
                                        )}

                                    </span>

                                </div>
                            `;
                        }
                    )
                    .join("");
        }


        return workers;


    } catch (error) {

        console.error(
            "Worker loading failed:",
            error
        );


        if (workerList) {

            workerList.innerHTML =
                "<p>Unable to load workers</p>";
        }


        return {};
    }
}


// ==========================================
// AUTONOMOUS SYSTEM ANALYSIS
// ==========================================

async function loadAnalysis() {

    try {

        const responses =
            await Promise.all([
                fetch(
                    `${API}/api/status`,
                    {
                        cache: "no-store"
                    }
                ),

                fetch(
                    `${API}/api/tasks`,
                    {
                        cache: "no-store"
                    }
                ),

                fetch(
                    `${API}/api/workers`,
                    {
                        cache: "no-store"
                    }
                )
            ]);


        const status =
            await responses[0].json();


        const tasks =
            await responses[1].json();


        const workers =
            await responses[2].json();


        const workerEntries =
            Object.values(workers);


        const onlineWorkers =
            workerEntries.filter(
                worker =>
                    worker.status === "online"
            ).length;


        const offlineWorkers =
            workerEntries.filter(
                worker =>
                    worker.status !== "online"
            ).length;


        // ======================================
        // SYSTEM STATUS ANALYSIS
        // ======================================

        let systemMessage;


        if (status.failed > 0) {

            systemMessage =
                `Attention required: ${status.failed} task(s) failed.`;

        } else if (offlineWorkers > 0) {

            systemMessage =
                `System operational with ${offlineWorkers} offline worker(s).`;

        } else {

            systemMessage =
                "System healthy. All monitored services are operating normally.";
        }


        setText(
            "aiSystemStatus",
            systemMessage
        );


        // ======================================
        // TASK ANALYSIS
        // ======================================

        const taskAnalysis =
            `Tasks: ${tasks.length} total | ` +
            `${status.queued} queued | ` +
            `${status.running} running | ` +
            `${status.completed} completed | ` +
            `${status.failed} failed.`;


        setText(
            "aiTaskAnalysis",
            taskAnalysis
        );


        // ======================================
        // ROOT CAUSE ANALYSIS
        // ======================================

        const failedTasks =
            tasks.filter(
                task =>
                    task.status === "failed"
            );


        if (failedTasks.length > 0) {

            const latestFailed =
                failedTasks[
                    failedTasks.length - 1
                ];


            setText(
                "aiRootCause",

                `Latest failure: ${
                    latestFailed.lastError ||
                    "Failure reason not available."
                }`
            );


        } else if (offlineWorkers > 0) {

            setText(
                "aiRootCause",

                `${offlineWorkers} worker(s) currently offline.`
            );


        } else {

            setText(
                "aiRootCause",

                "No recent failures detected."
            );
        }


        // ======================================
        // RECOVERY ACTION
        // ======================================

        let recoveryMessage;


        if (status.failed > 0) {

            recoveryMessage =
                "Review failed tasks and retry status.";

        } else if (status.queued > 0) {

            recoveryMessage =
                "Queued tasks are waiting for available workers.";

        } else if (status.running > 0) {

            recoveryMessage =
                "Workers are actively processing tasks.";

        } else if (offlineWorkers > 0) {

            recoveryMessage =
                "Monitor offline workers and restore availability.";

        } else {

            recoveryMessage =
                "System stable. Automatic monitoring active.";
        }


        setText(
            "aiRecoveryAction",
            recoveryMessage
        );


        // ======================================
        // MONITORING - TASK PROCESSING
        // ======================================

        setText(
            "monitorTaskProcessing",

            `Queued: ${status.queued} | ` +
            `Running: ${status.running} | ` +
            `Completed: ${status.completed} | ` +
            `Failed: ${status.failed}`
        );


        // ======================================
        // MONITORING - WORKER HEALTH
        // ======================================

        setText(
            "monitorWorkerHealth",

            `Online workers: ${onlineWorkers} | ` +
            `Offline workers: ${offlineWorkers}`
        );


        // ======================================
        // DASHBOARD HEALTH
        // ======================================

        const health =
            status.failed > 0 ||
            offlineWorkers > 0
                ? "● Attention"
                : "● Healthy";


        setText(
            "previewHealth",
            health
        );


    } catch (error) {

        console.error(
            "Analysis loading failed:",
            error
        );


        setText(
            "aiSystemStatus",
            "Unable to analyze system."
        );


        setText(
            "aiTaskAnalysis",
            "Backend data unavailable."
        );


        setText(
            "aiRootCause",
            "Analysis unavailable."
        );


        setText(
            "aiRecoveryAction",
            "Check backend connection."
        );


        setText(
            "monitorTaskProcessing",
            "Monitoring unavailable."
        );


        setText(
            "monitorWorkerHealth",
            "Worker health unavailable."
        );
    }
}


// ==========================================
// REFRESH EVERYTHING
// ==========================================

async function refreshDashboard() {

    await Promise.all([
        loadTasks(),
        loadWorkers(),
        loadStatus(),
        loadAnalysis()
    ]);
}


// ==========================================
// AUTO REFRESH
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "AI Distributed Systems Platform loaded"
        );


        // Initial dashboard load
        await refreshDashboard();


        // Refresh every 3 seconds
        setInterval(
            refreshDashboard,
            3000
        );
    }
);