import argparse
import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

import pymysql
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def request_osrm_table(locations, label):
    """Return road distances (meters) and durations (seconds) for coordinates."""
    coordinates = ";".join(
        f"{float(item['Longitude'])},{float(item['Latitude'])}"
        for item in locations
    )
    encoded_coordinates = quote(coordinates, safe=";,.")
    url = (
        "https://router.project-osrm.org/table/v1/driving/"
        f"{encoded_coordinates}?annotations=distance,duration"
    )

    request = Request(
        url,
        headers={
            "User-Agent": "EcoRouteAI/1.0",
            "Accept": "application/json",
        },
    )

    print(f"Requesting {label} from OSRM...")
    with urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))

    if data.get("code") != "Ok":
        raise RuntimeError(
            f"OSRM {label} request failed:\n{json.dumps(data, indent=2)}"
        )

    distances = data.get("distances")
    durations = data.get("durations")
    expected_count = len(locations)

    if (
        not distances
        or not durations
        or len(distances) != expected_count
        or len(durations) != expected_count
    ):
        raise RuntimeError(f"OSRM returned an invalid {label} matrix.")

    for index in range(expected_count):
        if (
            len(distances[index]) != expected_count
            or len(durations[index]) != expected_count
        ):
            raise RuntimeError(f"OSRM returned an invalid {label} matrix row.")

    return distances, durations


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild road distance data for one EcoRoute AI user without "
            "deleting other users' distance records."
        )
    )
    parser.add_argument(
        "--user-id",
        type=int,
        required=True,
        help="UserId whose active areas should be processed.",
    )
    args = parser.parse_args()
    user_id = args.user_id

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT AreaId, AreaName, Latitude, Longitude
                FROM areas
                WHERE IsActive = 1 AND UserId = %s
                ORDER BY AreaId
                """,
                (user_id,),
            )
            areas = cursor.fetchall()

            cursor.execute(
                """
                SELECT FacilityId, FacilityName, Latitude, Longitude
                FROM disposal_facilities
                WHERE IsActive = 1
                ORDER BY FacilityId
                LIMIT 1
                """
            )
            facility = cursor.fetchone()
    finally:
        connection.close()

    if not areas:
        raise RuntimeError(
            f"No active areas were found for UserId {user_id}. "
            "No distance records were changed."
        )

    if not facility:
        raise RuntimeError(
            "No active disposal facility was found. No distance records were changed."
        )

    missing_coordinates = [
        area["AreaName"]
        for area in areas
        if area["Latitude"] is None or area["Longitude"] is None
    ]
    if missing_coordinates:
        raise RuntimeError(
            "These active areas are missing latitude or longitude: "
            + ", ".join(missing_coordinates)
            + ". No distance records were changed."
        )

    if facility["Latitude"] is None or facility["Longitude"] is None:
        raise RuntimeError(
            "The selected disposal facility is missing coordinates. "
            "No distance records were changed."
        )

    print(f"User ID: {user_id}")
    print(f"Active areas found: {len(areas)}")
    print(f"Disposal destination: {facility['FacilityName']}")
    for area in areas:
        print(
            f"  {area['AreaId']} | {area['AreaName']} | "
            f"{float(area['Latitude']):.7f}, {float(area['Longitude']):.7f}"
        )

    distances, durations = request_osrm_table(areas, "area-to-area distances")

    matrix_rows = []
    for origin_index, origin_area in enumerate(areas):
        for destination_index, destination_area in enumerate(areas):
            distance_meters = distances[origin_index][destination_index]
            duration_seconds = durations[origin_index][destination_index]

            if distance_meters is None or duration_seconds is None:
                raise RuntimeError(
                    f"No road distance or travel time found between "
                    f"{origin_area['AreaName']} and {destination_area['AreaName']}. "
                    "No distance records were changed."
                )

            matrix_rows.append(
                (
                    origin_area["AreaId"],
                    destination_area["AreaId"],
                    round(float(distance_meters) / 1000, 2),
                    round(float(duration_seconds) / 60, 2),
                )
            )

    # Request the same matrix with the facility as the final coordinate.
    facility_locations = [*areas, facility]
    facility_distances, facility_durations = request_osrm_table(
        facility_locations, "area-to-facility distances"
    )
    facility_index = len(facility_locations) - 1

    facility_rows = []
    for area_index, area in enumerate(areas):
        distance_meters = facility_distances[area_index][facility_index]
        duration_seconds = facility_durations[area_index][facility_index]

        if distance_meters is None or duration_seconds is None:
            raise RuntimeError(
                f"No road route found between {area['AreaName']} and "
                f"{facility['FacilityName']}. No distance records were changed."
            )

        facility_rows.append(
            (
                area["AreaId"],
                facility["FacilityId"],
                round(float(distance_meters) / 1000, 2),
                round(float(duration_seconds) / 60, 2),
            )
        )

    area_ids = [area["AreaId"] for area in areas]
    placeholders = ", ".join(["%s"] * len(area_ids))

    # Update both tables in one transaction. Only rows belonging to this
    # user's active area set are replaced; other users' rows are preserved.
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                DELETE FROM distance_matrix
                WHERE OriginAreaId IN ({placeholders})
                  AND DestinationAreaId IN ({placeholders})
                """,
                tuple(area_ids + area_ids),
            )

            cursor.executemany(
                """
                INSERT INTO distance_matrix
                    (OriginAreaId, DestinationAreaId, DistanceKm, TravelTimeMinutes)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    DistanceKm = VALUES(DistanceKm),
                    TravelTimeMinutes = VALUES(TravelTimeMinutes)
                """,
                matrix_rows,
            )

            cursor.execute(
                f"""
                DELETE FROM area_disposal_distances
                WHERE AreaId IN ({placeholders}) AND FacilityId = %s
                """,
                tuple(area_ids + [facility["FacilityId"]]),
            )

            cursor.executemany(
                """
                INSERT INTO area_disposal_distances
                    (AreaId, FacilityId, DistanceKm, TravelTimeMinutes)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    DistanceKm = VALUES(DistanceKm),
                    TravelTimeMinutes = VALUES(TravelTimeMinutes)
                """,
                facility_rows,
            )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print()
    print("=" * 60)
    print("DISTANCE DATA REBUILT SUCCESSFULLY")
    print("=" * 60)
    print(f"User ID: {user_id}")
    print(f"Areas processed: {len(areas)}")
    print(f"Area-to-area records saved: {len(matrix_rows)}")
    print(f"Area-to-facility records saved: {len(facility_rows)}")
    print("Distance records for other users were not deleted.")


if __name__ == "__main__":
    main()
