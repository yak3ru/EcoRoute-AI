import pandas as pd
import joblib

from data.load_data import load_waste_data


MODEL_DIR = "models"


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

    # ---------------------------------------------------------
    # LOAD MODELS
    # ---------------------------------------------------------

    p10_model = joblib.load(
        f"{MODEL_DIR}/p10_model.joblib"
    )

    p50_model = joblib.load(
        f"{MODEL_DIR}/p50_model.joblib"
    )

    p90_model = joblib.load(
        f"{MODEL_DIR}/p90_model.joblib"
    )

    # ---------------------------------------------------------
    # LOAD P90 CALIBRATION
    # ---------------------------------------------------------

    with open(
        f"{MODEL_DIR}/p90_calibration_factor.txt",
        "r"
    ) as file:

        calibration_factor = float(
            file.read().strip()
        )

    # ---------------------------------------------------------
    # MOST RECENT USABLE RECORD PER AREA
    # ---------------------------------------------------------

    latest = (
        data
        .sort_values("CollectionDate")
        .groupby("AreaId")
        .tail(1)
        .copy()
    )

    X = latest[FEATURES]

    # ---------------------------------------------------------
    # PREDICTIONS
    # ---------------------------------------------------------

    latest["P10Kg"] = (
        p10_model.predict(X)
    )

    latest["P50Kg"] = (
        p50_model.predict(X)
    )

    raw_p90 = p90_model.predict(X)

    latest["RawP90Kg"] = raw_p90

    latest["P90Kg"] = (
        raw_p90
        * calibration_factor
    )

    # ---------------------------------------------------------
    # ROUND VALUES
    # ---------------------------------------------------------

    prediction_columns = [
        "P10Kg",
        "P50Kg",
        "RawP90Kg",
        "P90Kg"
    ]

    latest[prediction_columns] = (
        latest[prediction_columns]
        .round(2)
    )

    return latest[
        [
            "AreaId",
            "AreaName",
            "CollectionDate",
            "P10Kg",
            "P50Kg",
            "RawP90Kg",
            "P90Kg"
        ]
    ].sort_values("AreaId").reset_index(
        drop=True
    )


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