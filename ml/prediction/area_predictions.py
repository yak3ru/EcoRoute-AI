
import pandas as pd
import joblib

from pathlib import Path
from data.load_data import load_waste_data


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
    "CollectionGapDays",
]


def map_activity_level(value):
    mapping = {
        "Low": 1,
        "Medium": 2,
        "High": 3,
    }

    return mapping.get(value, 1)


def map_collection_frequency(value):
    mapping = {
        "Daily": 7,
        "Every 2 Days": 3.5,
        "Every 3 Days": 7 / 3,
        "Twice a Week": 2,
        "Weekly": 1,
        "Monthly": 0.25,
    }

    return mapping.get(value, 1)


def prepare_prediction_data(user_id: int):
    # Load only the authenticated user's waste data.
    raw_data = load_waste_data(user_id)

    if raw_data.empty:
        raise ValueError(
            f"No historical waste data found for user {user_id}."
        )

    raw_data["CollectionDate"] = pd.to_datetime(
        raw_data["CollectionDate"]
    )

    raw_data["ActivityLevelNumeric"] = (
        raw_data["ActivityLevel"].apply(map_activity_level)
    )

    raw_data["CollectionFrequencyNumeric"] = (
        raw_data["CollectionFrequency"].apply(
            map_collection_frequency
        )
    )

    # Aggregate waste by area and collection date.
    data = (
        raw_data.groupby(
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
                "Longitude",
            ],
            as_index=False,
        )["WeightKg"]
        .sum()
        .rename(columns={"WeightKg": "TotalWasteKg"})
    )

    # Sort chronologically for historical calculations.
    data = data.sort_values(
        ["AreaId", "CollectionDate"]
    ).reset_index(drop=True)

    # Calendar features.
    data["DayOfWeek"] = data["CollectionDate"].dt.dayofweek
    data["Month"] = data["CollectionDate"].dt.month

    # Previous collection's waste.
    data["PreviousWasteKg"] = (
        data.groupby("AreaId")["TotalWasteKg"].shift(1)
    )

    # Average of the previous seven collections.
    data["Average7WasteKg"] = (
        data.groupby("AreaId")["TotalWasteKg"].transform(
            lambda values: values.shift(1).rolling(
                7, min_periods=1
            ).mean()
        )
    )

    # Average of the previous 28 collections.
    data["Average28WasteKg"] = (
        data.groupby("AreaId")["TotalWasteKg"].transform(
            lambda values: values.shift(1).rolling(
                28, min_periods=1
            ).mean()
        )
    )

    # Waste trends.
    data["WasteTrend7Kg"] = (
        data["PreviousWasteKg"] - data["Average7WasteKg"]
    )

    data["WasteTrend28Kg"] = (
        data["Average7WasteKg"] - data["Average28WasteKg"]
    )

    # Number of days since the previous collection.
    data["PreviousCollectionDate"] = (
        data.groupby("AreaId")["CollectionDate"].shift(1)
    )

    data["CollectionGapDays"] = (
        data["CollectionDate"] - data["PreviousCollectionDate"]
    ).dt.days

    # Remove records that do not have sufficient history.
    data = data.dropna(subset=FEATURES).copy()

    if data.empty:
        raise ValueError(
            "Not enough historical collection data to generate predictions."
        )

    return data


