import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "ecoroute")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(DATABASE_URL)


def load_waste_data():
    query = text("""
        SELECT
            wr.AreaId,
            a.AreaName,
            wr.CollectionDate,
            wr.WasteType,
            wr.WeightKg,
            wr.Status,
            a.PopulationDensity,
            a.ActivityLevel,
            a.CollectionFrequency,
            a.Latitude,
            a.Longitude
        FROM waste_records wr
        INNER JOIN areas a
            ON wr.AreaId = a.AreaId
        WHERE wr.Status = 'Completed'
        ORDER BY wr.AreaId, wr.CollectionDate;
    """)

    with engine.connect() as connection:
        df = pd.read_sql(query, connection)

    return df


if __name__ == "__main__":
    df = load_waste_data()

    print("\nLoaded waste records:")
    print(df.head(10))

    print("\nNumber of records:")
    print(len(df))

    print("\nWaste types:")
    print(df["WasteType"].value_counts())

    print("\nAreas:")
    print(df["AreaName"].unique())

    print("\nDate range:")
    print(df["CollectionDate"].min())
    print(df["CollectionDate"].max())