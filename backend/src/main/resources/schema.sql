-- MySQL 8 schema used by the "prod" profile.
-- Local development uses db/schema-h2.sql instead.
create table if not exists app_user (
    id bigint auto_increment primary key,
    username varchar(50) not null,
    user_id varchar(50) not null,
    display_name varchar(100) not null,
    password_hash varchar(255) not null,
    recovery_code_hash varchar(255) not null,
    token_version bigint not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint uk_app_user_username unique (username),
    constraint uk_app_user_user_id unique (user_id)
);

create table if not exists diagram (
    id bigint auto_increment primary key,
    title varchar(100) not null,
    mode varchar(32) not null,
    user_id varchar(50) not null,
    sequence_no bigint not null default 0,
    content longtext not null,
    version bigint not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    key idx_diagram_user_updated (user_id, updated_at),
    key idx_diagram_user_sequence (user_id, sequence_no)
);
create table if not exists diagram_revision (
    id bigint auto_increment primary key,
    diagram_id bigint not null,
    user_id varchar(100) not null,
    title varchar(100) not null,
    mode varchar(32) not null,
    content longtext not null,
    revision_no bigint not null,
    change_source varchar(16) not null,
    created_at timestamp not null,
    key idx_revision_diagram (diagram_id, created_at)
);
