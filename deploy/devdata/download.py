import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from manifest import read, verify


def download(output, bucket, max_age_hours=72):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', bucket):
        raise ValueError('Configure TWENTY_DEVDATA_BUCKET with the private scrubbed-mirror bucket')
    output = Path(output).resolve()
    sidecar = output.with_name(output.name + '.json')
    if output.exists() or sidecar.exists():
        raise ValueError('Output already exists; choose a new filename to preserve your saved mirror')
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    def fetch(key, destination):
        result = subprocess.run(['rclone', 'copyto', f'DEVDATA:{bucket}/{key}', str(destination),
                                 '--config', '/dev/null', '--s3-no-check-bucket', '--quiet'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode:
            raise ValueError('Mirror download failed; check the publisher and your scrubbed-bucket read credentials')

    with tempfile.TemporaryDirectory(prefix='.devdata-', dir=output.parent) as temporary:
        directory = Path(temporary)
        fetch('latest.json', directory / 'latest.json')
        manifest = read(directory / 'latest.json', max_age_hours)
        fetch(manifest['key'], directory / 'mirror.dump')
        verify(manifest, directory / 'mirror.dump')
        (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        # Links are atomic and refuse to overwrite an existing frozen snapshot.
        os.link(directory / 'mirror.dump', output)
        try:
            os.link(directory / 'manifest.json', sidecar)
        except OSError:
            output.unlink()
            raise
    print(f'[devdata-download] verified transfer; backup {manifest["source_backup_at"]}, source {manifest["source_sha"]}')
    print('[devdata-download] the restore command must also run devdata-verify.sql before starting the app')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description='Download a published scrubbed mirror without raw-backup access')
    parser.add_argument('--output', required=True)
    parser.add_argument('--max-age-hours', type=int, default=72)
    args = parser.parse_args()
    try:
        download(args.output, os.environ.get('TWENTY_DEVDATA_BUCKET', ''), args.max_age_hours)
    except (ValueError, OSError, TypeError) as error:
        # Do not relay storage/server errors that might contain credentials or data.
        message = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else 'Invalid manifest, unavailable tool, or local file operation failed'
        print(f'[devdata-download] ERROR: {message}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
