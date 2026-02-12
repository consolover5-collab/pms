from mcp.server.fastmcp import FastMCP
from opera_mcp.db import execute_query, execute_query_with_init

mcp = FastMCP("opera-pms")

MAX_CELL_LEN = 60


def format_table(rows: list[dict]) -> str:
    if not rows:
        return "No results."
    headers = list(rows[0].keys())
    lines = [" | ".join(headers)]
    lines.append(" | ".join("---" for _ in headers))
    for row in rows:
        cells = []
        for h in headers:
            v = str(row.get(h, ""))
            if len(v) > MAX_CELL_LEN:
                v = v[: MAX_CELL_LEN - 3] + "..."
            cells.append(v)
        lines.append(" | ".join(cells))
    return "\n".join(lines)


# ── Schema exploration ──────────────────────────────────────


@mcp.tool()
def list_schemas() -> str:
    """List Oracle schemas that own tables, with table and row counts."""
    sql = """
    SELECT owner, COUNT(*) as tables, SUM(num_rows) as total_rows
    FROM all_tables
    WHERE table_name NOT LIKE 'BIN$%'
      AND owner NOT IN ('SYS','SYSTEM','DBSNMP','OUTLN','WMSYS','XDB',
                         'CTXSYS','MDSYS','OLAPSYS','ORDDATA','ORDSYS',
                         'LBACSYS','APEX_040200','FLOWS_FILES')
    GROUP BY owner
    ORDER BY total_rows DESC NULLS LAST
    """
    return format_table(execute_query(sql, max_rows=30))


@mcp.tool()
def list_tables(schema: str = "", name_pattern: str = "") -> str:
    """List tables in Oracle DB. Optional: filter by schema owner or name pattern (SQL LIKE)."""
    conditions = ["table_name NOT LIKE 'BIN$%'"]
    params: dict = {}
    if schema:
        conditions.append("owner = :schema")
        params["schema"] = schema.upper()
    if name_pattern:
        conditions.append("table_name LIKE :pattern")
        params["pattern"] = name_pattern.upper()
    where = " AND ".join(conditions)
    sql = f"SELECT owner, table_name, num_rows FROM all_tables WHERE {where} ORDER BY owner, table_name"
    return format_table(execute_query(sql, params, max_rows=200))


@mcp.tool()
def describe_table(table_name: str, schema: str = "") -> str:
    """Show columns, types, constraints for a table."""
    params: dict = {"table_name": table_name.upper()}
    schema_filter = ""
    if schema:
        schema_filter = "AND c.owner = :schema"
        params["schema"] = schema.upper()
    sql = f"""
    SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
           c.nullable, c.data_default
    FROM all_tab_columns c
    WHERE c.table_name = :table_name {schema_filter}
    ORDER BY c.column_id
    """
    return format_table(execute_query(sql, params, max_rows=500))


@mcp.tool()
def table_constraints(table_name: str, schema: str = "") -> str:
    """Show primary keys, foreign keys, unique constraints for a table."""
    params: dict = {"table_name": table_name.upper()}
    schema_filter = ""
    if schema:
        schema_filter = "AND ac.owner = :schema"
        params["schema"] = schema.upper()
    sql = f"""
    SELECT ac.constraint_name, ac.constraint_type, acc.column_name,
           ac.r_constraint_name, ac.status
    FROM all_constraints ac
    JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name AND ac.owner = acc.owner
    WHERE ac.table_name = :table_name {schema_filter}
    ORDER BY ac.constraint_type, ac.constraint_name, acc.position
    """
    return format_table(execute_query(sql, params, max_rows=500))


@mcp.tool()
def foreign_keys(table_name: str, schema: str = "") -> str:
    """Show FK relationships: what this table references and what references it."""
    params: dict = {"table_name": table_name.upper()}
    schema_filter = ""
    if schema:
        schema_filter = "AND a.owner = :schema"
        params["schema"] = schema.upper()
    sql = f"""
    SELECT 'OUTGOING' as direction, a.table_name as from_table, ac.column_name as from_column,
           b.table_name as to_table, bc.column_name as to_column
    FROM all_constraints a
    JOIN all_cons_columns ac ON a.constraint_name = ac.constraint_name AND a.owner = ac.owner
    JOIN all_constraints b ON a.r_constraint_name = b.constraint_name AND a.r_owner = b.owner
    JOIN all_cons_columns bc ON b.constraint_name = bc.constraint_name AND b.owner = bc.owner
    WHERE a.constraint_type = 'R' AND a.table_name = :table_name {schema_filter}
    UNION ALL
    SELECT 'INCOMING', b.table_name, bc.column_name, a.table_name, ac.column_name
    FROM all_constraints a
    JOIN all_cons_columns ac ON a.constraint_name = ac.constraint_name AND a.owner = ac.owner
    JOIN all_constraints b ON b.r_constraint_name = a.constraint_name AND b.r_owner = a.owner
    JOIN all_cons_columns bc ON b.constraint_name = bc.constraint_name AND b.owner = bc.owner
    WHERE a.constraint_type IN ('P','U') AND a.table_name = :table_name {schema_filter}
    ORDER BY 1, 2
    """
    return format_table(execute_query(sql, params, max_rows=500))


# ── Data exploration ────────────────────────────────────────


@mcp.tool()
def query(sql: str, max_rows: int = 50) -> str:
    """Run a read-only SQL query (SELECT only). Max 50 rows by default."""
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        return "Error: Only SELECT queries are allowed."
    if max_rows > 500:
        max_rows = 500
    return format_table(execute_query(sql, max_rows=max_rows))


