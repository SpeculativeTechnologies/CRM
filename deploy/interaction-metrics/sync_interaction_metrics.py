#!/usr/bin/env python3
"""Synchronize SpecTech-owned Person interaction metrics through Twenty's API.

The script intentionally does not import or modify the Last Contact application.
It reads message/calendar participation, computes two Person fields, and writes
only those fields back through the public GraphQL APIs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Iterator, Sequence

PAGE_SIZE = 200
FILTER_CHUNK_SIZE = 100
UPDATE_BATCH_SIZE = 40


@dataclass(frozen=True)
class Interaction:
    person_id: str
    item_id: str
    occurred_at: str
    workspace_member_ids: tuple[str, ...]


@dataclass(frozen=True)
class PersonMetric:
    interaction_count: int
    strongest_connection_id: str | None


class GraphQLClient:
    def __init__(self, url: str, token: str, access_id: str = "", access_secret: str = ""):
        self.url = url
        self.token = token
        self.access_id = access_id
        self.access_secret = access_secret

    def execute(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = json.dumps({"query": query, "variables": variables or {}}).encode()
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "SpecTech-Interaction-Metrics/1.0",
        }
        if self.access_id:
            headers["CF-Access-Client-Id"] = self.access_id
        if self.access_secret:
            headers["CF-Access-Client-Secret"] = self.access_secret

        for attempt in range(10):
            request = urllib.request.Request(self.url, data=payload, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    body = json.load(response)
            except urllib.error.HTTPError as error:
                detail = error.read().decode(errors="replace")
                raise RuntimeError(f"GraphQL HTTP {error.code}: {detail[:500]}") from error

            errors = body.get("errors") or []
            if not errors:
                return body["data"]
            if any(
                error.get("extensions", {}).get("subCode") == "LIMIT_REACHED"
                for error in errors
            ):
                delay = 61 + attempt
                print(f"Rate limited; retrying in {delay}s", file=sys.stderr)
                time.sleep(delay)
                continue
            raise RuntimeError(json.dumps(errors, indent=2))

        raise RuntimeError("GraphQL request exhausted rate-limit retries")


def chunks(values: Sequence[str], size: int = FILTER_CHUNK_SIZE) -> Iterator[list[str]]:
    for index in range(0, len(values), size):
        yield list(values[index : index + size])


def aggregate_metrics(
    person_ids: Iterable[str], interactions: Iterable[Interaction]
) -> dict[str, PersonMetric]:
    unique_interactions: dict[tuple[str, str], Interaction] = {}
    for interaction in interactions:
        key = (interaction.person_id, interaction.item_id)
        existing = unique_interactions.get(key)
        if existing is None:
            unique_interactions[key] = interaction
            continue
        unique_interactions[key] = Interaction(
            person_id=interaction.person_id,
            item_id=interaction.item_id,
            occurred_at=max(existing.occurred_at, interaction.occurred_at),
            workspace_member_ids=tuple(
                sorted(set(existing.workspace_member_ids) | set(interaction.workspace_member_ids))
            ),
        )

    by_person: dict[str, list[Interaction]] = defaultdict(list)
    for interaction in unique_interactions.values():
        by_person[interaction.person_id].append(interaction)

    result: dict[str, PersonMetric] = {}
    for person_id in person_ids:
        person_interactions = by_person.get(person_id, [])
        member_scores: dict[str, tuple[int, str]] = {}
        for interaction in person_interactions:
            for member_id in set(interaction.workspace_member_ids):
                count, latest = member_scores.get(member_id, (0, ""))
                member_scores[member_id] = (count + 1, max(latest, interaction.occurred_at))

        strongest = None
        if member_scores:
            best_score = max(member_scores.values())
            strongest = min(
                member_id
                for member_id, score in member_scores.items()
                if score == best_score
            )
        result[person_id] = PersonMetric(len(person_interactions), strongest)
    return result


def format_api_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def paginate(
    client: GraphQLClient,
    query: str,
    connection_name: str,
    filters: dict[str, Any] | None = None,
) -> Iterator[dict[str, Any]]:
    after = None
    while True:
        data = client.execute(
            query,
            {"first": PAGE_SIZE, "after": after, "filter": filters or {}},
        )[connection_name]
        for edge in data.get("edges", []):
            yield edge["node"]
        page_info = data["pageInfo"]
        if not page_info["hasNextPage"]:
            return
        after = page_info["endCursor"]


PEOPLE_QUERY = """
query People($first: Int!, $after: String, $filter: PersonFilterInput!) {
  people(first: $first, after: $after, filter: $filter) {
    edges { node { id } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

MESSAGE_PARTICIPANTS_QUERY = """
query MessageParticipants($first: Int!, $after: String, $filter: MessageParticipantFilterInput!) {
  messageParticipants(first: $first, after: $after, filter: $filter) {
    edges { node { personId messageId message { receivedAt } } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

MESSAGE_MEMBERS_QUERY = """
query MessageMembers($first: Int!, $after: String, $filter: MessageParticipantFilterInput!) {
  messageParticipants(first: $first, after: $after, filter: $filter) {
    edges { node { messageId workspaceMemberId } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

CALENDAR_PARTICIPANTS_QUERY = """
query CalendarParticipants(
  $first: Int!, $after: String, $filter: CalendarEventParticipantFilterInput!
) {
  calendarEventParticipants(first: $first, after: $after, filter: $filter) {
    edges { node { personId calendarEventId calendarEvent { startsAt isCanceled } } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

CALENDAR_MEMBERS_QUERY = """
query CalendarMembers($first: Int!, $after: String, $filter: CalendarEventParticipantFilterInput!) {
  calendarEventParticipants(first: $first, after: $after, filter: $filter) {
    edges { node { calendarEventId workspaceMemberId } }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def find_affected_people(
    client: GraphQLClient, since: str | None, max_people: int | None = None
) -> list[str]:
    if since is None:
        people: list[str] = []
        for node in paginate(client, PEOPLE_QUERY, "people"):
            people.append(node["id"])
            if max_people is not None and len(people) >= max_people:
                break
        return sorted(people)

    person_ids: set[str] = set()
    changed_filter = {"updatedAt": {"gte": since}, "personId": {"is": "NOT_NULL"}}
    for query, name in (
        (MESSAGE_PARTICIPANTS_QUERY, "messageParticipants"),
        (CALENDAR_PARTICIPANTS_QUERY, "calendarEventParticipants"),
    ):
        for node in paginate(client, query, name, changed_filter):
            if node.get("personId"):
                person_ids.add(node["personId"])
                if max_people is not None and len(person_ids) >= max_people:
                    return sorted(person_ids)
    return sorted(person_ids)


def fetch_interactions(client: GraphQLClient, person_ids: Sequence[str]) -> list[Interaction]:
    email_rows: list[dict[str, Any]] = []
    meeting_rows: list[dict[str, Any]] = []
    now = format_api_datetime(datetime.now(timezone.utc))

    for person_chunk in chunks(person_ids):
        person_filter = {"personId": {"in": person_chunk}}
        email_rows.extend(
            paginate(client, MESSAGE_PARTICIPANTS_QUERY, "messageParticipants", person_filter)
        )
        meeting_rows.extend(
            paginate(
                client,
                CALENDAR_PARTICIPANTS_QUERY,
                "calendarEventParticipants",
                person_filter,
            )
        )

    message_ids = sorted({row["messageId"] for row in email_rows if row.get("messageId")})
    event_ids = sorted(
        {row["calendarEventId"] for row in meeting_rows if row.get("calendarEventId")}
    )
    message_members: dict[str, set[str]] = defaultdict(set)
    calendar_members: dict[str, set[str]] = defaultdict(set)

    for message_chunk in chunks(message_ids):
        member_filter = {
            "messageId": {"in": message_chunk},
            "workspaceMemberId": {"is": "NOT_NULL"},
        }
        for row in paginate(client, MESSAGE_MEMBERS_QUERY, "messageParticipants", member_filter):
            if row.get("workspaceMemberId"):
                message_members[row["messageId"]].add(row["workspaceMemberId"])

    for event_chunk in chunks(event_ids):
        member_filter = {
            "calendarEventId": {"in": event_chunk},
            "workspaceMemberId": {"is": "NOT_NULL"},
        }
        for row in paginate(
            client, CALENDAR_MEMBERS_QUERY, "calendarEventParticipants", member_filter
        ):
            if row.get("workspaceMemberId"):
                calendar_members[row["calendarEventId"]].add(row["workspaceMemberId"])

    interactions: list[Interaction] = []
    for row in email_rows:
        received_at = (row.get("message") or {}).get("receivedAt")
        if row.get("personId") and row.get("messageId") and received_at:
            interactions.append(
                Interaction(
                    row["personId"],
                    f"message:{row['messageId']}",
                    received_at,
                    tuple(sorted(message_members[row["messageId"]])),
                )
            )
    for row in meeting_rows:
        event = row.get("calendarEvent") or {}
        starts_at = event.get("startsAt")
        if (
            row.get("personId")
            and row.get("calendarEventId")
            and starts_at
            and not event.get("isCanceled")
            and starts_at <= now
        ):
            interactions.append(
                Interaction(
                    row["personId"],
                    f"calendar:{row['calendarEventId']}",
                    starts_at,
                    tuple(sorted(calendar_members[row["calendarEventId"]])),
                )
            )
    return interactions


OBJECTS_QUERY = """
query Objects($filter: ObjectFilter!, $paging: CursorPaging!) {
  objects(filter: $filter, paging: $paging) { edges { node { id nameSingular } } }
}
"""

FIELDS_QUERY = """
query Fields($filter: FieldFilter!, $paging: CursorPaging!) {
  fields(filter: $filter, paging: $paging) { edges { node { id name } } }
}
"""

CREATE_FIELD_MUTATION = """
mutation CreateField($input: CreateOneFieldMetadataInput!) {
  createOneField(input: $input) { id name }
}
"""


def provision_fields(metadata_client: GraphQLClient, apply: bool) -> None:
    objects = metadata_client.execute(
        OBJECTS_QUERY,
        {"filter": {}, "paging": {"first": 1000}},
    )["objects"]["edges"]
    object_ids = {edge["node"]["nameSingular"]: edge["node"]["id"] for edge in objects}
    if not {"person", "workspaceMember"}.issubset(object_ids):
        raise RuntimeError("Could not find Person and Workspace Member metadata")

    fields = metadata_client.execute(
        FIELDS_QUERY,
        {
            "filter": {
                "objectMetadataId": {"eq": object_ids["person"]},
            },
            "paging": {"first": 1000},
        },
    )["fields"]["edges"]
    existing = {edge["node"]["name"] for edge in fields}

    if "interactionCount" not in existing:
        if not apply:
            print("Dry run: would create Interaction count field")
        else:
            metadata_client.execute(
                CREATE_FIELD_MUTATION,
                {
                    "input": {
                        "field": {
                            "objectMetadataId": object_ids["person"],
                            "type": "NUMBER",
                            "name": "interactionCount",
                            "label": "Interaction count",
                            "description": (
                                "Unique synced emails and completed meetings with this person."
                            ),
                            "icon": "IconArrowsExchange",
                            "isLabelSyncedWithName": False,
                            "isNullable": True,
                        }
                    }
                },
            )
            print("Created Interaction count field")

    if "strongestConnection" not in existing:
        if not apply:
            print("Dry run: would create Strongest connection field")
        else:
            metadata_client.execute(
                CREATE_FIELD_MUTATION,
                {
                    "input": {
                        "field": {
                            "objectMetadataId": object_ids["person"],
                            "type": "RELATION",
                            "name": "strongestConnection",
                            "label": "Strongest connection",
                            "description": (
                                "Teammate involved in the most synced interactions with this person."
                            ),
                            "icon": "IconUsersGroup",
                            "isLabelSyncedWithName": False,
                            "isNullable": True,
                            "relationCreationPayload": {
                                "targetObjectMetadataId": object_ids[
                                    "workspaceMember"
                                ],
                                "targetFieldLabel": "Strongest connection for",
                                "targetFieldIcon": "IconUsersGroup",
                                "type": "MANY_TO_ONE",
                            },
                        },
                    }
                },
            )
            print("Created Strongest connection field")


def write_metrics(client: GraphQLClient, metrics: dict[str, PersonMetric]) -> None:
    items = list(metrics.items())
    for offset in range(0, len(items), UPDATE_BATCH_SIZE):
        batch = items[offset : offset + UPDATE_BATCH_SIZE]
        declarations: list[str] = []
        fields: list[str] = []
        variables: dict[str, Any] = {}
        for index, (person_id, metric) in enumerate(batch):
            declarations.extend([f"$id{index}: UUID!", f"$data{index}: PersonUpdateInput!"])
            fields.append(
                f"p{index}: updatePerson(id: $id{index}, data: $data{index}) {{ id }}"
            )
            variables[f"id{index}"] = person_id
            variables[f"data{index}"] = {
                "interactionCount": metric.interaction_count,
                "strongestConnectionId": metric.strongest_connection_id,
            }
        client.execute(f"mutation ({', '.join(declarations)}) {{ {' '.join(fields)} }}", variables)
        print(f"Updated {min(offset + len(batch), len(items))}/{len(items)} people")


def build_clients() -> tuple[GraphQLClient, GraphQLClient]:
    api_url = os.environ.get("TWENTY_API_URL", "").rstrip("/")
    token = os.environ.get("TWENTY_API_KEY", "")
    if not api_url or not token:
        raise RuntimeError("TWENTY_API_URL and TWENTY_API_KEY are required")
    access_id = os.environ.get("CF_ACCESS_CLIENT_ID", "")
    access_secret = os.environ.get("CF_ACCESS_CLIENT_SECRET", "")
    metadata_url = os.environ.get(
        "TWENTY_METADATA_API_URL",
        api_url.removesuffix("/graphql") + "/metadata",
    )
    return (
        GraphQLClient(api_url, token, access_id, access_secret),
        GraphQLClient(metadata_url, token, access_id, access_secret),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write calculated values")
    parser.add_argument("--provision", action="store_true", help="Create missing fields")
    parser.add_argument("--all", action="store_true", help="Recompute every Person")
    parser.add_argument("--lookback-hours", type=int, default=26)
    parser.add_argument(
        "--max-people", type=int, help="Limit people for a read-only validation run"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    client, metadata_client = build_clients()
    if args.provision:
        provision_fields(metadata_client, args.apply)

    since = None
    if not args.all:
        since = format_api_datetime(
            datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)
        )
    if args.apply and args.max_people is not None:
        raise RuntimeError("--max-people is only allowed for dry runs")
    person_ids = find_affected_people(client, since, args.max_people)
    print(f"Found {len(person_ids)} people to recompute")
    interactions = fetch_interactions(client, person_ids)
    metrics = aggregate_metrics(person_ids, interactions)
    print(
        f"Calculated {len(metrics)} people from "
        f"{sum(metric.interaction_count for metric in metrics.values())} unique interactions"
    )
    if args.apply:
        write_metrics(client, metrics)
    else:
        print("Dry run: no records written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
