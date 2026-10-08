/* =====================================================
   RETAILIQ
   RETAIL DEMAND ANALYSIS
   ===================================================== */


const fileInput =
    document.getElementById("fileInput");

const uploadArea =
    document.getElementById("uploadArea");

const selectedFile =
    document.getElementById("selectedFile");

const fileName =
    document.getElementById("fileName");

const fileInfo =
    document.getElementById("fileInfo");

const removeFile =
    document.getElementById("removeFile");

const predictButton =
    document.getElementById("predictButton");

const errorMessage =
    document.getElementById("errorMessage");

const resultSection =
    document.getElementById("resultSection");


let currentFile = null;


/* =====================================================
   FILE SELECTION
   ===================================================== */

fileInput.addEventListener("change", function () {

    if (this.files.length > 0) {

        processFile(this.files[0]);

    }

});


/* =====================================================
   UPLOAD AREA
   ===================================================== */

uploadArea.addEventListener("click", function () {

    fileInput.click();

});


/* =====================================================
   DRAG & DROP
   ===================================================== */

uploadArea.addEventListener("dragover", function (event) {

    event.preventDefault();

    uploadArea.classList.add("dragover");

});


uploadArea.addEventListener("dragleave", function () {

    uploadArea.classList.remove("dragover");

});


uploadArea.addEventListener("drop", function (event) {

    event.preventDefault();

    uploadArea.classList.remove("dragover");


    if (event.dataTransfer.files.length > 0) {

        processFile(
            event.dataTransfer.files[0]
        );

    }

});


/* =====================================================
   PROCESS FILE
   ===================================================== */

function processFile(file) {

    clearError();


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    if (extension !== "csv") {

        showError(
            "Please upload a CSV file."
        );

        return;

    }


    const maxSize =
        50 * 1024 * 1024;


    if (file.size > maxSize) {

        showError(
            "File size must be less than 50 MB."
        );

        return;

    }


    currentFile = file;


    fileName.textContent =
        file.name;


    const size =
        (file.size / (1024 * 1024))
        .toFixed(2);


    fileInfo.textContent =
        `CSV Dataset • ${size} MB`;


    selectedFile.classList.add("show");


    predictButton.disabled = false;

}


/* =====================================================
   REMOVE FILE
   ===================================================== */

removeFile.addEventListener("click", function (event) {

    event.stopPropagation();

    currentFile = null;

    fileInput.value = "";

    selectedFile.classList.remove("show");

    predictButton.disabled = true;

    clearError();

});


/* =====================================================
   PREDICT / ANALYZE
   ===================================================== */

predictButton.addEventListener("click", function () {

    if (!currentFile) {

        showError(
            "Please upload a CSV file first."
        );

        return;

    }


    predictButton.disabled = true;


    predictButton.innerHTML = `
        <span>Analyzing Dataset...</span>
        <span>⟳</span>
    `;


    readCSV();

});


/* =====================================================
   READ CSV
   ===================================================== */

function readCSV() {

    const reader =
        new FileReader();


    reader.onload = function (event) {

        const csv =
            event.target.result.trim();


        if (!csv) {

            showError(
                "The uploaded CSV file is empty."
            );

            resetButton();

            return;

        }


        const rows =
            parseCSV(csv);


        if (rows.length < 2) {

            showError(
                "The CSV file does not contain enough data."
            );

            resetButton();

            return;

        }


        const headers =
            rows[0].map(
                header =>
                    header.trim().toLowerCase()
            );


        /*
         * Find the product column.
         */

        const productIndex =
            findColumn(
                headers,
                [
                    "product",
                    "product_name",
                    "productname",
                    "item",
                    "item_name",
                    "itemname",
                    "product_id",
                    "sku",
                    "product_id"
                ]
            );


        /*
         * Find demand/sales column.
         */

        const demandIndex =
            findColumn(
                headers,
                [
                    "demand",
                    "sales",
                    "quantity",
                    "units",
                    "units_sold",
                    "unit_sales",
                    "weekly_sales",
                    "total_sales"
                ]
            );


        if (productIndex === -1) {

            showError(
                "No product column found. Use Product, Product_Name, Item, SKU, etc."
            );

            resetButton();

            return;

        }


        if (demandIndex === -1) {

            showError(
                "No demand column found. Use Demand, Sales, Quantity, Units_Sold, etc."
            );

            resetButton();

            return;

        }


        /*
         * Calculate demand for each product.
         */

        const productDemand = {};

        let validRows = 0;


        for (
            let i = 1;
            i < rows.length;
            i++
        ) {

            const row = rows[i];


            if (
                row.length <= productIndex ||
                row.length <= demandIndex
            ) {

                continue;

            }


            const product =
                row[productIndex]
                    ?.trim();


            const demand =
                parseFloat(
                    row[demandIndex]
                        ?.trim()
                );


            if (
                !product ||
                Number.isNaN(demand)
            ) {

                continue;

            }


            if (
                !productDemand[product]
            ) {

                productDemand[product] = 0;

            }


            productDemand[product] += demand;

            validRows++;

        }


        if (validRows === 0) {

            showError(
                "No valid product-demand records were found."
            );

            resetButton();

            return;

        }


        /*
         * Calculate overall demand.
         */

        const totalDemand =
            Object.values(productDemand)
                .reduce(
                    (total, value) =>
                        total + value,
                    0
                );


        /*
         * Sort products from highest
         * demand to lowest.
         */

        const sortedProducts =
            Object.entries(productDemand)
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                );


        /*
         * Show results.
         */

        showResults(
            totalDemand,
            sortedProducts,
            validRows,
            headers.length,
            headers[demandIndex]
        );

    };


    reader.onerror = function () {

        showError(
            "Unable to read the CSV file."
        );

        resetButton();

    };


    reader.readAsText(currentFile);

}


