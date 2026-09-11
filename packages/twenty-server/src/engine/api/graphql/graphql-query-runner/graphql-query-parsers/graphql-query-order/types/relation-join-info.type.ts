import { type ToManyDedupOrder } from 'src/engine/twenty-orm/sql/utils/build-select-statement.util';

export type RelationJoinInfo = {
  toManyDedupOrder?: ToManyDedupOrder[];
  joinAlias: string;
};
