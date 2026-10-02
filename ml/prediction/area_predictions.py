import pandas as pd
import joblib

from data.load_data import load_waste_data


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "models"


FEATURES = [
    "AreaId",
    "PopulationDensity",
    "ActivityLevelNumeric",
    "CollectionFrequencyNumeric",
    "DayOfWeek",
    "Month",
    "PreviousWasteKg",
    "Average7WasteKg",
    "Average28WasteKg",
    "WasteTrend7Kg",
    "WasteTrend28Kg",
    "CollectionGapDays"
]


def map_activity_level(value):

    mapping = {
        "Low": 1,
        "Medium": 2,
        "High": 3
    }

    return mapping.get(value, 1)


def map_collection_frequency(value):

    mapping = {
        "Daily": 7,
        "Every 2 Days": 3.5,
        "Every 3 Days": 7 / 3,
        "Twice a Week": 2,
        "Weekly": 1,
        "Monthly": 0.25
    }

    return mapping.get(value, 1)


def prepare_prediction_data():

    raw_data = load_waste_data()

    raw_data["CollectionDate"] = pd.to_datetime(
        raw_data["CollectionDate"]
    )

    raw_data["ActivityLevelNumeric"] = (
        raw_data["ActivityLevel"]
        .apply(map_activity_level)
    )

    raw_data["CollectionFrequencyNumeric"] = (
        raw_data["CollectionFrequency"]
        .apply(map_collection_frequency)
    )

    # ---------------------------------------------------------
    # AGGREGATE WASTE
    # ---------------------------------------------------------

    data = (
        raw_data
        .groupby(
            [
                "AreaId",
                "AreaName",
                "CollectionDate",
                "PopulationDensity",
                "ActivityLevel",
                "CollectionFrequency",
                "ActivityLevelNumeric",
                "CollectionFrequencyNumeric",
                "Latitude",
                "Longitude"
            ],
            as_index=False
        )["WeightKg"]
        .sum()
        .rename(
            columns={
                "WeightKg": "TotalWasteKg"
            }
        )
    )

    # ---------------------------------------------------------
    # SORT BY AREA AND DATE
    # ---------------------------------------------------------

    data = data.sort_values(
        [
            "AreaId",
            "CollectionDate"
        ]
    ).reset_index(drop=True)

    # ---------------------------------------------------------
    # CALENDAR FEATURES
    # ---------------------------------------------------------

    data["DayOfWeek"] = (
        data["CollectionDate"]
        .dt.dayofweek
    )

    data["Month"] = (
        data["CollectionDate"]
        .dt.month
    )

    # ---------------------------------------------------------
    # PREVIOUS WASTE
    # ---------------------------------------------------------

    data["PreviousWasteKg"] = (
        data
        .groupby("AreaId")["TotalWasteKg"]
        .shift(1)
    )

    # ---------------------------------------------------------
    # 7 COLLECTION AVERAGE
    # ---------------------------------------------------------

    data["Average7WasteKg"] = (
        data
        .groupby("AreaId")["TotalWasteKg"]
        .transform(
            lambda values:
            values
            .shift(1)
            .rolling(
                7,
                min_periods=1
            )
            .mean()
        )
    )

    # ---------------------------------------------------------
    # 28 COLLECTION AVERAGE
    # ---------------------------------------------------------

    data["Average28WasteKg"] = (
        data
        .groupby("AreaId")["TotalWasteKg"]
        .transform(
            lambda values:
            values
            .shift(1)
            .rolling(
                28,
                min_periods=1
            )
            .mean()
        )
    )

    # ---------------------------------------------------------
    # WASTE TRENDS
    # ---------------------------------------------------------

    data["WasteTrend7Kg"] = (
        data["PreviousWasteKg"]
        - data["Average7WasteKg"]
    )

    data["WasteTrend28Kg"] = (
        data["Average7WasteKg"]
        - data["Average28WasteKg"]
    )

    # ---------------------------------------------------------
    # COLLECTION GAP
    # ---------------------------------------------------------

    data["PreviousCollectionDate"] = (
        data
        .groupby("AreaId")["CollectionDate"]
        .shift(1)
    )

    data["CollectionGapDays"] = (
        data["CollectionDate"]
        - data["PreviousCollectionDate"]
    ).dt.days

    # ---------------------------------------------------------
    # REMOVE RECORDS WITHOUT HISTORY
    # ---------------------------------------------------------

    data = data.dropna(
        subset=FEATURES
    ).copy()

    return data