def predict_areas(
    user_id: int,
    target_date: str | None = None,
):
    data = prepare_prediction_data(user_id)

    # Load the trained quantile models.
    p10_model = joblib.load(MODEL_DIR / "p10_model.joblib")
    p50_model = joblib.load(MODEL_DIR / "p50_model.joblib")
    p90_model = joblib.load(MODEL_DIR / "p90_model.joblib")

    # Load the P90 calibration factor.
    calibration_path = MODEL_DIR / "p90_calibration_factor.txt"

    with open(calibration_path, "r") as file:
        calibration_factor = float(file.read().strip())

    # Use the requested target date when provided.
    # Otherwise keep the existing behavior for route planning.
    if target_date:
        forecast_date = pd.Timestamp(
            target_date
        ).normalize()
    else:
        latest_history_date = (
            data["CollectionDate"].max().normalize()
        )

        tomorrow = (
            pd.Timestamp.now().normalize()
            + pd.Timedelta(days=1)
        )

        forecast_date = max(
            latest_history_date + pd.Timedelta(days=1),
            tomorrow,
        )

    future_rows = []

    # Create one forecast row for every area belonging to this user.
    for area_id, history in data.groupby("AreaId"):
        history = history.sort_values("CollectionDate").copy()

        if history.empty:
            continue

        latest = history.iloc[-1]

        previous_waste = float(latest["TotalWasteKg"])
        average_7 = float(
            history["TotalWasteKg"].tail(7).mean()
        )
        average_28 = float(
            history["TotalWasteKg"].tail(28).mean()
        )

        collection_gap = (
            forecast_date - latest["CollectionDate"]
        ).days

        future_rows.append(
            {
                "AreaId": area_id,
                "AreaName": latest["AreaName"],
                "CollectionDate": forecast_date,
                "PopulationDensity": latest["PopulationDensity"],
                "ActivityLevelNumeric": latest[
                    "ActivityLevelNumeric"
                ],
                "CollectionFrequencyNumeric": latest[
                    "CollectionFrequencyNumeric"
                ],
                "DayOfWeek": forecast_date.dayofweek,
                "Month": forecast_date.month,
                "PreviousWasteKg": previous_waste,
                "Average7WasteKg": average_7,
                "Average28WasteKg": average_28,
                "WasteTrend7Kg": previous_waste - average_7,
                "WasteTrend28Kg": average_7 - average_28,
                "CollectionGapDays": collection_gap,
            }
        )

    if not future_rows:
        raise ValueError(
            "No historical data available for prediction."
        )

    forecasts = (
        pd.DataFrame(future_rows)
        .sort_values("AreaId")
        .reset_index(drop=True)
    )

    X = forecasts[FEATURES]

    # Generate predictions from the three models.
    forecasts["P10Kg"] = p10_model.predict(X)
    forecasts["P50Kg"] = p50_model.predict(X)

    forecasts["RawP90Kg"] = p90_model.predict(X)
    forecasts["P90Kg"] = (
        forecasts["RawP90Kg"] * calibration_factor
    )

    # Prevent negative waste estimates.
    prediction_columns = [
        "P10Kg",
        "P50Kg",
        "RawP90Kg",
        "P90Kg",
    ]

    forecasts[prediction_columns] = (
        forecasts[prediction_columns].clip(lower=0)
    )

    # Enforce quantile ordering after calibration:
    # P10 <= P50 <= P90.
    #
    # Sorting each row prevents independently trained quantile
    # models from returning crossed quantile estimates.
    quantile_columns = ["P10Kg", "P50Kg", "P90Kg"]

    ordered_quantiles = forecasts[
        quantile_columns
    ].to_numpy().copy()

    ordered_quantiles.sort(axis=1)

    forecasts[quantile_columns] = ordered_quantiles

    # Round predictions for display.
    forecasts[prediction_columns] = (
        forecasts[prediction_columns].round(2)
    )

    # Return the same fields expected by the backend.
    return forecasts[
        [
            "AreaId",
            "AreaName",
            "CollectionDate",
            "P10Kg",
            "P50Kg",
            "RawP90Kg",
            "P90Kg",
        ]
    ]


def main():
    print("Loading data...")

    # Local testing only. The API supplies the authenticated user ID.
    predictions = predict_areas(user_id=2)

    print("\n==============================")
    print("AREA WASTE PREDICTIONS")
    print("==============================")

    print(predictions.to_string(index=False))

    calibration_path = MODEL_DIR / "p90_calibration_factor.txt"

    with open(calibration_path, "r") as file:
        calibration_factor = float(file.read().strip())

    print(
        f"\nP90 calibration factor: {calibration_factor:.4f}"
    )


if __name__ == "__main__":
    main()