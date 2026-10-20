package db.migration.common;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class V2__add_document_sequence extends BaseJavaMigration {

    private static final String COLUMN = "sequence_no";
    private static final String UNIQUE_INDEX = "uk_diagram_user_sequence";

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!columnExists(connection)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("alter table diagram add column sequence_no bigint not null default 0");
            }
        }
        backfillSequenceNumbers(connection);
        if (!indexExists(connection, UNIQUE_INDEX)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("create unique index " + UNIQUE_INDEX + " on diagram (user_id, sequence_no)");
            }
        }
    }

    private void backfillSequenceNumbers(Connection connection) throws SQLException {
        Map<String, Long> nextByUser = new HashMap<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                 "select user_id, max(sequence_no) as max_seq from diagram group by user_id"
             )) {
            while (rows.next()) {
                nextByUser.put(rows.getString("user_id"), rows.getLong("max_seq"));
            }
        }

        List<PendingSequence> pending = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                 "select id, user_id from diagram where sequence_no = 0 order by user_id, created_at, id"
             )) {
            while (rows.next()) {
                pending.add(new PendingSequence(rows.getLong("id"), rows.getString("user_id")));
            }
        }

        try (PreparedStatement update = connection.prepareStatement(
            "update diagram set sequence_no = ? where id = ?"
        )) {
            for (PendingSequence item : pending) {
                long next = nextByUser.getOrDefault(item.userId(), 0L) + 1L;
                nextByUser.put(item.userId(), next);
                update.setLong(1, next);
                update.setLong(2, item.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private boolean columnExists(Connection connection) {
        try (Statement statement = connection.createStatement()) {
            statement.executeQuery("select sequence_no from diagram where 1 = 0").close();
            return true;
        } catch (SQLException exception) {
            return false;
        }
    }

    private boolean indexExists(Connection connection, String indexName) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        String expected = indexName.toLowerCase(Locale.ROOT);
        try (ResultSet indexes = metadata.getIndexInfo(null, null, "diagram", false, false)) {
            while (indexes.next()) {
                String current = indexes.getString("INDEX_NAME");
                if (current != null && current.toLowerCase(Locale.ROOT).equals(expected)) {
                    return true;
                }
            }
        }
        return false;
    }

    private record PendingSequence(long id, String userId) {}
}
