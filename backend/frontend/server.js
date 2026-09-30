async function checkBackend() {
    const result = document.getElementById("result");

    result.innerText = "Checking backend...";

    try {
        const response = await fetch("http://localhost:5000");

        const data = await response.text();

        result.innerText = data;
    } catch (error) {
        result.innerText = "Backend connection failed!";
    }
}