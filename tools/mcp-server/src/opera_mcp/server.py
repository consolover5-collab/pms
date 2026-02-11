from mcp.server.fastmcp import FastMCP
from opera_mcp.db import execute_query

mcp = FastMCP("opera-pms")


def format_table(rows: list[dict]) -> str:
    if not rows:
        return "No results."
    headers = list(rows[0].keys())
    lines = [" | ".join(headers)]
    lines.append(" | ".join("---" for _ in headers))
    for row in rows:
        lines.append(" | ".join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines)


# --- Task 3: Schema exploration tools ---

@mcp.tool()
def list_tables(schema: str = "", name_pattern: str = "") -> str:
    """List tables in Oracle DB. Optional: filter by schema owner or name pattern (SQL LIKE)."""
    conditions = ["table_name NOT LIKE 'BIN$%'"]
    params = {}
    if schema:
        conditions.append("owner = :schema")
        params["schema"] = schema.upper()
    if name_pattern:
        conditions.append("table_name LIKE :pattern")
        params["pattern"] = name_pattern.upper()
    where = " AND ".join(conditions)
    sql = f"SELECT owner, table_name, num_rows FROM all_tables WHERE {where} ORDER BY owner, table_name"
    rows = execute_query(sql, params, max_rows=200)
    return format_table(rows)


@mcp.tool()
def describe_table(table_name: str, schema: str = "") -> str:
    """Show columns, types, constraints for a table."""
    params = {"table_name": table_name.upper()}
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
    rows = execute_query(sql, params, max_rows=500)
    return format_table(rows)


@mcp.tool()
def table_constraints(table_name: str, schema: str = "") -> str:
    """Show primary keys, foreign keys, unique constraints for a table."""
    params = {"table_name": table_name.upper()}
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
    rows = execute_query(sql, params, max_rows=500)
    return format_table(rows)


@mcp.tool()
def foreign_keys(table_name: str, schema: str = "") -> str:
    """Show FK relationships: what this table references and what references it."""
    params = {"table_name": table_name.upper()}
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
    rows = execute_query(sql, params, max_rows=500)
    return format_table(rows)


# --- Task 4: Data query tools ---

@mcp.tool()
def query(sql: str, max_rows: int = 50) -> str:
    """Run a read-only SQL query (SELECT only). Max 50 rows by default."""
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        return "Error: Only SELECT queries are allowed."
    if max_rows > 500:
        max_rows = 500
    rows = execute_query(sql, max_rows=max_rows)
    return format_table(rows)


@mcp.tool()
def sample_data(table_name: str, schema: str = "", rows: int = 10) -> str:
    """Get sample rows from a table. Quick way to see what data looks like."""
    owner = f"{schema.upper()}." if schema else ""
    sql = f"SELECT * FROM {owner}{table_name.upper()} WHERE ROWNUM <= :max_rows"
    result = execute_query(sql, {"max_rows": min(rows, 50)}, max_rows=min(rows, 50))
    return format_table(result)


@mcp.tool()
def search_columns(column_pattern: str, schema: str = "") -> str:
    """Find tables containing columns matching a pattern. Useful for finding where data lives."""
    params = {"pattern": column_pattern.upper()}
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
    rows = execute_query(sql, params, max_rows=200)
    return format_table(rows)


# --- Task 5: Opera-specific tools ---

@mcp.tool()
def opera_overview() -> str:
    """Show key Opera PMS tables and their row counts. Quick orientation."""
    key_tables = [
        "RESORT", "ROOM", "ROOM_CATEGORY", "ROOM_CLASS",
        "NAME", "NAME_PHONE", "NAME_ADDRESS",
        "RESERVATION_NAME", "RESERVATION_DAILY_ELEMENTS",
        "RATE_CODE", "RATE_DETAIL", "RATE_HEADER",
    ]
    placeholders = ", ".join(f"'{t}'" for t in key_tables)
    sql = f"""
    SELECT table_name, num_rows, last_analyzed
    FROM all_tables
    WHERE table_name IN ({placeholders})
    ORDER BY table_name
    """
    rows = execute_query(sql, max_rows=50)
    return format_table(rows)


@mcp.tool()
def opera_mapping() -> str:
    """Show mapping between Opera and PMS concepts."""
    return """Opera PMS V5 -> New PMS mapping:

RESORT          -> properties     (hotel/property)
ROOM_CATEGORY   -> room_types     (room category: STD, DLX, STE)
ROOM            -> rooms          (physical room)
NAME            -> guests         (guest profile)
RESERVATION_NAME -> bookings      (reservation)
RATE_CODE/RATE_HEADER -> rate_plans (rate plan)

Key Opera tables to explore:
- RESORT: hotel properties
- ROOM: rooms with ROOM_CATEGORY, ROOM_CLASS
- ROOM_CATEGORY: room types (STD, DLX, etc)
- NAME: guest master (NAME_TYPE: 1=Individual, 2=Company, 3=Agent, etc)
- NAME_PHONE, NAME_ADDRESS: guest contacts
- RESERVATION_NAME: reservations (RESV_STATUS: RESERVED, CHECKED_IN, etc)
- RESERVATION_DAILY_ELEMENTS: per-night breakdown
- RATE_CODE, RATE_HEADER, RATE_DETAIL: rate management"""


def main():
    mcp.run()


if __name__ == "__main__":
    main()