def predict_areas():

    data = prepare_prediction_data()

    # Load trained models
    p10_model = joblib.load(MODEL_DIR / "p10_model.joblib")
    p50_model = joblib.load(MODEL_DIR / "p50_model.joblib")
    p90_model = joblib.load(MODEL_DIR / "p90_model.joblib")

    # Load P90 calibration factor
    with open(MODEL_DIR / "p90_calibration_factor.txt", "r") as file:
        calibration_factor = float(file.read().strip())

    future_rows = []

    # Use one forecast date for all areas
    forecast_date = data["CollectionDate"].max() + pd.Timedelta(days=1)

    # Build a forecast for the next day for each area
    for area_id, history in data.groupby("AreaId"):

        history = history.sort_values("CollectionDate").copy()

        if history.empty:
            continue

        latest = history.iloc[-1]
        future_date = forecast_date

        # Use historical observations available before the forecast date
        previous_waste = float(latest["TotalWasteKg"])
        average_7 = float(history["TotalWasteKg"].tail(7).mean())
        average_28 = float(history["TotalWasteKg"].tail(28).mean())

        # Calculate the next day's collection gap
        collection_gap = (
            future_date - latest["CollectionDate"]
        ).days

        future_rows.append({
            "AreaId": area_id,
            "AreaName": latest["AreaName"],
            "CollectionDate": future_date,
            "PopulationDensity": latest["PopulationDensity"],
            "ActivityLevelNumeric": latest["ActivityLevelNumeric"],
            "CollectionFrequencyNumeric": latest["CollectionFrequencyNumeric"],
            "DayOfWeek": future_date.dayofweek,
            "Month": future_date.month,
            "PreviousWasteKg": previous_waste,
            "Average7WasteKg": average_7,
            "Average28WasteKg": average_28,
            "WasteTrend7Kg": previous_waste - average_7,
            "WasteTrend28Kg": average_7 - average_28,
            "CollectionGapDays": collection_gap
        })

    if not future_rows:
        raise ValueError("No historical data available for prediction.")

    forecasts = pd.DataFrame(future_rows).sort_values("AreaId").reset_index(drop=True)

    X = forecasts[FEATURES]

    # Generate forecasts
    forecasts["P10Kg"] = p10_model.predict(X)
    forecasts["P50Kg"] = p50_model.predict(X)

    forecasts["RawP90Kg"] = p90_model.predict(X)
    forecasts["P90Kg"] = forecasts["RawP90Kg"] * calibration_factor

    # Prevent negative waste estimates
    prediction_columns = ["P10Kg", "P50Kg", "RawP90Kg", "P90Kg"]
    forecasts[prediction_columns] = forecasts[prediction_columns].clip(lower=0)

    # Round predictions
    forecasts[prediction_columns] = forecasts[prediction_columns].round(2)

    return forecasts[
        [
            "AreaId",
            "AreaName",
            "CollectionDate",
            "P10Kg",
            "P50Kg",
            "RawP90Kg",
            "P90Kg"
        ]
    ]

def main():

    print("Loading data...")

    predictions = predict_areas()

    print("\n==============================")
    print("AREA WASTE PREDICTIONS")
    print("==============================")

    print(
        predictions.to_string(
            index=False
        )
    )

    with open(
        f"{MODEL_DIR}/p90_calibration_factor.txt",
        "r"
    ) as file:

        calibration_factor = float(
            file.read().strip()
        )

    print(
        f"\nP90 calibration factor: "
        f"{calibration_factor:.4f}"
    )


if __name__ == "__main__":
    main()