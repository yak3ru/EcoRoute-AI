import argparse
import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

import pymysql
from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BASE_DIR / ".env")


DB_HOST = os.getenv("DB_HOST", "localhost")
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL")

if not OSRM_BASE_URL:
    raise RuntimeError("OSRM_BASE_URL is not configured.")

OSRM_BASE_URL = OSRM_BASE_URL.rstrip("/")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")


# ============================================================
# COMMAND-LINE ARGUMENTS
# ============================================================

parser = argparse.ArgumentParser(
    description="Rebuild road distances for one EcoRoute AI user."
)
parser.add_argument(
    "--user-id",
    type=int,
    required=True,
    help="UserId whose active areas should be processed."
)
parser.add_argument(
    "--facility-id",
    type=int,
    default=1,
    help="Active disposal FacilityId to use (default: 1, SRP Dumpsite)."
)
args = parser.parse_args()

if args.user_id < 1:
    raise ValueError("--user-id must be a positive integer.")
if args.facility_id < 1:
    raise ValueError("--facility-id must be a positive integer.")

USER_ID = args.user_id
FACILITY_ID = args.facility_id

print(f"Processing distance data for UserId={USER_ID}")


# ============================================================
# LOAD SELECTED DISPOSAL DESTINATION
# ============================================================

connection = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    cursorclass=pymysql.cursors.DictCursor
)

