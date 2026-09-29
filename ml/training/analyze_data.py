import pandas as pd


DATA_PATH = "data/training_data.csv"


def main():

    print("Loading training data...")

    data = pd.read_csv(DATA_PATH)

    data["CollectionDate"] = pd.to_datetime(
        data["CollectionDate"]
    )

    print(f"Total usable records: {len(data)}")
    print(
        f"Date range: "
        f"{data['CollectionDate'].min().date()} "
        f"to "
        f"{data['CollectionDate'].max().date()}"
    )

    # ---------------------------------------------------------
    # OVERALL WASTE STATISTICS
    # ---------------------------------------------------------

    print("\n==============================")
    print("OVERALL WASTE STATISTICS")
    print("==============================")

    print(
        f"Average waste: "
        f"{data['TotalWasteKg'].mean():.2f} kg"
    )

    print(
        f"Minimum waste: "
        f"{data['TotalWasteKg'].min():.2f} kg"
    )

    print(
        f"Maximum waste: "
        f"{data['TotalWasteKg'].max():.2f} kg"
    )

    print(
        f"Standard deviation: "
        f"{data['TotalWasteKg'].std():.2f} kg"
    )

    # ---------------------------------------------------------
    # AREA STATISTICS
    # ---------------------------------------------------------

    area_stats = (
        data
        .groupby(
            ["AreaId", "AreaName"]
        )["TotalWasteKg"]
        .agg(
            [
                "count",
                "mean",
                "min",
                "max",
                "std"
            ]
        )
        .reset_index()
    )

    area_stats = area_stats.rename(
        columns={
            "count": "Records",
            "mean": "AverageKg",
            "min": "MinimumKg",
            "max": "MaximumKg",
            "std": "StdDevKg"
        }
    )

    area_stats["RangeKg"] = (
        area_stats["MaximumKg"]
        - area_stats["MinimumKg"]
    )

    area_stats = area_stats.sort_values(
        "AverageKg",
        ascending=False
    )

    print("\n==============================")
    print("WASTE STATISTICS BY AREA")
    print("==============================")

    print(
        area_stats.to_string(
            index=False,
            formatters={
                "AverageKg": "{:.2f}".format,
                "MinimumKg": "{:.2f}".format,
                "MaximumKg": "{:.2f}".format,
                "StdDevKg": "{:.2f}".format,
                "RangeKg": "{:.2f}".format
            }
        )
    )

    # ---------------------------------------------------------
    # AREA INFORMATION
    # ---------------------------------------------------------

    area_info = (
        data[
            [
                "AreaId",
                "AreaName",
                "PopulationDensity",
                "ActivityLevel",
                "CollectionFrequency"
            ]
        ]
        .drop_duplicates(
            subset=["AreaId"]
        )
    )

    print("\n==============================")
    print("AREA INFORMATION")
    print("==============================")

    print(
        area_info
        .sort_values("AreaId")
        .to_string(index=False)
    )

    # ---------------------------------------------------------
    # WASTE TYPE DISTRIBUTION
    # ---------------------------------------------------------

    # The training data already aggregates waste by date
    # and area, so this section checks the original data
    # only if WasteType is available.

    if "WasteType" in data.columns:

        print("\n==============================")
        print("WASTE TYPE DISTRIBUTION")
        print("==============================")

        waste_type_stats = (
            data
            .groupby("WasteType")["TotalWasteKg"]
            .agg(
                [
                    "count",
                    "mean",
                    "min",
                    "max"
                ]
            )
            .reset_index()
        )

        print(
            waste_type_stats.to_string(
                index=False
            )
        )

    # ---------------------------------------------------------
    # DAY OF WEEK PATTERN
    # ---------------------------------------------------------

    day_stats = (
        data
        .groupby("DayOfWeek")["TotalWasteKg"]
        .agg(
            [
                "count",
                "mean",
                "min",
                "max"
            ]
        )
        .reset_index()
    )

    print("\n==============================")
    print("WASTE BY DAY OF WEEK")
    print("==============================")

    print(
        day_stats.to_string(
            index=False,
            formatters={
                "mean": "{:.2f}".format,
                "min": "{:.2f}".format,
                "max": "{:.2f}".format
            }
        )
    )

    # ---------------------------------------------------------
    # MONTH PATTERN
    # ---------------------------------------------------------

    month_stats = (
        data
        .groupby("Month")["TotalWasteKg"]
        .agg(
            [
                "count",
                "mean",
                "min",
                "max"
            ]
        )
        .reset_index()
    )

    print("\n==============================")
    print("WASTE BY MONTH")
    print("==============================")

    print(
        month_stats.to_string(
            index=False,
            formatters={
                "mean": "{:.2f}".format,
                "min": "{:.2f}".format,
                "max": "{:.2f}".format
            }
        )
    )

    print("\n==============================")
    print("ANALYSIS COMPLETE")
    print("==============================")


if __name__ == "__main__":
    main()