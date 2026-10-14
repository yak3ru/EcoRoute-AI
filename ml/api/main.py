
import os
import secrets
import logging

from fastapi import Depends, FastAPI, Header, HTTPException, Query

from prediction.area_predictions import predict_areas
from routing.route_optimizer import (
    optimize_routes,
    reroute_route,
)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ecoroute.ml")

app = FastAPI(
    title="EcoRoute AI ML API",
    description="Machine learning prediction and route optimization API",
    version="1.0.0",
)
ML_SERVICE_KEY = os.getenv("ML_SERVICE_KEY")

print(
    "ML key fingerprint:",
    ML_SERVICE_KEY[:8] if ML_SERVICE_KEY else "NONE"
)

def verify_ml_service_key(
    x_ml_service_key: str | None = Header(default=None),
):
    if not ML_SERVICE_KEY or not x_ml_service_key:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized ML service request.",
        )

    if not secrets.compare_digest(
        x_ml_service_key,
        ML_SERVICE_KEY,
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized ML service request.",
        )


def is_missing_history(error: Exception) -> bool:
    """
    Identify expected situations where an account has no
    historical waste data available for ML processing.
    """
    message = str(error).lower()

    return (
        "no historical waste data found" in message
        or "not enough historical collection data" in message
    )


@app.get("/")
def root():
    return {
        "message": "EcoRoute AI ML API is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.get(
    "/predictions",
    dependencies=[Depends(verify_ml_service_key)],
)
def get_predictions(
    user_id: int = Query(..., ge=1),
    target_date: str | None = Query(default=None),
):
    try:
        predictions = predict_areas(user_id=user_id, target_date=target_date)

        return {
            "status": "success",
            "count": len(predictions),
            "predictions": predictions.to_dict(
                orient="records"
            ),
        }

    except ValueError as error:
        if is_missing_history(error):
            logger.info(
                "No prediction history available for user_id=%s",
                user_id,
            )

            return {
                "status": "no_data",
                "message": (
                    "No historical waste data is available "
                    "for this account. Import collection data "
                    "to generate predictions."
                ),
                "count": 0,
                "predictions": [],
            }

        logger.exception(
            "Prediction data error for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=400,
            detail="Unable to generate predictions from the available data.",
        )

    except Exception:
        logger.exception(
            "Prediction failed for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate predictions.",
        )


@app.get(
    "/routes",
    dependencies=[Depends(verify_ml_service_key)],
)
def get_routes(user_id: int = Query(..., ge=1)):
    try:
        routes, unassigned = optimize_routes(
            user_id=user_id,
            use_p90=False,
        )

        return {
            "status": "success",
            "mode": "P50 Normal Planning",
            "routes": routes,
            "unassigned": unassigned,
        }

    except ValueError as error:
        if is_missing_history(error):
            logger.info(
                "No route-planning history available for user_id=%s",
                user_id,
            )

            return {
                "status": "no_data",
                "message": (
                    "Historical waste data is required "
                    "before routes can be optimized."
                ),
                "routes": [],
                "unassigned": [],
            }

        logger.exception(
            "Route optimization data error for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=400,
            detail="Unable to optimize routes with the available data.",
        )

    except Exception:
        logger.exception(
            "Route optimization failed for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to optimize routes.",
        )


@app.get(
    "/routes/p90",
    dependencies=[Depends(verify_ml_service_key)],
)
def get_p90_routes(user_id: int = Query(..., ge=1)):
    try:
        routes, unassigned = optimize_routes(
            user_id=user_id,
            use_p90=True,
        )

        return {
            "status": "success",
            "mode": "P90 Safety Planning",
            "routes": routes,
            "unassigned": unassigned,
        }

    except ValueError as error:
        if is_missing_history(error):
            logger.info(
                "No P90 route-planning history available for user_id=%s",
                user_id,
            )

            return {
                "status": "no_data",
                "message": (
                    "Historical waste data is required "
                    "before P90 routes can be optimized."
                ),
                "routes": [],
                "unassigned": [],
            }

        logger.exception(
            "P90 route optimization data error for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=400,
            detail="Unable to optimize P90 routes with the available data.",
        )

    except Exception:
        logger.exception(
            "P90 route optimization failed for user_id=%s",
            user_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to optimize P90 routes.",
        )


@app.get(
    "/routes/p90/reroute/{vehicle_id}",
    dependencies=[Depends(verify_ml_service_key)],
)
def get_p90_reroute(
    vehicle_id: int,
    user_id: int = Query(..., ge=1),
):
    try:
        routes, unassigned, changed = reroute_route(
            user_id=user_id,
            vehicle_id=vehicle_id,
            use_p90=True,
        )

        return {
            "status": "success",
            "mode": "P90 Reroute",
            "rerouted_vehicle_id": vehicle_id,
            "alternative_route_found": changed,
            "routes": routes,
            "unassigned": unassigned,
        }

    except ValueError as error:
        if is_missing_history(error):
            logger.info(
                "No rerouting history available for user_id=%s",
                user_id,
            )

            return {
                "status": "no_data",
                "message": (
                    "Historical waste data is required "
                    "before a vehicle route can be rerouted."
                ),
                "rerouted_vehicle_id": vehicle_id,
                "alternative_route_found": False,
                "routes": [],
                "unassigned": [],
            }

        logger.warning(
            "Rerouting request rejected for user_id=%s, vehicle_id=%s: %s",
            user_id,
            vehicle_id,
            error,
        )

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception:
        logger.exception(
            "Rerouting failed for user_id=%s, vehicle_id=%s",
            user_id,
            vehicle_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to reroute vehicle.",
        )