import pandas as pd
import joblib

from sklearn.ensemble import GradientBoostingRegressor
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


def train_model(alpha, X_train, y_train):

    model = GradientBoostingRegressor(
        loss="quantile",
        alpha=alpha,
        n_estimators=300,
        max_depth=4,
        learning_rate=0.06,
        random_state=42
    )

    model.fit(X_train, y_train)

    return model


def main():

    print("Loading training data...")

    data = pd.read_csv(DATA_PATH)

    data["CollectionDate"] = pd.to_datetime(
        data["CollectionDate"]
    )

    # Sort by date first so the dataset follows time order.
    data = data.sort_values(
        ["CollectionDate", "AreaId"]
    ).reset_index(drop=True)

    # ---------------------------------------------------------
    # DATE BASED 80/20 SPLIT
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

    X_train = train_data[FEATURES]
    X_test = test_data[FEATURES]

    y_train = train_data[TARGET]
    y_test = test_data[TARGET]

    print(f"Training rows: {len(train_data)}")
    print(f"Testing rows: {len(test_data)}")

    print(
        f"Training period: "
        f"{train_data['CollectionDate'].min().date()} "
        f"to "
        f"{train_data['CollectionDate'].max().date()}"
    )

    print(
        f"Testing period: "
        f"{test_data['CollectionDate'].min().date()} "
        f"to "
        f"{test_data['CollectionDate'].max().date()}"
    )

    print(
        f"Split date: {split_date.date()}"
    )

    # ---------------------------------------------------------
    # TRAIN P10, P50, P90
    # ---------------------------------------------------------

    models = {
        "p10": 0.10,
        "p50": 0.50,
        "p90": 0.90
    }

    for name, alpha in models.items():

        print(
            f"\nTraining {name.upper()} model..."
        )

        model = train_model(
            alpha,
            X_train,
            y_train
        )

        predictions = model.predict(X_test)

        mae = mean_absolute_error(
            y_test,
            predictions
        )

        rmse = mean_squared_error(
            y_test,
            predictions
        ) ** 0.5

        print(
            f"{name.upper()} MAE: "
            f"{mae:.2f} kg"
        )

        print(
            f"{name.upper()} RMSE: "
            f"{rmse:.2f} kg"
        )

        model_path = (
            f"{MODEL_DIR}/{name}_model.joblib"
        )

        joblib.dump(
            model,
            model_path
        )

        print(
            f"Saved: {model_path}"
        )


if __name__ == "__main__":
    main()