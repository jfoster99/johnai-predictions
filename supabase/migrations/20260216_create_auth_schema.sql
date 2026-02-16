-- Create auth schema for Supabase Auth (GoTrue)
-- This is required for the auth service to function

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO postgres, service_role;

-- Create users table in auth schema (GoTrue's main table)
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    aud character varying(255),
    role character varying(255),
    email character varying(255) UNIQUE,
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone character varying(15) DEFAULT NULL::character varying UNIQUE,
    phone_confirmed_at timestamp with time zone,
    phone_change character varying(15) DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone
);

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid,
    id bigserial PRIMARY KEY,
    token character varying(255) UNIQUE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255)
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) NOT NULL DEFAULT ''::character varying
);

-- Create schema migrations table
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version character varying(255) NOT NULL PRIMARY KEY
);

-- Grant permissions on auth tables
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users(instance_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users(email);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens(token);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON auth.audit_log_entries(instance_id);

-- Insert initial schema version
INSERT INTO auth.schema_migrations (version) VALUES ('20211124214934') ON CONFLICT DO NOTHING;

-- Create function to get current user's JWT claims
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::uuid
$$;

-- Create function to get current user's role
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  	coalesce(
		nullif(current_setting('request.jwt.claim.role', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
	)::text
$$;

-- Create function to get current user's email
CREATE OR REPLACE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  	coalesce(
		nullif(current_setting('request.jwt.claim.email', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
	)::text
$$;

COMMENT ON SCHEMA auth IS 'Supabase Auth schema for user authentication';
