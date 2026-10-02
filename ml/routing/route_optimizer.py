import itertools
from datetime import datetime, timedelta

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


def add_minutes_to_time(time_string, minutes):
    if not time_string or time_string == "N/A":
        return "N/A"

    start = datetime.strptime(
        time_string,
        "%H:%M:%S"
    )

    arrival = start + timedelta(
        minutes=float(minutes)
    )

    return arrival.strftime("%H:%M:%S")

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
            DistanceKm,
            TravelTimeMinutes
        FROM distance_matrix
    """)

    with engine.connect() as connection:
        result = connection.execute(query)
        distances = [
            dict(row._mapping)
            for row in result
        ]

    return distances




def create_distance_lookup(distances):
    return {
        (
            row["OriginAreaId"],
            row["DestinationAreaId"]
        ): float(row["DistanceKm"])
        for row in distances
    }


def create_travel_time_lookup(distances):
    return {
        (
            row["OriginAreaId"],
            row["DestinationAreaId"]
        ): float(row["TravelTimeMinutes"])
        for row in distances
    }


def load_disposal_distances():
    query = text("""
        SELECT
            addist.AreaId,
            addist.FacilityId,
            addist.DistanceKm,
            addist.TravelTimeMinutes,
            df.FacilityName,
            df.DisposalDeadline
        FROM area_disposal_distances AS addist
        INNER JOIN disposal_facilities AS df
            ON df.FacilityId = addist.FacilityId
        WHERE df.IsActive = 1
        ORDER BY addist.AreaId, addist.FacilityId
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

        return [
            dict(row._mapping)
            for row in result
        ]