@mcp.tool()
def query_view(sql: str, resort: str = "HA336", max_rows: int = 50) -> str:
    """Run a SELECT on Opera views that require pms_p.initialize (e.g. RESERVATION_GENERAL_VIEW). Calls pms_p.initialize before the query."""
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        return "Error: Only SELECT queries are allowed."
    if max_rows > 500:
        max_rows = 500
    return format_table(execute_query_with_init(sql, resort, max_rows=max_rows))


@mcp.tool()
def sample_data(table_name: str, schema: str = "", rows: int = 10) -> str:
    """Get sample rows from a table. Quick way to see what data looks like."""
    safe_name = table_name.upper().replace("'", "").replace(";", "")
    safe_schema = schema.upper().replace("'", "").replace(";", "") if schema else ""
    owner = f"{safe_schema}." if safe_schema else ""
    sql = f"SELECT * FROM {owner}{safe_name} WHERE ROWNUM <= :max_rows"
    return format_table(execute_query(sql, {"max_rows": min(rows, 50)}, max_rows=min(rows, 50)))


@mcp.tool()
def search_columns(column_pattern: str, schema: str = "") -> str:
    """Find tables containing columns matching a pattern. Useful for finding where data lives."""
    params: dict = {"pattern": column_pattern.upper()}
    schema_filter = ""
    if schema:
        schema_filter = "AND owner = :schema"
        params["schema"] = schema.upper()
    sql = f"""
    SELECT owner, table_name, column_name, data_type
    FROM all_tab_columns
    WHERE column_name LIKE :pattern {schema_filter}
    ORDER BY owner, table_name, column_id
    """
    return format_table(execute_query(sql, params, max_rows=200))


@mcp.tool()
def distinct_values(table_name: str, column_name: str, schema: str = "") -> str:
    """Show distinct values and their counts for a column. Essential for understanding codes/enums."""
    safe_table = table_name.upper().replace("'", "").replace(";", "")
    safe_col = column_name.upper().replace("'", "").replace(";", "")
    safe_schema = schema.upper().replace("'", "").replace(";", "") if schema else ""
    owner = f"{safe_schema}." if safe_schema else ""
    sql = f"""
    SELECT {safe_col} as value, COUNT(*) as cnt
    FROM {owner}{safe_table}
    GROUP BY {safe_col}
    ORDER BY cnt DESC
    """
    return format_table(execute_query(sql, max_rows=50))


@mcp.tool()
def row_count(table_name: str, schema: str = "", where: str = "") -> str:
    """Get actual row count for a table, optionally with a WHERE clause."""
    safe_table = table_name.upper().replace("'", "").replace(";", "")
    safe_schema = schema.upper().replace("'", "").replace(";", "") if schema else ""
    owner = f"{safe_schema}." if safe_schema else ""
    where_clause = f"WHERE {where}" if where else ""
    sql = f"SELECT COUNT(*) as row_count FROM {owner}{safe_table} {where_clause}"
    return format_table(execute_query(sql, max_rows=1))


# ── Opera-specific ──────────────────────────────────────────


@mcp.tool()
def opera_overview() -> str:
    """Show key Opera PMS tables and their row counts. Quick orientation."""
    sql = """
    SELECT owner, table_name, num_rows, last_analyzed
    FROM all_tables
    WHERE table_name IN (
        'RESORT', 'ROOM', 'ROOM_CATEGORY_TEMPLATE', 'ROOM_CLASSES_TEMPLATE',
        'NAME', 'NAME_PHONE', 'NAME_ADDRESS',
        'RESERVATION_NAME', 'RESERVATION_DAILY_ELEMENTS',
        'RATE_CODE_TEMPLATE', 'RATE_HEADER', 'RATE_CATEGORY_TEMPLATE',
        'FINANCIAL_TRANSACTIONS', 'FOLIO_TAX', 'CASHIER',
        'ALLOTMENT_HEADER', 'GEM_EVEV'
    )
    AND num_rows > 0
    ORDER BY owner, table_name
    """
    return format_table(execute_query(sql, max_rows=100))


@mcp.tool()
def opera_mapping() -> str:
    """Show mapping between Opera and PMS concepts, based on real schema analysis."""
    return """Opera PMS V5 -> New PMS entity mapping (verified against live DB):

RESORT                      -> properties     (hotel/property, 3 records in OPERA1)
ROOM_CATEGORY_TEMPLATE      -> room_types     (room category: DBCLV, TWCLV, SKBLV etc.)
ROOM                        -> rooms          (physical room, 307 in HA336)
NAME                        -> guests         (guest/company profile, 61K records)
RESERVATION_NAME            -> bookings       (reservation header, 135K records)
RESERVATION_DAILY_ELEMENTS  -> booking_nights  (per-night breakdown, 335K records)
RATE_HEADER                 -> rate_plans     (rate plan, 498 records)

Key schemas: OPERA1 (primary hotel data), OPERA2 (copy). OPERA schema is empty.

NAME.NAME_TYPE values: D=reservation guest, G=guest profile, COMPANY, TRAVEL_AGENT, E, S, H
RESV_STATUS values: RESERVED, CHECKED IN, CHECKED OUT, CANCELLED, NO SHOW, PROSPECT
ROOM_STATUS values: CL=clean, DI=dirty, IP=in progress, OO=out of order, OS=out of service
HK_STATUS/FO_STATUS values: VAC=vacant, OCC=occupied

Room types in HA336:
  DBCLV=Standard double, TWCLV=Standard twin, TWCCI=Standard twin city view,
  DBBLV=Privilege like view, DBBCI=Privilege city view,
  SKDLS=Junior suite like view, STJ=Junior suite city view,
  SKBLV=Suite, DBCCI=Standard double city view, PM=Posting master (virtual)"""


def main():
    mcp.run()


if __name__ == "__main__":
    main()
