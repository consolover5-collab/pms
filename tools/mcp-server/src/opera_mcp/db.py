import os
import oracledb


def get_connection() -> oracledb.Connection:
    user = os.environ["OPERA_DB_USER"]
    password = os.environ["OPERA_DB_PASSWORD"]
    host = os.environ["OPERA_DB_HOST"]
    port = os.environ.get("OPERA_DB_PORT", "1521")
    sid = os.environ["OPERA_DB_SERVICE"]

    dsn = (
        f"(DESCRIPTION=(SDU=512)"
        f"(ADDRESS=(PROTOCOL=TCP)(HOST={host})(PORT={port}))"
        f"(CONNECT_DATA=(SID={sid})))"
    )

    kwargs: dict = {
        "user": user,
        "password": password,
        "dsn": dsn,
        "tcp_connect_timeout": 15,
    }
    if user.upper() == "SYS":
        kwargs["mode"] = oracledb.AUTH_MODE_SYSDBA

    return oracledb.connect(**kwargs)


def execute_query(sql: str, params: dict | None = None, max_rows: int = 100) -> list[dict]:
    for attempt in range(3):
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params or {})
                    columns = [col[0] for col in cur.description] if cur.description else []
                    rows = cur.fetchmany(max_rows)
                    return [dict(zip(columns, row)) for row in rows]
        except oracledb.DatabaseError:
            if attempt == 2:
                raise
    return []


def execute_query_with_init(
    sql: str,
    resort: str,
    params: dict | None = None,
    max_rows: int = 100,
) -> list[dict]:
    """Execute a SELECT after calling pms_p.initialize to enable Opera views."""
    app_user = os.environ.get("OPERA_APP_USER", "NA_REPORTS")
    for attempt in range(3):
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "BEGIN pms_p.initialize(:user, :user, :resort); END;",
                        {"user": app_user, "resort": resort},
                    )
                    cur.execute(sql, params or {})
                    columns = [col[0] for col in cur.description] if cur.description else []
                    rows = cur.fetchmany(max_rows)
                    return [dict(zip(columns, row)) for row in rows]
        except oracledb.DatabaseError:
            if attempt == 2:
                raise
    return []