/* =====================================================
   CSV PARSER
   ===================================================== */

function parseCSV(text) {

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];


        const next =
            text[i + 1];


        if (char === '"' && insideQuotes && next === '"') {

            value += '"';

            i++;

        }

        else if (char === '"') {

            insideQuotes =
                !insideQuotes;

        }

        else if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(value);

            value = "";

        }

        else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {

                i++;

            }


            row.push(value);

            rows.push(row);

            row = [];

            value = "";

        }

        else {

            value += char;

        }

    }


    if (value !== "" || row.length > 0) {

        row.push(value);

        rows.push(row);

    }


    return rows;

}


/* =====================================================
   FIND COLUMN
   ===================================================== */

function findColumn(
    headers,
    possibleNames
) {

    for (
        const name of possibleNames
    ) {

        const index =
            headers.indexOf(name);


        if (index !== -1) {

            return index;

        }

    }


    return -1;

}


/* =====================================================
   SHOW RESULTS
   ===================================================== */

function showResults(
    totalDemand,
    sortedProducts,
    rows,
    featureCount,
    demandColumn
) {


    const predictionText =
        document.getElementById(
            "predictionText"
        );


    const predictionDescription =
        document.getElementById(
            "predictionDescription"
        );


    const totalDemandElement =
        document.getElementById(
            "confidenceValue"
        );


    const topProductElement =
        document.getElementById(
            "topProduct"
        );


    const topProductDemandElement =
        document.getElementById(
            "topProductDemand"
        );


    const productCountElement =
        document.getElementById(
            "productCount"
        );


    const rowsProcessed =
        document.getElementById(
            "rowsProcessed"
        );


    const productsProcessed =
        document.getElementById(
            "productsProcessed"
        );


    const demandColumnUsed =
        document.getElementById(
            "demandColumnUsed"
        );


    /*
     * Overall demand level.
     */

    predictionText.textContent =
    "Overall Retail Demand";

    /*
     * Total demand.
     */

    totalDemandElement.textContent =
        formatNumber(totalDemand);


    /*
     * Highest demand product.
     */

    const topProduct =
        sortedProducts[0];


    topProductElement.textContent =
        topProduct[0];


    topProductDemandElement.textContent =
        `${formatNumber(topProduct[1])} units`;


    /*
     * Product count.
     */

    productCountElement.textContent =
        sortedProducts.length;


    /*
     * Dataset information.
     */

    rowsProcessed.textContent =
        rows;


    productsProcessed.textContent =
        sortedProducts.length;


    demandColumnUsed.textContent =
        demandColumn;


    predictionDescription.textContent =
    `${topProduct[0]} is the highest-demand product with ${formatNumber(topProduct[1])} units.`;



    /*
     * Product table.
     */

    createProductTable(
        sortedProducts,
        totalDemand
    );


    /*
     * Scroll to result.
     */

    resultSection.scrollIntoView({
        behavior: "smooth"
    });


    resetButton();

}


/* =====================================================
   PRODUCT TABLE
   ===================================================== */

function createProductTable(
    sortedProducts,
    totalDemand
) {

    const table =
        document.getElementById(
            "productDemandTable"
        );


    table.innerHTML = `

        <h3>
            Product-wise Demand
        </h3>

        <p>
            Demand calculated directly from your uploaded dataset.
        </p>

    `;


    sortedProducts
    .slice(0, 10)
    .forEach(
        ([product, demand]) => {


            const percentage =
    totalDemand > 0
        ? (demand / totalDemand) * 100
        : 0;


/*
 * Compare each product against
 * the average demand per product.
 */

const averageDemand =
    totalDemand / sortedProducts.length;


let status;


if (demand >= averageDemand * 1.20) {

    status = "High";

}
else if (demand >= averageDemand * 0.80) {

    status = "Medium";

}
else {

    status = "Low";


        }



            const row =
                document.createElement("div");


            row.className =
                "product-row";


            row.innerHTML = `

                <div class="product-name">

                    <strong>
                        Product #${escapeHTML(product)}
                    </strong>

                </div>


                <div class="product-demand">

                    <strong>
                        ${formatNumber(demand)}
                    </strong>

                    <span>
                        ${percentage.toFixed(1)}%
                    </span>

                </div>


                <div class="demand-status ${status.toLowerCase()}">

                    ${status}

                </div>

            `;


            table.appendChild(row);

        }
    );

}


/* =====================================================
   FORMAT NUMBER
   ===================================================== */

function formatNumber(number) {

    return Number(number)
        .toLocaleString(
            "en-IN",
            {
                maximumFractionDigits: 2
            }
        );

}


/* =====================================================
   ESCAPE HTML
   ===================================================== */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}


/* =====================================================
   RESET BUTTON
   ===================================================== */

function resetButton() {

    predictButton.disabled =
        false;


    predictButton.innerHTML = `

        <span>
            Predict Demand
        </span>

        <span>
            →
        </span>

    `;

}


/* =====================================================
   ERROR
   ===================================================== */

function showError(message) {

    errorMessage.textContent =
        message;

    errorMessage.style.display =
        "block";

}


function clearError() {

    errorMessage.textContent =
        "";

    errorMessage.style.display =
        "none";

}