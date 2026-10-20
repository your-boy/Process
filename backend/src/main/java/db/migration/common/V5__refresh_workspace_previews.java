package db.migration.common;

import com.example.diagram.service.DocumentSummaryBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Rebuilds previews created before the preview contract included pageCount.
 * Only rows with the legacy payload shape are touched.
 */
public class V5__refresh_workspace_previews extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        List<PendingPreview> pending = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                 "select id, content from diagram " +
                 "where preview_json is null or preview_json not like '%pageCount%'"
             )) {
            while (rows.next()) {
                pending.add(new PendingPreview(rows.getLong("id"), rows.getString("content")));
            }
        }

        try (PreparedStatement update = connection.prepareStatement(
            "update diagram set preview_json = ?, summary_text = ?, search_text = ?, page_count = ? where id = ?"
        )) {
            for (PendingPreview item : pending) {
                DocumentSummaryBuilder.SummaryPayload summary = summaryFor(item.content());
                update.setString(1, summary.previewJson());
                update.setString(2, summary.summaryText());
                update.setString(3, summary.searchText());
                update.setInt(4, summary.pageCount());
                update.setLong(5, item.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private DocumentSummaryBuilder.SummaryPayload summaryFor(String content) {
        try {
            Map<String, Object> value = MAPPER.readValue(
                content == null ? "{}" : content,
                new TypeReference<>() {}
            );
            return DocumentSummaryBuilder.build(value);
        } catch (Exception exception) {
            return DocumentSummaryBuilder.build(Map.of());
        }
    }

    private record PendingPreview(long id, String content) {}
}
