create table if not exists app_user (
    id bigint auto_increment primary key,
    username varchar(50) not null,
    user_id varchar(50) not null,
    display_name varchar(100) not null,
    password_hash varchar(255) not null,
    recovery_code_hash varchar(255) not null,
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
    content text not null,
    created_at timestamp not null,
    updated_at timestamp not null
);