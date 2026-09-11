import { mapQualifiedColumnReferences } from 'src/engine/twenty-orm/sql/utils/map-qualified-column-references.util';

describe('mapQualifiedColumnReferences', () => {
  it('maps qualified identifiers while preserving literals, comments and result aliases', () => {
    const sql = `SELECT record.linked, "record"."linked" AS "record.linked", 'record.linked', $$record.linked$$, $tag$"record"."linked"$tag$ -- record.linked
/* record.linked */ WHERE "record"."linked" = 'it''s record.linked'`;
    const result = mapQualifiedColumnReferences(sql, (alias, column) =>
      alias === 'record' && column === 'linked'
        ? '"source"."value"'
        : undefined,
    );
    expect(result.match(/"source"\."value"/g)).toHaveLength(3);
    expect(result).toContain('AS "record.linked"');
    expect(result).toContain("'it''s record.linked'");
    expect(result).toContain('$tag$"record"."linked"$tag$');
    expect(result).toContain('/* record.linked */');
  });
});
