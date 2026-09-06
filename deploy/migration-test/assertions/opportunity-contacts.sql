-- Read-only assertions for both upgraded mirrors and clean fixture databases.
DO $$
DECLARE
  workspace_record record;
  contact_table regclass;
  missing_columns integer;
  invalid_links bigint;
BEGIN
  FOR workspace_record IN SELECT id, "databaseSchema" FROM core.workspace LOOP
    contact_table := to_regclass(format('%I.%I', workspace_record."databaseSchema", 'opportunityContact'));
    IF contact_table IS NULL THEN
      RAISE EXCEPTION 'Opportunity contact table is missing';
    END IF;

    SELECT count(*) INTO missing_columns
    FROM (VALUES ('opportunityId'), ('personId'), ('deletedAt')) AS required(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = contact_table AND attname = required.name AND NOT attisdropped
    );
    IF missing_columns <> 0 THEN
      RAISE EXCEPTION 'Opportunity contact columns are missing';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = workspace_record."databaseSchema"
        AND tablename = 'opportunityContact'
        AND indexdef LIKE '%UNIQUE%"opportunityId"%"personId"%WHERE%"deletedAt" IS NULL%'
    ) THEN
      RAISE EXCEPTION 'Active contact uniqueness index is missing';
    END IF;

    IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid = contact_table AND contype = 'f' AND confdeltype = 'c') <> 2 THEN
      RAISE EXCEPTION 'Contact parent cascade constraints are missing';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = workspace_record."databaseSchema"
        AND table_name = 'opportunity' AND column_name = 'pointOfContactId'
    ) THEN
      RAISE EXCEPTION 'Legacy primary contact column was removed';
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I."opportunityContact" contact
       LEFT JOIN %I.opportunity opportunity ON opportunity.id = contact."opportunityId"
       LEFT JOIN %I.person person ON person.id = contact."personId"
       WHERE opportunity.id IS NULL OR person.id IS NULL',
      workspace_record."databaseSchema", workspace_record."databaseSchema", workspace_record."databaseSchema"
    ) INTO invalid_links;
    IF invalid_links <> 0 THEN
      RAISE EXCEPTION 'Opportunity contact links have missing parents';
    END IF;
  END LOOP;
END $$;
