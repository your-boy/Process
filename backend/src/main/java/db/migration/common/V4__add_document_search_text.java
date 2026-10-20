package db.migration.common;

import com.example.diagram.service.DocumentSummaryBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Adds the denormalized search index used by the workspace list query.
 *
 * <p>The workspace query must not load the original content LOB. Searchable text is
 * extracted once on write and migrated for historical rows here.</p>
 */
public class V4__add_document_search_text extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        boolean mysql = connection.getMetaData().getDatabaseProductName()
            .toLowerCase(Locale.ROOT).contains("mysql");
        if (!columnExists(connection)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("alter table diagram add column search_text " + (mysql ? "longtext" : "clob"));
            }
        }
        backfill(connection);
    }

    private void backfill(Connection connection) throws Exception {
        List<PendingSearchText> pending = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                 "select id, content from diagram where search_text is null"
             )) {
            while (rows.next()) {
                pending.add(new PendingSearchText(rows.getLong("id"), rows.getString("content")));
            }
        }

        try (PreparedStatement update = connection.prepareStatement(
            "update diagram set search_text = ? where id = ?"
        )) {
            for (PendingSearchText item : pending) {
                update.setString(1, extractSearchText(item.content()));
                update.setLong(2, item.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private String extractSearchText(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        try {
            Map<String, Object> value = MAPPER.readValue(content, new TypeReference<>() {});
            return DocumentSummaryBuilder.build(value).searchText();
        } catch (Exception exception) {
            return "";
        }
    }

    private boolean columnExists(Connection connection) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        try (ResultSet columns = metadata.getColumns(null, null, "diagram", "search_text")) {
            return columns.next();
        }
    }

    private record PendingSearchText(long id, String content) {}
}
