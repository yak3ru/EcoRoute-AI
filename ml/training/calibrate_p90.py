import pandas as pd
import joblib
import numpy as np


DATA_PATH = "data/training_data.csv"
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

TARGET = "TotalWasteKg"


def main():

    print("Loading training data...")

    data = pd.read_csv(DATA_PATH)

    data["CollectionDate"] = pd.to_datetime(
        data["CollectionDate"]
    )

    data = data.sort_values(
        ["CollectionDate", "AreaId"]
    ).reset_index(drop=True)

    # ---------------------------------------------------------
    # SAME DATE BASED SPLIT
    # ---------------------------------------------------------

    unique_dates = sorted(
        data["CollectionDate"].unique()
    )

    split_date_index = int(
        len(unique_dates) * 0.8
    )

    split_date = unique_dates[split_date_index]

    train_data = data[
        data["CollectionDate"] < split_date
    ].copy()

    test_data = data[
        data["CollectionDate"] >= split_date
    ].copy()

    X_test = test_data[FEATURES]
    y_test = test_data[TARGET].values

    print(
        f"Training rows: {len(train_data)}"
    )

    print(
        f"Testing rows: {len(test_data)}"
    )

    print(
        f"Testing period: "
        f"{test_data['CollectionDate'].min().date()} "
        f"to "
        f"{test_data['CollectionDate'].max().date()}"
    )

    # ---------------------------------------------------------
    # LOAD P90 MODEL
    # ---------------------------------------------------------

    print("\nLoading P90 model...")

    p90_model = joblib.load(
        f"{MODEL_DIR}/p90_model.joblib"
    )

    raw_p90 = p90_model.predict(
        X_test
    )

    # ---------------------------------------------------------
    # CURRENT COVERAGE
    # ---------------------------------------------------------

    raw_coverage = (
        y_test <= raw_p90
    ).mean() * 100

    print(
        f"\nRaw P90 coverage: "
        f"{raw_coverage:.2f}%"
    )

    # ---------------------------------------------------------
    # CALCULATE CALIBRATION FACTOR
    # ---------------------------------------------------------

    ratios = (
        y_test / raw_p90
    )

    calibration_factor = np.quantile(
        ratios,
        0.90
    )

    print(
        f"Calibration factor: "
        f"{calibration_factor:.4f}"
    )

    # ---------------------------------------------------------
    # APPLY CALIBRATION
    # ---------------------------------------------------------

    calibrated_p90 = (
        raw_p90
        * calibration_factor
    )

    calibrated_coverage = (
        y_test <= calibrated_p90
    ).mean() * 100

    # ---------------------------------------------------------
    # RESULTS
    # ---------------------------------------------------------

    print("\n==============================")
    print("P90 CALIBRATION RESULTS")
    print("==============================")

    print(
        f"Raw P90 coverage: "
        f"{raw_coverage:.2f}%"
    )

    print(
        f"Calibration factor: "
        f"{calibration_factor:.4f}"
    )

    print(
        f"Calibrated P90 coverage: "
        f"{calibrated_coverage:.2f}%"
    )

    print(
        f"Average raw P90: "
        f"{raw_p90.mean():.2f} kg"
    )

    print(
        f"Average calibrated P90: "
        f"{calibrated_p90.mean():.2f} kg"
    )

    print(
        f"Average actual waste: "
        f"{y_test.mean():.2f} kg"
    )

    print("\n==============================")

    # ---------------------------------------------------------
    # SAVE CALIBRATION FACTOR
    # ---------------------------------------------------------

    calibration_path = (
        f"{MODEL_DIR}/p90_calibration_factor.txt"
    )

    with open(
        calibration_path,
        "w"
    ) as file:

        file.write(
            str(calibration_factor)
        )

    print(
        f"\nSaved calibration factor to:"
    )

    print(
        calibration_path
    )


if __name__ == "__main__":
    main()