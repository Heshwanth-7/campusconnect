SELECT 'CREATE DATABASE campusconnect OWNER campusconnect'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'campusconnect') \gexec

CREATE ROLE campusconnect_test LOGIN PASSWORD 'local_test_password';
CREATE DATABASE campusconnect_test OWNER campusconnect_test;
REVOKE CONNECT ON DATABASE campusconnect FROM PUBLIC;
