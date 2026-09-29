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
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")


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
            WHERE IsActive = 1
            ORDER BY AreaId
        """)

        areas = cursor.fetchall()

finally:
    connection.close()


if len(areas) != 10:
    raise RuntimeError(
        f"Expected 10 active areas, but found {len(areas)}."
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
    "http://router.project-osrm.org/"
    "table/v1/driving/"
    f"{encoded_coordinates}"
    "?annotations=distance"
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

if not distances:

    raise RuntimeError(
        "OSRM did not return a distance matrix."
    )


if len(distances) != len(areas):

    raise RuntimeError(
        "OSRM matrix size does not match area count."
    )


# ============================================================
# PREPARE MATRIX
# ============================================================

matrix_rows = []

for origin_index, origin_area in enumerate(areas):

    row = distances[origin_index]

    if len(row) != len(areas):

        raise RuntimeError(
            f"Invalid matrix row for "
            f"AreaId {origin_area['AreaId']}."
        )

    for destination_index, distance_meters in enumerate(row):

        destination_area = areas[
            destination_index
        ]

        if distance_meters is None:

            raise RuntimeError(
                f"No road route found between "
                f"{origin_area['AreaName']} and "
                f"{destination_area['AreaName']}."
            )

        distance_km = round(
            float(distance_meters) / 1000,
            2
        )

        matrix_rows.append(
            (
                origin_area["AreaId"],
                destination_area["AreaId"],
                distance_km
            )
        )


# ============================================================
# REPLACE OLD DISTANCE MATRIX
# ============================================================

connection = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME
)

try:

    with connection.cursor() as cursor:

        print(
            "Removing old distance matrix..."
        )

        cursor.execute(
            "DELETE FROM distance_matrix"
        )

        print(
            "Inserting new distance matrix..."
        )

        cursor.executemany(
            """
            INSERT INTO distance_matrix
            (
                OriginAreaId,
                DestinationAreaId,
                DistanceKm
            )
            VALUES
            (
                %s,
                %s,
                %s
            )
            """,
            matrix_rows
        )

    connection.commit()

finally:
    connection.close()


# ============================================================
# DISPLAY RESULT
# ============================================================

print()
print("=" * 60)
print("DISTANCE MATRIX REBUILT SUCCESSFULLY")
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