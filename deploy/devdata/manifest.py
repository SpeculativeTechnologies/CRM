import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import re


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing mirror timestamp')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('Invalid mirror timestamp') from None
    if parsed.tzinfo is None:
        raise ValueError('Mirror timestamps must include a timezone')
    return parsed


def checksum(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate(manifest, max_age_hours=72, now=None):
    now = now or datetime.now(timezone.utc)
    if not isinstance(manifest, dict) or manifest.get('format') != 1 or manifest.get('scrub_version') != 2:
        raise ValueError('Unsupported shared mirror format or scrub version')
    if not re.fullmatch(r'snapshots/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{32}\.dump', manifest.get('key', '')):
        raise ValueError('Mirror object must be a versioned snapshot')
    for field, length in [('sha256', 64), ('source_sha', 40), ('scrubber_sha', 40)]:
        if not re.fullmatch('[0-9a-f]{' + str(length) + '}', manifest.get(field, '')):
            raise ValueError('Missing or invalid mirror checksum/revision')
    if type(manifest.get('size')) is not int or manifest['size'] < 5:
        raise ValueError('Invalid mirror size')
    if not 0 < max_age_hours <= 24 * 365:
        raise ValueError('Maximum age must be between 0 and 8760 hours')
    built = timestamp(manifest.get('built_at'))
    source = timestamp(manifest.get('source_backup_at'))
    if source > built or (built - now).total_seconds() > 300:
        raise ValueError('Mirror timestamps are inconsistent or in the future')
    # Re-scrubbing an old backup must not make stale production data look fresh.
    if (now - source).total_seconds() > max_age_hours * 3600:
        raise ValueError('Mirror source backup is too old; ask the publisher owner to refresh it')
    return manifest


def read(path, max_age_hours=72):
    if Path(path).stat().st_size > 16384:
        raise ValueError('Mirror manifest is too large')
    return validate(json.loads(Path(path).read_text()), max_age_hours)


def verify(manifest, dump):
    if Path(dump).stat().st_size != manifest['size'] or checksum(dump) != manifest['sha256']:
        raise ValueError('Mirror size or checksum does not match its manifest')
    with Path(dump).open('rb') as stream:
        if stream.read(5) != b'PGDMP':
            raise ValueError('Mirror is not a PostgreSQL custom-format dump')
