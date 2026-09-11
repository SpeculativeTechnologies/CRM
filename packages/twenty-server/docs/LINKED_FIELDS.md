# Linked Person fields

A linked field exposes a Person field through a many-to-one relation on another
object. For example, Recruitment can display its Person's Job Title in tables,
record pages, filters, sorting, and CSV exports. The destination field is reusable
across views and read-only. Edit the value on the Person record.

Create fields through **Customize fields**. Relation sources are supported too:
Recruitment → Person → Recommended Recruitments displays the Person's related
recruitments as clickable, read-only chips, including relations back to the
destination object.

## Storage and queries

The existing field metadata settings JSON contains `linkedField`, with
`relationFieldMetadataUniversalIdentifier` and
`sourceFieldMetadataUniversalIdentifier`. These stable identifiers allow source
and relation renames. The destination keeps the source type and inherits current
source display settings and select options.

No destination database column, enum, copied value, or backfill is created.
The ORM resolves virtual columns with a left join, including composite subfields,
filters, sorting, counts, aggregates, and mutation predicates. Source object,
field, relation, and row permissions apply to the join. A missing, deleted, or
inaccessible source row produces an empty value using the existing type's null
formatting. GraphQL inputs and repository writes reject destination overrides.

Source changes invalidate dependent live queries, including empty filtered
tables and record pages. Invalidation messages contain query identifiers only;
clients fetch current values through the normal permission checks. Reconnection
and reopening a linked table also fetch current values.

Relation lookups retain the source cardinality and target object. They do not own
an inverse relation: their stored inverse metadata reference is null, and runtime
metadata resolves it through the source field. This preserves the existing unique
inverse ownership constraint without creating a second foreign key or modifying
the source relation. To-many lookups use the visible Person ID as a virtual join
key; to-one lookups use the source foreign key.

List filters match any visible target. Sorting selects the first visible target
in the requested order, applies target row permissions before selection, and
keeps that representative stable in both pagination directions. Root records are
not duplicated. The table uses the existing 60-record relation preview; CSV
exports fetch all permitted targets with pagination and export their chip labels
separated by semicolons. Stored relation exports retain their existing ID format.

## Supported boundaries

Traversal is limited to one active many-to-one Person relation from a different
object and an active source type in `LINKED_FIELD_SUPPORTED_TYPES`. Ordinary
to-one and to-many relation sources are supported, including configured junction
displays. Direct morph-relation sources, files, position, search vectors, and
recursive linked sources are excluded.
Linked fields cannot be unique, have a default, be required, or become physical
fields. The source and relation cannot be removed, deactivated, or changed to an
incompatible type while referenced. The source relation's inverse is also
protected. Delete dependent linked fields first.

Linked fields cannot back physical indexes, search vectors, object labels, label
formulas, or row-permission predicate definitions. Source row permissions still
apply when reading linked values. Query-time joins add work to linked sorting
and filtering; validate representative large views before enabling many links.

## Upgrade and rollback

The metadata schema is unchanged, so no instance command or data migration is
required. Existing fields keep their storage and behavior. Frozen fixture,
clean-initialization, and verified-mirror rehearsals exercise compatibility.

Older application versions do not understand virtual fields. Before rolling
back code, inventory and record linked definitions, then remove them through the
current metadata API while this version is running. This also removes their
view references. Source Person data is preserved. Recreate the definitions after
reapplying the feature if needed; do not create replacement physical columns or
repair metadata with SQL.
