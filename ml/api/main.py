from fastapi import FastAPI, HTTPException

from prediction.area_predictions import predict_areas
from routing.route_optimizer import (
    optimize_routes,
    reroute_route
)

app = FastAPI(
    title="EcoRoute AI ML API",
    description="Machine learning prediction and route optimization API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "EcoRoute AI ML API is running",
        "status": "success"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/predictions")
def get_predictions():

    try:

        predictions = predict_areas()

        return {
            "status": "success",
            "count": len(predictions),
            "predictions": predictions.to_dict(
                orient="records"
            )
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@app.get("/routes")
def get_routes():

    try:

        routes, unassigned = optimize_routes(
            use_p90=False
        )

        return {
            "status": "success",
            "mode": "P50 Normal Planning",
            "routes": routes,
            "unassigned": unassigned
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )



@app.get("/routes/p90")
def get_p90_routes():

    try:
        routes, unassigned = optimize_routes(
            use_p90=True
        )

        return {
            "status": "success",
            "mode": "P90 Safety Planning",
            "routes": routes,
            "unassigned": unassigned
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@app.get("/routes/p90/reroute/{vehicle_id}")
def get_p90_reroute(vehicle_id: int):

    try:
        routes, unassigned, changed = reroute_route(
            vehicle_id=vehicle_id,
            use_p90=True
        )

        return {
            "status": "success",
            "mode": "P90 Reroute",
            "rerouted_vehicle_id": vehicle_id,
            "alternative_route_found": changed,
            "routes": routes,
            "unassigned": unassigned
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )