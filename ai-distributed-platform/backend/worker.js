const http = require("http");


// ================================
// WORKER ID
// ================================

const workerId =
    process.env.WORKER_ID ||
    "WORKER-1";


// ================================
// WORKER START
// ================================

console.log("================================");



// ================================
// WORKER HEARTBEAT
// ================================

function sendHeartbeat() {

    const data = JSON.stringify({
        workerId: workerId
    });

    const options = {

        hostname: "127.0.0.1",

        port: 5001,

        path: "/api/workers/heartbeat",

        method: "POST",

        headers: {

            "Content-Type":
                "application/json",

            "Content-Length":
                Buffer.byteLength(data)

        }

    };


    const request =
        http.request(

            options,

            (res) => {

                let response = "";


                res.on(
                    "data",
                    chunk => {

                        response += chunk;

                    }
                );


                res.on(
                    "end",
                    () => {

                        try {

                            if (!response.trim()) { return; }

const result =
                                JSON.parse(response);


                            if (
                                res.statusCode === 200
                            ) {

                                console.log(

                                    `ðŸ’“ ${workerId} heartbeat OK`

                                );

                            }

                            else {

                                console.log(

                                    `âŒ ${workerId} heartbeat failed`

                                );

                                console.log(result);

                            }

                        }

                        catch {

                            console.log(

                                `âŒ ${workerId}: ` +
                                `Invalid heartbeat response`

                            );

                        }

                    }
                );

            }

        );


    request.on(
        "error",
        () => {

            console.log(

                `âŒ ${workerId}: ` +
                `Heartbeat connection failed`

            );

        }
    );


    request.write(data);

    request.end();

}


// ================================
// CLAIM TASK
// ================================

function claimTask() {

    const data =
        JSON.stringify({

            workerId:
                workerId

        });


    const options = {

        hostname: "127.0.0.1",

        port: 5001,

        path:
            "/api/tasks/claim",

        method: "POST",

        headers: {

            "Content-Type":
                "application/json",

            "Content-Length":
                Buffer.byteLength(data)

        }

    };


    const request =
        http.request(

            options,

            (res) => {

                let response = "";


                res.on(
                    "data",
                    chunk => {

                        response += chunk;

                    }
                );


                res.on(
                    "end",
                    () => {

                        try {

                            if (!response.trim()) { return; }

const result =
                                JSON.parse(
                                    response
                                );


                            // ================================
                            // NO TASK
                            // ================================

                            if (
                                res.statusCode ===
                                404
                            ) {

                                console.log(

                                    `ðŸ“­ ${workerId}: ` +
                                    `No queued tasks`

                                );

                                return;

                            }


                            // ================================
                            // WORKER OFFLINE
                            // ================================

                            if (
                                res.statusCode ===
                                400
                            ) {

                                console.log(

                                    `âš ï¸ ${workerId}: ` +
                                    `${result.error}`

                                );

                                return;

                            }


                            // ================================
                            // TASK CLAIMED
                            // ================================

                            if (
                                res.statusCode ===
                                200
                            ) {

                                console.log(

                                    `ðŸ”’ ${workerId} claimed ` +
                                    `${result.id}`

                                );


                                console.log(

                                    `âš™ï¸ ${workerId} executing: ` +
                                    `${result.task}`

                                );


                                executeTask(
                                    result
                                );

                                return;

                            }


                            // ================================
                            // OTHER RESPONSE
                            // ================================

                            console.log(

                                `âš ï¸ ${workerId}: ` +
                                `Unexpected response ` +
                                `${res.statusCode}`

                            );

                            console.log(result);

                        }

                        catch (error) {

                            console.log("WORKER ERROR:", error.message);
                            console.log("RESPONSE:", response);

                        }









                        }
                    );

                }

            );


    request.on(
        "error",
        () => {

            console.log("Cannot connect to backend");

        }
    );







    request.write(data);

    request.end();

}


// ================================
// EXECUTE TASK
// ================================

function executeTask(task) {

    console.log(

        `ðŸš€ ${workerId} started ` +
        `${task.id}`

    );


    // =================================
    // FAILURE SIMULATION
    // =================================

    const shouldFail =
        task.task
            .toLowerCase()
            .includes("fail");


    setTimeout(() => {


        // =================================
        // FAILURE
        // =================================

        if (shouldFail) {

            console.log(

                `âŒ ${workerId}: ` +
                `${task.id} failed`

            );


            updateTask(

                task.id,

                "failed",

                "Simulated worker failure"

            );


            return;

        }


        // =================================
        // SUCCESS
        // =================================

        console.log(

            `âœ… ${workerId}: ` +
            `${task.id} completed`

        );


        updateTask(

            task.id,

            "completed"

        );


    }, 30000);

}


// ================================
// UPDATE TASK
// ================================

function updateTask(
    taskId,
    status,
    errorMessage = null
) {

    const data =
        JSON.stringify({

            status:
                status,

            workerId:
                workerId,

            error:
                errorMessage

        });


    const options = {

        hostname: "127.0.0.1",

        port: 5001,

        path:
            `/api/tasks/${taskId}`,

        method:
            "PUT",

        headers: {

            "Content-Type":
                "application/json",

            "Content-Length":
                Buffer.byteLength(data)

        }

    };


    const request =
        http.request(

            options,

            (res) => {

                let response = "";


                res.on(
                    "data",
                    chunk => {

                        response += chunk;

                    }
                );


                res.on(
                    "end",
                    () => {

                        try {

                            if (!response.trim()) { return; }

const result =
                                JSON.parse(
                                    response
                                );


                            console.log(

                                `ðŸ“Š ${workerId} â†’ ` +
                                `${taskId} â†’ ` +
                                `${result.status}`

                            );


                            if (
                                result.message
                            ) {

                                console.log(

                                    `ðŸ” ${result.message}`

                                );

                            }

                        }

                        catch {

                            console.log(

                                `âŒ ${workerId}: ` +
                                `Invalid update response`

                            );

                        }

                    }
                );

            }

        );


    request.on(
        "error",
        () => {

            console.log(

                `âŒ ${workerId}: ` +
                `Failed to update task`

            );

        }
    );


    request.write(data);

    request.end();

}


// ================================
// START HEARTBEAT
// ================================

sendHeartbeat();


// ================================
// HEARTBEAT EVERY 10 SECONDS
// ================================

setInterval(() => {

    sendHeartbeat();

}, 10000);


// ================================
// FIRST TASK CHECK
// ================================

claimTask();


// ================================
// CHECK QUEUE EVERY 5 SECONDS
// ================================

setInterval(() => {

    claimTask();

}, 5001);






