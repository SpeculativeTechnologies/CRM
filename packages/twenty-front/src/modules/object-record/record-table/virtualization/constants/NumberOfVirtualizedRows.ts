// Row containers the table mounts and recycles as you scroll. This is the main
// driver of how much DOM a view switch has to tear down and rebuild: each row
// carries ~14 cells of ~11 nodes, so 240 rows is ~15k nodes for a viewport
// showing roughly 20. Eighty rows still buffers ~2500px (several viewports)
// in the recycling window.
export const NUMBER_OF_VIRTUALIZED_ROWS = 80;
