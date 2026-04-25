USE diagram_editor;

INSERT INTO app_user (
    username,
    user_id,
    display_name,
    password_hash,
    recovery_code_hash,
    created_at,
    updated_at
) VALUES (
    '',
    '',
    '',
    '',
    '',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    password_hash = VALUES(password_hash),
    recovery_code_hash = VALUES(recovery_code_hash),
    updated_at = VALUES(updated_at);