def create_disposal_lookup(disposal_distances):
    return {
        row["AreaId"]: {
            "facility_id": row["FacilityId"],
            "facility_name": row["FacilityName"],
            "distance_km": float(row["DistanceKm"]),
            "travel_time_minutes": float(
                row["TravelTimeMinutes"]
            ),
            "deadline": format_time(
                row["DisposalDeadline"]
            )
        }
        for row in disposal_distances
    }


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
    Finds the shortest collection sequence for the
    assigned areas.

    For small routes, every possible stop order is
    evaluated. For larger routes, nearest neighbor
    is used to avoid excessive computation.
    """

    if not areas:
        return []

    if len(areas) == 1:
        return areas.copy()

    # Exact search is practical for the small routes
    # used by the current EcoRoute AI prototype.
    if len(areas) <= 8:

        best_order = None
        best_distance = float("inf")

        for permutation in itertools.permutations(
            areas
        ):

            area_ids = [
                area["area_id"]
                for area in permutation
            ]

            distance = calculate_route_distance(
                area_ids,
                distance_lookup
            )

            if distance < best_distance:

                best_distance = distance
                best_order = list(
                    permutation
                )

        return best_order

    # Fallback for larger routes.
    remaining = areas.copy()

    first_area = remaining.pop(0)

    ordered = [first_area]

    current_area = first_area["area_id"]

    while remaining:

        next_area = min(
            remaining,
            key=lambda area:
            distance_lookup.get(
                (
                    current_area,
                    area["area_id"]
                ),
                float("inf")
            )
        )

        ordered.append(next_area)

        remaining.remove(next_area)

        current_area = next_area

    return ordered

def reroute_route(
    vehicle_id,
    use_p90=False
):
    """
    Generates an alternative valid collection sequence
    for one selected vehicle.

    The area assignments remain unchanged.
    Only the collection order is changed.

    Live traffic and live road closure data are not used.
    """

    routes, unassigned = optimize_routes(
        use_p90=use_p90
    )

    distances = load_distance_matrix()

    distance_lookup = create_distance_lookup(
        distances
    )

    selected_route = next(
        (
            route
            for route in routes
            if route["vehicle_id"] == vehicle_id
        ),
        None
    )

    if selected_route is None:
        raise ValueError(
            f"Vehicle {vehicle_id} does not have an assigned route."
        )

    areas = selected_route["areas"]

    if len(areas) < 2:
        return (
            routes,
            unassigned,
            False
        )

    current_order = [
        area["area_id"]
        for area in areas
    ]

    alternative_routes = []

    for permutation in itertools.permutations(
        areas
    ):

        area_ids = [
            area["area_id"]
            for area in permutation
        ]

        # Do not return the exact same sequence.
        if area_ids == current_order:
            continue

        distance = calculate_route_distance(
            area_ids,
            distance_lookup
        )

        # Alternative route must still respect
        # the vehicle's maximum route distance.
        if (
            distance
            <= selected_route[
                "maximum_distance_km"
            ]
        ):

            alternative_routes.append(
                (
                    distance,
                    list(permutation)
                )
            )

    if not alternative_routes:
        return (
            routes,
            unassigned,
            False
        )

    # Select the shortest valid alternative.
    alternative_routes.sort(
        key=lambda item: item[0]
    )

    new_distance, new_order = (
        alternative_routes[0]
    )

    selected_route["areas"] = new_order

    selected_route["distance_km"] = (
        new_distance
    )

    selected_route[
        "remaining_capacity_kg"
    ] = round(
        selected_route["capacity_kg"]
        - selected_route["load_kg"],
        2
    )

    selected_route[
        "distance_exceeded"
    ] = (
        new_distance
        > selected_route[
            "maximum_distance_km"
        ]
    )

    return (
        routes,
        unassigned,
        True
    )


def optimize_routes(use_p90=False):

    predictions = predict_areas()

    vehicles = load_vehicles()

    constraints = load_constraints()

    distances = load_distance_matrix()

    distance_lookup = create_distance_lookup(
        distances
    )

    travel_time_lookup = create_travel_time_lookup(
        distances
    )

    disposal_distances = load_disposal_distances()

    disposal_lookup = create_disposal_lookup(
        disposal_distances
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
            route["travel_time_minutes"] = 0.0
            route["disposal_distance_km"] = 0.0
            route["disposal_travel_time_minutes"] = 0.0
            route["estimated_srp_arrival"] = "N/A"
            route["disposal_deadline"] = "N/A"
            route["deadline_check"] = "No assigned areas"
            route["remaining_capacity_kg"] = route["capacity_kg"]
            route["distance_exceeded"] = False
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

        # Distance and driving time between collection areas.
        collection_distance = calculate_route_distance(
            area_ids,
            distance_lookup
        )

        collection_travel_time = 0.0

        for i in range(len(area_ids) - 1):
            origin = area_ids[i]
            destination = area_ids[i + 1]

            travel_time = travel_time_lookup.get(
                (origin, destination)
            )

            if travel_time is None:
                raise ValueError(
                    f"No travel time found from Area {origin} "
                    f"to Area {destination}."
                )

            collection_travel_time += float(travel_time)

        # Include the final trip from the last collection area to SRP.
        last_area_id = area_ids[-1]

        disposal = disposal_lookup.get(last_area_id)

        if disposal is None:
            raise ValueError(
                f"No active disposal route found for Area "
                f"{last_area_id}."
            )

        disposal_distance = disposal["distance_km"]
        disposal_travel_time = disposal["travel_time_minutes"]

        total_distance = round(
            collection_distance + disposal_distance,
            2
        )

        total_driving_time = round(
            collection_travel_time + disposal_travel_time,
            2
        )

        # This is a driving-only estimate.
        # It does not include waste collection or unloading duration.
        estimated_arrival = add_minutes_to_time(
            route["collection_start"],
            total_driving_time
        )

        deadline = disposal["deadline"]

        estimated_arrival_time = datetime.strptime(
            estimated_arrival,
            "%H:%M:%S"
        ).time()

        deadline_time = datetime.strptime(
            deadline,
            "%H:%M:%S"
        ).time()

        route["distance_km"] = total_distance
        route["collection_distance_km"] = collection_distance
        route["disposal_distance_km"] = disposal_distance

        route["travel_time_minutes"] = total_driving_time
        route["collection_travel_time_minutes"] = round(
            collection_travel_time,
            2
        )
        route["disposal_travel_time_minutes"] = round(
            disposal_travel_time,
            2
        )

        route["disposal_facility"] = disposal["facility_name"]
        route["estimated_srp_arrival"] = estimated_arrival
        route["disposal_deadline"] = deadline

        route["deadline_check"] = (
            "Estimated arrival within deadline"
            if estimated_arrival_time <= deadline_time
            else "WARNING: Estimated arrival after deadline"
        )

        route["remaining_capacity_kg"] = round(
            route["capacity_kg"] - route["load_kg"],
            2
        )

        # Maximum route distance includes the SRP disposal trip.
        route["distance_exceeded"] = (
            total_distance > route["maximum_distance_km"]
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
            f"Collection area distance: "
            f"{route.get('collection_distance_km', 0):.2f} km"
        )

        print(
            f"Distance to SRP: "
            f"{route.get('disposal_distance_km', 0):.2f} km"
        )

        print(
            f"Estimated driving time: "
            f"{route.get('travel_time_minutes', 0):.2f} minutes"
        )

        print(
            f"Estimated SRP arrival: "
            f"{route.get('estimated_srp_arrival', 'N/A')}"
        )

        print(
            f"SRP disposal deadline: "
            f"{route.get('disposal_deadline', 'N/A')}"
        )

        print(
            f"Deadline check: "
            f"{route.get('deadline_check', 'Not calculated')}"
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