try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                FacilityId,
                FacilityName,
                Latitude,
                Longitude
            FROM disposal_facilities
            WHERE IsActive = 1 AND FacilityId = %s
            LIMIT 1
        """, (FACILITY_ID,))

        facility = cursor.fetchone()

finally:
    connection.close()

if not facility:
    raise RuntimeError(
        "No active disposal facility was found."
    )

print(
    f"Disposal destination: {facility['FacilityName']}"
)


# ============================================================
# LOAD AREAS FROM MYSQL
# ============================================================

connection = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    cursorclass=pymysql.cursors.DictCursor
)

try:

    with connection.cursor() as cursor:

        cursor.execute("""
            SELECT
                AreaId,
                AreaName,
                Latitude,
                Longitude
            FROM areas
            WHERE IsActive = 1 AND UserId = %s
            ORDER BY AreaId
        """, (USER_ID,))

        areas = cursor.fetchall()

finally:
    connection.close()


if not areas:
    raise RuntimeError(
        f"No active collection areas were found for UserId={USER_ID}."
    )


print()
print("Active areas:")
print("-" * 60)

for area in areas:
    print(
        f"{area['AreaId']:>2}  "
        f"{area['AreaName']:<22} "
        f"{float(area['Latitude']):.7f}, "
        f"{float(area['Longitude']):.7f}"
    )

print()


# ============================================================
# BUILD OSRM COORDINATES
# OSRM expects longitude,latitude
# ============================================================

coordinates = ";".join(
    f"{float(area['Longitude'])},{float(area['Latitude'])}"
    for area in areas
)

encoded_coordinates = quote(
    coordinates,
    safe=";,."
)

url = (
    f"{OSRM_BASE_URL}/"
    "table/v1/driving/"
    f"{encoded_coordinates}"
    "?annotations=distance,duration"
)


print("Requesting road distance matrix from OSRM...")
print()


# ============================================================
# CALL OSRM TABLE SERVICE
# ============================================================

request = Request(
    url,
    headers={
        "User-Agent": "EcoRouteAI/1.0",
        "Accept": "application/json"
    }
)

with urlopen(request, timeout=60) as response:

    data = json.loads(
        response.read().decode("utf-8")
    )


if data.get("code") != "Ok":

    raise RuntimeError(
        "OSRM failed:\n"
        + json.dumps(data, indent=2)
    )


distances = data.get("distances")
durations = data.get("durations")

if not distances:

    raise RuntimeError(
        "OSRM did not return a distance matrix."
    )


if len(distances) != len(areas):

    raise RuntimeError(
        "OSRM matrix size does not match area count."
    )

if not durations or len(durations) != len(areas):
    raise RuntimeError(
        "OSRM did not return a valid duration matrix."
    )



# ============================================================
# PREPARE MATRIX
# ============================================================

matrix_rows = []

for origin_index, origin_area in enumerate(areas):

    row = distances[origin_index]
    duration_row = durations[origin_index]

    if len(row) != len(areas) or len(duration_row) != len(areas):
        raise RuntimeError(
            f"Invalid matrix row for AreaId {origin_area['AreaId']}."
        )

    for destination_index, distance_meters in enumerate(row):

        destination_area = areas[destination_index]
        duration_seconds = duration_row[destination_index]

        if distance_meters is None:
            raise RuntimeError(
                f"No road route found between "
                f"{origin_area['AreaName']} and "
                f"{destination_area['AreaName']}."
            )

        if duration_seconds is None:
            raise RuntimeError(
                f"No travel time found between "
                f"{origin_area['AreaName']} and "
                f"{destination_area['AreaName']}."
            )

        distance_km = round(
            float(distance_meters) / 1000,
            2
        )

        travel_time_minutes = round(
            float(duration_seconds) / 60,
            2
        )

        matrix_rows.append(
            (
                origin_area["AreaId"],
                destination_area["AreaId"],
                distance_km,
                travel_time_minutes
            )
        )

if len(matrix_rows) != len(areas) ** 2:
    raise RuntimeError(
        f"Expected {len(areas) ** 2} matrix entries, "
        f"but prepared {len(matrix_rows)}."
    )

print(f"Prepared {len(matrix_rows)} area-to-area records.")


# ============================================================
# CALCULATE AREA TO SRP DISTANCES AND TRAVEL TIMES
# ============================================================

srp_coordinates = ";".join(
    [
        *[
            f"{float(area['Longitude'])},{float(area['Latitude'])}"
            for area in areas
        ],
        (
            f"{float(facility['Longitude'])},"
            f"{float(facility['Latitude'])}"
        )
    ]
)

encoded_srp_coordinates = quote(
    srp_coordinates,
    safe=";,."
)

srp_url = (
    f"{OSRM_BASE_URL}/"
    "table/v1/driving/"
    f"{encoded_srp_coordinates}"
    "?annotations=distance,duration"
)

print("Requesting area to SRP road distances and travel times...")

srp_request = Request(
    srp_url,
    headers={
        "User-Agent": "EcoRouteAI/1.0",
        "Accept": "application/json"
    }
)

with urlopen(srp_request, timeout=60) as response:
    srp_data = json.loads(
        response.read().decode("utf-8")
    )

if srp_data.get("code") != "Ok":
    raise RuntimeError(
        "OSRM SRP request failed:\n"
        + json.dumps(srp_data, indent=2)
    )

srp_distances = srp_data.get("distances")
srp_durations = srp_data.get("durations")

if not srp_distances or not srp_durations:
    raise RuntimeError(
        "OSRM did not return SRP distances and travel times."
    )

facility_index = len(areas)
srp_rows = []

for area_index, area in enumerate(areas):
    distance_meters = srp_distances[area_index][facility_index]
    duration_seconds = srp_durations[area_index][facility_index]

    if distance_meters is None or duration_seconds is None:
        raise RuntimeError(
            f"No road route found from {area['AreaName']} to SRP."
        )

    distance_km = round(float(distance_meters) / 1000, 2)
    travel_time_minutes = round(float(duration_seconds) / 60, 2)

    srp_rows.append(
        (
            area["AreaId"],
            facility["FacilityId"],
            distance_km,
            travel_time_minutes
        )
    )

print(f"Calculated {len(srp_rows)} area to SRP routes.")

# ============================================================
# SAVE BOTH DISTANCE TABLES SAFELY FOR THIS USER
# ============================================================

area_ids = [area["AreaId"] for area in areas]
placeholders = ", ".join(["%s"] * len(area_ids))

connection = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME
)

try:
    connection.begin()
    with connection.cursor() as cursor:
        # Delete only distances whose origin AND destination belong to
        # this user's selected active areas. Other users' rows are preserved.
        delete_matrix_sql = f"""
            DELETE FROM distance_matrix
            WHERE OriginAreaId IN ({placeholders})
              AND DestinationAreaId IN ({placeholders})
        """
        cursor.execute(delete_matrix_sql, tuple(area_ids + area_ids))
        print(f"Replaced {cursor.rowcount} existing matrix rows for UserId={USER_ID}.")

        cursor.executemany(
            """
            INSERT INTO distance_matrix
            (
                OriginAreaId,
                DestinationAreaId,
                DistanceKm,
                TravelTimeMinutes
            )
            VALUES (%s, %s, %s, %s)
            """,
            matrix_rows
        )

        cursor.executemany(
            """
            INSERT INTO area_disposal_distances
            (
                AreaId,
                FacilityId,
                DistanceKm,
                TravelTimeMinutes
            )
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                DistanceKm = VALUES(DistanceKm),
                TravelTimeMinutes = VALUES(TravelTimeMinutes)
            """,
            srp_rows
        )

    connection.commit()
    print(f"Saved {len(srp_rows)} area-to-disposal distances.")

except Exception:
    connection.rollback()
    raise

finally:
    connection.close()


# ============================================================
# DISPLAY RESULT
# ============================================================

print()
print("=" * 60)
print(f"DISTANCE MATRIX REBUILT SUCCESSFULLY FOR USER {USER_ID}")
print("=" * 60)

print()
print(
    f"Areas: {len(areas)}"
)

print(
    f"Matrix entries: {len(matrix_rows)}"
)

print()

for origin_index, origin_area in enumerate(areas):

    print(
        f"{origin_area['AreaName']:<22}",
        end=""
    )

    for destination_index in range(len(areas)):

        distance_meters = distances[
            origin_index
        ][destination_index]

        distance_km = (
            float(distance_meters) / 1000
        )

        print(
            f"{distance_km:>7.2f}",
            end=""
        )

    print()

print()
print("Done.")
