package com.example.diagram.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

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
        ensureIndex();
    }

    private void ensureIndex() {
        try {
            jdbcTemplate.execute("create index idx_diagram_user_updated on diagram (user_id, updated_at)");
        } catch (DataAccessException exception) {
            // Index already exists on normal startups.
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
