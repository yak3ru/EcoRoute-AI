import pandas as pd

from data.load_data import load_waste_data


OUTPUT_PATH = "data/training_data.csv"


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


def main():

    print("Loading data from MySQL...")

    data = load_waste_data()

    print(f"Loaded {len(data)} completed waste records.")

    # ---------------------------------------------------------
    # PREPARE AREA FEATURES
    # ---------------------------------------------------------

    data["ActivityLevelNumeric"] = (
        data["ActivityLevel"]
        .apply(map_activity_level)
    )

    data["CollectionFrequencyNumeric"] = (
        data["CollectionFrequency"]
        .apply(map_collection_frequency)
    )

    # ---------------------------------------------------------
    # AGGREGATE WASTE
    # ---------------------------------------------------------

    grouped = (
        data
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

    grouped = grouped.sort_values(
        [
            "AreaId",
            "CollectionDate"
        ]
    ).reset_index(drop=True)

    # Make sure CollectionDate is a proper datetime
    # before using pandas datetime operations.
    grouped["CollectionDate"] = pd.to_datetime(
        grouped["CollectionDate"]
    )

    # ---------------------------------------------------------
    # CALENDAR FEATURES
    # ---------------------------------------------------------

    grouped["DayOfWeek"] = (
        grouped["CollectionDate"]
        .dt.dayofweek
    )

    grouped["Month"] = (
        grouped["CollectionDate"]
        .dt.month
    )

    # ---------------------------------------------------------
    # PREVIOUS WASTE
    # ---------------------------------------------------------

    grouped["PreviousWasteKg"] = (
        grouped
        .groupby("AreaId")["TotalWasteKg"]
        .shift(1)
    )

    # ---------------------------------------------------------
    # PREVIOUS 7 COLLECTIONS
    # ---------------------------------------------------------

    grouped["Average7WasteKg"] = (
        grouped
        .groupby("AreaId")["TotalWasteKg"]
        .transform(
            lambda values:
            values
            .shift(1)
            .rolling(
                window=7,
                min_periods=1
            )
            .mean()
        )
    )

    # ---------------------------------------------------------
    # PREVIOUS 28 COLLECTIONS
    # ---------------------------------------------------------

    grouped["Average28WasteKg"] = (
        grouped
        .groupby("AreaId")["TotalWasteKg"]
        .transform(
            lambda values:
            values
            .shift(1)
            .rolling(
                window=28,
                min_periods=1
            )
            .mean()
        )
    )

    # ---------------------------------------------------------
    # NEW FEATURE 1: SHORT TERM WASTE TREND
    # ---------------------------------------------------------

    grouped["WasteTrend7Kg"] = (
        grouped["PreviousWasteKg"]
        - grouped["Average7WasteKg"]
    )

    # ---------------------------------------------------------
    # NEW FEATURE 2: SHORT TERM VS LONG TERM TREND
    # ---------------------------------------------------------

    grouped["WasteTrend28Kg"] = (
        grouped["Average7WasteKg"]
        - grouped["Average28WasteKg"]
    )

    # ---------------------------------------------------------
    # NEW FEATURE 3: COLLECTION GAP
    # ---------------------------------------------------------

    grouped["PreviousCollectionDate"] = (
        grouped
        .groupby("AreaId")["CollectionDate"]
        .shift(1)
    )

    grouped["CollectionGapDays"] = (
        grouped["CollectionDate"]
        - grouped["PreviousCollectionDate"]
    ).dt.days

    # ---------------------------------------------------------
    # REMOVE ROWS WITHOUT HISTORY
    # ---------------------------------------------------------

    grouped = grouped.dropna(
        subset=[
            "PreviousWasteKg",
            "Average7WasteKg",
            "Average28WasteKg",
            "CollectionGapDays"
        ]
    )

    # ---------------------------------------------------------
    # SELECT FINAL TRAINING COLUMNS
    # ---------------------------------------------------------

    final_columns = [
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
        "TotalWasteKg",
        "DayOfWeek",
        "Month",
        "PreviousWasteKg",
        "Average7WasteKg",
        "Average28WasteKg",
        "WasteTrend7Kg",
        "WasteTrend28Kg",
        "CollectionGapDays"
    ]

    grouped = grouped[final_columns]

    # ---------------------------------------------------------
    # SAVE
    # ---------------------------------------------------------

    grouped.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print(
        f"\nSaved {len(grouped)} training rows."
    )

    print(
        f"Saved to: {OUTPUT_PATH}"
    )

    print("\nColumns:")

    for column in grouped.columns:
        print(f"  {column}")


if __name__ == "__main__":
    main()