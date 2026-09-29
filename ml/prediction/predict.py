import joblib


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


def load_models():

    p10_model = joblib.load(
        f"{MODEL_DIR}/p10_model.joblib"
    )

    p50_model = joblib.load(
        f"{MODEL_DIR}/p50_model.joblib"
    )

    p90_model = joblib.load(
        f"{MODEL_DIR}/p90_model.joblib"
    )

    return (
        p10_model,
        p50_model,
        p90_model
    )


def load_p90_calibration():

    calibration_path = (
        f"{MODEL_DIR}/p90_calibration_factor.txt"
    )

    with open(
        calibration_path,
        "r"
    ) as file:

        return float(
            file.read().strip()
        )


def predict_waste(feature_row):

    (
        p10_model,
        p50_model,
        p90_model
    ) = load_models()

    calibration_factor = (
        load_p90_calibration()
    )

    p10 = p10_model.predict(
        feature_row
    )[0]

    p50 = p50_model.predict(
        feature_row
    )[0]

    raw_p90 = p90_model.predict(
        feature_row
    )[0]

    calibrated_p90 = (
        raw_p90
        * calibration_factor
    )

    return {
        "P10Kg": round(p10, 2),
        "P50Kg": round(p50, 2),
        "P90Kg": round(calibrated_p90, 2)
    }