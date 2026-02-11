# Opera DB MCP Connector — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MCP server that connects to live Oracle Opera PMS V5 database, allowing Claude to explore schema, query data, and reverse-engineer business logic for PMS development.

**Architecture:** Python MCP server using `oracledb` thin mode (no Oracle Instant Client needed on ARM). Exposes tools for schema exploration and read-only queries. Connects via Tailscale to Opera DB.

**Tech Stack:** Python 3.12, `mcp[cli]`, `oracledb` (thin mode), `uv`

---

### Task 1: Initialize MCP server project

**Files:**
- Create: `tools/mcp-server/pyproject.toml`
- Create: `tools/mcp-server/src/opera_mcp/__init__.py`
- Create: `tools/mcp-server/src/opera_mcp/server.py`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "opera-mcp"
version = "0.1.0"
description = "MCP server for Oracle Opera PMS V5 database"
requires-python = ">=3.12"
dependencies = [
    "mcp[cli]>=1.0",
    "oracledb>=2.0",
]

[project.scripts]
opera-mcp = "opera_mcp.server:main"
```

**Step 2: Create empty server module**

```python
# src/opera_mcp/__init__.py
```

```python
# src/opera_mcp/server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("opera-pms")

def main():
    mcp.run()

if __name__ == "__main__":
    main()
```

**Step 3: Install dependencies**

Run: `cd tools/mcp-server && uv sync`
Expected: Dependencies installed, .venv updated

**Step 4: Verify server starts**

Run: `cd tools/mcp-server && uv run opera-mcp --help`
Expected: MCP server help output, no errors

**Step 5: Commit**

```bash
git add tools/mcp-server/
git commit -m "feat: initialize Opera MCP server project"
```

---

### Task 2: Add Oracle DB connection

**Files:**
- Create: `tools/mcp-server/src/opera_mcp/db.py`
- Modify: `tools/mcp-server/src/opera_mcp/server.py`
- Modify: `pms/.env` (add OPERA_* vars)

**Step 1: Add connection config to .env**

Append to `pms/.env`:
```
OPERA_DB_HOST=<tailscale-ip>
OPERA_DB_PORT=1521
OPERA_DB_SERVICE=<service-name>
OPERA_DB_USER=<username>
OPERA_DB_PASSWORD=<password>
```

(Placeholder values — user fills in after Tailscale setup)

**Step 2: Create db.py with connection pool**

```python
# src/opera_mcp/db.py
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
```

**Step 3: Commit**

```bash
git add tools/mcp-server/ .env
git commit -m "feat: add Oracle DB connection module"
```

---

### Task 3: Add schema exploration tools

**Files:**
- Modify: `tools/mcp-server/src/opera_mcp/server.py`

**Step 1: Add list_tables tool**

```python
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
```

**Step 2: Add describe_table tool**

```python
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
```

**Step 3: Add table_constraints tool**

```python
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
```

**Step 4: Add foreign_keys tool**

```python
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
```

**Step 5: Add helper format_table**

```python
def format_table(rows: list[dict]) -> str:
    if not rows:
        return "No results."
    headers = list(rows[0].keys())
    lines = [" | ".join(headers)]
    lines.append(" | ".join("---" for _ in headers))
    for row in rows:
        lines.append(" | ".join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines)
```

**Step 6: Commit**

```bash
git add tools/mcp-server/
git commit -m "feat: add schema exploration tools (list, describe, constraints, FKs)"
```

---

### Task 4: Add data query tools

**Files:**
- Modify: `tools/mcp-server/src/opera_mcp/server.py`

**Step 1: Add query tool (read-only)**

```python
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
```

**Step 2: Add sample_data tool**

```python
@mcp.tool()
def sample_data(table_name: str, schema: str = "", rows: int = 10) -> str:
    """Get sample rows from a table. Quick way to see what data looks like."""
    owner = f"{schema.upper()}." if schema else ""
    sql = f"SELECT * FROM {owner}{table_name.upper()} WHERE ROWNUM <= :max_rows"
    result = execute_query(sql, {"max_rows": min(rows, 50)}, max_rows=min(rows, 50))
    return format_table(result)
```

**Step 3: Add search_columns tool**

```python
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
```

**Step 4: Commit**

```bash
git add tools/mcp-server/
git commit -m "feat: add data query tools (query, sample_data, search_columns)"
```

---

### Task 5: Add Opera-specific exploration tools

**Files:**
- Modify: `tools/mcp-server/src/opera_mcp/server.py`

**Step 1: Add opera_overview tool**

```python
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
```

**Step 2: Add opera_mapping tool**

```python
@mcp.tool()
def opera_mapping() -> str:
    """Show mapping between Opera and PMS concepts."""
    return """
Opera PMS V5 -> New PMS mapping:

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
- RATE_CODE, RATE_HEADER, RATE_DETAIL: rate management
"""
```

**Step 3: Commit**

```bash
git add tools/mcp-server/
git commit -m "feat: add Opera-specific exploration tools"
```

---

### Task 6: Configure MCP server in Claude Code

**Files:**
- Modify: Claude Code MCP settings

**Step 1: Register MCP server**

Add to Claude Code config (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "opera": {
      "command": "uv",
      "args": ["--directory", "/home/oci/pms/tools/mcp-server", "run", "opera-mcp"],
      "env": {
        "OPERA_DB_HOST": "<tailscale-ip>",
        "OPERA_DB_PORT": "1521",
        "OPERA_DB_SERVICE": "<service>",
        "OPERA_DB_USER": "<user>",
        "OPERA_DB_PASSWORD": "<password>"
      }
    }
  }
}
```

**Step 2: Verify MCP tools are visible**

Restart Claude Code session, confirm `opera_overview`, `list_tables`, `query` tools appear.

**Step 3: Commit**

```bash
git add .mcp.json
git commit -m "feat: register Opera MCP server in Claude Code"
```

---

## Verification

1. `uv run opera-mcp` starts without errors
2. MCP tools visible in Claude Code after restart
3. After Tailscale connected: `opera_overview` returns table list with row counts
4. `describe_table("ROOM")` shows Opera room columns
5. `sample_data("RESORT")` shows hotel properties from Opera
6. `query("SELECT COUNT(*) FROM ROOM")` returns room count
