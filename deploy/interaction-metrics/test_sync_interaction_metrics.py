import unittest

from sync_interaction_metrics import Interaction, PersonMetric, aggregate_metrics


class AggregateMetricsTest(unittest.TestCase):
    def test_counts_unique_items_and_scores_each_involved_member(self):
        interactions = [
            Interaction("person-1", "message-1", "2026-08-01", ("member-a",)),
            Interaction("person-1", "message-1", "2026-08-01", ("member-a",)),
            Interaction("person-1", "meeting-1", "2026-08-02", ("member-a", "member-b")),
            Interaction("person-1", "message-2", "2026-08-03", ("member-b",)),
        ]

        self.assertEqual(
            aggregate_metrics(["person-1"], interactions)["person-1"],
            PersonMetric(interaction_count=3, strongest_connection_id="member-b"),
        )

    def test_uses_recency_then_stable_id_to_break_ties(self):
        interactions = [
            Interaction("person-1", "message-1", "2026-08-02", ("member-b",)),
            Interaction("person-1", "message-2", "2026-08-03", ("member-a",)),
        ]
        self.assertEqual(
            aggregate_metrics(["person-1"], interactions)["person-1"],
            PersonMetric(interaction_count=2, strongest_connection_id="member-a"),
        )

        exact_tie = [
            Interaction("person-1", "message-1", "2026-08-03", ("member-b",)),
            Interaction("person-1", "message-2", "2026-08-03", ("member-a",)),
        ]
        self.assertEqual(
            aggregate_metrics(["person-1"], exact_tie)["person-1"].strongest_connection_id,
            "member-a",
        )

    def test_emits_zero_and_null_for_people_without_interactions(self):
        self.assertEqual(
            aggregate_metrics(["person-1"], [])["person-1"],
            PersonMetric(interaction_count=0, strongest_connection_id=None),
        )


if __name__ == "__main__":
    unittest.main()
