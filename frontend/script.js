const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("fileName");
const predictBtn = document.getElementById("predictBtn");
const status = document.getElementById("status");

const dashboard = document.getElementById("dashboard");
const metricsSection = document.getElementById("metricsSection");
const chartSection = document.getElementById("chartSection");
const tableSection = document.getElementById("tableSection");

let demandChart = null;


// ------------------------------------
// Show selected file
// ------------------------------------

csvFile.addEventListener("change", function () {

    if (csvFile.files.length > 0) {
        fileName.textContent = csvFile.files[0].name;
        status.textContent = "";
    } else {
        fileName.textContent = "No file selected";
    }

});


// ------------------------------------
// Predict Demand
// ------------------------------------

predictBtn.addEventListener("click", async function () {

    if (csvFile.files.length === 0) {
        status.textContent = "Please select a CSV file first.";
        status.style.color = "red";
        return;
    }

    const file = csvFile.files[0];

    if (!file.name.toLowerCase().endsWith(".csv")) {
        status.textContent = "Please upload a CSV file.";
        status.style.color = "red";
        return;
    }


    // Disable button while processing

    predictBtn.disabled = true;
    predictBtn.textContent = "Processing...";

    status.textContent = "Uploading CSV and predicting demand...";
    status.style.color = "#2563eb";


    // Create FormData

    const formData = new FormData();

    formData.append("file", file);


    try {

        // Send CSV to Flask backend

        const response = await fetch(
            "http://127.0.0.1:5000/upload",
            {
                method: "POST",
                body: formData
            }
        );


        const result = await response.json();


        // Handle backend error

        if (!response.ok || !result.success) {

            throw new Error(
                result.error || "Something went wrong."
            );

        }


        // ------------------------------------
        // Update Dashboard
        // ------------------------------------

        dashboard.classList.remove("hidden");

        document.getElementById("totalRecords").textContent =
            result.total_records;

        document.getElementById("averageDemand").textContent =
            result.average_predicted_demand.toFixed(2);

        document.getElementById("minimumDemand").textContent =
            result.minimum_predicted_demand.toFixed(2);

        document.getElementById("maximumDemand").textContent =
            result.maximum_predicted_demand.toFixed(2);


        // ------------------------------------
        // Model Metrics
        // ------------------------------------

        if (result.metrics) {

            metricsSection.classList.remove("hidden");

            document.getElementById("mae").textContent =
                result.metrics.mae.toFixed(2);

            document.getElementById("rmse").textContent =
                result.metrics.rmse.toFixed(2);

            document.getElementById("r2").textContent =
                result.metrics.r2.toFixed(4);

        } else {

            metricsSection.classList.add("hidden");

        }


        // ------------------------------------
        // Display Table
        // ------------------------------------

        createTable(
            result.columns,
            result.data
        );


        // ------------------------------------
        // Create Chart
        // ------------------------------------

        createChart(result.data);


        status.textContent =
            `Prediction completed successfully for ${result.total_records} records.`;

        status.style.color = "green";


    } catch (error) {

        console.error(error);

        status.textContent =
            "Error: " + error.message;

        status.style.color = "red";

    }


    // Enable button again

    predictBtn.disabled = false;
    predictBtn.textContent = "Predict Demand";

});


// ====================================
// Create Data Table
// ====================================

function createTable(columns, data) {

    tableSection.classList.remove("hidden");


    const tableHeader =
        document.getElementById("tableHeader");

    const tableBody =
        document.getElementById("tableBody");


    // Clear previous table

    tableHeader.innerHTML = "";
    tableBody.innerHTML = "";


    // Create headers

    columns.forEach(function (column) {

        const th = document.createElement("th");

        th.textContent = column;

        tableHeader.appendChild(th);

    });


    // Create rows

    data.forEach(function (row) {

        const tr = document.createElement("tr");


        columns.forEach(function (column) {

            const td = document.createElement("td");

            let value = row[column];


            // Format prediction

            if (
                column === "predicted_demand"
                && typeof value === "number"
            ) {
                value = value.toFixed(2);
            }


            td.textContent =
                value !== null && value !== undefined
                    ? value
                    : "";


            tr.appendChild(td);

        });


        tableBody.appendChild(tr);

    });

}


// ====================================
// Create Demand Chart
// ====================================

function createChart(data) {

    chartSection.classList.remove("hidden");


    const labels = data.map(function (row, index) {

        if (row.date) {
            return row.date;
        }

        return index + 1;

    });


    const predictedValues =
        data.map(function (row) {

            return Number(
                row.predicted_demand
            );

        });


    const datasets = [

        {
            label: "Predicted Demand",
            data: predictedValues,
            tension: 0.3
        }

    ];


    // If actual demand exists,
    // display it on the same chart

    const hasActualDemand =
        data.some(function (row) {

            return (
                row.demand !== null &&
                row.demand !== undefined &&
                row.demand !== ""
            );

        });


    if (hasActualDemand) {

        const actualValues =
            data.map(function (row) {

                return Number(row.demand);

            });


        datasets.unshift({

            label: "Actual Demand",
            data: actualValues,
            tension: 0.3

        });

    }


    // Destroy previous chart

    if (demandChart) {

        demandChart.destroy();

    }


    const ctx =
        document.getElementById("demandChart");


    demandChart = new Chart(
        ctx,
        {
            type: "line",

            data: {
                labels: labels,
                datasets: datasets
            },

            options: {

                responsive: true,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                plugins: {

                    legend: {
                        display: true
                    }

                },

                scales: {

                    x: {
                        title: {
                            display: true,
                            text: "Date / Record"
                        }
                    },

                    y: {
                        title: {
                            display: true,
                            text: "Demand"
                        }
                    }

                }

            }

        }
    );

}