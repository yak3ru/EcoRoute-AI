import pandas as pd
from sqlalchemy import text

from data.load_data import engine
from prediction.area_predictions import predict_areas


def load_vehicles():
    query = text("""
        SELECT
            VehicleId,
            VehicleName,
            CapacityKg,
            Status
        FROM vehicles
        WHERE IsActive = 1
          AND Status = 'Available'
        ORDER BY VehicleId;
    """)

    with engine.connect() as connection:
        return pd.read_sql(query, connection)

def format_time(value):
    if value is None:
        return "N/A"

    if hasattr(value, "total_seconds"):
        total_seconds = int(value.total_seconds())

        hours = (total_seconds // 3600) % 24
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60

        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    return str(value)


def load_constraints():
    query = text("""
        SELECT
            ConstraintId,
            VehicleCapacityKg,
            MaximumRouteDistanceKm,
            CollectionStartTime,
            CollectionEndTime,
            RoadAccessibility,
            AreaRestrictions
        FROM routing_constraints
        ORDER BY ConstraintId;
    """)

    with engine.connect() as connection:
        return pd.read_sql(query, connection)


def load_distance_matrix():
    query = text("""
        SELECT
            OriginAreaId,
            DestinationAreaId,
            DistanceKm
        FROM distance_matrix;
    """)

    with engine.connect() as connection:
        return pd.read_sql(query, connection)


def create_distance_lookup(distances):
    lookup = {}

    for _, row in distances.iterrows():

        origin = int(row["OriginAreaId"])
        destination = int(row["DestinationAreaId"])

        lookup[(origin, destination)] = float(
            row["DistanceKm"]
        )

    return lookup


def calculate_route_distance(area_ids, distance_lookup):

    total_distance = 0.0

    for i in range(len(area_ids) - 1):

        origin = area_ids[i]
        destination = area_ids[i + 1]

        distance = distance_lookup.get(
            (origin, destination)
        )

        if distance is None:
            raise ValueError(
                f"No distance found from Area {origin} "
                f"to Area {destination}"
            )

        total_distance += distance

    return round(total_distance, 2)


def optimize_route_order(
    areas,
    distance_lookup
):
    """
    Orders assigned areas using a nearest neighbor approach.
    """

    if not areas:
        return []

    remaining = areas.copy()

    first_area = remaining.pop(0)

    ordered = [first_area]

    current_area = first_area["area_id"]

    while remaining:

        next_area = min(
            remaining,
            key=lambda area:
            distance_lookup.get(
                (current_area, area["area_id"]),
                float("inf")
            )
        )

        ordered.append(next_area)

        remaining.remove(next_area)

        current_area = next_area["area_id"]

    return ordered


def optimize_routes(use_p90=False):

    predictions = predict_areas()

    vehicles = load_vehicles()

    constraints = load_constraints()

    distances = load_distance_matrix()

    distance_lookup = create_distance_lookup(
        distances
    )

    prediction_column = (
        "P90Kg"
        if use_p90
        else "P50Kg"
    )

    routes = []

    for index, vehicle in vehicles.iterrows():

        # Match each vehicle with its constraint record.
        if index >= len(constraints):

            raise ValueError(
                "There are not enough routing "
                "constraint records for the vehicles."
            )

        constraint = constraints.iloc[index]

        vehicle_capacity = float(
            vehicle["CapacityKg"]
        )

        constraint_capacity = float(
            constraint["VehicleCapacityKg"]
        )

        # Use the smaller value to remain safe.
        capacity = min(
            vehicle_capacity,
            constraint_capacity
        )

        routes.append({
            "vehicle_id": int(
                vehicle["VehicleId"]
            ),

            "vehicle_name": vehicle[
                "VehicleName"
            ],

            "capacity_kg": capacity,

            "maximum_distance_km": float(
                constraint[
                    "MaximumRouteDistanceKm"
                ]
            ),

            "collection_start": format_time(
                constraint["CollectionStartTime"]
            ),

            "collection_end": format_time(
                constraint["CollectionEndTime"]
            ),

            "road_accessibility": str(
                constraint[
                    "RoadAccessibility"
                ]
            ),

            "area_restrictions": str(
                constraint[
                    "AreaRestrictions"
                ]
            ),

            "load_kg": 0.0,

            "areas": []
        })

    # Largest predicted waste first.
    predictions = predictions.sort_values(
        prediction_column,
        ascending=False
    )

    unassigned = []

    for _, area in predictions.iterrows():

        area_id = int(area["AreaId"])

        waste = float(
            area[prediction_column]
        )

        candidates = []

        for route in routes:

            new_load = (
                route["load_kg"] + waste
            )

            if new_load <= route["capacity_kg"]:

                candidates.append(route)

        if not candidates:

            unassigned.append({
                "area_id": area_id,
                "area_name": area["AreaName"],
                "predicted_waste_kg": round(
                    waste,
                    2
                )
            })

            continue

        # Choose the truck with the
        # smallest current load.
        selected_route = min(
            candidates,
            key=lambda route:
            route["load_kg"]
        )

        selected_route["areas"].append({
            "area_id": area_id,

            "area_name": area["AreaName"],

            "predicted_waste_kg": round(
                waste,
                2
            ),

            "p10_kg": round(
                float(area["P10Kg"]),
                2
            ),

            "p50_kg": round(
                float(area["P50Kg"]),
                2
            ),

            "p90_kg": round(
                float(area["P90Kg"]),
                2
            )
        })

        selected_route["load_kg"] = round(
            selected_route["load_kg"] + waste,
            2
        )

    # Optimize the order of each truck's stops.
    for route in routes:

        if not route["areas"]:
            route["distance_km"] = 0.0

            route["remaining_capacity_kg"] = (
                route["capacity_kg"]
            )

            continue

        ordered = optimize_route_order(
            route["areas"],
            distance_lookup
        )

        route["areas"] = ordered

        area_ids = [
            area["area_id"]
            for area in ordered
        ]

        route["distance_km"] = (
            calculate_route_distance(
                area_ids,
                distance_lookup
            )
        )

        route["remaining_capacity_kg"] = round(
            route["capacity_kg"]
            - route["load_kg"],
            2
        )

        # Check maximum route distance.
        route["distance_exceeded"] = (
            route["distance_km"]
            > route["maximum_distance_km"]
        )

    return routes, unassigned


if __name__ == "__main__":

    print("\nEcoRoute AI Route Optimization")
    print("==============================")

    print("\nMode: P90 Safety Planning")

    routes, unassigned = optimize_routes(
        use_p90=True
    )

    for route in routes:

        print(
            f"\n{route['vehicle_name']}"
        )

        print(
            f"Capacity: "
            f"{route['capacity_kg']:.2f} kg"
        )

        print(
            f"Assigned load: "
            f"{route['load_kg']:.2f} kg"
        )

        print(
            f"Remaining capacity: "
            f"{route['remaining_capacity_kg']:.2f} kg"
        )

        print(
            f"Maximum route distance: "
            f"{route['maximum_distance_km']:.2f} km"
        )

        print(
            f"Route distance: "
            f"{route['distance_km']:.2f} km"
        )

        print(
            f"Collection time: "
            f"{route['collection_start']} "
            f"to "
            f"{route['collection_end']}"
        )

        print(
            f"Road access: "
            f"{route['road_accessibility']}"
        )

        print(
            f"Area restrictions: "
            f"{route['area_restrictions']}"
        )

        if route["distance_exceeded"]:

            print(
                "WARNING: Maximum route "
                "distance exceeded!"
            )

        print("Collection order:")

        for index, area in enumerate(
            route["areas"],
            start=1
        ):

            print(
                f"  {index}. "
                f"{area['area_name']} "
                f"({area['predicted_waste_kg']:.2f} kg)"
            )

    if unassigned:

        print("\nUNASSIGNED AREAS")
        print("----------------")

        for area in unassigned:

            print(
                f"{area['area_name']} "
                f"({area['predicted_waste_kg']:.2f} kg)"
            )

    else:

        print(
            "\nAll areas were successfully assigned."
        )