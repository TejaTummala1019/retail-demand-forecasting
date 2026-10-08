from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import os
import json

app = Flask(__name__)
CORS(app)

# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "model",
    "retail_demand_model.pkl"
)

FEATURES_PATH = os.path.join(
    BASE_DIR,
    "model",
    "model_features.pkl"
)

# --------------------------------------------------
# LOAD TRAINED MODEL
# --------------------------------------------------

model = joblib.load(MODEL_PATH)
FEATURES = joblib.load(FEATURES_PATH)

print("Model loaded successfully!")
print("Required features:", FEATURES)


# --------------------------------------------------
# HOME ROUTE
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "Retail Demand Forecasting Backend is Running",
        "model": "Ridge Regression",
        "features": FEATURES
    })


# --------------------------------------------------
# CSV UPLOAD + PREDICTION
# --------------------------------------------------

@app.route("/upload", methods=["POST"])
def upload_file():

    try:

        # ------------------------------------------
        # 1. Check whether file was uploaded
        # ------------------------------------------

        if "file" not in request.files:

            return jsonify({
                "error": "No CSV file uploaded"
            }), 400


        file = request.files["file"]


        # ------------------------------------------
        # 2. Check filename
        # ------------------------------------------

        if file.filename == "":

            return jsonify({
                "error": "No file selected"
            }), 400


        # ------------------------------------------
        # 3. Check CSV extension
        # ------------------------------------------

        if not file.filename.lower().endswith(".csv"):

            return jsonify({
                "error": "Please upload a CSV file"
            }), 400


        # ------------------------------------------
        # 4. Read CSV using Pandas
        # ------------------------------------------

        df = pd.read_csv(file)


        # ------------------------------------------
        # 5. Check whether CSV is empty
        # ------------------------------------------

        if df.empty:

            return jsonify({
                "error": "Uploaded CSV is empty"
            }), 400


        # ------------------------------------------
        # 6. Check required model features
        # ------------------------------------------

        missing_features = [
            feature
            for feature in FEATURES
            if feature not in df.columns
        ]


        if missing_features:

            return jsonify({

                "error": "Required features are missing",

                "missing_features": missing_features,

                "required_features": FEATURES,

                "uploaded_columns": df.columns.tolist()

            }), 400


        # ------------------------------------------
        # 7. Check numerical values
        # ------------------------------------------

        model_data = df[FEATURES].copy()

        for feature in FEATURES:

            model_data[feature] = pd.to_numeric(
                model_data[feature],
                errors="coerce"
            )


        # ------------------------------------------
        # 8. Check for invalid/missing values
        # ------------------------------------------

        if model_data.isnull().any().any():

            invalid_columns = (
                model_data.columns[
                    model_data.isnull().any()
                ].tolist()
            )

            return jsonify({

                "error": "Some model features contain missing or invalid values",

                "columns": invalid_columns

            }), 400


        # ------------------------------------------
        # 9. Perform prediction
        # ------------------------------------------

        predictions = model.predict(model_data)


        # ------------------------------------------
        # 10. Add prediction to original dataframe
        # ------------------------------------------

        df["predicted_demand"] = predictions


        # ------------------------------------------
        # 11. Calculate summary information
        # ------------------------------------------

        total_records = len(df)

        average_prediction = float(
            df["predicted_demand"].mean()
        )

        minimum_prediction = float(
            df["predicted_demand"].min()
        )

        maximum_prediction = float(
            df["predicted_demand"].max()
        )


        # ------------------------------------------
        # 12. If actual demand exists,
        #     calculate evaluation metrics
        # ------------------------------------------

        metrics = None

        if "demand" in df.columns:

            from sklearn.metrics import (
                mean_absolute_error,
                mean_squared_error,
                r2_score
            )

            actual = pd.to_numeric(
                df["demand"],
                errors="coerce"
            )

            valid_rows = actual.notna()

            if valid_rows.sum() > 0:

                actual_values = actual[valid_rows]

                predicted_values = (
                    df.loc[
                        valid_rows,
                        "predicted_demand"
                    ]
                )

                mae = mean_absolute_error(
                    actual_values,
                    predicted_values
                )

                rmse = mean_squared_error(
                    actual_values,
                    predicted_values
                ) ** 0.5

                r2 = r2_score(
                    actual_values,
                    predicted_values
                )

                metrics = {

                    "mae": float(mae),

                    "rmse": float(rmse),

                    "r2": float(r2)

                }


        # ------------------------------------------
        # 13. Convert complete dataframe to JSON
        # ------------------------------------------

        records = json.loads(
            df.to_json(
                orient="records",
                date_format="iso"
            )
        )


        # ------------------------------------------
        # 14. Send result to frontend
        # ------------------------------------------

        return jsonify({

            "success": True,

            "filename": file.filename,

            "total_records": total_records,

            "columns": df.columns.tolist(),

            "average_predicted_demand":
                average_prediction,

            "minimum_predicted_demand":
                minimum_prediction,

            "maximum_predicted_demand":
                maximum_prediction,

            "metrics": metrics,

            "data": records

        })


    except Exception as e:

        return jsonify({

            "success": False,

            "error": str(e)

        }), 500


# --------------------------------------------------
# RUN SERVER
# --------------------------------------------------

if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )