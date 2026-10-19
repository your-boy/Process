package com.example.diagram.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class SchemaMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public SchemaMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureColumn("diagram", "version", "bigint not null default 0");
        ensureColumn("app_user", "token_version", "bigint not null default 0");
        ensureColumn("diagram", "sequence_no", "bigint not null default 0");
        ensureIndex("idx_diagram_user_updated", "diagram (user_id, updated_at)");
        ensureIndex("idx_diagram_user_sequence", "diagram (user_id, sequence_no)");
        backfillSequenceNumbers();
    }

    private void ensureIndex(String name, String columns) {
        try {
            jdbcTemplate.execute("create index " + name + " on " + columns);
        } catch (DataAccessException exception) {
            // Index already exists on normal startups.
        }
    }

    private void backfillSequenceNumbers() {
        List<Map<String, Object>> maxRows = jdbcTemplate.queryForList(
            "select user_id, coalesce(max(sequence_no), 0) as max_seq from diagram group by user_id"
        );
        Map<String, Long> nextByUser = new HashMap<>();
        for (Map<String, Object> row : maxRows) {
            Object userId = row.get("user_id");
            Object maxSeq = row.get("max_seq");
            if (userId != null && maxSeq instanceof Number number) {
                nextByUser.put(String.valueOf(userId), number.longValue());
            }
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "select id, user_id from diagram where sequence_no = 0 order by user_id, created_at, id"
        );
        for (Map<String, Object> row : rows) {
            Object id = row.get("id");
            Object userId = row.get("user_id");
            if (id == null || userId == null) {
                continue;
            }
            String userKey = String.valueOf(userId);
            long next = nextByUser.getOrDefault(userKey, 0L) + 1;
            nextByUser.put(userKey, next);
            jdbcTemplate.update("update diagram set sequence_no = ? where id = ?", next, id);
        }
    }

    private void ensureColumn(String table, String column, String definition) {
        if (columnExists(table, column)) {
            return;
        }
        try {
            jdbcTemplate.execute("alter table " + table + " add column " + column + " " + definition);
        } catch (DataAccessException exception) {
            // Multiple application instances may race on the same migration. Re-check before failing.
            if (!columnExists(table, column)) {
                throw exception;
            }
        }
    }

    private boolean columnExists(String table, String column) {
        try {
            jdbcTemplate.query("select " + column + " from " + table + " where 1 = 0", resultSet -> null);
            return true;
        } catch (DataAccessException exception) {
            return false;
        }
    }
}
