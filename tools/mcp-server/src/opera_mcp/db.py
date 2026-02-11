import os
import oracledb


def get_connection() -> oracledb.Connection:
    return oracledb.connect(
        user=os.environ["OPERA_DB_USER"],
        password=os.environ["OPERA_DB_PASSWORD"],
        dsn=f"{os.environ['OPERA_DB_HOST']}:{os.environ.get('OPERA_DB_PORT', '1521')}/{os.environ['OPERA_DB_SERVICE']}",
    )


def execute_query(sql: str, params: dict | None = None, max_rows: int = 100) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or {})
            columns = [col[0] for col in cur.description] if cur.description else []
            rows = cur.fetchmany(max_rows)
            return [dict(zip(columns, row)) for row in rows]
