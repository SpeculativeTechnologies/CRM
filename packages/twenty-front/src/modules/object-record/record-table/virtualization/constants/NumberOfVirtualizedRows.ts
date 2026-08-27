// Row containers the table mounts and recycles as you scroll. This is the main
// driver of how much DOM a view switch has to tear down and rebuild: each row
// carries ~14 cells of ~10 nodes, so 240 rows was ~16k nodes for a viewport
// showing roughly 20. Forty still buffers a full viewport in each direction of
// the recycling window.
export const NUMBER_OF_VIRTUALIZED_ROWS = 40;
