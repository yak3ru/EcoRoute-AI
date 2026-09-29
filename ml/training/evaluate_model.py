import pandas as pd
import joblib

from sklearn.metrics import mean_absolute_error, mean_squared_error


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


def rmse(actual, predicted):
    return mean_squared_error(actual, predicted) ** 0.5


def wape(actual, predicted):
    return (
        abs(actual - predicted).sum()
        / abs(actual).sum()
    ) * 100


def main():

    print("Loading training data...")

    data = pd.read_csv(DATA_PATH)

    data["CollectionDate"] = pd.to_datetime(
        data["CollectionDate"]
    )

    # Keep the same chronological ordering used during training
    data = data.sort_values(
        ["CollectionDate", "AreaId"]
    ).reset_index(drop=True)

    X = data[FEATURES]
    y = data[TARGET]

    # Same date based split used by train_model.py
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

    X_train = train_data[FEATURES]
    X_test = test_data[FEATURES]

    y_train = train_data[TARGET]
    y_test = test_data[TARGET]

    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")

    print(
        f"Testing period: "
        f"{test_data['CollectionDate'].min().date()} "
        f"to "
        f"{test_data['CollectionDate'].max().date()}"
    )

    # ---------------------------------------------------------
    # LOAD MODELS
    # ---------------------------------------------------------

    print("\nLoading trained models...")

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
    # PREDICTIONS
    # ---------------------------------------------------------

    p10_predictions = p10_model.predict(X_test)
    p50_predictions = p50_model.predict(X_test)
    p90_predictions = p90_model.predict(X_test)

    # ---------------------------------------------------------
    # P50 EVALUATION
    # ---------------------------------------------------------

    p50_mae = mean_absolute_error(
        y_test,
        p50_predictions
    )

    p50_rmse = rmse(
        y_test,
        p50_predictions
    )

    p50_wape = wape(
        y_test,
        p50_predictions
    )

    # ---------------------------------------------------------
    # HISTORICAL AVERAGE BASELINE
    # ---------------------------------------------------------

    # Calculate the average waste for each area using only
    # records that occurred before the current record.

    data["HistoricalAverageKg"] = (
        data
        .groupby("AreaId")[TARGET]
        .transform(
            lambda values:
            values.shift(1).expanding().mean()
        )
    )

    baseline_predictions = (
        data[
            data["CollectionDate"] >= split_date
        ]["HistoricalAverageKg"]
        .values
    )

    # Remove rows where there is no historical average.
    valid_baseline = ~pd.isna(baseline_predictions)

    baseline_actual = y_test.values[valid_baseline]
    baseline_predictions = baseline_predictions[valid_baseline]

    baseline_mae = mean_absolute_error(
        baseline_actual,
        baseline_predictions
    )

    baseline_rmse = rmse(
        baseline_actual,
        baseline_predictions
    )

    baseline_wape = wape(
        baseline_actual,
        baseline_predictions
    )

    # ---------------------------------------------------------
    # P90 COVERAGE
    # ---------------------------------------------------------

    # Measures how often the actual waste is at or below
    # the P90 prediction.

    p90_coverage = (
        (y_test.values <= p90_predictions).mean()
    ) * 100

    # ---------------------------------------------------------
    # RESULTS
    # ---------------------------------------------------------

    print("\n==============================")
    print("MODEL EVALUATION RESULTS")
    print("==============================")

    print("\nP50 MODEL")
    print(f"MAE:  {p50_mae:.2f} kg")
    print(f"RMSE: {p50_rmse:.2f} kg")
    print(f"WAPE: {p50_wape:.2f}%")

    print("\nHISTORICAL AVERAGE BASELINE")
    print(f"MAE:  {baseline_mae:.2f} kg")
    print(f"RMSE: {baseline_rmse:.2f} kg")
    print(f"WAPE: {baseline_wape:.2f}%")

    print("\nP90 MODEL")
    print(f"Coverage: {p90_coverage:.2f}%")

    print("\n==============================")

    print("\nInterpretation:")

    if p50_wape < baseline_wape:
        print(
            "P50 WAPE is lower than the historical "
            "average baseline."
        )
    else:
        print(
            "P50 WAPE is not lower than the historical "
            "average baseline."
        )

    print(
        f"P90 coverage is {p90_coverage:.2f}%. "
        "A nominal P90 prediction aims for approximately "
        "90% coverage."
    )


if __name__ == "__main__":
    main()