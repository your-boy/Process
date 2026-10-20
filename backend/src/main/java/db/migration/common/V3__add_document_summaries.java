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

public class V3__add_document_summaries extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        boolean mysql = connection.getMetaData().getDatabaseProductName()
            .toLowerCase(Locale.ROOT).contains("mysql");
        if (!columnExists(connection, "preview_json")) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("alter table diagram add column preview_json " + (mysql ? "longtext" : "clob"));
            }
        }
        if (!columnExists(connection, "summary_text")) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("alter table diagram add column summary_text varchar(500) not null default ''");
            }
        }
        if (!columnExists(connection, "page_count")) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("alter table diagram add column page_count int not null default 1");
            }
        }
        backfill(connection);
    }

    private void backfill(Connection connection) throws Exception {
        List<PendingSummary> pending = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                 "select id, content from diagram where preview_json is null"
             )) {
            while (rows.next()) {
                pending.add(new PendingSummary(rows.getLong("id"), rows.getString("content")));
            }
        }
        try (PreparedStatement update = connection.prepareStatement(
            "update diagram set preview_json = ?, summary_text = ?, page_count = ? where id = ?"
        )) {
            for (PendingSummary item : pending) {
                Map<String, Object> content = MAPPER.readValue(
                    item.content() == null ? "{}" : item.content(),
                    new TypeReference<>() {}
                );
                DocumentSummaryBuilder.SummaryPayload summary = DocumentSummaryBuilder.build(content);
                update.setString(1, summary.previewJson());
                update.setString(2, summary.summaryText());
                update.setInt(3, summary.pageCount());
                update.setLong(4, item.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private boolean columnExists(Connection connection, String column) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        try (ResultSet columns = metadata.getColumns(null, null, "diagram", column)) {
            return columns.next();
        }
    }

    private record PendingSummary(long id, String content) {}
}
